import fs from 'node:fs/promises';
import { fetchSources, projectCatalog } from '../server/catalog-source.mjs';
import { registerRoutes } from '../server/routes.mjs';
const target = new URL('../content/catalog-routes.json', import.meta.url);
let previous;
try { previous=JSON.parse(await fs.readFile(target, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const sources=await fetchSources();
const products=projectCatalog(sources.products,sources.legacyProducts);
if (!products.length) throw new Error('Empty catalog: routes were not changed');
const registry=registerRoutes(products,previous);
await fs.mkdir(new URL('../content/',import.meta.url),{recursive:true});
await fs.writeFile(target,JSON.stringify(registry,null,2)+'\n');
console.log(JSON.stringify({reservedProducts:Object.keys(registry.products).length,reservedCategories:Object.keys(registry.categories).length}));
