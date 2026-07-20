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
- Especificação 005 de ingestão inicial de conhecimento criada e implementada.
- Endpoint `POST /api/knowledge/sources` adicionado com validação Zod e transação Prisma.
- Chunking determinístico, hashes SHA-256, estimativa aproximada de tokens e deduplicação adicionados.
- Tratamento seguro de payload inválido, conflitos e falhas internas adicionado.
- Testes de ingestão, utilitários, conflito e rollback adicionados sem PostgreSQL real.
- Especificação 006 e importador local de conhecimento por TXT e Markdown adicionados.
- Comando `npm run knowledge:import` adicionado com resumo determinístico e encerramento correto do Prisma Client.
- Pastas inbox, processed e failed adicionadas com movimentação segura e relatórios de erro sem dados sensíveis.
- Limite `KNOWLEDGE_IMPORT_MAX_BYTES` adicionado com padrão de 5 MiB.
- Testes de descoberta, ordenação, validação, limites, movimentação, colisões, continuidade e inbox vazia adicionados.
- Feature 007 de parsing de timestamps e chunking temporal criada e implementada.
- Formatos `M:SS`, `MM:SS`, `H:MM:SS` e `HH:MM:SS` normalizados para `HH:MM:SS`.
- Ingestão atualizada para persistir `startTime` e `endTime` sem alterar schema ou migration.
- Comando `knowledge:reprocess` adicionado para substituição transacional dos chunks de uma fonte existente.
- Testes de parsing, combinação temporal, hash, reprocessamento e rollback adicionados.
- Feature 008 de identidade única de fontes criada e implementada.
- Campo obrigatório e único `KnowledgeSource.sourceKey` mapeado para `source_key`.
- Migration `20260720143000_add_knowledge_source_identity` aplicada com backfill explícito das duas fontes existentes.
- Chaves `live:historia-farmstok` e `live:webinar-trier-compras-inteligentes` atribuídas sem alterar IDs ou timestamps das fontes.
- Endpoint e importador local atualizados para exigir `sourceKey` e retornar `DUPLICATE_SOURCE` com mensagem segura.
- Proteção contra duplicidade adicionada no service e na constraint única para cobrir concorrência.
- Reprocessamento por `sourceKey` adicionado como forma preferencial, preservando suporte por UUID.
- JSONs das duas fontes processadas atualizados sem reimportação ou reprocessamento automático.
