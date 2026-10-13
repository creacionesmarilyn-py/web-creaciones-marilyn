# Administrador de catálogo

El administrador vive en `/gestion`. La compilación omite el panel mientras `MARILYN_ADMIN_ENABLED` no sea `true`. `MARILYN_CATALOG_SOURCE=supabase` conecta la tienda pública al catálogo nuevo; la activación de escrituras se controla por separado en la base.

## Publicación — 12 de octubre de 2026

La tienda y `/gestion` están publicados en `https://www.creacionesmarilyn.com.py`, con lectura desde Supabase. Se verificó el acceso Google de la propietaria en el dominio real, 43 pruebas de código y 33 comprobaciones de publicación/seguridad. La base Firebase anterior conserva los datos como respaldo pero rechaza lecturas y escrituras de clientes. El 13 de octubre se habilitaron las escrituras con autorización explícita del usuario, comprobando que la única cuenta activa era la propietaria verificada. El administrador confirmó un guardado real del producto 26 conservando sus datos.

La rama de código es `codex/administrador-seguro`. El estado operativo y las evidencias privadas se conservan en `.private-migration/CONTINUAR-SUPABASE.md`, excluido de Git y Vercel. No recuperar una versión antigua que dependa de Firebase: volvería a dejar la tienda sin catálogo actualizado.

## Conexión real verificada — 10 de octubre de 2026

Se aplicaron las migraciones exclusivamente a `mskmfxkhfqimsmicuowv`: catálogo, Storage, permisos del event trigger y políticas/índices. Los nombres de archivo locales coinciden con el historial remoto. Las siete tablas tienen RLS.

Verificación anónima por HTTPS: catálogo HTTP 200 (vacío), datos internos HTTP 401, esquema `marilyn_private` HTTP 406 porque solo se exponen `public` y `graphql_public`. Se revocó EXECUTE de `public.rls_auto_enable()` a PUBLIC/anon/authenticated, conservando el event trigger de RLS. Los asesores ya no devuelven WARN/ERROR; quedan avisos INFO esperados sobre tablas privadas cerradas sin políticas e índices aún sin uso.

El 11 de octubre se verificó el ingreso real con Google en la preview local. Supabase confirmó la identidad y el usuario autorizó asignarle el rol de propietaria. Site URL apunta a `https://www.creacionesmarilyn.com.py/gestion`; la lista de retornos permite esa URL y `http://localhost:4175/gestion`, sin comodines. El 12 de octubre se importaron 326 productos (325 públicos, incluido un anuncio), 31 categorías, 326 filas internas y 313 fotos WebP. Los campos públicos y enlaces se cotejaron con el respaldo. No repetir la importación.

La preview con autenticación real se inicia mediante `npm run panel:live:preview`, con `MARILYN_ADMIN_ENABLED=true`, `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en el entorno. Escucha únicamente en loopback, puerto 4175, y conserva los encabezados de seguridad del panel. Respeta los permisos y el bloqueo de escrituras de la base real; no es la demostración en memoria.

## Revisar el panel sin cambiar la tienda

1. `npm ci`.
2. Copiar `.env.example` a `.env.local` y completar únicamente la clave publicable del proyecto Marilyn. Conservar `MARILYN_CATALOG_SOURCE=supabase`; Firebase ya está cerrado.
3. `node --env-file=.env.local scripts/build.mjs`.
4. `npm run panel:preview` y abrir `http://localhost:4174/gestion`.

La demostración usa exclusivamente el catálogo público compilado. Permite probar búsqueda, filtros, formularios y cambios en memoria; al recargar se descartan. Tiene un cartel permanente de demostración y no permite subir archivos. No usa credenciales ni llama a Supabase. El adaptador de demostración no forma parte del bundle de producción.

## Qué incluye

- Búsqueda por nombre/categoría, fotos, precio en guaraníes y estados disponible, agotado u oculto.
- Agregar productos y categorías; cambiar foto de portada y orden; copiar enlace permanente.
- Fotos convertidas a WebP de hasta 1200 píxeles de lado mayor; máximo 16 por producto. Entradas JPG/PNG/WebP hasta 12 MB y 24 megapíxeles; almacenamiento máximo 8 MB por archivo.
- Inicio de sesión Google con PKCE. Sesión en `sessionStorage` por pestaña. La identidad se verifica con `getUser`; los permisos se consultan en el servidor.
- Permisos de propietario/editor mantenidos en una tabla privada; el correo o los metadatos editables del perfil no conceden acceso.
- Funciones privilegiadas en el esquema privado no expuesto `marilyn_private`, con comprobación de identidad/permisos. Las funciones públicas de acceso usan los permisos del llamante; no conceden acceso directo a tablas privadas.
- Escritura por funciones controladas, validación de campos, enlaces e IDs inmutables, control de versiones y registro privado de cambios de productos.
- Filas internas separadas y accesibles solo al propietario. Un editor puede trabajar con fotos y precios sin consultar datos internos.
- CSP específica para el panel, `no-store`, `noindex`, sin analítica ni píxeles.

## Condiciones para activar

El despliegue debe completarse en este orden. Mantener `writes_enabled=false` hasta verificar toda la transición.

