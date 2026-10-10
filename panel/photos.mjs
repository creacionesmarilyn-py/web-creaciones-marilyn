// Only raster formats accepted; SVG and arbitrary uploads never enter public storage.
export async function optimizePhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Elegí una foto JPG, PNG o WebP.');
  if(file.size>12*1024*1024) throw new Error('Esta foto pesa más de 12 MB. Elegí una versión más pequeña.');
  let bitmap;
  try { bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}); }
  catch { throw new Error('No pudimos leer esta foto. Probá con otra imagen.'); }
  try {
    if(bitmap.width*bitmap.height>24000000) throw new Error('Esta foto es demasiado grande. Elegí una de hasta 24 megapíxeles.');
    const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
    if(!blob || blob.type!=='image/webp') throw new Error('Tu navegador no pudo preparar la foto. Probá con Chrome actualizado.');
    return blob;
  } finally { bitmap.close(); }
}
