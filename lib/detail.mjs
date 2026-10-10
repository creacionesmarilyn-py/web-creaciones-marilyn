import { escapeHtml as e, imageForDisplay } from './catalog.mjs';
import { SITE_ORIGIN, productPath, categoryPath, productWhatsApp } from './links.mjs';

export function renderProductDetail(product, {images = {}, routes = {}} = {}) {
    if (!product) return '<div class="detail-empty"><h1>Este producto ya no está disponible</h1><p>Podés encontrar otras opciones en nuestra vitrina.</p><a href="/">Volver al catálogo</a></div>';
    const path=productPath(product,routes);
    const available=product.available !== false;
    const photo=imageForDisplay(product.images[0],images,true);
    const link=SITE_ORIGIN+path;
    return `<nav class="link-trail" aria-label="Ubicación"><a href="/">Inicio</a><span aria-hidden="true"> / </span><a href="${e(categoryPath(product.collection,routes) || '/')}">${e(product.collection)}</a></nav>
    <div class="detail-layout">
        <div class="detail-media">
            <button type="button" data-action="gallery" data-product-id="${e(product.id)}" aria-label="Ampliar fotos de ${e(product.name)}" class="detail-photo">
                <img src="${e(photo)}" alt="${e(product.name)}" width="1200" height="1200" fetchpriority="high" decoding="async">
            </button>
            <p class="detail-photo-hint">Tocá la foto para ampliarla${product.images.length > 1 ? ' · '+product.images.length+' fotos' : ''}</p>
        </div>
        <div class="detail-info">
            <a class="detail-category" href="${e(categoryPath(product.collection,routes) || '/')}">${e(product.collection)}</a>
            <h1>${e(product.name)}</h1>
            <p class="detail-price">Gs. ${product.price.toLocaleString('es-PY')}</p>
            <p class="detail-availability${available ? '' : ' is-unavailable'}">${available ? 'Disponible para consultar' : 'Agotado por el momento'}</p>
            <p class="detail-note">Confirmamos el precio, la disponibilidad y el envío por WhatsApp.</p>
            <div class="detail-actions">
                <a class="detail-button detail-whatsapp" data-action="contact" href="${e(productWhatsApp(product,routes))}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp" aria-hidden="true"></i> Consultar por WhatsApp</a>
                <button class="detail-button detail-add" data-action="add" data-product-id="${e(product.id)}" ${available ? '' : 'disabled'}>${available ? 'Agregar al pedido' : 'Agotado'}</button>
                <button class="detail-button detail-copy" data-action="copy-link" data-copy-url="${e(link)}">Copiar enlace del producto</button>
            </div>
            <p id="share-status" class="share-status" role="status" aria-live="polite"></p>
            <label id="share-fallback" class="share-fallback" hidden>Enlace para copiar<input id="share-url" type="text" readonly value="${e(link)}"></label>
            <p class="detail-reference">Referencia: ${e(product.id)}</p>
        </div>
    </div>`;
}
