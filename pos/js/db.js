/* pos/js/db.js - MOTOR HÍBRIDO (LOCAL + FIREBASE REALTIME) */

// 1. Conexión a tu Nube
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const rtdb = getDatabase(app);

const DB_NAME = 'CreacionesMarilynPOS';
const DB_VERSION = 2;

const dbSystem = {
    db: null,

    // Inicializar ambas bases de datos
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('productos')) db.createObjectStore('productos', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('ventas')) db.createObjectStore('ventas', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('movimientos_stock')) db.createObjectStore('movimientos_stock', { keyPath: 'id', autoIncrement: true });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("✅ Motor Híbrido Listo: Local y Nube conectados.");
                resolve(this.db);
            };

            request.onerror = (e) => reject(e.target.error);
        });
    },

    // Guardar (Local + Nube simultáneo)
    guardarProducto: async function(producto) {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Guardar localmente para que la PC responda rápido
                const tx = this.db.transaction(['productos'], 'readwrite');
                tx.objectStore('productos').put(producto);

                // 2. Disparar copia a Firebase en la nube
                await set(ref(rtdb, 'productos/' + producto.id), producto);
                resolve(producto.id);
            } catch (error) {
                console.error("Error al sincronizar con la nube:", error);
                reject(error);
            }
        });
    },

    // Leer productos (Sincroniza la Nube oficial con el Local)
    obtenerProductos: async function() {
        return new Promise(async (resolve, reject) => {
            try {
                // 1. Descargar los productos de Firebase (La verdad absoluta)
                const snapshot = await get(ref(rtdb, 'productos'));
                const productosActualizados = [];

                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const tx = this.db.transaction(['productos'], 'readwrite');
                    const store = tx.objectStore('productos');

                    // 2. Guardarlos en el local para que el POS sea rápido
                    for (let key in data) {
                        productosActualizados.push(data[key]);
                        store.put(data[key]); // Sincroniza local con nube
                    }
                }
                
                // 3. Enviar los productos a la pantalla de la caja
                resolve(productosActualizados);

            } catch (error) {
                console.error("Sin conexión a la nube. Leyendo caché local:", error);
                
                // 4. Modo Offline: Si no hay internet, usamos la memoria local
                const tx = this.db.transaction(['productos'], 'readonly');
                const store = tx.objectStore('productos');
                const req = store.getAll();
                req.onsuccess = () => resolve(req.result);
                req.onerror = (e) => reject(e.target.error);
            }
        });
    },

    // Importar CSV/JSON (Guarda en ambos lados)
    importarMasivo: async function(listaProductos) {
        return new Promise(async (resolve, reject) => {
            try {
                const tx = this.db.transaction(['productos'], 'readwrite');
                const store = tx.objectStore('productos');
                
                for (let prod of listaProductos) {
                    if (!prod.id) prod.id = Date.now() + Math.floor(Math.random() * 1000); // Asegurar ID único
                    
                    store.put(prod); // Local
                    await set(ref(rtdb, 'productos/' + prod.id), prod); // Nube
                }
                resolve(listaProductos.length);
            } catch (e) {
                reject(e);
            }
        });
    },

    // Actualizar Stock (Botón "+" en la tabla)
    registrarMovimientoStock: async function(prodId, cantidad, tipo, motivo) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['movimientos_stock', 'productos'], 'readwrite');
            
            // Guardar historial del movimiento en local
            tx.objectStore('movimientos_stock').add({
                producto_id: prodId, tipo, cantidad, fecha: new Date().toISOString(), motivo
            });

            // Sumar stock
            if (tipo === 'ENTRADA') {
                const storeProd = tx.objectStore('productos');
                const reqProd = storeProd.get(prodId);
                
                reqProd.onsuccess = async () => {
                    const data = reqProd.result;
                    if (data) {
                        data.stock_actual = parseInt(data.stock_actual) + parseInt(cantidad);
                        storeProd.put(data); // Actualiza local
                        
                        // Actualiza Nube
                        await set(ref(rtdb, 'productos/' + prodId), data);
                        resolve();
                    }
                };
            } else {
                resolve();
            }
        });
    }
};

export default dbSystem;