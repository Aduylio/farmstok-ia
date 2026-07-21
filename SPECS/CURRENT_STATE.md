# Estado atual do projeto

## Feature 015

- Mock de `/api/knowledge/ask` substituido por orquestrador RAG estruturado.
- CLI `knowledge:ask` funciona em dry-run sem OpenAI.
- Recuperacao atual permanece TEXT_ONLY por zero embeddings.
- Nenhuma resposta real, chamada externa, escrita, schema ou migration nesta feature.

## Feature 014

- Busca hibrida implementada com ranking explicavel e fallback textual.
- Estado real permanece com 2 fontes, 148 chunks e zero embeddings.
- `knowledge:hybrid-search` opera em `TEXT_ONLY` sem OpenAI.
- Nenhuma chamada externa, escrita, schema ou migration nesta feature.

## Feature 013

- Integracao Kommo preparada, mas sem credenciais ou chamadas reais.
- Webhook form-urlencoded, consulta de lead, regra `IA_PAUSADA`, idempotencia, protecao de HUMAN e transacao implementados.
- PostgreSQL e a fonte operacional e `canAiRespond` nao consulta o Kommo.
- Nenhum Student, Conversation ou ConversationEvent foi alterado nesta implementacao.

## Feature 012

- Busca vetorial exata por cosseno implementada em rota e CLI separados da busca textual.
- Estado real permanece em 2 fontes, 148 chunks ativos, 0 embeddings e 148 chunks sem embedding.
- Com zero embeddings, a busca retorna `NO_EMBEDDINGS_AVAILABLE` sem criar/chamar provider.
- Nenhum backfill, embedding, escrita, schema ou migration foi executado nesta feature.

## Feature 011

- Cliente oficial OpenAI, provider abstrato, input v1, retry seletivo e backfill idempotente implementados.
- `npm run knowledge:embed` e dry-run por padrao e a execucao paga exige confirmacao adicional.
- Nenhuma chamada externa foi realizada; o banco permanece com 2 fontes, 148 chunks e 0 embeddings.
- Schema, migrations, endpoints, busca textual, importador e reprocessamento permanecem inalterados.
- Proximo passo manual: configurar chave valida e autorizar o teste controlado de 3 chunks descrito em `SPECS/features/011-embedding-backfill.md`.

## Última atualização

Data: 21/07/2026

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
- Feature 007 de parsing temporal implementada.
- Ingestão preenchendo `startTime` e `endTime` normalizados quando há timestamps isolados.
- Comando `npm run knowledge:reprocess` substituindo chunks de uma fonte existente em transação.
- 43 testes automatizados passando sem PostgreSQL real nos novos testes.
- Auditoria somente leitura confirmou 2 fontes e 151 chunks antes do reprocessamento manual.
- As duas fontes reais foram reprocessadas com timestamps; auditoria atual confirmou 2 fontes e 148 chunks.
- Feature 008 de identidade única implementada com `sourceKey` obrigatória, explícita e única.
- Migration `20260720143000_add_knowledge_source_identity` aplicada sem perda de fontes, chunks ou timestamps.
- Endpoint e importador local rejeitam fontes duplicadas com `DUPLICATE_SOURCE`.
- Reprocessamento preferencial por `sourceKey`, mantendo compatibilidade por `sourceId`.
- Feature 009 de busca textual diagnóstica implementada.
- Rota GET `/api/knowledge/search` pesquisando até 500 chunks de fontes ativas com filtros e ranking determinístico.
- Comando `npm run knowledge:search` reutilizando o mesmo service da API.
- Links temporais do YouTube gerados a partir de `startTime`.
- 72 testes automatizados passando sem PostgreSQL real nas suítes de busca.
- Seis consultas diagnósticas executadas no PostgreSQL real somente para leitura.
- Feature 010 de infraestrutura pgvector implementada.
- Extensão pgvector 0.8.5 instalada no banco PostgreSQL 18.4.
- Tabela `knowledge_chunk_embeddings` criada com `vector(1536)`, vazia e sem índice aproximado.
- Modelo futuro confirmado como OpenAI `text-embedding-3-small`, com 1536 dimensões e cosseno exato.
- Coluna legada `knowledge_chunks.embedding TEXT` removida após validação de nulidade.
- Repository SQL parametrizado e utilitários vetoriais preparados sem geração ou chamada externa.
- Auditoria `npm run db:vector-check` confirmando 0 embeddings e 148 chunks sem embedding.

## Ainda não implementado

- Supabase.
- Embeddings.
- Importação de PDF, DOCX, áudio e vídeo.
- API de inteligência artificial.
- WhatsApp.
- Kommo.
- Docker.

## Próxima tarefa

Revisar manualmente os 18 casos pendentes da Feature 016 e, após backfill autorizado, repetir os baselines VECTOR e HYBRID.

## Atualização Feature 016

- Suíte RAG implementada com 25 casos, 7 confirmados e 18 pendentes de revisão manual.
- Baseline TEXT v1: 15 PASS, 4 PARTIAL, 6 FAIL; Top-1 56%, Top-3 72% e MRR 0,643333.
- HYBRID opera em `TEXT_ONLY`; VECTOR permanece `SKIPPED` porque existem zero embeddings.
- PostgreSQL preservado com 2 fontes, 148 chunks e 0 embeddings; nenhuma escrita ou chamada externa.
- Suíte automatizada com 230 testes passando.
- Revisão manual v2 registrada: 20 casos confirmados, 5 pendentes e `answerType` obrigatório.
- Distribuição v2: 13 DIRECT, 4 SYNTHESIS, 1 METADATA, 4 OUT_OF_SCOPE e 3 UNCERTAIN.
- Baseline v1 preservada; baseline v2 gerada com 9 PASS, 9 PARTIAL, 6 FAIL e 1 METADATA SKIPPED.
- Métricas oficiais confirmadas v2: 6 PASS, 7 PARTIAL, 6 FAIL; Top-1 47,4%, Top-3 63,2% e MRR 0,557.
- Algoritmos textual, vetorial e híbrido permanecem inalterados; zero chamadas externas e zero escritas.

## Feature 017

- Fundação interna de Students e Conversations implementada sem endpoint público ou migration.
- Normalização brasileira E.164, courseAccess v1, autorização e resolução inbound futura implementadas.
- Conversation AI é criada/reutilizada; HUMAN é protegido e transições reais são transacionais.
- Scripts `demo:create-student` em dry-run e `db:conversation-check` somente leitura adicionados.
- 272 testes em 26 arquivos aprovados; banco permanece sem Students, Conversations, eventos, Messages ou AnswerLogs.
