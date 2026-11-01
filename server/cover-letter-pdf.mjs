import PDFDocument from 'pdfkit';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {coverLetterTemplateSchema,germanLetterDate} from '../lib/cover-letter.ts';
import {prepareSignature} from './signature-image.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// A4 business-letter layout inspired by DIN 5008; preview and export share this renderer.
export async function createCoverLetterPdf(input){
 const letter=coverLetterTemplateSchema.parse(input);
 const doc=new PDFDocument({size:'A4',margins:{top:57,right:57,bottom:57,left:71},bufferPages:true,info:{Title:letter.subject||'Bewerbungsanschreiben',Author:letter.sender.name,Creator:'CV Studio'}});
 const chunks=[];const done=new Promise((resolve,reject)=>{doc.on('data',chunk=>chunks.push(chunk));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 doc.registerFont('Regular',path.join(root,'public/fonts/Inter-Regular.woff'));
 doc.registerFont('Bold',path.join(root,'public/fonts/Inter-SemiBold.woff'));
 const left=71,right=538,width=right-left,bottom=785;let y=57;
 const clean=value=>String(value||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
 const font=(size=10.5,bold=false)=>doc.font(bold?'Bold':'Regular').fontSize(size).fillColor('#202832');
 function wrapped(value,available,size,bold=false){
  font(size,bold);const result=[];
  for(const paragraph of clean(value).split(/\r?\n/)){
   if(!paragraph.trim()){result.push('');continue;}
   let line='';
   for(const word of paragraph.trim().split(/\s+/)){
    if(line&&doc.widthOfString(line+' '+word)>available){result.push(line);line='';}
    for(const char of (line?' ':'')+word){if(doc.widthOfString(line+char)>available&&line){result.push(line);line='';}line+=char;}
   }
   if(line)result.push(line);
  }
  return result;
 }
 function newPage(){doc.addPage();y=57;font(8);doc.fillColor('#68717c').text(letter.sender.name,left,y,{width,lineBreak:false});y+=25;}
 function ensure(height){if(y+height>bottom)newPage();}
 function block(value,{size=10.5,bold=false,align='left',gap=0,startX=left,blockWidth=width}={}){
  const lines=wrapped(value,blockWidth,size,bold),height=size*1.45;
  for(let i=0;i<lines.length;i++){
   // Keep the last two lines together when a paragraph continues onto another page.
   ensure(height*(lines.length-i===2?2:1));
   font(size,bold);
   const x=align==='right'?startX+blockWidth-doc.widthOfString(lines[i]):startX;
   const spaces=(lines[i].match(/ /g)||[]).length;
   const wordSpacing=align==='justify'&&i<lines.length-1&&spaces
    ?Math.max(0,(blockWidth-doc.widthOfString(lines[i]))/spaces):0;
   // Lines are already wrapped; omitting width prevents PDFKit from wrapping them again.
   if(lines[i])doc.text(lines[i],x,y,{lineBreak:false,wordSpacing});
   y+=height;
  }
  y+=gap;
 }
 const sender=letter.sender,recipient=letter.recipient;
 if(clean(letter.documentTitle)){
  font(8,true);doc.fillColor('#637083').text(clean(letter.documentTitle),left,y,{width,characterSpacing:2});y=Math.max(y+26,doc.y+12);
 }
 font();
 const email=clean(sender.email);
 const senderWidth=email?Math.min(width/2,doc.widthOfString(email)+0.01):180;
 const senderLayout={startX:right-senderWidth,blockWidth:senderWidth};
 const cityLine=person=>[[person.postalCode,person.city].filter(Boolean).join(' '),person.country].filter(Boolean).join(', ');
 if(sender.name)block(sender.name,{...senderLayout,bold:true});
 for(const value of [sender.address,cityLine(sender),sender.phone,sender.email].filter(Boolean))block(value,senderLayout);
 y=Math.max(142,y+8);
 if(recipient.company)block(recipient.company,{bold:true});
 for(const value of [recipient.attention,recipient.address,cityLine(recipient)].filter(Boolean))block(value);
 y+=20;
 const dateLine=letter.date?[sender.city,germanLetterDate(letter.date)].filter(Boolean).join(', '):'';
 if(dateLine)block(dateLine,{gap:22});
 if(letter.subject){const height=wrapped(letter.subject,width,11,true).length*16+55;ensure(Math.min(height,bottom-82));block(letter.subject,{size:11,bold:true,gap:22});}
 if(letter.salutation){ensure(60);block(letter.salutation,{gap:13});}
 if(letter.body){
  for(const paragraph of clean(letter.body).split(/\r?\n\s*\r?\n/)){
   for(const line of paragraph.split(/\r?\n/))block(line,{align:'justify'});
   y+=12;
  }
 }
 const signature=prepareSignature(doc,letter.signature);
 // Keep the closing, typed name and optional signature together.
 const closingHeight=(letter.closing?wrapped(letter.closing,width,10.5).length*15.225:0)+(sender.name?wrapped(sender.name,width,10.5).length*15.225:0)+(signature?signature.height+6:0)+10;
 ensure(Math.min(closingHeight,bottom-82));
 if(letter.closing)block(letter.closing);
 if(sender.name)block(sender.name);
 if(signature){y+=6;doc.image(signature.image,left,y,{width:signature.width,height:signature.height});y+=signature.height;}
 const pages=doc.bufferedPageRange();
 if(pages.count>1)for(let i=0;i<pages.count;i++){
  doc.switchToPage(i);doc.page.margins.bottom=0;font(8);doc.fillColor('#68717c').text(`${i+1} / ${pages.count}`,left,811,{width,align:'right',lineBreak:false});
 }
 doc.end();return done;
}
