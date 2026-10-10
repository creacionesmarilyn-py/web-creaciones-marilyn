import { escapeHtml as e } from '../lib/catalog.mjs';
import { SITE_ORIGIN, categoryPath, productPath, jsonForHtml } from '../lib/links.mjs';
import { renderCategoriesHTML, renderProductGrid } from '../lib/render.mjs';

export function pageMetadata({title, description, path, image, imageAlt, structured}) {
    const url=SITE_ORIGIN+path;
    return `<title>${e(title)} | Creaciones Marilyn</title>
    <meta name="description" content="${e(description)}">
    <link rel="canonical" href="${e(url)}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Creaciones Marilyn">
    <meta property="og:locale" content="es_PY">
    <meta property="og:url" content="${e(url)}">
    <meta property="og:title" content="${e(title)} | Creaciones Marilyn">
    <meta property="og:description" content="${e(description)}">
    <meta property="og:image" content="${e(SITE_ORIGIN+image)}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${e(imageAlt || title)}">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">${jsonForHtml(structured)}</script>`;
}

export function composePage(template, {content, seed, ...metadata}) {
    return template
        .replace(/<title>[\s\S]*?<\/title>/, () => pageMetadata(metadata))
        .replace(/<!-- HOME_INTRO_START -->[\s\S]*?<!-- HOME_INTRO_END -->/, '')
        .replace(/<!-- PAGE_MAIN_START -->[\s\S]*?<!-- PAGE_MAIN_END -->/, () => `<main id="catalogo" class="container mx-auto px-4 py-12">${content}</main>`)
        .replace('<!-- CATALOG_DATA -->', () => jsonForHtml(seed))
        .replace(/<h1 class="text-2xl([\s\S]*?)<\/h1>/, '<p class="text-2xl$1</p>');
}

export function stripHomeMetadata(template) {
    return template.replace(/<meta (?:name="description"|property="og:[^"]+")[^>]*>\s*/g,'').replace(/<link rel="canonical"[^>]*>\s*/g,'');
}

function breadcrumbs(items) {
    return {'@type':'BreadcrumbList',itemListElement:items.map(([name,path],index)=>({'@type':'ListItem',position:index+1,name,item:SITE_ORIGIN+path}))};
}
export function productStructured(product, routes, image) {
    const url=SITE_ORIGIN+productPath(product,routes);
    return {'@context':'https://schema.org','@graph':[
        {'@type':'Product',name:product.name,sku:String(product.id),category:product.collection,image:[SITE_ORIGIN+image],url,
            description:product.name+' · '+product.collection+'. Consultas y pedidos por WhatsApp.',
            offers:{'@type':'Offer',url,priceCurrency:'PYG',price:product.price,
                availability:'https://schema.org/'+(product.available === false ? 'OutOfStock':'InStock'),seller:{'@type':'Organization',name:'Creaciones Marilyn'}}},
        breadcrumbs([['Inicio','/'],[product.collection,categoryPath(product.collection,routes)],[product.name,productPath(product,routes)]])
    ]};
}
export function categoryStructured(name, products, routes) {
    return {'@context':'https://schema.org','@graph':[
        {'@type':'CollectionPage',name,url:SITE_ORIGIN+categoryPath(name,routes),mainEntity:{'@type':'ItemList',numberOfItems:products.length,
            itemListElement:products.map((p,i)=>({'@type':'ListItem',position:i+1,name:p.name,url:SITE_ORIGIN+productPath(p,routes)}))}},
        breadcrumbs([['Inicio','/'],[name,categoryPath(name,routes)]])
    ]};
}
export function renderCategoryPage(name, products, allProducts, {images,routes,category}) {
    const url=SITE_ORIGIN+categoryPath(name,routes);
    return `<nav class="link-trail" aria-label="Ubicación"><a href="/">Inicio</a><span aria-hidden="true"> / </span><span>${e(name)}</span></nav>
        <div class="category-heading"><div><h1>${e(name)}</h1><p>Elegí un producto para ver sus fotos y consultar por WhatsApp.</p></div>
        <button class="detail-button detail-copy" data-action="copy-link" data-copy-url="${e(url)}">Copiar enlace de la categoría</button></div>
        <p id="share-status" class="share-status" role="status" aria-live="polite"></p>
        <label id="share-fallback" class="share-fallback" hidden>Enlace para copiar<input id="share-url" type="text" readonly value="${e(url)}"></label>
        <div class="category-tools"><label class="category-search">Buscar en esta categoría<input id="search-input" type="search" oninput="window.applyFilters()" placeholder="Nombre o color del producto"></label>
        <nav id="category-filters" class="flex gap-2 overflow-x-auto pb-2 no-scrollbar" aria-label="Categorías">${renderCategoriesHTML(allProducts,category,routes)}</nav></div>
        <p id="catalog-status" role="status" class="text-center text-sm text-gray-500 mb-4" hidden></p>
        <div id="product-grid">${renderProductGrid(products,{activeCategory:category,images,routes})}</div>`;
}
