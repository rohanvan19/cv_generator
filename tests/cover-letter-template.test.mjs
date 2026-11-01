import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {blankCoverLetterTemplate,coverLetterTemplateSchema,germanLetterDate} from '../lib/cover-letter.ts';
import {blankWorkspace,workspaceSchema} from '../lib/model.ts';
import {createCoverLetterPdf} from '../server/cover-letter-pdf.mjs';

export function letterFixture(){return {...blankCoverLetterTemplate(),
 sender:{name:'Alex Beispiel',address:'Musterstraße 12',postalCode:'01234',city:'Dresden',country:'Deutschland',phone:'+49 351 123456',email:'alex.beispiel@example.com'},
 recipient:{company:'Beispiel Technik GmbH',attention:'Frau Maria Müller / Personalabteilung',address:'Technikstraße 8',postalCode:'10115',city:'Berlin',country:'Deutschland'},
 date:'2026-10-30',subject:'Bewerbung als Softwareentwickler – Referenznummer SW-2026',
 body:'Sehr gern möchte ich meine Erfahrung in der Softwareentwicklung in Ihr Team einbringen. Besonders interessiert mich die Möglichkeit, zuverlässige und verständliche Anwendungen zu entwickeln.\n\nIn meinen bisherigen Projekten habe ich Softwarelösungen umgesetzt und eng mit unterschiedlichen Fachbereichen zusammengearbeitet. Dabei lege ich Wert auf nachvollziehbare Abläufe und sorgfältige Dokumentation.\n\nÜber die Gelegenheit, mich und meine Motivation in einem persönlichen Gespräch vorzustellen, freue ich mich.',
};}

test('cover-letter template migrates old workspaces and preserves postal codes and saved letters',()=>{
 const legacy=blankWorkspace();delete legacy.coverLetterTemplate;const before=structuredClone(legacy);
 const migrated=workspaceSchema.parse(legacy);assert.deepEqual(migrated.coverLetterTemplate,blankCoverLetterTemplate());assert.deepEqual(legacy,before);
 migrated.coverLetterTemplate=letterFixture();const roundtrip=workspaceSchema.parse(JSON.parse(JSON.stringify(migrated)));
 assert.deepEqual(roundtrip,migrated);assert.equal(roundtrip.coverLetterTemplate.sender.postalCode,'01234');
 assert.equal(germanLetterDate('2026-10-30'),'30 October 2026');
 assert.equal(germanLetterDate('2026-01-09'),'09 January 2026');
 assert.equal(germanLetterDate(''),'');
 const oldLetter=letterFixture();delete oldLetter.signature;
 assert.deepEqual(coverLetterTemplateSchema.parse(oldLetter).signature,{enabled:false,size:100,image:''});
 assert.equal(coverLetterTemplateSchema.safeParse({...letterFixture(),date:'2026-02-30'}).success,false);
 assert.equal(coverLetterTemplateSchema.safeParse({...letterFixture(),date:'2024-02-29'}).success,true);
 assert.equal(coverLetterTemplateSchema.safeParse({...letterFixture(),body:'x'.repeat(24001)}).success,false);
});

test('German letter PDF uses a left-aligned date, justified paragraphs and compact closing',async()=>{
 const letter=letterFixture(),rendered=[];const original=PDFDocument.prototype.text;
 PDFDocument.prototype.text=function(value,x,y,...rest){const spacing=rest[0]?.wordSpacing||0;rendered.push({text:String(value),x,y,spacing,right:x+this.widthOfString(String(value))+spacing*(String(value).match(/ /g)||[]).length});return original.call(this,value,x,y,...rest);};
 try{
  const pdf=await createCoverLetterPdf(letter);assert.equal(pdf.subarray(0,4).toString(),'%PDF');
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1);
  const sender=rendered.find(item=>item.text===letter.sender.name),company=rendered.find(item=>item.text===letter.recipient.company),date=rendered.find(item=>item.text==='Dresden, 30 October 2026'),subject=rendered.find(item=>item.text.startsWith('Bewerbung als Softwareentwickler'));
  assert(sender.y<company.y&&company.y<date.y&&date.y<subject.y);assert(sender.x>company.x&&date.x===company.x);
  const header=rendered.find(item=>item.text==='COVER LETTER');
  assert(header&&header.y<sender.y&&header.x===company.x);
  const senderLines=rendered.filter(item=>item.y<company.y&&item.text!=='COVER LETTER');
  assert.deepEqual(senderLines.map(item=>item.text),[letter.sender.name,letter.sender.address,'01234 Dresden,','Deutschland',letter.sender.phone,letter.sender.email]);
  assert(senderLines.every(item=>item.x===sender.x&&item.x>300));
  assert(Math.abs(senderLines.at(-1).right-538)<0.1);
  const justified=rendered.filter(item=>item.spacing>0);
  assert(justified.length>0);
  assert(justified.every(item=>item.y>subject.y&&item.x===company.x&&Math.abs(item.right-538)<0.1));
  const closing=rendered.find(item=>item.text===letter.closing),name=rendered.findLast(item=>item.text===letter.sender.name);
  assert(Math.abs(name.y-closing.y-15.225)<0.1);
  for(const paragraph of letter.body.split('\n\n')){
   const lastWord=paragraph.split(' ').at(-1);
   assert(rendered.some(item=>item.text.endsWith(lastWord)&&item.spacing===0));
  }
  assert(rendered.some(item=>item.text==='10115 Berlin, Deutschland'));
  assert(rendered.some(item=>item.text===letter.recipient.attention));
  assert.equal(rendered.filter(item=>item.text===letter.sender.name).length,2);
  assert(!rendered.some(item=>/CURRICULUM VITAE|LEBENSLAUF|Betreff:/.test(item.text)));
  assert(rendered.every(item=>item.x>=70&&item.y>=50&&item.y<786));
 }finally{PDFDocument.prototype.text=original;}
});

