import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { parseKommoLeadId } from '../src/modules/kommo/kommo.cli.js';
import { HttpKommoClient } from '../src/modules/kommo/kommo.client.js';
import { PrismaKommoRepository } from '../src/modules/kommo/kommo.repository.js';
import { KommoService } from '../src/modules/kommo/kommo.service.js';

try {
  const leadId = parseKommoLeadId(process.argv.slice(2));
  if (env.KOMMO_BASE_URL === undefined || env.KOMMO_ACCESS_TOKEN === undefined) throw new Error('KOMMO_CONFIGURATION_ERROR');
  const service = new KommoService(new HttpKommoClient(env.KOMMO_BASE_URL, env.KOMMO_ACCESS_TOKEN, env.KOMMO_REQUEST_TIMEOUT_MS), new PrismaKommoRepository(), env.KOMMO_PAUSE_TAG);
  const result = await service.synchronizeLead(leadId);
  console.log(`Lead ID: ${result.leadId}`);
  console.log(`Tag ${env.KOMMO_PAUSE_TAG}: ${result.tagPresent ? 'presente' : 'ausente'}`);
  console.log(`Conversa encontrada: ${result.conversationFound ? 'sim' : 'nao'}`);
  console.log(`Estado anterior: ${result.previousMode ?? 'nao aplicavel'}`);
  console.log(`Estado final: ${result.finalMode ?? 'nao aplicavel'}`);
  console.log(`Transicao realizada: ${result.status === 'updated' ? 'sim' : 'nao'}`);
} catch { console.error('Nao foi possivel sincronizar o lead.'); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
