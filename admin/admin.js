// admin.js - Fase 12: Integración Profesional con Interfaz e Imágenes RAW
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;
// DIRECCIÓN BASE PARA IMÁGENES
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

let sha = "";
let products = [];

// --- 1. GESTIÓN DE ACCESO (LOGIN) ---
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
    } else {
        alert("Por favor, ingresa un token válido.");
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
            headers: { 
                'Authorization': `token ${itoken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 401) {
            alert("⚠️ Token inválido o expirado.");
            logout();
            return;
        }

        const data = await response.json();
        sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        products = content.products;
        
        renderAdminProducts();
        updateProductCount();
    } catch (e) {
        console.error("Error:", e);
        document.getElementById('admin-product-list').innerHTML = `<p class="text-red-500 text-center py-10 text-xs uppercase font-bold">Error de conexión con GitHub</p>`;
    }
}

function updateProductCount() {
    const counter = document.getElementById('product-count');
    if (counter) counter.textContent = `${products.length} productos`;
}

// --- 3. RENDERIZADO (DIBUJO) ---
function renderAdminProducts() {
    const container = document.getElementById('admin-product-list'); 
    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = `<p class="text-gray-400 py-10 text-center text-xs uppercase tracking-widest">No hay productos en la nube</p>`;
        return;
    }

    container.innerHTML = products.map(p => {
        // CIRUGÍA: Reconstrucción de ruta de imagen
        const imgPath = p.images ? p.images[0] : p.image;
        const fullImgUrl = imgPath.startsWith('http') ? imgPath : RAW_BASE_URL + imgPath;

        return `
            <div class="flex justify-between items-center py-4 group hover:bg-gray-50/50 transition-all px-2 rounded-xl border-b border-gray-50 last:border-none">
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <img src="${fullImgUrl}" class="w-12 h-12 rounded-xl object-cover shadow-sm border border-gray-100">
                        <span class="absolute -top-1 -right-1 w-3 h-3 ${p.status === 'agotado' ? 'bg-red-500' : 'bg-green-500'} rounded-full border-2 border-white"></span>
                    </div>
                    <div>
                        <p class="font-black text-[11px] uppercase text-gray-800 tracking-tight leading-none mb-1">${p.name}</p>
                        <div class="flex gap-2 items-center">
                            <p class="text-pink-600 font-black text-xs">Gs. ${p.price.toLocaleString('es-PY')}</p>
                            <span class="text-[8px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full font-bold uppercase">${p.collection}</span>
                        </div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="openEditModal(${p.id})" class="text-gray-400 hover:text-blue-500 p-2 transition-colors"><i class="fas fa-edit text-sm"></i></button>
                    <button onclick="deleteProduct(${p.id})" class="text-gray-400 hover:text-red-500 p-2 transition-colors"><i class="fas fa-trash-alt text-sm"></i></button>
                </div>
            </div>
        `;
    }).join('');
}

// --- 4. ACCIONES (GUARDAR / ELIMINAR) ---
async function saveToGitHub(newProducts) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Actualización de inventario (Fase 12)",
                content: newContent,
                sha: sha
            })
        });

        if (response.ok) {
            alert("✅ ¡Depósito actualizado!");
            location.reload();
        } else {
            alert("❌ Error al guardar.");
        }
    } catch (e) { console.error(e); }
}

async function deleteProduct(id) {
    if(!confirm("¿Borrar este diseño de la nube?")) return;
    const newProducts = products.filter(p => p.id !== id);
    await saveToGitHub(newProducts);
}

// --- 5. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', checkAccess);