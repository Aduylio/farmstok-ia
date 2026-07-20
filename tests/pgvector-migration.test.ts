import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const migrationPath =
  'prisma/migrations/20260720153000_add_pgvector_infrastructure/migration.sql';

describe('migration da infraestrutura pgvector', () => {
  it('habilita vector, protege a coluna antiga e cria a relação', async () => {
    const migration = await readFile(migrationPath, 'utf8');

    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS vector');
    expect(migration).toContain('WHERE "embedding" IS NOT NULL');
    expect(migration).toContain('RAISE EXCEPTION');
    expect(migration).toContain('DROP COLUMN "embedding"');
    expect(migration).toContain('vector(1536) NOT NULL');
    expect(migration).toContain('ON DELETE CASCADE');
  });

  it('não cria índice aproximado', async () => {
    const migration = (await readFile(migrationPath, 'utf8')).toLowerCase();
    expect(migration).not.toMatch(/using\s+hnsw/u);
    expect(migration).not.toMatch(/using\s+ivfflat/u);
  });
});
