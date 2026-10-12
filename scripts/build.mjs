import {buildAdmin, adminConfig} from './build-admin.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fetchSources, projectCatalog, publicImageUrl, embeddedImage } from '../server/catalog-source.mjs';
import { renderCategoriesHTML, renderProductGrid } from '../lib/render.mjs';
import { renderProductDetail } from '../lib/detail.mjs';
import { SITE_ORIGIN, categoryKey, categoryPath, productPath, isCatalogProduct, jsonForHtml } from '../lib/links.mjs';
import { imageForDisplay, escapeHtml } from '../lib/catalog.mjs';
import { publishedRoutes, registerRoutes } from '../server/routes.mjs';
import { composePage, stripHomeMetadata, renderCategoryPage, productStructured, categoryStructured } from '../server/pages.mjs';
import {usesSupabase} from '../server/public-catalog.mjs';
import {fetchSupabaseCatalog} from '../server/supabase-catalog.mjs';
import {downloadCatalogPhoto} from '../server/catalog-photo.mjs';
import {CATALOG_IMAGE_BASE,STORAGE_OBJECT} from '../lib/storage-images.mjs';

const root = await fs.realpath(fileURLToPath(new URL('../', import.meta.url)));
const out = path.resolve(root, 'dist');
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Unsafe output path');
try { if ((await fs.lstat(out)).isSymbolicLink()) throw new Error('Output must not be a symlink'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

adminConfig(process.env); // Reject invalid or secret admin configuration before building.
// Fail the deployment if sources are unavailable; never replace the live catalog with an empty fallback.
const supabaseMode=usesSupabase();
const live=supabaseMode?await fetchSupabaseCatalog():null;
const sources = supabaseMode?null:await fetchSources();
const imageSources = new Map();
const products = live?.products ?? projectCatalog(sources.products, sources.legacyProducts, (key, index, value) => {
    const url = publicImageUrl(key, index, value);
    if (url.startsWith('/api/product-image?')) imageSources.set(url, embeddedImage(value).bytes);
    return url;
});
if (!products.length) throw new Error('Refusing to publish an empty catalog');
const registry = JSON.parse(await fs.readFile(path.join(root, 'content/catalog-routes.json'), 'utf8'));
registerRoutes([], registry); // Validate all reserved paths, including removed products.
const routes = live?.routes ?? publishedRoutes(products, registry);
if(supabaseMode){
    for(const kind of ['products','categories'])for(const [key,route] of Object.entries(routes[kind])){
        if(Object.hasOwn(registry[kind],key) && registry[kind][key]!==route)throw new Error('Supabase changed a reserved public route');
    }
    const photos=[...new Set(products.flatMap(p=>p.images))];
    for(let from=0;from<photos.length;from+=8)await Promise.all(photos.slice(from,from+8).map(async url=>{
        const key=url.startsWith(CATALOG_IMAGE_BASE)?url.slice(CATALOG_IMAGE_BASE.length):'';
        if(STORAGE_OBJECT.test(key))imageSources.set(url,await downloadCatalogPhoto(key));
    }));
}

console.log(`Build output: ${out}`);
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'assets'), { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css', 'robots.txt']) {
    await fs.copyFile(path.join(root, file), path.join(out, file));
}
for (const dir of ['lib', 'img']) {
    await fs.cp(path.join(root, dir), path.join(out, dir), {
        recursive: true,
        filter: async source => {
            const info = await fs.lstat(source);
            if (info.isSymbolicLink()) return false;
            return info.isDirectory() || /\.(html|css|js|mjs|png|jpe?g|webp|gif|avif|ico)$/i.test(source);
        }
    });
}
await fs.copyFile(path.join(root, 'styles/utilities.css'), path.join(out, 'assets/site.css'));

const manifest = {};
const processed = new Map();
let originalBytes = 0, optimizedBytes = 0;
async function optimize(bytes) {
    const sourceHash = createHash('sha256').update(bytes).digest('hex');
    if (processed.has(sourceHash)) return processed.get(sourceHash);
    const urls = {};
    for (const [kind, width, quality] of [['product', 600, 78], ['gallery', 1200, 80]]) {
        const buffer = await sharp(bytes, { limitInputPixels: 24000000, animated: false }).rotate()
            .resize({ width, withoutEnlargement: true }).webp({ quality }).toBuffer();
        const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
        const filename = `${kind}-${hash}.webp`;
        await fs.writeFile(path.join(out, 'assets', filename), buffer);
        urls[kind] = `/assets/${filename}`;
        if (kind === 'product') optimizedBytes += buffer.length;
    }
    originalBytes += bytes.length;
    processed.set(sourceHash, urls);
    return urls;
}
function mapImage(key, urls) { manifest[key] = urls.product; manifest['gallery:' + key] = urls.gallery; }
async function walkImages(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const source = path.join(dir, entry.name);
        if (entry.isDirectory()) { await walkImages(source); continue; }
        if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
        mapImage(path.relative(root, source).split(path.sep).join('/'), await optimize(await fs.readFile(source)));
    }
}
await walkImages(path.join(root, 'img'));
for (const [url, bytes] of imageSources) mapImage(url, await optimize(bytes));
await fs.writeFile(path.join(out, 'assets/image-manifest.json'), JSON.stringify(manifest));

