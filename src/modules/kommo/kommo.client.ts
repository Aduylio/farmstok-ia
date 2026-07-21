import { z } from 'zod';
import { KommoError } from './kommo.errors.js';
import { normalizeKommoBaseUrl } from './kommo.config.js';
import type { KommoLead } from './kommo.types.js';

const responseSchema = z.object({ id: z.number().int().positive(), _embedded: z.object({ tags: z.array(z.object({ id: z.number().int().positive(), name: z.string() })).default([]) }).default({ tags: [] }) });
export interface KommoClient { getLeadById(leadId: number): Promise<KommoLead> }
export type KommoFetch = (input: string, init: RequestInit) => Promise<Response>;

export class HttpKommoClient implements KommoClient {
  private readonly baseUrl: string;
  constructor(baseUrl: string, private readonly token: string | undefined, private readonly timeoutMs: number, private readonly fetcher: KommoFetch = fetch) { this.baseUrl = normalizeKommoBaseUrl(baseUrl); }
  async getLeadById(leadId: number): Promise<KommoLead> {
    if (this.token === undefined) throw new KommoError('KOMMO_CONFIGURATION_ERROR');
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/v4/leads/${leadId}`, { method: 'GET', headers: { accept: 'application/json', authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(this.timeoutMs) });
      if (response.status === 401 || response.status === 403) throw new KommoError('KOMMO_UNAUTHORIZED');
      if (response.status === 404) throw new KommoError('KOMMO_NOT_FOUND');
      if (response.status === 429) throw new KommoError('KOMMO_RATE_LIMITED');
      if (response.status >= 500) throw new KommoError('KOMMO_API_ERROR');
      if (!response.ok) throw new KommoError('KOMMO_API_ERROR');
      const parsed = responseSchema.safeParse(await response.json());
      if (!parsed.success) throw new KommoError('KOMMO_INVALID_RESPONSE');
      return { id: parsed.data.id, tags: parsed.data._embedded.tags };
    } catch (error) {
      if (error instanceof KommoError) throw error;
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new KommoError('KOMMO_TIMEOUT');
      throw new KommoError('KOMMO_API_ERROR');
    }
  }
}
