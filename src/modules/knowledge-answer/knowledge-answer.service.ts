import { AnswerProviderError } from '../ai/answer.errors.js';
import type { AnswerProvider } from '../ai/answer-provider.js';
import { knowledgeAnswerSystemPrompt } from '../ai/prompts.js';
import type { KnowledgeHybridSearchService } from '../knowledge-hybrid-search/knowledge-hybrid-search.service.js';
import type { HybridMode, HybridSearchResult } from '../knowledge-hybrid-search/knowledge-hybrid-search.types.js';
import { buildKnowledgeAnswerContext } from './knowledge-context-builder.js';
import type { KnowledgeAnswerRequest } from './knowledge-answer.schemas.js';
import type { KnowledgeAnswerResponse, KnowledgeAnswerSource } from './knowledge-answer.types.js';

export const KNOWLEDGE_ANSWER_CONFIDENCE_THRESHOLD = 0.55;
export const TEXT_ONLY_CONFIDENCE_CAP = 0.75;
export class InvalidProviderResponseError extends Error {}
export interface AnswerProviderFactory { (): AnswerProvider }

export function calculateFinalConfidence(providerConfidence: number, used: HybridSearchResult[], mode: HybridMode): number {
  if (used.length === 0) return 0;
  const support = Math.max(...used.map((item) => mode === 'TEXT_ONLY' ? item.textScore : item.hybridScore));
  const sourceCount = new Set(used.map((item) => item.source.sourceKey)).size;
  const sourceFactor = Math.min(1, 0.8 + Math.min(sourceCount, 2) * 0.1);
  const cap = mode === 'TEXT_ONLY' ? TEXT_ONLY_CONFIDENCE_CAP : 1;
  return Math.max(0, Math.min(providerConfidence, support * sourceFactor, cap));
}

function sourceFrom(item: HybridSearchResult): KnowledgeAnswerSource { return { chunkId: item.chunkId, sourceKey: item.source.sourceKey, title: item.source.title, module: item.source.module, url: item.source.sourceUrl, startTime: item.startTime, timestampUrl: item.source.timestampUrl }; }

export class KnowledgeAnswerService {
  constructor(private readonly searchService: Pick<KnowledgeHybridSearchService, 'search'>, private readonly providerFactory: AnswerProviderFactory, private readonly maxContextCharacters: number) {}
  async ask(input: KnowledgeAnswerRequest): Promise<KnowledgeAnswerResponse> {
    const search = await this.searchService.search({ q: input.question, limit: 5, minSimilarity: 0, textWeight: 0.4, vectorWeight: 0.6, ...(input.sourceKey === undefined ? {} : { sourceKey: input.sourceKey }), ...(input.course === undefined ? {} : { course: input.course }), ...(input.type === undefined ? {} : { type: input.type }) });
    if (search.results.length === 0) return { answer: 'Nao encontrei uma orientacao suficientemente clara nos materiais disponiveis.', confidence: 0, needsHuman: true, searchMode: search.mode, sources: [] };
    const context = buildKnowledgeAnswerContext(input.question, search.results, this.maxContextCharacters);
    if (context.chunks.length === 0) return { answer: 'Nao encontrei uma orientacao suficientemente clara nos materiais disponiveis.', confidence: 0, needsHuman: true, searchMode: search.mode, sources: [] };
    const generated = await this.providerFactory().generateAnswer({ systemPrompt: knowledgeAnswerSystemPrompt, question: input.question, context: context.context });
    const allowed = new Map(context.chunks.map((item) => [item.chunkId, item]));
    if (generated.usedChunkIds.some((id) => !allowed.has(id))) throw new InvalidProviderResponseError();
    const usedIds = new Set(generated.usedChunkIds);
    const used = context.chunks.filter((item) => usedIds.has(item.chunkId));
    const confidence = calculateFinalConfidence(generated.confidence, used, search.mode);
    const sourcesByKey = new Map<string, KnowledgeAnswerSource>();
    for (const item of used) if (!sourcesByKey.has(item.source.sourceKey)) sourcesByKey.set(item.source.sourceKey, sourceFrom(item));
    return { answer: generated.answer, confidence, needsHuman: generated.needsHuman || confidence < KNOWLEDGE_ANSWER_CONFIDENCE_THRESHOLD, searchMode: search.mode, sources: [...sourcesByKey.values()] };
  }
}
