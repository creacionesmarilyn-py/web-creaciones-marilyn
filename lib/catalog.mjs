import {catalogImagePath} from './storage-images.mjs';
export const FALLBACK_IMAGE = '/img/logo_jpg.jpg';
const RAW_BASE = 'https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/';

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

export function normalize(value) {
    return String(value ?? '').toLowerCase().normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

export function safeImageUrl(value) {
    const input = String(value ?? '').trim();
    if (/^data:image\/(jpeg|png|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(input)) return input;
    if (/^\/assets\/(product|gallery)-[a-f0-9]{16,64}\.webp$/.test(input)) return input;
    if (/^\/api\/product-image\?key=[A-Za-z0-9_-]{1,160}&slot=\d{1,2}&v=[a-f0-9]{24}$/.test(input)) return input;
    if (input.startsWith(RAW_BASE)) return input;
    const relative = input.replace(/^\//, '');
    // Older catalog images live on GitHub until migrated to object storage.
    if (/^img\//i.test(relative) && !relative.includes('..') && !relative.includes('\\')) {
        return RAW_BASE + relative;
    }
    try {
        const url = new URL(input);
        if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* Invalid paths fall back to the shop logo. */ }
    return FALLBACK_IMAGE;
}

export function imageForDisplay(value, manifest = {}, gallery = false) {
    const safe = safeImageUrl(value);
    const path = safe.startsWith(RAW_BASE) ? safe.slice(RAW_BASE.length) : '';
    return (gallery ? manifest['gallery:' + (path || safe)] : manifest[path || safe]) || catalogImagePath(safe,gallery?'gallery':'card') || safe;
}

export function indexLegacyProducts(products) {
    const byId = new Map(), byName = new Map();
    for (const product of products) {
        if (!product || typeof product !== 'object') continue;
        if (product.id != null && !byId.has(String(product.id))) byId.set(String(product.id), product);
        const name = normalize(product.name || product.nombre);
        if (name && !byName.has(name)) byName.set(name, product);
    }
    return { byId, byName };
}

export function readCart(storage) {
    try {
        const parsed = JSON.parse(storage.getItem('marilyn_cart') || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(item => item && ['string', 'number'].includes(typeof item.id)
            && typeof item.name === 'string' && Number.isFinite(item.price) && item.price >= 0
            && Number.isInteger(item.qty) && item.qty > 0)
            .slice(0, 100).map(item => ({ id: String(item.id), name: item.name.slice(0, 300),
                price: item.price, qty: Math.min(item.qty, 999) }));
    } catch { return []; }
}
