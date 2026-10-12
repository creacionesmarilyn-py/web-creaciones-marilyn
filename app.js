// La vitrina llega preparada; los datos vigentes se revisan sin bloquear la primera vista.
import { escapeHtml, normalize, imageForDisplay, readCart, FALLBACK_IMAGE } from './lib/catalog.mjs';
import { renderCategoriesHTML, renderProductGrid } from './lib/render.mjs';
import { renderProductDetail } from './lib/detail.mjs';
import { SITE_ORIGIN, isCatalogProduct, categoryKey } from './lib/links.mjs';

let cart = [];
try { cart = readCart(window.localStorage); } catch { /* Storage can be blocked. */ }
let allProducts = [];
let optimizedImages = {};
let activeCategory = 'todas';
let routes = {};
let page = {type:'home'};
let currentGallery = [];
let currentIndex = 0;
let refreshing;
let lastRefresh = 0;

function showCatalogStatus(message = '') {
    const status = document.getElementById('catalog-status');
    if (status) { status.textContent = message; status.hidden = !message; }
}

function reconcileCart() {
    const products = new Map(allProducts.map(product => [String(product.id), product]));
    const before = JSON.stringify(cart);
    cart = cart.filter(item => products.get(String(item.id))?.available !== false && products.has(String(item.id)))
        .map(item => { const product = products.get(String(item.id)); return { ...item, name: product.name, price: product.price }; });
    saveCart();
    if (JSON.stringify(cart) !== before) showCatalogStatus('Actualizamos tu pedido con los precios y la disponibilidad actuales.');
}

async function refreshCatalog() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
        try {
            const response = await fetch('/api/catalog', { signal: AbortSignal.timeout(25000) });
            if (!response.ok) throw new Error('Catalog unavailable');
            const data = await response.json();
            if (!Array.isArray(data.products)) throw new Error('Invalid catalog');
            const changed = JSON.stringify(data.products) !== JSON.stringify(allProducts) || (data.routes && JSON.stringify(data.routes)!==JSON.stringify(routes));
            allProducts = data.products;
            if(data.routes)routes=data.routes;
            if (changed) { renderCategories(); applyFilters(); }
            showCatalogStatus();
            reconcileCart();
            lastRefresh = Date.now();
        } catch {
            showCatalogStatus('No pudimos actualizar la vitrina. Confirmamos precios y disponibilidad por WhatsApp.');
        }
    })().finally(() => { refreshing = null; });
    return refreshing;
}

function initializeCatalog() {
    try {
        const seed = JSON.parse(document.getElementById('catalog-data')?.textContent || '{}');
        if (Array.isArray(seed.products)) allProducts = seed.products;
        optimizedImages = seed.images || {};
        routes = seed.routes || {};
        page = seed.page || {type:'home'};
        activeCategory = page.category || 'todas';
    } catch { /* The rendered HTML remains visible while the live endpoint is retried. */ }
    updateCartUI();
    try { if (page.type === 'home') checkAnnouncements(); } catch { /* Announcements must not block shopping. */ }
    void refreshCatalog();
}

document.addEventListener('DOMContentLoaded', initializeCatalog);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRefresh > 60000) void refreshCatalog();
});

document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const id = target.dataset.productId;
    const product = allProducts.find(item => String(item.id) === id);
    switch (target.dataset.action) {
        case 'copy-link': void copyPageLink(target.dataset.copyUrl); break;
        case 'contact': if (typeof fbq === 'function') fbq('track', 'Contact'); break;
        case 'category': filterByCategory(target.dataset.category); break;
        case 'gallery': if (product) openGallery(product.images); break;
        case 'add': if (product && product.available !== false) addToCart(product.id, product.name, product.price); break;
        case 'announcement': if (product) { addToCart(product.id, product.name, product.price); closeAnnouncement(); } break;
        case 'remove': removeFromCart(id); break;
    }
});
document.addEventListener('error', event => {
    const img = event.target;
    if (img.tagName === 'IMG' && !img.src.endsWith(FALLBACK_IMAGE)) {
        img.removeAttribute('srcset'); img.src = FALLBACK_IMAGE;
    }
}, true);

