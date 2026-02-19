/* pos/js/db.js */

const DB_NAME = 'CreacionesMarilynPOS';
const DB_VERSION = 2; // ACTUALIZADO A VERSIÓN 2

const dbSystem = {
    db: null,

    // Inicializar la base de datos
    init: function() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Tabla: Productos
                if (!db.objectStoreNames.contains('productos')) {
                    const store = db.createObjectStore('productos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nombre', 'nombre', { unique: false });
                    store.createIndex('codigo_barras', 'codigo_barras', { unique: true });
                    store.createIndex('categoria', 'categoria', { unique: false });
                }

                // Tabla: Ventas
                if (!db.objectStoreNames.contains('ventas')) {
                    const store = db.createObjectStore('ventas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fecha_hora', 'fecha_hora', { unique: false });
                }

                // Tabla: Detalle Ventas
                if (!db.objectStoreNames.contains('detalle_ventas')) {
                    const store = db.createObjectStore('detalle_ventas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('venta_id', 'venta_id', { unique: false });
                }

                // --- NUEVO: Tabla Movimientos de Stock ---
                if (!db.objectStoreNames.contains('movimientos_stock')) {
                    const store = db.createObjectStore('movimientos_stock', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('producto_id', 'producto_id', { unique: false });
                    store.createIndex('fecha', 'fecha', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("Base de datos MarilynPOS inicializada correctamente (v2).");
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error("Error al abrir la BD:", event.target.error);
                reject(event.target.error);
            };
        });
    },

    // --- FUNCIONES DE PRODUCTOS ---

    // Agregar o Actualizar Producto
    guardarProducto: function(producto) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readwrite');
            const store = transaction.objectStore('productos');
            
            // Asegurar tipos de datos numéricos
            producto.precio_gs = parseInt(producto.precio_gs) || 0;
            producto.stock_actual = parseInt(producto.stock_actual) || 0;
            producto.stock_minimo = parseInt(producto.stock_minimo) || 0;
            producto.iva_pct = parseInt(producto.iva_pct) || 10;
            
            const request = store.put(producto); // .put inserta o actualiza si existe ID

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // Obtener todos los productos
    obtenerProductos: function() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readonly');
            const store = transaction.objectStore('productos');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // Eliminar producto
    eliminarProducto: function(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readwrite');
            const store = transaction.objectStore('productos');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    },

    // Importación Masiva (Recibe array de objetos)
    importarMasivo: function(listaProductos) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['productos'], 'readwrite');
            const store = transaction.objectStore('productos');
            
            let total = listaProductos.length;
            let procesados = 0;

            transaction.oncomplete = () => resolve(procesados);
            transaction.onerror = (e) => reject(e);

            listaProductos.forEach(prod => {
                if(!prod.id) delete prod.id; 
                store.put(prod);
                procesados++;
            });
        });
    },

    // --- NUEVA FUNCIÓN: REGISTRAR MOVIMIENTO ---
    registrarMovimientoStock: function(prodId, cantidad, tipo, motivo) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['movimientos_stock', 'productos'], 'readwrite');
            
            // 1. Guardar el historial
            const storeMov = tx.objectStore('movimientos_stock');
            storeMov.add({
                producto_id: prodId,
                tipo: tipo, // 'ENTRADA' o 'SALIDA' o 'AJUSTE'
                cantidad: cantidad,
                fecha: new Date(),
                motivo: motivo
            });

            // 2. Actualizar el producto (Solo si es ENTRADA manual desde Admin)
            if (tipo === 'ENTRADA') {
                const storeProd = tx.objectStore('productos');
                const reqProd = storeProd.get(prodId);
                
                reqProd.onsuccess = () => {
                    const data = reqProd.result;
                    if (data) {
                        data.stock_actual = parseInt(data.stock_actual) + parseInt(cantidad);
                        storeProd.put(data);
                    }
                };
            }

            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e);
        });
    },

    // --- FUNCIONES DE BACKUP (RESCATE Y RESTAURACIÓN) ---

    // 1. Exportar TODO (Productos, Ventas, Detalles, Movimientos)
    exportarBaseDatos: function() {
        return new Promise((resolve, reject) => {
            const tablas = ['productos', 'ventas', 'detalle_ventas', 'movimientos_stock'];
            const exportData = {};
            const tx = this.db.transaction(tablas, 'readonly');
            
            let completadas = 0;

            tablas.forEach(tabla => {
                const store = tx.objectStore(tabla);
                const req = store.getAll();
                
                req.onsuccess = (e) => {
                    exportData[tabla] = e.target.result;
                    completadas++;
                    if (completadas === tablas.length) {
                        resolve(exportData);
                    }
                };
                req.onerror = (e) => reject(e.target.error);
            });
        });
    },

    // 2. Restaurar TODO (Peligro: Borra lo actual y reemplaza)
    restaurarBaseDatos: function(importData) {
        return new Promise((resolve, reject) => {
            const tablas = ['productos', 'ventas', 'detalle_ventas', 'movimientos_stock'];
            // Validar que el archivo tenga las tablas necesarias
            if (!importData || !importData.productos) {
                return reject(new Error("El archivo no es un Backup válido de MarilynPOS."));
            }

            const tx = this.db.transaction(tablas, 'readwrite');
            
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);

            tablas.forEach(tabla => {
                const store = tx.objectStore(tabla);
                store.clear(); // Limpiar tabla actual

                if (importData[tabla] && Array.isArray(importData[tabla])) {
                    importData[tabla].forEach(item => {
                        // Si trae fechas en string (por el JSON), volver a convertirlas a Date objects
                        if (item.fecha_hora) item.fecha_hora = new Date(item.fecha_hora);
                        if (item.fecha) item.fecha = new Date(item.fecha);
                        
                        store.put(item); // Insertar con su ID original
                    });
                }
            });
        });
    }
};