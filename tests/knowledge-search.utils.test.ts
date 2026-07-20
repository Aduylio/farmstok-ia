import { describe, expect, it } from 'vitest';

import {
  buildTimestampUrl,
  calculateTextSearchScore,
  normalizeSearchText,
  timestampToSeconds,
  tokenizeSearchQuery,
} from '../src/modules/knowledge/knowledge-search.utils.js';

describe('utilitários da busca textual', () => {
  it('normaliza acentos, caixa e espaços', () => {
    expect(normalizeSearchText('  Genéricos   SIMILARES ')).toBe(
      'genericos similares',
    );
  });

  it('tokeniza e remove termos vazios e pontuação', () => {
    expect(tokenizeSearchQuery('  estoque, mínimo / Trier  ')).toEqual([
      'estoque',
      'minimo',
      'trier',
    ]);
  });

  it('pontua presença de todos os termos', () => {
    const complete = calculateTextSearchScore({
      query: 'estoque mínimo',
      terms: ['estoque', 'minimo'],
      title: '',
      module: null,
      content: 'estoque e mínimo',
    });
    const partial = calculateTextSearchScore({
      query: 'estoque mínimo',
      terms: ['estoque', 'minimo'],
      title: '',
      module: null,
      content: 'estoque',
    });

    expect(complete).toBeGreaterThan(partial);
  });

  it('atribui bônus à frase exata', () => {
    const exact = calculateTextSearchScore({
      query: 'quando comprar',
      terms: ['quando', 'comprar'],
      title: '',
      module: null,
      content: 'Saiba quando comprar melhor.',
    });
    const separated = calculateTextSearchScore({
      query: 'quando comprar',
      terms: ['quando', 'comprar'],
      title: '',
      module: null,
      content: 'Quando o estoque baixar, decida o que comprar.',
    });

    expect(exact).toBeGreaterThan(separated);
  });

  it('usa peso de título maior que módulo e conteúdo', () => {
    const input = { query: 'trier', terms: ['trier'], content: '' };
    const titleScore = calculateTextSearchScore({
      ...input,
      title: 'Trier',
      module: null,
    });
    const moduleScore = calculateTextSearchScore({
      ...input,
      title: '',
      module: 'Trier',
    });
    const contentScore = calculateTextSearchScore({
      ...input,
      title: '',
      module: null,
      content: 'Trier',
    });

    expect(titleScore).toBeGreaterThan(moduleScore);
    expect(moduleScore).toBeGreaterThan(contentScore);
  });

  it('converte timestamp HH:MM:SS para segundos', () => {
    expect(timestampToSeconds('00:32:18')).toBe(1938);
    expect(timestampToSeconds('00:99:00')).toBeNull();
  });

  it('cria link temporal para youtube.com preservando parâmetros', () => {
    expect(
      buildTimestampUrl(
        'https://www.youtube.com/watch?v=abc&list=xyz',
        '00:32:18',
      ),
    ).toBe('https://www.youtube.com/watch?v=abc&list=xyz&t=1938s');
  });

  it('cria link temporal para youtu.be', () => {
    expect(buildTimestampUrl('https://youtu.be/abc', '00:01:02')).toBe(
      'https://youtu.be/abc?t=62s',
    );
  });

  it('substitui parâmetro t existente', () => {
    expect(
      buildTimestampUrl('https://youtube.com/watch?v=abc&t=5s', '00:00:10'),
    ).toBe('https://youtube.com/watch?v=abc&t=10s');
  });

  it('não cria link para URL externa ou chunk sem início', () => {
    expect(buildTimestampUrl('https://example.com/video', '00:00:10')).toBeNull();
    expect(buildTimestampUrl('https://youtu.be/abc', null)).toBeNull();
  });
});
