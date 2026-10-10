import { normalize } from './catalog.mjs';

export const SITE_ORIGIN = 'https://www.creacionesmarilyn.com.py';
export const WHATSAPP_NUMBER = '595991391542';
export const categoryKey = name => String(name || 'General').toLowerCase().trim();
export const isCatalogProduct = product => !product.popup && product.status.toLowerCase() !== 'anuncio';
export const slugify = name => normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '') || 'producto';

export function productPath(product, routes = {}) {
    const path = Object.hasOwn(routes.products || {}, String(product.id)) ? routes.products[String(product.id)] : '';
    return /^\/productos\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) ? path : '';
}
export function categoryPath(name, routes = {}) {
    const key = categoryKey(name);
    const path = Object.hasOwn(routes.categories || {}, key) ? routes.categories[key] : '';
    return /^\/categorias\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path) ? path : '';
}
export function productWhatsApp(product, routes = {}) {
    const path = productPath(product, routes);
    const message = `¡Hola Marilyn! Quiero consultar por ${product.name}.\nReferencia: ${product.id}${path ? '\n' + SITE_ORIGIN + path : ''}`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
export const jsonForHtml = data => JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
