// Read-only release checks. Never sends writes, messages or authentication tokens.
const args = process.argv.slice(2);
const firebase = args.includes('--firebase');
const siteArg = args.find(arg => !arg.startsWith('--'));
if (args.some(arg => arg.startsWith('--') && arg !== '--firebase') || (!siteArg && !firebase)) {
    console.error('Uso: npm run verify:release -- https://www.creacionesmarilyn.com.py [--firebase]');
    process.exit(2);
}
const checks = [];
function record(name, pass, detail) { checks.push({ name, pass, detail }); }
async function request(url, method = 'GET') {
    // A redirected login or homepage is not evidence that a private file is missing.
    return fetch(url, { method, redirect: 'manual', signal: AbortSignal.timeout(15000) });
}
async function check(name, run) {
    try { await run(); }
    catch (error) { record(name, false, error.name === 'TimeoutError' ? 'Tiempo de espera agotado' : 'No se pudo completar la solicitud'); }
}

if (siteArg) {
    const site = new URL(siteArg);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(site.hostname);
    if ((!local && site.protocol !== 'https:') || site.username || site.password || site.search || site.hash || site.pathname !== '/') {
        throw new Error('Usar el origen HTTPS, sin credenciales, rutas ni parámetros; HTTP solo para localhost.');
    }
    console.log(`Sitio: ${site.origin}`);
    await check('Página principal y cabeceras', async () => {
        const response = await request(site);
        const html = await response.text();
        record('Página principal', response.status === 200 && html.includes('Confirmar por WhatsApp'), `HTTP ${response.status}`);
        record('Productos visibles sin JavaScript', html.includes('data-product-card=') && html.includes('id="catalog-data"') && !html.includes('Cargando vitrina'), 'Tarjetas incluidas en el HTML');
        record('CSS compilado', html.includes('/assets/site.css') && !html.includes('cdn.tailwindcss.com'), 'Sin compilador Tailwind remoto');
        record('Portada optimizada', /srcset="\/assets\/cover-/.test(html), 'Variantes WebP');
        for (const [name, expected] of [['x-content-type-options', 'nosniff'], ['x-frame-options', 'DENY'], ['referrer-policy', 'strict-origin-when-cross-origin']]) {
            record(name, response.headers.get(name) === expected, response.headers.get(name) || 'Ausente');
        }
        const csp = response.headers.get('content-security-policy') || '';
        const directives = new Set(csp.split(';').map(value => value.trim()));
        record('CSP básica', ["object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'"].every(value => directives.has(value)), csp || 'Ausente');
    });
    for (const pathname of ['/MarilynPOS_Backup_2026-02-19.json', '/admin/', '/admin/admin.js', '/pos/', '/pos/reparacion_maestra.html', '/database.json', '/security/firebase-lockdown.rules.json', '/package.json']) {
        await check(pathname, async () => {
            const response = await request(new URL(pathname, site), 'HEAD');
            record(`Archivo privado ${pathname}`, [401, 403, 404, 410].includes(response.status), `HTTP ${response.status}`);
        });
    }
    await check('Catálogo ligero del mismo dominio', async () => {
        const response = await request(new URL('/api/catalog', site));
        const body = await response.text();
        const data = JSON.parse(body);
        const allowed = new Set(['id', 'name', 'price', 'collection', 'status', 'destacado', 'popup', 'available', 'images']);
        record('Catálogo ligero disponible', response.status === 200 && Array.isArray(data.products) && data.products.length > 0, 'HTTP ' + response.status);
        record('Datos públicos sin fotos incrustadas', !body.includes('data:image') && data.products.every(p => Object.keys(p).every(key => allowed.has(key))), 'Lista explícita de campos');
        record('Catálogo menor de 750 KB', Buffer.byteLength(body) < 750000, Buffer.byteLength(body) + ' bytes');
    });
    await check('Páginas compartibles', async () => {
        const home = await (await request(site)).text();
        const seed = JSON.parse(home.match(/id="catalog-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
        const productPath = seed.routes?.products?.['26'] || Object.values(seed.routes?.products || {})[0];
        const categoryPath = seed.routes?.categories?.['perlas numero 6'] || Object.values(seed.routes?.categories || {})[0];
        const paths = [productPath, categoryPath];
        for (const path of paths) {
            if (!path) throw new Error('Missing shared route');
            const response = await request(new URL(path, site));
            const html = await response.text();
            const product = path.startsWith('/productos/');
            record(product ? 'Ficha de producto' : 'Página de categoría', response.status === 200 && html.includes(product ? 'Copiar enlace del producto' : 'Copiar enlace de la categoría'), 'HTTP '+response.status);
            record('URL canónica '+path, html.includes('rel="canonical" href="https://www.creacionesmarilyn.com.py'+path+'"') && (html.match(/<h1[ >]/g)||[]).length === 1, 'Título y dirección propios');
            const image = html.match(/property="og:image" content="([^"]+)"/)?.[1];
            record('Metadatos sociales '+path, /^https:\/\/www\.creacionesmarilyn\.com\.py\/assets\/share-[a-f0-9]+\.jpg$/.test(image || '') && html.includes('application/ld+json'), 'Imagen JPEG y datos estructurados');
            if (product && image) {
                const photo = await request(new URL(new URL(image).pathname, site), 'HEAD');
                record('Imagen para compartir disponible', photo.status === 200 && photo.headers.get('content-type')?.includes('image/jpeg'), 'HTTP '+photo.status);
            }
        }
        const xml = await (await request(new URL('/sitemap.xml', site))).text();
        record('Sitemap con productos y categorías', paths.every(path => xml.includes('https://www.creacionesmarilyn.com.py'+path+'</loc>')), (xml.match(/<loc>/g)||[]).length+' direcciones');
        const missing = await request(new URL('/productos/producto-inexistente-verificacion',site),'HEAD');
        record('Producto inexistente devuelve 404',missing.status === 404,'HTTP '+missing.status);
    });
    await check('Recursos optimizados', async () => {
        const response = await request(new URL('/assets/image-manifest.json', site));
        if (!response.ok) { record('Manifiesto de imágenes', false, `HTTP ${response.status}`); return; }
        const manifest = await response.json();
        const image = Object.values(manifest).find(value => typeof value === 'string' && /^\/assets\/product-[a-f0-9]+\.webp$/.test(value));
        record('Manifiesto de imágenes', Boolean(image), `${Object.keys(manifest).length} entradas`);
        if (!image) return;
        const photo = await request(new URL(image, site), 'HEAD');
        record('Foto optimizada disponible', photo.status === 200 && photo.headers.get('content-type')?.includes('image/webp'), `HTTP ${photo.status}`);
        if (!local) record('Caché de foto con nombre de contenido', /max-age=31536000/.test(photo.headers.get('cache-control') || '') && /immutable/.test(photo.headers.get('cache-control') || ''), photo.headers.get('cache-control') || 'Ausente');
    });
}
if (firebase) {
    // Only shallow key metadata is requested; keys and record contents are never logged or saved.
    const database = 'https://creaciones-marilyn-default-rtdb.firebaseio.com';
    console.log('Firebase: creaciones-marilyn (solo lectura anónima de metadatos)');
    for (const branch of ['productos', 'ventas']) {
        await check(`Firebase ${branch}`, async () => {
            const response = await request(`${database}/${branch}.json?shallow=true`);
            const data = await response.json();
            if (branch === 'productos') {
                record('Catálogo público disponible', response.status === 200 && data && typeof data === 'object' && !data.error && Object.keys(data).length > 0, `HTTP ${response.status}`);
            } else {
                record('Lectura anónima de ventas denegada', [401, 403].includes(response.status) && /permission denied/i.test(String(data?.error)), `HTTP ${response.status}`);
            }
        });
    }
    console.log('Este control no intenta escrituras ni certifica reglas completas: revisar también la consola de Firebase.');
}
for (const { name, pass, detail } of checks) console.log(`${pass ? 'OK' : 'PENDIENTE'} | ${name} | ${detail}`);
const failures = checks.filter(check => !check.pass).length;
console.log(`${checks.length - failures}/${checks.length} comprobaciones satisfactorias. ${new Date().toISOString()}`);
process.exitCode = failures ? 1 : 0;
