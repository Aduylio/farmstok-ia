# Feature 005 — Ingestão inicial de conhecimento

## Status

Implementada em 20/07/2026.

## Objetivo

Permitir o cadastro transacional de uma fonte oficial e de seus chunks no PostgreSQL, sem IA, embeddings reais ou pgvector.

## Escopo implementado

- Endpoint `POST /api/knowledge/sources`.
- Validação de entrada com Zod.
- Criação de `KnowledgeSource` e `KnowledgeChunk` em uma única transação Prisma.
- Chunking determinístico por parágrafos e palavras.
- Hash SHA-256 por chunk com `node:crypto`.
- Estimativa simples de tokens sem modelo de IA.
- Deduplicação de chunks dentro da mesma fonte.
- Tratamento de erros HTTP 400, 409 e 500.
- Testes unitários e de rota sem conexão PostgreSQL real.

## Fora do escopo

- Embeddings, pgvector e busca semântica.
- Integrações com IA, WhatsApp ou Kommo.
- Upload, PDF, áudio, vídeo ou transcrição.
- Autenticação e autorização.
- Reprocessamento e atualização de fontes existentes.
- Ingestão automática de dados de exemplo.

## Contrato HTTP

### Requisição

`POST /api/knowledge/sources`

Campos obrigatórios:

| Campo | Tipo | Regras |
|---|---|---|
| `type` | enum | `AULA`, `LIVE`, `MENTORIA`, `PDF`, `FAQ` ou `OUTRO`. |
| `title` | string | Não vazia, até 300 caracteres. |
| `course` | string | Não vazia, até 200 caracteres. |
| `content` | string | Não vazio após `trim`; usado apenas para gerar chunks. |

Campos opcionais alinhados ao schema Prisma:

- `module`: string não vazia, até 200 caracteres.
- `lessonNumber`: inteiro positivo.
- `sourceUrl`: URL válida.
- `recordedAt`: data/hora ISO 8601 com offset.
- `version`: inteiro positivo.
- `priority`: inteiro.
- `isActive`: boolean.
- `storagePath`: string não vazia, até 1.000 caracteres.
- `instructor`: string não vazia, até 200 caracteres.

Exemplo:

```json
{
  "type": "AULA",
  "title": "Curva ABC",
  "course": "Farmstok",
  "module": "Gestão de Estoques",
  "lessonNumber": 1,
  "sourceUrl": "https://exemplo.com/aula",
  "instructor": "Nome do instrutor",
  "content": "Texto completo da aula..."
}
```

### Resposta de sucesso

Status `201 Created`:

```json
{
  "source": {
    "id": "uuid",
    "type": "AULA",
    "title": "Curva ABC",
    "course": "Farmstok"
  },
  "ingestion": {
    "chunksCreated": 3,
    "charactersProcessed": 2450
  }
}
```

O endpoint não retorna conteúdo dos chunks, hashes, metadados internos ou embeddings.

### Erros

| Status | Código | Quando ocorre |
|---:|---|---|
| 400 | `INVALID_REQUEST` | Payload inválido ou conteúdo vazio. |
| 409 | `DUPLICATE_CONTENT` | Violação de unicidade ao persistir chunks. |
| 500 | `INTERNAL_ERROR` | Falha inesperada sem exposição de SQL, credenciais ou stack trace. |

## Estratégia de chunking

O utilitário puro `chunkText`:

1. Normaliza quebras de linha.
2. Divide o texto por parágrafos separados por linhas vazias.
3. Remove parágrafos vazios e espaços externos.
4. Normaliza espaços horizontais repetidos.
5. Divide parágrafos maiores em limites de palavras.
6. Combina segmentos até aproximadamente 1.000 caracteres.
7. Junta o último chunk ao anterior quando ele possui menos de 100 caracteres.
8. Nunca corta uma palavra e mantém a ordem do conteúdo.

Um token é estimado a cada quatro caracteres por `Math.ceil(content.length / 4)`. Essa estimativa serve apenas para metadados aproximados e será refinada quando houver modelo de embedding definido.

