import fs from 'node:fs/promises';
import path from 'node:path';
import {publicCatalog,usesSupabase} from '../server/public-catalog.mjs';
import {renderLivePage} from '../server/live-pages.mjs';
let runtime;
export default async function handler(req,res){
  if(!['GET','HEAD'].includes(req.method))return res.status(405).setHeader('Allow','GET, HEAD').end();
  const url=new URL(req.url,'https://www.creacionesmarilyn.com.py');
  const route=url.searchParams.get('path') || (url.pathname==='/api/public-page'?'':url.pathname);
  if(!/^(?:\/|\/sitemap\.xml|\/(?:productos|categorias)\/[a-z0-9]+(?:-[a-z0-9]+)*)$/.test(route)||route.length>220||url.searchParams.getAll('path').length>1)return res.status(404).setHeader('Cache-Control','no-store').end();
  try{
    if(!usesSupabase())return res.status(404).setHeader('Cache-Control','no-store').end();
    runtime??=JSON.parse(await fs.readFile(path.join(process.cwd(),'.runtime-public/runtime.json'),'utf8'));
    const result=renderLivePage(route,await publicCatalog(),runtime);
    res.setHeader('Content-Type',result.type);
    res.setHeader('Cache-Control',result.status===200?'public, max-age=0, s-maxage=30':'no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    if(result.status!==200)res.setHeader('X-Robots-Tag','noindex');
    return res.status(result.status).end(req.method==='HEAD'?undefined:result.body);
  }catch{
    res.setHeader('Cache-Control','no-store');res.setHeader('Retry-After','30');
    return res.status(503).end(req.method==='HEAD'?undefined:'La tienda está temporalmente no disponible. Volvé a intentar en unos momentos.');
  }
}
