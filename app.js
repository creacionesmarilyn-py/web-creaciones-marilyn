// app.js - FASE 3: VITRINA INTELIGENTE (Destacados + Pop-up Dinámico + Meta Tracking)
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = [];
let activeCategory = 'todas';
let currentGallery = [];
let currentIndex = 0;

const GITHUB_API_URL = "https://api.github.com/repos/creacionesmarilyn-py/web-creaciones-marilyn/contents/database.json";
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

async function loadStore() {
    try {
        const response = await fetch(`${GITHUB_API_URL}?v=${Date.now()}`);
        if (!response.ok) throw new Error("Error de conexión");
        const data = await response.json();
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        
        allProducts = content.products.reverse();
        
        renderCategories();
        applyFilters(); 
        updateCartUI();
        checkAnnouncements(); 
    } catch (e) { console.error("🚨 Error de Sincronización:", e); }
}

function renderCategories() {
    const container = document.getElementById('category-filters');
    if(!container) return;
    const categories = ['todas', ...new Set(allProducts
        .filter(p => (p.status || "").toLowerCase() !== 'anuncio')
        .map(p => (p.collection || "").toLowerCase().trim()))];
        
    container.innerHTML = categories.map(cat => `
        <button onclick="filterByCategory('${cat}')" 
            class="whitespace-nowrap px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm
            ${cat === activeCategory ? 'bg-pink-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'}">${cat}</button>
    `).join('');
}

function filterByCategory(cat) { activeCategory = cat; renderCategories(); applyFilters(); }

function applyFilters() {
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase().trim() || "";
    const filtered = allProducts.filter(p => {
        const matchesSearch = (p.name || "").toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'todas' || (p.collection || "").toLowerCase().trim() === activeCategory;
        return matchesSearch && matchesCategory && (p.status || "").toLowerCase() !== 'anuncio';
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
        const destacados = products.filter(p => p.destacado === true).slice(0, 3);
        const noDestacados = products.filter(p => p.destacado !== true);

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
                    <h3 onclick="filterByCategory('${category.toLowerCase()}')" class="text-sm font-black uppercase tracking-widest text-gray-800 cursor-pointer hover:text-pink-600 transition-colors">
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
    const statusStr = (p.status || "").toLowerCase();
    const isAgotado = statusStr.includes("agotado") || statusStr.includes("sin stock");
    const isOferta = statusStr.includes("oferta");
    const isNuevo = statusStr.includes("nuevo");

    let badgeHTML = '';
    if (isAgotado) {
        badgeHTML = `<div class="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center z-10 font-black text-gray-800 text-[10px] uppercase tracking-[0.2em]">Sin Stock</div>`;
    } else if (p.destacado) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-yellow-400 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg"><i class="fas fa-star"></i> Destacado</div>`;
    } else if (isOferta) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg animate-pulse">Oferta</div>`;
    } else if (isNuevo) {
        badgeHTML = `<div class="absolute top-3 left-3 bg-pink-500 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg">Nuevo</div>`;
    }

    const imgPath = (p.images && p.images.length > 0 ? p.images[0] : (p.image || "")).replace(/^\//, '');
    const fullImgUrl = imgPath.startsWith('http') ? imgPath : `${RAW_BASE_URL}${imgPath}?v=${Date.now()}`;
    const galleryArray = (p.images ? p.images : [p.image]).map(img => 
        (img || "").startsWith('http') ? img : `${RAW_BASE_URL}${(img || "").replace(/^\//, '')}?v=${Date.now()}`
    );

    return `
        <div class="${isHorizontal ? 'min-w-[240px] md:min-w-[300px] snap-start' : ''} bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group transition-all duration-500 hover:shadow-xl">
            <div class="relative h-48 md:h-64 overflow-hidden cursor-pointer" onclick='openGallery(${JSON.stringify(galleryArray)})'>
                ${badgeHTML}
                <img src="${fullImgUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 ${!isAgotado ? 'group-hover:scale-110' : 'grayscale' }">
                <div class="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full text-[9px] font-bold uppercase text-gray-500 z-10">${p.collection}</div>
            </div>
            <div class="p-4 md:p-6 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-[10px] md:text-[11px] mb-1 line-clamp-1">${p.name}</h4>
                <p class="text-pink-600 font-black mb-4 text-xs md:text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="${isAgotado ? '' : `addToCart(${p.id}, '${p.name}', ${p.price})`}" 
                    class="w-full ${isAgotado ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white hover:bg-pink-600'} py-3 rounded-xl text-[9px] font-bold uppercase transition-all">
                    ${isAgotado ? 'Agotado' : 'Agregar al carrito'}
                </button>
            </div>
        </div>`;
}

function checkAnnouncements() {
    const announcement = allProducts.find(p => (p.status || "").toLowerCase() === 'anuncio');
    if (announcement) {
        const modal = document.getElementById('announcement-modal');
        const content = document.getElementById('announcement-content');
        const imgPath = (announcement.images && announcement.images.length > 0 ? announcement.images[0] : announcement.image).replace(/^\//, '');
        const fullImgUrl = imgPath.startsWith('http') ? imgPath : `${RAW_BASE_URL}${imgPath}?v=${Date.now()}`;

        content.innerHTML = `
            <img src="${fullImgUrl}" class="w-full h-72 object-cover">
            <div class="p-8 text-center">
                <span class="bg-red-100 text-red-600 text-[9px] font-black uppercase px-3 py-1 rounded-full mb-3 inline-block tracking-widest">Oferta de Combo</span>
                <h2 class="text-xl font-black text-gray-900 uppercase mb-2">${announcement.name}</h2>
                <p class="text-pink-600 font-black text-2xl mb-6">Gs. ${announcement.price.toLocaleString()}</p>
                <button onclick="addToCart(${announcement.id}, '${announcement.name}', ${announcement.price}); closeAnnouncement();" 
                    class="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold uppercase hover:bg-pink-600 shadow-xl transition-all">
                    ¡Lo quiero ahora!
                </button>
            </div>
        `;
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }, 2000);
    }
}

