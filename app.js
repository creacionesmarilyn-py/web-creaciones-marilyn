// app.js - Fase 12: VITRINA PÚBLICA (SINCRONIZADA)
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = [];
let activeCategory = 'todas';
let currentGallery = [];
let currentIndex = 0;

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/database.json";

async function loadStore() {
    try {
        const response = await fetch(`${GITHUB_RAW_URL}?v=${Date.now()}`);
        if (!response.ok) throw new Error("Error en red");
        const data = await response.json();
        allProducts = data.products.reverse();
        renderCategories();
        applyFilters(); 
        updateCartUI();
    } catch (e) { 
        console.error("Error:", e);
    }
}

function renderCategories() {
    const container = document.getElementById('category-filters');
    if(!container) return;
    const categories = ['todas', ...new Set(allProducts.map(p => p.collection.toLowerCase()))];
    container.innerHTML = categories.map(cat => `
        <button onclick="filterByCategory('${cat}')" 
                class="whitespace-nowrap px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm
                ${cat === activeCategory ? 'bg-pink-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'}">
            ${cat}
        </button>
    `).join('');
}

function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const filtered = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'todas' || p.collection.toLowerCase() === activeCategory;
        return matchesSearch && matchesCategory;
    });
    renderProducts(filtered);
}

function filterByCategory(cat) { activeCategory = cat; renderCategories(); applyFilters(); }

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = products.length === 0 ? '<p class="text-center col-span-full py-20 text-gray-400 uppercase text-[10px]">Sin resultados</p>' : '';
    products.forEach(p => {
        const isAgotado = p.status === 'agotado';
        const mainImg = p.images ? p.images[0] : p.image;
        const galleryArray = p.images ? p.images : [p.image];
        const div = document.createElement('div');
        div.className = `bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group transition-all duration-500 ${isAgotado ? 'opacity-70' : 'hover:shadow-xl hover:-translate-y-1'}`;
        div.innerHTML = `
            <div class="relative h-64 overflow-hidden cursor-pointer" onclick='openGallery(${JSON.stringify(galleryArray)})'>
                <img src="${mainImg}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 ${!isAgotado ? 'group-hover:scale-110' : 'grayscale' }">
                <div class="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-full text-[9px] font-bold uppercase text-gray-500">${p.collection}</div>
            </div>
            <div class="p-6 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-[11px] mb-1">${p.name}</h4>
                <p class="text-pink-600 font-black mb-5 text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="${isAgotado ? '' : `addToCart(${p.id}, '${p.name}', ${p.price})`}" 
                        class="w-full ${isAgotado ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white hover:bg-pink-600'} py-3.5 rounded-xl text-[10px] font-bold uppercase transition-all">
                    ${isAgotado ? 'Agotado' : 'Agregar al carrito'}
                </button>
            </div>
        `;
        grid.appendChild(div);
    });
}

// FUNCIONES AUXILIARES (Galería, Carrito, WhatsApp)
function openGallery(images) { currentGallery = images; currentIndex = 0; updateGalleryModal(); document.getElementById('gallery-modal').classList.replace('hidden', 'flex'); }
function closeGallery() { document.getElementById('gallery-modal').classList.replace('flex', 'hidden'); }
function updateGalleryModal() { document.getElementById('modal-img').src = currentGallery[currentIndex]; document.getElementById('gallery-counter').textContent = `${currentIndex + 1} / ${currentGallery.length}`; }
function nextImg() { currentIndex = (currentIndex + 1) % currentGallery.length; updateGalleryModal(); }
function prevImg() { currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length; updateGalleryModal(); }
function addToCart(id, name, price) { const item = cart.find(i => i.id === id); if (item) item.qty++; else cart.push({ id, name, price, qty: 1 }); saveCart(); toggleCart(true); }
function removeFromCart(id) { const index = cart.findIndex(i => i.id === id); if (index !== -1) { if (cart[index].qty > 1) cart[index].qty--; else cart.splice(index, 1); } saveCart(); }
function saveCart() { localStorage.setItem('marilyn_cart', JSON.stringify(cart)); updateCartUI(); }
function toggleCart(open = null) { 
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    if (open === true) { drawer.classList.remove('translate-x-full'); overlay.classList.remove('hidden'); }
    else { drawer.classList.add('translate-x-full'); overlay.classList.add('hidden'); }
}
function updateCartUI() {
    const container = document.getElementById('cart-items');
    if(!container) return;
    let total = 0;
    container.innerHTML = cart.length === 0 ? '<p class="text-center text-gray-400 text-[10px] py-10">Vacío</p>' : '';
    cart.forEach(item => {
        total += item.price * item.qty;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center mb-2 bg-gray-50 p-3 rounded-lg";
        div.innerHTML = `<div class="text-left"><p class="font-bold text-[9px] uppercase">${item.name}</p><p class="text-pink-600 font-bold text-[10px]">Gs. ${item.price.toLocaleString()}</p></div>
                        <div class="flex items-center gap-2"><button onclick="removeFromCart(${item.id})">-</button><span>${item.qty}</span><button onclick="addToCart(${item.id},'${item.name}',${item.price})">+</button></div>`;
        container.appendChild(div);
    });
    document.getElementById('cart-total-display').textContent = `Gs. ${total.toLocaleString()}`;
}
function sendWhatsApp() {
    let msg = "¡Hola Marilyn! Mi pedido:\n\n";
    cart.forEach(i => msg += `✅ ${i.qty}x ${i.name}\n`);
    window.open(`https://wa.me/595991391542?text=${encodeURIComponent(msg)}`, '_blank');
}

document.addEventListener('DOMContentLoaded', loadStore);