import type { KommoClient } from './kommo.client.js';
import type { KommoRepository } from './kommo.repository.js';
import type { KommoSyncResult } from './kommo.types.js';

export class KommoService {
  constructor(private readonly client: KommoClient, private readonly repository: KommoRepository, private readonly pauseTag: string) {}
  async synchronizeLead(leadId: number): Promise<KommoSyncResult> {
    const lead = await this.client.getLeadById(leadId);
    const tagPresent = lead.tags.some((tag) => tag.name === this.pauseTag);
    return this.repository.synchronizeMode(leadId, this.pauseTag, tagPresent);
  }
  async synchronizeLeads(leadIds: number[]): Promise<KommoSyncResult[]> {
    const results: KommoSyncResult[] = [];
    for (const leadId of [...new Set(leadIds)]) results.push(await this.synchronizeLead(leadId));
    return results;
  }
  canAiRespond(conversationId: string): Promise<boolean> { return this.repository.canAiRespond(conversationId); }
}
