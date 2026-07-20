import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

describe('configuracao inicial do Prisma', () => {
  it('mantem o embedding opcional como String e nao habilita pgvector', async () => {
    const schema = await readFile('prisma/schema.prisma', 'utf8');
    const migration = await readFile(
      'prisma/migrations/20260717190240_init/migration.sql',
      'utf8',
    );

    expect(schema).toMatch(/embedding\s+String\?/);
    expect(schema).not.toContain('Unsupported("vector")');
    expect(migration).toContain('"embedding" TEXT');
    expect(migration).not.toContain('CREATE EXTENSION');
  });

  it('usa a DATABASE_URL validada ao configurar o adapter PostgreSQL', async () => {
    const prismaConfig = await readFile('src/config/prisma.ts', 'utf8');

    expect(prismaConfig).toContain("import { env } from './env.js'");
    expect(prismaConfig).toContain('connectionString: env.DATABASE_URL');
    expect(prismaConfig).not.toContain('process.env.DATABASE_URL!');
  });
});
