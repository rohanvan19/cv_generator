'use client';
import {useEffect,useRef,useState} from 'react';
import {Mail,UserRound,Building2,CalendarDays,FileText,Download,LoaderCircle,RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,Field,Toggle} from './cv-controls';
import {downloadBlob} from './pdf-preview';
import {germanLetterDate,type CoverLetterTemplate} from '@/lib/cover-letter';
import type {Lang} from '@/lib/model';

async function letterPdf(letter:CoverLetterTemplate,signal?:AbortSignal){
 const response=await fetch('/api/cover-letter/pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({letter}),signal});
 if(!response.ok){const result=await response.json();throw new Error(result.error||'Could not create the cover letter.');}
 return response.blob();
}

export function CoverLetterStudio({letter,onChange,ui}:{letter:CoverLetterTemplate,onChange:(letter:CoverLetterTemplate)=>void,ui:Lang}){
 const t=(en:string,de:string)=>ui==='de'?de:en;
 const container=useRef<HTMLDivElement>(null);
 const signatureInput=useRef<HTMLInputElement>(null);
 const latest=useRef({letter,onChange});
 useEffect(()=>{latest.current={letter,onChange};},[letter,onChange]);
 const [signatureError,setSignatureError]=useState(''),[uploading,setUploading]=useState(false);
 async function uploadSignature(file?:File){
  if(!file)return;
  setSignatureError('');setUploading(true);
  let bitmap:ImageBitmap|undefined;
  try{
   if(!['image/png','image/jpeg'].includes(file.type)||file.size>5*1024*1024)throw new Error(t('Choose a PNG or JPG up to 5 MB.','Wählen Sie eine PNG- oder JPG-Datei bis 5 MB.'));
   bitmap=await createImageBitmap(file);
   const scale=Math.min(1,1200/bitmap.width,400/bitmap.height),canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');if(!context)throw new Error('Image processing unavailable');
   context.drawImage(bitmap,0,0,canvas.width,canvas.height);
   const image=canvas.toDataURL('image/png');
   if(image.length>3000000)throw new Error(t('Please choose a smaller image.','Bitte wählen Sie ein kleineres Bild.'));
   const current=latest.current;current.onChange({...current.letter,signature:{...current.letter.signature,image}});
  }catch(e){setSignatureError(e instanceof Error?e.message:t('Could not read this image.','Das Bild konnte nicht gelesen werden.'));}
  finally{bitmap?.close();setUploading(false);if(signatureInput.current)signatureInput.current.value='';}
 }
 const [pages,setPages]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[downloading,setDownloading]=useState(false);
 const data=JSON.stringify(letter);
 useEffect(()=>{
  const controller=new AbortController();let cancelled=false;let task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
  const timer=setTimeout(async()=>{
   setLoading(true);setError('');
   try{
    const blob=await letterPdf(JSON.parse(data),controller.signal);const lib=await import('pdfjs-dist');
    lib.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';if(cancelled)return;
    task=lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),useSystemFonts:true});const pdf=await task.promise;const canvases=[];
    for(let i=1;i<=pdf.numPages;i++){
     if(cancelled)return;
     const page=await pdf.getPage(i),viewport=page.getViewport({scale:1.6}),canvas=document.createElement('canvas');
     canvas.width=viewport.width;canvas.height=viewport.height;canvas.setAttribute('role','img');canvas.setAttribute('aria-label',`${ui==='de'?'Anschreiben, Seite':'Cover letter, page'} ${i}`);
     await page.render({canvas,viewport}).promise;canvases.push(canvas);
    }
    if(!cancelled&&container.current){container.current.replaceChildren(...canvases);setPages(pdf.numPages);}
   }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Preview failed');}
   finally{if(!cancelled)setLoading(false);}
  },450);
  return()=>{cancelled=true;clearTimeout(timer);controller.abort();void task?.destroy();};
 },[data,retry,ui]);
 const sender=(key:keyof CoverLetterTemplate['sender'],value:string)=>onChange({...letter,sender:{...letter.sender,[key]:value}});
 const recipient=(key:keyof CoverLetterTemplate['recipient'],value:string)=>onChange({...letter,recipient:{...letter.recipient,[key]:value}});
 const ready=!!(letter.sender.name.trim()&&letter.recipient.company.trim()&&letter.date&&letter.subject.trim());
 const addressLabels={address:t('Street and house number','Straße und Hausnummer'),postalCode:t('Postal code / PIN','Postleitzahl / PIN'),city:t('City / location','Ort / Stadt'),country:t('Country','Land')};
 const addressLimits={address:400,postalCode:30,city:200,country:100};
 return <div className="working-area letter-workspace">
  <section className="editor">
   <div className="editor-heading"><div><p className="eyebrow">03 / {t('Your introduction','Ihre Vorstellung')}</p><h1>{t('German cover letter','Bewerbungsanschreiben')}</h1><p className="subtitle">{t('A classic German letter layout. Fill in the details, paste your text, and download an A4 PDF.','Ein klassisches deutsches Brieflayout. Daten ausfüllen, Text einfügen und als A4-PDF herunterladen.')}</p></div></div>
   <Card title={t('1. Your details','1. Absender')} icon={<UserRound size={19}/>}><div className="fields">
    <Field label={t('Full name','Vollständiger Name')} value={letter.sender.name} onChange={value=>sender('name',value)} wide maxLength={200}/>
    {(Object.keys(addressLabels) as (keyof typeof addressLabels)[]).map(key=><Field key={key} label={addressLabels[key]} value={letter.sender[key]} onChange={value=>sender(key,value)} wide={key==='address'} maxLength={addressLimits[key]}/>)}
    <Field label={t('Phone number','Telefonnummer')} value={letter.sender.phone} onChange={value=>sender('phone',value)} type="tel" maxLength={100}/>
    <Field label={t('Email','E-Mail')} value={letter.sender.email} onChange={value=>sender('email',value)} type="email" maxLength={300}/>
   </div></Card>
   <Card title={t('2. Company and recipient','2. Unternehmen und Empfänger')} icon={<Building2 size={19}/>}><div className="fields">
    <Field label={t('Company name','Unternehmensname')} value={letter.recipient.company} onChange={value=>recipient('company',value)} wide maxLength={300}/>
    <Field label={t('Person / team addressed','Ansprechperson / Team')} value={letter.recipient.attention} onChange={value=>recipient('attention',value)} wide maxLength={200} placeholder={t('e.g. Frau Müller / Recruiting Team','z. B. Frau Müller / Recruiting-Team')}/>
    {(Object.keys(addressLabels) as (keyof typeof addressLabels)[]).map(key=><Field key={key} label={addressLabels[key]} value={letter.recipient[key]} onChange={value=>recipient(key,value)} wide={key==='address'} maxLength={addressLimits[key]}/>)}
   </div></Card>
   <Card title={t('3. Date and subject','3. Datum und Betreff')} icon={<CalendarDays size={19}/>}><div className="fields">
    <Field label={t('Date','Datum')} value={letter.date} onChange={date=>onChange({...letter,date})} type="date" maxLength={10} hint={letter.date?germanLetterDate(letter.date):'09 October 2026'}/>
    <div className="letter-today"><Button variant="outline" onClick={()=>{const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=(type:string)=>parts.find(p=>p.type===type)?.value;onChange({...letter,date:`${part('year')}-${part('month')}-${part('day')}`});}}>{t('Use today’s date','Heutiges Datum')}</Button></div>
    <Field label={t('Subject of application','Bewerbungsbetreff')} value={letter.subject} onChange={subject=>onChange({...letter,subject})} wide maxLength={300} placeholder="Bewerbung als … – Referenznummer …" hint={t('Printed in bold without the word “Betreff”. Include the job title and reference number if applicable.','Wird fett ohne das Wort „Betreff“ gedruckt. Stellenbezeichnung und gegebenenfalls Kennziffer ergänzen.')}/>
   </div></Card>
   <Card title={t('4. Letter text','4. Anschreibentext')} icon={<Mail size={19}/>}><div className="fields">
    <Field label={t('Salutation','Anrede')} value={letter.salutation} onChange={salutation=>onChange({...letter,salutation})} wide maxLength={200} hint={t('Edit this separately to address the person or team correctly.','Passen Sie die Anrede an die Ansprechperson oder das Team an.')}/>
    <Field label={t('Letter body','Brieftext')} value={letter.body} onChange={body=>onChange({...letter,body})} wide multiline hint={t('Paste the body from ChatGPT here. Leave out addresses, date, subject, greeting and signature; this template adds them. Separate paragraphs with a blank line.','Fügen Sie hier den Text aus ChatGPT ein. Adressen, Datum, Betreff, Anrede und Unterschrift werden durch die Vorlage ergänzt. Absätze durch eine Leerzeile trennen.')}/>
    <Field label={t('Closing','Grußformel')} value={letter.closing} onChange={closing=>onChange({...letter,closing})} wide maxLength={100}/>
   </div><p className="field-hint">{t('Your name appears directly below the closing.','Ihr Name erscheint direkt unter der Grußformel.')}</p></Card>
   <Card title={t('5. Signature (optional)','5. Unterschrift (optional)')}>
    <Toggle label={t('Include signature image','Unterschrift einfügen')} checked={letter.signature.enabled} onChange={enabled=>onChange({...letter,signature:{...letter.signature,enabled}})}/>
    <p className="field-hint">{t('Appears below your name after the closing. Your uploaded image is saved for future letters, even when switched off.','Erscheint unter Ihrem Namen nach der Grußformel. Das Bild bleibt auch bei ausgeschalteter Option für spätere Briefe gespeichert.')}</p>
    {letter.signature.enabled&&<div className="photo-actions">
     <label className="field">{t('Signature size','Größe der Unterschrift')}: {letter.signature.size}%<input type="range" min={25} max={200} step={5} value={letter.signature.size} onChange={event=>onChange({...letter,signature:{...letter.signature,size:Number(event.target.value)}})}/></label>
     <Button variant="outline" disabled={uploading} onClick={()=>signatureInput.current?.click()}>{uploading?t('Uploading…','Wird geladen…'):letter.signature.image?t('Replace signature','Unterschrift ersetzen'):t('Upload signature from device','Unterschrift vom Gerät hochladen')}</Button>
     <input ref={signatureInput} type="file" accept="image/png,image/jpeg" hidden onChange={event=>void uploadSignature(event.target.files?.[0])}/>
     <p className="field-hint">{t('PNG or JPG · Up to 5 MB. A tightly cropped transparent PNG works best.','PNG oder JPG · Bis 5 MB. Am besten eignet sich eine eng zugeschnittene PNG-Datei mit transparentem Hintergrund.')}</p>
     {letter.signature.image&&<><img src={letter.signature.image} alt={t('Uploaded signature','Hochgeladene Unterschrift')} style={{maxWidth:240,maxHeight:100,objectFit:'contain',background:'white'}}/><Button variant="ghost" disabled={uploading} onClick={()=>onChange({...letter,signature:{...letter.signature,image:''}})}>{t('Remove signature image','Unterschrift entfernen')}</Button></>}
    </div>}
    {signatureError&&<p role="alert" className="inline-warning">{signatureError}</p>}
   </Card>
  </section>
  <aside className="preview-pane"><div className="preview-sticky">
   <div className="preview-toolbar"><span className="inline-flex items-center gap-2"><FileText size={17}/>{t('Letter preview','Briefvorschau')}</span><span className="field-hint">A4 · Deutsch</span></div>
   <p className="field-hint letter-layout-note">{t('DIN 5008–inspired layout · 11 pt subject · 10.5 pt body','Layout angelehnt an DIN 5008 · Betreff 11 pt · Text 10,5 pt')}</p>
   {pages>1&&<p className="translation-note">{t('Your letter is longer than one page. Consider shortening the body; all content is retained in the PDF.','Ihr Anschreiben ist länger als eine Seite. Kürzen Sie gegebenenfalls den Text; alle Inhalte bleiben im PDF erhalten.')}</p>}
   <div className="pdf-surface"><div ref={container} className="pdf-canvases"/>{!pages&&!error&&<div className="pdf-empty"><FileText size={36}/><p>{t('Preparing your letter…','Ihr Anschreiben wird vorbereitet…')}</p></div>}{loading&&<span className="preview-loading"><LoaderCircle size={14} className="spin"/>{t('Updating','Wird aktualisiert')}</span>}</div>
   {error&&<div role="alert" className="preview-error"><p>{error}</p><Button variant="outline" onClick={()=>setRetry(value=>value+1)}><RefreshCw/>{t('Retry','Erneut versuchen')}</Button></div>}
   <div className="download-bar"><span className="field-hint">{pages||'–'} {t('page(s)','Seite(n)')}</span><Button className="download-button" disabled={!ready||downloading} onClick={async()=>{setDownloading(true);try{downloadBlob(await letterPdf(letter),['Anschreiben',letter.sender.name,letter.recipient.company].join('_').replace(/[^\p{L}\p{N}._-]/gu,'_')+'.pdf');}catch(e){setError(e instanceof Error?e.message:'Export failed');}finally{setDownloading(false);}}}>{downloading?<LoaderCircle className="spin"/>:<Download/>}{t('Download PDF','PDF herunterladen')}</Button></div>
   {!ready&&<p className="field-hint letter-layout-note">{t('Add your name, company, date and application subject to enable download.','Tragen Sie Ihren Namen, Unternehmen, Datum und Bewerbungsbetreff ein, um das PDF herunterzuladen.')}</p>}
  </div></aside>
 </div>;
}
