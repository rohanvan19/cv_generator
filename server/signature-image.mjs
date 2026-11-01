export function prepareSignature(doc,signature){
 if(!signature?.enabled||!signature.image)return;
 try{
  const image=doc.openImage(signature.image);
  if(!(image.width>0&&image.height>0)||image.width*image.height>16000000)throw new Error('Invalid image dimensions');
  const scale=Math.min(150/image.width,55/image.height)*(signature.size??100)/100;
  return {image,width:image.width*scale,height:image.height*scale};
 }catch{throw Object.assign(new Error('Could not read the signature image. Upload a valid PNG or JPG.'),{status:400});}
}
