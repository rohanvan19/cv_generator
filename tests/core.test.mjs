import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {blankWorkspace,blankProfile,demoProfile,newApplication,newEntry,matchJob,hasTerm,tailorLocally,ordered,missingTranslations,workspaceSchema,defaultSectionOrder,profileChanges,applyProfileChanges,formatBirthDate,employmentTypeLabel,profileTextFields} from '../lib/model.ts';

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

test('accepted AI suggestions apply individually without changing declined fields',()=>{
 const before=demoProfile();
 before.projects=[{...newEntry(),id:'project-one',title:{en:'Automation project',de:'Automatisierungsprojekt'},description:{en:'Built a Python utility.',de:'Ein Python-Werkzeug entwickelt.'}}];
 const after=structuredClone(before);
 after.experience[0].description={en:'Tailored experience wording.',de:'Angepasste Berufserfahrung.'};
 after.projects[0].description={en:'Tailored project wording.',de:'Angepasste Projektbeschreibung.'};
 after.skills[0].name={en:'SQL, Python',de:'SQL, Python'};
 const changes=profileChanges(before,after,'en');
 assert.deepEqual(new Set(changes.map(change=>change.section)),new Set(['experience','projects','skills']));
 const skillChange=changes.find(change=>change.section==='skills');
 const applied=applyProfileChanges(before,after,[skillChange.key]);
 assert.deepEqual(applied.skills[0].name,after.skills[0].name);
 assert.deepEqual(applied.experience[0].description,before.experience[0].description);
 assert.deepEqual(applied.projects[0].description,before.projects[0].description);
 assert.deepEqual(applied.summary,before.summary);
});
test('requirement matcher separates direct, related and missing evidence with sources',()=>{
 assert.equal(hasTerm('Use C++ and C# daily','C++'),true);
 assert.equal(hasTerm('JavaScript developer','Java'),false);
 assert.equal(hasTerm('digital products','Git'),false);
 const p=demoProfile();
 const result=matchJob(p,'Python, SQL, Kubernetes and Deutsch B2 required.');
 assert(result.matched.includes('Python'));
 assert(result.matched.includes('German'));
 assert(result.missing.includes('Kubernetes'));
 assert(result.details.matched.find(item=>item.term==='German').evidence.some(source=>source.section==='languages'));
 const related=matchJob(p,'English and strong communication skills required.');
 assert(related.matched.includes('English'));
 assert(related.related.includes('Communication'));
 assert.equal(related.missing.includes('Communication'),false);
 assert(related.details.matched.find(item=>item.term==='English').evidence.some(source=>source.section==='languages'));
 assert(related.details.related.find(item=>item.term==='Communication').evidence.some(source=>source.section==='experience'));
 const gap=matchJob(p,'Leadership required.');
 assert(gap.missing.includes('Leadership'));
});
test('local tailoring only reorders existing evidence',()=>{
 const p=demoProfile();
 const before=structuredClone(p);
 const draft=tailorLocally(p,'Docker');
 assert.equal(draft.skills[0].category.en,'Tools');
 assert.deepEqual(p,before);
 assert.deepEqual(draft.skills.map(x=>x.id).sort(),p.skills.map(x=>x.id).sort());
 assert.deepEqual(draft.experience,p.experience);
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
test('legacy skills migrate to category and grouped items remain searchable',()=>{
 const old=blankWorkspace();
 old.profile.skills=[{id:'old-skill',name:{en:'FastAPI, NumPy',de:'FastAPI, NumPy'},included:true}];
 const migrated=workspaceSchema.parse(old);
 assert.deepEqual(migrated.profile.skills[0].category,{en:'',de:''});
 const result=matchJob(migrated.profile,'Experience with NumPy and FastAPI is required.');
 assert(result.matched.includes('NumPy'));
 assert(result.matched.includes('FastAPI'));
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
 let invalidIds=false;
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
   assert.equal(payload.profile.personal,undefined);
   assert.equal(payload.profile.photo,undefined);
   const p=payload.profile;
   const edits={
    headline:p.headline,
    summary:{...p.summary,de:'Geprüfte Übersetzung.'},
    interests:p.interests,
    entries:['experience','internships','education','projects','certifications'].flatMap(k=>p[k].map(e=>({id:invalidIds?'invented-id':e.id,title:e.title,description:e.description}))),
    skills:p.skills.map(e=>({id:e.id,category:e.category,name:e.name})),
    languages:p.languages.map(e=>({id:e.id,name:e.name})),
    coverLetter:{en:'',de:''},
    recommendations:[],
    reasoning:[]
   };
   return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(edits)}]}]});
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
  invalidIds=true;
  const invalidAssist=await fetch(base+'/api/assist',{method:'POST',body:JSON.stringify({profile:state.profile,jobDescription:'Python developer',action:'tailor',provider:'openai'})});
  assert.equal(invalidAssist.status,500);
  assert.equal(externalCalls,translationCalls+1);
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

