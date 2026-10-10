import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import vm from 'node:vm';
import {adminPreviewHeaders} from '../server/admin-preview.mjs';

const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
const html=await readFile(new URL('../panel/index.html',import.meta.url),'utf8');
const bundle=await build({entryPoints:[fileURLToPath(new URL('../panel/demo.mjs',import.meta.url))],bundle:true,write:false,format:'iife',target:['es2022'],plugins:[{name:'wrap-demo-entry',setup(build){build.onLoad({filter:/panel[\\/]demo\.mjs$/},async args=>{const source=await readFile(args.path,'utf8');return{contents:source.replace("import {mountPanel} from './app.mjs';","import {mountPanel} from './app.mjs';\nglobalThis.demoReady=(async()=>{")+ '\n})();',loader:'js'};});}}]});
const js=bundle.outputFiles[0].text;
function allowsSameOrigin(policy){return /(?:^|;)\s*connect-src\s+[^;]*'self'/.test(policy);}

test('demo uses its served CSP and bundled entry to leave the loading screen',async()=>{
 const headers=adminPreviewHeaders(config);
 assert.equal(headers['Cache-Control'],'no-store');
 assert.equal(allowsSameOrigin(headers['Content-Security-Policy']),true);
 assert.match(headers['Content-Security-Policy'],/script-src 'self'/);
 assert.match(headers['Content-Security-Policy'],/frame-ancestors 'none'/);
 assert.doesNotMatch(headers['Content-Security-Policy'],/connect-src[^;]*\*/);
 const dom=new JSDOM(html,{url:'http://localhost:4174/gestion',runScripts:'outside-only'});
 try {
   dom.window.structuredClone=structuredClone;
   dom.window.fetch=async pathname=>{
     if(!allowsSameOrigin(headers['Content-Security-Policy']))throw new Error('Blocked by connect-src');
     assert.equal(pathname,'/demo-catalog.json');
     return {ok:true,json:async()=>({categories:[],products:[{id:'26',name:'Perla número 6',category_name:'Perlas',price:5000,images:[],visibility:'published',available:true}]})};
   };
   new vm.Script(js).runInContext(dom.getInternalVMContext());await dom.window.demoReady;
   assert.equal(dom.window.document.getElementById('catalog').hidden,false);
   assert.equal(dom.window.document.getElementById('global-status').hidden,true);
   assert.match(dom.window.document.getElementById('products').textContent,/Perla número 6/);
 }finally{dom.window.close();}
});

test('demo initialization failures replace the endless loading message with recovery instructions',async()=>{
 const dom=new JSDOM(html,{url:'http://localhost:4174/gestion',runScripts:'outside-only'});
 try {
   dom.window.fetch=async()=>{throw new Error('Network failure');};
   new vm.Script(js).runInContext(dom.getInternalVMContext());await dom.window.demoReady;
   const status=dom.window.document.getElementById('global-status');
   assert.equal(status.hidden,false);assert.match(status.textContent,/Actualizá esta página/);assert.doesNotMatch(status.textContent,/Preparando tu espacio/);
 }finally{dom.window.close();}
});
