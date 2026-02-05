// admin.js - Fase 12: AUTOMATIZACIÓN TOTAL (SUBIDA DIRECTA)
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

let sha = "";
let products = [];

// --- 0. FUNCIONES DE UTILIDAD (Limpieza y Conversión) ---
function sanitizeName(name) {
    return name.toLowerCase()
               .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
               .replace(/\s+/g, '-')
               .replace(/[()]/g, '')
               .replace(/[^a-z0-9.-]/g, '');
}

// Convierte un archivo a Base64 para que GitHub lo acepte
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
});

// --- 1. CARGA Y ACCESO ---
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

async function loadProductsAdmin() {
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `token ${itoken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if (response.status === 401) { localStorage.removeItem('itoken'); location.reload(); return; }

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
    if (counter) counter.textContent = `${products.length} diseños activos`;
}

// --- 2. SUBIDA DE IMAGEN A GITHUB ---
async function uploadImageToGitHub(file) {
    const fileName = sanitizeName(file.name);
    const content = await fileToBase64(file);
    const uploadUrl = `https://api.github.com/repos/${repo}/contents/img/${fileName}`;

    // Intentamos subir la imagen
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${itoken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Upload image: ${fileName}`,
            content: content
        })
    });

    if (response.ok || response.status === 422) { 
        // 422 significa que la imagen ya existe, así que la usamos igual
        return `img/${fileName}`;
    } else {
        throw new Error("Error al subir imagen");
    }
}

// --- 3. PROCESAR FORMULARIO (LA MAGIA) ---
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Procesando...';

    try {
        const files = document.getElementById('p-image-file').files;
        if (files.length === 0) throw new Error("Debes elegir al menos una imagen");

        // Subimos todas las imágenes seleccionadas
        const uploadedPaths = [];
        for (let file of files) {
            const path = await uploadImageToGitHub(file);
            uploadedPaths.push(path);
        }

        const name = document.getElementById('p-name').value;
        const price = parseInt(document.getElementById('p-price').value);
        const collection = document.getElementById('p-collection').value;
        const status = document.getElementById('p-status').value;

        const newProduct = {
            id: Date.now(),
            name,
            price,
            collection,
            status,
            image: uploadedPaths[0],
            images: uploadedPaths
        };

        const newProducts = [...products, newProduct];
        await saveToGitHub(newProducts, "Nuevo producto con subida automática");
        
    } catch (err) {
        alert("❌ Error: " + err.message);
        btn.disabled = false;
        btn.innerHTML = 'Subir a la Nube';
    }
});

// --- 4. RENDER Y OTROS ---
function renderAdminProducts() {
    const container = document.getElementById('admin-product-list'); 
    if (!container) return;
    container.innerHTML = products.map(p => {
        const imgPath = p.images ? p.images[0] : p.image;
        const fullImgUrl = imgPath.startsWith('http') ? imgPath : RAW_BASE_URL + imgPath;
        return `
            <div class="flex justify-between items-center py-4 border-b border-gray-50 group">
                <div class="flex items-center gap-4">
                    <img src="${fullImgUrl}" class="w-12 h-12 rounded-xl object-cover border shadow-sm">
                    <div>
                        <p class="font-black text-[11px] uppercase text-gray-800 mb-1">${p.name}</p>
                        <p class="text-pink-600 font-black text-xs">Gs. ${p.price.toLocaleString()}</p>
                    </div>
                </div>
                <button onclick="deleteProduct(${p.id})" class="text-gray-300 hover:text-red-500 p-2"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
    }).join('');
}

async function saveToGitHub(newProducts, msg) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, content: newContent, sha: sha })
    });

    if (response.ok) {
        alert("✅ ¡Todo listo! Producto subido y guardado.");
        location.reload();
    }
}

async function deleteProduct(id) {
    if(!confirm("¿Borrar este diseño?")) return;
    const newProducts = products.filter(p => p.id !== id);
    await saveToGitHub(newProducts, "Producto eliminado");
}

document.addEventListener('DOMContentLoaded', checkAccess);