import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import * as catalog from '../lib/catalog.mjs';
import * as render from '../lib/render.mjs';
import * as links from '../lib/links.mjs';
import * as detail from '../lib/detail.mjs';
import {registerRoutes,publishedRoutes} from '../server/routes.mjs';
import {pageMetadata,productStructured} from '../server/pages.mjs';
const product={id:'26',name:'Perla número 6 blanco',collection:'Perlas número 6',status:'normal',price:5000,available:true,images:['/img/logo_jpg.jpg']};

test('permanent routes survive renames, accents, duplicate names and removed products without reusing links', () => {
    const another={...product,id:'other',name:'Perla numero 6 blanco'};
    const first=registerRoutes([product,another]);
    assert.notEqual(first.products['26'],first.products.other);
    const changed=registerRoutes([{...product,name:'Nuevo nombre comercial'}, {...another,id:'third'}],first);
    assert.equal(changed.products['26'],first.products['26']);
    assert.equal(changed.products.other,first.products.other);
    assert.notEqual(changed.products.third,first.products.other);
    assert.equal(Object.keys(first.categories).length,1);
    const published=publishedRoutes([product],changed);
    assert.equal(published.products.other,undefined);
    assert.throws(()=>publishedRoutes([{...product,id:'unregistered'}],first),/Unregistered/);
    assert.throws(()=>registerRoutes([],{products:{a:'/productos/../../private'},categories:{}}),/Invalid/);
    const hostile=registerRoutes([{...product,id:'__proto__',name:'../ <script>',collection:'constructor'}]);
    assert.ok(Object.hasOwn(hostile.products,'__proto__'));
    assert.ok(links.productPath({...product,id:'__proto__'},hostile).startsWith('/productos/'));
});

