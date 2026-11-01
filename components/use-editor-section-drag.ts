'use client';
import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent,type KeyboardEvent} from 'react';
import type {EditorSectionId,Lang} from '@/lib/model';

type Drag={id:EditorSectionId,pointerId:number,x:number,y:number,startX:number,startY:number,offsetX:number,offsetY:number,width:number,height:number,active:boolean,target:EditorSectionId|null};

export function useEditorSectionDrag(order:EditorSectionId[],onChange:(order:EditorSectionId[])=>void,labels:Record<string,string>,ui:Lang){
 const list=useRef<HTMLDivElement>(null),session=useRef<Drag|null>(null);
 const latest=useRef({order,onChange,labels,ui});latest.current={order,onChange,labels,ui};
 const [floating,setFloating]=useState<Drag|null>(null),[announcement,setAnnouncement]=useState('');
 const positions=useRef(new Map<string,{left:number,top:number}>());
 const headers=()=>Array.from(list.current?.querySelectorAll<HTMLElement>('[data-editor-section]')||[]);
 const header=(id:string)=>headers().find(element=>element.dataset.editorSection===id);
 const focusHandle=(id:string)=>requestAnimationFrame(()=>header(id)?.querySelector<HTMLButtonElement>('.editor-section-drag-handle')?.focus({preventScroll:true}));

 useLayoutEffect(()=>{
  const next=new Map<string,{left:number,top:number}>();
  for(const element of headers()){
   const rect=element.getBoundingClientRect(),id=element.dataset.editorSection!;
   const point={left:rect.left+window.scrollX,top:rect.top+window.scrollY},old=positions.current.get(id);
   next.set(id,point);
   if(old&&(old.left!==point.left||old.top!==point.top)&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    element.getAnimations().forEach(animation=>animation.cancel());
    element.animate([{transform:`translate(${old.left-point.left}px,${old.top-point.top}px)`},{transform:'translate(0,0)'}],{duration:180,easing:'ease-out'});
   }
  }
  positions.current=next;
 },[order.join('|')]);

 function swap(id:EditorSectionId,target:EditorSectionId){
  const {order,onChange,labels,ui}=latest.current,a=order.indexOf(id),b=order.indexOf(target);
  if(a<0||b<0||a===b)return;
  const next=[...order];[next[a],next[b]]=[next[b],next[a]];onChange(next);
  setAnnouncement(ui==='de'?`${labels[id]} und ${labels[target]} getauscht.`:`${labels[id]} swapped with ${labels[target]}.`);
  focusHandle(id);
 }
 function updateTarget(){
  const drag=session.current;if(!drag?.active)return;
  let target:EditorSectionId|null=null,best=Infinity;
  for(const element of headers()){
   const r=element.getBoundingClientRect();
   const dx=Math.max(r.left-drag.x,0,drag.x-r.right),dy=Math.max(r.top-drag.y,0,drag.y-r.bottom);
   // Only accept nearby headers, not blank space or fields in an expanded panel.
   if(dx>32||dy>36)continue;
   const distance=dx*dx+dy*dy;
   if(distance<best){best=distance;target=element.dataset.editorSection as EditorSectionId;}
  }
  drag.target=target;setFloating({...drag});
 }
 function finish(cancel=false){
  const drag=session.current;if(!drag)return;
  session.current=null;setFloating(null);
  if(list.current?.hasPointerCapture(drag.pointerId))list.current.releasePointerCapture(drag.pointerId);
  if(!cancel&&drag.active&&drag.target)swap(drag.id,drag.target);
  else focusHandle(drag.id);
 }
 useEffect(()=>{
  const cancel=(event:globalThis.KeyboardEvent)=>{if(event.key==='Escape'&&session.current){event.preventDefault();event.stopPropagation();finish(true);}};
  window.addEventListener('keydown',cancel,true);return()=>window.removeEventListener('keydown',cancel,true);
 },[]);
 useEffect(()=>{
  if(!floating)return;
  let frame:number;
  const tick=()=>{
   const drag=session.current;
   if(drag?.active){
    const height=document.documentElement.clientHeight,edge=48;
    const speed=drag.y<edge?-Math.min(14,(edge-drag.y)/3):drag.y>height-edge?Math.min(14,(drag.y-height+edge)/3):0;
    if(speed){window.scrollBy(0,speed);updateTarget();}
   }
   frame=requestAnimationFrame(tick);
  };
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
 },[!!floating]);

 function start(event:PointerEvent<HTMLButtonElement>,id:EditorSectionId){
  if(event.button!==0||!event.isPrimary||session.current)return;
  const rect=header(id)?.getBoundingClientRect();if(!rect||!list.current)return;
  event.preventDefault();event.currentTarget.focus({preventScroll:true});
  // Refresh positions after any expansion or scrolling since the previous reorder.
  positions.current=new Map(headers().map(element=>{const r=element.getBoundingClientRect();return [element.dataset.editorSection!,{left:r.left+window.scrollX,top:r.top+window.scrollY}];}));
  session.current={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,active:false,target:null};
  list.current.setPointerCapture(event.pointerId);
 }
 function keyDown(event:KeyboardEvent<HTMLButtonElement>,id:EditorSectionId){
  if(session.current)return;
  const {order}=latest.current,index=order.indexOf(id),items=headers();
  const columns=items.length>1&&Math.abs(items[0].getBoundingClientRect().top-items[1].getBoundingClientRect().top)<2?2:1;
  const offsets:Record<string,number>={ArrowLeft:-1,ArrowRight:1,ArrowUp:-columns,ArrowDown:columns};
  const destination=event.key==='Home'?0:event.key==='End'?order.length-1:index+offsets[event.key];
  if(Number.isNaN(destination))return;
  event.preventDefault();if(destination>=0&&destination<order.length)swap(id,order[destination]);
 }
 return {list,floating,announcement,start,keyDown,events:{
  onPointerMove:(event:PointerEvent<HTMLDivElement>)=>{
   const drag=session.current;if(!drag||drag.pointerId!==event.pointerId)return;
   drag.x=event.clientX;drag.y=event.clientY;
   if(!drag.active&&Math.hypot(drag.x-drag.startX,drag.y-drag.startY)<5)return;
   drag.active=true;updateTarget();
  },
  onPointerUp:(event:PointerEvent<HTMLDivElement>)=>{if(event.pointerId===session.current?.pointerId)finish();},
  onPointerCancel:()=>finish(true),onLostPointerCapture:()=>finish(true)
 }};
}
