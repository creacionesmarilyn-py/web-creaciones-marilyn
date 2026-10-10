import { liveCatalog } from '../server/catalog-source.mjs';
export default async function handler(req, res) {
    if (!['GET', 'HEAD'].includes(req.method)) return res.status(405).setHeader('Allow', 'GET, HEAD').end();
    if (new URL(req.url, 'https://www.creacionesmarilyn.com.py').search) {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(400).end();
    }
    try {
        const data = await liveCatalog();
        res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.status(200).end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
    } catch {
        res.setHeader('Cache-Control', 'no-store');
        return res.status(503).json({ error: 'Catalogo temporalmente no disponible' });
    }
}
