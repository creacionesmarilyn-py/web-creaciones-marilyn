import {STORAGE_OBJECT} from '../lib/storage-images.mjs';
import {renderCatalogPhoto} from '../server/catalog-photo.mjs';
export default async function handler(req,res) {
  if(!['GET','HEAD'].includes(req.method))return res.status(405).setHeader('Allow','GET, HEAD').end();
  const params=new URL(req.url,'https://www.creacionesmarilyn.com.py').searchParams;
  const key=params.get('key')||'',kind=params.get('kind')||'';
  if(params.size!==2||!STORAGE_OBJECT.test(key)||!['card','gallery','share'].includes(kind))return res.status(400).setHeader('Cache-Control','no-store').end();
  try{
    const bytes=await renderCatalogPhoto(key,kind);
    res.setHeader('Content-Type',kind==='share'?'image/jpeg':'image/webp');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Cache-Control','public, max-age=31536000, immutable');
    return res.status(200).end(req.method==='HEAD'?undefined:bytes);
  }catch(error){res.setHeader('Cache-Control','no-store');return res.status(error.status||502).end();}
}
