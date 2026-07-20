import { EMBEDDING_DIMENSIONS } from '../config/embedding.js';

export class InvalidEmbeddingVectorError extends Error {
  constructor() {
    super('O vetor de embedding é inválido.');
    this.name = 'InvalidEmbeddingVectorError';
  }
}

export function validateEmbeddingVector(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length !== EMBEDDING_DIMENSIONS ||
    !value.every((item) => typeof item === 'number' && Number.isFinite(item))
  ) {
    throw new InvalidEmbeddingVectorError();
  }

  return value as number[];
}

export function serializeEmbeddingVector(value: unknown): string {
  const vector = validateEmbeddingVector(value);
  return `[${vector.map((item) => item.toString()).join(',')}]`;
}
