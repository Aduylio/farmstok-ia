import { z } from 'zod';

import { prisma } from '../src/config/prisma.js';
import { sourceKeySchema } from '../src/modules/knowledge-ingestion/knowledge-ingestion.schemas.js';
import { PrismaKnowledgeSearchRepository } from '../src/modules/knowledge/knowledge-search.repository.js';
import { KnowledgeSearchService } from '../src/modules/knowledge/knowledge-search.service.js';

const commandArgumentsSchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
  sourceKey: sourceKeySchema.optional(),
});

function parseArguments(argumentsList: string[]): unknown {
  const [q, ...options] = argumentsList;
  const parsed: { q: string | undefined; limit?: string; sourceKey?: string } = { q };

  for (let index = 0; index < options.length; index += 2) {
    const flag = options[index];
    const value = options[index + 1];

    if (value === undefined) return null;

    if (flag === '--limit') parsed.limit = value;
    else if (flag === '--source-key') parsed.sourceKey = value;
    else return null;
  }

  return parsed;
}

function createExcerpt(content: string): string {
  const normalized = content.replace(/\s+/gu, ' ').trim();
  return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237)}...`;
}

try {
  const parsedArguments = commandArgumentsSchema.safeParse(
    parseArguments(process.argv.slice(2)),
  );

  if (!parsedArguments.success) {
    throw new Error(
      'Uso: npm run knowledge:search -- "consulta" [--limit 10] [--source-key chave]',
    );
  }

  const repository = new PrismaKnowledgeSearchRepository(prisma);
  const service = new KnowledgeSearchService(repository);
  const response = await service.search(parsedArguments.data);

  if (response.results.length === 0) {
    console.log(`Nenhum resultado para: ${response.query}`);
  } else {
    console.log(`Resultados para: ${response.query} (${response.total} encontrados)`);

    response.results.forEach((result, index) => {
      console.log(
        `\n${index + 1}. ${result.source.title}\nFonte: ${result.source.sourceKey}\nScore: ${result.score}\nHorário: ${result.startTime ?? 'não informado'}\nLink: ${result.source.timestampUrl ?? result.source.sourceUrl ?? 'não informado'}\nTrecho: ${createExcerpt(result.content)}`,
      );
    });
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith('Uso:')) {
    console.error(error.message);
  } else {
    console.error('Não foi possível pesquisar a base de conhecimento.');
  }

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
