import { describe, expect, it } from 'vitest';

import {
  prepareKnowledgeChunks,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.service.js';
import {
  chunkTranscript,
  normalizeTranscriptTimestamp,
  parseTranscriptSegments,
} from '../src/modules/knowledge-ingestion/transcript-timestamps.js';
import {
  chunkText,
  createContentHash,
} from '../src/modules/knowledge-ingestion/knowledge-ingestion.utils.js';

describe('timestamps de transcricoes', () => {
  it.each([
    ['0:14', '00:00:14'],
    ['12:48', '00:12:48'],
    ['1:02:35', '01:02:35'],
    ['01:02:35', '01:02:35'],
  ])('reconhece e normaliza %s', (input, expected) => {
    expect(normalizeTranscriptTimestamp(input)).toBe(expected);
  });

  it('rejeita minutos e segundos invalidos', () => {
    expect(normalizeTranscriptTimestamp('60:00')).toBeNull();
    expect(normalizeTranscriptTimestamp('12:60')).toBeNull();
    expect(normalizeTranscriptTimestamp('1:60:00')).toBeNull();
    expect(normalizeTranscriptTimestamp('1:00:60')).toBeNull();
  });

  it('nao interpreta timestamp no meio de frase', () => {
    expect(
      normalizeTranscriptTimestamp('O conteúdo começa em 0:14 nesta aula.'),
    ).toBeNull();
  });

  it('associa timestamp ao texto seguinte e usa o proximo como fim', () => {
    const segments = parseTranscriptSegments(
      '0:14\n\nPrimeiro trecho.\n\n0:30\nSegundo trecho.',
    );

    expect(segments).toEqual([
      {
        startTime: '00:00:14',
        endTime: '00:00:30',
        content: 'Primeiro trecho.',
      },
      {
        startTime: '00:00:30',
        endTime: null,
        content: 'Segundo trecho.',
      },
    ]);
  });

  it('preserva conteudo anterior ao primeiro timestamp', () => {
    const segments = parseTranscriptSegments(
      'Apresentação inicial.\n\n0:14\nTrecho temporal.',
    );

    expect(segments[0]).toEqual({
      startTime: null,
      endTime: '00:00:14',
      content: 'Apresentação inicial.',
    });
  });

  it('mantem o chunker anterior quando nao ha timestamps', () => {
    const content = `${'A'.repeat(700)}\n\n${'B'.repeat(700)}`;
    const temporalChunks = chunkTranscript(content);

    expect(temporalChunks.map((chunk) => chunk.content)).toEqual(
      chunkText(content),
    );
    expect(
      temporalChunks.every(
        (chunk) => chunk.startTime === null && chunk.endTime === null,
      ),
    ).toBe(true);
  });

  it('combina segmentos pequenos preservando limites temporais', () => {
    const largeFinalSegment = Array.from(
      { length: 180 },
      (_, index) => `palavra-${index}`,
    ).join(' ');
    const chunks = chunkTranscript(
      `0:00\nPrimeiro.\n0:10\nSegundo.\n0:20\n${largeFinalSegment}`,
    );

    expect(chunks[0]).toEqual({
      startTime: '00:00:00',
      endTime: '00:00:20',
      content: 'Primeiro.\n\nSegundo.',
    });
    expect(chunks[1]?.startTime).toBe('00:00:20');
    expect(chunks.at(-1)?.endTime).toBeNull();
  });

  it('remove timestamps do conteudo e nao os inclui no hash', () => {
    const [chunk] = prepareKnowledgeChunks('0:14\nTexto do trecho.');

    expect(chunk?.content).toBe('Texto do trecho.');
    expect(chunk?.content).not.toContain('0:14');
    expect(chunk?.contentHash).toBe(createContentHash('Texto do trecho.'));
  });
});