window.applyFilters = applyFilters;
window.filterByCategory = filterByCategory;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.toggleCart = toggleCart;
window.openGallery = openGallery;
window.closeGallery = closeGallery;
window.nextImg = nextImg;
window.prevImg = prevImg;
window.closeAnnouncement = closeAnnouncement;
window.sendWhatsApp = sendWhatsApp;

function renderCategories() {
    const container = document.getElementById('category-filters');
    if (container) container.innerHTML = renderCategoriesHTML(allProducts, activeCategory, routes);
}
function filterByCategory(cat) { activeCategory = cat; renderCategories(); applyFilters(); }
function applyFilters() {
    if (page.type === 'product') {
        const detail = document.getElementById('product-detail');
        const product = allProducts.find(p => String(p.id) === page.id && isCatalogProduct(p));
        if (detail) detail.innerHTML = renderProductDetail(product, {images:optimizedImages,routes});
        return;
    }
    const searchTerm = normalize(document.getElementById('search-input')?.value);
    const filtered = allProducts.filter(p => normalize(p.name).includes(searchTerm)
        && (activeCategory === 'todas' || categoryKey(p.collection) === activeCategory)
        && p.status.toLowerCase() !== 'anuncio' && !p.popup);
    const grid = document.getElementById('product-grid');
    if (grid) grid.innerHTML = renderProductGrid(filtered, { activeCategory, searchTerm, images: optimizedImages, routes });
}

function checkAnnouncements() {
    const announcement = allProducts.find(p => p.popup || p.status.toLowerCase() === 'anuncio');
    if (announcement && !sessionStorage.getItem('popup_visto_' + announcement.id)) {
        const modal = document.getElementById('announcement-modal');
        const content = document.getElementById('announcement-content');
        if (!modal || !content) return;

        const imgPath = imageForDisplay(announcement.images[0], optimizedImages);

        content.innerHTML = `
            <img src="${escapeHtml(imgPath)}" alt="${escapeHtml(announcement.name)}" decoding="async" class="w-full h-72 object-cover">
            <div class="p-8 text-center">
                <span class="bg-red-100 text-red-600 text-[9px] font-black uppercase px-3 py-1 rounded-full mb-3 inline-block tracking-widest">Oferta Especial</span>
                <h2 class="text-xl font-black text-gray-900 uppercase mb-2">${escapeHtml(announcement.name)}</h2>
                <p class="text-pink-600 font-black text-2xl mb-6">Gs. ${announcement.price.toLocaleString('es-PY')}</p>
                <button data-action="announcement" data-product-id="${escapeHtml(announcement.id)}"
                    class="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold uppercase hover:bg-pink-600 shadow-xl transition-all">
                    ¡Lo quiero ahora!
                </button>
            </div>
        `;
        
        setTimeout(() => {
            modal.classList.remove('hidden'); modal.classList.add('flex');
            try { sessionStorage.setItem('popup_visto_' + announcement.id, 'true'); } catch { /* Optional persistence. */ }
        }, 2000);
    }
}

function closeAnnouncement() {
    const modal = document.getElementById('announcement-modal');
    if(modal) modal.classList.replace('flex', 'hidden');
}

