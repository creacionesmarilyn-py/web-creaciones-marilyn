# Creaciones Marilyn

Catálogo público con pedidos por WhatsApp. Conserva la interfaz y las fuentes actuales de productos.

## Preparar y revisar

```sh
npm ci
npm run build
npm test
npm run preview
```

Abrir `http://localhost:4173`. Publicar únicamente `dist`, tal como indica `vercel.json`. La carpeta se regenera en cada compilación. El build optimiza imágenes con Sharp y copia una lista explícita de recursos públicos. `styles/utilities.css` contiene los estilos estáticos del diseño actual; añadir ahí las reglas que necesiten nuevos componentes, sin restaurar el compilador CDN en el navegador.

## Carga inicial y actualización

El build lee las fuentes públicas actuales, selecciona campos de catálogo y convierte las imágenes Base64 en archivos WebP deduplicados. Genera tarjetas y categorías en el HTML y datos JSON sin fotos incrustadas. Una fuente caída hace fallar el build; no se publica silenciosamente una vitrina vacía.

El navegador usa esos datos inmediatamente y consulta `/api/catalog` en segundo plano. La función hace la proyección desde el servidor, con caché en memoria de 30 segundos y CDN de 60 segundos. Si la actualización falla, conserva lo visible y avisa que se confirman precios/disponibilidad por WhatsApp. Las fotos nuevas aún no compiladas se sirven desde una ruta restringida, que comprueba producto público y versión de imagen. No admite URLs arbitrarias ni escrituras.

Esta transición elimina la descarga de la base completa en cada teléfono, pero el servidor todavía consulta Firebase. La futura fuente liviana mantenida por el administrador eliminará también esa transferencia en el servidor. Actualizar las fuentes sigue funcionando; volver a publicar actualiza el HTML inicial y genera nuevas variantes de fotos. Los precios del pedido son estimados y se confirman por WhatsApp.

Las pruebas cubren la proyección de campos, exclusión de productos ocultos, imágenes, HTML inicial y recuperación ante fallos de red. El preview local incluye las rutas de lectura necesarias, sin escrituras en la base.

## Seguridad y archivos internos

Admin, POS y respaldos se conservan localmente pero quedan fuera de nuevos despliegues. Esto no cambia las reglas de Firebase ni elimina versiones anteriores publicadas.

La contención provisional está preparada en `security/firebase-lockdown.rules.json`: conserva la lectura del catálogo y deniega lecturas privadas y escrituras de clientes. Antes de aplicarla, guardar las reglas actuales fuera del repositorio y verificar las integraciones en uso. El plan completo y la evidencia de auditoría se conservan en `docs/etapa-1-optimizacion.md`, un documento local excluido de Git mientras la corrección está pendiente.

No agregar claves de servidor al catálogo, a `img`, `lib` ni al código del navegador. No publicar documentos de seguridad ni respaldos.

## Comprobar la publicación

```sh
npm run verify:release -- http://localhost:4173
npm run verify:release -- https://www.creacionesmarilyn.com.py --firebase
```

El verificador solo hace lecturas. Comprueba cabeceras, recursos optimizados y que archivos internos no estén disponibles. Con `--firebase`, comprueba que el catálogo es público y la lectura anónima de ventas está denegada; solicita únicamente metadatos superficiales y no los guarda ni muestra. No prueba escrituras. Devuelve un error si alguna comprobación está pendiente. Los despliegues históricos deben revisarse por separado.
