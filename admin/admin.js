// admin.js - Fase 11: Gestión de Inventario & Edición Rápida
const CONFIG = {
    owner: 'creacionesmarilyn-py',
    repo: 'web-creaciones-marilyn',
    dbPath: 'database.json',
};

let allProducts = []; // Memoria temporal para edición rápida

// 1. Manejo de Seguridad
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

// 2. Cargar Inventario
async function loadProductsForAdmin() {
    try {
        const response = await fetch('../database.json?v=' + Date.now());
        const data = await response.json();
        allProducts = data.products; // Guardamos en memoria global
        renderAdminProducts();
    } catch (e) { 
        console.error("Error al cargar base de datos:", e); 
    }
}

function renderAdminProducts() {
    const list = document.getElementById('admin-product-list');
    list.innerHTML = '';
    document.getElementById('product-count').textContent = `${allProducts.length} productos`;

    // Copiamos y damos vuelta para ver lo nuevo primero
    [...allProducts].reverse().forEach(p => {
        const displayImg = p.images ? p.images[0] : p.image;
        const galleryCount = p.images ? p.images.length : 1;

        // Badge de estado dinámico
        let statusBadge = '';
        if (p.status === 'agotado') statusBadge = '<span class="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase">Agotado</span>';
        else if (p.status === 'nuevo') statusBadge = '<span class="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">Nuevo</span>';
        else if (p.status === 'oferta') statusBadge = '<span class="text-[9px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase">Oferta</span>';

        const div = document.createElement('div');
        div.className = 'py-4 flex items-center justify-between group animate-fadeIn';
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="relative">
                    <img src="../${displayImg}" class="w-14 h-14 object-cover rounded-xl border border-gray-100 shadow-sm">
                    <span class="absolute -top-2 -right-2 bg-white text-[8px] font-bold px-1.5 py-0.5 rounded-full border shadow-sm">${galleryCount}📸</span>
                </div>
                <div>
                    <p class="font-bold text-gray-900 text-sm uppercase tracking-tight">${p.name}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Gs. ${p.price.toLocaleString()}</p>
                        ${statusBadge}
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="openEditModal(${p.id})" class="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-pink-50 hover:text-pink-600 transition-all shadow-sm">
                    <i class="fas fa-edit text-xs"></i>
                </button>
                <button onclick="deleteProduct(${p.id})" class="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all shadow-sm">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </div>
        `;
        list.appendChild(div);
    });
}

// 3. Procesar Nuevo Producto
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const token = localStorage.getItem('gh_token');
    const files = Array.from(document.getElementById('p-image-file').files);
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner animate-spin"></i> <span>Subiendo galería...</span>`;

    try {
        const imagePaths = [];
        for (let i = 0; i < files.length; i++) {
            btn.innerHTML = `<span>Procesando ${i + 1} de ${files.length}...</span>`;
            const file = files[i];
            const fileName = `img/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
            const base64 = await toBase64(file);
            await githubApi(fileName, `Carga foto ${i+1}`, base64.split(',')[1]);
            imagePaths.push(fileName);
        }

        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dbPath}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const dbData = await dbRes.json();
        const content = JSON.parse(atob(dbData.content));

        const newProduct = {
            id: Date.now(),
            name: document.getElementById('p-name').value,
            price: parseInt(document.getElementById('p-price').value),
            images: imagePaths,
            collection: document.getElementById('p-collection').value,
            status: document.getElementById('p-status').value
        };

        content.products.push(newProduct);
        await githubApi(CONFIG.dbPath, 'Nuevo producto con galería', btoa(JSON.stringify(content, null, 2)), dbData.sha);

        alert("¡Diseño publicado exitosamente!");
        location.reload();
    } catch (err) {
        alert("Error de conexión. Reintentar.");
        btn.disabled = false;
        btn.innerHTML = '<span>Reintentar carga</span>';
    }
});

// 4. Lógica de Edición Rápida (Fase 11)
function openEditModal(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('edit-id').value = id;
    document.getElementById('edit-status').value = product.status || 'normal';
    document.getElementById('edit-price').value = product.price;
    
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-modal').classList.add('flex');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    document.getElementById('edit-modal').classList.remove('flex');
}

async function saveProductEdit() {
    const btn = document.getElementById('save-edit-btn');
    const id = parseInt(document.getElementById('edit-id').value);
    const newStatus = document.getElementById('edit-status').value;
    const newPrice = parseInt(document.getElementById('edit-price').value);
    const token = localStorage.getItem('gh_token');

    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner animate-spin"></i> Actualizando...`;

    try {
        // Obtenemos data fresca de GitHub para evitar conflictos
        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dbPath}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const dbData = await dbRes.json();
        const content = JSON.parse(atob(dbData.content));

        // Buscamos y actualizamos
        const idx = content.products.findIndex(p => p.id === id);
        if (idx !== -1) {
            content.products[idx].status = newStatus;
            content.products[idx].price = newPrice;

            await githubApi(CONFIG.dbPath, `Update stock/price: ${content.products[idx].name}`, btoa(JSON.stringify(content, null, 2)), dbData.sha);
            
            // Actualizar memoria local y cerrar
            allProducts = content.products;
            renderAdminProducts();
            closeEditModal();
            alert("¡Inventario actualizado!");
        }
    } catch (err) {
        alert("Error al actualizar. Revisa tu conexión.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-save"></i> Actualizar Inventario`;
    }
}

// 5. Lógica de Eliminación
async function deleteProduct(productId) {
    if (!confirm("¿Segura que quieres borrar este diseño?")) return;
    const token = localStorage.getItem('gh_token');
    try {
        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dbPath}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const dbData = await dbRes.json();
        const content = JSON.parse(atob(dbData.content));
        content.products = content.products.filter(p => p.id !== productId);
        await githubApi(CONFIG.dbPath, 'Producto eliminado', btoa(JSON.stringify(content, null, 2)), dbData.sha);
        loadProductsForAdmin();
    } catch (err) { alert("Error al eliminar."); }
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