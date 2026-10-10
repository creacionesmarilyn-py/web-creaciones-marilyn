// Preview-only adapter. Never imported by the production build.
import {mountPanel} from './app.mjs';
const response=await fetch('/demo-catalog.json');if(!response.ok)throw new Error('Demo unavailable');
const data=await response.json();
await mountPanel({
  session:async()=>({id:'demo',email:'Cuenta de prueba',role:'owner',writable:true}),
  catalog:async()=>structuredClone(data),
  save:async(product,changes)=>{
    const id=product?.id ?? crypto.randomUUID();
    const saved={...changes,id,path:product?.path ?? '/productos/producto-'+id,version:(product?.version ?? 0)+1};
    data.products=data.products.filter(p=>p.id!==id);data.products.unshift(saved);return saved;
  },
  createCategory:async name=>{
    const existing=data.categories.find(c=>c.name.toLowerCase()===name.toLowerCase());if(existing)return existing;
    const category={id:crypto.randomUUID(),name};data.categories.push(category);return category;
  },
  logout:async()=>{},login:async()=>{},upload:async()=>{throw new Error('Photo uploads are disabled in demo');}
},{demo:true});
