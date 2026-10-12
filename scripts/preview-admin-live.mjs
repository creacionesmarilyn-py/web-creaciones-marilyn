import {buildAdmin} from './build-admin.mjs';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Real OAuth preview. Uses public configuration and the database's existing permissions.
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'.preview-panel/real');
if(!await buildAdmin(out))throw new Error('Set MARILYN_ADMIN_ENABLED=true and the public Supabase configuration');
const config=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
const headers=Object.fromEntries(config.headers.filter(rule=>['/(.*)','/gestion(.*)'].includes(rule.source)).flatMap(rule=>rule.headers.map(header=>[header.key,header.value])));
const files=new Map();
for(const [url,file,type] of [
  ['/gestion','gestion.html','text/html; charset=utf-8'],
  ['/gestion/panel.js','gestion/panel.js','text/javascript; charset=utf-8'],
  ['/gestion/panel.css','gestion/panel.css','text/css; charset=utf-8']
])files.set(url,{body:await fs.readFile(path.join(out,file)),type});
http.createServer((req,res)=>{
  if(!['localhost:4175','127.0.0.1:4175'].includes(req.headers.host)){res.writeHead(400);res.end();return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{...headers,Allow:'GET, HEAD'});res.end();return;}
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/'){res.writeHead(302,{...headers,Location:'/gestion'});res.end();return;}
  const file=files.get(pathname);
  res.writeHead(file?200:404,{...headers,'Content-Type':file?.type ?? 'text/plain'});
  res.end(req.method==='HEAD'?undefined:file?.body ?? 'Not found');
}).listen(4175,'127.0.0.1',()=>console.log('Real admin login preview: http://localhost:4175/gestion'));
