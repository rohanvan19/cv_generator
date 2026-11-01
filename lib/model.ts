import { z } from 'zod';
import {coverLetterTemplateSchema,blankCoverLetterTemplate,signatureSchema} from './cover-letter.ts';
export const biSchema = z.object({ en:z.string().max(24000), de:z.string().max(24000) });
export type Bi = z.infer<typeof biSchema>;
export type Lang = 'en'|'de';
// Legacy school/location strings retain their original text as the English source.
const localizedShortText=(max:number)=>z.preprocess(value=>typeof value==='string'?{en:value,de:''}:value,z.object({en:z.string().max(max),de:z.string().max(max)}));
export const entrySectionIds=['experience','internships','education','projects','certifications'] as const;
export type EntrySection=(typeof entrySectionIds)[number];
export const sectionIds=['summary',...entrySectionIds,'skills','languages','interests'] as const;
export type BuiltinSectionId=(typeof sectionIds)[number];
export type CustomSectionId=`custom:${string}`;
export type SectionId=BuiltinSectionId|CustomSectionId;
export const employmentTypes=['','Full-time','Part-time','Internship'] as const;
export type EmploymentType=(typeof employmentTypes)[number];
export const defaultSectionOrder:SectionId[]=[...sectionIds];
export const defaultEditorSectionOrder=['personal','summary','signature','experience','internships','education','certifications','projects','skills','languages','interests'] as const;
export type EditorSectionId='personal'|'signature'|SectionId;
const editorSectionOrderSchema=z.array(z.union([z.enum(defaultEditorSectionOrder),z.templateLiteral(['custom:',z.string().regex(/^[A-Za-z0-9_-]{1,100}$/)])])).max(31).refine(order=>new Set(order).size===order.length,'Editor sections must be unique').default([...defaultEditorSectionOrder]);
const sectionOrderSchema=z.preprocess(value=>{
 // Add the new section to complete legacy orders without resetting the user's arrangement.
 if(Array.isArray(value)&&value.length===sectionIds.length-1&&new Set(value).size===value.length&&value.every(section=>section!=='internships'&&sectionIds.includes(section))){
  const order=[...value];order.splice(order.indexOf('experience')+1,0,'internships');return order;
 }
 return value;
},z.array(z.union([z.enum(sectionIds),z.templateLiteral(['custom:',z.string().regex(/^[A-Za-z0-9_-]{1,100}$/)])])).min(sectionIds.length).max(sectionIds.length+20).refine(order=>new Set(order).size===order.length&&sectionIds.every(id=>order.includes(id)),'Each built-in section must appear exactly once').default([...defaultSectionOrder]));
export const entrySchema = z.object({ id:z.string().max(100), title:biSchema, organization:localizedShortText(400), location:localizedShortText(400), employmentType:z.enum(employmentTypes).default(''), start:z.string().regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/), end:z.string().regex(/^(\d{4}-(0[1-9]|1[0-2]))?$/), current:z.boolean(), description:biSchema, included:z.boolean() });
export type Entry = z.infer<typeof entrySchema>;
const customSectionSchema=z.object({id:z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),title:biSchema,included:z.boolean(),entries:z.array(entrySchema).max(60)});
export type CustomSection=z.infer<typeof customSectionSchema>;
const photoData = z.string().max(4500000).refine(v=>v==='' || /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v),'Invalid photo');
const customPersonalFieldSchema=z.object({id:z.string().max(100),label:biSchema,value:biSchema,included:z.boolean()});
export const profileSchema = z.object({
 personal:z.object({name:z.string().max(200),email:z.string().max(300),phone:z.string().max(100),dateOfBirth:z.string().regex(/^(\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))?$/).default(''),location:localizedShortText(300),address:z.string().max(500),website:z.string().max(500),linkedin:z.string().max(500),customFields:z.array(customPersonalFieldSchema).max(20).default([])}),
 headline:biSchema,summary:biSchema,experience:z.array(entrySchema).max(60),internships:z.array(entrySchema).max(60).default([]),education:z.array(entrySchema).max(60),projects:z.array(entrySchema).max(60),certifications:z.array(entrySchema).max(60),
 customSections:z.array(customSectionSchema).max(20).default([]),
 skills:z.array(z.object({id:z.string().max(100),category:z.object({en:z.string().max(500),de:z.string().max(500)}).default({en:'',de:''}),name:biSchema,included:z.boolean()})).max(150),
 languages:z.array(z.object({id:z.string().max(100),name:biSchema,level:z.enum(['A1','A2','B1','B2','C1','C2','Native']),included:z.boolean()})).max(30),interests:biSchema,
 signature:signatureSchema,
 photo:z.object({original:photoData,cropped:photoData,x:z.number().min(0).max(100),y:z.number().min(0).max(100),zoom:z.number().min(1).max(3)}),
 settings:z.object({documentTitle:z.object({en:z.string().max(120),de:z.string().max(120)}).default({en:'CURRICULUM VITAE',de:'LEBENSLAUF'}),language:z.enum(['en','de']),showPhoto:z.boolean(),compact:z.boolean(),showInterests:z.boolean(),showSummary:z.boolean(),fontFamily:z.enum(['inter','arial','times']).default('inter'),fontSize:z.number().int().min(8).max(12).default(10),sectionOrder:sectionOrderSchema,editorSectionOrder:editorSectionOrderSchema})
}).superRefine((profile,ctx)=>{
 const ids=profile.customSections.map(section=>customSectionKey(section.id));
 if(new Set(ids).size!==ids.length)ctx.addIssue({code:'custom',path:['customSections'],message:'Custom section identifiers must be unique'});
 const orderedIds=profile.settings.sectionOrder.filter(id=>id.startsWith('custom:'));
 if(ids.length!==orderedIds.length||orderedIds.some(id=>!ids.includes(id as CustomSectionId)))ctx.addIssue({code:'custom',path:['settings','sectionOrder'],message:'Every custom section must appear exactly once in the section order'});
});
export type Profile=z.infer<typeof profileSchema>;
// Legacy jobDescription text is retained for backup compatibility only; new drafts do not create or use it.
export const applicationSchema=z.object({id:z.string().max(100),company:z.string().max(300),role:z.string().max(300),jobDescription:z.string().max(40000).optional(),status:z.enum(['Draft','Applied','Interview','Offer','Closed']),createdAt:z.string().max(60),draft:profileSchema,coverLetter:biSchema});
export type Application=z.infer<typeof applicationSchema>;
const aiSettingsSchema=z.object({provider:z.enum(['auto','openai','ollama']),ollamaModel:z.string().max(200)});
export const workspaceSchema=z.object({version:z.literal(1),profile:profileSchema,coverLetterTemplate:coverLetterTemplateSchema.default(blankCoverLetterTemplate),applications:z.array(applicationSchema).max(100),uiLanguage:z.enum(['en','de']),aiSettings:aiSettingsSchema.default({provider:'auto',ollamaModel:''})});
export type Workspace=z.infer<typeof workspaceSchema>;
export const bi=(en='',de=''):Bi=>({en,de});
export const newId=()=>globalThis.crypto.randomUUID();
export const customSectionKey=(id:string):CustomSectionId=>`custom:${id}`;
export function newCustomSection(title:Bi=bi()):CustomSection{return {id:newId(),title,included:true,entries:[]};}
export function addCustomSection(profile:Profile,section:CustomSection):Profile{return {...profile,customSections:[...profile.customSections,section],settings:{...profile.settings,sectionOrder:[...profile.settings.sectionOrder,customSectionKey(section.id)],editorSectionOrder:[...profile.settings.editorSectionOrder,customSectionKey(section.id)]}};}
export function removeCustomSection(profile:Profile,id:string):Profile{return {...profile,customSections:profile.customSections.filter(section=>section.id!==id),settings:{...profile.settings,sectionOrder:profile.settings.sectionOrder.filter(key=>key!==customSectionKey(id)),editorSectionOrder:profile.settings.editorSectionOrder.filter(key=>key!==customSectionKey(id))}};}
export function entryGroups(profile:Profile){return [...entrySectionIds.map(id=>({id:id as EntrySection|CustomSectionId,entries:profile[id],included:true})),...profile.customSections.map(section=>({id:customSectionKey(section.id),entries:section.entries,included:section.included}))];}
export function sectionLabel(profile:Profile,id:SectionId,lang:Lang):string{return id.startsWith('custom:')?text(profile.customSections.find(section=>customSectionKey(section.id)===id)?.title||bi(),lang)||(lang==='de'?'Eigener Abschnitt':'Custom section'):cvLabels[lang][id as BuiltinSectionId];}
export function blankProfile():Profile{return {personal:{name:'',email:'',phone:'',dateOfBirth:'',location:bi(),address:'',website:'',linkedin:'',customFields:[]},headline:bi(),summary:bi(),customSections:[],experience:[],internships:[],education:[],projects:[],certifications:[],skills:[],languages:[],interests:bi(),photo:{original:'',cropped:'',x:50,y:50,zoom:1},signature:{enabled:false,size:100,image:''},settings:{documentTitle:{en:'CURRICULUM VITAE',de:'LEBENSLAUF'},language:'de',showPhoto:true,compact:false,showInterests:true,showSummary:true,fontFamily:'inter',fontSize:10,sectionOrder:[...defaultSectionOrder],editorSectionOrder:[...defaultEditorSectionOrder]}};}
export function blankWorkspace():Workspace{return {version:1,profile:blankProfile(),coverLetterTemplate:blankCoverLetterTemplate(),applications:[],uiLanguage:'en',aiSettings:{provider:'auto',ollamaModel:''}};}
export function newEntry(employmentType:EmploymentType=''):Entry{return {id:newId(),title:bi(),organization:bi(),location:bi(),employmentType,start:'',end:'',current:false,description:bi(),included:true};}
export function newApplication(profile:Profile,company='',role=''):Application{return {id:newId(),company,role,status:'Draft',createdAt:new Date().toISOString(),draft:structuredClone(profile),coverLetter:bi()};}
export function duplicateApplication(source:Application,company:string,role:string):Application{return {...structuredClone(source),id:newId(),company,role,status:'Draft',createdAt:new Date().toISOString()};}
export const text=(value:Bi,lang:Lang)=>value[lang]||value[lang==='en'?'de':'en'];
export function ordered(entries:Entry[]){return entries.filter(e=>e.included).toSorted((a,b)=>((b.current?'9999':b.end||b.start).localeCompare(a.current?'9999':a.end||a.start))||b.start.localeCompare(a.start));}
export function dateRange(e:Entry,lang:Lang){const format=(s:string)=>s?s.slice(5)+'/'+s.slice(0,4):'';return [format(e.start),e.current?(lang==='de'?'heute':'Present'):format(e.end)].filter(Boolean).join(' - ');}
export function formatBirthDate(value:string){const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value||'');return match?match[3]+'. '+match[2]+'. '+match[1]:'';}
export function employmentTypeLabel(value:EmploymentType,lang:Lang){if(!value)return '';const labels={en:{'Full-time':'Full-time','Part-time':'Part-time',Internship:'Internship'},de:{'Full-time':'Vollzeit','Part-time':'Teilzeit',Internship:'Praktikum'}} as const;return labels[lang][value];}
export function missingTranslations(p:Profile,lang:Lang){const pairs=[p.headline,p.personal.location,...p.personal.customFields.filter(f=>f.included&&(f.value.en||f.value.de)).flatMap(f=>[f.label,f.value]),...(p.settings.showSummary?[p.summary]:[]),...p.customSections.filter(s=>s.included&&s.entries.some(e=>e.included)).map(s=>s.title),...entryGroups(p).filter(s=>s.included).flatMap(s=>s.entries.filter(e=>e.included).flatMap(e=>[e.title,e.organization,e.location,e.description])),...p.skills.filter(e=>e.included).flatMap(e=>[e.category,e.name]),...p.languages.filter(e=>e.included).map(e=>e.name),...(p.settings.showInterests?[p.interests]:[])];return pairs.filter(v=>!v[lang].trim() && v[lang==='en'?'de':'en'].trim()).length;}
export type ProfileChangeSection='personal'|'headline'|'summary'|'interests'|SectionId;
export type ProfileChange={key:string,section:ProfileChangeSection,label:string,before:string,after:string,source:string};
export function profileTextFields(profile:Profile,lang:Lang='en'){
 const fields:{key:string,section:ProfileChangeSection,label:string,value:Bi}[]=[];
 const add=(key:string,section:ProfileChangeSection,label:string,value:Bi)=>fields.push({key,section,label,value});
 add('personal:location','personal',lang==='de'?'Ort, Land':'City, country',profile.personal.location);
 add('headline','headline',lang==='de'?'Berufsbezeichnung':'Professional title',profile.headline);
 add('summary','summary',lang==='de'?'Kurzprofil':'Summary',profile.summary);
 add('interests','interests',lang==='de'?'Interessen':'Interests',profile.interests);
 for(const field of profile.personal.customFields){
  const label=text(field.label,lang)||(lang==='de'?'Persönliche Angabe':'Personal detail');
  add('personal:'+field.id+':label','personal',label+' · '+(lang==='de'?'Feldtitel':'Field title'),field.label);
  add('personal:'+field.id+':value','personal',label+' · '+(lang==='de'?'Wert':'Value'),field.value);
 }
 for(const custom of profile.customSections)add(customSectionKey(custom.id)+':title',customSectionKey(custom.id),text(custom.title,lang)||(lang==='de'?'Abschnittstitel':'Section title'),custom.title);
 for(const group of entryGroups(profile))for(const entry of group.entries){
  const section=group.id;
  const label=text(entry.title,lang)||text(entry.organization,lang)||section;
  add(section+':'+entry.id+':title',section,label+' · '+(lang==='de'?'Titel':'Title'),entry.title);
  add(section+':'+entry.id+':organization',section,label+' · '+(section==='education'?(lang==='de'?'Hochschule / Schule':'University / school'):(lang==='de'?'Organisation':'Organization')),entry.organization);
  add(section+':'+entry.id+':location',section,label+' · '+(lang==='de'?'Ort, Land':'City, country'),entry.location);
  add(section+':'+entry.id+':description',section,label+' · '+(lang==='de'?'Beschreibung':'Description'),entry.description);
 }
 for(const skill of profile.skills){
  const label=text(skill.category,lang)||text(skill.name,lang)||(lang==='de'?'Kenntnisse':'Skills');
  add('skills:'+skill.id+':category','skills',label+' · '+(lang==='de'?'Kategorie':'Category'),skill.category);
  add('skills:'+skill.id+':name','skills',label+' · '+(lang==='de'?'Kenntnisse':'Skills'),skill.name);
 }
 for(const language of profile.languages)add('languages:'+language.id+':name','languages',text(language.name,lang)||(lang==='de'?'Sprache':'Language'),language.name);
 return fields;
}
export function profileChanges(before:Profile,after:Profile,lang:Lang){
 const suggested=new Map(profileTextFields(after,lang).map(field=>[field.key,field.value]));
 return profileTextFields(before,lang).flatMap(({key,section,label,value}):ProfileChange[]=>{
  const next=suggested.get(key);
  return next&&value[lang]!==next[lang]?[{key,section,label,before:value[lang],after:next[lang],source:value[lang==='de'?'en':'de']}]:[];
 });
}
export function applyProfileChanges(before:Profile,after:Profile,acceptedKeys:Iterable<string>,targetLanguage?:Lang){
 const accepted=new Set(acceptedKeys);const next=structuredClone(before);
 const suggested=new Map(profileTextFields(after).map(field=>[field.key,field.value]));
 for(const field of profileTextFields(next)){
  const source=suggested.get(field.key);
  if(!accepted.has(field.key)||!source)continue;
  if(targetLanguage)field.value[targetLanguage]=source[targetLanguage];
  else {field.value.en=source.en;field.value.de=source.de;}
 }
 return profileSchema.parse(next);
}
export const cvLabels={en:{cv:'CURRICULUM VITAE',summary:'Profile',experience:'Professional experience',internships:'Internships',education:'Education',projects:'Projects',certifications:'Certifications',skills:'Skills',languages:'Languages',interests:'Interests',native:'Native',page:'Page',continued:'continued'},de:{cv:'LEBENSLAUF',summary:'Kurzprofil',experience:'Berufserfahrung',internships:'Praktika',education:'Ausbildung',projects:'Projekte',certifications:'Zertifikate & Weiterbildungen',skills:'Kenntnisse & Fähigkeiten',languages:'Sprachkenntnisse',interests:'Interessen',native:'Muttersprache',page:'Seite',continued:'Fortsetzung'}};
export function demoProfile():Profile{const p=blankProfile();p.personal={name:'Alex Morgan',email:'alex@example.com',phone:'+49 151 12345678',dateOfBirth:'1992-06-15',location:bi('Berlin, Germany','Berlin, Deutschland'),address:'',website:'https://example.com',linkedin:'',customFields:[]};p.headline=bi('Software Engineer','Softwareentwickler');p.summary=bi('Software engineer building practical tools for data analysis and automation.','Softwareentwickler mit Schwerpunkt auf Datenanalyse und Automatisierung.');p.experience=[{...newEntry(),employmentType:'Full-time',title:bi('Software Engineer','Softwareentwickler'),organization:bi('Example Engineering GmbH','Example Engineering GmbH'),location:bi('Berlin','Berlin'),start:'2023-04',current:true,description:bi('Developed Python tools for automated data analysis.\nCollaborated with a cross-functional team on software delivery.','Python-Werkzeuge zur automatisierten Datenanalyse entwickelt.\nMit einem interdisziplinären Team an der Softwarebereitstellung gearbeitet.')}];p.education=[{...newEntry(),title:bi('M.Sc. Computer Science','M.Sc. Informatik'),organization:bi('Example University','Beispieluniversität'),location:bi('Berlin','Berlin'),start:'2020-10',end:'2023-03',description:bi('Focus: software engineering and machine learning.','Schwerpunkte: Softwareentwicklung und maschinelles Lernen.')}];p.skills=[{id:newId(),category:bi('Programming','Programmierung'),name:bi('Python, SQL','Python, SQL'),included:true},{id:newId(),category:bi('Tools','Werkzeuge'),name:bi('Git, Docker','Git, Docker'),included:true}];p.languages=[{id:newId(),name:bi('English','Englisch'),level:'C1',included:true},{id:newId(),name:bi('German','Deutsch'),level:'B2',included:true}];p.interests=bi('Hiking, photography','Wandern, Fotografie');return p;}
