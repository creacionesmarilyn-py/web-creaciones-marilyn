import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import catalogHandler from '../api/catalog.js';
import imageHandler from '../api/product-image.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const config = JSON.parse(await fs.readFile(new URL('../vercel.json', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript',
    '.css':'text/css', '.json':'application/json', '.xml':'application/xml', '.txt':'text/plain',
    '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };
http.createServer(async (req, res) => {
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        if (pathname === '/api/catalog' || pathname === '/api/product-image') {
            res.status = code => { res.statusCode = code; return res; };
            res.json = value => { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(value)); };
            await (pathname === '/api/catalog' ? catalogHandler : imageHandler)(req, res);
            return;
        }
        const file = path.resolve(root, '.' + pathname);
        if ((file !== path.resolve(root) && !file.startsWith(root)) || pathname.includes('\\')) throw new Error('Invalid path');
        const stat = await fs.stat(file);
        const resolved = stat.isDirectory() ? path.join(file, 'index.html') : file;
        const content = await fs.readFile(resolved);
        res.setHeader('Content-Type', types[path.extname(resolved).toLowerCase()] || 'application/octet-stream');
        res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
