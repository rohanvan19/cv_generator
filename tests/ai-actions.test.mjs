import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {blankWorkspace,demoProfile,newApplication,newEntry,newCustomSection,addCustomSection,bi,workspaceSchema} from '../lib/model.ts';
import {handleApi} from '../server/api.mjs';

test('applications need only company and role and preserve legacy backup text without using it',()=>{
 const profile=demoProfile();const draft=newApplication(profile,'Example','Engineer');
 assert.deepEqual(draft.draft,profile);assert.equal(Object.hasOwn(draft,'jobDescription'),false);
 const legacy={...draft,jobDescription:'Existing historical job description'};
 const parsed=workspaceSchema.parse({...blankWorkspace(),applications:[legacy,draft]});
 assert.equal(parsed.applications[0].jobDescription,legacy.jobDescription);
 assert.equal(parsed.applications[1].jobDescription,undefined);
 assert.deepEqual(parsed.applications[0].draft,profile);
});

for(const provider of ['openai','ollama','auto'])test(`${provider} cover letters use company, role and included CV evidence without changing the profile`,async t=>{
 const server=http.createServer(async(req,res)=>{if(!await handleApi(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const realFetch=globalThis.fetch;const envKeys=['OPENAI_API_KEY','OLLAMA_BASE_URL','OLLAMA_MODEL'];
 const oldEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
 process.env.OPENAI_API_KEY='test-only-key';process.env.OLLAMA_BASE_URL='http://127.0.0.1:11434';process.env.OLLAMA_MODEL='test-model';
 t.after(()=>{globalThis.fetch=realFetch;for(const key of envKeys){if(oldEnv[key]===undefined)delete process.env[key];else process.env[key]=oldEnv[key];}});
 const custom=newCustomSection(bi('Volunteering','Ehrenamt'));custom.entries=[{...newEntry(),title:bi('Mentor','Betreuer')}];
 const profile=addCustomSection(demoProfile(),custom);
 profile.experience.push({...newEntry(),included:false,title:bi('Excluded role')});
 profile.settings.showSummary=false;profile.settings.showInterests=false;
 const original=structuredClone(profile);let generated=0;let invalid=false;
 const coverLetter=bi('I am applying for the Engineer role at Example.','Ich bewerbe mich als Ingenieur bei Example.');
 globalThis.fetch=async(input,options)=>{
  const url=String(input);
  if(url==='http://127.0.0.1:11434/api/tags')return Response.json({models:[{name:'test-model'}]});
  if(url==='https://api.openai.com/v1/responses'||url==='http://127.0.0.1:11434/api/chat'){
   generated++;const request=JSON.parse(options.body);const openai=url.startsWith('https:');
   assert.equal(openai,provider==='openai');
   const payload=JSON.parse(openai?request.input:request.messages[1].content.split('\nReturn only')[0]);
   assert.equal(payload.action,'cover-letter');assert.equal(payload.company,'Example');assert.equal(payload.role,'Engineer');
   assert.equal(payload.jobDescription,undefined);assert.equal(payload.profile.personal,undefined);assert.equal(payload.profile.photo,undefined);
   assert.equal(JSON.stringify(payload).includes('alex@example.com'),false);
   assert.equal(payload.profile.experience.length,1);assert.equal(payload.profile.customSections[0].entries[0].title.en,'Mentor');
   assert.deepEqual(payload.profile.summary,bi());assert.deepEqual(payload.profile.interests,bi());
   const schema=openai?request.text.format.schema:request.format;assert.deepEqual(schema.required,['coverLetter']);
   const output=JSON.stringify({coverLetter:invalid?bi():coverLetter,profile:{headline:bi('Unwanted mutation')},changes:[{key:'headline',value:bi('Unwanted mutation')}]});
   return openai?Response.json({status:'completed',output:[{content:[{type:'output_text',text:output}]}]}):Response.json({done:true,message:{content:output}});
  }
  return realFetch(input,options);
 };
 const call=action=>realFetch(base+'/api/assist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,provider,model:'test-model',company:'Example',role:'Engineer',profile,jobDescription:'Legacy text must not be sent'})});
 const removed=await call('tailor');assert.equal(removed.status,400);assert.equal(generated,0);
 const response=await call('cover-letter');assert.equal(response.status,200);
 const result=await response.json();assert.deepEqual(result.profile,original);assert.deepEqual(result.coverLetter,coverLetter);
 assert.equal(result.provider,provider==='openai'?'openai':'ollama');assert.equal(result.recommendations,undefined);assert.equal(result.reasoning,undefined);
 invalid=true;const rejected=await call('cover-letter');assert.equal(rejected.status,400);
 assert.deepEqual(profile,original);
});
