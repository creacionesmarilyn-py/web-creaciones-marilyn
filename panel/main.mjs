import {createClient} from '@supabase/supabase-js';
import {createCatalogAdapter} from './adapter.mjs';
import {mountPanel} from './app.mjs';
const client=createClient(__SUPABASE_URL__,__SUPABASE_PUBLISHABLE_KEY__,{
  auth:{flowType:'pkce',storage:sessionStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'marilyn-team-session'}
});
mountPanel(createCatalogAdapter(client));
