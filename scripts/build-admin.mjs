import {publicSupabaseConfig} from '../server/supabase-config.mjs';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export function adminConfig(env) {
  if(env.MARILYN_ADMIN_ENABLED!=='true')return null;
  return publicSupabaseConfig(env);
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
