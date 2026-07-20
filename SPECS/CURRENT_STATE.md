# Estado atual do projeto

## Última atualização

Data: 20/07/2026

## Funcionando

- Projeto Node.js inicializado.
- TypeScript configurado.
- Fastify configurado.
- Variáveis de ambiente validadas com Zod.
- Servidor local funcionando na porta 3333.
- Rota GET /api/health funcionando.
- Rota POST /api/knowledge/ask funcionando.
- Resposta simulada para Curva ABC.
- Resposta simulada para cobertura de estoque.
- Fallback para perguntas desconhecidas.
- Validação de pergunta vazia.
- Testes automatizados do módulo knowledge funcionando.
- Testes executados com Fastify app.inject().
- Prisma ORM 7 configurado com adapter PostgreSQL (`@prisma/adapter-pg`).
- Schema Prisma refinado conforme a especificação 004.
- PostgreSQL local conectado ao banco `farmstok_ai`.
- Migration inicial versionada e aplicada com sucesso.
- Migration `20260720114700_refine_prisma_schema` aplicada com sucesso ao banco local vazio.
- Prisma Client gerado.
- Smoke test real `npm run db:check` funcionando com `SELECT 1`.
- `DATABASE_URL` obrigatória e validada com Zod.
- UUID nativo e nomenclatura snake_case implementados no PostgreSQL.
- Feature 005 de ingestão inicial implementada.
- Rota POST `/api/knowledge/sources` cadastrando fonte e chunks em transação Prisma.
- Chunking determinístico, SHA-256, estimativa aproximada de tokens e deduplicação implementados.
- Feature 006 de importação local por TXT e Markdown implementada.
- Comando `npm run knowledge:import` reutilizando o serviço transacional da Feature 005.
- Inbox, processed e failed versionados, com limite padrão de 5 MiB por arquivo.
- 29 testes automatizados passando; testes do importador usam filesystem temporário e não acessam PostgreSQL real.

## Ainda não implementado

- Supabase.
- pgvector.
- Embeddings.
- Reprocessamento e idempotência de fontes.
- Importação de PDF, DOCX, áudio e vídeo.
- API de inteligência artificial.
- WhatsApp.
- Kommo.
- Docker.

## Próxima tarefa

Definir idempotência e reprocessamento de fontes antes de ampliar formatos de importação ou iniciar embeddings.
