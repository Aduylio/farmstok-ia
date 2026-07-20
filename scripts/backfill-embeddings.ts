import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { env } from '../src/config/env.js';
import { prisma } from '../src/config/prisma.js';
import { parseEmbeddingCliArgs } from '../src/modules/knowledge-ingestion/embedding-backfill.cli.js';
import { PrismaEmbeddingBackfillRepository } from '../src/modules/knowledge-ingestion/embedding-backfill.repository.js';
import { EmbeddingBackfillService } from '../src/modules/knowledge-ingestion/embedding-backfill.service.js';
import { OpenAIEmbeddingProvider } from '../src/modules/knowledge-ingestion/openai-embedding.provider.js';

async function confirmExecution(yes: boolean): Promise<void> {
  if (yes) return;
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new Error('Em ambiente nÃ£o interativo, --execute exige --yes.');
  }
  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question('Esta operaÃ§Ã£o pode gerar custos. Digite GERAR para confirmar: ');
    if (answer !== 'GERAR') throw new Error('ExecuÃ§Ã£o cancelada.');
  } finally {
    prompt.close();
  }
}

try {
  const options = parseEmbeddingCliArgs(process.argv.slice(2));
  if (options.execute) await confirmExecution(options.yes);
  const apiKey = env.OPENAI_API_KEY;
  if (options.execute && apiKey === undefined) {
    throw new Error('OPENAI_API_KEY Ã© obrigatÃ³ria para --execute.');
  }

  const repository = new PrismaEmbeddingBackfillRepository();
  const provider = options.execute
    ? OpenAIEmbeddingProvider.fromApiKey(apiKey as string, {
        maxRetries: env.EMBEDDING_MAX_RETRIES,
        retryBaseMs: env.EMBEDDING_RETRY_BASE_MS,
      })
    : undefined;
  const service = new EmbeddingBackfillService(repository, provider);
  const summary = await service.run({
    dryRun: !options.execute,
    batchSize: options.batchSize ?? env.EMBEDDING_BATCH_SIZE,
    ...(options.sourceKey === undefined ? {} : { sourceKey: options.sourceKey }),
    ...(options.limit === undefined ? {} : { limit: options.limit }),
    force: options.force,
    onBatch(progress) {
      console.log(`Lote ${progress.batch}/${progress.batches} concluÃ­do`);
      console.log(`Processados: ${progress.processed}`);
      console.log(`Criados: ${progress.created}`);
      console.log(`Atualizados: ${progress.updated}`);
      console.log(`Tokens do lote: ${progress.inputTokens}`);
    },
  });

  if (summary.dryRun) {
    console.log('Modo: simulaÃ§Ã£o');
    console.log(`Chunks candidatos: ${summary.candidates}`);
    console.log(`Criar: ${summary.created}`);
    console.log(`Atualizar: ${summary.updated}`);
    console.log(`Ignorar: ${summary.skipped}`);
    console.log('Chamadas externas: nÃ£o');
    console.log('Escritas no banco: nÃ£o');
    console.log(`Caracteres estimados: ${summary.characters}`);
    console.log(`Tokens aproximados: ${summary.approximateTokens} (estimativa; nÃ£o representa faturamento real)`);
  } else {
    console.log('\nResumo:');
    console.log(`Processados: ${summary.processed}`);
    console.log(`Criados: ${summary.created}`);
    console.log(`Atualizados: ${summary.updated}`);
    console.log(`Falhas: ${summary.failed}`);
    console.log(`Tokens informados pelo provedor: ${summary.inputTokens}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha segura no backfill de embeddings.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
