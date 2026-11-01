'use client';
import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {GripVertical} from 'lucide-react';
import type {Lang,SectionId} from '@/lib/model';

type Drag={id:SectionId,pointerId:number,startY:number,y:number,offset:number,left:number,width:number,height:number,active:boolean,original:SectionId[]};

export function SectionOrderList({order,labels,onChange,ui}:{order:SectionId[],labels:Record<SectionId,string>,onChange:(order:SectionId[])=>void,ui:Lang}){
 const t=(en:string,de:string)=>ui==='de'?de:en;
 const list=useRef<HTMLDivElement>(null),rows=useRef(new Map<SectionId,HTMLDivElement>()),drag=useRef<Drag|null>(null);
 const current=useRef(order),positions=useRef(new Map<SectionId,number>());
 const [preview,setPreview]=useState<SectionId[]|null>(null),[floating,setFloating]=useState<Drag|null>(null),[announcement,setAnnouncement]=useState('');
 const visible=preview||order;current.current=visible;

 useLayoutEffect(()=>{
  const next=new Map<SectionId,number>();
  for(const id of visible){
   const row=rows.current.get(id);if(!row)continue;
   const top=row.offsetTop,previous=positions.current.get(id);next.set(id,top);
   if(previous!==undefined&&previous!==top&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    row.getAnimations().forEach(animation=>animation.cancel());
    row.animate([{transform:`translateY(${previous-top}px)`},{transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
   }
  }
  positions.current=next;
 },[visible]);

 function move(index:number,destination:number){
  if(destination<0||destination>=order.length||drag.current)return;
  const next=[...order],section=next.splice(index,1)[0];next.splice(destination,0,section);onChange(next);
  setAnnouncement(t(`${labels[section]} moved to position ${destination+1} of ${next.length}.`,`${labels[section]} auf Position ${destination+1} von ${next.length} verschoben.`));
 }
 function updateTarget(){
  const session=drag.current,element=list.current;if(!session?.active||!element)return;
  const y=session.y-element.getBoundingClientRect().top+element.scrollTop;
  const others=current.current.filter(id=>id!==session.id);
  const target=others.findIndex(id=>{const row=rows.current.get(id);return row&&y<row.offsetTop+row.offsetHeight/2;});
  const next=[...others];next.splice(target===-1?others.length:target,0,session.id);
  if(next.some((id,index)=>id!==current.current[index])){current.current=next;setPreview(next);}
 }
 function finish(cancel=false){
  const session=drag.current;if(!session)return;
  const next=[...current.current];drag.current=null;setFloating(null);setPreview(null);
  if(list.current?.hasPointerCapture(session.pointerId))list.current.releasePointerCapture(session.pointerId);
  if(session.active&&!cancel){
   if(next.some((id,index)=>id!==session.original[index]))onChange(next);
   setAnnouncement(t(`${labels[session.id]} moved to position ${next.indexOf(session.id)+1} of ${next.length}.`,`${labels[session.id]} auf Position ${next.indexOf(session.id)+1} von ${next.length} verschoben.`));
  }
 }
 useEffect(()=>{
  if(!floating)return;
  let frame:number;
  const scroll=()=>{
   const session=drag.current,element=list.current;
   if(session?.active&&element){
    const rect=element.getBoundingClientRect(),edge=40;
    const speed=session.y<rect.top+edge?-Math.min(12,(rect.top+edge-session.y)/4):session.y>rect.bottom-edge?Math.min(12,(session.y-rect.bottom+edge)/4):0;
    if(speed){element.scrollTop+=speed;updateTarget();}
   }
   frame=requestAnimationFrame(scroll);
  };
  frame=requestAnimationFrame(scroll);return()=>cancelAnimationFrame(frame);
 },[!!floating]);
 useEffect(()=>{
  const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'&&drag.current){event.preventDefault();event.stopPropagation();finish(true);}};
  window.addEventListener('keydown',cancel,true);return()=>window.removeEventListener('keydown',cancel,true);
 },[]);
 function start(event:PointerEvent<HTMLButtonElement>,id:SectionId){
  if(event.button!==0||!event.isPrimary||drag.current)return;
  const rect=rows.current.get(id)?.getBoundingClientRect();if(!rect||!list.current)return;
  event.preventDefault();event.currentTarget.focus();
  drag.current={id,pointerId:event.pointerId,startY:event.clientY,y:event.clientY,offset:event.clientY-rect.top,left:rect.left,width:rect.width,height:rect.height,active:false,original:[...order]};
  list.current.setPointerCapture(event.pointerId);
 }
 return <>
  <p className="field-hint">{t('Drag a handle to reorder. You can also focus a handle and use the arrow keys.','Ziehen Sie einen Griff, um die Reihenfolge zu ändern. Alternativ den Griff fokussieren und die Pfeiltasten verwenden.')}</p>
  <div ref={list} className="section-order-list section-order-sortable" onPointerMove={event=>{
   const session=drag.current;if(!session||event.pointerId!==session.pointerId)return;
   session.y=event.clientY;
   if(!session.active&&Math.abs(session.y-session.startY)<4)return;
   session.active=true;setFloating({...session});updateTarget();
  }} onPointerUp={event=>{if(event.pointerId===drag.current?.pointerId)finish();}} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}>
   {visible.map((section,index)=><div ref={element=>{if(element)rows.current.set(section,element);else rows.current.delete(section);}} className={'section-order-row'+(floating?.id===section?' section-order-placeholder':'')} key={section}>
    <button type="button" className="section-drag-handle" aria-label={t(`Drag ${labels[section]} to reorder`,`${labels[section]} zum Sortieren ziehen`)} onPointerDown={event=>start(event,section)} onKeyDown={event=>{
     if(event.key==='ArrowUp'||event.key==='ArrowDown'||event.key==='Home'||event.key==='End'){
      event.preventDefault();move(index,event.key==='Home'?0:event.key==='End'?order.length-1:index+(event.key==='ArrowUp'?-1:1));
     }
    }}><GripVertical aria-hidden="true"/></button>
    <span>{labels[section]}</span>
   </div>)}
  </div>
  <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
  {floating&&createPortal(<div aria-hidden="true" className="section-order-row section-order-floating" style={{top:floating.y-floating.offset,left:floating.left,width:floating.width,minHeight:floating.height}}><GripVertical/><span>{labels[floating.id]}</span></div>,document.body)}
 </>;
}
