// app.js - Fase 12: VITRINA PROFESIONAL (Sincronización Total)
let cart = JSON.parse(localStorage.getItem('marilyn_cart')) || [];
let allProducts = [];
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/database.json";
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

async function loadStore() {
    try {
        const response = await fetch(`${GITHUB_RAW_URL}?v=${Date.now()}`);
        const data = await response.json();
        allProducts = data.products.reverse();
        renderProducts(allProducts);
        updateCartUI();
    } catch (e) { console.error("Error en vitrina:", e); }
}

function renderProducts(products) {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    grid.innerHTML = '';
    
    products.forEach(p => {
        // LIMPIEZA DE RUTA: Eliminamos barras iniciales para evitar el error de "doble barra"
        let imgPath = (p.images ? p.images[0] : p.image).replace(/^\//, '');
        // ROMPE-CACHÉ: Agregamos ?v= al final para que la imagen cargue al instante
        const fullImgUrl = imgPath.startsWith('http') ? imgPath : `${RAW_BASE_URL}${imgPath}?v=${Date.now()}`;

        const div = document.createElement('div');
        div.className = "bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group";
        div.innerHTML = `
            <div class="relative h-64 overflow-hidden">
                <img src="${fullImgUrl}" class="w-full h-full object-cover">
            </div>
            <div class="p-6 text-center">
                <h4 class="font-bold text-[11px] uppercase mb-1">${p.name}</h4>
                <p class="text-pink-600 font-black mb-5 text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                <button onclick="addToCart(${p.id}, '${p.name}', ${p.price})" class="w-full bg-gray-900 text-white py-3.5 rounded-xl text-[10px] font-bold uppercase">Agregar</button>
            </div>
        `;
        grid.appendChild(div);
    });
}
// (Mantener el resto de funciones de carrito/whatsapp igual)
document.addEventListener('DOMContentLoaded', loadStore);