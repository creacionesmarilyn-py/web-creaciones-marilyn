import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as catalog from '../lib/catalog.mjs';
import * as render from '../lib/render.mjs';
import * as links from '../lib/links.mjs';
import * as detail from '../lib/detail.mjs';
import { projectCatalog, embeddedImage } from '../server/catalog-source.mjs';
import imageHandler from '../api/product-image.js';

const photo = 'data:image/png;base64,aGVsbG8=';
test('public projection keeps identities, prices and photo precedence without leaking fields or embedded bytes', () => {
    const products = projectCatalog({
        'sku-6': { id:'6', nombre:'Perlitas', precio_gs:5000, stock_actual:8, categoria:'Perlas', image:photo,
            imagen:photo, img:photo, costo:1200, proveedor:'PRIVATE', fecha_registro:'PRIVATE' },
        'hidden': { nombre:'Hidden', estado:'oculto', images:[photo] },
        'inactive': { nombre:'Inactive', estado:'inactivo' },
    }, []);
    assert.equal(products.length, 1);
    assert.equal(products[0].id, '6');
    assert.equal(products[0].price, 5000);
    assert.equal(products[0].available, true);
    assert.match(products[0].images[0], /^\/api\/product-image\?key=sku-6&slot=0&v=[a-f0-9]{24}$/);
    const json = JSON.stringify(products);
    for (const forbidden of ['data:image', 'PRIVATE', 'costo', 'proveedor', 'stock_actual', 'Hidden', 'Inactive']) assert.ok(!json.includes(forbidden));
    const legacy = projectCatalog({'sku-6':{nombre:'Perlitas', image:photo, stock_actual:0}}, [{name:'Perlitas',image:'img/perlas.jpg'}]);
    assert.match(legacy[0].images[0], /raw\.githubusercontent\.com/);
    assert.equal(legacy[0].available, false);
    assert.equal(embeddedImage(photo).hash, embeddedImage('data:image/png;base64,aGVs\nbG8=').hash);
});

test('image endpoint rejects arbitrary paths and unsupported methods before contacting any source', async () => {
    for (const [url, method, expected] of [['/api/product-image?key=../ventas','GET',400], ['/api/product-image','POST',405], ['/api/product-image?key=a&slot=99&v='+'a'.repeat(24),'GET',400]]) {
        const response = { code:0, status(code){this.code=code;return this;},setHeader(){return this;},end(){return this;} };
        await imageHandler({url,method},response);
        assert.equal(response.code, expected);
    }
});

test('built HTML contains real catalog and safe, light hydration data before any scripts run', async () => {
    const html = await fs.readFile(new URL('../dist/index.html', import.meta.url),'utf8');
    assert.ok(!html.includes('Cargando vitrina'));
    assert.ok((html.match(/data-product-card=/g) || []).length > 0);
    const seedText = html.match(/<script id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(seedText);
    const seed = JSON.parse(seedText);
    assert.ok(seed.products.length > 0);
    assert.ok(!seedText.includes('data:image'));
    assert.ok(Buffer.byteLength(seedText) < 750000);
    for (const row of seed.products) {
        assert.deepEqual(Object.keys(row).sort(), ['id','name','price','collection','status','destacado','popup','available','images'].sort());
        for (const image of row.images) if (image.startsWith('/api/product-image?')) assert.match(seed.images[image], /^\/assets\/product-/);
    }
    const cards = render.renderProductGrid([{id:'x',name:'</script><script>alert(1)</script>',collection:'Perlas',status:'normal',price:1,images:[],available:true}]);
    assert.ok(!cards.includes('<script>'));
});

test('browser works from seed while refresh is pending, preserves cards on failure, and reconciles fresh prices', async () => {
    const source=(await fs.readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
    assert.ok(!source.includes('firebasejs'));
    assert.ok(!source.includes('raw.githubusercontent.com'));
    const product={id:'6',name:'Perlitas número 6',collection:'Perlas',status:'normal',price:5000,images:['/img/logo_jpg.jpg'],available:true};
    const elements=new Map(['catalog-data','product-grid','category-filters','search-input','catalog-status','cart-items','cart-total-display','cart-drawer','cart-overlay'].map(id=>[id,{innerHTML:'',textContent:'',value:'',hidden:true,classList:{add(){},remove(){}}}]));
    elements.get('catalog-data').textContent=JSON.stringify({products:[product],images:{}});
    elements.get('product-grid').innerHTML='PRE_RENDERED_CARDS';
    const callbacks=new Map();let request;let opened;const saved=new Map();
    const storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
    const context=vm.createContext({...catalog,...render,...links,...detail,console,AbortSignal,Date,sessionStorage:storage,localStorage:storage,
        window:{localStorage:storage,open:url=>{opened=url;}},
        document:{getElementById:id=>elements.get(id),addEventListener:(type,fn)=>callbacks.set(type,fn)},
        fetch:()=>new Promise((resolve,reject)=>{request={resolve,reject};}),setTimeout(){},alert(){},
    });
    vm.runInContext(source,context);
    callbacks.get('DOMContentLoaded')();
    assert.equal(elements.get('product-grid').innerHTML,'PRE_RENDERED_CARDS');
    context.window.applyFilters();
    assert.ok(elements.get('product-grid').innerHTML.includes('Perlitas'));
    context.window.addToCart('6',product.name,5000);context.window.addToCart('6',product.name,5000);
    assert.equal(elements.get('cart-total-display').textContent,'Gs. 10.000');
    const visible=elements.get('product-grid').innerHTML;
    request.reject(new Error('Offline'));
    await vm.runInContext('refreshing',context);
    assert.equal(elements.get('product-grid').innerHTML,visible);
    assert.equal(elements.get('catalog-status').hidden,false);
    const refreshed=vm.runInContext('refreshCatalog()',context);
    request.resolve({ok:true,json:async()=>({products:[{...product,price:6000}]})});
    await refreshed;
    assert.equal(elements.get('cart-total-display').textContent,'Gs. 12.000');
    context.window.sendWhatsApp();
    assert.equal(new URL(opened).pathname,'/595991391542');
    assert.ok(new URL(opened).searchParams.get('text').includes('12.000'));
    const removed=vm.runInContext('refreshCatalog()',context);
    request.resolve({ok:true,json:async()=>({products:[]})});await removed;
    assert.equal(JSON.parse(saved.get('marilyn_cart')).length,0);
});
