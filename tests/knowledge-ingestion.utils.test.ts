import { describe, expect, it } from 'vitest';

import {
  chunkText,
  createContentHash,
  estimateTokenCount,
  TARGET_CHUNK_CHARACTERS,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.utils.js';

describe('utilitarios de ingestao de conhecimento', () => {
  it('divide texto de forma deterministica sem cortar palavras', () => {
    const paragraph = Array.from(
      { length: 90 },
      (_, index) => `palavra-${index}`,
    ).join(' ');
    const content = `${paragraph}\n\n${paragraph}\n\nParágrafo final.`;

    const firstResult = chunkText(content);
    const secondResult = chunkText(content);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.length).toBeGreaterThan(1);
    expect(firstResult.every((chunk) => chunk.length > 0)).toBe(true);
    expect(firstResult.slice(0, -1).every((chunk) => chunk.length <= TARGET_CHUNK_CHARACTERS)).toBe(
      true,
    );
    expect(firstResult.join('\n\n')).toContain('palavra-89');
    expect(firstResult.join('\n\n')).toContain('Parágrafo final.');
  });

  it('gera hash SHA-256 deterministico', () => {
    const firstHash = createContentHash('Curva ABC');
    const secondHash = createContentHash('Curva ABC');

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(firstHash).not.toBe(createContentHash('Cobertura de estoque'));
  });

  it('estima tokens sem depender de modelo de IA', () => {
    expect(estimateTokenCount('12345678')).toBe(2);
    expect(estimateTokenCount('')).toBe(0);
  });
});