function closeAnnouncement() {
    const modal = document.getElementById('announcement-modal');
    modal.classList.replace('flex', 'hidden');
}

function addToCart(id, name, price) { 
    const item = cart.find(i => i.id === id); 
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
        container.innerHTML += `<div class="flex justify-between items-center mb-3 bg-gray-50 p-3 rounded-lg"><div class="text-left"><p class="font-bold text-[9px] uppercase">${item.name}</p><p class="text-pink-600 font-bold text-[10px]">Gs. ${item.price.toLocaleString()}</p></div><div class="flex items-center gap-2"><button onclick="removeFromCart(${item.id})" class="w-6 h-6 bg-gray-200 rounded-full text-xs">-</button><span class="text-xs font-bold">${item.qty}</span><button onclick="addToCart(${item.id},'${item.name}',${item.price})" class="w-6 h-6 bg-gray-200 rounded-full text-xs">+</button></div></div>`;
    });
    const display = document.getElementById('cart-total-display');
    if(display) display.textContent = `Gs. ${total.toLocaleString()}`;
}
function removeFromCart(id) {
    const index = cart.findIndex(i => i.id === id);
    if (index !== -1) { if (cart[index].qty > 1) cart[index].qty--; else cart.splice(index, 1); }
    saveCart();
}
function openGallery(images) { currentGallery = images; currentIndex = 0; updateGalleryModal(); document.getElementById('gallery-modal').classList.replace('hidden', 'flex'); }
function closeGallery() { document.getElementById('gallery-modal').classList.replace('flex', 'hidden'); }
function updateGalleryModal() { 
    const modalImg = document.getElementById('modal-img');
    const counter = document.getElementById('gallery-counter');
    if(modalImg) modalImg.src = currentGallery[currentIndex]; 
    if(counter) counter.textContent = `${currentIndex + 1} / ${currentGallery.length}`; 
}
function nextImg() { currentIndex = (currentIndex + 1) % currentGallery.length; updateGalleryModal(); }
function prevImg() { currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; updateGalleryModal(); }

// FUNCIÓN ACTUALIZADA CON META TRACKING (CONTACTO)
function sendWhatsApp() {
    // DISPARO DE EVENTO A META PIXEL
    if (typeof fbq === 'function') {
        fbq('track', 'Contact');
        console.log("🚀 Meta Pixel: Evento 'Contact' enviado con éxito.");
    }

    let msg = "¡Hola Marilyn! Mi pedido es:\n\n";
    cart.forEach(i => msg += `✨ ${i.qty}x ${i.name} - Gs. ${(i.price * i.qty).toLocaleString()}\n`);
    msg += `\n*Total: Gs. ${cart.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString()}*`;
    window.open(`https://wa.me/595991391542?text=${encodeURIComponent(msg)}`, '_blank');
}

document.addEventListener('DOMContentLoaded', loadStore);