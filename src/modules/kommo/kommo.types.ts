export interface KommoTag { id: number; name: string }
export interface KommoLead { id: number; tags: KommoTag[] }
export type KommoSyncStatus = 'updated' | 'already_synchronized' | 'conversation_not_found';
export interface KommoSyncResult { leadId: number; tagPresent: boolean; conversationFound: boolean; previousMode: 'AI' | 'HUMAN' | 'PAUSED' | null; finalMode: 'AI' | 'HUMAN' | 'PAUSED' | null; status: KommoSyncStatus }