function addToCart(id, name, price) { 
    const item = cart.find(i => String(i.id) === String(id)); 
    if (item) item.qty++; else cart.push({ id, name, price, qty: 1 }); 
    saveCart(); toggleCart(true); 
}
function saveCart() { try { localStorage.setItem('marilyn_cart', JSON.stringify(cart)); } catch { /* Shopping remains available without persistent storage. */ } updateCartUI(); }
function toggleCart(open = null) {
    const drawer = document.getElementById('cart-drawer'), overlay = document.getElementById('cart-overlay');
    if (!drawer || !overlay) return;
    if (open === true) { drawer.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); overlay.classList.add('opacity-100'); }
    else { drawer.classList.add('translate-x-full'); overlay.classList.add('hidden'); overlay.classList.remove('opacity-100'); }
}
function updateCartUI() {
    const container = document.getElementById('cart-items');
    if(!container) return;
    let total = 0;
    container.innerHTML = cart.length === 0 ? '<p class="text-center text-gray-400 text-[10px] py-10">Vacío</p>' : '';
    cart.forEach(item => {
        total += item.price * item.qty;
        container.innerHTML += `
            <div class="flex justify-between items-center mb-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <div class="text-left w-2/3">
                    <p class="font-bold text-[9px] uppercase line-clamp-1">${escapeHtml(item.name)}</p>
                    <p class="text-pink-600 font-bold text-[10px]">Gs. ${item.price.toLocaleString('es-PY')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button data-action="remove" data-product-id="${escapeHtml(item.id)}" aria-label="Quitar una unidad" class="w-6 h-6 bg-gray-200 rounded-full text-xs hover:bg-pink-100 transition-colors">-</button>
                    <span class="text-xs font-bold w-4 text-center">${item.qty}</span>
                    <button data-action="add" data-product-id="${escapeHtml(item.id)}" aria-label="Agregar una unidad" class="w-6 h-6 bg-gray-200 rounded-full text-xs hover:bg-pink-100 transition-colors">+</button>
                </div>
            </div>`;
    });
    const display = document.getElementById('cart-total-display');
    if(display) display.textContent = `Gs. ${total.toLocaleString('es-PY')}`;
}
function removeFromCart(id) {
    const index = cart.findIndex(i => String(i.id) === String(id));
    if (index !== -1) { if (cart[index].qty > 1) cart[index].qty--; else cart.splice(index, 1); }
    saveCart();
}

function openGallery(images) { currentGallery = images; currentIndex = 0; updateGalleryModal(); document.getElementById('gallery-modal').classList.replace('hidden', 'flex'); }
function closeGallery() { document.getElementById('gallery-modal').classList.replace('flex', 'hidden'); }
function updateGalleryModal() { 
    const modalImg = document.getElementById('modal-img');
    const counter = document.getElementById('gallery-counter');
    if(modalImg) {
        modalImg.onerror = function() { this.onerror = null; this.src = FALLBACK_IMAGE; };
        modalImg.src = imageForDisplay(currentGallery[currentIndex], optimizedImages, true);
    }
    if(counter) counter.textContent = `${currentIndex + 1} / ${currentGallery.length}`; 
}
function nextImg() { currentIndex = (currentIndex + 1) % currentGallery.length; updateGalleryModal(); }
function prevImg() { currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; updateGalleryModal(); }

function sendWhatsApp() {
    if (cart.length === 0) { alert("¡Tu carrito está vacío!"); return; }
    
    if (typeof fbq === 'function') {
        fbq('track', 'Contact');
    }

    let msg = "¡Hola Marilyn! 💎 Mi pedido es:\n\n";
    cart.forEach(i => msg += `✨ ${i.qty}x ${i.name} - Gs. ${(i.price * i.qty).toLocaleString('es-PY')}\n`);
    msg += `\n*Total estimado: Gs. ${cart.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString('es-PY')}*`;
    window.open(`https://wa.me/595991391542?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
}

async function copyPageLink(url) {
    if (typeof url !== 'string' || !url.startsWith(SITE_ORIGIN + '/')) return;
    const status = document.getElementById('share-status');
    const fallback = document.getElementById('share-fallback');
    try {
        await navigator.clipboard.writeText(url);
        if (status) status.textContent = 'Enlace copiado. Ya podés pegarlo en WhatsApp.';
        if (fallback) fallback.hidden = true;
    } catch {
        if (status) status.textContent = 'Mantené presionado el enlace para copiarlo.';
        if (fallback) fallback.hidden = false;
        const input = document.getElementById('share-url');
        if (input) { input.value = url; input.focus(); input.select(); }
    }
}
