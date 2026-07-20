import { createHash } from 'node:crypto';

export const TARGET_CHUNK_CHARACTERS = 1000;
export const MIN_CHUNK_CHARACTERS = 100;

function splitLongParagraph(paragraph: string): string[] {
  const words = paragraph.split(/\s+/u);
  const parts: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;

    if (current.length > 0 && candidate.length > TARGET_CHUNK_CHARACTERS) {
      parts.push(current);
      current = word;
      continue;
    }

    current = candidate;
  }

  if (current.length > 0) {
    parts.push(current);
  }

  return parts;
}

export function chunkText(content: string): string[] {
  const paragraphs = content
    .replace(/\r\n?/gu, '\n')
    .split(/\n\s*\n/gu)
    .map((paragraph) => paragraph.trim().replace(/[ \t]+/gu, ' '))
    .filter((paragraph) => paragraph.length > 0)
    .flatMap(splitLongParagraph);

  const chunks: string[] = [];
  let current = '';

  for (const paragraph of paragraphs) {
    const candidate = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`;

    if (current.length > 0 && candidate.length > TARGET_CHUNK_CHARACTERS) {
      chunks.push(current);
      current = paragraph;
      continue;
    }

    current = candidate;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  if (
    chunks.length > 1 &&
    (chunks.at(-1)?.length ?? 0) < MIN_CHUNK_CHARACTERS
  ) {
    const finalChunk = chunks.pop();
    const previousChunk = chunks.pop();

    if (finalChunk !== undefined && previousChunk !== undefined) {
      chunks.push(`${previousChunk}\n\n${finalChunk}`);
    }
  }

  return chunks;
}

export function createContentHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function estimateTokenCount(content: string): number {
  return Math.ceil(content.length / 4);
}
