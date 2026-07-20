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
