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

// Asegurar que el código se ejecute cuando el HTML esté listo
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

    // Botón Cerrar Sesión
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => location.reload());
    }

    // --- 2. GUARDAR NUEVO PRODUCTO ---
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('submit-btn');
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner animate-spin"></i> Subiendo...';

            try {
                const id = Date.now(); 
                const nuevoProducto = {
                    id: id,
                    nombre: document.getElementById('p-name').value,
                    precio_gs: parseInt(document.getElementById('p-price').value),
                    categoria: document.getElementById('p-collection').value,
                    estado: document.getElementById('p-status').value,
                    imagen: document.getElementById('p-image-url').value, 
                    destacado: false,
                    fecha_registro: new Date().toISOString()
                };

                await set(ref(db, 'productos/' + id), nuevoProducto);
                
                alert("✅ ¡Producto guardado en la Nube!");
                productForm.reset();
            } catch (err) { 
                alert("❌ Error al guardar: " + err.message); 
            } finally {
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> <span class="text-xs uppercase tracking-[0.2em]">Guardar en la Nube</span>';
            }
        });
    }

    // --- 3. FUNCIONES DE EDICIÓN Y ELIMINACIÓN (Globales para la tabla dinámica) ---
    // Como la tabla se crea dinámicamente, pegamos las funciones al window
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

    // Botones del Modal de Edición
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

    // --- 4. ESCUCHAR INVENTARIO EN TIEMPO REAL ---
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

            container.innerHTML = productosArray.reverse().map(p => `
                <div class="flex justify-between items-center py-3 px-2 border-b border-gray-50 last:border-0 group">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border border-gray-200 relative">
                            ${p.imagen ? `<img src="${p.imagen}" class="w-full h-full object-cover">` : `<i class="fas fa-image text-gray-300"></i>`}
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
            `).join('');
        });
    }

});