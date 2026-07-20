# Histórico de mudanças

## 17/07/2026

### Adicionado

- Estrutura inicial do backend.
- Configuração TypeScript.
- Configuração Fastify.
- Validação de variáveis de ambiente.
- Rota de health check.
- Módulo knowledge simulado.
- Rota POST /api/knowledge/ask.
- Pasta de especificações do projeto.
- Testes automatizados para a rota POST /api/knowledge/ask.
- Validação dos cenários de sucesso, fallback e entrada inválida.
- Especificação da feature 002 (Supabase setup) criada em `SPECS/features/002-supabase-setup.md`.
- Revisão da especificação 002: dimensão do embedding registrada como dependente do modelo; índice vetorial IVFFlat adiado para após ingestão de dados reais.
- Integração inicial do Prisma ORM 7 com PostgreSQL e adapter `pg`.
- Schema Prisma inicial e migration versionada preparados sem aplicação em banco real.
- `DATABASE_URL` adicionada como variável obrigatória e centralizada em `src/config/env.ts`.
- Testes sem conexão real adicionados para validar a configuração Prisma, `embedding String?` e ausência de pgvector.

## 20/07/2026

### Adicionado

- Especificação 004 de refinamento do schema Prisma criada em `SPECS/features/004-prisma-schema-refinement.md`.
- Refinamento da especificação 004 implementado no schema Prisma.
- Migration `20260720114700_refine_prisma_schema` criada e aplicada ao PostgreSQL local vazio.
- Nove modelos migrados para UUID nativo e tabelas/colunas snake_case.
- Campos, enums, índices, constraints e políticas de exclusão do modelo de atendimento e conhecimento refinados.
- Smoke test real de conexão adicionado por meio de `npm run db:check`.
