import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import {blankWorkspace,blankProfile,newEntry,newApplication,workspaceSchema,profileSchema,defaultSectionOrder,cvLabels,profileTextFields,profileChanges,applyProfileChanges,missingTranslations,matchJob} from '../lib/model.ts';
import {translateProfile} from '../server/translation.mjs';
import {createPdf} from '../server/pdf.mjs';

const internship=(id='intern-test')=>({
 ...newEntry('Internship'),id,
 title:{en:'Software intern',de:'Softwarepraktikant'},
 organization:{en:'Example Company',de:'Beispielfirma'},
 location:{en:'Munich, Germany',de:'München, Deutschland'},
 start:'2025-03',end:'2025-09',
 description:{en:'Built Python scripts for data analysis.',de:'Python-Skripte für die Datenanalyse entwickelt.'}
});

test('legacy master and application orders gain internships while preserving their existing order and entries',()=>{
 const legacy=blankWorkspace();
 delete legacy.profile.internships;
 const oldOrder=defaultSectionOrder.filter(section=>section!=='internships').reverse();
 legacy.profile.settings.sectionOrder=oldOrder;
 legacy.profile.experience=[internship('existing-experience')];
 legacy.applications=[newApplication(legacy.profile,'Example','Engineer')];
 const before=structuredClone(legacy);
 const migrated=workspaceSchema.parse(legacy);
 assert.deepEqual(legacy,before,'Migration must not mutate the source data');
 for(const profile of [migrated.profile,migrated.applications[0].draft]){
  assert.deepEqual(profile.internships,[]);
  assert.deepEqual(profile.experience,before.profile.experience,'Existing internships in experience must not be moved automatically');
  assert.deepEqual(profile.settings.sectionOrder.filter(section=>section!=='internships'),oldOrder);
  assert.equal(profile.settings.sectionOrder.indexOf('internships'),profile.settings.sectionOrder.indexOf('experience')+1);
 }
 assert.deepEqual(workspaceSchema.parse(migrated),migrated,'Migration must be stable on subsequent saves');
 const current=blankWorkspace();
 current.profile.settings.sectionOrder=[...defaultSectionOrder].reverse();
 assert.deepEqual(workspaceSchema.parse(current).profile.settings.sectionOrder,current.profile.settings.sectionOrder);
 const duplicate=structuredClone(legacy);duplicate.profile.settings.sectionOrder[1]=duplicate.profile.settings.sectionOrder[0];
 assert.equal(workspaceSchema.safeParse(duplicate).success,false);
});

test('internship entries survive backup round trips and independent application snapshots',()=>{
 const profile=blankProfile();profile.internships=[internship()];
 assert.equal(profile.internships[0].employmentType,'Internship');
 const draft=newApplication(profile,'Example','Graduate engineer');
 draft.draft.internships[0].description.en='Draft-specific wording';
 assert.notEqual(profile.internships[0].description.en,draft.draft.internships[0].description.en);
 const state={...blankWorkspace(),profile,applications:[draft]};
 assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(state))),state);
 const removed=structuredClone(profile);removed.internships=[];
 assert.equal(profileSchema.parse(removed).internships.length,0);
 assert.equal(profile.internships.length,1);
});

test('internship text participates in translation, individual acceptance and included requirement coverage',async()=>{
 const profile=blankProfile();profile.internships=[internship()];
 const translations=Object.fromEntries(profileTextFields(profile).filter(field=>field.section==='internships').map(field=>[field.key,field.value.de]));
 for(const field of profileTextFields(profile))if(field.section==='internships')field.value.de='';
 assert.equal(missingTranslations(profile,'de'),4);
 const result=await translateProfile(profile,'de',async(schema,payload)=>{
  assert.equal(payload.fields.length,4);
  assert(payload.fields.every(field=>field.key.startsWith('internships:intern-test:')));
  assert.equal(schema.properties.translations.properties['internships:intern-test:location'].maxLength,400);
  return {output:JSON.stringify({translations}),provider:'offline-fixture',model:'none'};
 });
 assert.equal(missingTranslations(result.profile,'de'),0);
 const changes=profileChanges(profile,result.profile,'de');
 assert.equal(changes.length,4);
 assert(changes.every(change=>change.section==='internships'));
 const accepted=applyProfileChanges(profile,result.profile,['internships:intern-test:description'],'de');
 assert.equal(accepted.internships[0].description.de,translations['internships:intern-test:description']);
 assert.equal(accepted.internships[0].title.de,'');
 assert.deepEqual(accepted.internships[0].organization,profile.internships[0].organization);
 assert.equal(profileChanges(profile,accepted,'en').length,0);
 const matched=matchJob(profile,'Python experience required');
 assert(matched.details.matched.find(item=>item.term==='Python').evidence.some(e=>e.section==='internships'));
 profile.internships[0].included=false;
 assert.equal(missingTranslations(profile,'de'),0);
 assert(matchJob(profile,'Python experience required').missing.includes('Python'));
});

test('PDF renders bilingual internship sections in the chosen section order with newest included entries first',async()=>{
 const profile=blankProfile();profile.personal.name='Test Candidate';
 profile.experience=[{...newEntry(),title:{en:'Main role',de:'Haupttätigkeit'}}];
 profile.internships=[
  {...internship('old'),title:{en:'Earlier internship',de:'Früheres Praktikum'},end:'2024-09'},
  {...internship('current'),title:{en:'Current internship',de:'Aktuelles Praktikum'},current:true},
  {...internship('excluded'),title:{en:'Excluded internship',de:'Ausgeschlossenes Praktikum'},included:false}
 ];
 profile.settings.sectionOrder=['internships',...defaultSectionOrder.filter(section=>section!=='internships')];
 const originalText=PDFDocument.prototype.text;let rendered=[];
 PDFDocument.prototype.text=function(value,...args){rendered.push(String(value));return originalText.call(this,value,...args);};
 try{
  for(const language of ['en','de']){
   profile.settings.language=language;rendered=[];
   const pdf=await createPdf(profile);
   assert.equal(pdf.subarray(0,4).toString(),'%PDF');
   const heading=cvLabels[language].internships.toLocaleUpperCase(language);
   const start=rendered.indexOf(heading);
   const experience=rendered.indexOf(cvLabels[language].experience.toLocaleUpperCase(language));
   assert(start>=0&&start<experience,'Arrange must control internship placement');
   const current=rendered.indexOf(profile.internships[1].title[language]);
   const old=rendered.indexOf(profile.internships[0].title[language]);
   assert(start<current&&current<old&&old<experience,'Internships must be newest first');
   assert(!rendered.includes(profile.internships[2].title[language]));
   assert(rendered.includes([profile.internships[0].organization[language],profile.internships[0].location[language]].join(' · ')));
   assert(rendered.includes(profile.internships[0].description[language]));
   assert(!rendered.join('\n').includes('[object Object]'));
  }
  profile.internships.forEach(entry=>{entry.included=false;});rendered=[];
  await createPdf(profile);
  assert(!rendered.includes('PRAKTIKA'),'No empty heading when all internships are excluded');
  profile.internships=[];rendered=[];
  await createPdf(profile);
  assert(!rendered.includes('PRAKTIKA'),'No empty heading when no internship exists');
 }finally{PDFDocument.prototype.text=originalText;}
});
