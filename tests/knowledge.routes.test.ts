import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../src/app.js';

describe('POST /api/knowledge/ask', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve retornar resposta sobre Curva ABC', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ask',
      payload: {
        question: 'Onde encontro a aula sobre Curva ABC?',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      answer: string;
      confidence: number;
      needsHuman: boolean;
      sources: Array<{
        title: string;
        module: string | null;
        lessonNumber: number | null;
        url: string | null;
        startTime: string | null;
      }>;
    }>();

    expect(body.answer).toContain('Curva ABC');
    expect(body.confidence).toBe(1);
    expect(body.needsHuman).toBe(false);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]?.module).toBe('Gestão de Estoque');
    expect(body.sources[0]?.lessonNumber).toBe(9);
  });

  it('deve retornar resposta sobre cobertura de estoque', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ask',
      payload: {
        question: 'Qual aula explica cobertura de estoque?',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      answer: string;
      confidence: number;
      needsHuman: boolean;
      sources: Array<{
        title: string;
        module: string | null;
        lessonNumber: number | null;
        url: string | null;
        startTime: string | null;
      }>;
    }>();

    expect(body.answer).toContain('cobertura de estoque');
    expect(body.confidence).toBe(0.9);
    expect(body.needsHuman).toBe(false);
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0]?.module).toBe('Gestão de Estoque');
  });

  it('deve retornar fallback para pergunta válida sem resposta conhecida', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ask',
      payload: {
        question: 'Como funciona o giro de estoque?',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = response.json<{
      answer: string;
      confidence: number;
      needsHuman: boolean;
      sources: Array<unknown>;
    }>();

    expect(body.needsHuman).toBe(true);
    expect(body.confidence).toBe(0);
    expect(body.sources).toHaveLength(0);
  });

  it('deve retornar erro 400 para pergunta vazia', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ask',
      payload: {
        question: '',
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json<{
      error: string;
      message: string;
      details: Record<string, string[]>;
    }>();

    expect(body.error).toBe('INVALID_REQUEST');
    expect(body.details.question).toBeDefined();
  });

  it('deve retornar erro 400 quando campo question está ausente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ask',
      payload: {},
    });

    expect(response.statusCode).toBe(400);

    const body = response.json<{
      error: string;
      message: string;
      details: Record<string, string[]>;
    }>();

    expect(body.error).toBe('INVALID_REQUEST');
    expect(body.details.question).toBeDefined();
  });

  it('deve retornar erro 400 quando question não é string', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/knowledge/ask',
      payload: {
        question: 12345,
      },
    });

    expect(response.statusCode).toBe(400);

    const body = response.json<{
      error: string;
      message: string;
      details: Record<string, string[]>;
    }>();

    expect(body.error).toBe('INVALID_REQUEST');
    expect(body.details.question).toBeDefined();
  });
});
