// Configuración Maestra
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

// Verificar sesión al cargar
if (localStorage.getItem('gh_token')) {
    document.getElementById('login-overlay').classList.add('hidden');
}

// 2. Cargar Inventario Actual
async function loadProductsForAdmin() {
    try {
        const response = await fetch('../database.json?v=' + Date.now());
        const data = await response.json();
        const list = document.getElementById('admin-product-list');
        list.innerHTML = '';
        document.getElementById('product-count').textContent = `${data.products.length} productos`;

        data.products.reverse().forEach(p => {
            const div = document.createElement('div');
            div.className = 'py-4 flex items-center justify-between group';
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="../${p.image}" class="w-14 h-14 object-cover rounded-lg border">
                    <div>
                        <p class="font-bold text-gray-900 text-sm uppercase tracking-tight">${p.name}</p>
                        <p class="text-[10px] text-gray-400 font-bold uppercase">${p.collection} • Gs. ${p.price.toLocaleString('es-PY')}</p>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

// 3. Procesar Nuevo Producto (Imagen + Datos)
document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const token = localStorage.getItem('gh_token');
    
    // UI Loading
    btn.disabled = true;
    btn.innerHTML = '<span>Subiendo...</span>';

    try {
        const file = document.getElementById('p-image-file').files[0];
        const fileName = `img/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
        
        // A. Convertir y Subir Imagen
        const base64 = await toBase64(file);
        await githubApi(fileName, 'Carga de imagen', base64.split(',')[1]);

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
            image: fileName,
            collection: document.getElementById('p-collection').value
        };

        content.products.push(newProduct);
        await githubApi(CONFIG.dbPath, 'Actualización de inventario', btoa(JSON.stringify(content, null, 2)), dbData.sha);

        alert("¡Éxito! Tu vitrina se actualizará en unos segundos.");
        location.reload();

    } catch (err) {
        console.error(err);
        alert("Error de conexión. Verifica tu Token.");
        btn.disabled = false;
        btn.innerHTML = '<span>Intentar de nuevo</span>';
    }
});

// Helpers Senior
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