test('product details and metadata safely escape HTML and WhatsApp carries the correct product and canonical URL', () => {
    const evil={...product,name:'</script><img src=x onerror=alert(1)>',collection:'<script>alert(2)</script>'};
    const routes=registerRoutes([evil]);
    const body=detail.renderProductDetail(evil,{routes});
    const head=pageMetadata({title:evil.name,description:evil.name,path:routes.products['26'],image:'/assets/share-test.jpg',structured:productStructured(evil,routes,'/assets/share-test.jpg')});
    assert.ok(!body.includes('<script>'));assert.ok(body.includes('&lt;img'));
    assert.equal((head.match(/<script/g)||[]).length,1);
    const json=JSON.parse(head.match(/application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(json['@graph'][0].name,evil.name);
    const message=new URL(links.productWhatsApp(product,routes)).searchParams.get('text');
    assert.ok(message.includes(product.name));assert.ok(message.includes('Referencia: 26'));
    assert.ok(message.includes(links.SITE_ORIGIN+routes.products['26']));
    assert.match(detail.renderProductDetail({...product,available:false},{routes}),/data-action="add"[^>]*disabled/);
});

test('every published product and category has crawlable HTML, one canonical, valid social photo, and matching sitemap entry', async () => {
    const root=new URL('../dist/',import.meta.url);
    const home=await fs.readFile(new URL('index.html',root),'utf8');
    const seed=JSON.parse(home.match(/id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
    const products=seed.products.filter(links.isCatalogProduct);
    const sitemap=await fs.readFile(new URL('sitemap.xml',root),'utf8');
    const paths=[...Object.values(seed.routes.products),...Object.values(seed.routes.categories)];
    assert.equal(new Set(paths).size,paths.length);
    assert.equal((sitemap.match(/<loc>/g)||[]).length,paths.length+1);
    const imagePaths=new Set();
    for(const path of paths) {
        const html=await fs.readFile(new URL(path.slice(1)+'.html',root),'utf8');
        assert.equal((html.match(/<h1[ >]/g)||[]).length,1,path);
        assert.equal((html.match(/rel="canonical"/g)||[]).length,1,path);
        assert.equal((html.match(/name="description"/g)||[]).length,1,path);
        assert.equal((html.match(/property="og:image"/g)||[]).length,1,path);
        assert.ok(html.includes('href="'+links.SITE_ORIGIN+path+'"'));
        assert.ok(sitemap.includes('<loc>'+links.SITE_ORIGIN+path+'</loc>'));
        assert.ok(!html.includes('CATALOG_'));assert.ok(!html.includes('Cargando vitrina'));
        for(const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
            const value=match[1].split(/[?#]/)[0];
            if(!value.startsWith('/')) continue;
            const local=value==='/'?'index.html':value.slice(1)+(value.startsWith('/productos/')||value.startsWith('/categorias/')?'.html':'');
            await fs.access(new URL(local,root));
        }
        const metaImage=new URL(html.match(/property="og:image" content="([^"]+)"/)[1]);
        assert.equal(metaImage.origin,links.SITE_ORIGIN);imagePaths.add(metaImage.pathname);
        const pageSeed=JSON.parse(html.match(/id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
        if(path.startsWith('/productos/')) {
            assert.equal(pageSeed.products.length,1);
            assert.equal(pageSeed.page.id,pageSeed.products[0].id);
            assert.ok(html.includes('Copiar enlace del producto'));
            assert.ok(Buffer.byteLength(html)<100000,'Product HTML should stay small');
        } else {
            assert.equal(pageSeed.products.length,products.filter(p=>links.categoryKey(p.collection)===pageSeed.page.category).length);
            assert.ok(pageSeed.products.every(p=>links.categoryKey(p.collection)===pageSeed.page.category));
        }
    }
    for(const path of imagePaths) {
        const meta=await sharp(fileURLToPath(new URL(path.slice(1),root))).metadata();
        assert.equal(meta.format,'jpeg');assert.equal(meta.width,1200);assert.equal(meta.height,630);
    }
});

async function browser(seed) {
    const source=(await fs.readFile(new URL('../app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
    const elements=new Map(['catalog-data','product-detail','product-grid','category-filters','search-input','catalog-status','cart-items','cart-total-display','cart-drawer','cart-overlay','share-status','share-fallback','share-url'].map(id=>[id,{innerHTML:'',textContent:'',value:'',hidden:true,focus(){},select(){},classList:{add(){},remove(){}}}]));
    elements.get('catalog-data').textContent=JSON.stringify(seed);
    const callbacks=new Map();let pending;let copied;
    const storage={getItem:()=>null,setItem(){}};
    const context=vm.createContext({...catalog,...render,...links,...detail,console,AbortSignal,Date,localStorage:storage,sessionStorage:storage,
        navigator:{clipboard:{writeText:async value=>{copied=value;}}},window:{localStorage:storage},
        document:{getElementById:id=>elements.get(id),addEventListener:(type,fn)=>callbacks.set(type,fn)},fetch:()=>new Promise(resolve=>{pending=resolve;}),setTimeout(){}});
    vm.runInContext(source,context);callbacks.get('DOMContentLoaded')();
    return {elements,context,refresh:async (products,nextRoutes)=>{pending({ok:true,json:async()=>({products,routes:nextRoutes})});await vm.runInContext('refreshing',context);},copied:()=>copied};
}

test('live refresh adopts permanent links for products and categories created after the build',async()=>{
    const first=registerRoutes([product]);
    const added={...product,id:'new',name:'Producto nuevo',collection:'Nueva categoría'};
    const next=registerRoutes([product,added],first);
    const instance=await browser({products:[product],routes:first,images:{},page:{type:'home'}});
    await instance.refresh([product,added],next);
    assert.ok(instance.elements.get('product-grid').innerHTML.includes(next.products.new));
    assert.ok(instance.elements.get('category-filters').innerHTML.includes(next.categories['nueva categoría']));
});

test('direct product page refresh stays on its product, updates price, removes withdrawn product, and copy has a permission-free fallback', async () => {
    const routes=registerRoutes([product]);
    const instance=await browser({products:[product],routes,images:{},page:{type:'product',id:'26'}});
    await instance.refresh([{...product,price:6500},{...product,id:'different',name:'OTHER PRODUCT'}]);
    const html=instance.elements.get('product-detail').innerHTML;
    assert.ok(html.includes('6.500'));assert.ok(!html.includes('OTHER PRODUCT'));
    const url=links.SITE_ORIGIN+routes.products['26'];
    await vm.runInContext('copyPageLink('+JSON.stringify(url)+')',instance.context);
    assert.equal(instance.copied(),url);assert.ok(instance.elements.get('share-status').textContent.includes('copiado'));
    instance.context.navigator.clipboard.writeText=async()=>{throw new Error('Clipboard disabled');};
    await vm.runInContext('copyPageLink('+JSON.stringify(url)+')',instance.context);
    assert.equal(instance.elements.get('share-fallback').hidden,false);
    assert.equal(instance.elements.get('share-url').value,url);
    const refresh=vm.runInContext('refreshCatalog()',instance.context);await instance.refresh([]);await refresh;
    assert.ok(instance.elements.get('product-detail').innerHTML.includes('ya no está disponible'));
    assert.ok(!instance.elements.get('product-detail').innerHTML.includes('data-action="add"'));
});

test('category page search remains scoped after full catalog refresh', async () => {
    const other={...product,id:'other',name:'Perla de otra categoría',collection:'Cristales'};
    const routes=registerRoutes([product,other]);
    const instance=await browser({products:[product],routes,images:{},page:{type:'category',category:links.categoryKey(product.collection)}});
    await instance.refresh([product,other]);
    instance.elements.get('search-input').value='perla';instance.context.window.applyFilters();
    assert.ok(instance.elements.get('product-grid').innerHTML.includes('data-product-card="26"'));
    assert.ok(!instance.elements.get('product-grid').innerHTML.includes('data-product-card="other"'));
});
