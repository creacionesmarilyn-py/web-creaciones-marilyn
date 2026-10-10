import {adminPreviewHeaders} from '../server/admin-preview.mjs';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import http from 'node:http';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {imageForDisplay} from '../lib/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const html=await fs.readFile(new URL('../dist/index.html',import.meta.url),'utf8').catch(()=>{throw new Error('Run npm run build first to prepare the public catalog for this preview');});
const seed=JSON.parse(html.match(/<script[^>]*id="catalog-data"[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '{}');
if(!seed.products?.length)throw new Error('No public catalog available for preview');
const categories=[...new Set(seed.products.map(p=>p.collection))].map(name=>({id:randomUUID(),name}));
const products=seed.products.filter(p=>!p.popup).map(p=>({id:p.id,name:p.name,price:p.price,category_id:categories.find(c=>c.name===p.collection).id,category_name:p.collection,available:p.available,visibility:'published',featured:p.destacado,version:1,path:seed.routes.products[p.id],images:p.images.map(photo=>new URL(imageForDisplay(photo,seed.images), 'https://www.creacionesmarilyn.com.py').href)}));
const built=await build({entryPoints:[root+'panel/demo.mjs'],bundle:true,minify:false,format:'esm',target:['es2022'],write:false});
const demoHtml=await fs.readFile(new URL('../panel/index.html',import.meta.url));
const files=new Map([
 ['/gestion',{type:'text/html; charset=utf-8',body:demoHtml}],
 ['/gestion/panel.js',{type:'text/javascript; charset=utf-8',body:built.outputFiles[0].contents}],
 ['/gestion/panel.css',{type:'text/css; charset=utf-8',body:await fs.readFile(new URL('../panel/panel.css',import.meta.url))}],
 ['/demo-catalog.json',{type:'application/json',body:JSON.stringify({products,categories})}]
]);
const config=JSON.parse(await fs.readFile(new URL('../vercel.json',import.meta.url)));
const headers=adminPreviewHeaders(config);
http.createServer((req,res)=>{
 if(!['localhost:4174','127.0.0.1:4174'].includes(req.headers.host)){res.writeHead(400);res.end();return;}
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/'){res.writeHead(302,{Location:'/gestion'});res.end();return;}
 const file=files.get(pathname);res.writeHead(file?200:404,{...headers,'Content-Type':file?.type ?? 'text/plain'});res.end(file?.body ?? 'Not found');
}).listen(4174,'127.0.0.1',()=>console.log('Admin demo (no real writes): http://localhost:4174/gestion'));
