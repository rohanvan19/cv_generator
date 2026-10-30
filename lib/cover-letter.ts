import {z} from 'zod';

const addressFields={address:z.string().max(400),postalCode:z.string().max(30),city:z.string().max(200),country:z.string().max(100)};
const dateSchema=z.string().refine(value=>{
 if(!value)return true;
 if(!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value))return false;
 const parsed=new Date(value+'T12:00:00Z');
 return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===value;
},'Enter a valid date');
export const coverLetterTemplateSchema=z.object({
 sender:z.object({name:z.string().max(200),...addressFields,phone:z.string().max(100),email:z.string().max(300)}),
 recipient:z.object({company:z.string().max(300),attention:z.string().max(200),...addressFields}),
 date:dateSchema,subject:z.string().max(300),salutation:z.string().max(200),body:z.string().max(24000),closing:z.string().max(100),
 signature:z.object({enabled:z.boolean(),size:z.number().min(25).max(200).default(100),image:z.string().max(3000000).refine(value=>value===''||/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value),'Choose a PNG or JPG signature image')}).default({enabled:false,size:100,image:''}),
});
export type CoverLetterTemplate=z.infer<typeof coverLetterTemplateSchema>;
export function blankCoverLetterTemplate():CoverLetterTemplate{return {
 sender:{name:'',address:'',postalCode:'',city:'',country:'',phone:'',email:''},
 recipient:{company:'',attention:'',address:'',postalCode:'',city:'',country:''},
 date:'',subject:'',salutation:'Sehr geehrte Damen und Herren,',body:'',closing:'Mit freundlichen Grüßen',
 signature:{enabled:false,size:100,image:''},
};}
export function germanLetterDate(value:string){return value?new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z')):'';}
