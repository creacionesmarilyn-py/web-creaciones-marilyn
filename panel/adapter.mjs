import {STORE_ID} from './model.mjs';
import {photoExtension} from './photos.mjs';
const PRODUCT_FIELDS = 'id,name,price,category_id,available,visibility,featured,popup,images,path,version,updated_at';
function unwrap(result) { if (result.error) throw result.error; return result.data; }
export function createCatalogAdapter(client) {
  async function user() { const data=unwrap(await client.auth.getUser()); if(!data.user) throw new Error('SESSION_EXPIRED'); return data.user; }
  async function allRows(table,columns,configure=query=>query) {
    const rows=[];
    for(let from=0;from<50000;from+=500) {
      const page=unwrap(await configure(client.from(table).select(columns)).order('id').range(from,from+499));
      rows.push(...page); if(page.length<500) return rows;
    }
    throw new Error('Catalog exceeds page limit');
  }
  return {
    async session() {
      const session=unwrap(await client.auth.getSession()).session;
      if(!session) return null;
      const current=await user();
      const context=unwrap(await client.rpc('marilyn_staff_context'));
      return {email:current.email, id:current.id, role:context.role, writable:context.writes_enabled === true};
    },
    async login() { unwrap(await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/gestion',queryParams:{prompt:'select_account'}}})); },
    async logout() { unwrap(await client.auth.signOut({scope:'local'})); },
    async catalog() {
      const [products,categories]=await Promise.all([
        allRows('marilyn_products',PRODUCT_FIELDS,query=>query.eq('store_id',STORE_ID).eq('popup',false)),
        allRows('marilyn_categories','id,name,path')
      ]);
      const names=new Map(categories.map(c=>[c.id,c.name]));
      return {products:products.map(p=>({...p,category_name:names.get(p.category_id) ?? ''})),categories:categories.sort((a,b)=>a.name.localeCompare(b.name,'es'))};
    },
    async save(product,changes) {
      await user();
      const data=unwrap(await client.rpc('marilyn_save_product',{p_id:product?.id ?? null,p_expected_version:product?.version ?? null,p_changes:changes}));
      return Array.isArray(data)?data[0]:data;
    },
    async createCategory(name) {
      await user();const data=unwrap(await client.rpc('marilyn_create_category',{p_name:name}));return Array.isArray(data)?data[0]:data;
    },
    async upload(blob) {
      const extension=photoExtension(blob.type);
      const current=await user();const object=current.id+'/'+crypto.randomUUID()+'.'+extension;
      unwrap(await client.storage.from('marilyn-catalog-images').upload(object,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false}));
      return client.storage.from('marilyn-catalog-images').getPublicUrl(object).data.publicUrl;
    }
  };
}
