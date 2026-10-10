import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {JSDOM} from 'jsdom';
import {validateChanges,filterProducts,productLink,safePhotoUrl} from '../panel/model.mjs';
import {adminConfig,buildAdmin} from '../scripts/build-admin.mjs';
import {mountPanel} from '../panel/app.mjs';
const category='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const product={id:'26',name:'Perlitas número 6',price:5000,category_id:category,category_name:'Perlas',available:true,visibility:'published',featured:false,images:[],path:'/productos/perla-numero-6-blanco',version:1};
const form={name:product.name,price:'5500',category_id:category,state:'available',featured:false};

test('input rules protect prices, hidden availability, links and photos',()=>{
  for(const price of ['5.500','5500.25','-10','1e4','', '10000000000'])assert.throws(()=>validateChanges({...form,price},[]));
  assert.equal(validateChanges(form,[]).price,5500);
  assert.equal(validateChanges({...form,state:'hidden'},[],{available:false}).available,false);
  assert.throws(()=>validateChanges(form,['javascript:alert(1)']));
  assert.throws(()=>validateChanges(form,[null]));
  assert.equal(safePhotoUrl('https://someone:secret@example.com/photo.png'),false);
  assert.equal(productLink({...product,path:'//attacker.example'}),'');
  assert.equal(filterProducts([product],'perlitas numero 6').length,1);
  assert.equal(filterProducts([product],'perlas','hidden').length,0);
});

test('admin build defaults off and refuses privileged credentials before emitting files',async()=>{
  assert.equal(adminConfig({}),null);
  const env={MARILYN_ADMIN_ENABLED:'true',SUPABASE_URL:'https://mskmfxkhfqimsmicuowv.supabase.co'};
  const jwt=payload=>['header',Buffer.from(JSON.stringify(payload)).toString('base64url'),'signature'].join('.');
  for(const key of ['sb_secret_example',jwt({role:'service_role'}),''])assert.throws(()=>adminConfig({...env,SUPABASE_PUBLISHABLE_KEY:key}),/public publishable\/anon/);
  assert.throws(()=>adminConfig({...env,SUPABASE_URL:'https://testproject.supabase.co@evil.example',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'}),/hosted/);
  assert.throws(()=>adminConfig({...env,SUPABASE_URL:'https://anotherproject.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'}),/different Supabase project/);
  const folder=await mkdtemp(path.join(os.tmpdir(),'marilyn-admin-test-'));
  try{
    assert.equal(await buildAdmin(folder,{}),false);assert.deepEqual(await readdir(folder),[]);
    assert.equal(await buildAdmin(folder,{...env,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example'}),true);
    const html=await readFile(path.join(folder,'gestion.html'),'utf8');const js=await readFile(path.join(folder,'gestion/panel.js'),'utf8');
    assert.match(html,/noindex, nofollow/);assert.doesNotMatch(html,/facebook|gtag|pixel|service_role/i);
    assert.doesNotMatch(js,/demo\.mjs|Cuenta de prueba/);
  }finally{await rm(folder,{recursive:true,force:true});}
});

test('panel form preserves unsaved edits on conflict and renders catalog text safely',async t=>{
  const html=await readFile(new URL('../panel/index.html',import.meta.url),'utf8');
  const previous={};
  for(const key of ['window','document','location','history'])previous[key]=globalThis[key];
  let dom;
  async function setup(session,save=async()=>{throw new Error('CATALOG_CONFLICT');}){
    dom?.window.close();dom=new JSDOM(html,{url:'https://www.creacionesmarilyn.com.py/gestion'});
    for(const key of ['window','document','location','history'])globalThis[key]=dom.window[key];
    dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
    dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
    dom.window.confirm=()=>true;
    const malicious={...product,name:'<img src=x onerror=alert(1)> Perlitas número 6'};
    let reads=0;
    await mountPanel({session:async()=>session,catalog:async()=>{reads++;return{products:[malicious],categories:[{id:category,name:'Perlas'}]};},save});
    return {reads,$:id=>document.getElementById(id)};
  }
  try{
    await t.test('visitors and unapproved accounts do not fetch the staff catalog',async()=>{
      let view=await setup(null);assert.equal(view.reads,0);assert.equal(view.$('login').hidden,false);assert.equal(view.$('catalog').hidden,true);
      view=await setup({role:null,email:'no-access@example.com',writable:false});assert.equal(view.reads,0);assert.equal(view.$('denied').hidden,false);
    });
    await t.test('preparation allows review but blocks saving',async()=>{
      const {$}=await setup({role:'owner',writable:false});assert.equal($('new-product').disabled,true);
      document.querySelector('.product-row').click();assert.equal($('save').disabled,true);assert.equal($('edit-fields').disabled,true);
    });
    await t.test('malicious names remain text and a stale edit is not silently discarded',async()=>{
      const {$}=await setup({role:'editor',writable:true});assert.equal(document.querySelectorAll('#products img').length,0);
      document.querySelector('.product-row').click();assert.equal($('editor').open,true);$('price').value='6200';
      $('product-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true,bubbles:true}));
      await new Promise(resolve=>setImmediate(resolve));
      assert.match($('editor-status').textContent,/Otra persona modificó/);assert.equal($('price').value,'6200');assert.equal($('editor').open,true);assert.equal($('save').disabled,false);
    });
    await t.test('a successful save uses the current version and keeps the permanent link',async()=>{
      let call;
      const {$}=await setup({role:'editor',writable:true},async(p,changes)=>{call={p,changes};return{...p,...changes,version:2};});
      document.querySelector('.product-row').click();$('name').value='Nuevo nombre';$('price').value='6100';
      $('product-form').dispatchEvent(new dom.window.Event('submit',{cancelable:true,bubbles:true}));await new Promise(resolve=>setImmediate(resolve));
      assert.equal(call.p.version,1);assert.equal(call.changes.price,6100);assert.equal(call.changes.path,undefined);
      assert.equal($('share-url').value,'https://www.creacionesmarilyn.com.py'+product.path);assert.match($('editor-status').textContent,/pendiente de publicación/);
      assert.match(document.querySelector('.product-row').textContent,/Nuevo nombre/);
    });
  }finally{dom?.window.close();for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
