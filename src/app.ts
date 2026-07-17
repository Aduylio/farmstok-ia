import Fastify from 'fastify';

import { env } from './config/env.js';
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes.js';

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'farmstok-ai',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  });

  app.register(knowledgeRoutes, {
    prefix: '/api/knowledge',
  });

  return app;
}