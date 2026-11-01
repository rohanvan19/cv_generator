'use client';
import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Card,Toggle} from './cv-controls';
import type {Signature} from '@/lib/cover-letter';
import type {Lang} from '@/lib/model';
export function SignatureControls({value,onChange,ui,title,description}:{value:Signature,onChange:(value:Signature)=>void,ui:Lang,title?:string,description:string}){
 const t=(en:string,de:string)=>ui==='de'?de:en;
 const signatureInput=useRef<HTMLInputElement>(null);
 const latest=useRef({value,onChange});
 useEffect(()=>{latest.current={value,onChange};},[value,onChange]);
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
   const current=latest.current;current.onChange({...current.value,image});
  }catch(e){setSignatureError(e instanceof Error?e.message:t('Could not read this image.','Das Bild konnte nicht gelesen werden.'));}
  finally{bitmap?.close();setUploading(false);if(signatureInput.current)signatureInput.current.value='';}
 }

 return (   <Card title={title||t('Signature (optional)','Unterschrift (optional)')}>
    <Toggle label={t('Include signature image','Unterschrift einfügen')} checked={value.enabled} onChange={enabled=>onChange({...value,enabled})}/>
    <p className="field-hint">{description}</p>
    {value.enabled&&<div className="photo-actions">
     <label className="field">{t('Signature size','Größe der Unterschrift')}: {value.size}%<input type="range" min={25} max={200} step={5} value={value.size} onChange={event=>onChange({...value,size:Number(event.target.value)})}/></label>
     <Button variant="outline" disabled={uploading} onClick={()=>signatureInput.current?.click()}>{uploading?t('Uploading…','Wird geladen…'):value.image?t('Replace signature','Unterschrift ersetzen'):t('Upload signature from device','Unterschrift vom Gerät hochladen')}</Button>
     <input ref={signatureInput} type="file" accept="image/png,image/jpeg" hidden onChange={event=>void uploadSignature(event.target.files?.[0])}/>
     <p className="field-hint">{t('PNG or JPG · Up to 5 MB. A tightly cropped transparent PNG works best.','PNG oder JPG · Bis 5 MB. Am besten eignet sich eine eng zugeschnittene PNG-Datei mit transparentem Hintergrund.')}</p>
     {value.image&&<><img src={value.image} alt={t('Uploaded signature','Hochgeladene Unterschrift')} style={{maxWidth:240,maxHeight:100,objectFit:'contain',background:'white'}}/><Button variant="ghost" disabled={uploading} onClick={()=>onChange({...value,image:''})}>{t('Remove signature image','Unterschrift entfernen')}</Button></>}
    </div>}
    {signatureError&&<p role="alert" className="inline-warning">{signatureError}</p>}
   </Card>
);
}
