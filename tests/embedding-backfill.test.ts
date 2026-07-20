import { describe, expect, it, vi } from 'vitest';

import { embeddingConfig } from '../src/config/embedding.js';
import { parseEmbeddingCliArgs } from '../src/modules/knowledge-ingestion/embedding-backfill.cli.js';
import { rowToCandidate, type CandidateRow, type EmbeddingBackfillRepository } from '../src/modules/knowledge-ingestion/embedding-backfill.repository.js';
import { EmbeddingBackfillService } from '../src/modules/knowledge-ingestion/embedding-backfill.service.js';
import type { EmbeddingProvider } from '../src/modules/knowledge-ingestion/embedding-provider.js';
import { createEmbeddingInputHash, buildEmbeddingInput } from '../src/modules/knowledge-ingestion/embedding-input.js';

const baseRow: CandidateRow = { chunkId: '1', sourceKey: 'live:a', title: 'A', course: 'C', module: null, type: 'LIVE', content: 'Texto', provider: null, model: null, dimensions: null, inputHash: null };
const currentRow = (): CandidateRow => ({ ...baseRow, provider: embeddingConfig.provider, model: embeddingConfig.model, dimensions: embeddingConfig.dimensions, inputHash: createEmbeddingInputHash(buildEmbeddingInput(baseRow)) });

describe('seleÃ§Ã£o idempotente', () => {
  it('cria candidato ausente', () => expect(rowToCandidate(baseRow)?.action).toBe('create'));
  it.each([['provider', 'outro'], ['model', 'outro'], ['dimensions', 42], ['inputHash', 'a'.repeat(64)]] as const)('atualiza quando %s diverge', (field, value) => {
    expect(rowToCandidate({ ...currentRow(), [field]: value })?.action).toBe('update');
  });
  it('ignora atualizado e force o reprocessa', () => {
    expect(rowToCandidate(currentRow())).toBeNull();
    expect(rowToCandidate(currentRow(), true)?.action).toBe('update');
  });
});

function fixture(count: number, action: 'create' | 'update' = 'create') {
  return Array.from({ length: count }, (_, index) => ({ chunkId: String(index), sourceKey: `s:${index}`, input: `input ${index}`, inputHash: String(index).padStart(64, '0'), action }));
}
function fakeRepository(candidates = fixture(3), totalActive = candidates.length): EmbeddingBackfillRepository & { saveBatch: ReturnType<typeof vi.fn>; listCandidates: ReturnType<typeof vi.fn> } {
  return { listCandidates: vi.fn().mockResolvedValue({ candidates, totalActive }), saveBatch: vi.fn().mockResolvedValue(undefined) };
}
const provider = (): EmbeddingProvider & { embed: ReturnType<typeof vi.fn> } => ({ embed: vi.fn().mockImplementation(async (inputs: string[]) => ({ items: inputs.map(() => ({ embedding: new Array(1536).fill(0), inputTokens: 2 })), inputTokens: inputs.length * 2 })) });

describe('EmbeddingBackfillService', () => {
  it('dry-run nÃ£o chama provider nem escreve', async () => {
    const repository = fakeRepository(fixture(2), 5); const embeddingProvider = provider();
    const summary = await new EmbeddingBackfillService(repository, embeddingProvider).run({ dryRun: true, batchSize: 20 });
    expect(embeddingProvider.embed).not.toHaveBeenCalled(); expect(repository.saveBatch).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ candidates: 2, created: 2, skipped: 3, processed: 0 });
  });
  it('processa em lotes, preserva ordem e tokens', async () => {
    const repository = fakeRepository(fixture(5)); const embeddingProvider = provider();
    const summary = await new EmbeddingBackfillService(repository, embeddingProvider).run({ dryRun: false, batchSize: 2 });
    expect(embeddingProvider.embed.mock.calls.map(([inputs]) => inputs)).toEqual([['input 0', 'input 1'], ['input 2', 'input 3'], ['input 4']]);
    expect(repository.saveBatch).toHaveBeenCalledTimes(3); expect(summary).toMatchObject({ processed: 5, inputTokens: 10 });
  });
  it('exige provider em execuÃ§Ã£o real', async () => {
    await expect(new EmbeddingBackfillService(fakeRepository()).run({ dryRun: false, batchSize: 2 })).rejects.toThrow('EMBEDDING_CONFIGURATION_ERROR');
  });
  it('para na falha e nÃ£o escreve o batch invÃ¡lido', async () => {
    const repository = fakeRepository(); const failing = { embed: vi.fn().mockRejectedValue(new Error('falha')) };
    await expect(new EmbeddingBackfillService(repository, failing).run({ dryRun: false, batchSize: 2 })).rejects.toThrow('falha');
    expect(repository.saveBatch).not.toHaveBeenCalled();
  });
  it('encaminha sourceKey, limit e force ao repository', async () => {
    const repository = fakeRepository([]);
    await new EmbeddingBackfillService(repository).run({ dryRun: true, batchSize: 20, sourceKey: 'live:a', limit: 3, force: true });
    expect(repository.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: 'live:a', limit: 3, force: true }));
  });
});

describe('parser do CLI', () => {
  it('usa dry-run por padrÃ£o', () => expect(parseEmbeddingCliArgs([])).toEqual({ execute: false, yes: false, force: false }));
  it('interpreta todas as opÃ§Ãµes', () => expect(parseEmbeddingCliArgs(['--execute', '--yes', '--limit', '5', '--batch-size', '2', '--source-key', 'live:a', '--force'])).toEqual({ execute: true, yes: true, limit: 5, batchSize: 2, sourceKey: 'live:a', force: true }));
  it.each([['--unknown'], ['--limit', '0'], ['--batch-size', '101'], ['--source-key'], ['--yes']])('rejeita argumentos invÃ¡lidos: %j', (...args) => expect(() => parseEmbeddingCliArgs(args)).toThrow());
});
