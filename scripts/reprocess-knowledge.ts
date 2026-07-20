import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

import { z } from 'zod';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import {
  KnowledgeReprocessingService,
  KnowledgeSourceNotFoundError,
  PrismaKnowledgeReprocessingRepository,
} from '../src/modules/knowledge-ingestion/knowledge-reprocessing.js';

const argumentsSchema = z.tuple([
  z.string().uuid(),
  z.string().min(1),
]);
const parsedArguments = argumentsSchema.safeParse(process.argv.slice(2));

try {
  if (!parsedArguments.success) {
    throw new Error(
      'Uso: npm run knowledge:reprocess -- <sourceId> <arquivo.txt|arquivo.md>',
    );
  }

  const [sourceId, fileArgument] = parsedArguments.data;
  const filePath = resolve(fileArgument);
  const extension = extname(filePath).toLowerCase();

  if (extension !== '.txt' && extension !== '.md') {
    throw new Error('O arquivo deve possuir extensão .txt ou .md.');
  }

  const fileStats = await stat(filePath);

  if (fileStats.size > env.KNOWLEDGE_IMPORT_MAX_BYTES) {
    throw new Error('O arquivo excede o limite configurado.');
  }

  const content = await readFile(filePath, 'utf8');

  if (content.trim().length === 0) {
    throw new Error('O arquivo de transcrição está vazio.');
  }

  const repository = new PrismaKnowledgeReprocessingRepository(prisma);
  const service = new KnowledgeReprocessingService(repository);
  const result = await service.reprocess(sourceId, content);

  console.log(
    `Reprocessamento concluído.\nSource ID: ${result.sourceId}\nChunks removidos: ${result.chunksRemoved}\nChunks criados: ${result.chunksCreated}`,
  );
} catch (error) {
  if (error instanceof KnowledgeSourceNotFoundError) {
    console.error('Fonte não encontrada.');
  } else if (error instanceof Error && error.message.startsWith('Uso:')) {
    console.error(error.message);
  } else {
    console.error('Não foi possível reprocessar a fonte.');
  }

  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
