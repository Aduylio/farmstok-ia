# Arquitetura

## Orquestrador RAG (Feature 015)

- `knowledge-answer` orquestra o service hibrido, contexto v1, provider abstrato e fontes validadas.
- `ai` concentra prompt v1, schema estruturado e provider OpenAI via Responses API.
- Modelo de resposta e configuravel e independente do modelo de embeddings.
- Nenhuma persistencia de AnswerLog ate existir Conversation real no fluxo.

## Busca hibrida (Feature 014)

- Orquestra os services textual e vetorial existentes, sem duplicar repositories ou SQL.
- Normaliza score textual, combina por `chunkId` com pesos 0.4/0.6 e bonus 0.05.
- Zero embeddings mantem fallback textual e nao instancia provider OpenAI.
- Busca textual, vetorial e hibrida permanecem endpoints independentes.

## Sincronizacao Kommo (Feature 013)

- Kommo emite mudancas; PostgreSQL continua sendo a fonte operacional do modo.
- O backend consulta o lead atualizado apenas ao receber webhook, nunca a cada mensagem.
- Transporte, parser form-urlencoded, decisao, repository transacional e rota ficam separados em `modules/kommo`.
- `HUMAN` e protegido; PAUSED somente volta a AI quando a pausa foi registrada pelo Kommo.

## Busca vetorial (Feature 012)

- Modulo separado em `knowledge-vector-search`, sem substituir a busca textual.
- Busca exata por cosseno no pgvector, sem HNSW/IVFFlat.
- O repository usa SQL parametrizado e somente embeddings OpenAI `text-embedding-3-small` de 1536 dimensoes.
- O service verifica a existencia de embeddings antes de instanciar o provider; zero vetores nao exige chave nem chamada externa.

## Backfill de embeddings (Feature 011)

- `EmbeddingProvider` isola o dominio do SDK oficial OpenAI; respostas futuras podem usar outro provider, inclusive uma eventual DeepSeek, sem mudar o provider dos embeddings.
- A politica versionada de input v1 e seu SHA-256 definem idempotencia junto com provider, modelo e dimensoes.
- O CLI `knowledge:embed` e dry-run por padrao e exige confirmacao para execucao paga; nao roda no startup ou na importacao.
- O backfill processa fontes ativas em ordem deterministica, valida a resposta completa e persiste uma transacao por lote com SQL vetorial parametrizado.

## Fluxo principal planejado

Aluno no WhatsApp
→ WhatsApp Cloud API
→ Backend Farmstok AI
→ Supabase
→ Busca na base de conhecimento
→ Provedor de inteligência artificial
→ Resposta ao aluno

## Stack principal

- Node.js
- TypeScript
- Fastify
- Zod
- Supabase
- PostgreSQL
- pgvector
- Vitest
- Pino
- Docker

## Princípios arquiteturais

- Backend modular.
- TypeScript em modo strict.
- Separação entre rotas, serviços e repositórios.
- Validação de entradas e saídas.
- Dependências externas isoladas.
- Código testável sem iniciar servidor em porta real.
- Sem lógica de negócio diretamente nas rotas.
- Sem integração prematura com WhatsApp ou Kommo.
- A aplicação deve funcionar primeiro como API independente.

## Organização inicial

src/
├── config/
│ └── env.ts
├── modules/
│ └── knowledge/
│ ├── knowledge.routes.ts
│ ├── knowledge.schemas.ts
│ └── knowledge.service.ts
├── app.ts
└── server.ts

## Responsabilidades

### app.ts

Monta a aplicação, registra plugins e rotas.

### server.ts

Inicia o servidor HTTP.

### config/

Centraliza configurações e variáveis de ambiente.

### modules/

Agrupa funcionalidades por domínio.

### routes

Recebem requisições, validam dados e chamam serviços.

### services

Contêm regras de negócio.

### repositories

Serão responsáveis pelo acesso ao banco de dados.

## Decisões do MVP

- Não utilizar n8n no núcleo.
- Não utilizar banco vetorial externo.
- Usar PostgreSQL com pgvector.
- Não conectar WhatsApp antes do núcleo de conhecimento funcionar.
- Não conectar Kommo antes do fluxo principal estar testado.
- Não criar módulos vazios sem necessidade imediata.

## Persistência atual

- Prisma ORM 7 acessa o PostgreSQL por meio de `@prisma/adapter-pg`.
- `src/config/env.ts` valida `DATABASE_URL` e `src/config/prisma.ts` centraliza o Prisma Client.
- O schema usa UUID nativo, nomes camelCase no Prisma e snake_case no PostgreSQL.
- Migrations são versionadas em `prisma/migrations/`; migrations aplicadas são imutáveis.
- `scripts/db-check.ts` executa somente `SELECT 1` para validar a conexão e sempre encerra o client.
- pgvector e integrações externas permanecem fora da implementação atual.
- pgvector 0.8.5 está habilitado para armazenamento em `knowledge_chunk_embeddings`; geração e busca vetorial ainda não estão implementadas.

## Infraestrutura vetorial

- Provider futuro: OpenAI; modelo `text-embedding-3-small`; 1536 dimensões.
- Vetores ficam em tabela 1:0..1 separada dos chunks e usam `ON DELETE CASCADE`.
- Prisma representa `vector(1536)` como `Unsupported`; operações vetoriais usam SQL parametrizado em repository interno.
- A busca futura começa exata por cosseno, sem HNSW ou IVFFlat nesta etapa.
- Nenhuma API key, SDK, chamada externa ou geração automática foi adicionada.

## Busca textual diagnóstica

- `knowledge-search.repository.ts` seleciona até 500 chunks de fontes ativas usando Prisma e filtros parametrizados.
- `knowledge-search.service.ts` normaliza, pontua, ordena e limita os resultados.
- `knowledge-search.utils.ts` concentra funções puras de texto, score e links temporais.
- `knowledge-search.routes.ts` expõe `GET /api/knowledge/search` com validação Zod e erros seguros.
- A estratégia é temporária e executada na aplicação; não usa pgvector, embeddings, SQL concatenado ou mecanismo externo.

## Avaliação RAG

- `src/modules/rag-evaluation` carrega casos versionados, executa buscas por dependências injetadas e calcula métricas reproduzíveis.
- TEXT e HYBRID são avaliados por padrão; com zero embeddings, HYBRID registra `TEXT_ONLY` e VECTOR fica `SKIPPED`.
- Dataset e baseline ficam em `SPECS/evaluations`; resultados guardam somente metadados e trechos curtos.
- A suíte é somente leitura e não gera embeddings, respostas, logs de resposta ou chamadas externas.
- A política v2 separa métricas oficiais confirmadas, exploração pendente e grupos DIRECT, SYNTHESIS, METADATA, OUT_OF_SCOPE e UNCERTAIN.
- METADATA sem suporte é `SKIPPED` em TEXT/HYBRID; cobertura de SYNTHESIS é agregada no top 5.

## Fundação de alunos e conversas (Feature 017)

- `modules/students` concentra normalização E.164 brasileira, identidade, status e courseAccess v1.
- `modules/conversations` concentra conversa operacional, vínculos externos, transições transacionais e autorização.
- `resolveInboundConversation` prepara o futuro ingresso WhatsApp sem criar aluno, mensagem ou resposta.
- Não há endpoint público; scripts locais são dry-run ou auditoria somente leitura.
