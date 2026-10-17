// Only raster formats accepted; SVG and arbitrary uploads never enter public storage.
export function photoExtension(type) {
  const extension={'image/webp':'webp','image/jpeg':'jpg','image/png':'png'}[type];
  if(!extension) throw new Error('Elegí una foto JPG, PNG o WebP.');
  return extension;
}
export async function optimizePhoto(file) {
  photoExtension(file.type);
  if(file.size>12*1024*1024) throw new Error('Esta foto pesa más de 12 MB. Elegí una versión más pequeña.');
  let bitmap;
  try { bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch { throw new Error('No pudimos leer esta foto. Probá con otra imagen.'); }
  let canvas;
  try {
    if(bitmap.width*bitmap.height>24000000) throw new Error('Esta foto es demasiado grande. Elegí una de hasta 24 megapíxeles.');
    const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');
    if(!context) throw new Error('No pudimos preparar la foto. Cerrá otras pestañas e intentá de nuevo.');
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const encode=type=>new Promise(resolve=>canvas.toBlob(resolve,type,0.82));
    let blob=await encode('image/webp');
    // Safari can decode WebP without being able to encode it. Canvas then returns PNG.
    // Use JPEG for camera photos; retain PNG transparency for other raster inputs.
    if(blob?.type!=='image/webp') {
      if(file.type==='image/jpeg') blob=await encode('image/jpeg');
      else if(blob?.type!=='image/png') blob=await encode('image/png');
    }
    if(!blob?.size || !['image/webp','image/jpeg','image/png'].includes(blob.type)) throw new Error('No pudimos preparar la foto. Intentá de nuevo o elegí otra imagen.');
    if(blob.size>8*1024*1024) throw new Error('La foto preparada pesa demasiado. Elegí una versión más pequeña.');
    return blob;
  } finally { bitmap.close();if(canvas){canvas.width=0;canvas.height=0;} }
}
