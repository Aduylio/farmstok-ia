# Modelo de dados

## Estado implementado

O modelo abaixo foi implementado no Prisma e aplicado ao PostgreSQL local pela migration `20260720114700_refine_prisma_schema` em 20/07/2026.

Convenções:

- IDs UUID v4 gerados pelo PostgreSQL com `gen_random_uuid()`.
- Modelos e campos camelCase/PascalCase no Prisma.
- Tabelas e colunas snake_case no PostgreSQL por meio de `@map` e `@@map`.
- Datas persistidas como `TIMESTAMPTZ(3)`.
- O vetor foi removido de `knowledge_chunks` e preparado em `knowledge_chunk_embeddings` como `vector(1536)`.

## Enums

- `StudentStatus`: `ACTIVE`, `INACTIVE`, `BLOCKED`.
- `ConversationMode`: `AI`, `HUMAN`, `PAUSED`.
- `MessageSender`: `STUDENT`, `AI`, `CONSULTANT`, `SYSTEM`.
- `MessageDirection`: `INCOMING`, `OUTGOING`.
- `MessageType`: `TEXT`, `IMAGE`, `AUDIO`, `VIDEO`, `DOCUMENT`, `LOCATION`, `INTERACTIVE`, `UNKNOWN`.
- `ConversationEventType`: `PAUSED`, `RESUMED`, `HUMAN_ASSUMED`, `AI_ASSUMED`, `CONSULTANT_CHANGED`.
- `ChangeActor`: `SYSTEM`, `AI`, `CONSULTANT`, `STUDENT`.
- `KnowledgeSourceType`: `AULA`, `LIVE`, `MENTORIA`, `PDF`, `FAQ`, `OUTRO`.

## Tabelas

### students

| Campo Prisma | Coluna PostgreSQL | Tipo | Regra |
|---|---|---|---|
| `id` | `id` | UUID | PK, default `gen_random_uuid()`. |
| `name` | `name` | TEXT | Obrigatório. |
| `phone` | `phone` | TEXT | Obrigatório e único; deve ser normalizado em E.164 pela aplicação. |
| `whatsappId` | `whatsapp_id` | TEXT | Opcional e único. |
| `status` | `status` | `student_status` | Default `ACTIVE`. |
| `courseAccess` | `course_access` | JSONB | Opcional. |
| `accessGrantedAt` | `access_granted_at` | TIMESTAMPTZ | Obrigatório, default atual. |
| `accessExpiresAt` | `access_expires_at` | TIMESTAMPTZ | Opcional e posterior à concessão quando informado. |
| `createdAt` | `created_at` | TIMESTAMPTZ | Default atual. |
| `updatedAt` | `updated_at` | TIMESTAMPTZ | Atualização automática pelo Prisma. |

### consultants

| Campo Prisma | Coluna PostgreSQL | Tipo | Regra |
|---|---|---|---|
| `id` | `id` | UUID | PK. |
| `name` | `name` | TEXT | Obrigatório. |
| `phone` | `phone` | TEXT | Opcional e único. |
| `email` | `email` | TEXT | Opcional e único. |
| `isActive` | `is_active` | BOOLEAN | Default `true`. |
| `createdAt` | `created_at` | TIMESTAMPTZ | Default atual. |
| `updatedAt` | `updated_at` | TIMESTAMPTZ | Atualização automática. |

### conversations

| Campo Prisma | Coluna PostgreSQL | Tipo | Regra |
|---|---|---|---|
| `id` | `id` | UUID | PK. |
| `studentId` | `student_id` | UUID | FK obrigatória para `students`, `RESTRICT`. |
| `consultantId` | `consultant_id` | UUID | FK opcional para `consultants`, `SET NULL`. |
| `mode` | `mode` | `conversation_mode` | Default `AI`. |
| `kommoLeadId` | `kommo_lead_id` | TEXT | Opcional e único. |
| `lastMessageAt` | `last_message_at` | TIMESTAMPTZ | Opcional. |
| `modeChangedAt` | `mode_changed_at` | TIMESTAMPTZ | Opcional. |
| `modeChangedBy` | `mode_changed_by` | `change_actor` | Opcional. |
| `createdAt` | `created_at` | TIMESTAMPTZ | Default atual. |
| `updatedAt` | `updated_at` | TIMESTAMPTZ | Atualização automática. |

### messages

| Campo Prisma | Coluna PostgreSQL | Tipo | Regra |
|---|---|---|---|
| `id` | `id` | UUID | PK. |
| `conversationId` | `conversation_id` | UUID | FK para `conversations`, `CASCADE`. |
| `direction` | `direction` | `message_direction` | Obrigatório. |
| `sender` | `sender` | `message_sender` | Obrigatório. |
| `whatsappMessageId` | `whatsapp_message_id` | TEXT | Opcional e único para idempotência. |
| `content` | `content` | TEXT | Obrigatório. |
| `messageType` | `message_type` | `message_type` | Default `TEXT`. |
| `createdAt` | `created_at` | TIMESTAMPTZ | Default atual. |

