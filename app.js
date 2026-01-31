// app.js - Gestión de Carrito Inteligente
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];

async function loadStore() {
    try {
        const response = await fetch('database.json?v=' + Date.now());
        const data = await response.json();
        renderProducts(data.products);
        updateCartUI();
    } catch (e) {
        console.error("Error cargando la vitrina:", e);
    }
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    products.reverse().forEach(p => {
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
                <h4 class="font-bold text-gray-800 uppercase text-xs tracking-tight mb-1">${p.name}</h4>
                <p class="text-pink-600 font-bold mb-4">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="addToCart(${p.id}, '${p.name}', ${p.price})" class="w-full bg-gray-900 text-white py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-black transition-all flex items-center justify-center gap-2">
                    <i class="fas fa-plus"></i> Agregar
                </button>
            </div>
        `;
        grid.appendChild(div);
    });
}

// --- LÓGICA DEL CARRITO ---

function addToCart(id, name, price) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ id, name, price, qty: 1 });
    }
    saveCart();
    toggleCart(true); // Abre el carrito automáticamente al agregar
}

function removeFromCart(id) {
    const index = cart.findIndex(item => item.id === id);
    if (index !== -1) {
        if (cart[index].qty > 1) {
            cart[index].qty--;
        } else {
            cart.splice(index, 1);
        }
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
        container.innerHTML = '<p class="text-center text-gray-400 text-sm py-10">Tu carrito está vacío</p>';
    }

    cart.forEach(item => {
        total += item.price * item.qty;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-100";
        div.innerHTML = `
            <div class="flex-1">
                <p class="font-bold text-[11px] uppercase text-gray-700">${item.name}</p>
                <p class="text-pink-600 text-xs font-bold">Gs. ${item.price.toLocaleString('es-PY')}</p>
            </div>
            <div class="flex items-center gap-3 bg-white px-3 py-1 rounded-full shadow-sm border">
                <button onclick="removeFromCart(${item.id})" class="text-gray-400 hover:text-pink-500 transition px-1">-</button>
                <span class="font-bold text-xs w-4 text-center">${item.qty}</span>
                <button onclick="addToCart(${item.id}, '${item.name}', ${item.price})" class="text-gray-400 hover:text-pink-500 transition px-1">+</button>
            </div>
        `;
        container.appendChild(div);
    });

    document.getElementById('cart-total-display').textContent = `Gs. ${total.toLocaleString('es-PY')}`;

    // Botón flotante de acceso rápido
    let badge = document.getElementById('cart-badge');
    if (cart.length > 0) {
        if (!badge) {
            badge = document.createElement('button');
            badge.id = 'cart-badge';
            badge.className = "fixed bottom-6 right-6 bg-pink-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center z-[80] animate-bounce hover:bg-pink-700 transition";
            badge.innerHTML = `<i class="fas fa-shopping-bag"></i><span class="absolute -top-1 -right-1 bg-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center">${cart.length}</span>`;
            badge.onclick = () => toggleCart(true);
            document.body.appendChild(badge);
        } else {
            badge.querySelector('span').textContent = cart.length;
        }
    } else if (badge) {
        badge.remove();
    }
}

function sendWhatsApp() {
    const phone = "595981000000"; // <--- CAMBIA ESTO POR TU NÚMERO REAL
    let message = "¡Hola Marilyn! 🌸 Mi pedido es:\n\n";
    let total = 0;

    cart.forEach(item => {
        const subtotal = item.price * item.qty;
        message += `✅ ${item.qty}x ${item.name}\n   (Subtotal: Gs. ${subtotal.toLocaleString('es-PY')})\n\n`;
        total += subtotal;
    });

    message += `💰 *TOTAL A PAGAR: Gs. ${total.toLocaleString('es-PY')}*`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
}

document.addEventListener('DOMContentLoaded', loadStore);