import type { HybridSearchResult } from '../knowledge-hybrid-search/knowledge-hybrid-search.types.js';
import type { KnowledgeAnswerContextResult } from './knowledge-answer.types.js';

export const knowledgeAnswerContextVersion = 'v1';
export const KNOWLEDGE_ANSWER_MAX_CHUNKS = 5;

function block(item: HybridSearchResult, position: number): string {
  return `[FONTE ${position}]\nchunkId: ${item.chunkId}\nsourceKey: ${item.source.sourceKey}\ntitulo: ${item.source.title}\ncurso: ${item.source.course}\nmodulo: ${item.source.module ?? ''}\ntipo: ${item.source.type}\nhorario: ${item.startTime ?? ''}\nsourceUrl: ${item.source.sourceUrl ?? ''}\nconteudo:\n${item.content.trim()}`;
}

export function buildKnowledgeAnswerContext(question: string, results: HybridSearchResult[], maxCharacters: number): KnowledgeAnswerContextResult;
export function buildKnowledgeAnswerContext(results: HybridSearchResult[], maxCharacters: number): KnowledgeAnswerContextResult;
export function buildKnowledgeAnswerContext(questionOrResults: string | HybridSearchResult[], resultsOrMax: HybridSearchResult[] | number, maybeMax?: number): KnowledgeAnswerContextResult {
  const question = typeof questionOrResults === 'string' ? questionOrResults : '';
  const results = typeof questionOrResults === 'string' ? resultsOrMax as HybridSearchResult[] : questionOrResults;
  const maxCharacters = typeof resultsOrMax === 'number' ? resultsOrMax : maybeMax ?? 0;
  const unique = [...new Map(results.map((item) => [item.chunkId, item])).values()];
  const selected: HybridSearchResult[] = []; const blocks: string[] = [];
  for (const item of unique.slice(0, KNOWLEDGE_ANSWER_MAX_CHUNKS)) {
    const next = block(item, selected.length + 1); const combined = [...blocks, next].join('\n\n---\n\n');
    if (combined.length > maxCharacters) continue;
    selected.push(item); blocks.push(next);
  }
  const sources = blocks.join('\n\n---\n\n');
  const context = sources.length === 0 ? '' : `PERGUNTA DO ALUNO:\n${question.trim()}\n\nFONTES RECUPERADAS:\n${sources}`;
  if (context.length > maxCharacters) return { context: '', chunks: [], omittedChunks: unique.length };
  return { context, chunks: selected, omittedChunks: unique.length - selected.length };
}
