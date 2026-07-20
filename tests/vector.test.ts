import { describe, expect, it } from 'vitest';

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
  EMBEDDING_PROVIDER,
} from '../src/config/embedding.js';
import {
  InvalidEmbeddingVectorError,
  serializeEmbeddingVector,
  validateEmbeddingVector,
} from '../src/lib/vector.js';

function validVector(): number[] {
  return Array.from(
    { length: EMBEDDING_DIMENSIONS },
    (_, index) => index / EMBEDDING_DIMENSIONS,
  );
}

describe('infraestrutura vetorial', () => {
  it('mantém a configuração confirmada', () => {
    expect(EMBEDDING_PROVIDER).toBe('openai');
    expect(EMBEDDING_MODEL).toBe('text-embedding-3-small');
    expect(EMBEDDING_DIMENSIONS).toBe(1536);
  });

  it('aceita exatamente 1536 números finitos', () => {
    expect(validateEmbeddingVector(validVector())).toHaveLength(1536);
  });

  it.each([1535, 1537])('rejeita vetor com %i posições', (length) => {
    expect(() => validateEmbeddingVector(new Array<number>(length).fill(0))).toThrow(
      InvalidEmbeddingVectorError,
    );
  });

  it.each([NaN, Infinity, -Infinity, 'inválido'])('rejeita valor %s', (invalid) => {
    const vector: unknown[] = validVector();
    vector[10] = invalid;
    expect(() => validateEmbeddingVector(vector)).toThrow(
      InvalidEmbeddingVectorError,
    );
  });

  it('rejeita valor que não é array', () => {
    expect(() => validateEmbeddingVector('vetor')).toThrow(
      InvalidEmbeddingVectorError,
    );
  });

  it('serializa deterministicamente no formato pgvector', () => {
    const vector = validVector();
    const first = serializeEmbeddingVector(vector);
    const second = serializeEmbeddingVector(vector);

    expect(first).toBe(second);
    expect(first.startsWith('[0,')).toBe(true);
    expect(first.endsWith(']')).toBe(true);
    expect(first.split(',')).toHaveLength(1536);
  });
});
