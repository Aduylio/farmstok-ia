import { EMBEDDING_DIMENSIONS } from '../../src/config/embedding.js';

export function validEmbeddingVector(value = 0.1): number[] {
  return new Array<number>(EMBEDDING_DIMENSIONS).fill(value);
}
