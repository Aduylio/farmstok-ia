# Estado atual do projeto

## Última atualização

Data: 17/07/2026

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
- Schema Prisma inicial definido conforme o modelo de dados de referência.
- Migration inicial versionada e preparada, ainda não aplicada a um banco.
- `DATABASE_URL` obrigatória e validada com Zod.

## Ainda não implementado

- Supabase.
- Banco PostgreSQL local provisionado e conectado.
- Aplicação da migration inicial.
- pgvector.
- Embeddings.
- API de inteligência artificial.
- WhatsApp.
- Kommo.
- Docker.

## Próxima tarefa

Configurar o PostgreSQL local, definir `DATABASE_URL` e aplicar a migration inicial em ambiente de desenvolvimento controlado.
