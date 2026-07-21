import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(3333),

  LOG_LEVEL: z
    .enum([
      'fatal',
      'error',
      'warn',
      'info',
      'debug',
      'trace',
      'silent',
    ])
    .default('info'),

  DATABASE_URL: z.string().url(),

  KNOWLEDGE_IMPORT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 1024 * 1024),

  OPENAI_API_KEY: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),

  EMBEDDING_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),

  EMBEDDING_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),

  EMBEDDING_RETRY_BASE_MS: z.coerce.number().int().min(1).max(60_000).default(1000),

  KOMMO_BASE_URL: z.preprocess((value) => value === '' ? undefined : value, z.string().optional()),
  KOMMO_ACCESS_TOKEN: z.preprocess((value) => value === '' ? undefined : value, z.string().min(1).optional()),
  KOMMO_PAUSE_TAG: z.string().trim().min(1).default('IA_PAUSADA'),
  KOMMO_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  KOMMO_WEBHOOK_SECRET: z.preprocess((value) => value === '' ? undefined : value, z.string().min(16).optional()),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Variáveis de ambiente inválidas:');
  console.error(parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;