const covers = [];
for (const width of [720, 1440]) {
    const buffer = await sharp(path.join(root, 'img/imagen_front.jpg')).rotate()
        .resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 16);
    const filename = `cover-${hash}.webp`;
    await fs.writeFile(path.join(out, 'assets', filename), buffer);
    covers.push({ width, url: `/assets/${filename}`, bytes: buffer.length });
}
const updatedAt = new Date().toISOString();
const seed = { products, images: manifest, routes, page:{type:'home'}, updatedAt };
// Escaping '<' prevents names such as </script> from breaking the JSON script container.
const seedJson = jsonForHtml(seed);
let html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
for (const marker of ['<!-- CATALOG_DATA -->', '<!-- CATALOG_CATEGORIES -->', '<!-- CATALOG_PRODUCTS -->']) {
    if (!html.includes(marker)) throw new Error(`Missing build marker: ${marker}`);
}
const liveTemplate=html.replace('src="img/imagen_front.jpg"', `src="${covers[1].url}" srcset="${covers[0].url} 720w, ${covers[1].url} 1440w" sizes="100vw"`);
html = liveTemplate
    .replace('<!-- CATALOG_DATA -->', () => seedJson)
    .replace('<!-- CATALOG_CATEGORIES -->', () => renderCategoriesHTML(products, 'todas', routes))
    .replace('<!-- CATALOG_PRODUCTS -->', () => renderProductGrid(products.filter(p => !p.popup && p.status.toLowerCase() !== 'anuncio'), { images: manifest, routes }));
await fs.writeFile(path.join(out, 'index.html'), html);
console.log(JSON.stringify({ products: products.length, optimizedSources: processed.size, embeddedPhotoReferences: imageSources.size,
    publicCatalogBytes: Buffer.byteLength(JSON.stringify({ products })), htmlBytes: Buffer.byteLength(html), originalBytes, optimizedBytes, covers }, null, 2));

// Social crawlers receive product-specific HTML and JPEG images without running JavaScript.
const template = stripHomeMetadata(await fs.readFile(path.join(root,'index.html'),'utf8'));
const visibleProducts = products.filter(isCatalogProduct);
const shares = new Map();
async function shareImage(product) {
    const optimized = imageForDisplay(product.images[0],manifest,true);
    const source = /^\/assets\/gallery-[a-f0-9]+\.webp$/.test(optimized) ? path.join(out,optimized.slice(1)) : path.join(root,'img/logo_jpg.jpg');
    if (shares.has(source)) return shares.get(source);
    const buffer = await sharp(source).rotate().resize(1200,630,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).jpeg({quality:82,mozjpeg:true}).toBuffer();
    const filename = 'share-'+createHash('sha256').update(buffer).digest('hex').slice(0,16)+'.jpg';
    await fs.writeFile(path.join(out,'assets',filename),buffer);
    const url = '/assets/'+filename;
    shares.set(source,url);
    return url;
}
function pageSeed(items,page) {
    const wanted = new Set(items.flatMap(p=>p.images.flatMap(image=>[imageForDisplay(image,manifest),imageForDisplay(image,manifest,true)])));
    const images = Object.fromEntries(Object.entries(manifest).filter(([,url])=>wanted.has(url)));
    return {products:items,images,routes,page,updatedAt};
}
async function writePage(route,html) {
    if (!/^\/(productos|categorias)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route)) throw new Error('Invalid page output route');
    const target=path.join(out,route.slice(1)+'.html');
    await fs.mkdir(path.dirname(target),{recursive:true});
    await fs.writeFile(target,html);
}
const sitemap = ['/'];
for (const product of visibleProducts) {
    const route=productPath(product,routes), image=await shareImage(product);
    const content=`<p id="catalog-status" role="status" class="text-center text-sm text-gray-500 mb-4" hidden></p><div id="product-detail">${renderProductDetail(product,{images:manifest,routes})}</div>`;
    await writePage(route,composePage(template,{title:product.name,
        description:`${product.name} · ${product.collection}. Gs. ${product.price.toLocaleString('es-PY')}. Consultá precio y disponibilidad por WhatsApp en Creaciones Marilyn.`,
        path:route,image,content,structured:productStructured(product,routes,image),seed:pageSeed([product],{type:'product',id:String(product.id),path:route})}));
    sitemap.push(route);
}
for (const key of Object.keys(routes.categories)) {
    const items=visibleProducts.filter(p=>categoryKey(p.collection)===key), name=items[0].collection;
    const route=categoryPath(name,routes), image=await shareImage(items[0]);
    await writePage(route,composePage(template,{title:name,description:`Explorá ${name} en Creaciones Marilyn. Fotos, precios y consultas por WhatsApp. Envíos desde Luque a todo Paraguay.`,
        path:route,image,imageAlt:items[0].name,content:renderCategoryPage(name,items,products,{images:manifest,routes,category:key}),
        structured:categoryStructured(name,items,routes),seed:pageSeed(items,{type:'category',category:key,path:route})}));
    sitemap.push(route);
}
await fs.writeFile(path.join(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+sitemap.map(route=>'  <url><loc>'+escapeHtml(SITE_ORIGIN+route)+'</loc></url>').join('\n')+'\n</urlset>\n');
console.log(JSON.stringify({productPages:visibleProducts.length,categoryPages:Object.keys(routes.categories).length,sitemapUrls:sitemap.length,socialImages:shares.size}));

await buildAdmin(out);
if(supabaseMode){
    const runtime=path.join(root,'.runtime-public');await fs.mkdir(runtime,{recursive:true});
    const social=Object.fromEntries(await Promise.all(visibleProducts.map(async product=>[product.images[0],await shareImage(product)])));
    const fallbackShare=await shareImage({images:['/img/logo_jpg.jpg']});
    await fs.writeFile(path.join(runtime,'runtime.json'),JSON.stringify({template:liveTemplate,images:manifest,shares:social,fallbackShare}));
}
