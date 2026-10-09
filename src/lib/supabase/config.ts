/**
 * Sanitiza y valida la URL de Supabase para evitar errores de sintaxis comunes
 * como enlaces markdown copiado/pegado ([url](url)), comillas o barras finales.
 */
export function getSanitizedSupabaseUrl(): string {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let clean = rawUrl.trim().replace(/^['"]|['"]$/g, '');

  // Detecta y extrae si vino en formato markdown: [url](https://...) o [texto](https://...)
  const markdownMatch = clean.match(/\[.*?\]\((https?:\/\/[^\)]+)\)/);
  if (markdownMatch) {
    clean = markdownMatch[1];
  } else {
    // Si contiene corchetes sueltos ej: [https://...]
    clean = clean.replace(/[\[\]]/g, '');
  }

  return clean.replace(/\/+$/, '').trim();
}
