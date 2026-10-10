// Preview has a local JSON fixture; production talks directly to Supabase.
export function adminPreviewHeaders(config) {
  const rule=config.headers.find(rule=>rule.source==='/gestion(.*)');
  if(!rule)throw new Error('Missing admin security headers');
  const headers=Object.fromEntries(rule.headers.map(header=>[header.key,header.value]));
  headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace(/connect-src\s+[^;]+/, "connect-src 'self'");
  return headers;
}
