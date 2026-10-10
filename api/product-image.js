import sharp from 'sharp';
import { DATABASE, LEGACY, KEY_PATTERN, readJson, selectedImages, embeddedImage, isVisible } from '../server/catalog-source.mjs';
import { indexLegacyProducts, normalize } from '../lib/catalog.mjs';
export default async function handler(req, res) {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, HEAD').end();
    res.setHeader('Cache-Control', 'no-store');
    const url = new URL(req.url, 'https://www.creacionesmarilyn.com.py');
    const key = url.searchParams.get('key') || '';
    const slot = url.searchParams.get('slot') || '';
    const version = url.searchParams.get('v') || '';
    if (!KEY_PATTERN.test(key) || !/^\d{1,2}$/.test(slot) || Number(slot) > 15 || !/^[a-f0-9]{24}$/.test(version)) return res.status(400).end();
    try {
        const [row, oldData] = await Promise.all([readJson(`${DATABASE}/productos/${encodeURIComponent(key)}.json`, fetch, 48 * 1024 * 1024), readJson(LEGACY, fetch, 4 * 1024 * 1024)]);
        if (!isVisible(row)) return res.status(404).end();
        const legacy = indexLegacyProducts(oldData.products || oldData.productos || []);
        const old = legacy.byId.get(String(row.id || key)) || legacy.byName.get(normalize(row.nombre));
        const image = embeddedImage(selectedImages(row, old)[Number(slot)]);
        if (!image || image.hash !== version) return res.status(404).end();
        const output = await sharp(image.bytes, { limitInputPixels: 24000000, animated: false }).rotate()
            .resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        if (output.length > 4 * 1024 * 1024) return res.status(413).end();
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
        return res.status(200).end(req.method === 'HEAD' ? undefined : output);
    } catch {
        return res.status(503).end();
    }
}
