import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../src/generated/prisma/client.js';
import { parseKommoLeadId } from '../src/modules/kommo/kommo.cli.js';
import { HttpKommoClient } from '../src/modules/kommo/kommo.client.js';
import { normalizeKommoBaseUrl } from '../src/modules/kommo/kommo.config.js';
import { KommoError } from '../src/modules/kommo/kommo.errors.js';
import { PrismaKommoRepository, type KommoRepository } from '../src/modules/kommo/kommo.repository.js';
import { createKommoRoutes } from '../src/modules/kommo/kommo.routes.js';
import { KommoService } from '../src/modules/kommo/kommo.service.js';
import { KOMMO_WEBHOOK_MAX_LEADS, parseKommoWebhook } from '../src/modules/kommo/kommo.webhook-parser.js';

describe('configuracao Kommo', () => {
  it('aceita HTTPS e remove barra final', () => expect(normalizeKommoBaseUrl('https://conta.kommo.com/')).toBe('https://conta.kommo.com'));
  it.each(['http://conta.kommo.com', 'https://conta.kommo.com/path', 'https://user:pass@conta.kommo.com'])('rejeita URL insegura %s', (url) => expect(() => normalizeKommoBaseUrl(url)).toThrow());
});

describe('cliente Kommo', () => {
  it('token ausente bloqueia chamada, mas nao construcao', async () => {
    const fetcher = vi.fn(); const client = new HttpKommoClient('https://conta.kommo.com', undefined, 1000, fetcher);
    await expect(client.getLeadById(1)).rejects.toMatchObject({ code: 'KOMMO_CONFIGURATION_ERROR' }); expect(fetcher).not.toHaveBeenCalled();
  });
  it('envia Bearer, endpoint oficial e interpreta apenas tags', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 7, name: 'privado', _embedded: { tags: [{ id: 2, name: 'IA_PAUSADA' }] } }), { status: 200 }));
    const lead = await new HttpKommoClient('https://conta.kommo.com', 'segredo', 1234, fetcher).getLeadById(7);
    expect(lead).toEqual({ id: 7, tags: [{ id: 2, name: 'IA_PAUSADA' }] });
    expect(fetcher).toHaveBeenCalledWith('https://conta.kommo.com/api/v4/leads/7', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer segredo' }), signal: expect.any(AbortSignal) }));
  });
  it.each([[401, 'KOMMO_UNAUTHORIZED'], [403, 'KOMMO_UNAUTHORIZED'], [404, 'KOMMO_NOT_FOUND'], [429, 'KOMMO_RATE_LIMITED'], [500, 'KOMMO_API_ERROR'], [503, 'KOMMO_API_ERROR']] as const)('mapeia HTTP %i', async (status, code) => {
    const client = new HttpKommoClient('https://conta.kommo.com', 'token-nao-exposto', 1000, vi.fn().mockResolvedValue(new Response('', { status })));
    await expect(client.getLeadById(1)).rejects.toMatchObject({ code, message: 'Nao foi possivel consultar o Kommo.' });
  });
  it('mapeia timeout e resposta invalida sem segredo', async () => {
    const timeout = new HttpKommoClient('https://conta.kommo.com', 'segredo', 1000, vi.fn().mockRejectedValue(new DOMException('segredo', 'TimeoutError')));
    await expect(timeout.getLeadById(1)).rejects.toMatchObject({ code: 'KOMMO_TIMEOUT', message: expect.not.stringContaining('segredo') });
    const invalid = new HttpKommoClient('https://conta.kommo.com', 'segredo', 1000, vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await expect(invalid.getLeadById(1)).rejects.toBeInstanceOf(KommoError);
  });
});

describe('parser de webhook tradicional', () => {
  it.each([['leads%5Badd%5D%5B0%5D%5Bid%5D=10', 10], ['leads%5Bupdate%5D%5B0%5D%5Bid%5D=11', 11], ['leads%5Bstatus%5D%5B0%5D%5Bid%5D=12', 12]])('interpreta evento form-urlencoded', (body, id) => expect(parseKommoWebhook(body)).toEqual([id]));
  it('deduplica IDs', () => expect(parseKommoWebhook('leads%5Badd%5D%5B0%5D%5Bid%5D=10&leads%5Bupdate%5D%5B0%5D%5Bid%5D=10')).toEqual([10]));
  it.each(['', 'foo=bar', 'leads%5Badd%5D%5B0%5D%5Bid%5D=x'])('rejeita payload invalido', (body) => expect(() => parseKommoWebhook(body)).toThrow());
  it('limita leads', () => { const body = Array.from({ length: KOMMO_WEBHOOK_MAX_LEADS + 1 }, (_, i) => `leads%5Badd%5D%5B${i}%5D%5Bid%5D=${i + 1}`).join('&'); expect(() => parseKommoWebhook(body)).toThrow('KOMMO_WEBHOOK_LIMIT_EXCEEDED'); });
});

