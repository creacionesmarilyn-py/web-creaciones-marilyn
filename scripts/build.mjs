import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fetchSources, projectCatalog, publicImageUrl, embeddedImage } from '../server/catalog-source.mjs';
import { renderCategoriesHTML, renderProductGrid } from '../lib/render.mjs';

const root = await fs.realpath(fileURLToPath(new URL('../', import.meta.url)));
const out = path.resolve(root, 'dist');
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Unsafe output path');
try { if ((await fs.lstat(out)).isSymbolicLink()) throw new Error('Output must not be a symlink'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

// Fail the deployment if sources are unavailable; never replace the live catalog with an empty fallback.
const sources = await fetchSources();
const imageSources = new Map();
const products = projectCatalog(sources.products, sources.legacyProducts, (key, index, value) => {
    const url = publicImageUrl(key, index, value);
    if (url.startsWith('/api/product-image?')) imageSources.set(url, embeddedImage(value).bytes);
    return url;
});
if (!products.length) throw new Error('Refusing to publish an empty catalog');

console.log(`Build output: ${out}`);
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'assets'), { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css', 'robots.txt', 'sitemap.xml']) {
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
const seed = { products, images: manifest, updatedAt: new Date().toISOString() };
// Escaping '<' prevents names such as </script> from breaking the JSON script container.
const seedJson = JSON.stringify(seed).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
let html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
for (const marker of ['<!-- CATALOG_DATA -->', '<!-- CATALOG_CATEGORIES -->', '<!-- CATALOG_PRODUCTS -->']) {
    if (!html.includes(marker)) throw new Error(`Missing build marker: ${marker}`);
}
html = html.replace('src="img/imagen_front.jpg"', `src="${covers[1].url}" srcset="${covers[0].url} 720w, ${covers[1].url} 1440w" sizes="100vw"`)
    .replace('<!-- CATALOG_DATA -->', () => seedJson)
    .replace('<!-- CATALOG_CATEGORIES -->', () => renderCategoriesHTML(products))
    .replace('<!-- CATALOG_PRODUCTS -->', () => renderProductGrid(products.filter(p => !p.popup && p.status.toLowerCase() !== 'anuncio'), { images: manifest }));
await fs.writeFile(path.join(out, 'index.html'), html);
console.log(JSON.stringify({ products: products.length, optimizedSources: processed.size, embeddedPhotoReferences: imageSources.size,
    publicCatalogBytes: Buffer.byteLength(JSON.stringify({ products })), htmlBytes: Buffer.byteLength(html), originalBytes, optimizedBytes, covers }, null, 2));
