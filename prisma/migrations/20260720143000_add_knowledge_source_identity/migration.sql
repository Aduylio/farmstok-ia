-- Add the stable source identity as nullable while existing rows are backfilled.
ALTER TABLE "knowledge_sources" ADD COLUMN "source_key" TEXT;

-- Explicit assignments for the two sources audited before this migration.
UPDATE "knowledge_sources"
SET "source_key" = 'live:historia-farmstok'
WHERE "id" = '6d20dd98-8829-4209-801a-f361cb7fe910'::uuid
  AND "title" = 'História do Farmstok e apresentação do método';

UPDATE "knowledge_sources"
SET "source_key" = 'live:webinar-trier-compras-inteligentes'
WHERE "id" = 'db1214d6-f15f-4a45-b450-ca51788c5b5a'::uuid
  AND "title" = 'Webinar Trier: Aprenda a Comprar de Forma Inteligente! Com Sérgio Samuel';

-- Abort safely if the audited records changed or an unknown source exists.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "knowledge_sources") <> 2 THEN
    RAISE EXCEPTION 'Expected exactly two audited knowledge sources';
  END IF;

  IF EXISTS (SELECT 1 FROM "knowledge_sources" WHERE "source_key" IS NULL) THEN
    RAISE EXCEPTION 'Every knowledge source must receive an explicit source_key';
  END IF;
END $$;

ALTER TABLE "knowledge_sources"
  ALTER COLUMN "source_key" SET NOT NULL;

ALTER TABLE "knowledge_sources"
  ADD CONSTRAINT "knowledge_sources_source_key_format_check"
  CHECK (
    char_length("source_key") <= 200
    AND "source_key" ~ '^[a-z0-9][a-z0-9:_-]*$'
  );

CREATE UNIQUE INDEX "knowledge_sources_source_key_key"
  ON "knowledge_sources"("source_key");
