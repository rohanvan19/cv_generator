import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {blankWorkspace,blankProfile,demoProfile,newApplication,newEntry,ordered,missingTranslations,workspaceSchema,defaultSectionOrder,profileChanges,applyProfileChanges,formatBirthDate,employmentTypeLabel,profileTextFields} from '../lib/model.ts';

test('application snapshots are independent of master profile and of each other',()=>{
 const master=demoProfile();
 const a=newApplication(master,'A','Engineer');
 const b=newApplication(master,'B','Engineer');
 a.draft.experience[0].description.en='Changed';
 a.draft.photo.x=20;
 assert.notEqual(master.experience[0].description.en,'Changed');
 assert.notEqual(b.draft.experience[0].description.en,'Changed');
 assert.equal(master.photo.x,50);
});

test('accepted translations apply individually without changing declined fields',()=>{
 const before=demoProfile();
 before.projects=[{...newEntry(),id:'project-one',title:{en:'Automation project',de:'Automatisierungsprojekt'},description:{en:'Built a Python utility.',de:'Ein Python-Werkzeug entwickelt.'}}];
 const after=structuredClone(before);
 after.experience[0].description={en:'Translated experience wording.',de:'Übersetzte Berufserfahrung.'};
 after.projects[0].description={en:'Translated project wording.',de:'Übersetzte Projektbeschreibung.'};
 after.skills[0].name={en:'SQL, Python',de:'SQL, Python'};
 const changes=profileChanges(before,after,'de');
 assert.deepEqual(new Set(changes.map(change=>change.section)),new Set(['experience','projects','skills']));
 const skillChange=changes.find(change=>change.section==='skills');
 const applied=applyProfileChanges(before,after,[skillChange.key],'de');
 assert.equal(applied.skills[0].name.de,after.skills[0].name.de);
 assert.equal(applied.skills[0].name.en,before.skills[0].name.en);
 assert.deepEqual(applied.experience[0].description,before.experience[0].description);
 assert.deepEqual(applied.projects[0].description,before.projects[0].description);
 assert.deepEqual(applied.summary,before.summary);
});
test('chronological layout puts current roles first and excludes hidden entries',()=>{
 const entries=[
  {...newEntry(),id:'old',start:'2020-01',end:'2022-01'},
  {...newEntry(),id:'now',start:'2019-01',current:true},
  {...newEntry(),id:'recent',start:'2023-01',end:'2025-01'},
  {...newEntry(),id:'hidden',current:true,included:false}
 ];
 assert.deepEqual(ordered(entries).map(e=>e.id),['now','recent','old']);
});

test('schema rejects invalid dates, unsafe image payloads and malformed backups',()=>{
 const p=demoProfile();
 p.experience[0].start='2020-19';
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile:p}).success,false);
 const q=blankProfile();
 q.photo.cropped='https://external.example/track';
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile:q}).success,false);
 assert.equal(workspaceSchema.safeParse({profile:{}}).success,false);
});

test('birth date spacing and employment types are validated and migrate safely',()=>{
 assert.equal(formatBirthDate('2001-12-17'),'17. 12. 2001');
 assert.equal(formatBirthDate(''),'');
 assert.equal(employmentTypeLabel('Full-time','en'),'Full-time');
 assert.equal(employmentTypeLabel('Internship','de'),'Praktikum');
 const legacy=demoProfile();
 delete legacy.experience[0].employmentType;
 const migrated=workspaceSchema.parse({...blankWorkspace(),profile:legacy});
 assert.equal(migrated.profile.experience[0].employmentType,'');
 const profile=demoProfile();
 profile.experience[0].employmentType='Part-time';
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile}).success,true);
 profile.experience[0].employmentType='Contract';
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile}).success,false);
});
test('legacy skills migrate to category and retain grouped items',()=>{
 const old=blankWorkspace();
 old.profile.skills=[{id:'old-skill',name:{en:'FastAPI, NumPy',de:'FastAPI, NumPy'},included:true}];
 const migrated=workspaceSchema.parse(old);
 assert.deepEqual(migrated.profile.skills[0].category,{en:'',de:''});
});

test('legacy profiles receive typography defaults and invalid CV settings are rejected',()=>{
 const legacy=demoProfile();
 delete legacy.settings.sectionOrder;
 delete legacy.settings.fontFamily;
 delete legacy.settings.fontSize;
 const migrated=workspaceSchema.parse({...blankWorkspace(),profile:legacy});
 assert.deepEqual(migrated.profile.settings.sectionOrder,defaultSectionOrder);
 assert.equal(migrated.profile.settings.fontFamily,'inter');
 assert.equal(migrated.profile.settings.fontSize,10);
 const custom=[...defaultSectionOrder].reverse();
 const reordered=workspaceSchema.parse({...blankWorkspace(),profile:{...demoProfile(),settings:{...demoProfile().settings,sectionOrder:custom}}});
 assert.deepEqual(reordered.profile.settings.sectionOrder,custom);
 const duplicate=[...defaultSectionOrder];
 duplicate[1]=duplicate[0];
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile:{...demoProfile(),settings:{...demoProfile().settings,sectionOrder:duplicate}}}).success,false);
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile:{...demoProfile(),settings:{...demoProfile().settings,fontFamily:'comic'}}}).success,false);
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile:{...demoProfile(),settings:{...demoProfile().settings,fontSize:13}}}).success,false);
});

test('language fallback is surfaced and disappears after translation',()=>{
 const p=blankProfile();
 p.headline.en='Engineer';
 assert.equal(missingTranslations(p,'de'),1);
 p.headline.de='Ingenieur';
 assert.equal(missingTranslations(p,'de'),0);
});

