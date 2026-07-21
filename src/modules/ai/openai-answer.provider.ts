import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { AnswerGenerationInput, AnswerProvider } from './answer-provider.js';
import { AnswerProviderError } from './answer.errors.js';
import { generatedAnswerSchema, type GeneratedAnswer } from './answer.schemas.js';

export interface OpenAIAnswerClient { generate(input: AnswerGenerationInput): Promise<unknown> }
export interface OpenAIAnswerProviderOptions { maxRetries?: number; retryBaseMs?: number; sleep?: (ms: number) => Promise<void> }
function field(error: unknown, key: string): unknown { return typeof error === 'object' && error !== null && key in error ? (error as Record<string, unknown>)[key] : undefined; }
function mapError(error: unknown): AnswerProviderError { const status = field(error, 'status'); const name = field(error, 'name'); if (status === 429) return new AnswerProviderError('ANSWER_PROVIDER_RATE_LIMITED'); if (status === 408 || name === 'APIConnectionTimeoutError' || name === 'APIConnectionError') return new AnswerProviderError('ANSWER_PROVIDER_TIMEOUT'); return new AnswerProviderError('ANSWER_PROVIDER_UNAVAILABLE'); }

export class OpenAIAnswerProvider implements AnswerProvider {
  constructor(private readonly client: OpenAIAnswerClient, private readonly options: OpenAIAnswerProviderOptions = {}) {}
  static fromConfig(apiKey: string, model: string): OpenAIAnswerProvider {
    const client = new OpenAI({ apiKey, timeout: 30000, maxRetries: 0, logLevel: 'off' });
    return new OpenAIAnswerProvider({ async generate(input) {
      const response = await client.responses.parse({ model, input: [{ role: 'system', content: input.systemPrompt }, { role: 'user', content: `PERGUNTA:\n${input.question}\n\nCONTEXTO:\n${input.context}` }], text: { format: zodTextFormat(generatedAnswerSchema, 'knowledge_answer') } });
      return response.output_parsed;
    } }, { maxRetries: 1, retryBaseMs: 500 });
  }
  async generateAnswer(input: AnswerGenerationInput): Promise<GeneratedAnswer> {
    const retries = this.options.maxRetries ?? 1; const sleep = this.options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try { const parsed = generatedAnswerSchema.safeParse(await this.client.generate(input)); if (!parsed.success) throw new AnswerProviderError('INVALID_PROVIDER_RESPONSE'); return parsed.data; }
      catch (error) { const mapped = error instanceof AnswerProviderError ? error : mapError(error); const transient = mapped.code === 'ANSWER_PROVIDER_TIMEOUT' || mapped.code === 'ANSWER_PROVIDER_RATE_LIMITED' || mapped.code === 'ANSWER_PROVIDER_UNAVAILABLE'; if (!transient || attempt === retries) throw mapped; await sleep((this.options.retryBaseMs ?? 500) * 2 ** attempt); }
    }
    throw new AnswerProviderError('ANSWER_PROVIDER_UNAVAILABLE');
  }
}
