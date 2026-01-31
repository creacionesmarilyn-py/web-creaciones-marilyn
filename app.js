// app.js - Lógica de Ventas Creaciones Marilyn
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];

// 1. Cargar Vitrina desde la Nube
async function loadStore() {
    try {
        const response = await fetch('database.json?v=' + Date.now());
        const data = await response.json();
        renderProducts(data.products);
        updateCartUI();
    } catch (e) {
        console.error("Error cargando vitrina:", e);
    }
}

// 2. Dibujar Productos con Botón "+" 
function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';

    products.reverse().forEach(p => {
        const div = document.createElement('div');
        div.className = "bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 group hover:shadow-md transition-all";
        div.innerHTML = `
            <div class="relative overflow-hidden h-64">
                <img src="${p.image}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter text-gray-500 italic">
                    ${p.collection}
                </div>
            </div>
            <div class="p-5 text-center">
                <h4 class="font-bold text-gray-800 uppercase text-sm tracking-tight mb-1">${p.name}</h4>
                <p class="text-pink-600 font-bold mb-4">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="addToCart(${p.id}, '${p.name}', ${p.price})" class="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-bold uppercase hover:bg-black transition flex items-center justify-center gap-2">
                    <i class="fas fa-plus"></i> Agregar al carrito
                </button>
            </div>
        `;
        grid.appendChild(div);
    });
}

// 3. Lógica del Carrito (LocalStorage)
function addToCart(id, name, price) {
    cart.push({ id, name, price });
    localStorage.setItem('marilyn_cart', JSON.stringify(cart));
    updateCartUI();
}

function clearCart() {
    cart = [];
    localStorage.removeItem('marilyn_cart');
    updateCartUI();
}

// 4. Interfaz del Carrito y Botón WhatsApp
function updateCartUI() {
    // Creamos o actualizamos el botón flotante de WhatsApp
    let checkoutBtn = document.getElementById('whatsapp-checkout');
    
    if (cart.length > 0) {
        if (!checkoutBtn) {
            checkoutBtn = document.createElement('button');
            checkoutBtn.id = 'whatsapp-checkout';
            checkoutBtn.className = "fixed bottom-6 right-6 bg-green-500 text-white px-6 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[100] hover:bg-green-600 transition-all transform scale-100 active:scale-90 font-bold";
            document.body.appendChild(checkoutBtn);
        }
        
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        checkoutBtn.innerHTML = `
            <i class="fab fa-whatsapp text-2xl"></i>
            <div class="text-left leading-tight">
                <p class="text-[10px] uppercase opacity-80">Enviar Pedido (${cart.length})</p>
                <p class="text-sm">Gs. ${total.toLocaleString('es-PY')}</p>
            </div>
        `;
        checkoutBtn.onclick = sendWhatsApp;
    } else if (checkoutBtn) {
        checkoutBtn.remove();
    }
}

// 5. El Final: Checkout por WhatsApp
function sendWhatsApp() {
    const phone = "595981000000"; // PON AQUÍ TU NÚMERO REAL
    let message = "¡Hola Marilyn! 🌸 Quiero realizar este pedido:\n\n";
    
    const summary = cart.reduce((acc, item) => {
        acc[item.name] = (acc[item.name] || 0) + 1;
        return acc;
    }, {});

    for (const [name, qty] of Object.entries(summary)) {
        message += `✅ ${qty}x ${name}\n`;
    }

    const total = cart.reduce((sum, item) => sum + item.price, 0);
    message += `\n💰 *Total Estimado: Gs. ${total.toLocaleString('es-PY')}*\n\n📍 ¿Me confirmas disponibilidad para coordinar?`;
    
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    clearCart();
}

document.addEventListener('DOMContentLoaded', loadStore);