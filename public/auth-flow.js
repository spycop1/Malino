// Einfache, testbare Auswertung von Supabase-E-Mail-Rückleitungen.
// Hier werden niemals Access-Tokens gelesen oder protokolliert.
export function readAuthReturn(href) {
  const url = new URL(href);
  const query = url.searchParams;
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''));
  const errorCode = query.get('error_code') || fragment.get('error_code') || query.get('error') || fragment.get('error') || '';
  const errorDescription = query.get('error_description') || fragment.get('error_description') || '';
  return {
    fromEmail: ['code', 'token_hash'].some(name => query.has(name)) || fragment.has('access_token') || !!errorCode || !!errorDescription,
    error: !!errorCode || !!errorDescription,
    expired: /expired|invalid|otp_expired/i.test(`${errorCode} ${errorDescription}`)
  };
}
