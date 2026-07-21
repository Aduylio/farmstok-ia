export function normalizeKommoBaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('KOMMO_CONFIGURATION_ERROR');
  }
  return url.origin;
}
