import { resolve } from 'node:path';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import {
  formatKnowledgeImportSummary,
  runKnowledgeImport,
} from '../src/modules/knowledge-import/local-knowledge-import.js';
import { PrismaKnowledgeIngestionRepository } from '../src/modules/knowledge-ingestion/knowledge-ingestion.repository.js';
import { KnowledgeIngestionService } from '../src/modules/knowledge-ingestion/knowledge-ingestion.service.js';

const repository = new PrismaKnowledgeIngestionRepository(prisma);
const service = new KnowledgeIngestionService(repository);

try {
  const summary = await runKnowledgeImport({
    directories: {
      inbox: resolve('data/knowledge/inbox'),
      processed: resolve('data/knowledge/processed'),
      failed: resolve('data/knowledge/failed'),
    },
    maxBytes: env.KNOWLEDGE_IMPORT_MAX_BYTES,
    service,
  });

  console.log(formatKnowledgeImportSummary(summary));
} catch {
  console.error('Importação não concluída.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
