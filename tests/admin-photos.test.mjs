import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizePhoto} from '../panel/photos.mjs';
import {createCatalogAdapter} from '../panel/adapter.mjs';

function canvasHarness(t,{webp=true,empty=false,width=4032,height=3024}={}) {
 const requests=[],draws=[];let closed=false;
 const canvas={width:0,height:0,getContext:()=>({drawImage:(_image,_x,_y,w,h)=>draws.push([w,h])}),
  toBlob(callback,type){requests.push(type);callback(empty?null:new Blob(['encoded'],{type:type==='image/webp'&&!webp?'image/png':type}));}};
 t.mock.method(globalThis,'createImageBitmap',async()=>({width,height,close(){closed=true;}}));
 t.mock.method(globalThis.document,'createElement',()=>canvas);
 return {requests,draws,canvas,closed:()=>closed};
}

test('photo preparation supports browsers without WebP encoding',async t=>{
 const previousBitmap=globalThis.createImageBitmap,previousDocument=globalThis.document;
 globalThis.createImageBitmap=async()=>{};globalThis.document={createElement(){}};
 try{
  await t.test('WebP encoder produces a reduced image and releases resources',async t=>{
   const h=canvasHarness(t);const blob=await optimizePhoto(new Blob(['photo'],{type:'image/jpeg'}));
   assert.equal(blob.type,'image/webp');assert.deepEqual(h.draws,[[1200,900]]);
   assert.deepEqual(h.requests,['image/webp']);assert.equal(h.closed(),true);assert.equal(h.canvas.width,0);
  });
  await t.test('Safari PNG fallback is re-encoded as JPEG for camera photos',async t=>{
   const h=canvasHarness(t,{webp:false});const blob=await optimizePhoto(new Blob(['photo'],{type:'image/jpeg'}));
   assert.equal(blob.type,'image/jpeg');assert.deepEqual(h.requests,['image/webp','image/jpeg']);assert.equal(h.closed(),true);
  });
  await t.test('transparent inputs retain PNG instead of losing transparency to JPEG',async t=>{
   const h=canvasHarness(t,{webp:false,width:600,height:400});
   const blob=await optimizePhoto(new Blob(['photo'],{type:'image/png'}));
   assert.equal(blob.type,'image/png');assert.deepEqual(h.draws,[[600,400]]);assert.deepEqual(h.requests,['image/webp']);
  });
  await t.test('empty encoding fails with a retry message and releases resources',async t=>{
   const h=canvasHarness(t,{empty:true});await assert.rejects(optimizePhoto(new Blob(['photo'],{type:'image/jpeg'})),/Intentá de nuevo/);
   assert.equal(h.closed(),true);assert.equal(h.canvas.width,0);
  });
  await t.test('unsupported input and oversized dimensions remain rejected',async t=>{
   const h=canvasHarness(t,{width:6000,height:5000});
   await assert.rejects(optimizePhoto(new Blob(['svg'],{type:'image/svg+xml'})),/JPG, PNG o WebP/);
   await assert.rejects(optimizePhoto(new Blob(['photo'],{type:'image/jpeg'})),/24 megapíxeles/);
   assert.equal(h.closed(),true);assert.deepEqual(h.requests,[]);
  });
 }finally{
  if(previousBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=previousBitmap;
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;
 }
});

test('upload MIME type and filename match the actual prepared image',async()=>{
 const calls=[],uid='11111111-1111-4111-8111-111111111111';
 const adapter=createCatalogAdapter({auth:{getUser:async()=>({data:{user:{id:uid}}})},storage:{from(bucket){
  assert.equal(bucket,'marilyn-catalog-images');return {
   upload:async(object,blob,options)=>{calls.push({object,blob,options});return {data:{}};},
   getPublicUrl:object=>({data:{publicUrl:'https://mskmfxkhfqimsmicuowv.supabase.co/storage/v1/object/public/'+bucket+'/'+object}})
  };
 }}});
 for(const [type,extension] of [['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]){
  const blob=new Blob(['encoded'],{type});const url=await adapter.upload(blob);const call=calls.at(-1);
  assert.equal(call.blob,blob);assert.equal(call.options.contentType,type);assert.equal(call.options.upsert,false);
  assert.ok(call.object.startsWith(uid+'/'));assert.ok(call.object.endsWith('.'+extension));assert.ok(url.endsWith(call.object));
 }
 await assert.rejects(adapter.upload(new Blob(['svg'],{type:'image/svg+xml'})),/JPG, PNG o WebP/);assert.equal(calls.length,3);
});
