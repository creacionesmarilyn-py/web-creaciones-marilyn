import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {usesSupabase} from '../server/public-catalog.mjs';
await import('./build.mjs');
if(usesSupabase()){
  const root=fileURLToPath(new URL('../',import.meta.url));
  const out=path.join(root,'dist'),snapshots=path.join(root,'.runtime-public/snapshots');
  // Vercel gives files precedence over rewrites. Keep build proofs outside public output.
  await fs.mkdir(snapshots,{recursive:true});
  for(const name of ['index.html','sitemap.xml']){
    await fs.copyFile(path.join(out,name),path.join(snapshots,name));await fs.unlink(path.join(out,name));
  }
  for(const kind of ['productos','categorias']){
    await fs.mkdir(path.join(snapshots,kind),{recursive:true});
    for(const name of await fs.readdir(path.join(out,kind))){
      if(!/^[a-z0-9-]+\.html$/.test(name))throw new Error('Unexpected public page file');
      await fs.copyFile(path.join(out,kind,name),path.join(snapshots,kind,name));await fs.unlink(path.join(out,kind,name));
    }
    await fs.rmdir(path.join(out,kind));
  }
  console.log('Hosting uses live HTML, categories and sitemap with a 30-second CDN cache.');
}
