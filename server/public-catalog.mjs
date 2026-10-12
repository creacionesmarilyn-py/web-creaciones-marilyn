import {liveCatalog} from './catalog-source.mjs';
import {liveSupabaseCatalog} from './supabase-catalog.mjs';
export function usesSupabase(env=process.env) {
  const source=env.MARILYN_CATALOG_SOURCE || 'firebase';
  if(!['firebase','supabase'].includes(source))throw new Error('Invalid MARILYN_CATALOG_SOURCE');
  return source==='supabase';
}
export function publicCatalog(){return usesSupabase()?liveSupabaseCatalog():liveCatalog();}
