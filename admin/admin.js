// admin.js - FASE 2: ORGANIZACIÓN POR COLECCIONES Y CONTROL DE DESTACADOS
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

let sha = "";
let products = [];

const sanitize = (n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[()]/g, '').replace(/[^a-z0-9.-]/g, '');

const fileToBase64 = (file) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result.split(',')[1]);
    reader.onerror = e => rej(e);
    reader.readAsDataURL(file);
});

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
    const input = document.getElementById('gh-token');
    itoken = input.value.trim();
    if (itoken) {
        localStorage.setItem('itoken', itoken);
        checkAccess();
    }
}

function logout() {
    localStorage.removeItem('itoken');
    location.reload();
}

async function loadProductsAdmin() {
    try {
        const response = await fetch(`${url}?v=${Date.now()}`, {
            headers: { 'Authorization': `token ${itoken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.status === 401) { logout(); return; }

        const data = await response.json();
        sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        products = content.products;
        
        renderAdminProducts();
        updateProductCount();
    } catch (e) { console.error("Error en Auditoría Admin:", e); }
}

function updateProductCount() {
    const counter = document.getElementById('product-count');
    if (counter) counter.textContent = `${products.length} productos en base`;
}

// --- 3. RENDERIZADO CON ACORDEÓN POR COLECCIONES ---
function renderAdminProducts() {
    const container = document.getElementById('admin-product-list');
    if (!container) return;
    
    // Agrupamos quirúrgicamente por colección
    const groups = products.reduce((acc, p) => {
        const col = p.collection || "Sin Categoría";
        if (!acc[col]) acc[col] = [];
        acc[col].push(p);
        return acc;
    }, {});

    container.innerHTML = Object.keys(groups).sort().map(colName => {
        const productList = groups[colName];
        return `
            <div class="mb-4 border border-gray-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button onclick="toggleAccordion('${sanitize(colName)}')" class="w-full flex justify-between items-center p-4 bg-gray-50/50 hover:bg-pink-50 transition-colors">
                    <span class="font-black text-xs uppercase tracking-widest text-gray-600">${colName} (${productList.length})</span>
                    <i id="icon-${sanitize(colName)}" class="fas fa-chevron-down text-gray-400 transition-transform"></i>
                </button>
                <div id="group-${sanitize(colName)}" class="hidden p-2">
                    ${productList.map(p => renderSingleAdminItem(p)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderSingleAdminItem(p) {
    let img = (p.images && p.images.length > 0 ? p.images[0] : p.image).replace(/^\//, '');
    const fullImgUrl = img.startsWith('http') ? img : `${RAW_BASE_URL}${img}?v=${Date.now()}`;
    
    return `
        <div class="flex justify-between items-center py-3 px-2 border-b border-gray-50 last:border-0 group">
            <div class="flex items-center gap-3">
                <div class="relative">
                    <img src="${fullImgUrl}" class="w-10 h-10 rounded-lg object-cover border border-gray-100">
                    ${p.destacado ? '<span class="absolute -top-1 -left-1 text-[8px] bg-yellow-400 text-white px-1 rounded-full shadow-sm"><i class="fas fa-star"></i></span>' : ''}
                </div>
                <div>
                    <p class="font-bold text-[10px] uppercase text-gray-700 leading-tight">${p.name}</p>
                    <p class="text-pink-600 font-black text-[10px]">Gs. ${p.price.toLocaleString('es-PY')} | <span class="text-gray-400 font-normal capitalize">${p.status}</span></p>
                </div>
            </div>
            <div class="flex gap-1">
                <button onclick="openEditModal(${p.id}, ${p.price}, '${p.status}', ${p.destacado})" class="text-gray-300 hover:text-blue-500 p-2 transition-colors"><i class="fas fa-edit text-xs"></i></button>
                <button onclick="deleteProduct(${p.id})" class="text-gray-300 hover:text-red-500 p-2 transition-colors"><i class="fas fa-trash-alt text-xs"></i></button>
            </div>
        </div>
    `;
}

function toggleAccordion(id) {
    const el = document.getElementById(`group-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    el.classList.toggle('hidden');
    icon.classList.toggle('rotate-180');
}

// --- 4. MOTOR DE SUBIDA ---
async function uploadImage(file) {
    const fileName = sanitize(file.name);
    const content = await fileToBase64(file);
    const uploadUrl = `https://api.github.com/repos/${repo}/contents/img/${fileName}`;
    await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Upload: ${fileName}`, content: content })
    });
    return `img/${fileName}`;
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; 
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Procesando...';

    try {
        const fileInput = document.getElementById('p-image-file');
        const files = Array.from(fileInput.files);
        if (files.length === 0) throw new Error("Seleccioná al menos una imagen");
        
        const uploadedPaths = [];
        for (const file of files) {
            const path = await uploadImage(file);
            uploadedPaths.push(path);
        }
        
        const newProduct = {
            id: Date.now(),
            name: document.getElementById('p-name').value,
            price: parseInt(document.getElementById('p-price').value),
            collection: document.getElementById('p-collection').value,
            status: document.getElementById('p-status').value,
            destacado: false, // Por defecto al crear
            images: uploadedPaths
        };

        await saveToGitHub([...products, newProduct], `Nuevo producto en: ${newProduct.collection}`);
    } catch (err) { 
        alert("❌ Error: " + err.message); 
        btn.disabled = false; 
        btn.innerText = "Subir a la Nube"; 
    }
});

// --- 5. EDICIÓN AVANZADA (DESTACADOS Y POP-UP) ---
function openEditModal(id, price, status, destacado) {
    document.getElementById('edit-id').value = id;
    document.getElementById('edit-price').value = price;
    document.getElementById('edit-status').value = status;
    document.getElementById('edit-destacado').checked = destacado; // Agregado para Fase 2
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

async function saveProductEdit() {
    const id = parseInt(document.getElementById('edit-id').value);
    const newPrice = parseInt(document.getElementById('edit-price').value);
    const newStatus = document.getElementById('edit-status').value;
    const isDestacado = document.getElementById('edit-destacado').checked;

    const newProducts = products.map(p => 
        p.id === id ? { ...p, price: newPrice, status: newStatus, destacado: isDestacado } : p
    );

    const btn = document.querySelector('#edit-modal button[onclick="saveProductEdit()"]');
    if(btn) { btn.disabled = true; btn.innerText = "Sincronizando..."; }
    
    await saveToGitHub(newProducts, `Edición Chick: ID ${id} | Destacado: ${isDestacado}`);
}

async function saveToGitHub(newProducts, msg) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    try {
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: msg, content: newContent, sha: sha })
        });

        if (res.ok) {
            alert("✅ ¡Éxito! Tienda actualizada y organizada.");
            location.reload();
        } else {
            throw new Error("Error de sincronización con GitHub");
        }
    } catch (e) {
        alert("❌ Error de conexión. Verificá tu token.");
        console.error(e);
    }
}

async function deleteProduct(id) {
    if(!confirm("¿Eliminar este diseño de la vitrina?")) return;
    const newProducts = products.filter(p => p.id !== id);
    await saveToGitHub(newProducts, "Producto eliminado");
}

document.addEventListener('DOMContentLoaded', checkAccess);