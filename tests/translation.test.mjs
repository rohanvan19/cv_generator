import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {blankProfile,demoProfile,newEntry,profileTextFields,profileChanges,applyProfileChanges,missingTranslations} from '../lib/model.ts';
import {translateProfile} from '../server/translation.mjs';

function fixture(){
 const p=demoProfile();
 p.projects=[{...newEntry(),title:{en:'Data tools',de:''},description:{en:'Built tools that check files for errors.',de:''}}];
 p.certifications=[{...newEntry(),title:{en:'Data analysis',de:''},description:{en:'Completed training in practical data analysis methods.',de:''}}];
 p.personal.customFields=[{id:'availability',label:{en:'Availability',de:''},value:{en:'Available from October',de:''},included:true}];
 return p;
}
const translated=field=>'Übersetzt: '+field.sourceText;
const response=(fields,translate=translated)=>({output:JSON.stringify({translations:Object.fromEntries(fields.map(field=>[field.key,translate(field)]))}),provider:'ollama',model:'test'});

test('complete translation covers every bilingual field, preserves source and structural details, and reviews German-only changes',async()=>{
 const before=fixture();
 for(const field of profileTextFields(before))field.value.de='';
 before.experience[0].description.en=Array.from({length:5},(_,i)=>'Completed existing project task '+(i+1)+'.').join('\n');
 const snapshot=structuredClone(before);const requested=[];
 const result=await translateProfile(before,'de',async(schema,payload,instructions)=>{
  assert.equal(payload.targetLanguage,'de');
  assert.equal(payload.targetLanguageName,'German');
  for(const field of payload.fields)assert.deepEqual(Object.keys(field),['key','sourceText']);
  assert.equal(payload.sourceLanguage,'en');
  assert.equal(payload.profile,undefined);
  assert.equal(payload.jobDescription,undefined);
  assert(payload.fields.length<=6);
  assert.deepEqual(schema.properties.translations.required,payload.fields.map(field=>field.key));
  assert.equal(schema.properties.translations.additionalProperties,false);
  assert.match(instructions,/NO four-point limit/);
  requested.push(...payload.fields.map(field=>field.key));
  return response(payload.fields,field=>field.sourceText.split('\n').map(line=>'Übersetzt: '+line).join('\n'));
 });
 assert.deepEqual(before,snapshot,'Generation must not modify the saved/source CV');
 assert.deepEqual(new Set(requested),new Set(profileTextFields(before).filter(field=>field.value.en).map(field=>field.key)));
 assert.equal(requested.length,new Set(requested).size);
 assert.equal(result.translation.fieldCount,requested.length);
 assert.equal(missingTranslations(result.profile,'de'),0);
 assert.equal(result.profile.experience[0].description.de.split('\n').length,5);
 assert.deepEqual(result.profile.personal,{...before.personal,location:result.profile.personal.location,customFields:result.profile.personal.customFields});
 assert.deepEqual(result.profile.settings,before.settings);
 assert.deepEqual(result.profile.photo,before.photo);
 assert.equal(result.profile.experience[0].organization.en,before.experience[0].organization.en);
 assert.equal(result.profile.languages[0].level,before.languages[0].level);
 for(const field of profileTextFields(result.profile))assert.equal(field.value.en,profileTextFields(before).find(f=>f.key===field.key).value.en);
 assert.equal(profileChanges(before,result.profile,'en').length,0);
 assert.equal(profileChanges(before,result.profile,'de').length,requested.length,'Review the requested language, even if the editor is English');
 const selected=profileChanges(before,result.profile,'de').find(field=>field.key==='personal:availability:value');
 assert.equal(selected.source,'Available from October');
 const accepted=applyProfileChanges(before,result.profile,[selected.key],'de');
 const expected=structuredClone(before);
 expected.personal.customFields[0].value.de=selected.after;
 assert.deepEqual(accepted,expected,'Accepting one translation must change only that target-language field');
});

test('missing, blank and copied prose translations are retried without losing completed fields',async()=>{
 const p=blankProfile();
 p.headline={en:'Software Engineer',de:''};
 p.summary={en:'Developed practical tools for data analysis and automation.',de:''};
 p.interests={en:'Hiking',de:''};
 let calls=0;
 const result=await translateProfile(p,'de',async(schema,payload)=>{
  calls++;
  if(calls===1)return {output:JSON.stringify({translations:{headline:'Softwareentwickler',summary:p.summary.en,interests:''}}),provider:'ollama',model:'test'};
  assert.deepEqual(payload.fields.map(field=>field.key),['summary','interests']);
  assert(payload.retry);
  return response(payload.fields);
 });
 assert.equal(calls,2);
 assert.equal(result.translation.retriedFields,2);
 assert.equal(result.profile.headline.de,'Softwareentwickler');
 assert.equal(missingTranslations(result.profile,'de'),0);
});

