/* admin.js - GESTOR DE VITRINA CONECTADO A FIREBASE REALTIME */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBmPvAk_lSJ1TlBVtMqKAC1HaPM5eVeZxo",
    authDomain: "creaciones-marilyn.firebaseapp.com",
    databaseURL: "https://creaciones-marilyn-default-rtdb.firebaseio.com",
    projectId: "creaciones-marilyn",
    storageBucket: "creaciones-marilyn.firebasestorage.app",
    messagingSenderId: "565099684746",
    appId: "1:565099684746:web:a99ccfb9796aea22725e73"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. SISTEMA DE LOGIN ---
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const token = document.getElementById('gh-token').value;
            if (token === "marilyn2026") {
                document.getElementById('login-overlay').classList.add('hidden');
                iniciarEscuchaNube(); // Arranca Firebase
            } else {
                alert("❌ Clave incorrecta. Intenta de nuevo.");
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => location.reload());
    }

    // --- 2. SISTEMA DE CONVERSIÓN DE FOTO A BASE64 ---
    window.imagenBase64Actual = ""; 
    const fileInput = document.getElementById('p-image-file');
    
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = function(event) {
                const img = new Image();
                img.src = event.target.result;
                img.onload = function() {
                    // Comprimir la imagen para que no sature la base de datos
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 600;
                    let scaleSize = 1;
                    if (img.width > MAX_WIDTH) {
                        scaleSize = MAX_WIDTH / img.width;
                    }
                    canvas.width = img.width * scaleSize;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Guardar en variable global como texto
                    window.imagenBase64Actual = canvas.toDataURL('image/jpeg', 0.7);

                    // Mostrar miniatura de previsualización en el HTML
                    const previewImg = document.getElementById('img-preview');
                    const previewContainer = document.getElementById('img-preview-container');
                    if(previewImg && previewContainer) {
                        previewImg.src = window.imagenBase64Actual;
                        previewContainer.classList.remove('hidden');
                    }
                }
            };
        });
    }

    // --- 3. GUARDAR NUEVO PRODUCTO ---
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Subiendo...';

            try {
                const id = Date.now(); 
                
                // Si subió una foto nueva usa el Base64, sino revisa si dejó una URL vieja (o lo deja en blanco)
                const inputUrlViejo = document.getElementById('p-image-url');
                const imgFinal = window.imagenBase64Actual || (inputUrlViejo ? inputUrlViejo.value : "");

                const nuevoProducto = {
                    id: id,
                    nombre: document.getElementById('p-name').value,
                    precio_gs: parseInt(document.getElementById('p-price').value),
                    categoria: document.getElementById('p-collection').value,
                    estado: document.getElementById('p-status').value,
                    
                    // --- BLINDAJE DE IMÁGENES (Compatible con cualquier frontend) ---
                    imagen: imgFinal,
                    img: imgFinal,
                    image: imgFinal,
                    images: [imgFinal], 
                    // ----------------------------------------------------------------
                    
                    destacado: false,
                    fecha_registro: new Date().toISOString()
                };

                await set(ref(db, 'productos/' + id), nuevoProducto);
                
                alert("✅ ¡Producto y Foto guardados en la Nube!");
                
                // Limpiar el formulario y la foto
                productForm.reset();
                window.imagenBase64Actual = "";
                if(document.getElementById('img-preview-container')) document.getElementById('img-preview-container').classList.add('hidden');
                
            } catch (err) { 
                alert("❌ Error al guardar: " + err.message); 
            } finally {
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span class="text-xs uppercase tracking-[0.2em]">Guardar en la Nube</span>';
            }
        });
    }

    // --- 4. FUNCIONES DE EDICIÓN Y ELIMINACIÓN ---
    window.abrirModalEdicion = function(id, precio, estado, destacado) {
        document.getElementById('edit-id').value = id;
        document.getElementById('edit-price').value = precio;
        document.getElementById('edit-status').value = estado;
        document.getElementById('edit-destacado').checked = destacado;
        document.getElementById('edit-modal').classList.remove('hidden');
    };

    window.eliminarProductoNube = async function(id) {
        if(confirm("¿Seguro que deseas eliminar este producto de la nube?")) {
            try {
                await remove(ref(db, 'productos/' + id));
            } catch(e) {
                alert("Error al eliminar: " + e.message);
            }
        }
    };

    const closeModalBtn = document.getElementById('close-modal-btn');
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            document.getElementById('edit-modal').classList.add('hidden');
        });
    }

    const saveEditBtn = document.getElementById('save-edit-btn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', async () => {
            const id = document.getElementById('edit-id').value;
            
            try {
                saveEditBtn.innerText = "Actualizando...";
                saveEditBtn.disabled = true;

                await update(ref(db, 'productos/' + id), {
                    precio_gs: parseInt(document.getElementById('edit-price').value),
                    estado: document.getElementById('edit-status').value,
                    destacado: document.getElementById('edit-destacado').checked
                });

                document.getElementById('edit-modal').classList.add('hidden');
                alert("✅ Producto actualizado correctamente");
            } catch (e) {
                alert("Error al actualizar: " + e.message);
            } finally {
                saveEditBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Inventario';
                saveEditBtn.disabled = false;
            }
        });
    }

    // --- 5. ESCUCHAR INVENTARIO EN TIEMPO REAL ---
    function iniciarEscuchaNube() {
        const productosRef = ref(db, 'productos');
        
        onValue(productosRef, (snapshot) => {
            const data = snapshot.val();
            const container = document.getElementById('admin-product-list');
            const counter = document.getElementById('product-count');
            
            if (!data) {
                container.innerHTML = '<p class="text-gray-400 py-10 text-center text-xs uppercase tracking-widest">Base de datos vacía.</p>';
                counter.textContent = "0 productos";
                return;
            }

            const productosArray = Object.keys(data).map(key => data[key]);
            counter.textContent = `${productosArray.length} productos en base`;

            container.innerHTML = productosArray.reverse().map(p => {
                // Leer la imagen de forma segura sin importar cómo se guardó
                const miniatura = p.images?.[0] || p.img || p.imagen || p.image || '';
                
                return `
                <div class="flex justify-between items-center py-3 px-2 border-b border-gray-50 last:border-0 group">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 relative">
                            ${miniatura ? `<img src="${miniatura}" class="w-full h-full object-cover">` : `<i class="fas fa-image text-gray-300"></i>`}
                            ${p.destacado ? '<span class="absolute -top-1 -left-1 text-[8px] bg-yellow-400 text-white px-1 rounded-full shadow-sm"><i class="fas fa-star"></i></span>' : ''}
                        </div>
                        <div>
                            <p class="font-bold text-[10px] uppercase text-gray-700 leading-tight">${p.nombre}</p>
                            <p class="text-pink-600 font-black text-[10px]">Gs. ${p.precio_gs ? p.precio_gs.toLocaleString('es-PY') : '0'} | <span class="text-gray-400 font-normal capitalize">${p.estado}</span></p>
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="window.abrirModalEdicion(${p.id}, ${p.precio_gs || 0}, '${p.estado || 'normal'}', ${p.destacado || false})" class="text-gray-300 hover:text-blue-500 transition-colors p-2"><i class="fas fa-edit"></i></button>
                        <button onclick="window.eliminarProductoNube(${p.id})" class="text-gray-300 hover:text-red-500 transition-colors p-2"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `}).join('');
        });
    }

});