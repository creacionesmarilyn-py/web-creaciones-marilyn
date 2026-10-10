import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogAdapter} from '../panel/adapter.mjs';
const ok=data=>({data,error:null});

test('adapter verifies the user and obtains privileges from the server, never profile metadata',async()=>{
  let verified=false;
  const client={auth:{getSession:async()=>ok({session:{user:{user_metadata:{role:'owner'}}}}),getUser:async()=>{verified=true;return ok({user:{id:'user-1',email:'ordinary@example.com'}});}},rpc:async(name)=>{assert.equal(name,'marilyn_staff_context');assert.equal(verified,true);return ok({role:null,writes_enabled:false});}};
  assert.deepEqual(await createCatalogAdapter(client).session(),{id:'user-1',email:'ordinary@example.com',role:null,writable:false});
  client.auth.getUser=async()=>({error:new Error('Invalid JWT')});
  await assert.rejects(createCatalogAdapter(client).session(),/Invalid JWT/);
});

test('catalog pagination reads every product and restricts the store and selected fields',async()=>{
  const calls=[];
  const client={from:table=>{
    const record={table,filters:[]};calls.push(record);
    const query={select:columns=>{record.columns=columns;return query;},eq:(...filter)=>{record.filters.push(filter);return query;},order:()=>query,range:async(from,to)=>{
      record.from=from;record.to=to;
      return ok(table==='marilyn_categories'?[{id:'category',name:'Perlas'}]:Array.from({length:from===0?500:3},(_,i)=>({id:String(from+i),category_id:'category'})));
    }};return query;
  }};
  const data=await createCatalogAdapter(client).catalog();assert.equal(data.products.length,503);assert.equal(data.products[502].category_name,'Perlas');
  const products=calls.filter(c=>c.table==='marilyn_products');assert.equal(products.length,2);
  for(const call of products){assert.deepEqual(call.filters,[['store_id','00000000-0000-4000-8000-000000000001'],['popup',false]]);assert.doesNotMatch(call.columns,/legacy_data|supplier|cost|\*/);}
});

test('saves use a verified account, the immutable product ID and the expected version',async()=>{
  let payload,verified=false;
  const client={auth:{getUser:async()=>{verified=true;return ok({user:{id:'editor'}});}},rpc:async(name,args)=>{assert.equal(verified,true);assert.equal(name,'marilyn_save_product');payload=args;return ok({id:'26',version:8});}};
  const result=await createCatalogAdapter(client).save({id:'26',version:7},{name:'Perlitas',price:5500});
  assert.deepEqual(payload,{p_id:'26',p_expected_version:7,p_changes:{name:'Perlitas',price:5500}});assert.equal(result.version,8);
  client.rpc=async()=>({error:new Error('CATALOG_CONFLICT')});await assert.rejects(createCatalogAdapter(client).save({id:'26',version:7},{}),/CATALOG_CONFLICT/);
});