test('permanently incomplete translation fails atomically with the missing field named',async()=>{
 const p=blankProfile();p.headline={en:'Engineer',de:''};p.summary={en:'Current profile text',de:''};
 const original=structuredClone(p);let calls=0;
 await assert.rejects(translateProfile(p,'de',async()=>{calls++;return {output:JSON.stringify({translations:{headline:'Ingenieur'}})};}),/Translation incomplete for: Summary.*No changes were applied/);
 assert.equal(calls,2);
 assert.deepEqual(p,original);
});

test('invalid JSON and truncated bullet lists trigger a bounded retry',async()=>{
 const p=blankProfile();p.summary={en:'First point.\nSecond point.\nThird point.\nFourth point.\nFifth point.',de:''};
 for(const output of ['invalid JSON',JSON.stringify({translations:{summary:'Erster Punkt.\nZweiter Punkt.\nDritter Punkt.\nVierter Punkt.'}})]){
  let calls=0;
  const result=await translateProfile(p,'de',async(_schema,payload)=>++calls===1?{output}:response(payload.fields));
  assert.equal(calls,2);
  assert.equal(result.profile.summary.de.split('\n').length,5);
 }
});

test('English direction and target-only fields are preserved, while identical technical terms are valid',async()=>{
 const p=blankProfile();
 p.headline={en:'English-only source',de:''};
 p.skills=[{id:'skill-one',category:{en:'Programming',de:'Programmierung'},name:{en:'Python, SQL',de:'Python, SQL'},included:false}];
 const result=await translateProfile(p,'en',async(_schema,payload)=>{
  assert.equal(payload.sourceLanguage,'de');
  assert.equal(payload.targetLanguage,'en');
  assert.equal(payload.fields.length,2);
  return response(payload.fields,field=>field.key.endsWith(':category')?'Programming languages':field.sourceText);
 });
 assert.equal(result.profile.skills[0].name.en,'Python, SQL');
 assert.equal(result.profile.skills[0].category.en,'Programming languages');
 assert.equal(result.profile.skills[0].category.de,'Programmierung');
 assert.deepEqual(result.profile.headline,p.headline);
 assert.equal(result.profile.skills[0].included,false);
});

test('translation API uses the selected local model and its own complete schema',async t=>{
 const {handleApi}=await import('../server/api.mjs');
 const server=http.createServer(async(req,res)=>{if(!await handleApi(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const realFetch=globalThis.fetch;const oldBase=process.env.OLLAMA_BASE_URL;
 process.env.OLLAMA_BASE_URL='http://127.0.0.1:11434';
 let chats=0;
 globalThis.fetch=async(input,options)=>{
  const url=String(input);
  if(url.endsWith('/api/tags'))return Response.json({models:[{name:'translation-test'}]});
  if(url.endsWith('/api/chat')){
   chats++;const body=JSON.parse(options.body);
   assert.equal(body.model,'translation-test');
   assert.match(body.messages[0].content,/Translate EVERY/);
   assert.doesNotMatch(body.messages[0].content,/maximum of four/);
   const payload=JSON.parse(body.messages[1].content.split('\nReturn every')[0]);
   assert.equal(payload.targetLanguage,'de');
   assert.equal(payload.jobDescription,undefined);
   assert.deepEqual(body.format.properties.translations.required,payload.fields.map(f=>f.key));
   return Response.json({done:true,message:{content:response(payload.fields).output}});
  }
  assert(!url.startsWith('https://'),'Explicit local mode must not contact a cloud provider');
  return realFetch(input,options);
 };
 t.after(()=>{globalThis.fetch=realFetch;if(oldBase===undefined)delete process.env.OLLAMA_BASE_URL;else process.env.OLLAMA_BASE_URL=oldBase;});
 const p=fixture();
 const result=await fetch('http://127.0.0.1:'+server.address().port+'/api/assist',{method:'POST',body:JSON.stringify({profile:p,jobDescription:'Ignored during translation',action:'translate',provider:'ollama',model:'translation-test',targetLanguage:'de'})});
 const body=await result.json();
 assert.equal(result.status,200,JSON.stringify(body));
 assert.equal(body.provider,'ollama');assert.equal(body.model,'translation-test');
 assert.equal(body.translation.targetLanguage,'de');
 assert.equal(missingTranslations(body.profile,'de'),0);
 assert(chats>1);
});

test('untranslated role titles, degree subjects and custom values are not silently accepted',async()=>{
 const p=blankProfile();
 p.headline={en:'Software Engineer',de:''};
 p.personal.customFields=[{id:'availability',label:{en:'Availability',de:''},value:{en:'Available from October',de:''},included:true}];
 p.education=[{...newEntry(),title:{en:'M.Sc. Computer Science',de:''}}];
 let calls=0;
 const result=await translateProfile(p,'de',async(_schema,payload)=>{
  calls++;
  return response(payload.fields,field=>calls===1?field.sourceText:'Übersetzt: '+field.sourceText);
 });
 assert.equal(calls,2);
 assert.equal(result.translation.retriedFields,4);
});
