'use client';
import {Children,createContext,isValidElement,useContext,useEffect,useId,useRef,type ReactElement,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,GripVertical} from 'lucide-react';
import type {EditorSectionId,Lang} from '@/lib/model';
import {useEditorSectionDrag} from './use-editor-section-drag';
type SectionProps={id:string,title:string,icon:ReactNode,section:string,setSection:(id:string)=>void,children:ReactNode};
const DragContext=createContext<(ReturnType<typeof useEditorSectionDrag>&{ui:Lang})|null>(null);
export function EditorSections({children,order,onOrderChange,ui}:{children:ReactNode,order:EditorSectionId[],onOrderChange:(order:EditorSectionId[])=>void,ui:Lang}){
 const elements=Children.toArray(children).filter(isValidElement) as ReactElement<SectionProps>[];
 const ids=elements.map(element=>element.props.id as EditorSectionId);
 const completeOrder=[...order.filter(id=>ids.includes(id)),...ids.filter(id=>!order.includes(id))];
 const sections=completeOrder.map(id=>elements.find(element=>element.props.id===id)!);
 const labels=Object.fromEntries(elements.map(element=>[element.props.id,element.props.title]));
 const drag=useEditorSectionDrag(completeOrder,onOrderChange,labels,ui);
 return <DragContext.Provider value={{...drag,ui}}>
  <p className="field-hint editor-order-hint">{ui==='de'?'Ziehen Sie einen Griff auf eine andere Überschrift, um die Plätze zu tauschen.':'Drag a handle onto another section header to swap places.'}</p>
  <div ref={drag.list} className="profile-sections" {...drag.events}>{Array.from({length:Math.ceil(sections.length/2)},(_,row)=><div className="profile-section-pair" key={row}>{sections.slice(row*2,row*2+2)}</div>)}</div>
  <span className="sr-only" role="status" aria-live="polite">{drag.announcement}</span>
  {drag.floating&&createPortal(<div aria-hidden="true" className="editor-section-floating" style={{left:drag.floating.x-drag.floating.offsetX,top:drag.floating.y-drag.floating.offsetY,width:drag.floating.width,minHeight:drag.floating.height}}><GripVertical size={16}/><span>{labels[drag.floating.id]}</span></div>,document.body)}
 </DragContext.Provider>;
}
export function EditorSection({id,title,icon,section,setSection,children}:SectionProps){
 const drag=useContext(DragContext);
 const panelId=useId(),triggerId=useId(),open=section===id;
 const containerRef=useRef<HTMLElement>(null),wasOpen=useRef(open);
 useEffect(()=>{
  const expanded=open&&!wasOpen.current;
  wasOpen.current=open;
  if(!expanded)return;
  // Measure after the newly opened fields and the previous panel have settled.
  const frame=requestAnimationFrame(()=>{
   const sectionElement=containerRef.current;
   if(!sectionElement)return;
   const container=getComputedStyle(sectionElement).display==='contents'?sectionElement.parentElement!:sectionElement;
   const fits=container.getBoundingClientRect().height<=document.documentElement.clientHeight-32;
   container.scrollIntoView({
    behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',
    block:fits?'nearest':'start',inline:'nearest'
   });
  });
  return ()=>cancelAnimationFrame(frame);
 },[open]);
 return <section ref={containerRef} style={{scrollMarginBlock:16}} className={'profile-section'+(open?' is-open':'')}>
  <h2 data-editor-section={id} className={'profile-section-header'+(drag?.floating?.id===id?' editor-section-dragging':'')+(drag?.floating?.target===id&&drag.floating.id!==id?' editor-section-drop-target':'')}>
   {drag&&<button type="button" className="section-drag-handle editor-section-drag-handle" aria-label={drag.ui==='de'?`${title} zum Tauschen ziehen`:`Drag ${title} to swap places`} title={drag.ui==='de'?'Ziehen oder Pfeiltasten verwenden':'Drag or use the arrow keys'} onPointerDown={event=>drag.start(event,id as EditorSectionId)} onKeyDown={event=>drag.keyDown(event,id as EditorSectionId)}><GripVertical aria-hidden="true"/></button>}
   <button type="button" id={triggerId} className="profile-section-trigger" aria-expanded={open} aria-controls={panelId} onClick={()=>setSection(open?'':id)}>{icon}<span>{title}</span><ChevronDown className="profile-section-chevron" aria-hidden="true"/></button>
  </h2>
  <div id={panelId} role="region" aria-labelledby={triggerId} hidden={!open} className="profile-section-body">{open&&children}</div>
 </section>;
}
