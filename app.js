// app.js - Fase 5: Inteligencia Comercial y Control de Stock
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = [];
let activeCategory = 'todas';

async function loadStore() {
    try {
        const response = await fetch('database.json?v=' + Date.now());
        const data = await response.json();
        allProducts = data.products.reverse();
        
        renderCategories();
        applyFilters(); // Renderiza inicialmente con filtros aplicados
        updateCartUI();
    } catch (e) { console.error("Error en carga:", e); }
}

function renderCategories() {
    const container = document.getElementById('category-filters');
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

function filterByCategory(cat) {
    activeCategory = cat;
    renderCategories();
    applyFilters();
}

// --- RENDERIZADO CON BADGES Y CONTROL DE STOCK ---

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    if (products.length === 0) {
        grid.innerHTML = '<p class="text-center col-span-full py-20 text-gray-400 uppercase text-[10px] tracking-[0.2em]">Sin resultados</p>';
        return;
    }

    products.forEach(p => {
        // Lógica de Estados
        const isAgotado = p.status === 'agotado';
        let badgeHTML = '';
        
        if (p.status === 'nuevo') {
            badgeHTML = `<span class="absolute top-3 left-3 bg-blue-500 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg z-10 uppercase tracking-tighter">Nuevo</span>`;
        } else if (p.status === 'oferta') {
            badgeHTML = `<span class="absolute top-3 left-3 bg-orange-500 text-white text-[9px] font-black px-2 py-1 rounded shadow-lg z-10 uppercase tracking-tighter">Oferta</span>`;
        }

        const div = document.createElement('div');
        div.className = `bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group transition-all duration-500 ${isAgotado ? 'opacity-70' : 'hover:shadow-xl hover:-translate-y-1'}`;
        
        div.innerHTML = `
            <div class="relative h-64 overflow-hidden">
                ${badgeHTML}
                ${isAgotado ? '<div class="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-20 flex items-center justify-center font-black text-gray-800 text-[10px] uppercase tracking-[0.3em] border-2 border-white/50">Sin Stock</div>' : ''}
                <img src="${p.image}" class="w-full h-full object-cover transition-transform duration-700 ${!isAgotado ? 'group-hover:scale-110' : 'grayscale-[50%]' }">
                <div class="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[9px] font-bold uppercase text-gray-500 tracking-tighter">
                    ${p.collection}
                </div>
            </div>
            <div class="p-6 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-[11px] tracking-tight mb-1">${p.name}</h4>
                <p class="text-pink-600 font-black mb-5 text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                
                ${isAgotado 
                    ? `<button disabled class="w-full bg-gray-100 text-gray-400 py-3.5 rounded-xl text-[10px] font-bold uppercase cursor-not-allowed border border-gray-200">Agotado</button>`
                    : `<button onclick="addToCart(${p.id}, '${p.name}', ${p.price})" class="w-full bg-gray-900 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase hover:bg-pink-600 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                        <i class="fas fa-shopping-bag"></i> Agregar al carrito
                       </button>`
                }
            </div>
        `;
        grid.appendChild(div);
    });
}

// --- GESTIÓN DE CARRITO (Mantenemos la lógica de la Fase 4) ---

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
        container.innerHTML = '<div class="flex flex-col items-center justify-center py-20 text-gray-300"><i class="fas fa-shopping-basket text-4xl mb-4 opacity-20"></i><p class="text-[10px] uppercase tracking-widest">Tu carrito está vacío</p></div>';
    }

    cart.forEach(item => {
        total += item.price * item.qty;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm";
        div.innerHTML = `
            <div class="flex-1 text-left">
                <p class="font-bold text-[10px] uppercase text-gray-700 mb-0.5">${item.name}</p>
                <p class="text-pink-600 text-[11px] font-black">Gs. ${item.price.toLocaleString('es-PY')}</p>
            </div>
            <div class="flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border shadow-inner">
                <button onclick="removeFromCart(${item.id})" class="text-gray-400 hover:text-pink-500 transition px-1 text-lg font-bold">-</button>
                <span class="font-black text-xs w-4 text-center">${item.qty}</span>
                <button onclick="addToCart(${item.id}, '${item.name}', ${item.price})" class="text-gray-400 hover:text-pink-500 transition px-1 text-lg font-bold">+</button>
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
            badge.className = "fixed bottom-6 right-6 bg-pink-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-[80] animate-bounce ring-4 ring-pink-100";
            badge.innerHTML = `<i class="fas fa-shopping-bag"></i><span class="absolute -top-1 -right-1 bg-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-bold">${cart.length}</span>`;
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
        const subtotal = item.price * item.qty;
        message += `✅ ${item.qty}x ${item.name} (Gs. ${subtotal.toLocaleString('es-PY')})\n`;
        total += subtotal;
    });
    message += `\n💰 *TOTAL A PAGAR: Gs. ${total.toLocaleString('es-PY')}*`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

document.addEventListener('DOMContentLoaded', loadStore);