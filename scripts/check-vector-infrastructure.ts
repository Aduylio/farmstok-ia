import { prisma } from '../src/config/prisma.js';
import { rowToCandidate, type CandidateRow } from '../src/modules/knowledge-ingestion/embedding-backfill.repository.js';

interface VectorExtensionRow { installedVersion: string | null }
interface VectorColumnRow { formattedType: string }
interface MetadataRow { providers: string[]; models: string[]; dimensions: number[] }
interface VectorAuditRow {
  sources: bigint; chunks: bigint; activeChunks: bigint; embeddings: bigint;
  chunksWithoutEmbedding: bigint; orphanEmbeddings: bigint; legacyColumnCount: bigint;
  embeddingTableCount: bigint; invalidHashes: bigint; nullVectors: bigint;
}

try {
  const extensionRows = await prisma.$queryRaw<VectorExtensionRow[]>`
    SELECT installed_version AS "installedVersion" FROM pg_available_extensions WHERE name = 'vector'
  `;
  const columnRows = await prisma.$queryRaw<VectorColumnRow[]>`
    SELECT format_type(attribute.atttypid, attribute.atttypmod) AS "formattedType"
    FROM pg_attribute attribute
    JOIN pg_class relation ON relation.oid = attribute.attrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public' AND relation.relname = 'knowledge_chunk_embeddings'
      AND attribute.attname = 'embedding' AND attribute.attnum > 0 AND NOT attribute.attisdropped
  `;
  const [audit] = await prisma.$queryRaw<VectorAuditRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "knowledge_sources") AS "sources",
      (SELECT COUNT(*) FROM "knowledge_chunks") AS "chunks",
      (SELECT COUNT(*) FROM "knowledge_chunks" chunks JOIN "knowledge_sources" sources ON sources."id" = chunks."source_id" WHERE sources."is_active" = true) AS "activeChunks",
      (SELECT COUNT(*) FROM "knowledge_chunk_embeddings") AS "embeddings",
      (SELECT COUNT(*) FROM "knowledge_chunks" chunks LEFT JOIN "knowledge_chunk_embeddings" embeddings ON embeddings."chunk_id" = chunks."id" WHERE embeddings."chunk_id" IS NULL) AS "chunksWithoutEmbedding",
      (SELECT COUNT(*) FROM "knowledge_chunk_embeddings" embeddings LEFT JOIN "knowledge_chunks" chunks ON chunks."id" = embeddings."chunk_id" WHERE chunks."id" IS NULL) AS "orphanEmbeddings",
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'knowledge_chunks' AND column_name = 'embedding') AS "legacyColumnCount",
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'knowledge_chunk_embeddings') AS "embeddingTableCount",
      (SELECT COUNT(*) FROM "knowledge_chunk_embeddings" WHERE "input_hash" !~ '^[0-9a-f]{64}$') AS "invalidHashes",
      (SELECT COUNT(*) FROM "knowledge_chunk_embeddings" WHERE "embedding" IS NULL) AS "nullVectors"
  `;
  const [metadata] = await prisma.$queryRaw<MetadataRow[]>`
    SELECT
      COALESCE(array_agg(DISTINCT "provider") FILTER (WHERE "provider" IS NOT NULL), ARRAY[]::varchar[]) AS "providers",
      COALESCE(array_agg(DISTINCT "model") FILTER (WHERE "model" IS NOT NULL), ARRAY[]::varchar[]) AS "models",
      COALESCE(array_agg(DISTINCT "dimensions") FILTER (WHERE "dimensions" IS NOT NULL), ARRAY[]::integer[]) AS "dimensions"
    FROM "knowledge_chunk_embeddings"
  `;
  const statusRows = await prisma.$queryRaw<CandidateRow[]>`
    SELECT chunks."id" AS "chunkId", sources."source_key" AS "sourceKey",
      sources."title", sources."course", sources."module", sources."type"::text AS "type",
      chunks."content", embeddings."provider", embeddings."model", embeddings."dimensions",
      embeddings."input_hash" AS "inputHash"
    FROM "knowledge_chunks" chunks
    JOIN "knowledge_sources" sources ON sources."id" = chunks."source_id"
    LEFT JOIN "knowledge_chunk_embeddings" embeddings ON embeddings."chunk_id" = chunks."id"
    WHERE sources."is_active" = true ORDER BY sources."source_key", chunks."id"
  `;
  if (audit === undefined) throw new Error('Auditoria vetorial indisponÃ­vel.');

  const installedVersion = extensionRows[0]?.installedVersion ?? null;
  const embeddings = Number(audit.embeddings);
  const outdated = statusRows.filter((row) => row.inputHash !== null && rowToCandidate(row) !== null).length;
  console.log('PostgreSQL conectado: sim');
  console.log(`ExtensÃ£o vector instalada: ${installedVersion === null ? 'nÃ£o' : 'sim'}`);
  console.log(`VersÃ£o instalada: ${installedVersion ?? 'nÃ£o instalada'}`);
  console.log(`Tabela knowledge_chunk_embeddings: ${Number(audit.embeddingTableCount) === 1 ? 'presente' : 'ausente'}`);
  console.log(`Tipo da coluna embedding: ${columnRows[0]?.formattedType ?? 'nÃ£o encontrado'}`);
  console.log(`Fontes: ${Number(audit.sources)}`);
  console.log(`Chunks: ${Number(audit.chunks)}`);
  console.log(`Chunks ativos: ${Number(audit.activeChunks)}`);
  console.log(`Embeddings: ${embeddings}`);
  console.log(`Chunks sem embedding: ${Number(audit.chunksWithoutEmbedding)}`);
  console.log(`Embeddings desatualizados: ${outdated}`);
  console.log(`Embeddings Ã³rfÃ£os: ${Number(audit.orphanEmbeddings)}`);
  console.log(`Providers encontrados: ${metadata?.providers.join(', ') || 'nenhum'}`);
  console.log(`Modelos encontrados: ${metadata?.models.join(', ') || 'nenhum'}`);
  console.log(`DimensÃµes encontradas: ${metadata?.dimensions.join(', ') || 'nenhuma'}`);
  console.log(`Hashes invÃ¡lidos: ${Number(audit.invalidHashes)}`);
  console.log(`Vetores nulos: ${Number(audit.nullVectors)}`);
  console.log(`Coluna antiga knowledge_chunks.embedding ausente: ${Number(audit.legacyColumnCount) === 0 ? 'sim' : 'nÃ£o'}`);
  console.log(`Nenhum embedding nesta etapa: ${embeddings === 0 ? 'sim' : 'nÃ£o'}`);
} catch {
  console.error('NÃ£o foi possÃ­vel auditar a infraestrutura vetorial.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
