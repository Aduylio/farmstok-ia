import { describe, expect, it } from 'vitest';

import { knowledgeSourceMetadataSchema } from '../src/modules/knowledge-ingestion/knowledge-ingestion.schemas.js';

const validMetadata = {
  sourceKey: 'aula:gestao-estoques:curva-abc',
  type: 'AULA',
  title: 'Curva ABC',
  course: 'Farmstok',
};

describe('identidade da fonte de conhecimento', () => {
  it('aceita sourceKey valida', () => {
    expect(knowledgeSourceMetadataSchema.safeParse(validMetadata).success).toBe(true);
  });

  it.each([
    ['maiúsculas', 'LIVE:TRIER'],
    ['espaços', 'live:compras inteligentes'],
    ['barras', 'live/compras'],
    ['separador inicial', ':live-compras'],
  ])('rejeita %s', (_, sourceKey) => {
    expect(
      knowledgeSourceMetadataSchema.safeParse({ ...validMetadata, sourceKey }).success,
    ).toBe(false);
  });

  it('exige sourceKey', () => {
    const { sourceKey: _, ...withoutSourceKey } = validMetadata;
    expect(knowledgeSourceMetadataSchema.safeParse(withoutSourceKey).success).toBe(false);
  });
});
