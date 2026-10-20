import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import {blankWorkspace,blankProfile,newEntry,workspaceSchema,profileSchema,profileTextFields,profileChanges,applyProfileChanges,missingTranslations,text} from '../lib/model.ts';
import {translateProfile} from '../server/translation.mjs';
import {createPdf} from '../server/pdf.mjs';

// These checks use fixed translation data and never contact a model or translation service.
function fixture(){
 const p=blankProfile();
 p.personal.name='Test Candidate';
 p.personal.location={en:'Munich, Germany',de:''};
 p.education=[{...newEntry(),id:'school-test',organization:{en:'Technical University of Munich',de:''},location:{en:'Munich, Germany',de:''}}];
 return p;
}
const german={
 'personal:location':'München, Deutschland',
 'education:school-test:organization':'Technische Universität München',
 'education:school-test:location':'München, Deutschland'
};

test('legacy school and location strings migrate without changing the original workspace',()=>{
 const legacy=blankWorkspace();
 legacy.profile.personal.location='Munich, Germany';
 for(const section of ['experience','education','projects','certifications'])legacy.profile[section]=[{...newEntry(),organization:'Example University',location:'Munich, Germany'}];
 legacy.applications=[{id:'draft-test',company:'Example',role:'Engineer',jobDescription:'',status:'Draft',createdAt:'2026-09-13',draft:structuredClone(legacy.profile),coverLetter:{en:'',de:''}}];
 const original=structuredClone(legacy);
 const migrated=workspaceSchema.parse(legacy);
 assert.deepEqual(legacy,original);
 for(const p of [migrated.profile,migrated.applications[0].draft]){
  assert.deepEqual(p.personal.location,{en:'Munich, Germany',de:''});
  for(const section of ['experience','education','projects','certifications']){
   assert.deepEqual(p[section][0].organization,{en:'Example University',de:''});
   assert.deepEqual(p[section][0].location,{en:'Munich, Germany',de:''});
   assert.equal(text(p[section][0].organization,'de'),'Example University');
  }
 }
 assert.deepEqual(workspaceSchema.parse(migrated),migrated,'Bilingual values survive future saves and imports');
 const invalid=fixture();invalid.personal.location.de='x'.repeat(301);
 assert.equal(profileSchema.safeParse(invalid).success,false);
});

test('school and city/country are requested, reviewed and independently accepted as German translations',async()=>{
 const before=fixture();
 assert.equal(missingTranslations(before,'de'),3);
 let calls=0;
 const result=await translateProfile(before,'de',async(schema,payload)=>{
  calls++;
  assert.deepEqual(new Set(payload.fields.map(field=>field.key)),new Set(Object.keys(german)));
  assert.equal(schema.properties.translations.properties['personal:location'].maxLength,300);
  assert.equal(schema.properties.translations.properties['education:school-test:organization'].maxLength,400);
  assert(!JSON.stringify(payload).includes('Test Candidate'),'Name remains outside the translation request');
  return {output:JSON.stringify({translations:german}),provider:'offline-fixture',model:'none'};
 });
 assert.equal(calls,1);
 assert.equal(missingTranslations(result.profile,'de'),0);
 const changes=profileChanges(before,result.profile,'de');
 assert.equal(changes.length,3);
 assert(changes.some(change=>change.label.includes('University / school')||change.label.includes('Hochschule / Schule')));
 assert.equal(profileChanges(before,result.profile,'en').length,0);
 const accepted=applyProfileChanges(before,result.profile,['education:school-test:organization'],'de');
 assert.equal(accepted.education[0].organization.de,german['education:school-test:organization']);
 assert.deepEqual(accepted.personal.location,before.personal.location);
 assert.deepEqual(accepted.education[0].location,before.education[0].location);
 assert.equal(accepted.education[0].organization.en,before.education[0].organization.en);
 assert.equal(missingTranslations(accepted,'de'),2);
});

test('PDF output uses the selected language for schools and both personal and entry locations',async()=>{
 const p=fixture();
 for(const field of profileTextFields(p))if(german[field.key])field.value.de=german[field.key];
 const original=PDFDocument.prototype.text;let rendered=[];
 PDFDocument.prototype.text=function(value,...args){rendered.push(String(value));return original.call(this,value,...args);};
 try{
  for(const language of ['de','en']){
   rendered=[];p.settings.language=language;
   const pdf=await createPdf(p);
   assert.equal(pdf.subarray(0,4).toString(),'%PDF');
   const output=rendered.join('\n');
   const school=p.education[0].organization[language];const location=p.personal.location[language];
   assert(output.includes(school),output);
   assert(rendered.some(value=>value===location),'Personal city/country must use the selected language');
   assert(rendered.some(value=>value.includes(school)&&value.includes(location)),'Education must use translated school and location together');
   assert(!output.includes('[object Object]'));
   assert(!output.includes(p.education[0].organization[language==='de'?'en':'de']));
  }
 }finally{PDFDocument.prototype.text=original;}
});
