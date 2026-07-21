import { prisma } from '../../config/prisma.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import type { KommoSyncResult } from './kommo.types.js';

function isKommoPauseEvent(event: { type: string; metadata: unknown } | undefined): boolean {
  return event?.type === 'PAUSED' && typeof event.metadata === 'object' && event.metadata !== null && 'source' in event.metadata && event.metadata.source === 'kommo';
}

export interface KommoRepository {
  synchronizeMode(leadId: number, pauseTag: string, tagPresent: boolean): Promise<KommoSyncResult>;
  canAiRespond(conversationId: string): Promise<boolean>;
}

export class PrismaKommoRepository implements KommoRepository {
  constructor(private readonly client: PrismaClient = prisma) {}
  async synchronizeMode(leadId: number, pauseTag: string, tagPresent: boolean): Promise<KommoSyncResult> {
    return this.client.$transaction(async (transaction) => {
      const conversation = await transaction.conversation.findUnique({
        where: { kommoLeadId: String(leadId) },
        select: { id: true, mode: true, events: { orderBy: { createdAt: 'desc' }, take: 1, select: { type: true, metadata: true } } },
      });
      if (conversation === null) return { leadId, tagPresent, conversationFound: false, previousMode: null, finalMode: null, status: 'conversation_not_found' };
      const previousMode = conversation.mode;
      const target = tagPresent
        ? (previousMode === 'HUMAN' ? null : 'PAUSED')
        : (previousMode === 'PAUSED' && isKommoPauseEvent(conversation.events[0]) ? 'AI' : null);
      if (target === null || target === previousMode) return { leadId, tagPresent, conversationFound: true, previousMode, finalMode: previousMode, status: 'already_synchronized' };
      const changedAt = new Date();
      await transaction.conversation.update({ where: { id: conversation.id }, data: { mode: target, modeChangedAt: changedAt, modeChangedBy: 'SYSTEM' } });
      await transaction.conversationEvent.create({ data: { conversationId: conversation.id, type: target === 'PAUSED' ? 'PAUSED' : 'RESUMED', changedBy: 'SYSTEM', metadata: { source: 'kommo', leadId: String(leadId), tag: pauseTag } } });
      return { leadId, tagPresent, conversationFound: true, previousMode, finalMode: target, status: 'updated' };
    });
  }
  async canAiRespond(conversationId: string): Promise<boolean> {
    const conversation = await this.client.conversation.findUnique({ where: { id: conversationId }, select: { mode: true } });
    return conversation?.mode === 'AI';
  }
}
