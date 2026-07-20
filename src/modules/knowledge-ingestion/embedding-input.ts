import { createHash } from 'node:crypto';

import type { KnowledgeSourceType } from '../knowledge/knowledge-search.schemas.js';

export const embeddingInputVersion = 'v1';

export interface EmbeddingInputData {
  title: string;
  course: string;
  module: string | null;
  type: KnowledgeSourceType;
  content: string;
}

function normalizeLines(value: string): string {
  return value
    .replace(/\r\n?/gu, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

export function buildEmbeddingInput(data: EmbeddingInputData): string {
  return normalizeLines(
    `Título: ${data.title}\nCurso: ${data.course}\nMódulo: ${data.module ?? ''}\nTipo: ${data.type}\nConteúdo:\n${data.content}`,
  );
}

export function createEmbeddingInputHash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
