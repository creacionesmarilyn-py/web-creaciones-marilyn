// app.js - FASE 3: VITRINA INTELIGENTE EN TIEMPO REAL (FIREBASE - 100% LOCAL IMG)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBmPvAk_lSJ1TlBVtMqKAC1HaPM5eVeZxo",
    authDomain: "creaciones-marilyn.firebaseapp.com",
    databaseURL: "https://creaciones-marilyn-default-rtdb.firebaseio.com",
    projectId: "creaciones-marilyn",
    storageBucket: "creaciones-marilyn.firebasestorage.app",
    messagingSenderId: "565099684746",
    appId: "1:565099684746:web:a99ccfb9796aea22725e73"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- ESTADO GLOBAL ---
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = [];
let activeCategory = 'todas';
let currentGallery = [];
let currentIndex = 0;

// --- INICIALIZACIÓN EN TIEMPO REAL ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Conectando Vitrina a Firebase (Rutas Locales)...");
    
    const productosRef = ref(db, 'productos');
    onValue(productosRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            allProducts = Object.keys(data).map(key => {
                const p = data[key];
                
                // 1. BLINDAJE DE IMÁGENES (Leemos de la propia web, no de GitHub)
                let rawImages = p.images || p.image || p.imagen || ['img/logo_jpg.jpg'];
                if (!Array.isArray(rawImages)) {
                    rawImages = [rawImages]; 
                }
                
                let finalImages = rawImages.filter(img => img && String(img).trim() !== "").map(img => {
                    const strImg = String(img);
                    if (strImg.startsWith('http') || strImg.startsWith('blob:')) return strImg;
                    // Ruta local directa (Vercel ya tiene las fotos)
                    return strImg.replace(/^\//, '');
                });
                
                if (finalImages.length === 0) finalImages = ['img/logo_jpg.jpg'];

                // 2. BLINDAJE DE LÓGICAS (Captura cualquier formato de verdadero/falso)
                const esDestacado = p.destacado === true || String(p.destacado).toLowerCase() === 'true' || String(p.destacado) === '1';
                const esPopup = p.popup === true || String(p.popup).toLowerCase() === 'true' || String(p.popup) === '1';

                return {
                    id: p.id || key,
                    name: p.nombre || p.name || 'Producto sin nombre',
                    price: parseFloat(p.precio_gs || p.price || 0),
                    collection: p.categoria || p.collection || 'General',
                    status: p.estado || p.status || 'normal',
                    destacado: esDestacado,
                    popup: esPopup,
                    stock_actual: p.stock_actual !== undefined ? parseFloat(p.stock_actual) : 99,
                    images: finalImages
                };
            }).filter(p => p.status.toLowerCase() !== 'inactivo'); 
            
            allProducts.reverse();
            console.log(`✅ ${allProducts.length} productos procesados exitosamente.`);
        } else {
            allProducts = [];
        }

        renderCategories();
        applyFilters(); 
        updateCartUI();
        checkAnnouncements();
    });
});

// --- EXPORTAR FUNCIONES AL HTML ---
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

// --- LÓGICA DE VITRINA ---
function renderCategories() {
    const container = document.getElementById('category-filters');
    if(!container) return;
    const categories = ['todas', ...new Set(allProducts
        .filter(p => p.status.toLowerCase() !== 'anuncio' && !p.popup)
        .map(p => p.collection.toLowerCase().trim()))].sort();
        
    container.innerHTML = categories.map(cat => `
        <button onclick="window.filterByCategory('${cat}')" 
            class="whitespace-nowrap px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm
            ${cat === activeCategory ? 'bg-pink-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'}">${cat}</button>
    `).join('');
}

function filterByCategory(cat) { activeCategory = cat; renderCategories(); applyFilters(); }

