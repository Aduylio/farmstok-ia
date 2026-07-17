import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

async function startServer() {
  try {
    await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });

    app.log.info(`Servidor iniciado na porta ${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void startServer();