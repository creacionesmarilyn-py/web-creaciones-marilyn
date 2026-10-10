import { createHash } from 'node:crypto';
import { normalize, safeImageUrl, indexLegacyProducts, FALLBACK_IMAGE } from '../lib/catalog.mjs';

export const DATABASE = 'https://creaciones-marilyn-default-rtdb.firebaseio.com';
export const LEGACY = 'https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/database.json';
export const KEY_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const IMAGE_PATTERN = /^data:image\/(jpeg|png|webp|gif|avif);base64,([a-z0-9+/=\s]+)$/i;

export async function readJson(url, fetcher = fetch, maxBytes = 80 * 1024 * 1024) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Catalog source HTTP ${response.status}`);
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maxBytes) { await reader.cancel(); throw new Error('Catalog source exceeds size limit'); }
        chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function fetchSources(fetcher = fetch) {
    const [products, legacy] = await Promise.all([
        readJson(`${DATABASE}/productos.json`, fetcher), readJson(LEGACY, fetcher, 4 * 1024 * 1024),
    ]);
    if (products !== null && (typeof products !== 'object' || Array.isArray(products))) throw new Error('Invalid products source');
    const legacyProducts = legacy.products || legacy.productos;
    if (!Array.isArray(legacyProducts)) throw new Error('Invalid legacy catalog');
    return { products: products || {}, legacyProducts };
}

export function isVisible(product) {
    return product && typeof product === 'object' && !['inactivo', 'oculto'].includes(String(product.estado || product.status || 'normal').toLowerCase());
}

export function selectedImages(product, legacy) {
    const source = legacy && (legacy.image || legacy.images?.length) ? legacy : product;
    let values = source.images?.length ? source.images : source.image || source.imagen || source.img;
    if (!Array.isArray(values)) values = values ? [values] : [];
    return values.filter(value => typeof value === 'string' && value.trim() && !value.includes('logo_jpg')).slice(0, 16);
}

export function embeddedImage(value) {
    if (typeof value !== 'string' || value.length > 12 * 1024 * 1024) return null;
    const match = value.match(IMAGE_PATTERN);
    if (!match) return null;
    const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
    if (!bytes.length) return null;
    return { bytes, hash: createHash('sha256').update(bytes).digest('hex').slice(0, 24) };
}

export function publicImageUrl(key, index, value) {
    if (String(value).startsWith('data:')) {
        const image = embeddedImage(value);
        if (!image || !KEY_PATTERN.test(key)) return FALLBACK_IMAGE;
        return `/api/product-image?key=${encodeURIComponent(key)}&slot=${index}&v=${image.hash}`;
    }
    return safeImageUrl(value);
}

// Explicit projection: no costs, supplier fields, raw photos, or private records leave the server.
export function projectCatalog(products, legacyProducts, imageResolver = publicImageUrl) {
    const legacy = indexLegacyProducts(legacyProducts);
    const projected = [];
    const ids = new Set();
    for (const [key, row] of Object.entries(products)) {
        if (!isVisible(row)) continue;
        const old = legacy.byId.get(String(row.id || key)) || legacy.byName.get(normalize(row.nombre));
        const id = String(row.id || key);
        if (ids.has(id)) throw new Error('Duplicate public product ID');
        ids.add(id);
        const price = Number(row.precio_gs ?? row.price);
        const stock = row.stock_actual === undefined ? 99 : Number(row.stock_actual);
        const status = String(row.estado || row.status || 'normal');
        const name = String(row.nombre || 'Producto');
        const images = selectedImages(row, old).map((value, index) => imageResolver(key, index, value));
        const flag = value => value === true || String(value).toLowerCase() === 'true' || String(value) === '1';
        projected.push({
            id, name: name.toLowerCase() === 'destacado' && old ? String(old.name || old.nombre || 'Producto') : name,
            price: Number.isFinite(price) ? Math.max(0, price) : 0,
            collection: String(row.categoria || row.collection || 'General').trim(), status,
            destacado: old ? old.destacado === true : flag(row.destacado),
            popup: old ? old.popup === true : flag(row.popup),
            available: Number.isFinite(stock) && stock > 0 && !/agotado|sin stock/i.test(status),
            images: images.length ? images : [FALLBACK_IMAGE],
        });
    }
    return projected.reverse();
}

let cached;
let pending;
export async function liveCatalog() {
    if (cached && cached.expires > Date.now()) return cached.value;
    if (!pending) pending = (async () => {
        const { products, legacyProducts } = await fetchSources();
        const value = { products: projectCatalog(products, legacyProducts), updatedAt: new Date().toISOString() };
        cached = { value, expires: Date.now() + 30000 };
        return value;
    })().finally(() => { pending = null; });
    return pending;
}
