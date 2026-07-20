import type { EmbeddingProvider } from './embedding-provider.js';
import type { EmbeddingBackfillRepository } from './embedding-backfill.repository.js';

export interface EmbeddingBackfillOptions {
  dryRun: boolean;
  batchSize: number;
  sourceKey?: string;
  limit?: number;
  force?: boolean;
  onBatch?: (progress: EmbeddingBatchProgress) => void;
}

export interface EmbeddingBatchProgress {
  batch: number;
  batches: number;
  processed: number;
  created: number;
  updated: number;
  inputTokens: number;
}

export interface EmbeddingBackfillSummary {
  dryRun: boolean;
  candidates: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  inputTokens: number;
  characters: number;
  approximateTokens: number;
}

export class EmbeddingBackfillService {
  constructor(
    private readonly repository: EmbeddingBackfillRepository,
    private readonly provider?: EmbeddingProvider,
  ) {}

  async run(options: EmbeddingBackfillOptions): Promise<EmbeddingBackfillSummary> {
    const result = await this.repository.listCandidates(options);
    const candidates = result.candidates;
    const characters = candidates.reduce((sum, item) => sum + item.input.length, 0);
    const created = candidates.filter((item) => item.action === 'create').length;
    const updated = candidates.length - created;
    const summary: EmbeddingBackfillSummary = {
      dryRun: options.dryRun,
      candidates: candidates.length,
      processed: 0,
      created: options.dryRun ? created : 0,
      updated: options.dryRun ? updated : 0,
      skipped: Math.max(0, result.totalActive - candidates.length),
      failed: 0,
      inputTokens: 0,
      characters,
      approximateTokens: Math.ceil(characters / 4),
    };

    if (options.dryRun) return summary;
    if (this.provider === undefined) throw new Error('EMBEDDING_CONFIGURATION_ERROR');

    const batches = Math.ceil(candidates.length / options.batchSize);
    for (let offset = 0; offset < candidates.length; offset += options.batchSize) {
      const batch = candidates.slice(offset, offset + options.batchSize);
      try {
        const response = await this.provider.embed(batch.map((item) => item.input));
        const embeddedAt = new Date();
        await this.repository.saveBatch(batch.map((candidate, index) => {
          const item = response.items[index];
          if (item === undefined) throw new Error('EMBEDDING_INVALID_RESPONSE');
          return {
            chunkId: candidate.chunkId,
            embedding: item.embedding,
            inputHash: candidate.inputHash,
            ...(item.inputTokens === undefined ? {} : { inputTokens: item.inputTokens }),
            embeddedAt,
          };
        }));
        const batchCreated = batch.filter((item) => item.action === 'create').length;
        summary.processed += batch.length;
        summary.created += batchCreated;
        summary.updated += batch.length - batchCreated;
        summary.inputTokens += response.inputTokens;
        options.onBatch?.({
          batch: Math.floor(offset / options.batchSize) + 1,
          batches,
          processed: batch.length,
          created: batchCreated,
          updated: batch.length - batchCreated,
          inputTokens: response.inputTokens,
        });
      } catch (error) {
        summary.failed += batch.length;
        throw error;
      }
    }

    return summary;
  }
}
