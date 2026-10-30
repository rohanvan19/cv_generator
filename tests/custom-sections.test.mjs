import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {bi,blankProfile,blankWorkspace,newEntry,newApplication,newCustomSection,addCustomSection,removeCustomSection,customSectionKey,profileSchema,workspaceSchema,profileTextFields,applyProfileChanges,profileChanges,missingTranslations,defaultSectionOrder} from '../lib/model.ts';
import {createPdf} from '../server/pdf.mjs';
import {translateProfile} from '../server/translation.mjs';

function fixture(){
 const section=newCustomSection(bi('Volunteering','Ehrenamt'));
 section.entries=[{...newEntry('Part-time'),title:bi('Mentor','Betreuer'),organization:bi('Example Club','Beispielverein'),location:bi('Berlin','Berlin'),start:'2024-01',current:true,description:bi('Taught Python to students.','Studierenden Python beigebracht.')}];
 const profile=addCustomSection(blankProfile(),section);profile.personal.name='Test Candidate';
 return {profile,section,key:customSectionKey(section.id)};
}

test('legacy profiles migrate without changing order and custom sections survive independent draft copies',()=>{
 const legacy=blankWorkspace();delete legacy.profile.customSections;legacy.profile.settings.sectionOrder.reverse();
 legacy.applications=[newApplication(legacy.profile)];const before=structuredClone(legacy);
 const parsed=workspaceSchema.parse(legacy);
 assert.deepEqual(legacy,before);assert.deepEqual(parsed.profile.customSections,[]);assert.deepEqual(parsed.applications[0].draft.customSections,[]);
 assert.deepEqual(parsed.profile.settings.sectionOrder,legacy.profile.settings.sectionOrder);
 const {profile,section,key}=fixture();const app=newApplication(profile);
 app.draft.customSections[0].entries[0].title.en='Draft role';
 assert.equal(profile.customSections[0].entries[0].title.en,'Mentor');
 const workspace={...blankWorkspace(),profile,applications:[app]};
 assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(workspace))),workspace);
 const removed=profileSchema.parse(removeCustomSection(profile,section.id));
 assert.deepEqual(removed.customSections,[]);assert(!removed.settings.sectionOrder.includes(key));
 assert.equal(app.draft.customSections.length,1);
});

test('section validation rejects duplicate IDs, dangling order references and oversized custom lists',()=>{
 const {profile,section,key}=fixture();
 const badOrder=structuredClone(profile);badOrder.settings.sectionOrder.push('custom:missing');
 assert.equal(profileSchema.safeParse(badOrder).success,false);
 const missing=structuredClone(profile);missing.settings.sectionOrder=defaultSectionOrder;
 assert.equal(profileSchema.safeParse(missing).success,false);
 const duplicate=structuredClone(profile);duplicate.customSections.push(section);duplicate.settings.sectionOrder.push(key);
 assert.equal(profileSchema.safeParse(duplicate).success,false);
 const oversized=structuredClone(profile);oversized.customSections[0].entries=Array.from({length:61},()=>newEntry());
 assert.equal(profileSchema.safeParse(oversized).success,false);
 let many=blankProfile();for(let i=0;i<21;i++)many=addCustomSection(many,newCustomSection(bi('Section '+i)));
 assert.equal(profileSchema.safeParse(many).success,false);
});

test('custom section headings and entries translate with selective acceptance and missing-translation warnings',async()=>{
 const {profile,key}=fixture();
 const translations=Object.fromEntries(profileTextFields(profile).map(field=>[field.key,field.value.de]));
 for(const field of profileTextFields(profile))field.value.de='';
 assert.equal(missingTranslations(profile,'de'),5);
 const result=await translateProfile(profile,'de',async(schema,payload)=>({output:JSON.stringify({translations:Object.fromEntries(payload.fields.map(field=>[field.key,translations[field.key]]))}),provider:'fixture',model:'none'}));
 assert.equal(missingTranslations(result.profile,'de'),0);
 const changes=profileChanges(profile,result.profile,'de');assert.equal(changes.length,5);assert(changes.every(change=>change.section===key));
 const accepted=applyProfileChanges(profile,result.profile,[key+':title'],'de');
 assert.equal(accepted.customSections[0].title.de,'Ehrenamt');assert.equal(accepted.customSections[0].entries[0].description.de,'');
 profile.customSections[0].included=false;
 assert.equal(missingTranslations(profile,'de'),0);
 profile.customSections[0].included=true;profile.customSections[0].entries[0].included=false;
 assert.equal(missingTranslations(profile,'de'),0);
});

test('PDF uses custom headings, selected order, employment types and chronological entries in both languages',async()=>{
 const {profile,section,key}=fixture();
 profile.experience=[{...newEntry(),title:bi('Main role','Haupttätigkeit')}];
 section.entries.unshift({...newEntry(),title:bi('Earlier role','Frühere Tätigkeit'),start:'2020-01',end:'2021-01'});
 section.entries.push({...newEntry(),title:bi('Hidden role','Versteckte Tätigkeit'),included:false});
 profile.settings.sectionOrder=[key,...defaultSectionOrder];
 const original=PDFDocument.prototype.text;let rendered=[];
 PDFDocument.prototype.text=function(value,...args){rendered.push(String(value));return original.call(this,value,...args);};
 try{
  for(const lang of ['en','de']){
   profile.settings.language=lang;rendered=[];const pdf=await createPdf(profile);
   assert.equal(pdf.subarray(0,4).toString(),'%PDF');
   const heading=rendered.indexOf(section.title[lang].toLocaleUpperCase(lang));
   const current=rendered.indexOf(lang==='en'?'Mentor · Part-time':'Betreuer · Teilzeit');
   const earlier=rendered.indexOf(section.entries[0].title[lang]);const main=rendered.indexOf(profile.experience[0].title[lang]);
   assert(heading>=0&&heading<current&&current<earlier&&earlier<main);
   assert(!rendered.includes(section.entries[2].title[lang]));
  }
  section.included=false;rendered=[];await createPdf(profile);assert(!rendered.includes('EHRENAMT'));
  section.included=true;section.entries=[];rendered=[];await createPdf(profile);assert(!rendered.includes('EHRENAMT'));
 }finally{PDFDocument.prototype.text=original;}
});

test('custom sections persist through the workspace API and export through the PDF API',async(t)=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cv-custom-test-'));process.env.CV_DATA_DIR=dir;
 const {handleApi}=await import('../server/api.mjs');
 const server=http.createServer(async(req,res)=>{if(!await handleApi(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;const initial=await (await fetch(base+'/api/workspace')).json();
 const {profile}=fixture();const state={...initial.state,profile,applications:[newApplication(profile)]};
 const saved=await fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision:initial.revision})});assert.equal(saved.status,200);
 const loaded=await (await fetch(base+'/api/workspace')).json();assert.deepEqual(loaded.state,state);
 const pdf=await fetch(base+'/api/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile})});assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
});