### conversation_events

Possui `id`, `conversationId`, `type`, `changedBy?`, `metadata?` e `createdAt`. Pertence a `conversations` com `CASCADE` e mantém índice composto por conversa e data.

### knowledge_sources

Possui `id`, `sourceKey`, `type`, `title`, `course`, `module?`, `lessonNumber?`, `sourceUrl?`, `recordedAt?`, `version`, `priority`, `isActive`, `storagePath?`, `instructor?`, `createdAt` e `updatedAt`.

Regras:

- `lessonNumber`, quando informado, deve ser positivo.
- `sourceKey` é obrigatória, única, mapeada para `source_key`, limitada a 200 caracteres e segue `^[a-z0-9][a-z0-9:_-]*$`.
- A chave é explícita e estável; não é derivada do título.
- `version` deve ser positiva.
- Há índices em `isActive` e `course`.
- Fontes devem ser inativadas em vez de excluídas quando já participarem do histórico.

### knowledge_chunks

Possui `id`, `sourceId`, `content`, `startTime?`, `endTime?`, `tokenCount?`, `metadata?`, `contentHash`, `embedding?`, `createdAt` e `updatedAt`.

Regras:

- `sourceId` referencia `knowledge_sources` com `RESTRICT`.
- `(sourceId, contentHash)` é único.
- `tokenCount`, quando informado, não pode ser negativo.
- O campo legado `embedding String?/TEXT` foi removido após uma guarda confirmar ausência de valores.
- `startTime` e `endTime` armazenam limites normalizados como `HH:MM:SS` para transcrições temporais.
- `startTime` corresponde ao primeiro marcador do chunk e `endTime` ao fim do último segmento combinado.
- Conteúdo sem timestamps mantém ambos os campos nulos.
- O hash continua baseado somente no conteúdo textual, sem timestamps.

### knowledge_chunk_embeddings

Relação opcional 1:1 com `knowledge_chunks`. `chunk_id` é simultaneamente PK e FK com `ON DELETE CASCADE`; `embedding` usa `vector(1536)`. Armazena ainda `provider`, `model`, `dimensions`, `inputHash`, `inputTokens?`, `embeddedAt`, `createdAt` e `updatedAt`.

Constraints exigem dimensões iguais a 1536, hash SHA-256 hexadecimal, provider/model não vazios e tokens não negativos. A tabela está vazia; não há índice HNSW ou IVFFlat. O Prisma representa o vetor como `Unsupported("vector(1536)")` e operações vetoriais usam SQL parametrizado.

### answer_logs

Possui `id`, `conversationId`, `question`, `answer`, `confidence`, `needsHuman`, `model?`, `inputTokens?`, `outputTokens?` e `createdAt`.

Regras:

- Pertence a `conversations` com `CASCADE`.
- `confidence` deve estar entre zero e um.
- Contagens de tokens opcionais não podem ser negativas.
- Não mantém `studentId` redundante; o aluno é obtido pela conversa.

### answer_sources

Possui `id`, `answerLogId`, `knowledgeChunkId`, `similarity` e `ranking`.

Regras:

- `answerLogId` usa `CASCADE`; `knowledgeChunkId` usa `RESTRICT`.
- `(answerLogId, knowledgeChunkId)` é único.
- `(answerLogId, ranking)` é único.
- `similarity` deve estar entre zero e um e `ranking` deve ser positivo.

## Índices principais

- Identidade: `students.phone`, `students.whatsapp_id`, `consultants.phone`, `consultants.email`.
- Idempotência externa: `messages.whatsapp_message_id`, `conversations.kommo_lead_id`.
- Histórico: `messages(conversation_id, created_at)`, `conversation_events(conversation_id, created_at)` e `answer_logs(conversation_id, created_at)`.
- Conhecimento: unicidade de `knowledge_sources.source_key`, índices em `knowledge_sources.is_active`, `knowledge_sources.course`, `knowledge_chunks.source_id` e unicidade `(source_id, content_hash)`.
- Fontes de resposta: índices em `answer_sources.answer_log_id` e `answer_sources.knowledge_chunk_id`.

## Política de exclusão

- Relações históricas obrigatórias usam `RESTRICT` quando o registro referenciado precisa sobreviver.
- Consultor opcional usa `SET NULL` para preservar a conversa.
- Mensagens, eventos e respostas são composições da conversa e usam `CASCADE`; exclusão de conversas não faz parte do fluxo normal.
- Fontes e chunks citados devem ser preservados para manter a rastreabilidade das respostas.
