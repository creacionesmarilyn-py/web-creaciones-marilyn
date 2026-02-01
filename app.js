// app.js - Fase 4: Inteligencia de Búsqueda y Navegación
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = []; // Memoria global para filtrar sin recargar la web
let activeCategory = 'todas';

async function loadStore() {
    try {
        const response = await fetch('database.json?v=' + Date.now());
        const data = await response.json();
        // Guardamos y mostramos los más nuevos primero
        allProducts = data.products.reverse();
        
        renderCategories();
        renderProducts(allProducts);
        updateCartUI();
    } catch (e) { console.error("Error en carga:", e); }
}

// 1. Crear Botones de Categoría Automáticos
function renderCategories() {
    const container = document.getElementById('category-filters');
    // Extraemos colecciones únicas de tus productos
    const categories = ['todas', ...new Set(allProducts.map(p => p.collection.toLowerCase()))];
    
    container.innerHTML = categories.map(cat => `
        <button onclick="filterByCategory('${cat}')" 
                class="whitespace-nowrap px-6 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-300 shadow-sm
                ${cat === activeCategory ? 'bg-pink-600 text-white' : 'bg-white text-gray-400 hover:bg-gray-100'}">
            ${cat}
        </button>
    `).join('');
}

// 2. Lógica de Filtrado (Nombre + Categoría)
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    const filtered = allProducts.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm);
        const matchesCategory = activeCategory === 'todas' || p.collection.toLowerCase() === activeCategory;
        return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
}

function filterByCategory(cat) {
    activeCategory = cat;
    renderCategories();
    applyFilters();
}

// 3. Renderizar la Vitrina
function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center col-span-full py-20 text-gray-400">No encontramos ese diseño... ¡Prueba con otro nombre! ✨</p>';
        return;
    }

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-md transition-all";
        div.innerHTML = `
            <div class="relative h-64 overflow-hidden">
                <img src="${p.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter text-gray-500 italic">
                    ${p.collection}
                </div>
            </div>
            <div class="p-5 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-[11px] tracking-tight mb-1">${p.name}</h4>
                <p class="text-pink-600 font-bold mb-4 text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="addToCart(${p.id}, '${p.name}', ${p.price})" class="w-full bg-gray-900 text-white py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-black transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>
        `;
        grid.appendChild(div);
    });
}

// 4. Lógica del Carrito
function addToCart(id, name, price) {
    const item = cart.find(i => i.id === id);
    if (item) item.qty++; else cart.push({ id, name, price, qty: 1 });
    saveCart();
    toggleCart(true);
}

function removeFromCart(id) {
    const index = cart.findIndex(i => i.id === id);
    if (index !== -1) {
        if (cart[index].qty > 1) cart[index].qty--; else cart.splice(index, 1);
    }
    saveCart();
}

function saveCart() {
    localStorage.setItem('marilyn_cart', JSON.stringify(cart));
    updateCartUI();
}

function toggleCart(open = null) {
    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-overlay');
    const isOpen = !drawer.classList.contains('translate-x-full');
    if (open === true || (open === null && !isOpen)) {
        drawer.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('opacity-100'), 10);
    } else {
        drawer.classList.add('translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    container.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-300 text-[10px] py-10 uppercase tracking-widest">Carrito vacío</p>';
    }

    cart.forEach(item => {
        total += item.price * item.qty;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100";
        div.innerHTML = `
            <div class="flex-1">
                <p class="font-bold text-[10px] uppercase text-gray-700">${item.name}</p>
                <p class="text-pink-600 text-[11px] font-bold">Gs. ${item.price.toLocaleString('es-PY')}</p>
            </div>
            <div class="flex items-center gap-3 bg-white px-3 py-1 rounded-full shadow-sm border">
                <button onclick="removeFromCart(${item.id})" class="text-gray-400 hover:text-pink-500 transition px-1 text-lg">-</button>
                <span class="font-bold text-xs w-4 text-center">${item.qty}</span>
                <button onclick="addToCart(${item.id}, '${item.name}', ${item.price})" class="text-gray-400 hover:text-pink-500 transition px-1 text-lg">+</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('cart-total-display').textContent = `Gs. ${total.toLocaleString('es-PY')}`;

    let badge = document.getElementById('cart-badge');
    if (cart.length > 0) {
        if (!badge) {
            badge = document.createElement('button');
            badge.id = 'cart-badge';
            badge.className = "fixed bottom-6 right-6 bg-pink-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-[80] animate-bounce";
            badge.innerHTML = `<i class="fas fa-shopping-bag"></i><span class="absolute -top-1 -right-1 bg-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center">${cart.length}</span>`;
            badge.onclick = () => toggleCart(true);
            document.body.appendChild(badge);
        } else { badge.querySelector('span').textContent = cart.length; }
    } else if (badge) { badge.remove(); }
}

function sendWhatsApp() {
    const phone = "595991391542";
    let message = "¡Hola Marilyn! 🌸 Mi pedido es:\n\n";
    let total = 0;
    cart.forEach(item => {
        message += `✅ ${item.qty}x ${item.name} (Gs. ${(item.price * item.qty).toLocaleString('es-PY')})\n`;
        total += item.price * item.qty;
    });
    message += `\n💰 *TOTAL: Gs. ${total.toLocaleString('es-PY')}*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

document.addEventListener('DOMContentLoaded', loadStore);