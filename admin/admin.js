// admin.js - Fase 6: Soporte Multi-Imagen Creaciones Marilyn
const CONFIG = {
    owner: 'creacionesmarilyn-py',
    repo: 'web-creaciones-marilyn',
    dbPath: 'database.json',
};

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

// 2. Cargar Inventario (Soporta Galería)
async function loadProductsForAdmin() {
    try {
        const response = await fetch('../database.json?v=' + Date.now());
        const data = await response.json();
        const list = document.getElementById('admin-product-list');
        list.innerHTML = '';
        document.getElementById('product-count').textContent = `${data.products.length} productos`;

        data.products.reverse().forEach(p => {
            const statusLabel = p.status && p.status !== 'normal' 
                ? `• <span class="text-pink-600">${p.status.toUpperCase()}</span>` 
                : '';

            // COMPATIBILIDAD: Si tiene galería usa la primera, si no, usa la imagen única
            const displayImg = p.images ? p.images[0] : p.image;
            const galleryCount = p.images ? `(${p.images.length} fotos)` : '(1 foto)';

            const div = document.createElement('div');
            div.className = 'py-4 flex items-center justify-between group';
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="../${displayImg}" class="w-14 h-14 object-cover rounded-lg border bg-gray-50">
                    <div>
                        <p class="font-bold text-gray-900 text-sm uppercase tracking-tight">${p.name}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase italic">
                            ${p.collection} ${galleryCount} ${statusLabel}
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

// 3. Procesar Nuevo Producto (Bucle de Galería)
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const token = localStorage.getItem('gh_token');
    
    // Obtenemos todos los archivos seleccionados
    const files = Array.from(document.getElementById('p-image-file').files);
    
    btn.disabled = true;
    btn.innerHTML = `<span>Subiendo 1 de ${files.length}...</span>`;

    try {
        const imagePaths = [];

        // A. Subir imágenes una por una
        for (let i = 0; i < files.length; i++) {
            btn.innerHTML = `<span>Subiendo ${i + 1} de ${files.length}...</span>`;
            
            const file = files[i];
            const fileName = `img/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
            
            const base64 = await toBase64(file);
            await githubApi(fileName, `Carga foto ${i+1}`, base64.split(',')[1]);
            
            imagePaths.push(fileName);
        }

        // B. Actualizar JSON
        const dbRes = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${CONFIG.dbPath}`, {
            headers: { 'Authorization': `token ${token}` }
        });
        const dbData = await dbRes.json();
        const content = JSON.parse(atob(dbData.content));

        const newProduct = {
            id: Date.now(),
            name: document.getElementById('p-name').value,
            price: parseInt(document.getElementById('p-price').value),
            images: imagePaths, // GUARDAMOS EL ARRAY DE FOTOS
            collection: document.getElementById('p-collection').value,
            status: document.getElementById('p-status').value
        };

        content.products.push(newProduct);
        await githubApi(CONFIG.dbPath, 'Nuevo producto con galería', btoa(JSON.stringify(content, null, 2)), dbData.sha);

        alert("¡Galería de diseño creada con éxito!");
        location.reload();

    } catch (err) {
        alert("Error en la conexión. Revisa tu Token o Internet.");
        btn.disabled = false;
        btn.innerHTML = '<span>Reintentar carga</span>';
    }
});

// 4. Lógica de Eliminación
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
        location.reload();
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