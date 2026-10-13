import {filterProducts,productState,money,validateChanges,safePhotoUrl,productLink,friendlyError,MAX_IMAGES} from './model.mjs';
import {optimizePhoto} from './photos.mjs';
const labels={available:'Disponible','sold-out':'Agotado',hidden:'Oculto'};
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
export async function mountPanel(adapter,{demo=false}={}) {
  const $=id=>document.getElementById(id);
  let session=null, products=[],categories=[],editing=null,photos=[],dirty=false,busy=false,limit=80;
  function notice(id,text,kind='') {const node=$(id);node.textContent=text;node.className='notice'+(kind?' '+kind:'');node.hidden=!text;}
  function setBusy(value) {
    busy=value;$('edit-fields').disabled=value || !session?.writable;
    for(const id of ['save','new-product']) $(id).disabled=value || !session?.writable;
    for(const id of ['close-editor','cancel-editor','logout','refresh']) $(id).disabled=value;
    $('save').textContent=value?'Un momento…':'Guardar cambios';
    $('photo-input').disabled=value || !session?.writable || demo;
  }
  function renderList() {
    const selected=$('category-filter').value;
    const found=filterProducts(selected?products.filter(p=>p.category_id===selected):products,'',$('filter').value);
    $('result-count').textContent=found.length+' '+(found.length===1?'producto':'productos');
    $('empty').hidden=found.length>0;$('more').hidden=found.length<=limit;
    const fragment=document.createDocumentFragment();
    for(const p of found.slice(0,limit)) {
      const row=el('button',undefined,'product-row');row.type='button';
      row.setAttribute('aria-label','Editar '+p.name);
      if(safePhotoUrl(p.images?.[0])){const img=el('img');img.src=p.images[0];img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';row.append(img);}
      else row.append(el('span','Sin foto','no-photo'));
      const info=el('span',undefined,'product-info');info.append(el('strong',p.name),el('small',p.category_name));
      const state=productState(p);
      row.append(info,el('span',money(p.price),'product-price'),el('span',labels[state],'badge '+state),el('span','Editar →','edit-label'));
      row.addEventListener('click',()=>openEditor(p));fragment.append(row);
    }
    $('products').replaceChildren(fragment);
  }
  function renderCategoryFilter() {
    const selected=$('category-filter').value;
    const all=el('option','Todas las categorías');all.value='';
    $('category-filter').replaceChildren(all,...[...categories].sort((a,b)=>a.name.localeCompare(b.name,'es')).map(c=>{const option=el('option',c.name);option.value=c.id;return option;}));
    $('category-filter').value=categories.some(c=>c.id===selected)?selected:'';
  }
  function renderCategories(selected='') {
    const placeholder=el('option','Elegí una categoría');placeholder.value='';
    $('category').replaceChildren(placeholder,...categories.map(c=>{const option=el('option',c.name);option.value=c.id;return option;}));
    $('category').value=selected;
  }
  function renderPhotos() {
    $('photo-list').replaceChildren(...photos.map((url,index)=>{
      const card=el('div',undefined,'photo-card'),img=el('img');
      if(safePhotoUrl(url)) img.src=url;img.alt='Foto '+(index+1);img.referrerPolicy='no-referrer';
      const remove=el('button','Quitar foto');remove.type='button';remove.disabled=!session?.writable;
      remove.addEventListener('click',()=>{photos.splice(index,1);dirty=true;renderPhotos();});
      card.append(img,el('small',index===0?'Portada':'Foto '+(index+1)));
      if(index>0){const cover=el('button','Usar como portada');cover.type='button';cover.disabled=!session?.writable;cover.addEventListener('click',()=>{photos.unshift(...photos.splice(index,1));dirty=true;renderPhotos();});card.append(cover);}
      card.append(remove);return card;
    }));
  }
  function renderShare() {
    const url=productLink(editing);$('share').hidden=!url;$('share-url').value=url;$('copy').textContent='Copiar enlace';
  }
  function openEditor(product=null) {
    if(busy)return;editing=product?structuredClone(product):null;photos=[...(product?.images ?? [])];dirty=false;
    $('product-form').reset();$('editor-title').textContent=product?'Editar producto':'Agregar producto';
    $('name').value=product?.name ?? '';$('price').value=product?.price ?? '';
    $('state').value=product?productState(product):'hidden';$('featured').checked=Boolean(product?.featured);
    $('category-create').hidden=true;renderCategories(product?.category_id ?? $('category-filter').value);renderPhotos();renderShare();setBusy(false);
    notice('editor-status',session?.writable?'':'Este catálogo está en preparación. Todavía no se pueden guardar cambios.');
    $('editor').showModal();$('name').focus();
  }
  function closeEditor() {
    if(busy)return;
    if(dirty && !window.confirm('Hay cambios sin guardar. ¿Querés salir y descartarlos?'))return;
    $('editor').close();dirty=false;
  }
  async function loadCatalog() {
    notice('global-status','Buscando tus productos…');
    try {const data=await adapter.catalog();products=data.products;categories=data.categories;renderCategoryFilter();renderList();notice('global-status','');}
    catch(error){notice('global-status',friendlyError(error),'error');}
  }
  async function start() {
    try {
      session=await adapter.session();$('account').hidden=!session;$('account-email').textContent=session?.email ?? '';
      $('login').hidden=Boolean(session);$('denied').hidden=!session || Boolean(session.role);$('catalog').hidden=!session?.role;
      $('preparation').hidden=!session?.role || session.writable;setBusy(false);
      notice('global-status','');
      if(session?.role)await loadCatalog();
    } catch(error) { session=null;products=[];categories=[];renderList();$('catalog').hidden=true;$('account').hidden=true;$('denied').hidden=true;$('login').hidden=false;setBusy(false);notice('global-status',friendlyError(error),'error'); }
  }
  $('demo-banner').hidden=!demo;
  $('login-button').addEventListener('click',async()=>{
    $('login-button').disabled=true;
    try{await adapter.login();}catch(error){notice('global-status',friendlyError(error),'error');$('login-button').disabled=false;}
  });
  $('logout').addEventListener('click',async()=>{
    if(dirty && !window.confirm('Hay cambios sin guardar. ¿Querés salir de tu cuenta?'))return;
    try{await adapter.logout();location.replace('/gestion');}catch(error){notice('global-status',friendlyError(error),'error');}
  });
  $('new-product').addEventListener('click',()=>openEditor());
  $('refresh').addEventListener('click',async()=>{setBusy(true);try{await start();}finally{setBusy(false);}});
  for(const id of ['category-filter','filter']) $(id).addEventListener('change',()=>{limit=80;renderList();});
  $('more').addEventListener('click',()=>{limit+=80;renderList();});
  for(const id of ['close-editor','cancel-editor']) $(id).addEventListener('click',closeEditor);
  $('editor').addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
  $('product-form').addEventListener('input',()=>{dirty=true;});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  $('copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('share-url').value);$('copy').textContent='¡Enlace copiado!';}
    catch{$('share-url').focus();$('share-url').select();notice('editor-status','Seleccionamos el enlace: mantené presionado para copiarlo, o usá Ctrl+C.');}
  });
  $('product-form').addEventListener('submit',async event=>{
    event.preventDefault();if(busy || !session?.writable)return;
    let changes;
    try{changes=validateChanges({name:$('name').value,price:$('price').value,category_id:$('category').value,state:$('state').value,featured:$('featured').checked},photos,editing ?? {});}
    catch(error){notice('editor-status',error.message,'error');return;}
    if(changes.visibility==='hidden' && editing?.visibility==='published' && !window.confirm('Este producto dejará de aparecer en la tienda. ¿Guardar como oculto?'))return;
    setBusy(true);notice('editor-status','Guardando…');
    try{
      const saved=await adapter.save(editing,changes);saved.category_name=categories.find(c=>c.id===saved.category_id)?.name ?? '';
      products=products.filter(p=>p.id!==saved.id);products.unshift(saved);editing=saved;dirty=false;renderList();renderShare();
      $('editor-title').textContent='Editar producto';
      notice('editor-status',demo?'Cambios guardados solo en esta demostración.':'Cambios guardados. La tienda se actualizará en menos de un minuto.','success');
    }catch(error){notice('editor-status',friendlyError(error),'error');}
    finally{setBusy(false);}
  });
  $('add-category').addEventListener('click',()=>{$('category-create').hidden=false;$('category-name').focus();});
  $('cancel-category').addEventListener('click',()=>{$('category-create').hidden=true;});
  $('category-name').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();$('confirm-category').click();}});
  $('confirm-category').addEventListener('click',async()=>{
    const name=$('category-name').value.trim();if(!name){$('category-name').focus();return;}if(busy || !session?.writable)return;
    setBusy(true);
    try{const category=await adapter.createCategory(name);if(!categories.some(c=>c.id===category.id))categories.push(category);categories.sort((a,b)=>a.name.localeCompare(b.name,'es'));renderCategories(category.id);renderCategoryFilter();$('category-create').hidden=true;dirty=true;notice('editor-status','Categoría lista. Guardá el producto para asignarla.');}
    catch(error){notice('editor-status',friendlyError(error),'error');}finally{setBusy(false);}
  });
  $('photo-input').addEventListener('change',async()=>{
    const files=[...$('photo-input').files];$('photo-input').value='';if(!files.length || busy || !session?.writable)return;
    if(photos.length+files.length>MAX_IMAGES){notice('editor-status','Podés agregar hasta 16 fotos. Quitá alguna antes de agregar más.','error');return;}
    setBusy(true);
    try{
      for(let i=0;i<files.length;i++){
        notice('editor-status','Preparando foto '+(i+1)+' de '+files.length+'…');
        const blob=await optimizePhoto(files[i]);
        let url;try{url=await adapter.upload(blob);}catch(error){throw new Error(friendlyError(error));}
        if(!safePhotoUrl(url))throw new Error('No se pudo obtener el enlace de la foto. Intentá de nuevo.');
        photos.push(url);dirty=true;renderPhotos();
      }
      notice('editor-status','Fotos listas. Guardá los cambios para agregarlas al producto.');
    }catch(error){notice('editor-status',error.message,'error');}finally{setBusy(false);}
  });
  // Never retain the OAuth callback code or error description in a shareable URL.
  await start();
  if(location.search || location.hash)history.replaceState(null,'','/gestion');
}
