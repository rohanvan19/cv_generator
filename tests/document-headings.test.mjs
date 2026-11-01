import test from 'node:test';
import assert from 'node:assert/strict';
import PDFDocument from 'pdfkit';
import {blankWorkspace,demoProfile,newApplication,workspaceSchema} from '../lib/model.ts';
import {blankCoverLetterTemplate,coverLetterTemplateSchema} from '../lib/cover-letter.ts';
import {createPdf} from '../server/pdf.mjs';
import {createCoverLetterPdf} from '../server/cover-letter-pdf.mjs';

test('editable document headings migrate, persist and copy independently',()=>{
 const legacy=blankWorkspace();delete legacy.profile.settings.documentTitle;delete legacy.coverLetterTemplate.documentTitle;
 const state=workspaceSchema.parse(legacy);
 assert.deepEqual(state.profile.settings.documentTitle,{en:'CURRICULUM VITAE',de:'LEBENSLAUF'});
 assert.equal(state.coverLetterTemplate.documentTitle,'COVER LETTER');
 state.profile.settings.documentTitle={en:'Professional background',de:'Beruflicher Werdegang'};
 state.coverLetterTemplate.documentTitle='Application letter';state.applications=[newApplication(state.profile,'Example','Engineer')];
 assert.deepEqual(workspaceSchema.parse(JSON.parse(JSON.stringify(state))),state);
 state.applications[0].draft.settings.documentTitle.en='Application CV';assert.equal(state.profile.settings.documentTitle.en,'Professional background');
 assert.equal(coverLetterTemplateSchema.safeParse({...blankCoverLetterTemplate(),documentTitle:'x'.repeat(121)}).success,false);
});

test('PDFs render the selected heading exactly and omit it when blank',async()=>{
 const rendered=[],original=PDFDocument.prototype.text;
 PDFDocument.prototype.text=function(value,...rest){rendered.push(String(value));return original.call(this,value,...rest);};
 try{
  const profile=demoProfile();profile.settings.documentTitle={en:'Professional background',de:'Beruflicher Werdegang'};
  await createPdf(profile);assert.equal(rendered[0],'Beruflicher Werdegang');
  rendered.length=0;profile.settings.language='en';await createPdf(profile);assert.equal(rendered[0],'Professional background');
  rendered.length=0;profile.settings.documentTitle.en='';await createPdf(profile);assert.equal(rendered[0],profile.personal.name);
  const letter=blankCoverLetterTemplate();letter.documentTitle='Application letter';letter.sender.name='Example Person';
  rendered.length=0;await createCoverLetterPdf(letter);assert.equal(rendered[0],'Application letter');
  rendered.length=0;letter.documentTitle='';await createCoverLetterPdf(letter);assert.equal(rendered[0],letter.sender.name);
 }finally{PDFDocument.prototype.text=original;}
});
