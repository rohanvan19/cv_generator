import PDFDocument from 'pdfkit';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cvLabels, text, entryGroups, sectionLabel, ordered, dateRange, formatBirthDate, employmentTypeLabel } from '../lib/model.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function createPdf(profile,{coverLetter,company='',role=''}={}){
 const lang=profile.settings.language;const labels=cvLabels[lang];
 const doc=new PDFDocument({size:'A4',margins:{top:43,bottom:45,left:44,right:44},bufferPages:true,info:{Title:coverLetter?'Cover letter':profile.personal.name+' - '+labels.cv,Author:profile.personal.name,Creator:'CV Studio'}});
 const chunks=[];const done=new Promise((resolve,reject)=>{doc.on('data',c=>chunks.push(c));doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.on('error',reject);});
 const family=profile.settings.fontFamily||'inter';
 const windowsFontRoot=path.join(process.env.WINDIR||'C:/Windows','Fonts');
 const systemFonts=family==='times'?{regular:path.join(windowsFontRoot,'times.ttf'),bold:path.join(windowsFontRoot,'timesbd.ttf'),fallback:{regular:'Times-Roman',bold:'Times-Bold'}}:{regular:path.join(windowsFontRoot,'arial.ttf'),bold:path.join(windowsFontRoot,'arialbd.ttf'),fallback:{regular:'Helvetica',bold:'Helvetica-Bold'}};
 const embedded=family==='inter'||existsSync(systemFonts.regular)&&existsSync(systemFonts.bold);
 const fontNames=embedded?{regular:'Regular',bold:'Bold'}:systemFonts.fallback;
 if(family==='inter'){doc.registerFont('Regular',path.join(root,'public/fonts/Inter-Regular.woff'));doc.registerFont('Bold',path.join(root,'public/fonts/Inter-SemiBold.woff'));}else if(embedded){doc.registerFont('Regular',systemFonts.regular);doc.registerFont('Bold',systemFonts.bold);}
 const selectedSize=profile.settings.fontSize||10;const bodySize=Math.max(7,selectedSize-(profile.settings.compact?1:0));const scale=bodySize/10;const pt=size=>size*scale;
 let y=44;const left=44,right=551,dateWidth=90,gap=20,bodyX=left+dateWidth+gap,bodyWidth=right-bodyX;const lineHeight=bodySize*1.5;const bottom=787;
 const setFont=(bold=false,size=10)=>doc.font(bold?fontNames.bold:fontNames.regular).fontSize(pt(size)).fillColor('#1b2735');
 const clean=s=>String(s||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[‐‑‒–—]/g,'-').trim();
 function newPage(){doc.addPage();y=44;setFont(true,8);doc.fillColor('#6d7786').text(clean(profile.personal.name),left,y,{width:507});y+=pt(22);}
 function room(height){if(y+height>bottom)newPage();}
 function heading(s){room(pt(55));y+=pt(17);setFont(true,10);doc.text(s.toLocaleUpperCase(lang),left,y,{width:507,characterSpacing:.7});y+=pt(17);doc.moveTo(left,y).lineTo(right,y).lineWidth(.45).strokeColor('#bdc5cf').stroke();y+=pt(13);}
 function lines(s,width,size=10,bold=false){setFont(bold,size);const parts=[];for(const para of clean(s).split('\n')){if(!para){parts.push('');continue;}let line='';for(const word of para.split(/\s+/)){const test=line?line+' '+word:word;if(doc.widthOfString(test)>width&&line){parts.push(line);line='';}if(doc.widthOfString(word)>width){let segment='';for(const c of word){if(doc.widthOfString(segment+c)>width){parts.push(segment);segment='';}segment+=c;}line=segment;}else line=line?line+' '+word:word;}parts.push(line);}return parts;}
 function paragraph(s,x=left,width=507,{bold=false,color='#263444',size=10}={}){const actualSize=pt(size);for(const line of lines(s,width,size,bold)){room(actualSize*1.6);setFont(bold,size);doc.fillColor(color).text(line,x,y,{width,lineBreak:false});y+=actualSize*1.5;}}
 function row(label,s){const labelLineHeight=pt(12);const labelLines=lines(label,dateWidth,8);const bodyLines=lines(s,bodyWidth);const estimated=Math.max(labelLines.length*labelLineHeight,bodyLines.length*lineHeight)+pt(5);if(estimated<bottom-66)room(estimated);const rowY=y;for(const line of labelLines){room(labelLineHeight);setFont(false,8);doc.fillColor('#677487').text(line,left,y,{width:dateWidth,lineBreak:false});y+=labelLineHeight;}const labelEnd=y;y=rowY;paragraph(s,bodyX,bodyWidth);y=Math.max(y,labelEnd)+pt(5);}
 function languageGrid(languages){
  const totalWidth=right-left,columnGap=28,columnWidth=(totalWidth-columnGap)/2,nameWidth=96,levelOffset=110,levelWidth=columnWidth-levelOffset,itemLineHeight=pt(11.5),rowGap=pt(7);
  const languageName=item=>text(item.name,lang);
  const languageLevel=item=>item.level==='Native'?labels.native:item.level;
  const measure=item=>item?Math.max(lines(languageName(item),nameWidth,9).length,lines(languageLevel(item),levelWidth,9).length)*itemLineHeight:0;
  const draw=(item,x,rowY)=>{
   if(!item)return;
   const nameLines=lines(languageName(item),nameWidth,9);const levelLines=lines(languageLevel(item),levelWidth,9);
   for(let i=0;i<nameLines.length;i++){setFont(false,9);doc.fillColor('#536276').text(nameLines[i],x,rowY+i*itemLineHeight,{width:nameWidth,lineBreak:false});}
   for(let i=0;i<levelLines.length;i++){setFont(false,9);doc.fillColor('#263444').text(levelLines[i],x+levelOffset,rowY+i*itemLineHeight,{width:levelWidth,lineBreak:false});}
  };
  for(let base=0;base<languages.length;base+=4){
   const firstHeight=Math.max(measure(languages[base]),measure(languages[base+2]));
   const hasSecond=!!(languages[base+1]||languages[base+3]);
   const secondHeight=hasSecond?Math.max(measure(languages[base+1]),measure(languages[base+3])):0;
   const blockHeight=firstHeight+(hasSecond?rowGap+secondHeight:0);
   room(blockHeight);
   const firstY=y,secondY=firstY+firstHeight+rowGap,rightX=left+columnWidth+columnGap;
   draw(languages[base],left,firstY);
   draw(languages[base+1],left,secondY);
   draw(languages[base+2],rightX,firstY);
   draw(languages[base+3],rightX,secondY);
   y+=blockHeight+pt(4);
  }
 }
 function safeLink(s){try{const u=new URL(s.startsWith('http')?s:'https://'+s);return ['http:','https:'].includes(u.protocol)?u.href:undefined;}catch{return undefined;}}
 setFont(true,8);doc.fillColor('#637083').text(coverLetter?(lang==='de'?'ANSCHREIBEN':'COVER LETTER'):labels.cv,left,y,{characterSpacing:2});y+=pt(26);
 const portrait=!coverLetter&&profile.settings.showPhoto&&profile.photo.cropped;
 const headerWidth=portrait?393:507;
 if(portrait){doc.image(Buffer.from(portrait.split(',')[1],'base64'),459,44,{width:92,height:115});}
 for(const line of lines(profile.personal.name||' ',headerWidth,24,true)){setFont(true,24);doc.text(line,left,y,{width:headerWidth,lineBreak:false});y+=pt(30);}
 const roleTitle=text(profile.headline,lang);if(roleTitle){for(const line of lines(roleTitle,headerWidth,11)){setFont(false,11);doc.fillColor('#49596d').text(line,left,y,{width:headerWidth,lineBreak:false});y+=pt(16);}y+=pt(7);}
 const contactLabels=lang==='de'
  ?{email:'E-Mail',phone:'Kontakt',dateOfBirth:'Geburtsdatum',address:'Adresse',location:'Ort',website:'Website',linkedin:'LinkedIn'}
  :{email:'E-mail',phone:'Contact',dateOfBirth:'Date of birth',address:'Address',location:'Location',website:'Website',linkedin:'LinkedIn'};
 const contactRows=[
  [contactLabels.email,profile.personal.email,false],
  [contactLabels.phone,profile.personal.phone,false],
  [contactLabels.dateOfBirth,formatBirthDate(profile.personal.dateOfBirth),false],
  [contactLabels.address,profile.personal.address,false],
  [contactLabels.location,text(profile.personal.location,lang),false],
  [contactLabels.website,profile.personal.website,true],
  [contactLabels.linkedin,profile.personal.linkedin,true],
  ...(profile.personal.customFields||[]).filter(field=>field.included&&text(field.label,lang)&&text(field.value,lang)).map(field=>[text(field.label,lang),text(field.value,lang),false]),
 ].filter(([,value])=>value);
 const contactLabelWidth=78;
 const contactValueX=left+contactLabelWidth;
 const contactValueWidth=headerWidth-contactLabelWidth;
 for(const [label,value,isLink] of contactRows){
  const labelLineHeight=pt(10),valueLineHeight=pt(12);
  const labelLines=lines(label,contactLabelWidth-8,7.5);
  const valueLines=lines(value,contactValueWidth,8.5);
  room(Math.max(pt(12),labelLines.length*labelLineHeight,valueLines.length*valueLineHeight));
  const rowY=y;
  let labelY=rowY;
  for(const line of labelLines){
   setFont(true,7.5);doc.fillColor('#7a8798').text(line,left,labelY,{width:contactLabelWidth-8,lineBreak:false});
   labelY+=labelLineHeight;
  }
  let valueY=rowY;
  for(const line of valueLines){
   setFont(false,8.5);
   doc.fillColor(isLink?'#364c70':'#536276').text(line,contactValueX,valueY,{width:contactValueWidth,lineBreak:false,...(isLink?{link:safeLink(value)}:{})});
   valueY+=valueLineHeight;
  }
  y=Math.max(labelY,valueY,rowY+pt(12));
 }
 y=Math.max(y,portrait?166:134)+pt(2);
 if(coverLetter){y+=pt(20);if(company)paragraph(company,left,507,{bold:true});if(role){y+=pt(10);paragraph(role,left,507,{bold:true});}y+=pt(20);paragraph(coverLetter);}
 else {
  const groups=new Map(entryGroups(profile).map(group=>[group.id,group]));
  for(const section of profile.settings.sectionOrder){
   if(section==='summary'){if(profile.settings.showSummary&&text(profile.summary,lang)){heading(labels.summary);paragraph(text(profile.summary,lang));}continue;}
   if(groups.has(section)){
    const group=groups.get(section);if(!group.included)continue;
    const entries=section==='projects'?group.entries.filter(entry=>entry.included):ordered(group.entries);if(!entries.length)continue;heading(sectionLabel(profile,section,lang));
    for(const entry of entries){
     room(pt(65));const rowY=y;setFont(false,8);doc.fillColor('#677487').text(dateRange(entry,lang),left,y,{width:dateWidth});
     const type=section==='experience'||section.startsWith('custom:')?employmentTypeLabel(entry.employmentType||'',lang):'';
     paragraph([text(entry.title,lang),type].filter(Boolean).join(' · '),bodyX,bodyWidth,{bold:true});
     const org=[text(entry.organization,lang),text(entry.location,lang)].filter(Boolean).join(' · ');if(org)paragraph(org,bodyX,bodyWidth,{color:'#586576',size:9});
     const description=text(entry.description,lang);if(description){y+=pt(5);for(const bullet of description.split('\n').filter(value=>value.trim())){room(lineHeight);setFont(false,10);doc.fillColor('#526074').text('•',bodyX,y,{lineBreak:false});paragraph(bullet.replace(/^\s*[-•]\s*/,''),bodyX+11,bodyWidth-11);y+=pt(2);}}
     if(y===rowY)y+=lineHeight;y+=pt(10);
    }
    continue;
   }
   if(section==='skills'){const skills=profile.skills.filter(skill=>skill.included&&text(skill.name,lang));if(skills.length){heading(labels.skills);for(const skill of skills)row(text(skill.category,lang),text(skill.name,lang));}continue;}
   if(section==='languages'){const languages=profile.languages.filter(language=>language.included&&text(language.name,lang));if(languages.length){heading(labels.languages);languageGrid(languages);}continue;}
   if(section==='interests'&&profile.settings.showInterests&&text(profile.interests,lang)){heading(labels.interests);row('',text(profile.interests,lang));}
  }
 }
 const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);const previousBottom=doc.page.margins.bottom;doc.page.margins.bottom=0;setFont(false,7.5);doc.fillColor('#7a8491').text(labels.page+' '+(i+1)+' / '+pages.count,left,810,{width:507,align:'right',lineBreak:false});doc.page.margins.bottom=previousBottom;}
 doc.end();return done;
}