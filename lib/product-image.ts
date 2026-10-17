/** Resize on the user's device before uploading. No image bytes go through our server. */
export async function prepareProductImage(source:File):Promise<{file:File;width:number;height:number;originalBytes:number}> {
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(source.type)||source.size>10000000)
    throw new Error('აირჩიეთ JPG, PNG, WEBP ან AVIF ფოტო, მაქსიმუმ 10MB.');
  let image:ImageBitmap;
  try{image=await createImageBitmap(source,{imageOrientation:'from-image'})}catch{throw new Error('ფოტო ვერ დამუშავდა. სცადეთ სხვა JPG, PNG ან WEBP ფაილი.');}
  try{
    const maxEdge=1600,targetBytes=400*1024;
    if(source.size<=targetBytes&&Math.max(image.width,image.height)<=maxEdge)
      return {file:source,width:image.width,height:image.height,originalBytes:source.size};
    const scale=Math.min(1,maxEdge/Math.max(image.width,image.height));
    let width=Math.max(1,Math.round(image.width*scale)),height=Math.max(1,Math.round(image.height*scale));
    const canvas=document.createElement('canvas');let best:Blob|null=null;
    for(let attempt=0;attempt<8;attempt++){
      canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('ფოტოს დამუშავება ვერ შესრულდა.');
      ctx.drawImage(image,0,0,width,height);
      const quality=attempt%3===0?.84:attempt%3===1?.74:.64;
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('ფოტოს დამუშავება ვერ შესრულდა.')),'image/webp',quality));
      best=blob;if(blob.size<=targetBytes)break;
      if(attempt%3===2){width=Math.max(1,Math.round(width*.85));height=Math.max(1,Math.round(height*.85))}
    }
    if(!best)throw new Error('ფოტოს დამუშავება ვერ შესრულდა.');
    // Avoid making an already-compressed image heavier when resizing does not help.
    if(best.size>=source.size&&Math.max(image.width,image.height)<=maxEdge)return {file:source,width:image.width,height:image.height,originalBytes:source.size};
    const extension=best.type==='image/webp'?'.webp':'.png';
    return {file:new File([best],source.name.replace(/\.[^.]+$/,'')+extension,{type:best.type}),width,height,originalBytes:source.size};
  }finally{image.close()}
}