test('signature image is optional, persisted and rendered below the name',async()=>{
 const letter=letterFixture();
 letter.signature={enabled:true,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII='};
 const rendered=[],images=[],originalText=PDFDocument.prototype.text,originalImage=PDFDocument.prototype.image;
 PDFDocument.prototype.text=function(value,x,y,...rest){rendered.push({text:String(value),x,y});return originalText.call(this,value,x,y,...rest);};
 PDFDocument.prototype.image=function(value,x,y,options){images.push({x,y,...options});return originalImage.call(this,value,x,y,options);};
 try{
  const state=blankWorkspace();state.coverLetterTemplate=letter;
  assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(state))).coverLetterTemplate.signature,{...letter.signature,size:100});
  await createCoverLetterPdf(letter);
  assert.equal(images.length,1);
  const name=rendered.findLast(item=>item.text===letter.sender.name);
  assert.equal(images[0].x,name.x);assert(images[0].y>name.y);assert(images[0].y+images[0].height<785);
  const initialSize={width:images[0].width,height:images[0].height};
  images.length=0;letter.signature.size=150;await createCoverLetterPdf(letter);
  assert.equal(images[0].width,initialSize.width*1.5);assert.equal(images[0].height,initialSize.height*1.5);
  assert.equal(workspaceSchema.parse(JSON.parse(JSON.stringify(state))).coverLetterTemplate.signature.size,150);
  images.length=0;letter.signature.enabled=false;await createCoverLetterPdf(letter);assert.equal(images.length,0);
  letter.signature.enabled=true;letter.signature.image='';await createCoverLetterPdf(letter);assert.equal(images.length,0);
  letter.signature.image='data:image/png;base64,bm90YW5pbWFnZQ==';
  await assert.rejects(createCoverLetterPdf(letter),/valid PNG or JPG/);
 }finally{PDFDocument.prototype.text=originalText;PDFDocument.prototype.image=originalImage;}
});

test('long letters wrap and paginate without losing the final paragraph or signature',async()=>{
 const letter=letterFixture();letter.body=Array.from({length:28},(_,index)=>`Absatz ${index+1}. `+('Ich arbeite sorgfältig und dokumentiere meine Ergebnisse. '.repeat(6))).join('\n\n')+'\n\nABSCHLUSS-NACHWEIS';
 letter.recipient.company='Internationales Beispielunternehmen für technische Entwicklung und umfassende digitale Dienstleistungen '.repeat(2);
 const original=PDFDocument.prototype.text;const rendered=[];
 PDFDocument.prototype.text=function(value,x,y,...rest){rendered.push({text:String(value),x,y});return original.call(this,value,x,y,...rest);};
 try{
  const pdf=await createCoverLetterPdf(letter);assert((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1);
  assert(rendered.some(item=>item.text==='ABSCHLUSS-NACHWEIS'));assert(rendered.some(item=>item.text===letter.closing));
  assert(rendered.every(item=>item.x>=70&&item.y<=811));
  const lastText=rendered.findLast(item=>item.text===letter.sender.name);assert(lastText.y<785);
 }finally{PDFDocument.prototype.text=original;}
});

test('template saves through workspace API and exports from the dedicated PDF endpoint',async t=>{
 process.env.CV_DATA_DIR=await fs.mkdtemp(path.join(os.tmpdir(),'cv-letter-template-'));
 const {handleApi}=await import('../server/api.mjs');
 const server=http.createServer(async(req,res)=>{if(!await handleApi(req,res)){res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port,initial=await(await fetch(base+'/api/workspace')).json();
 const state={...initial.state,coverLetterTemplate:letterFixture()};
 const save=await fetch(base+'/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision:initial.revision})});assert.equal(save.status,200);
 const loaded=await(await fetch(base+'/api/workspace')).json();assert.deepEqual(loaded.state.coverLetterTemplate,state.coverLetterTemplate);
 const pdf=await fetch(base+'/api/cover-letter/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({letter:state.coverLetterTemplate})});assert.equal(pdf.status,200);assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,4).toString(),'%PDF');
 const invalid=await fetch(base+'/api/cover-letter/pdf',{method:'POST',body:JSON.stringify({letter:{}})});assert.equal(invalid.status,400);
 const cross=await fetch(base+'/api/cover-letter/pdf',{method:'POST',headers:{Origin:'https://unrelated.example'},body:JSON.stringify({letter:state.coverLetterTemplate})});assert.equal(cross.status,403);
});
