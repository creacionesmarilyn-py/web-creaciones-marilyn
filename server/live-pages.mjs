import {composePage,stripHomeMetadata,renderCategoryPage,productStructured,categoryStructured} from './pages.mjs';
import {renderCategoriesHTML,renderProductGrid} from '../lib/render.mjs';
import {renderProductDetail} from '../lib/detail.mjs';
import {SITE_ORIGIN,categoryKey,isCatalogProduct,jsonForHtml} from '../lib/links.mjs';
import {escapeHtml,imageForDisplay} from '../lib/catalog.mjs';
import {catalogImagePath} from '../lib/storage-images.mjs';

export function renderLivePage(route,catalog,runtime) {
  const {products,routes,updatedAt}=catalog;
  const visible=products.filter(isCatalogProduct);
  const seed=(items,page)=>{
    const used=new Set(items.flatMap(p=>p.images.flatMap(image=>[imageForDisplay(image,runtime.images),imageForDisplay(image,runtime.images,true)])));
    return {products:items,images:Object.fromEntries(Object.entries(runtime.images).filter(([,url])=>used.has(url))),routes,page,updatedAt};
  };
  const social=p=>runtime.shares[p.images[0]] || catalogImagePath(p.images[0],'share') || runtime.fallbackShare;
  if(route==='/sitemap.xml'){
    const paths=['/',...Object.values(routes.products),...Object.values(routes.categories)];
    return {status:200,type:'application/xml; charset=utf-8',body:'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+paths.map(path=>'  <url><loc>'+escapeHtml(SITE_ORIGIN+path)+'</loc></url>').join('\n')+'\n</urlset>\n'};
  }
  if(route==='/')return {status:200,type:'text/html; charset=utf-8',body:runtime.template
    .replace('<!-- CATALOG_DATA -->',()=>jsonForHtml(seed(products,{type:'home'})))
    .replace('<!-- CATALOG_CATEGORIES -->',()=>renderCategoriesHTML(products,'todas',routes))
    .replace('<!-- CATALOG_PRODUCTS -->',()=>renderProductGrid(visible,{images:runtime.images,routes}))};
  const template=stripHomeMetadata(runtime.template);
  const product=visible.find(p=>routes.products[p.id]===route);
  if(product){
    const image=social(product);
    return {status:200,type:'text/html; charset=utf-8',body:composePage(template,{title:product.name,
      description:`${product.name} · ${product.collection}. Gs. ${product.price.toLocaleString('es-PY')}. Consultá precio y disponibilidad por WhatsApp en Creaciones Marilyn.`,
      path:route,image,structured:productStructured(product,routes,image),seed:seed([product],{type:'product',id:product.id,path:route}),
      content:`<p id="catalog-status" role="status" class="text-center text-sm text-gray-500 mb-4" hidden></p><div id="product-detail">${renderProductDetail(product,{images:runtime.images,routes})}</div>`})};
  }
  const key=Object.keys(routes.categories).find(key=>routes.categories[key]===route);
  if(key){
    const items=visible.filter(p=>categoryKey(p.collection)===key),name=items[0]?.collection;
    if(name)return {status:200,type:'text/html; charset=utf-8',body:composePage(template,{title:name,
      description:`Explorá ${name} en Creaciones Marilyn. Fotos, precios y consultas por WhatsApp. Envíos desde Luque a todo Paraguay.`,
      path:route,image:social(items[0]),imageAlt:items[0].name,structured:categoryStructured(name,items,routes),
      seed:seed(items,{type:'category',category:key,path:route}),content:renderCategoryPage(name,items,products,{images:runtime.images,routes,category:key})})};
  }
  return {status:404,type:'text/html; charset=utf-8',body:'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Producto no disponible · Creaciones Marilyn</title><h1>Esta página ya no está disponible.</h1><p><a href="/">Volver a la tienda</a></p></html>'};
}