function fakeRepository(): KommoRepository & { synchronizeMode: ReturnType<typeof vi.fn> } {
  return { synchronizeMode: vi.fn().mockImplementation(async (leadId, _tag, tagPresent) => ({ leadId, tagPresent, conversationFound: true, previousMode: 'AI', finalMode: tagPresent ? 'PAUSED' : 'AI', status: tagPresent ? 'updated' : 'already_synchronized' })), canAiRespond: vi.fn().mockResolvedValue(false) };
}
describe('service Kommo', () => {
  it('detecta tag presente e ausente e deduplica consultas', async () => {
    const client = { getLeadById: vi.fn().mockImplementation(async (id: number) => ({ id, tags: id === 1 ? [{ id: 2, name: 'IA_PAUSADA' }] : [] })) }; const repository = fakeRepository(); const service = new KommoService(client, repository, 'IA_PAUSADA');
    await service.synchronizeLeads([1, 1, 2]); expect(client.getLeadById).toHaveBeenCalledTimes(2); expect(repository.synchronizeMode).toHaveBeenNthCalledWith(1, 1, 'IA_PAUSADA', true); expect(repository.synchronizeMode).toHaveBeenNthCalledWith(2, 2, 'IA_PAUSADA', false);
  });
});

function prismaFixture(mode: 'AI' | 'HUMAN' | 'PAUSED' | null, source = 'kommo', failCreate = false) {
  const update = vi.fn().mockResolvedValue({}); const create = failCreate ? vi.fn().mockRejectedValue(new Error('rollback')) : vi.fn().mockResolvedValue({});
  const transaction = { conversation: { findUnique: vi.fn().mockResolvedValue(mode === null ? null : { id: 'c1', mode, events: mode === 'PAUSED' ? [{ type: 'PAUSED', metadata: { source } }] : [] }), update }, conversationEvent: { create } };
  const client = { $transaction: vi.fn().mockImplementation(async (callback) => callback(transaction)), conversation: { findUnique: vi.fn().mockResolvedValue(mode === null ? null : { mode }) } } as unknown as PrismaClient;
  return { client, transaction, update, create };
}
describe('persistencia e idempotencia', () => {
  it('AI para PAUSED cria evento seguro na mesma transacao', async () => { const f = prismaFixture('AI'); const result = await new PrismaKommoRepository(f.client).synchronizeMode(10, 'IA_PAUSADA', true); expect(result.status).toBe('updated'); expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ mode: 'PAUSED', modeChangedBy: 'SYSTEM' }) })); expect(f.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'PAUSED', changedBy: 'SYSTEM', metadata: { source: 'kommo', leadId: '10', tag: 'IA_PAUSADA' } }) }); });
  it('PAUSED pelo Kommo para AI cria RESUMED', async () => { const f = prismaFixture('PAUSED'); const result = await new PrismaKommoRepository(f.client).synchronizeMode(10, 'IA_PAUSADA', false); expect(result.finalMode).toBe('AI'); expect(f.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'RESUMED' }) }); });
  it.each([['HUMAN', true], ['HUMAN', false], ['AI', false], ['PAUSED', true]] as const)('estado %s com tag %s e idempotente/protegido', async (mode, tag) => { const f = prismaFixture(mode); const result = await new PrismaKommoRepository(f.client).synchronizeMode(10, 'IA_PAUSADA', tag); expect(result.status).toBe('already_synchronized'); expect(f.update).not.toHaveBeenCalled(); expect(f.create).not.toHaveBeenCalled(); });
  it('nao retoma pausa que nao veio do Kommo', async () => { const f = prismaFixture('PAUSED', 'manual'); expect((await new PrismaKommoRepository(f.client).synchronizeMode(10, 'IA_PAUSADA', false)).status).toBe('already_synchronized'); });
  it('conversa inexistente e ignorada', async () => { const f = prismaFixture(null); expect((await new PrismaKommoRepository(f.client).synchronizeMode(10, 'IA_PAUSADA', true)).status).toBe('conversation_not_found'); });
  it('propaga falha para rollback da transacao', async () => { const f = prismaFixture('AI', 'kommo', true); await expect(new PrismaKommoRepository(f.client).synchronizeMode(10, 'IA_PAUSADA', true)).rejects.toThrow('rollback'); });
  it.each([['AI', true], ['PAUSED', false], ['HUMAN', false], [null, false]] as const)('canAiRespond %s => %s', async (mode, expected) => { const f = prismaFixture(mode); await expect(new PrismaKommoRepository(f.client).canAiRespond('c1')).resolves.toBe(expected); });
});

describe('rota e script', () => {
  it('route aceita form, exige segredo configurado e retorna resumo', async () => { const repo = fakeRepository(); const service = new KommoService({ getLeadById: vi.fn().mockResolvedValue({ id: 10, tags: [] }) }, repo, 'IA_PAUSADA'); const app = Fastify(); app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_r, body, done) => done(null, body)); app.register(createKommoRoutes(() => service, '1234567890123456')); const unauthorized = await app.inject({ method: 'POST', url: '/webhooks/kommo', payload: 'leads%5Badd%5D%5B0%5D%5Bid%5D=10', headers: { 'content-type': 'application/x-www-form-urlencoded' } }); expect(unauthorized.statusCode).toBe(401); const response = await app.inject({ method: 'POST', url: '/webhooks/kommo?secret=1234567890123456', payload: 'leads%5Badd%5D%5B0%5D%5Bid%5D=10', headers: { 'content-type': 'application/x-www-form-urlencoded' } }); expect(response.statusCode).toBe(200); expect(response.json()).toMatchObject({ accepted: true, processed: 1 }); await app.close(); });
  it('parser do script aceita um ID positivo', () => { expect(parseKommoLeadId(['123'])).toBe(123); expect(() => parseKommoLeadId([])).toThrow(); expect(() => parseKommoLeadId(['x'])).toThrow(); });
});
