-- Enable pgvector only after the server-level preflight confirmed availability.
CREATE EXTENSION IF NOT EXISTS vector;

-- The legacy TEXT column has never stored embeddings. Abort instead of discarding data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "knowledge_chunks"
    WHERE "embedding" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Legacy knowledge_chunks.embedding contains data; migration aborted';
  END IF;
END $$;

ALTER TABLE "knowledge_chunks" DROP COLUMN "embedding";

CREATE TABLE "knowledge_chunk_embeddings" (
  "chunk_id" UUID NOT NULL,
  "embedding" vector(1536) NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "model" VARCHAR(100) NOT NULL,
  "dimensions" INTEGER NOT NULL,
  "input_hash" CHAR(64) NOT NULL,
  "input_tokens" INTEGER,
  "embedded_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "knowledge_chunk_embeddings_pkey" PRIMARY KEY ("chunk_id"),
  CONSTRAINT "knowledge_chunk_embeddings_dimensions_check"
    CHECK ("dimensions" = 1536),
  CONSTRAINT "knowledge_chunk_embeddings_input_tokens_check"
    CHECK ("input_tokens" IS NULL OR "input_tokens" >= 0),
  CONSTRAINT "knowledge_chunk_embeddings_input_hash_check"
    CHECK ("input_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "knowledge_chunk_embeddings_provider_check"
    CHECK (btrim("provider") <> ''),
  CONSTRAINT "knowledge_chunk_embeddings_model_check"
    CHECK (btrim("model") <> '')
);

ALTER TABLE "knowledge_chunk_embeddings"
  ADD CONSTRAINT "knowledge_chunk_embeddings_chunk_id_fkey"
  FOREIGN KEY ("chunk_id") REFERENCES "knowledge_chunks"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- No vector index is created: the first vector search will be exact cosine search.