function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase().trim() || "";
    const filtered = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'todas' || p.collection.toLowerCase().trim() === activeCategory;
        return matchesSearch && matchesCategory && p.status.toLowerCase() !== 'anuncio' && !p.popup;
    });
    renderProducts(filtered);
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    if(!grid) return;

    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center col-span-full py-20 text-gray-400 uppercase text-[10px]">Sin resultados</p>';
        return;
    }

    const searchTerm = document.getElementById('search-input')?.value.toLowerCase().trim() || "";

    if (activeCategory === 'todas' && searchTerm === "") {
        const destacados = products.filter(p => p.destacado).slice(0, 6);
        const noDestacados = products.filter(p => !p.destacado);

        const grouped = noDestacados.reduce((acc, p) => {
            const col = p.collection || "Otros";
            if (!acc[col]) acc[col] = [];
            acc[col].push(p);
            return acc;
        }, {});

        let finalHTML = '';

        if (destacados.length > 0) {
            finalHTML += `
                <div class="category-section mb-12">
                    <div class="flex justify-between items-center mb-6 px-2">
                        <h3 class="text-sm font-black uppercase tracking-[0.2em] text-pink-600">
                            <i class="fas fa-star mr-2"></i> Destacados de la Semana
                        </h3>
                    </div>
                    <div class="flex overflow-x-auto space-x-6 pb-6 no-scrollbar snap-x snap-mandatory">
                        ${destacados.map(p => createProductCard(p, true)).join('')}
                    </div>
                </div>
                <div class="h-px bg-gray-100 mb-12"></div>
            `;
        }

        finalHTML += Object.keys(grouped).sort().map(category => `
            <div class="category-section">
                <div class="flex justify-between items-center mb-6 px-2">
                    <h3 onclick="window.filterByCategory('${category.toLowerCase()}')" class="text-sm font-black uppercase tracking-widest text-gray-800 cursor-pointer hover:text-pink-600 transition-colors">
                        ${category} <i class="fas fa-chevron-right text-[10px] ml-2 opacity-30"></i>
                    </h3>
                    <span class="text-[9px] text-gray-400 font-bold uppercase">${grouped[category].length} items</span>
                </div>
                <div class="flex overflow-x-auto space-x-6 pb-6 no-scrollbar snap-x snap-mandatory">
                    ${grouped[category].map(p => createProductCard(p, true)).join('')}
                </div>
            </div>
        `).join('');

        grid.innerHTML = finalHTML;
    } else {
        const sorted = [...products].sort((a, b) => (b.destacado === true) - (a.destacado === true));
        grid.innerHTML = `<div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            ${sorted.map(p => createProductCard(p, false)).join('')}
        </div>`;
    }
}

function createProductCard(p, isHorizontal = false) {
    const statusStr = p.status.toLowerCase();
    const isAgotado = statusStr.includes("agotado") || statusStr.includes("sin stock") || p.stock_actual <= 0;
    const isOferta = statusStr.includes("oferta");
    const isNuevo = statusStr.includes("nuevo");

    let badgeHTML = '';
    if (isAgotado) {
        badgeHTML = `<div class="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 font-black text-gray-900 text-[12px] uppercase tracking-[0.2em]">Agotado</div>`;
    } else if (p.destacado) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-yellow-400 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg"><i class="fas fa-star"></i> Destacado</div>`;
    } else if (isOferta) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg animate-pulse">Oferta</div>`;
    } else if (isNuevo) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-pink-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg">Nuevo</div>`;
    }

    const mainImage = p.images[0];
    const galleryString = JSON.stringify(p.images).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

    return `
        <div class="${isHorizontal ? 'min-w-[240px] md:min-w-[300px] snap-start' : ''} bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group transition-all duration-500 hover:shadow-xl relative">
            <div class="relative h-48 md:h-64 overflow-hidden cursor-pointer bg-gray-50 flex items-center justify-center" onclick="window.openGallery(${galleryString})">
                ${badgeHTML}
                <img src="${mainImage}" loading="lazy" onerror="this.src='img/logo_jpg.jpg'" class="w-full h-full object-cover transition-transform duration-700 ${!isAgotado ? 'group-hover:scale-110' : 'grayscale opacity-70' }">
                <div class="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full text-[9px] font-bold uppercase text-gray-500 z-10">${p.collection}</div>
            </div>
            <div class="p-4 md:p-6 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-[10px] md:text-[11px] mb-1 line-clamp-1" title="${p.name}">${p.name}</h4>
                <p class="text-pink-600 font-black mb-4 text-xs md:text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="${isAgotado ? '' : `window.addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price})`}" 
                    class="w-full ${isAgotado ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-pink-600 cursor-pointer'} py-3 rounded-xl text-[9px] font-bold uppercase transition-all">
                    ${isAgotado ? 'Agotado' : 'Agregar al carrito'}
                </button>
            </div>
        </div>`;
}

