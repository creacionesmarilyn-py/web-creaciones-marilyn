import { createHash } from 'node:crypto';
import { categoryKey, isCatalogProduct, slugify, productPath, categoryPath } from '../lib/links.mjs';

// Keep this ledger in Git: renaming a product must never change a shared URL.
// Removed entries reserve their paths so another product cannot inherit an old link.
export function registerRoutes(products, previous = {products:{}, categories:{}}) {
    const routes = {products:{...previous.products}, categories:{...previous.categories}};
    const used = new Set();
    for (const [kind, entries] of Object.entries(routes)) for (const path of Object.values(entries)) {
        if (!new RegExp('^/' + (kind === 'products' ? 'productos' : 'categorias') + '/[a-z0-9]+(?:-[a-z0-9]+)*$').test(path) || used.has(path)) throw new Error('Invalid or duplicate reserved route');
        used.add(path);
    }
    function reserve(kind, key, label, prefix) {
        if (Object.hasOwn(routes[kind], key)) return;
        let path = `/${prefix}/${slugify(label)}`;
        if (used.has(path)) path += '-' + createHash('sha256').update(key).digest('hex').slice(0, 10);
        if (used.has(path)) throw new Error('Route collision requires manual resolution');
        Object.defineProperty(routes[kind], key, {value:path,enumerable:true,writable:true,configurable:true});
        used.add(path);
    }
    for (const p of [...products].filter(isCatalogProduct).sort((a,b) => String(a.id).localeCompare(String(b.id), 'en'))) {
        reserve('products', String(p.id), p.name, 'productos');
        reserve('categories', categoryKey(p.collection), p.collection, 'categorias');
    }
    return routes;
}

export function publishedRoutes(products, registry) {
    const routes = {products:Object.create(null),categories:Object.create(null)};
    for (const p of products.filter(isCatalogProduct)) {
        const product = productPath(p, registry), category = categoryPath(p.collection, registry);
        if (!product || !category) throw new Error('Unregistered catalog route. Run npm run routes:sync and commit the ledger before publishing.');
        routes.products[String(p.id)] = product;
        routes.categories[categoryKey(p.collection)] = category;
    }
    return routes;
}
