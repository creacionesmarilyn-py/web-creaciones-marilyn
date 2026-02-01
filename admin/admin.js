// admin.js - Gestión Profesional Creaciones Marilyn (Fase 5: Estados)
const CONFIG = {
    owner: 'creacionesmarilyn-py',
    repo: 'web-creaciones-marilyn',
    dbPath: 'database.json',
};

// 1. Manejo de Seguridad (Token)
function saveToken() {
    const token = document.getElementById('gh-token').value;
    if (token) {
        localStorage.setItem('gh_token', token);
        document.getElementById('login-overlay').classList.add('hidden');
        loadProductsForAdmin();
    }
}

function logout() {
    localStorage.removeItem('gh_token');
    location.reload();
}

if (localStorage.getItem('gh_token')) {
    document.getElementById('login-overlay').classList.add('hidden');
}

// 2. Cargar Inventario con Visualización de Estados
async function loadProductsForAdmin() {
    try {
        const response = await fetch('../database.json?v=' + Date.now());
        const data = await response.json();
        const list = document.getElementById('admin-product-list');
        list.innerHTML = '';
        document.getElementById('product-count').textContent = `${data.products.length} productos`;

        data.products.reverse().forEach(p => {
            // Lógica para mostrar el estado si no es "normal"
            const statusLabel = p.status && p.status !== 'normal' 
                ? `• <span class="text-pink-600">${p.status.toUpperCase()}</span>` 
                : '';

            const div = document.createElement('div');
            div.className = 'py-4 flex items-center justify-between group';
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="../${p.image}" class="w-14 h-14 object-cover rounded-lg border">
                    <div>
                        <p class="font-bold text-gray-900 text-sm uppercase tracking-tight">${p.name}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">
                            ${p.collection} • Gs. ${p.price.toLocaleString('es-PY')} ${statusLabel}
                        </p>
                    </div>
                </div>
                <button onclick="deleteProduct(${p.id})" class="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition">
                    Eliminar
                </button>
            `;
            list.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

// 3. Procesar Nuevo Producto (Con Estado)
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const token = localStorage.getItem('gh_token');
    
    btn.disabled = true;
    btn.innerHTML = '<span>Subiendo...</span>';

    try {
        const file = document.getElementById('p-image-file').files[0];
        const fileName = `img/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        
        // A. Subir Imagen
        const base64 = await toBase64(file);
        await githubApi(fileName, 'Carga de imagen', base64.split(',')[1]);

        // B. Actualizar JSON con el nuevo campo status
        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dbPath}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const dbData = await dbRes.json();
        const content = JSON.parse(atob(dbData.content));

        const newProduct = {
            id: Date.now(),
            name: document.getElementById('p-name').value,
            price: parseInt(document.getElementById('p-price').value),
            image: fileName,
            collection: document.getElementById('p-collection').value,
            status: document.getElementById('p-status').value // CAPTURAMOS EL ESTADO
        };

        content.products.push(newProduct);
        await githubApi(CONFIG.dbPath, 'Actualización de inventario con estado', btoa(JSON.stringify(content, null, 2)), dbData.sha);

        alert("¡Producto añadido con éxito!");
        location.reload();

    } catch (err) {
        alert("Error de conexión. Verifica tu Token.");
        btn.disabled = false;
        btn.innerHTML = '<span>Intentar de nuevo</span>';
    }
});

// 4. Lógica de Eliminación
async function deleteProduct(productId) {
    if (!confirm("¿Segura que quieres quitar este producto de la vitrina?")) return;
    const token = localStorage.getItem('gh_token');
    try {
        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dbPath}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const dbData = await dbRes.json();
        const content = JSON.parse(atob(dbData.content));
        content.products = content.products.filter(p => p.id !== productId);
        await githubApi(CONFIG.dbPath, 'Producto eliminado del inventario', btoa(JSON.stringify(content, null, 2)), dbData.sha);
        alert("Producto eliminado.");
        location.reload();
    } catch (err) {
        alert("No se pudo eliminar.");
    }
}

// Helpers
const toBase64 = file => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => res(reader.result);
    reader.onerror = e => rej(e);
});

async function githubApi(path, message, content, sha = null) {
    const token = localStorage.getItem('gh_token');
    const body = { message, content };
    if (sha) body.sha = sha;
    return fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}

document.addEventListener('DOMContentLoaded', loadProductsForAdmin);