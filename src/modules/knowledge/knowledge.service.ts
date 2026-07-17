import type {
  AskQuestionBody,
  KnowledgeAnswer,
} from './knowledge.schemas.js';

export class KnowledgeService {
  async ask(input: AskQuestionBody): Promise<KnowledgeAnswer> {
    const normalizedQuestion = input.question
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (normalizedQuestion.includes('curva abc')) {
      return {
        answer:
          'O conteúdo sobre Curva ABC está na Aula 9 do módulo Gestão de Estoque.',
        confidence: 1,
        needsHuman: false,
        sources: [
          {
            title: 'Aula 9 — Curva ABC',
            module: 'Gestão de Estoque',
            lessonNumber: 9,
            url: 'https://exemplo.farmstok.com.br/aula-9',
            startTime: '00:12:30',
          },
        ],
      };
    }

    if (
      normalizedQuestion.includes('cobertura de estoque') ||
      normalizedQuestion.includes('cobertura do estoque')
    ) {
      return {
        answer:
          'O conteúdo sobre cobertura de estoque está no módulo Gestão de Estoque.',
        confidence: 0.9,
        needsHuman: false,
        sources: [
          {
            title: 'Cobertura de Estoque',
            module: 'Gestão de Estoque',
            lessonNumber: null,
            url: 'https://exemplo.farmstok.com.br/cobertura-estoque',
            startTime: null,
          },
        ],
      };
    }

    return {
      answer:
        'Ainda não encontrei uma orientação suficientemente clara na base de conhecimento. Essa dúvida deverá ser encaminhada para a equipe do Farmstok.',
      confidence: 0,
      needsHuman: true,
      sources: [],
    };
  }
}