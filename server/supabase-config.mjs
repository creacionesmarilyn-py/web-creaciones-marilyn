import {assertMarilynProjectUrl} from './project-target.mjs';

export function publicSupabaseConfig(env=process.env) {
  let url;
  try { url=new URL(env.SUPABASE_URL); } catch { throw new Error('Admin requires SUPABASE_URL'); }
  if(url.protocol!=='https:' || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) || url.pathname!=='/' || url.search || url.hash || url.username || url.password || url.port)throw new Error('Admin requires a hosted Supabase project URL');
  assertMarilynProjectUrl(url.origin);
  const key=env.SUPABASE_PUBLISHABLE_KEY ?? '';
  let valid=/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if(!valid){try{valid=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon' && key.split('.').length===3;}catch{valid=false;}}
  if(!valid)throw new Error('Admin requires a public publishable/anon key; secret and service_role keys must never be bundled');
  return {url:url.origin,key};
}
