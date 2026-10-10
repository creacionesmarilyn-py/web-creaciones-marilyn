export const STORE_ID = '00000000-0000-4000-8000-000000000001';
export const MAX_IMAGES = 16;
export const PUBLIC_ORIGIN = 'https://www.creacionesmarilyn.com.py';
export const money = value => 'Gs. ' + Number(value).toLocaleString('es-PY');
export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function productState(product) {
  return product.visibility === 'hidden' ? 'hidden' : product.available ? 'available' : 'sold-out';
}
export function filterProducts(products, query, state = 'all') {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return products.filter(p => (state === 'all' || productState(p) === state) && terms.every(term => normalize(p.name + ' ' + p.category_name).includes(term)));
}
export function validateChanges(form, images, previous = {}) {
  const name = String(form.name ?? '').trim();
  const priceText = String(form.price ?? '').trim();
  if (!name || name.length > 200) throw new Error('Escribí un nombre de hasta 200 caracteres.');
  if (!/^[0-9]{1,10}$/.test(priceText)) throw new Error('Escribí el precio en guaraníes, sin puntos ni decimales.');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(form.category_id ?? '')) throw new Error('Elegí una categoría.');
  if (!['available','sold-out','hidden'].includes(form.state)) throw new Error('Elegí cómo mostrar el producto.');
  if (!Array.isArray(images) || images.length > MAX_IMAGES) throw new Error('Podés agregar hasta 16 fotos.');
  if (images.some(value => !safePhotoUrl(value))) throw new Error('Una foto no tiene una dirección válida. Volvé a cargarla.');
  return {name, price:Number(priceText), category_id:form.category_id,
    available:form.state === 'hidden' ? previous.available !== false : form.state !== 'sold-out', visibility:form.state === 'hidden' ? 'hidden' : 'published', featured:Boolean(form.featured), images:[...images]};
}
export function safePhotoUrl(value) {
  try { const url = new URL(value); return typeof value === 'string' && value.length <= 2048 && url.protocol === 'https:' && !url.username && !url.password && !/\s/.test(value); }
  catch { return false; }
}
export function productLink(product) {
  return /^\/productos\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product?.path ?? '') ? PUBLIC_ORIGIN + product.path : '';
}
export function friendlyError(error) {
  const message = String(error?.message ?? error ?? '');
  const known = {
    CATALOG_CONFLICT:'Otra persona modificó este producto. Tus cambios siguen en pantalla: copialos si los necesitás y volvé a abrir el producto para ver la última versión.',
    CATALOG_FORBIDDEN:'Tu cuenta no tiene permiso para hacer este cambio. Consultá con la persona responsable.',
    CATALOG_NOT_ACTIVE:'El catálogo está en preparación. La edición se habilitará al terminar la conexión con la web.',
    CATALOG_NOT_FOUND:'Este producto ya no está disponible para editar. Actualizá la lista.',
    CATALOG_INVALID:'Revisá el nombre, precio, categoría y fotos antes de guardar.',
    CATALOG_TOO_MANY_IMAGES:'Podés agregar hasta 16 fotos.',
    SESSION_EXPIRED:'Tu sesión venció. Volvé a entrar con Google.',
  };
  for (const [code,text] of Object.entries(known)) if (message.includes(code)) return text;
  return 'No se pudo completar la operación. Revisá tu conexión e intentá de nuevo. Si sigue pasando, avisá a la persona responsable.';
}
