import type { FastifyInstance } from 'fastify';

import { askQuestionBodySchema } from './knowledge.schemas.js';
import { KnowledgeService } from './knowledge.service.js';

const knowledgeService = new KnowledgeService();

export async function knowledgeRoutes(app: FastifyInstance) {
  app.post('/ask', async (request, reply) => {
    const parsedBody = askQuestionBodySchema.safeParse(request.body);

    if (!parsedBody.success) {
      return reply.status(400).send({
        error: 'INVALID_REQUEST',
        message: 'Os dados enviados são inválidos.',
        details: parsedBody.error.flatten().fieldErrors,
      });
    }

    const result = await knowledgeService.ask(parsedBody.data);

    return reply.status(200).send(result);
  });
}