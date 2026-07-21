# Histórico de mudanças

## 21/07/2026 - Feature 017

### Adicionado

- Módulos internos `students` e `conversations`, telefone E.164 brasileiro e courseAccess v1.
- Autorização por Student + Conversation e preparação segura do futuro ingresso WhatsApp.
- Transições de modo transacionais, vínculos idempotentes e proteção HUMAN.
- Scripts dry-run `demo:create-student` e somente leitura `db:conversation-check`.
- Testes unitários sem PostgreSQL real, internet ou dados pessoais reais.

### Confirmado

- Nenhum endpoint público, WhatsApp, Message, AnswerLog, embedding, chamada OpenAI/Kommo ou migration.
- Algoritmos RAG e integração Kommo existentes preservados.

## 21/07/2026 - Feature 016

### Adicionado

- Suíte local de avaliação RAG com 25 casos, schema Zod, CLI, relatórios e comparador de baselines.
- Modos TEXT, HYBRID, VECTOR indisponível e ANSWER futuro com confirmação explícita.
- Baseline TEXT v1 e métricas separadas entre 7 casos confirmados e 18 pendentes.
- Testes unitários sem PostgreSQL real ou internet.

### Confirmado

- Avaliação somente leitura; nenhuma migration, escrita, embedding, chamada externa ou AnswerLog.
- Estado real preservado em 2 fontes, 148 chunks e 0 embeddings.

### Revisão incremental v2

- Dataset revisado manualmente, com 20 casos confirmados e 5 pendentes.
- `answerType` obrigatório: DIRECT, SYNTHESIS, METADATA, OUT_OF_SCOPE ou UNCERTAIN; notas manuais curtas opcionais.
- Pergunta ampla de gestão reformulada; METADATA ignorado sem penalização e SYNTHESIS avaliada por cobertura agregada.
- Relatório separado em métricas oficiais, exploratórias e por tipo de resposta.
- Baseline v1 preservada e `text-baseline-v2.json` adicionada; mudanças refletem política/expectativas, não melhoria de busca.
- Nenhum algoritmo de busca, schema, migration ou dado foi alterado; nenhuma chamada externa foi realizada.

## 21/07/2026 - Feature 015

### Adicionado

- Modulos `ai` e `knowledge-answer`, contexto/prompt v1 e provider OpenAI estruturado.
- Orquestrador RAG, validacao de chunkIds, fontes deduplicadas e confianca ajustada.
- Novo contrato de `/api/knowledge/ask` e CLI dry-run `knowledge:ask`.

### Confirmado

- Nenhuma chamada OpenAI/Kommo, resposta paga, escrita, AnswerLog ou migration.

## 21/07/2026 - Feature 014

### Adicionado

- Modulo, endpoint e CLI de busca hibrida.
- Ranking por scores normalizados, pesos configuraveis e bonus de dupla correspondencia.
- Fallback `TEXT_ONLY` quando nao ha embeddings, sem dependencia da OpenAI.
- Testes unitarios de formula, modos, filtros, ordenacao, rota e CLI.

### Confirmado

- Buscas individuais preservadas; nenhuma chamada externa, escrita ou migration.

## 21/07/2026 - Feature 013

### Adicionado

- Modulo Kommo, cliente HTTP preparado, parser form-urlencoded, service e repository transacional.
- Webhook `POST /webhooks/kommo`, segredo de rota e limite de payload/leads.
- Regra `IA_PAUSADA`, protecao do modo HUMAN, idempotencia e `canAiRespond` local.
- CLI de sincronizacao manual e testes sem internet ou banco real.

### Confirmado

- Nenhuma credencial, chamada Kommo/OpenAI, migration ou alteracao operacional no banco.

## 21/07/2026 - Feature 012

### Adicionado

- Modulo, endpoint e CLI de busca vetorial exata por cosseno.
- Input de pergunta v1 separado da politica de chunks.
- SQL pgvector parametrizado com filtros, threshold, limite e ordem deterministica.
- Tratamento `NO_EMBEDDINGS_AVAILABLE` sem chave ou chamada externa.
- Testes unitarios de service, repository, schemas, rota, utilitarios e CLI.

### Confirmado

- Busca textual preservada; zero embeddings, zero chamadas externas, zero escritas e nenhuma migration nova.

## 20/07/2026 - Feature 011

### Adicionado

- SDK oficial `openai` 6.48.0 e abstracao `EmbeddingProvider`.
- Politica de input v1, SHA-256 e selecao idempotente por provider/modelo/dimensoes/hash.
- CLI `knowledge:embed` com dry-run padrao, confirmacao paga, filtros, limite e lotes.
- Retry exponencial seletivo, persistencia transacional por lote, auditoria ampliada e testes sem rede ou banco real.
- Documentacao da independencia entre OpenAI para embeddings e eventual DeepSeek para respostas futuras.

### Confirmado

- Nenhuma chamada externa ou geracao real foi executada; permanecem 0 embeddings.
- Schema e migrations nao foram modificados.

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
- Feature 009 de busca textual diagnóstica criada e implementada.
- Endpoint `GET /api/knowledge/search` adicionado com validação Zod, filtros e erros seguros.
- Ranking determinístico adicionado com pesos para título, módulo, conteúdo, frase exata e cobertura de termos.
- Teto de 500 candidatos ativos e limite de resposta entre 1 e 20 documentados.
- Geração de links temporais para `youtube.com` e `youtu.be` adicionada.
- Comando `npm run knowledge:search` adicionado reutilizando o service da API.
- Testes unitários de normalização, ranking, filtros, ordenação, URLs, repository, service e rota adicionados.
- Seis consultas reais executadas somente para leitura, sem alterar schema, migrations ou dados.
- Feature 010 de infraestrutura pgvector criada e implementada.
- pgvector 0.8.5 habilitado no PostgreSQL local pela migration `20260720153000_add_pgvector_infrastructure`.
- Coluna legada `knowledge_chunks.embedding TEXT` removida com guarda contra valores não nulos.
- Tabela 1:1 `knowledge_chunk_embeddings` criada com `vector(1536)` e `ON DELETE CASCADE`.
- Configuração futura OpenAI `text-embedding-3-small` com 1536 dimensões centralizada sem API key ou SDK.
- Validação, serialização vetorial e repository SQL parametrizado adicionados sem execução automática.
- Script somente leitura `npm run db:vector-check` adicionado.
- Nenhum embedding, índice aproximado, busca vetorial ou chamada externa foi criado.
