import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { HttpKommoClient } from './kommo.client.js';
import { normalizeKommoBaseUrl } from './kommo.config.js';
import { PrismaKommoRepository } from './kommo.repository.js';
import { kommoWebhookQuerySchema } from './kommo.schemas.js';
import { KommoService } from './kommo.service.js';
import { parseKommoWebhook } from './kommo.webhook-parser.js';

function secretMatches(expected: string, received: string | undefined): boolean {
  if (received === undefined) return false;
  const first = Buffer.from(expected); const second = Buffer.from(received);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function createKommoRoutes(serviceFactory: () => KommoService, webhookSecret: string | undefined, production = false) {
  return async function kommoRoutes(app: FastifyInstance) {
    app.post('/webhooks/kommo', { bodyLimit: 64 * 1024 }, async (request, reply) => {
      const query = kommoWebhookQuerySchema.safeParse(request.query);
      const header = request.headers['x-kommo-webhook-secret'];
      const received = typeof header === 'string' ? header : query.success ? query.data.secret : undefined;
      if ((production && webhookSecret === undefined) || (webhookSecret !== undefined && !secretMatches(webhookSecret, received))) return reply.status(401).send({ error: 'UNAUTHORIZED_WEBHOOK' });
      try {
        const ids = parseKommoWebhook(request.body as string);
        const results = await serviceFactory().synchronizeLeads(ids);
        return reply.status(200).send({ accepted: true, processed: results.length, updated: results.filter((item) => item.status === 'updated').length, ignored: results.filter((item) => item.status !== 'updated').length });
      } catch (error) {
        if (error instanceof Error && (error.message === 'INVALID_KOMMO_WEBHOOK' || error.message === 'KOMMO_WEBHOOK_LIMIT_EXCEEDED')) return reply.status(400).send({ error: 'INVALID_REQUEST' });
        request.log.error('Falha segura ao processar webhook Kommo.');
        return reply.status(502).send({ error: 'KOMMO_SYNC_FAILED' });
      }
    });
  };
}

function defaultService(): KommoService {
  if (env.KOMMO_BASE_URL === undefined) throw new Error('KOMMO_CONFIGURATION_ERROR');
  return new KommoService(new HttpKommoClient(normalizeKommoBaseUrl(env.KOMMO_BASE_URL), env.KOMMO_ACCESS_TOKEN, env.KOMMO_REQUEST_TIMEOUT_MS), new PrismaKommoRepository(), env.KOMMO_PAUSE_TAG);
}
export const kommoRoutes = createKommoRoutes(defaultService, env.KOMMO_WEBHOOK_SECRET, env.NODE_ENV === 'production');
