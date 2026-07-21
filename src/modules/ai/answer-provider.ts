import type { GeneratedAnswer } from './answer.schemas.js';
export interface AnswerGenerationInput { systemPrompt: string; question: string; context: string }
export interface AnswerProvider { generateAnswer(input: AnswerGenerationInput): Promise<GeneratedAnswer> }
