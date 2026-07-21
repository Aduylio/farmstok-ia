export const KOMMO_WEBHOOK_MAX_LEADS = 20;
const accepted = /^leads\[(add|update|status)\]\[\d+\]\[id\]$/u;

export function parseKommoWebhook(body: string): number[] {
  if (typeof body !== 'string' || body.length === 0) throw new Error('INVALID_KOMMO_WEBHOOK');
  const params = new URLSearchParams(body); const ids = new Set<number>();
  for (const [key, value] of params) {
    if (!accepted.test(key)) continue;
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('INVALID_KOMMO_WEBHOOK');
    ids.add(id);
    if (ids.size > KOMMO_WEBHOOK_MAX_LEADS) throw new Error('KOMMO_WEBHOOK_LIMIT_EXCEEDED');
  }
  if (ids.size === 0) throw new Error('INVALID_KOMMO_WEBHOOK');
  return [...ids];
}
