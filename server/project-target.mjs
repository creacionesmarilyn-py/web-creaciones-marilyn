// Explicitly selected by the owner for Marilyn. SOY is outside this project's scope.
export const MARILYN_SUPABASE_PROJECT = 'mskmfxkhfqimsmicuowv';
export const MARILYN_SUPABASE_URL = 'https://mskmfxkhfqimsmicuowv.supabase.co';
export const MARILYN_SUPABASE_ORGANIZATION = 'yinjfrcjvnikhgmxlqub';
export function assertMarilynProjectUrl(url) {
  if (url !== MARILYN_SUPABASE_URL) throw new Error('Refusing to connect Marilyn to a different Supabase project');
}
