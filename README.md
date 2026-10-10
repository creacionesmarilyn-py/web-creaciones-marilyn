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

## Páginas por producto y categoría

El build genera HTML propio para cada producto público y categoría, con URL canónica, Open Graph, imagen JPEG 1200×630, datos estructurados y sitemap. Las fichas incluyen precio estimado, galería, carrito, consulta por WhatsApp con referencia y URL, y copia de enlace. No requieren cuenta ni cobran en la web. La actualización del catálogo conserva la ficha o categoría abierta.

`content/catalog-routes.json` es el registro de enlaces permanentes, vinculado a los IDs existentes. No borrar ni reasignar rutas de productos retirados. Un cambio de nombre conserva la ruta del producto. Los duplicados de nombre reciben un sufijo y nunca comparten dirección. Para incorporar productos o categorías nuevos, ejecutar `npm run routes:sync`, revisar y guardar el registro en Git, compilar y publicar. El build falla si faltan rutas, evitando publicar enlaces rotos. La futura administración debe automatizar este flujo. Los cambios de nombre de categoría necesitan conservar o redirigir explícitamente su ruta antes de publicar.

El precio y la disponibilidad visibles se actualizan desde el endpoint; las vistas previas sociales y el HTML para buscadores se renuevan al publicar. WhatsApp también puede conservar su propia caché. Los productos retirados dejan de generarse en la siguiente publicación y conservan su ruta reservada. Las fichas solo incluyen en sus datos iniciales el producto y sus imágenes; las categorías incluyen sus propios productos.

Pruebas adicionales: estabilidad de enlaces, variantes con nombres repetidos, escape en HTML/metadatos, las 355 páginas y sus recursos, copia con alternativa si se bloquea el portapapeles, actualización de precio/retiro y búsqueda dentro de una categoría. Referencias: [Open Graph](https://ogp.me/) y [datos estructurados de producto de Google](https://developers.google.com/search/docs/appearance/structured-data/product-snippet). La presencia de metadatos no garantiza indexación ni resultados enriquecidos.

## Administrador en preparación

La nueva gestión de productos se encuentra detrás de una configuración optativa y no está activa en producción. Para revisar la demostración local y las condiciones de activación de Supabase, consultar [la guía del administrador](docs/administrador.md). La tienda pública conserva su funcionamiento actual.
