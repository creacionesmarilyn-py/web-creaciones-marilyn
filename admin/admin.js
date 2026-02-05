// admin.js - Fase 12: VERSIÓN FINAL FUNCIONAL
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

let sha = "";
let products = [];

// --- 1. ACCESO Y SEGURIDAD ---
function checkAccess() {
    const overlay = document.getElementById('login-overlay');
    if (itoken) {
        overlay.classList.add('hidden');
        loadProductsAdmin();
    } else {
        overlay.classList.remove('hidden');
    }
}

function saveToken() {
    const tokenInput = document.getElementById('gh-token').value.trim();
    if (tokenInput) {
        localStorage.setItem('itoken', tokenInput);
        itoken = tokenInput;
        checkAccess();
    }
}

function logout() {
    localStorage.removeItem('itoken');
    location.reload();
}

// --- 2. CARGA DE DATOS ---
async function loadProductsAdmin() {
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${itoken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.status === 401) { logout(); return; }

        const data = await response.json();
        sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        products = content.products;
        
        renderAdminProducts();
        updateProductCount();
    } catch (e) { console.error("Error cargando:", e); }
}

function updateProductCount() {
    const counter = document.getElementById('product-count');
    if (counter) counter.textContent = `${products.length} diseños en vitrina`;
}

// --- 3. RENDERIZADO (DIBUJO) ---
function renderAdminProducts() {
    const container = document.getElementById('admin-product-list'); 
    if (!container) return;

    container.innerHTML = products.map(p => {
        const imgPath = p.images ? p.images[0] : p.image;
        const fullImgUrl = imgPath.startsWith('http') ? imgPath : RAW_BASE_URL + imgPath;

        return `
            <div class="flex justify-between items-center py-4 border-b border-gray-50 last:border-none group">
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <img src="${fullImgUrl}" class="w-12 h-12 rounded-xl object-cover border border-gray-100 shadow-sm">
                        <span class="absolute -top-1 -right-1 w-3 h-3 ${p.status === 'agotado' ? 'bg-red-500' : 'bg-green-500'} rounded-full border-2 border-white"></span>
                    </div>
                    <div>
                        <p class="font-black text-[11px] uppercase text-gray-800 tracking-tight leading-none mb-1">${p.name}</p>
                        <p class="text-pink-600 font-black text-xs">Gs. ${p.price.toLocaleString()}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="openEditModal(${p.id}, ${p.price}, '${p.status}')" class="text-gray-300 hover:text-blue-500 p-2 transition-all"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteProduct(${p.id})" class="text-gray-300 hover:text-red-500 p-2 transition-all"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// --- 4. CREAR NUEVO PRODUCTO ---
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Subiendo...';

    const name = document.getElementById('p-name').value;
    const price = parseInt(document.getElementById('p-price').value);
    const collection = document.getElementById('p-collection').value;
    const status = document.getElementById('p-status').value;
    const files = document.getElementById('p-image-file').files;

    // Generamos rutas de imagen (asumiendo que las subirás a la carpeta img/)
    const imageUrls = Array.from(files).map(file => `img/${file.name}`);

    const newProduct = {
        id: Date.now(),
        name,
        price,
        collection,
        status,
        image: imageUrls[0],
        images: imageUrls
    };

    const newProducts = [...products, newProduct];
    await saveToGitHub(newProducts, "Nuevo producto agregado");
});

// --- 5. EDITAR STOCK Y PRECIO ---
function openEditModal(id, price, status) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-status').value = status;
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveProductEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const newPrice = parseInt(document.getElementById('edit-price').value);
    const newStatus = document.getElementById('edit-status').value;

    const newProducts = products.map(p => 
        p.id === id ? { ...p, price: newPrice, status: newStatus } : p
    );

    await saveToGitHub(newProducts, "Producto editado");
}

// --- 6. GUARDAR EN GITHUB ---
async function saveToGitHub(newProducts, msg) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, content: newContent, sha: sha })
        });

        if (response.ok) {
            alert("✅ ¡Éxito! La vitrina se está actualizando.");
            location.reload();
        } else {
            alert("❌ Error al guardar.");
        }
    } catch (e) { console.error(e); }
}

async function deleteProduct(id) {
    if(!confirm("¿Borrar este diseño?")) return;
    const newProducts = products.filter(p => p.id !== id);
    await saveToGitHub(newProducts, "Producto eliminado");
}

document.addEventListener('DOMContentLoaded', checkAccess);