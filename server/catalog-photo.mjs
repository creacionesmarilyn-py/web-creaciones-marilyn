import sharp from 'sharp';
import {CATALOG_IMAGE_BASE,STORAGE_OBJECT} from '../lib/storage-images.mjs';
export async function downloadCatalogPhoto(key,fetcher=fetch) {
  if(!STORAGE_OBJECT.test(key))throw new Error('Invalid catalog photo key');
  const response=await fetcher(CATALOG_IMAGE_BASE+key,{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok){const error=new Error('Catalog photo unavailable');error.status=response.status===404?404:502;throw error;}
  const parts=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>8388608)throw new Error('Catalog photo too large');parts.push(chunk);}
  return Buffer.concat(parts);
}
export async function renderCatalogPhoto(key,kind,fetcher=fetch) {
  const bytes=await downloadCatalogPhoto(key,fetcher);
  const photo=sharp(bytes,{limitInputPixels:24000000,animated:false}).rotate();
  if(kind==='share')return photo.resize(1200,630,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:82,mozjpeg:true}).toBuffer();
  return photo.resize({width:kind==='card'?600:1200,height:kind==='card'?600:1200,fit:'inside',withoutEnlargement:true}).webp({quality:78}).toBuffer();
}