function checkAnnouncements() {
    const announcement = allProducts.find(p => p.popup || p.status.toLowerCase() === 'anuncio');
    if (announcement && !sessionStorage.getItem('popup_visto_' + announcement.id)) {
        const modal = document.getElementById('announcement-modal');
        const content = document.getElementById('announcement-content');
        if (!modal || !content) return;

        const imgPath = announcement.images[0];

        content.innerHTML = `
            <img src="${imgPath}" onerror="this.src='img/logo_jpg.jpg'" class="w-full h-72 object-cover">
            <div class="p-8 text-center">
                <span class="bg-red-100 text-red-600 text-[9px] font-black uppercase px-3 py-1 rounded-full mb-3 inline-block tracking-widest">Oferta Especial</span>
                <h2 class="text-xl font-black text-gray-900 uppercase mb-2">${announcement.name}</h2>
                <p class="text-pink-600 font-black text-2xl mb-6">Gs. ${announcement.price.toLocaleString('es-PY')}</p>
                <button onclick="window.addToCart('${announcement.id}', '${announcement.name.replace(/'/g, "\\'")}', ${announcement.price}); window.closeAnnouncement();" 
                    class="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold uppercase hover:bg-pink-600 shadow-xl transition-all">
                    ¡Lo quiero ahora!
                </button>
            </div>
        `;
        
        setTimeout(() => {
            modal.classList.remove('hidden'); modal.classList.add('flex');
            sessionStorage.setItem('popup_visto_' + announcement.id, 'true');
        }, 2000);
    }
}

function closeAnnouncement() {
    const modal = document.getElementById('announcement-modal');
    if(modal) modal.classList.replace('flex', 'hidden');
}

// --- LÓGICA DEL CARRITO ---
function addToCart(id, name, price) { 
    const item = cart.find(i => String(i.id) === String(id)); 
    if (item) item.qty++; else cart.push({ id, name, price, qty: 1 }); 
    saveCart(); toggleCart(true); 
}
function saveCart() { localStorage.setItem('marilyn_cart', JSON.stringify(cart)); updateCartUI(); }
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
                    <p class="font-bold text-[9px] uppercase line-clamp-1">${item.name}</p>
                    <p class="text-pink-600 font-bold text-[10px]">Gs. ${item.price.toLocaleString('es-PY')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="window.removeFromCart('${item.id}')" class="w-6 h-6 bg-gray-200 rounded-full text-xs hover:bg-pink-100 transition-colors">-</button>
                    <span class="text-xs font-bold w-4 text-center">${item.qty}</span>
                    <button onclick="window.addToCart('${item.id}','${item.name.replace(/'/g, "\\'")}',${item.price})" class="w-6 h-6 bg-gray-200 rounded-full text-xs hover:bg-pink-100 transition-colors">+</button>
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

// --- GALERÍA ---
function openGallery(images) { currentGallery = images; currentIndex = 0; updateGalleryModal(); document.getElementById('gallery-modal').classList.replace('hidden', 'flex'); }
function closeGallery() { document.getElementById('gallery-modal').classList.replace('flex', 'hidden'); }
function updateGalleryModal() { 
    const modalImg = document.getElementById('modal-img');
    const counter = document.getElementById('gallery-counter');
    if(modalImg) {
        modalImg.onerror = function() { this.src = 'img/logo_jpg.jpg'; }; 
        modalImg.src = currentGallery[currentIndex]; 
    }
    if(counter) counter.textContent = `${currentIndex + 1} / ${currentGallery.length}`; 
}
function nextImg() { currentIndex = (currentIndex + 1) % currentGallery.length; updateGalleryModal(); }
function prevImg() { currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; updateGalleryModal(); }

// --- CHECKOUT META TRACKING ---
function sendWhatsApp() {
    if (cart.length === 0) { alert("¡Tu carrito está vacío!"); return; }
    
    if (typeof fbq === 'function') {
        fbq('track', 'Contact');
    }

    let msg = "¡Hola Marilyn! 💎 Mi pedido es:\n\n";
    cart.forEach(i => msg += `✨ ${i.qty}x ${i.name} - Gs. ${(i.price * i.qty).toLocaleString('es-PY')}\n`);
    msg += `\n*Total estimado: Gs. ${cart.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString('es-PY')}*`;
    window.open(`https://wa.me/595991391542?text=${encodeURIComponent(msg)}`, '_blank');
}