test('Ollama provider reads the CV and applies only validated field patches',async(t)=>{
 const {handleApi}=await import('../server/api.mjs');
 const server=http.createServer(async(req,res)=>{if(!await handleApi(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(async()=>{await new Promise(resolve=>server.close(resolve));});
 const base='http://127.0.0.1:'+server.address().port;
 const realFetch=globalThis.fetch;
 const previousModel=process.env.OLLAMA_MODEL;
 const previousBase=process.env.OLLAMA_BASE_URL;
 const previousOpenAIKey=process.env.OPENAI_API_KEY;
 process.env.OPENAI_API_KEY='configured-but-local-should-win';
 process.env.OLLAMA_MODEL='cv-test-model';
 process.env.OLLAMA_BASE_URL='http://127.0.0.1:11434';
 let tagCalls=0,chatCalls=0;
 globalThis.fetch=async(input,options)=>{
  const url=String(input);
  if(url==='http://127.0.0.1:11434/api/tags'){tagCalls++;return Response.json({models:[{name:'cv-test-model',model:'cv-test-model',reviewLanguage:'en'}]});}
  if(url==='http://127.0.0.1:11434/api/chat'){
   chatCalls++;
   const request=JSON.parse(options.body);
   assert.equal(request.model,'cv-test-model');
   assert.equal(request.stream,false);
   assert.equal(request.options.temperature,0);
   assert.equal(request.format.type,'object');
   const rawPrompt=request.messages[1].content;
   assert.equal(rawPrompt.includes('alex@example.com'),false);
   assert.equal(rawPrompt.includes('data:image'),false);
   const payload=JSON.parse(rawPrompt.split('\nReturn only the requested changes object.')[0]);
   assert.equal(payload.action,'tailor');
   assert.equal(payload.reviewLanguage,'en');
   assert.equal(payload.profile.personal,undefined);
   const profile=payload.profile;
    const descriptionKey=profile.experience[0].descriptionKey;
    const projectDescriptionKey=profile.projects[0].descriptionKey;
    const skillNameKey=profile.skills[0].nameKey;
    const allowedKeys=request.format.properties.changes.items.properties.key.enum;
    assert(allowedKeys.includes(descriptionKey));
    assert(allowedKeys.includes(projectDescriptionKey));
    assert(allowedKeys.includes(skillNameKey));
    assert.equal(allowedKeys.some(key=>key==='headline'||key==='summary'||key.startsWith('education.')||key.startsWith('certifications.')||key.startsWith('languages.')),false);   assert.equal(request.format.required.includes('experienceChanges'),true);
   assert.equal(request.format.properties.experienceChanges.minItems,1);
   assert(request.format.properties.experienceChanges.items.properties.key.enum.includes(descriptionKey));
   assert.equal(request.format.required.includes('reasoning'),true);
   assert.equal(request.format.properties.reasoning.minItems,1);
   assert.equal(rawPrompt.includes('Example Engineering GmbH'),true);
   const edits={
    experienceChanges:[
     {key:descriptionKey,value:{en:'Developed Python automation tools aligned with software delivery requirements.\nCollaborated across functions on software delivery.\nBuilt automated data analysis workflows.\nSupported reliable engineering handoffs.\nThis fifth generated point must be removed.',de:'Python-Automatisierungswerkzeuge für die Softwarebereitstellung entwickelt.\nFunktionsübergreifend an der Softwarebereitstellung zusammengearbeitet.\nAutomatisierte Datenanalyse-Workflows aufgebaut.\nZuverlässige technische Übergaben unterstützt.\nDieser fünfte generierte Punkt muss entfernt werden.'}},
     {key:'invented-field-key',value:{en:'Ignored',de:'Ignoriert'}}
    ],
     changes:[
      {key:projectDescriptionKey,value:{en:'Built a Python computer-vision utility aligned with the role.\nApplied existing automation experience to practical delivery.',de:'Ein Python-Bildverarbeitungswerkzeug passend zur Stelle entwickelt.\nVorhandene Automatisierungserfahrung praktisch eingesetzt.'}},
      {key:skillNameKey,value:{en:'SQL, Python',de:'SQL, Python'}}
     ],
    coverLetter:{en:'',de:''},
    recommendations:[],
    reasoning:['Existing Python automation evidence aligns with the JD requirement for reliable software delivery.']
   };
   return Response.json({done:true,message:{role:'assistant',content:JSON.stringify(edits)}});
  }
  return realFetch(input,options);
 };
 try{
  const status=await realFetch(base+'/api/ai/status');
  assert.equal(status.status,200);
  const providers=await status.json();
  assert.equal(providers.ollama.reachable,true);
  assert(providers.ollama.models.includes('cv-test-model'));
   const profile=demoProfile();
   profile.projects=[{...newEntry(),id:'project-one',title:{en:'Python vision utility',de:'Python-Bildverarbeitungswerkzeug'},description:{en:'Built a Python computer-vision utility for automated analysis.',de:'Ein Python-Bildverarbeitungswerkzeug für automatisierte Analysen entwickelt.'}}];
  const response=await realFetch(base+'/api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile,jobDescription:'Python and Kubernetes experience required.',action:'tailor',provider:'auto',model:'cv-test-model'})});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.provider,'ollama');
  assert.equal(result.model,'cv-test-model');
  assert.equal(result.profile.personal.email,profile.personal.email);
  assert.equal(result.changedFields,3);
  assert.match(result.profile.experience[0].description.en,/Python automation tools/);
  assert.equal(result.profile.experience[0].description.en.split('\n').length,4);
  assert.equal(result.profile.experience[0].description.de.split('\n').length,4);
  assert.equal(result.profile.experience[0].description.en.includes('fifth generated point'),false);
   assert.match(result.profile.projects[0].description.en,/Python computer-vision utility/);
   assert.equal(result.profile.skills[0].name.en,'SQL, Python');
   assert.deepEqual(result.profile.summary,profile.summary);
   assert.deepEqual(result.profile.education,profile.education);
  assert.equal(result.reasoning.length,1);
  assert.match(result.reasoning[0],/existing Python automation evidence/i);
  assert.equal(result.profile.experience.length,profile.experience.length);
  assert.deepEqual(result.profile.experience[0].organization,profile.experience[0].organization);
  assert.equal(result.recommendations.length,1);
  assert.match(result.recommendations[0],/Kubernetes/);
  assert.equal(chatCalls,1);
  assert(tagCalls>=2);
 }finally{
  globalThis.fetch=realFetch;
  if(previousModel===undefined)delete process.env.OLLAMA_MODEL;else process.env.OLLAMA_MODEL=previousModel;
  if(previousBase===undefined)delete process.env.OLLAMA_BASE_URL;else process.env.OLLAMA_BASE_URL=previousBase;
  if(previousOpenAIKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousOpenAIKey;
 }
});

test('legacy workspaces receive automatic AI settings',()=>{
 const legacy=blankWorkspace();
 delete legacy.aiSettings;
 const migrated=workspaceSchema.parse(legacy);
 assert.deepEqual(migrated.aiSettings,{provider:'auto',ollamaModel:''});
});
