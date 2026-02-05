// admin.js - Fase 12: CONTROL TOTAL (Subida Directa y Sincronizada)
let itoken = localStorage.getItem('itoken') || "";
const repo = "creacionesmarilyn-py/web-creaciones-marilyn";
const url = `https://api.github.com/repos/${repo}/contents/database.json`;
const RAW_BASE_URL = "https://raw.githubusercontent.com/creacionesmarilyn-py/web-creaciones-marilyn/main/";

let sha = "";
let products = [];

// Función para limpiar nombres (aros-1.jpg)
const sanitize = (n) => n.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '').replace(/[^a-z0-9.-]/g, '');

async function loadProductsAdmin() {
    if (!itoken) return;
    try {
        const response = await fetch(`${url}?t=${Date.now()}`, { // Pedimos la versión real, no la cacheada
            headers: { 'Authorization': `token ${itoken}` }
        });
        const data = await response.json();
        sha = data.sha;
        const content = JSON.parse(decodeURIComponent(escape(atob(data.content))));
        products = content.products;
        renderAdminProducts();
    } catch (e) { console.error("Error:", e); }
}

async function uploadImage(file) {
    const fileName = sanitize(file.name);
    const reader = new FileReader();
    const base64Promise = new Promise(res => {
        reader.onload = () => res(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    const content = await base64Promise;

    const res = await fetch(`https://api.github.com/repos/${repo}/contents/img/${fileName}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Subiendo ${fileName}`, content: content })
    });
    return `img/${fileName}`;
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.innerText = "Subiendo...";

    try {
        const file = document.getElementById('p-image-file').files[0];
        const imgPath = await uploadImage(file);
        
        const newProduct = {
            id: Date.now(),
            name: document.getElementById('p-name').value,
            price: parseInt(document.getElementById('p-price').value),
            collection: document.getElementById('p-collection').value,
            status: document.getElementById('p-status').value,
            image: imgPath,
            images: [imgPath]
        };

        const newProducts = [...products, newProduct];
        await saveToGitHub(newProducts);
    } catch (err) { alert("Error: " + err.message); btn.disabled = false; }
});

async function saveToGitHub(newProducts) {
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify({ products: newProducts }, null, 2))));
    const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Authorization': `token ${itoken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "Update DB", content: newContent, sha: sha })
    });
    if (res.ok) { alert("✅ ¡Éxito total!"); location.reload(); }
}

function renderAdminProducts() {
    const container = document.getElementById('admin-product-list');
    container.innerHTML = products.map(p => {
        let img = (p.images ? p.images[0] : p.image).replace(/^\//, '');
        return `<div class="flex items-center gap-4 py-2 border-b">
            <img src="${RAW_BASE_URL}${img}?v=${Date.now()}" class="w-10 h-10 object-cover rounded">
            <span class="text-xs font-bold uppercase">${p.name}</span>
        </div>`;
    }).join('');
}

function checkAccess() {
    const overlay = document.getElementById('login-overlay');
    if (itoken) { overlay.classList.add('hidden'); loadProductsAdmin(); }
}
function saveToken() {
    itoken = document.getElementById('gh-token').value.trim();
    localStorage.setItem('itoken', itoken); checkAccess();
}
document.addEventListener('DOMContentLoaded', checkAccess);