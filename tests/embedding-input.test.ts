import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { buildEmbeddingInput, createEmbeddingInputHash, embeddingInputVersion } from '../src/modules/knowledge-ingestion/embedding-input.js';

const data = {
  title: 'HistÃ³ria FarmStok', course: 'FarmStok', module: 'Compras', type: 'LIVE' as const,
  content: 'Linha um  \r\nLinha dois',
};

describe('polÃ­tica de embedding input v1', () => {
  it('Ã© versionada e determinÃ­stica', () => {
    expect(embeddingInputVersion).toBe('v1');
    expect(buildEmbeddingInput(data)).toBe(buildEmbeddingInput(data));
  });
  it('inclui somente o contexto semÃ¢ntico definido', () => {
    const input = buildEmbeddingInput(data);
    expect(input).toContain(`T\u00edtulo: ${data.title}`);
    expect(input).toContain('Curso: FarmStok');
    expect(input).toContain('M\u00f3dulo: Compras');
    expect(input).toContain('Tipo: LIVE');
    expect(input).toContain('Conte\u00fado:\nLinha um\nLinha dois');
    expect(input).not.toContain('sourceKey');
    expect(input).not.toContain('http');
    expect(input).not.toContain('createdAt');
  });
  it('representa mÃ³dulo ausente como vazio e preserva acentos', () => {
    expect(buildEmbeddingInput({ ...data, module: null })).toContain('M\u00f3dulo:\n');
    expect(buildEmbeddingInput(data)).toContain(data.title);
  });
  it('calcula SHA-256 hexadecimal do texto exato', () => {
    const input = buildEmbeddingInput(data);
    expect(createEmbeddingInputHash(input)).toBe(createHash('sha256').update(input).digest('hex'));
    expect(createEmbeddingInputHash(input)).toHaveLength(64);
  });
});
