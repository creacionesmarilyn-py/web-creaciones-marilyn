import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {projectSupabaseCatalog,fetchSupabaseCatalog} from '../server/supabase-catalog.mjs';
import {renderLivePage} from '../server/live-pages.mjs';
import {renderCatalogPhoto,downloadCatalogPhoto} from '../server/catalog-photo.mjs';
import {CATALOG_IMAGE_BASE,catalogImagePath} from '../lib/storage-images.mjs';
import photoHandler from '../api/catalog-photo.js';
import pageHandler from '../api/public-page.js';
const object='migration-'+'a'.repeat(64)+'.webp';
const row={id:'26',name:'Perla blanca',price:5000,available:true,visibility:'published',status:'normal',featured:false,popup:false,images:[CATALOG_IMAGE_BASE+object],path:'/productos/perla-blanca',marilyn_categories:{name:'Perlas',category_key:'perlas',path:'/categorias/perlas'}};
const env={SUPABASE_URL:'https://mskmfxkhfqimsmicuowv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'};

test('Supabase public projection hides withdrawn rows, raw fields and unsafe paths',()=>{
 const result=projectSupabaseCatalog([{...row,costo:123,supplier:'PRIVATE',legacy_data:{secret:'PRIVATE'}},{...row,id:'hidden',visibility:'hidden'}]);
 assert.equal(result.products.length,1);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.equal(result.routes.products['26'],row.path);
 assert.throws(()=>projectSupabaseCatalog([{...row,path:'/../private'}]),/Invalid/);
 assert.throws(()=>projectSupabaseCatalog([row,row]),/Invalid/);
 assert.throws(()=>projectSupabaseCatalog([{...row,marilyn_categories:null}]),/Invalid/);
 assert.ok(!JSON.stringify(projectSupabaseCatalog([{...row,images:['data:image/png;base64,AAAA']}])).includes('data:image'));
});

test('public reader paginates with only public key, fixed project and explicit projection; outages fail closed',async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url:String(url),headers:new Headers(options.headers)});
  const offset=Number(new URL(url).searchParams.get('offset'));
  return new Response(JSON.stringify(offset===0?Array.from({length:500},(_,i)=>({...row,id:String(i),path:'/productos/item-'+i})):[{...row,id:'500',path:'/productos/item-500'}]),{headers:{'content-type':'application/json'}});
 };
 const data=await fetchSupabaseCatalog(env,fetcher);
 assert.equal(data.products.length,501);assert.equal(calls.length,2);
 assert.ok(calls.every(call=>call.url.startsWith(env.SUPABASE_URL+'/rest/v1/marilyn_products?')&&call.headers.get('apikey')===env.SUPABASE_PUBLISHABLE_KEY));
 assert.ok(calls.every(call=>!new URL(call.url).searchParams.get('select').includes('*')));
 await assert.rejects(fetchSupabaseCatalog({...env,SUPABASE_URL:'https://other.supabase.co'},fetcher),/different Supabase/);
 await assert.rejects(fetchSupabaseCatalog(env,async()=>new Response('{}',{status:503})),/unavailable/);
});

test('live pages publish price/name/photo changes, new routes and withdrawals in HTML and sitemap',async()=>{
 const runtime={template:await fs.readFile(new URL('../index.html',import.meta.url),'utf8'),images:{},shares:{},fallbackShare:'/img/logo_jpg.jpg'};
 const first=projectSupabaseCatalog([row]);
 const html=renderLivePage(row.path,first,runtime);
 assert.equal(html.status,200);assert.ok(html.body.includes('5.000'));assert.ok(html.body.includes('/api/catalog-photo?'));
 const changed={...row,name:'</script><img src=x onerror=alert(1)>',price:7500,images:[CATALOG_IMAGE_BASE+'migration-'+'b'.repeat(64)+'.webp']};
 const newRow={...row,id:'new',name:'Nuevo producto',path:'/productos/nuevo',marilyn_categories:{name:'Nueva',category_key:'nueva',path:'/categorias/nueva'}};
 const next=projectSupabaseCatalog([changed,newRow]);
 const updated=renderLivePage(row.path,next,runtime);
 assert.ok(updated.body.includes('7.500'));assert.ok(!updated.body.includes('<img src=x'));assert.ok(updated.body.includes('&lt;img'));
 assert.equal(renderLivePage('/productos/nuevo',next,runtime).status,200);
 assert.equal(renderLivePage('/categorias/nueva',next,runtime).status,200);
 const sitemap=renderLivePage('/sitemap.xml',next,runtime).body;
 assert.ok(sitemap.includes('/productos/nuevo'));assert.ok(sitemap.includes('/categorias/nueva'));
 const hidden=projectSupabaseCatalog([{...changed,visibility:'hidden'},newRow]);
 assert.equal(renderLivePage(row.path,hidden,runtime).status,404);
 assert.equal(renderLivePage('/categorias/perlas',hidden,runtime).status,404);
 assert.ok(!renderLivePage('/sitemap.xml',hidden,runtime).body.includes(row.path));
 assert.ok(!renderLivePage('/',hidden,runtime).body.includes('Perla blanca'));
});

test('photo conversion only fetches this project bucket and creates real share JPEGs',async()=>{
 let requested;
 const input=await sharp({create:{width:20,height:30,channels:3,background:'white'}}).png().toBuffer();
 const fetcher=async(url,options)=>{requested={url,options};return new Response(input);};
 const bytes=await renderCatalogPhoto(object,'share',fetcher);
 assert.equal(requested.url,CATALOG_IMAGE_BASE+object);assert.equal(requested.options.redirect,'error');
 const metadata=await sharp(bytes).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,1200);assert.equal(metadata.height,630);
 await assert.rejects(downloadCatalogPhoto('../private',fetcher),/Invalid/);
 assert.equal(catalogImagePath('https://evil.example/'+object),'');
});

test('public endpoints reject unexpected paths, parameters and writes without fetching',async()=>{
 const response=()=>({code:0,headers:{},status(code){this.code=code;return this;},setHeader(key,value){this.headers[key]=value;return this;},end(){return this;}});
 for(const url of ['/api/catalog-photo?key=../private&kind=card','/api/catalog-photo?key='+object+'&kind=huge','/api/catalog-photo?key='+object+'&kind=card&extra=1']){
  const res=response();await photoHandler({url,method:'GET'},res);assert.equal(res.code,400);
 }
 for(const handler of [photoHandler,pageHandler]){const res=response();await handler({url:'/api/x',method:'POST'},res);assert.equal(res.code,405);}
 const res=response();await pageHandler({url:'/api/public-page?path=/.private-migration/a',method:'GET'},res);assert.equal(res.code,404);assert.equal(res.headers['Cache-Control'],'no-store');
});