## Hash e duplicidade

- `createContentHash` gera SHA-256 hexadecimal do conteúdo final do chunk em UTF-8.
- O serviço elimina hashes repetidos antes da persistência.
- A constraint `@@unique([sourceId, contentHash])` é a proteção definitiva no banco.
- Conteúdo igual é permitido em fontes diferentes porque `sourceId` participa da chave única.
- Violações Prisma `P2002` são convertidas em conflito HTTP 409.

## Transação e rollback

O repositório executa uma única callback de `prisma.$transaction`:

1. Cria `KnowledgeSource`.
2. Cria todos os chunks com `createMany` e o ID da fonte.
3. Retorna somente os dados públicos necessários.

Qualquer falha interrompe a callback e faz rollback da fonte e dos chunks. Não há inserção parcial.

## Organização

```text
src/modules/knowledge-ingestion/
├── knowledge-ingestion.schemas.ts
├── knowledge-ingestion.service.ts
├── knowledge-ingestion.repository.ts
├── knowledge-ingestion.routes.ts
└── knowledge-ingestion.utils.ts
```

- `schemas`: contrato, validação e tipos HTTP.
- `utils`: chunking, SHA-256 e estimativa de tokens.
- `service`: preparação, deduplicação e resposta da ingestão.
- `repository`: transação e acesso Prisma.
- `routes`: protocolo HTTP e tradução de erros.

## Critérios de aceitação

- [x] Endpoint registrado sem alterar `POST /api/knowledge/ask`.
- [x] Payload validado com Zod e conteúdo vazio rejeitado.
- [x] Fonte e chunks persistidos em uma transação Prisma.
- [x] Chunking determinístico sem corte de palavras.
- [x] Hash SHA-256 e estimativa aproximada de tokens.
- [x] Duplicidade interna evitada no serviço e no banco.
- [x] Resposta não contém embeddings ou detalhes internos.
- [x] Erros 400, 409 e 500 possuem respostas seguras.
- [x] Testes não dependem de PostgreSQL real.
- [x] Prisma Client, conexão, typecheck e testes validados.
- [x] Nenhuma biblioteca, migration ou alteração de schema adicionada.
- [x] Nenhuma integração fora do escopo ativada.

## Casos de teste

- Criação de fonte e preparação dos chunks.
- Conteúdo vazio.
- Payload inválido.
- Chunking determinístico e preservação do texto.
- Hash SHA-256 determinístico.
- Estimativa aproximada de tokens.
- Deduplicação de chunks dentro da fonte.
- HTTP 409 para conflito de unicidade.
- Rollback da transação quando a criação dos chunks falha.
- Regressão dos testes existentes de `/api/knowledge/ask` e Prisma.

## Riscos e limitações

- A contagem de tokens é aproximada e não corresponde necessariamente a um tokenizer futuro.
- Parágrafos formados por uma única palavra com mais de 1.000 caracteres permanecem acima do alvo para não cortar a palavra.
- Normalização de espaços pode produzir hash diferente de estratégias futuras; o algoritmo deve ser versionado antes de reprocessamento.
- Não existe idempotência no nível da fonte; chamadas repetidas podem criar fontes diferentes com o mesmo conteúdo.
- O endpoint ainda não possui autenticação ou limite específico de tamanho do conteúdo.
- `createMany` retorna somente a quantidade criada, não os IDs dos chunks.

## Rollback

Como não houve migration ou alteração de schema, o rollback consiste em remover o registro da rota e o módulo. Dados eventualmente criados devem ser removidos de forma deliberada respeitando as foreign keys; não executar exclusão automática.

## Próximos passos

1. Definir limite de tamanho do payload e política de autenticação.
2. Definir identidade/idempotência para fontes e estratégia de reprocessamento.
3. Adicionar teste de integração opcional com banco descartável.
4. Refinar chunking com dados reais antes de implementar embeddings.
5. Manter pgvector, IA e integrações externas em tarefas separadas.
