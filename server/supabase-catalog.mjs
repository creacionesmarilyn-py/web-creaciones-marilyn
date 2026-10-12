import {createClient} from '@supabase/supabase-js';
import {publicSupabaseConfig} from './supabase-config.mjs';
import {publishedRoutes,registerRoutes} from './routes.mjs';
import {categoryKey} from '../lib/links.mjs';
import {safeImageUrl,FALLBACK_IMAGE} from '../lib/catalog.mjs';

const FIELDS='id,name,price,available,visibility,status,featured,popup,images,path,marilyn_categories!inner(name,category_key,path)';
export function projectSupabaseCatalog(rows) {
  const products=[],registry={products:Object.create(null),categories:Object.create(null)},ids=new Set();
  for(const row of rows){
    const category=row.marilyn_categories;
    if(row.visibility!=='published')continue;
    if(!category || category.category_key!==categoryKey(category.name) || ids.has(row.id))throw new Error('Invalid public catalog relationship');
    if(!Number.isSafeInteger(row.price)||row.price<0)throw new Error('Invalid public price');
    ids.add(row.id);
    registry.products[row.id]=row.path;
    if(registry.categories[category.category_key] && registry.categories[category.category_key]!==category.path)throw new Error('Inconsistent category route');
    registry.categories[category.category_key]=category.path;
    products.push({id:String(row.id),name:String(row.name),price:row.price,collection:category.name,status:String(row.status),
      destacado:row.featured===true,popup:row.popup===true,available:row.available===true,
      images:row.images?.length?row.images.map(value=>/^https:\/\//.test(String(value))?safeImageUrl(value):FALLBACK_IMAGE):[FALLBACK_IMAGE]});
  }
  registerRoutes([],registry); // Reject unsafe or conflicting canonical paths.
  products.sort((a,b)=>b.id.localeCompare(a.id,'en',{numeric:true}));
  return {products,routes:publishedRoutes(products,registry),updatedAt:new Date().toISOString()};
}
export async function fetchSupabaseCatalog(env=process.env,fetcher=fetch) {
  const config=publicSupabaseConfig(env);
  // A fresh anonymous client: never accept a visitor's token or use privileged keys.
  const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:fetcher}});
  const rows=[];
  for(let from=0;from<50000;from+=500){
    const {data,error}=await client.from('marilyn_products').select(FIELDS)
      .eq('store_id','00000000-0000-4000-8000-000000000001').eq('visibility','published')
      .order('id',{ascending:false}).range(from,from+499).abortSignal(AbortSignal.timeout(15000));
    if(error)throw new Error('Public Supabase catalog unavailable');
    rows.push(...data);
    if(data.length<500)return projectSupabaseCatalog(rows);
  }
  throw new Error('Catalog exceeds page limit');
}
let cached,pending;
export async function liveSupabaseCatalog() {
  if(cached && cached.expires>Date.now())return cached.value;
  if(!pending)pending=fetchSupabaseCatalog().then(value=>{cached={value,expires:Date.now()+10000};return value;}).finally(()=>{pending=null;});
  return pending;
}