1. **Identificar el proyecto Supabase de Marilyn.** Destino elegido: `mskmfxkhfqimsmicuowv` en la organización `yinjfrcjvnikhgmxlqub`. La compilación del administrador rechaza otra URL mediante `server/project-target.mjs`. Esta comprobación local no sustituye verificar la organización con acceso autenticado. Comprobar organización, plan, región, políticas y respaldos existentes. No aplicar estas migraciones a proyectos de otros negocios ni crear un proyecto de pago sin resolver su costo.
2. **Aplicar las migraciones** de `supabase/migrations` y verificar RLS/grants en el proyecto real. Mantener `marilyn_private` fuera de los esquemas expuestos por la Data API; el permiso `USAGE` solo permite resolver las funciones autorizadas. Las pruebas PGlite verifican PostgreSQL localmente; no sustituyen la integración con Supabase Auth/Storage/PostgREST.
3. **Configurar Google OAuth.** Client ID y secret solo en el proveedor de Supabase; dominios y redirecciones exactas para producción y una preview controlada. Evitar comodines amplios. La URL autorizada de retorno del panel es `/gestion`.
4. **Verificar al propietario.** Tras un acceso real con Google, confirmar `auth.users.id`, correo confirmado y la identidad Google de la cuenta autorizada. Incorporar ese UUID a `marilyn_private.staff_members` mediante acceso privilegiado del servidor. Nunca autorizar por un campo editable del navegador. El resto del equipo debe tener cuentas individuales; no compartir contraseña.
5. **Respaldar e importar el catálogo.** Preservar IDs, precios, disponibilidad, productos ocultos y rutas de `content/catalog-routes.json`. Separar los campos internos. Migrar las imágenes Base64/legacy al bucket público antes de cerrar la fuente anterior. Guardar respaldos únicamente fuera del resultado publicado, por ejemplo en `.private-migration/` (ignorado por Git/Vercel). Verificar recuentos, enlaces, imágenes y una muestra de datos internos con acceso restringido.
6. **Conectar la lectura y publicación pública.** `MARILYN_CATALOG_SOURCE=supabase` activa lectura anónima de campos públicos y HTML actualizado de inicio, productos, categorías y sitemap. Caché de servidor de 10 segundos y CDN de 30 segundos: los cambios aparecen en menos de un minuto en solicitudes nuevas. No hace falta recompilar por cada guardado. `scripts/build-hosting.mjs` conserva las páginas estáticas de prueba fuera del directorio publicado para evitar que tengan prioridad sobre las rutas dinámicas. Las fotos nuevas tienen variantes WebP y JPEG social, limitadas al bucket de este proyecto. Si falla la base se devuelve 503, sin recuperar páginas retiradas de un respaldo estático. Las pruebas cubren edición, altas, nuevas categorías, ocultación y errores; verificar además el despliegue real.
7. **Preview real:** establecer `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `MARILYN_CATALOG_SOURCE=supabase` y `MARILYN_ADMIN_ENABLED=true` solo para el entorno validado. La clave debe ser pública (`sb_publishable_...` o legacy `anon`). El build rechaza claves secretas y `service_role`. Comprobar cuentas autorizadas/no autorizadas, subida de fotos, autorización RLS y encabezados reales.
8. **Transición:** confirmar que la tienda pública ya funciona con la fuente nueva, cerrar las lecturas anónimas de Firebase y verificar las rutas antiguas. Solo después habilitar `marilyn_private.site_state.writes_enabled` y publicación del panel de producción. Conservar un rollback coherente con el origen de datos; no volver a un despliegue que exponga respaldos o datos internos.

## Límites explícitos

- No están implementados todavía la gestión del equipo desde la interfaz ni el historial visual de cambios. Las altas/bajas del personal requieren acceso administrativo a Supabase.
- No hay eliminación permanente desde el panel. Ocultar permite retirar un producto del catálogo, pero **no vuelve privadas sus fotos**: son recursos públicos, que además pueden estar cacheados o compartidos. La limpieza de fotos subidas y luego abandonadas se debe programar después de acordar retención y comprobar referencias.
- Las políticas de Storage no permiten sobrescribir/eliminar fotos desde el navegador. Comprobar que no existan otras políticas permisivas que permitan el mismo bucket en el proyecto real.
- La API pública debe servir solo campos públicos. Las fotos de cursos y los videos requieren almacenamiento privado y permisos de matrícula; no usar este bucket para cursos.
- El modelo incluye la tienda propietaria de cada producto para preparar la futura plataforma de emprendedoras. No concede permisos de vendedor ni implementa todavía perfiles, cobros, matrículas o cursos.
- La aprobación manual por WhatsApp sigue siendo el flujo previsto para cursos/perfiles. El visitante del catálogo no necesita una cuenta.

## Comprobación

`npm test` incluye PostgreSQL/RLS con PGlite, permisos Storage, rechazo de escalación por metadatos, revocación, conflicto de edición, datos privados, pruebas del adaptador, formulario DOM y claves públicas del build. `npm run build` conserva el catálogo público optimizado. Las pruebas DOM no sustituyen la revisión visual ni una prueba real de Google OAuth.
