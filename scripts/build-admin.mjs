import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function adminConfig(env) {
  if(env.MARILYN_ADMIN_ENABLED!=='true')return null;
  let url;try{url=new URL(env.SUPABASE_URL);}catch{throw new Error('Admin requires SUPABASE_URL');}
  if(url.protocol!=='https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.pathname!=='/' || url.search || url.hash || url.username || url.password || url.port)throw new Error('Admin requires a hosted Supabase project URL');
  const key=env.SUPABASE_PUBLISHABLE_KEY ?? '';
  let valid=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!valid){try{valid=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon' && key.split('.').length===3;}catch{valid=false;}}
  if(!valid)throw new Error('Admin requires a public publishable/anon key; secret and service_role keys must never be bundled');
  return {url:url.origin,key};
}
export async function buildAdmin(out,env=process.env) {
  const config=adminConfig(env);if(!config)return false;
  const assets=path.join(out,'gestion');await fs.mkdir(assets,{recursive:true});
  await fs.copyFile(path.join(root,'panel/index.html'),path.join(out,'gestion.html'));
  await fs.copyFile(path.join(root,'panel/panel.css'),path.join(assets,'panel.css'));
  await build({entryPoints:[path.join(root,'panel/main.mjs')],outfile:path.join(assets,'panel.js'),bundle:true,minify:true,format:'esm',target:['es2022'],sourcemap:false,
    define:{__SUPABASE_URL__:JSON.stringify(config.url),__SUPABASE_PUBLISHABLE_KEY__:JSON.stringify(config.key)}});
  console.log('Prepared /gestion with public Supabase configuration. Database write gate remains independent.');return true;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await buildAdmin(path.join(root,'dist'));
