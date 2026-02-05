// app.js - VERSIÓN FINAL ESTABILIZADA
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = [];
let activeCategory = 'todas';
let currentGallery = [];
let currentIndex = 0;

const GITHUB_RAW_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/database.json";
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

async function loadStore() {
    try {
        const response = await fetch(`${GITHUB_RAW_URL}?v=${Date.now()}`);
        const data = await response.json();
        allProducts = data.products.reverse();
        renderCategories(); // Restaurado: Dibuja los botones de colección
        applyFilters(); 
        updateCartUI();
    } catch (e) { console.error("Error en vitrina:", e); }
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
    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || "";
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
        let imgPath = (p.images ? p.images[0] : p.image).replace(/^\//, '');
        const fullImgUrl = imgPath.startsWith('http') ? imgPath : `${RAW_BASE_URL}${imgPath}?v=${Date.now()}`;
        const galleryArray = (p.images ? p.images : [p.image]).map(img => img.startsWith('http') ? img : RAW_BASE_URL + img.replace(/^\//, ''));

        const div = document.createElement('div');
        div.className = `bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group transition-all duration-500 ${isAgotado ? 'opacity-70' : 'hover:shadow-xl hover:-translate-y-1'}`;
        div.innerHTML = `
            <div class="relative h-64 overflow-hidden cursor-pointer" onclick='openGallery(${JSON.stringify(galleryArray)})'>
                <img src="${fullImgUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 ${!isAgotado ? 'group-hover:scale-110' : 'grayscale' }">
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
// ... (Aquí van tus funciones de Carrito, WhatsApp y Galería que ya tenés)
document.addEventListener('DOMContentLoaded', loadStore);