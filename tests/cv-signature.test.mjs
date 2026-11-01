import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import {blankWorkspace,demoProfile,newApplication,duplicateApplication,workspaceSchema} from '../lib/model.ts';
import {createPdf} from '../server/pdf.mjs';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=';

test('CV signatures migrate safely and remain independent in application copies and backups',()=>{
 const state=blankWorkspace();delete state.profile.signature;
 assert.deepEqual(workspaceSchema.parse(state).profile.signature,{enabled:false,size:100,image:''});
 state.profile=demoProfile();state.profile.signature={enabled:true,size:150,image};
 const application=newApplication(state.profile,'Company A','Engineer');
 const copy=duplicateApplication(application,'Company B','Engineer');state.applications=[application,copy];
 assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(state))),state);
 copy.draft.signature.size=75;copy.draft.signature.image='';
 assert.equal(application.draft.signature.size,150);assert.equal(state.profile.signature.image,image);
 assert.equal(state.coverLetterTemplate.signature.image,'');
});

test('CV signature omits a repeated name, scales proportionally and stays inside the final page',async()=>{
 const profile=demoProfile();profile.signature={enabled:true,size:100,image};
 const images=[],texts=[],originalImage=PDFDocument.prototype.image,originalText=PDFDocument.prototype.text;
 PDFDocument.prototype.image=function(source,x,y,options){images.push({x,y,...options,page:this.bufferedPageRange().count});return originalImage.call(this,source,x,y,options);};
 PDFDocument.prototype.text=function(value,x,y,...rest){texts.push({text:String(value),x,y,page:this.bufferedPageRange().count});return originalText.call(this,value,x,y,...rest);};
 try{
  await createPdf(profile);assert.equal(images.length,1);
  assert.equal(texts.filter(item=>item.text===profile.personal.name).length,1);
  const name=texts.findLast(item=>item.text===profile.personal.name),signature=images[0];
  assert.equal(signature.page,name.page);assert(signature.y>name.y);assert(signature.y+signature.height<=787);
  images.length=0;profile.signature.size=200;await createPdf(profile);
  assert.equal(images[0].height,signature.height*2);assert.equal(images[0].width,signature.width*2);
  images.length=0;profile.signature.enabled=false;await createPdf(profile);assert.equal(images.length,0);
  profile.signature.enabled=true;profile.summary.de='Lange Beschreibung mit vielen Einzelheiten. '.repeat(450);
  const pdf=await createPdf(profile),pages=(pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length;
  assert(pages>1);assert.equal(images[0].page,pages);assert(images[0].y+images[0].height<=787);
  profile.signature.image='data:image/png;base64,bm90YW5pbWFnZQ==';await assert.rejects(createPdf(profile),/valid PNG or JPG/);
 }finally{PDFDocument.prototype.image=originalImage;PDFDocument.prototype.text=originalText;}
});
