export const CATALOG_IMAGE_BASE='https://mskmfxkhfqimsmicuowv.supabase.co/storage/v1/object/public/marilyn-catalog-images/';
export const STORAGE_OBJECT=/^(?:migration-[a-f0-9]{64}\.webp|[a-f0-9-]{36}\/[a-f0-9-]{36}\.(?:webp|jpg|png))$/;
export function catalogImagePath(url,kind='card') {
  if(!String(url).startsWith(CATALOG_IMAGE_BASE))return '';
  const key=url.slice(CATALOG_IMAGE_BASE.length);
  return STORAGE_OBJECT.test(key)?'/api/catalog-photo?key='+encodeURIComponent(key)+'&kind='+kind:'';
}
