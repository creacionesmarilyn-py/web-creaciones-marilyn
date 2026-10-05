import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = await fs.realpath(fileURLToPath(new URL('../', import.meta.url)));
const out = path.resolve(root, 'dist');
// Never recursively remove a symlink or a path outside this project's build directory.
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Unsafe output path');
try { if ((await fs.lstat(out)).isSymbolicLink()) throw new Error('Output must not be a symlink'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
console.log(`Build output: ${out}`);
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(path.join(out, 'assets'), { recursive: true });

// Explicit public files only: backups, credentials, docs and tooling cannot be deployed.
for (const file of ['index.html', 'app.js', 'style.css', 'robots.txt', 'sitemap.xml']) {
    await fs.copyFile(path.join(root, file), path.join(out, file));
}
// Admin/POS are unused and intentionally not published until real authorization is configured.
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

// The existing design is checked in as static CSS; no CSS compiler runs in visitors' browsers.
await fs.copyFile(path.join(root, 'styles/utilities.css'), path.join(out, 'assets/site.css'));

const manifest = {};
let originalBytes = 0, optimizedBytes = 0;
async function walkImages(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const source = path.join(dir, entry.name);
        if (entry.isDirectory()) { await walkImages(source); continue; }
        if (!entry.isFile() || !/\.(png|jpe?g|webp)$/i.test(entry.name)) continue;
        const original = await fs.readFile(source);
        const optimized = await sharp(original).rotate().resize({ width: 600, withoutEnlargement: true })
            .webp({ quality: 78 }).toBuffer();
        const hash = createHash('sha256').update(optimized).digest('hex').slice(0, 16);
        const filename = `product-${hash}.webp`;
        await fs.writeFile(path.join(out, 'assets', filename), optimized);
        manifest[path.relative(root, source).split(path.sep).join('/')] = `/assets/${filename}`;
        originalBytes += original.length; optimizedBytes += optimized.length;
    }
}
await walkImages(path.join(root, 'img'));
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
let html = await fs.readFile(path.join(out, 'index.html'), 'utf8');
html = html.replace('src="img/imagen_front.jpg"',
    `src="${covers[1].url}" srcset="${covers[0].url} 720w, ${covers[1].url} 1440w" sizes="100vw"`);
await fs.writeFile(path.join(out, 'index.html'), html);
console.log(JSON.stringify({ images: Object.keys(manifest).length, originalBytes, optimizedBytes, covers }, null, 2));
