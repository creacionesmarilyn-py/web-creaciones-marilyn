import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import catalogHandler from '../api/catalog.js';
import imageHandler from '../api/product-image.js';
import publicPageHandler from '../api/public-page.js';
import catalogPhotoHandler from '../api/catalog-photo.js';
import {usesSupabase} from '../server/public-catalog.mjs';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const config = JSON.parse(await fs.readFile(new URL('../vercel.json', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.mjs':'text/javascript',
    '.css':'text/css', '.json':'application/json', '.xml':'application/xml', '.txt':'text/plain',
    '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp' };
http.createServer(async (req, res) => {
    for (const header of config.headers[0].headers) res.setHeader(header.key, header.value);
    try {
        if(!['localhost:4173','127.0.0.1:4173'].includes(req.headers.host)){res.writeHead(400);res.end();return;}
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const handlers={'/api/catalog':catalogHandler,'/api/product-image':imageHandler,'/api/catalog-photo':catalogPhotoHandler};
        const publicPage=usesSupabase() && (pathname==='/' || pathname==='/sitemap.xml' || /^\/(productos|categorias)\/[a-z0-9-]+$/.test(pathname));
        if (handlers[pathname] || publicPage) {
            res.status = code => { res.statusCode = code; return res; };
            res.json = value => { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(value)); };
            await (publicPage?publicPageHandler:handlers[pathname])(req, res);
            return;
        }
        if (/^\/(productos|categorias)\/[a-z0-9-]+\/$/.test(pathname)) { res.writeHead(308,{Location:pathname.slice(0,-1)}); res.end(); return; }
        if(pathname.startsWith('/gestion'))for(const header of config.headers.find(rule=>rule.source==='/gestion(.*)').headers)res.setHeader(header.key,header.value);
        let file = path.resolve(root, '.' + pathname);
        if(pathname==='/gestion')file=path.join(root,'gestion.html');
        if ((file !== path.resolve(root) && !file.startsWith(root)) || pathname.includes('\\')) throw new Error('Invalid path');
        try { await fs.access(file); } catch { if (!path.extname(file)) file += '.html'; }
        const stat = await fs.stat(file);
        const resolved = stat.isDirectory() ? path.join(file, 'index.html') : file;
        const content = await fs.readFile(resolved);
        res.setHeader('Content-Type', types[path.extname(resolved).toLowerCase()] || 'application/octet-stream');
        res.end(content);
    } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173, '127.0.0.1', () => console.log('Preview: http://127.0.0.1:4173'));
