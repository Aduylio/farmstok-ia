import Fastify from 'fastify';

import { env } from './config/env.js';
import { knowledgeIngestionRoutes } from './modules/knowledge-ingestion/knowledge-ingestion.routes.js';
import { knowledgeRoutes } from './modules/knowledge/knowledge.routes.js';
import { knowledgeSearchRoutes } from './modules/knowledge/knowledge-search.routes.js';
import { knowledgeVectorSearchRoutes } from './modules/knowledge-vector-search/knowledge-vector-search.routes.js';

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

  app.register(knowledgeIngestionRoutes, {
    prefix: '/api/knowledge',
  });

  app.register(knowledgeSearchRoutes, {
    prefix: '/api/knowledge',
  });

  app.register(knowledgeVectorSearchRoutes, {
    prefix: '/api/knowledge',
  });

  return app;
}
