import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',editor='22222222-2222-4222-8222-222222222222',outsider='33333333-3333-4333-8333-333333333333';
const category='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const changes={name:'Perlitas número 6',price:5500,category_id:category,available:true,visibility:'published',featured:false,images:['https://example.com/photo.webp']};

test('PostgreSQL enforces staff authorization, private data, immutable links, conflicts, revocation and photo ownership', async t=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant insert,select,update,delete on storage.objects to anon,authenticated;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 insert into auth.users(id) values('${owner}'),('${editor}'),('${outsider}');`);
 const migrations=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(migrations)).filter(name=>/_marilyn_(catalog|storage|policy_indexes)\.sql$/.test(name)).sort()) await db.exec(await readFile(new URL(file,migrations),'utf8'));
 await db.exec(`insert into marilyn_private.staff_members(user_id,role) values('${owner}','owner'),('${editor}','editor');
 insert into public.marilyn_categories(id,name,category_key,path) values('${category}','Perlas','perlas','/categorias/perlas');
 insert into public.marilyn_products(id,category_id,name,price,visibility,path) values('26','${category}','Perla original',5000,'published','/productos/perla-original'),('hidden','${category}','Hidden',5000,'hidden','/productos/hidden');
 insert into public.marilyn_product_internal values('26','{"cost":1000,"supplier":"PRIVATE"}');
 insert into public.marilyn_stores values('99999999-9999-4999-8999-999999999999','Another store',true);
 insert into public.marilyn_products(id,store_id,category_id,name,price,visibility,path) values('other','99999999-9999-4999-8999-999999999999','${category}','Other store',1000,'published','/productos/other-store');`);
 const as=async(role,id='')=>{await db.exec(`reset role; set role ${role};`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 const save=(id='26',version=1,data=changes)=>db.query('select * from public.marilyn_save_product($1,$2,$3::jsonb)',[id,version,JSON.stringify(data)]);
 await t.test('public RPCs use caller privileges and private functions cannot bypass authorization',async()=>{
  const functions=(await db.query("select p.proname,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'marilyn_%'")).rows;
  assert.equal(functions.length,4);assert.ok(functions.every(fn=>fn.prosecdef===false));
  await as('anon');
  assert.equal((await db.query('select marilyn_private.marilyn_staff_role() as role')).rows[0].role,null);
  for(const table of ['staff_members','site_state','audit_log']) await assert.rejects(db.query('select * from marilyn_private.'+table),/permission denied/);
  await assert.rejects(db.query('select marilyn_private.require_writer()'),/permission denied/);
  await assert.rejects(db.query('select marilyn_private.marilyn_staff_context()'),/permission denied/);
  await assert.rejects(db.query('select * from marilyn_private.marilyn_save_product(null,null,null)'),/permission denied/);
  await as('authenticated',outsider);
  await assert.rejects(db.query('select * from marilyn_private.marilyn_save_product(null,null,null)'),/CATALOG_FORBIDDEN/);
  await assert.rejects(db.query("select * from marilyn_private.marilyn_create_category('Unauthorized')"),/CATALOG_FORBIDDEN/);
  await as('authenticated');await assert.rejects(save(),/CATALOG_FORBIDDEN/);
 });
 await t.test('anonymous sees only published catalog and cannot read private data or write',async()=>{
  await as('anon');assert.deepEqual((await db.query('select id from marilyn_products order by id')).rows.map(x=>x.id),['26','other']);
  await assert.rejects(db.query('select * from marilyn_product_internal'),/permission denied/);
  await assert.rejects(save(),/permission denied/);
  await assert.rejects(db.query("update marilyn_products set price=1 where id='26'"),/permission denied/);
 });
 await t.test('ordinary account cannot turn profile metadata into administrator privileges',async()=>{
  await db.exec(`reset role; update auth.users set raw_user_meta_data='{"role":"owner","admin":true}' where id='${outsider}'`);
  await as('authenticated',outsider);
  assert.equal((await db.query('select marilyn_staff_role() as role')).rows[0].role,null);
  assert.deepEqual((await db.query('select * from marilyn_product_internal')).rows,[]);
  await assert.rejects(save(),/CATALOG_FORBIDDEN/);
  await assert.rejects(db.query(`insert into marilyn_private.staff_members values('${outsider}','owner',true,now())`),/permission denied/);
 });
 await t.test('activation gate blocks staff writes until migration is approved',async()=>{
  await as('authenticated',owner);await assert.rejects(save(),/CATALOG_NOT_ACTIVE/);
  await assert.rejects(db.query('update marilyn_private.site_state set writes_enabled=true'),/permission denied/);
  await db.exec('reset role; update marilyn_private.site_state set writes_enabled=true');
 });
 await t.test('editor can rename and change price without changing ID or shared path',async()=>{
  await as('authenticated',editor);
  assert.equal((await db.query("select id from marilyn_products where id='hidden'")).rows.length,1);
  assert.deepEqual((await db.query('select * from marilyn_product_internal')).rows,[]);
  const saved=(await save()).rows[0];assert.equal(saved.id,'26');assert.equal(saved.path,'/productos/perla-original');assert.equal(saved.price,5500);assert.equal(saved.version,2);
  await assert.rejects(save('other',1),/CATALOG_NOT_FOUND/);
  await assert.rejects(save('26',2,{...changes,role:'owner'}),/CATALOG_INVALID_FIELDS/);
  await assert.rejects(save('26',2,{...changes,path:'/productos/hijacked'}),/CATALOG_INVALID_FIELDS/);
  await assert.rejects(save('26',2,{...changes,price:-1}),/CATALOG_INVALID_PRODUCT/);
  await assert.rejects(save('26',2,{...changes,images:['javascript:alert(1)']}),/CATALOG_INVALID_IMAGE/);
  await assert.rejects(save('26',2,{...changes,images:[null]}),/CATALOG_INVALID_IMAGE/);
 });
 await t.test('stale edits fail and successful changes have a private audit trail',async()=>{
  await assert.rejects(save('26',1),/CATALOG_CONFLICT/);
  await db.exec('reset role');const audit=(await db.query('select actor_id,action,after_data from marilyn_private.audit_log')).rows;
  assert.equal(audit.length,1);assert.equal(audit[0].actor_id,editor);assert.equal(audit[0].after_data.price,5500);
  await as('authenticated',owner);assert.equal((await db.query('select legacy_data from marilyn_product_internal')).rows[0].legacy_data.cost,1000);
 });
 await t.test('hide removes public access and revoked staff cannot keep writing',async()=>{
  await save('26',2,{...changes,visibility:'hidden'});await as('anon');assert.equal((await db.query("select * from marilyn_products where id='26'")).rows.length,0);
  await db.exec(`reset role; update marilyn_private.staff_members set active=false where user_id='${editor}'`);
  await as('authenticated',editor);await assert.rejects(save('26',3),/CATALOG_FORBIDDEN/);
 });
 await t.test('new products/categories get server-generated routes and valid long names',async()=>{
  await as('authenticated',owner);const saved=(await save(null,null,{...changes,name:'Muchos colores y perlas '.repeat(8)})).rows[0];
  assert.match(saved.path,/^\/productos\/[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.equal((await db.query('select id from marilyn_products where id=$1',[saved.id])).rows.length,1);
  assert.equal((await db.query("select count(*)::int as total from marilyn_products where id not in ('26','hidden','other')")).rows[0].total,1);
  const first=(await db.query("select * from marilyn_create_category('Nueva categoría')")).rows[0];
  const second=(await db.query("select * from marilyn_create_category('nueva categoría')")).rows[0];assert.equal(first.id,second.id);assert.match(first.path,/^\/categorias\//);
 });
 await t.test('photo policy rejects strangers, impersonated folders, and overwrites',async()=>{
  const name=owner+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
  await as('authenticated',outsider);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('marilyn-catalog-images',$1)",[name]),/row-level security/);
  await as('authenticated',owner);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('marilyn-catalog-images',$1)",[outsider+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp']),/row-level security/);
  await db.query("insert into storage.objects(bucket_id,name) values('marilyn-catalog-images',$1)",[name]);
  assert.equal((await db.query("update storage.objects set name='overwrite.webp' returning id")).rows.length,0);
  assert.equal((await db.query('delete from storage.objects returning id')).rows.length,0);
 });
 await t.test('missing activation state fails closed',async()=>{
  await db.exec('reset role; delete from marilyn_private.site_state');
  await as('authenticated',owner);await assert.rejects(save('26',3),/CATALOG_NOT_ACTIVE/);
  assert.equal((await db.query('select marilyn_staff_context() as context')).rows[0].context.writes_enabled,false);
 });
 } finally { await db.close(); }
});
