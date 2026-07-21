export type AnswerProviderErrorCode = 'ANSWER_PROVIDER_UNAVAILABLE' | 'ANSWER_PROVIDER_TIMEOUT' | 'ANSWER_PROVIDER_RATE_LIMITED' | 'INVALID_PROVIDER_RESPONSE';
export class AnswerProviderError extends Error { constructor(readonly code: AnswerProviderErrorCode) { super('Nao foi possivel gerar a resposta.'); this.name = 'AnswerProviderError'; } }
