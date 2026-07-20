import { prisma } from '../../config/prisma.js';
import { embeddingConfig } from '../../config/embedding.js';
import { buildEmbeddingInput, createEmbeddingInputHash } from './embedding-input.js';
import type { KnowledgeSourceType } from '../knowledge/knowledge-search.schemas.js';
import { KnowledgeEmbeddingRepository, type UpsertEmbeddingInput } from './knowledge-embedding.repository.js';

export interface CandidateRow {
  chunkId: string;
  sourceKey: string;
  title: string;
  course: string;
  module: string | null;
  type: KnowledgeSourceType;
  content: string;
  provider: string | null;
  model: string | null;
  dimensions: number | null;
  inputHash: string | null;
}

export type EmbeddingCandidateAction = 'create' | 'update';

export interface EmbeddingBackfillCandidate {
  chunkId: string;
  sourceKey: string;
  input: string;
  inputHash: string;
  action: EmbeddingCandidateAction;
}

export interface CandidateQuery {
  sourceKey?: string;
  limit?: number;
  force?: boolean;
}

export interface CandidateQueryResult {
  totalActive: number;
  candidates: EmbeddingBackfillCandidate[];
}

export interface EmbeddingBackfillRepository {
  listCandidates(query: CandidateQuery): Promise<CandidateQueryResult>;
  saveBatch(inputs: UpsertEmbeddingInput[]): Promise<void>;
}

export function rowToCandidate(
  row: CandidateRow,
  force = false,
): EmbeddingBackfillCandidate | null {
  const input = buildEmbeddingInput(row);
  const inputHash = createEmbeddingInputHash(input);
  const exists = row.inputHash !== null;
  const current =
    exists &&
    row.provider === embeddingConfig.provider &&
    row.model === embeddingConfig.model &&
    row.dimensions === embeddingConfig.dimensions &&
    row.inputHash === inputHash;

  if (current && !force) return null;

  return {
    chunkId: row.chunkId,
    sourceKey: row.sourceKey,
    input,
    inputHash,
    action: exists ? 'update' : 'create',
  };
}

export class PrismaEmbeddingBackfillRepository implements EmbeddingBackfillRepository {
  async listCandidates(query: CandidateQuery): Promise<CandidateQueryResult> {
    const sourceKey = query.sourceKey ?? null;
    const rows = await prisma.$queryRaw<CandidateRow[]>`
      SELECT
        chunks."id" AS "chunkId",
        sources."source_key" AS "sourceKey",
        sources."title",
        sources."course",
        sources."module",
        sources."type"::text AS "type",
        chunks."content",
        embeddings."provider",
        embeddings."model",
        embeddings."dimensions",
        embeddings."input_hash" AS "inputHash"
      FROM "knowledge_chunks" AS chunks
      JOIN "knowledge_sources" AS sources ON sources."id" = chunks."source_id"
      LEFT JOIN "knowledge_chunk_embeddings" AS embeddings
        ON embeddings."chunk_id" = chunks."id"
      WHERE sources."is_active" = true
        AND (${sourceKey}::text IS NULL OR sources."source_key" = ${sourceKey})
      ORDER BY sources."source_key", chunks."id"
    `;

    const candidates = rows
      .map((row) => rowToCandidate(row, query.force))
      .filter((candidate): candidate is EmbeddingBackfillCandidate => candidate !== null)
      .slice(0, query.limit);

    return { totalActive: rows.length, candidates };
  }

  async saveBatch(inputs: UpsertEmbeddingInput[]): Promise<void> {
    await prisma.$transaction(async (transaction) => {
      const repository = new KnowledgeEmbeddingRepository({
        execute: (strings, ...values) => transaction.$executeRaw(strings, ...values),
        query: (strings, ...values) => transaction.$queryRaw(strings, ...values),
      });

      for (const input of inputs) await repository.upsertEmbedding(input);
    });
  }
}
