// admin.js - FASE 12: GESTIÓN TOTAL (ESTABILIZADO)
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

let sha = "";
let products = [];

// --- 0. HERRAMIENTAS DE AUTOMATIZACIÓN ---
const sanitize = (n) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[()]/g, '').replace(/[^a-z0-9.-]/g, '');

const fileToBase64 = (file) => new Promise((res) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => res(reader.result.split(',')[1]);
});

// --- 1. ACCESO Y CARGA ---
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
    itoken = document.getElementById('gh-token').value.trim();
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
    } catch (e) { console.error("Error cargando Admin:", e); }
}

function updateProductCount() {
    const counter = document.getElementById('product-count');
    if (counter) counter.textContent = `${products.length} productos`;
}

// --- 2. RENDERIZADO PROFESIONAL (RESTAURADO) ---
function renderAdminProducts() {
    const container = document.getElementById('admin-product-list');
    if (!container) return;
    
    container.innerHTML = products.map(p => {
        let img = (p.images ? p.images[0] : p.image).replace(/^\//, '');
        const fullImgUrl = img.startsWith('http') ? img : `${RAW_BASE_URL}${img}?v=${Date.now()}`;
        
        return `
            <div class="flex justify-between items-center py-4 border-b border-gray-50 group">
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <img src="${fullImgUrl}" class="w-12 h-12 rounded-xl object-cover border shadow-sm">
                        <span class="absolute -top-1 -right-1 w-3 h-3 ${p.status === 'agotado' ? 'bg-red-500' : 'bg-green-500'} rounded-full border-2 border-white"></span>
                    </div>
                    <div>
                        <p class="font-black text-[11px] uppercase text-gray-800 mb-1">${p.name}</p>
                        <p class="text-pink-600 font-black text-xs">Gs. ${p.price.toLocaleString('es-PY')}</p>
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

// --- 3. SUBIDA Y EDICIÓN ---
async function uploadImage(file) {
    const fileName = sanitize(file.name);
    const content = await fileToBase64(file);
    await fetch(`https://api.github.com/repos/${repo}/contents/img/${fileName}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Subida automática: ${fileName}`, content: content })
    });
    return `img/${fileName}`;
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.innerText = "Subiendo...";

    try {
        const fileInput = document.getElementById('p-image-file');
        if (fileInput.files.length === 0) throw new Error("Elegí una foto");
        
        const imgPath = await uploadImage(fileInput.files[0]);
        
        const newProduct = {
            id: Date.now(),
            name: document.getElementById('p-name').value,
            price: parseInt(document.getElementById('p-price').value),
            collection: document.getElementById('p-collection').value,
            status: document.getElementById('p-status').value,
            image: imgPath,
            images: [imgPath]
        };

        await saveToGitHub([...products, newProduct], "Nuevo producto agregado");
    } catch (err) { alert("Error: " + err.message); btn.disabled = false; btn.innerText = "Subir a la Nube"; }
});

// --- 4. VENTANA DE EDICIÓN (RESTAURADO) ---
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

    await saveToGitHub(newProducts, "Producto editado (stock/precio)");
}

// --- 5. PERSISTENCIA EN GITHUB ---
async function saveToGitHub(newProducts, msg) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, content: newContent, sha: sha })
    });
    if (res.ok) { alert("✅ Cambios guardados en la nube"); location.reload(); }
    else { alert("❌ Falló la conexión con GitHub"); }
}

async function deleteProduct(id) {
    if(!confirm("¿Estás segura de eliminar este diseño de la vitrina?")) return;
    const newProducts = products.filter(p => p.id !== id);
    await saveToGitHub(newProducts, "Producto eliminado");
}

document.addEventListener('DOMContentLoaded', checkAccess);