test('local API persists snapshots, detects stale writes, and rejects invalid or cross-origin requests',async(t)=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'cv-studio-test-'));
 process.env.CV_DATA_DIR=dir;
 const {handleApi}=await import('../server/api.mjs');
 const server=http.createServer(async(req,res)=>{if(!await handleApi(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 const initial=await (await fetch(base+'/api/workspace')).json();
 assert.equal(initial.revision,'new');
 const state=initial.state;
 state.profile=demoProfile();
 state.applications=[newApplication(state.profile,'Test Company','Engineer')];
 const save=await fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision:initial.revision})});
 assert.equal(save.status,200);
 const saved=await save.json();
 assert.notEqual(saved.revision,'new');
 const reload=await(await fetch(base+'/api/workspace')).json();
 assert.equal(reload.state.profile.personal.name,'Alex Morgan');
 assert.equal(reload.state.applications.length,1);
 const stale=await fetch(base+'/api/workspace',{method:'PUT',body:JSON.stringify({state,revision:'new'})});
 assert.equal(stale.status,409);
 const invalid=await fetch(base+'/api/workspace',{method:'PUT',body:JSON.stringify({state:{},revision:saved.revision})});
 assert.equal(invalid.status,400);
 const cross=await fetch(base+'/api/workspace',{headers:{Origin:'https://unrelated.example'}});
 assert.equal(cross.status,403);
 const malformed=await fetch(base+'/api/pdf',{method:'POST',body:'invalid'});
 assert.equal(malformed.status,400);
 const pdf=await fetch(base+'/api/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:state.profile})});
 assert.equal(pdf.status,200);
 const bytes=Buffer.from(await pdf.arrayBuffer());
 assert.equal(bytes.subarray(0,4).toString(),'%PDF');
 assert(bytes.length>5000);
 assert.equal((bytes.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1,'Footer must not create an extra page');
 for(const [fontFamily,fontSize] of [['arial',8],['times',12]]){
  const styledProfile=structuredClone(state.profile);
  styledProfile.settings={...styledProfile.settings,fontFamily,fontSize};
  const styledPdf=await fetch(base+'/api/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:styledProfile})});
  assert.equal(styledPdf.status,200);
  const styledBytes=Buffer.from(await styledPdf.arrayBuffer());
  assert.equal(styledBytes.subarray(0,4).toString(),'%PDF');
  assert(styledBytes.length>3000);
 }

 const realFetch=globalThis.fetch;
 const previousKey=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='test-key-not-real';
 let externalCalls=0;
 globalThis.fetch=async(input,options)=>{
  if(input==='https://api.openai.com/v1/responses'){
   externalCalls++;
   const request=JSON.parse(options.body);
   assert.equal(request.store,false);
   const payload=JSON.parse(request.input);
   if(payload.action==='translate'){
    assert.equal(payload.targetLanguage,'de');
    assert.equal(payload.sourceLanguage,'en');
    assert.equal(payload.profile,undefined);
    assert.equal(payload.jobDescription,undefined);
    assert.deepEqual(request.text.format.schema.properties.translations.required,payload.fields.map(field=>field.key));
    const translations=Object.fromEntries(payload.fields.map(field=>[field.key,field.key==='summary'?'Geprüfte Übersetzung.':profileTextFields(state.profile).find(item=>item.key===field.key).value.de]));
    return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({translations})}]}]});
   }
  }
  return realFetch(input,options);
 };
 try{
  const assist=await fetch(base+'/api/assist',{method:'POST',body:JSON.stringify({profile:state.profile,jobDescription:'Python developer',action:'translate',provider:'openai'})});
  assert.equal(assist.status,200);
  const suggestion=await assist.json();
  assert.equal(suggestion.profile.personal.name,state.profile.personal.name);
  assert.deepEqual(suggestion.profile.experience[0].organization,state.profile.experience[0].organization);
  assert.equal(suggestion.profile.languages[0].level,state.profile.languages[0].level);
  assert.equal(suggestion.profile.summary.de,'Geprüfte Übersetzung.');
  const translationCalls=externalCalls;
  assert(translationCalls>1,'Translation must cover the CV in bounded batches');
  const invalidAssist=await fetch(base+'/api/assist',{method:'POST',body:JSON.stringify({profile:state.profile,jobDescription:'Python developer',action:'tailor',provider:'openai'})});
  assert.equal(invalidAssist.status,400);
  assert.equal(externalCalls,translationCalls);
 }finally{
  globalThis.fetch=realFetch;
  if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;
 }
 const disk=JSON.parse(await fs.readFile(path.join(dir,'workspace.json'),'utf8'));
 assert.deepEqual(disk,state);
});

test('personal details migrate date of birth and custom fields safely',()=>{
 const legacy=demoProfile();
 delete legacy.personal.dateOfBirth;
 delete legacy.personal.customFields;
 const migrated=workspaceSchema.parse({...blankWorkspace(),profile:legacy}).profile;
 assert.equal(migrated.personal.dateOfBirth,'');
 assert.deepEqual(migrated.personal.customFields,[]);
 const profile=demoProfile();
 profile.personal.customFields=[{id:'availability',label:{en:'Availability',de:''},value:{en:'Immediately',de:''},included:true}];
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile}).success,true);
 assert.equal(missingTranslations(profile,'de'),2);
 profile.personal.dateOfBirth='1992-14-01';
 assert.equal(workspaceSchema.safeParse({...blankWorkspace(),profile}).success,false);
});

test('legacy workspaces receive automatic AI settings',()=>{
 const legacy=blankWorkspace();
 delete legacy.aiSettings;
 const migrated=workspaceSchema.parse(legacy);
 assert.deepEqual(migrated.aiSettings,{provider:'auto',ollamaModel:''});
});
