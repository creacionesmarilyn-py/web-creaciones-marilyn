// admin.js - Fase 12: PANEL DE CONTROL (RESTAURADO)
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;

let sha = "";
let products = [];

async function loadProductsAdmin() {
    if (!itoken) {
        itoken = prompt("Ingresa tu Token de GitHub para administrar:");
        if (itoken) localStorage.setItem('itoken', itoken);
    }

    try {
        const response = await fetch(url, {
            headers: { 
                'Authorization': `token ${itoken}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('itoken');
            alert("Token inválido. Reingresalo.");
            location.reload();
            return;
        }

        const data = await response.json();
        sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        products = content.products;
        renderAdminProducts(); 
    } catch (e) {
        console.error("Error:", e);
        alert("Error de conexión. Revisa el Token.");
    }
}

function renderAdminProducts() {
    const container = document.getElementById('admin-product-list'); 
    if (!container) return;
    
    container.innerHTML = products.map(p => `
        <div class="flex justify-between items-center bg-white p-4 mb-3 rounded-xl shadow-sm border border-gray-100">
            <div class="flex items-center gap-4">
                <img src="${p.images ? p.images[0] : p.image}" class="w-12 h-12 rounded-lg object-cover">
                <div>
                    <p class="font-bold text-xs uppercase text-gray-700">${p.name}</p>
                    <p class="text-pink-600 font-black text-sm">Gs. ${p.price.toLocaleString('es-PY')}</p>
                </div>
            </div>
            <button onclick="deleteProduct(${p.id})" class="bg-red-50 text-red-500 p-3 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-95">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');
}

async function deleteProduct(id) {
    if(!confirm("¿Estás segura de eliminar este producto?")) return;
    const newProducts = products.filter(p => p.id !== id);
    await saveToGitHub(newProducts);
}

async function saveToGitHub(newProducts) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    
    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${itoken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Eliminación de producto (Fase 12)",
                content: newContent,
                sha: sha
            })
        });

        if (response.ok) {
            alert("¡Depósito actualizado con éxito!");
            location.reload();
        } else {
            alert("Error al guardar en GitHub.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

document.addEventListener('DOMContentLoaded', loadProductsAdmin);