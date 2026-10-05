import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as catalog from '../lib/catalog.mjs';

test('unsafe image protocols and SVG data are rejected; legacy photos still work', () => {
    for (const input of ['javascript:alert(1)', 'data:text/html,<script>x</script>',
        'data:image/svg+xml;base64,PHN2Zz4=', '//evil.example/x', 'img/../private.json',
        'https://user:password@example.com/photo.jpg']) {
        assert.equal(catalog.safeImageUrl(input), catalog.FALLBACK_IMAGE);
    }
    assert.match(catalog.safeImageUrl('img/foto.jpg'), /^https:\/\/raw\.githubusercontent\.com\//);
    assert.equal(catalog.safeImageUrl('data:image/jpeg;base64,YWJj'), 'data:image/jpeg;base64,YWJj');
});

test('corrupt or hostile saved carts cannot stop the catalog', () => {
    assert.deepEqual(catalog.readCart({ getItem() { throw new Error('Storage disabled'); } }), []);
    assert.deepEqual(catalog.readCart({ getItem: () => '{broken' }), []);
    const cart = catalog.readCart({ getItem: () => JSON.stringify([
        { id: 'a', name: 'Perlas', price: 5000, qty: 2 },
        { id: 'b', name: 'Invalid', price: -5, qty: 2 },
        { id: 'c', name: 'Invalid', price: 5, qty: -1 }
    ]) });
    assert.deepEqual(cart, [{ id: 'a', name: 'Perlas', price: 5000, qty: 2 }]);
});

test('matching by SKU and accent-normalized name preserves existing catalog photos', () => {
    const product = { id: 6, name: '  Perlítas NÚMERO 6 ' };
    const index = catalog.indexLegacyProducts([product, null]);
    assert.equal(index.byId.get('6'), product);
    assert.equal(index.byName.get('perlitas numero 6'), product);
});

test('product fields are escaped in actual card HTML; handlers carry IDs instead of code', async () => {
    const source = (await fs.readFile(new URL('../app.js', import.meta.url), 'utf8'))
        .replace(/^import .*;\r?\n/gm, '');
    const context = vm.createContext({ ...catalog, initializeApp: () => ({}), getDatabase: () => ({}),
        window: { localStorage: { getItem: () => '[]' } }, document: { addEventListener() {} }, console });
    vm.runInContext(source, context);
    const product = { id: '\" onclick=\"alert(1)', name: '<img src=x onerror=alert(1)>',
        collection: '\"><script>alert(2)</script>', status: 'normal', price: 5000,
        stock_actual: 1, images: ['javascript:alert(3)'] };
    context.product = product;
    const html = vm.runInContext('createProductCard(product)', context);
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(!html.includes(' onclick="'));
    assert.ok(!html.includes('src="javascript:'));
    assert.ok(html.includes('src="/img/logo_jpg.jpg"'));
    assert.ok(html.includes('data-product-id="&quot; onclick=&quot;alert(1)"'));
});

test('publishable build excludes backup, source data, unused admin/POS and tooling', async () => {
    for (const file of ['MarilynPOS_Backup_2026-02-19.json', 'database.json', 'package.json', 'Untitled-1.html', 'admin/index.html', 'pos/index.html', 'pos/reparacion_maestra.html']) {
        await assert.rejects(fs.access(new URL(`../dist/${file}`, import.meta.url)));
    }
    for (const file of ['index.html', 'lib/catalog.mjs', 'assets/site.css']) {
        await fs.access(new URL(`../dist/${file}`, import.meta.url));
    }
    const html = await fs.readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
    assert.ok(!html.includes('cdn.tailwindcss.com'));
    assert.ok(html.includes('srcset="/assets/cover-'));
    assert.ok(html.includes('Confirmar por WhatsApp'));
});
