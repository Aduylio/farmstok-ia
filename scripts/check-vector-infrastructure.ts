import { prisma } from '../src/config/prisma.js';

interface VectorExtensionRow {
  installedVersion: string | null;
}

interface VectorColumnRow {
  formattedType: string;
}

interface VectorAuditRow {
  sources: bigint;
  chunks: bigint;
  embeddings: bigint;
  chunksWithoutEmbedding: bigint;
  orphanEmbeddings: bigint;
  legacyColumnCount: bigint;
  embeddingTableCount: bigint;
}

try {
  const extensionRows = await prisma.$queryRaw<VectorExtensionRow[]>`
    SELECT installed_version AS "installedVersion"
    FROM pg_available_extensions
    WHERE name = 'vector'
  `;
  const columnRows = await prisma.$queryRaw<VectorColumnRow[]>`
    SELECT format_type(attribute.atttypid, attribute.atttypmod) AS "formattedType"
    FROM pg_attribute AS attribute
    JOIN pg_class AS relation ON relation.oid = attribute.attrelid
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'knowledge_chunk_embeddings'
      AND attribute.attname = 'embedding'
      AND attribute.attnum > 0
      AND NOT attribute.attisdropped
  `;
  const [audit] = await prisma.$queryRaw<VectorAuditRow[]>`
    SELECT
      (SELECT COUNT(*) FROM "knowledge_sources") AS "sources",
      (SELECT COUNT(*) FROM "knowledge_chunks") AS "chunks",
      (SELECT COUNT(*) FROM "knowledge_chunk_embeddings") AS "embeddings",
      (
        SELECT COUNT(*)
        FROM "knowledge_chunks" AS chunks
        LEFT JOIN "knowledge_chunk_embeddings" AS embeddings
          ON embeddings."chunk_id" = chunks."id"
        WHERE embeddings."chunk_id" IS NULL
      ) AS "chunksWithoutEmbedding",
      (
        SELECT COUNT(*)
        FROM "knowledge_chunk_embeddings" AS embeddings
        LEFT JOIN "knowledge_chunks" AS chunks
          ON chunks."id" = embeddings."chunk_id"
        WHERE chunks."id" IS NULL
      ) AS "orphanEmbeddings",
      (
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_chunks'
          AND column_name = 'embedding'
      ) AS "legacyColumnCount",
      (
        SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'knowledge_chunk_embeddings'
      ) AS "embeddingTableCount"
  `;

  if (audit === undefined) throw new Error('Auditoria vetorial indisponível.');

  const installedVersion = extensionRows[0]?.installedVersion ?? null;
  const formattedType = columnRows[0]?.formattedType ?? null;
  const embeddings = Number(audit.embeddings);

  console.log('PostgreSQL conectado: sim');
  console.log(`Extensão vector instalada: ${installedVersion === null ? 'não' : 'sim'}`);
  console.log(`Versão instalada: ${installedVersion ?? 'não instalada'}`);
  console.log(`Tabela knowledge_chunk_embeddings: ${Number(audit.embeddingTableCount) === 1 ? 'presente' : 'ausente'}`);
  console.log(`Tipo da coluna embedding: ${formattedType ?? 'não encontrado'}`);
  console.log(`Fontes: ${Number(audit.sources)}`);
  console.log(`Chunks: ${Number(audit.chunks)}`);
  console.log(`Embeddings: ${embeddings}`);
  console.log(`Chunks sem embedding: ${Number(audit.chunksWithoutEmbedding)}`);
  console.log(`Embeddings órfãos: ${Number(audit.orphanEmbeddings)}`);
  console.log(`Coluna antiga knowledge_chunks.embedding ausente: ${Number(audit.legacyColumnCount) === 0 ? 'sim' : 'não'}`);
  console.log(`Nenhum embedding nesta etapa: ${embeddings === 0 ? 'sim' : 'não'}`);
} catch {
  console.error('Não foi possível auditar a infraestrutura vetorial.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
