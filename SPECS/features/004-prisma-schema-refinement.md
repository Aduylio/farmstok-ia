# Feature 004 — Refinamento do schema Prisma

## Status

Implementada em 20/07/2026 pela migration `20260720114700_refine_prisma_schema`, aplicada ao banco PostgreSQL local vazio. Prisma Client, smoke test, typecheck e os oito testes foram validados com sucesso.

## Objetivo

Revisar o schema Prisma inicial antes da entrada de dados reais e definir um modelo consistente para alunos, atendimento, conhecimento e rastreabilidade das respostas. A implementação altera somente a persistência local e não conecta serviços externos.

## Estado de referência

- PostgreSQL local conectado ao banco `farmstok_ai`.
- Migration inicial `20260717190240_init` já aplicada e imutável.
- Prisma Client gerado e smoke test real de conexão concluído com sucesso.
- O banco ainda não possui dados relevantes, portanto esta é a melhor janela para ajustes estruturais.
- O schema anterior possuía os nove modelos do domínio com campos mínimos, CUID armazenado como `TEXT` e nomenclatura camelCase também no PostgreSQL.
- `KnowledgeChunk.embedding` permanece temporariamente como `String?`.

> Nota posterior: a Feature 010 substituiu este campo legado, ainda vazio, pela tabela separada `knowledge_chunk_embeddings` com `vector(1536)`.

## Escopo

- Definir campos, nulabilidade, defaults, enums, relacionamentos e restrições dos nove modelos atuais.
- Recomendar estratégia única de IDs, política de exclusão, índices e nomenclatura física.
- Definir a estratégia para uma migration futura sem modificar a migration inicial aplicada.
- Definir critérios de aceitação, testes, riscos e rollback.

## Fora do escopo

- pgvector, embeddings reais ou busca vetorial.
- Integrações com IA, WhatsApp ou Kommo.
- Repositórios, serviços, rotas, jobs ou abstrações antecipadas.

## Convenções propostas

### Tipos auxiliares

Enums recomendados:

- `StudentStatus`: `ACTIVE`, `INACTIVE`, `BLOCKED`.
- `ConversationMode`: manter `AI`, `HUMAN`, `PAUSED`.
- `MessageSender`: `STUDENT`, `AI`, `CONSULTANT`, `SYSTEM`.
- `MessageDirection`: manter `INCOMING`, `OUTGOING`.
- `MessageType`: `TEXT`, `IMAGE`, `AUDIO`, `VIDEO`, `DOCUMENT`, `LOCATION`, `INTERACTIVE`, `UNKNOWN`. Nesta etapa somente `TEXT` será utilizado; os demais valores evitam alteração estrutural ao receber metadados futuros.
- `ConversationEventType`: `PAUSED`, `RESUMED`, `HUMAN_ASSUMED`, `AI_ASSUMED`, `CONSULTANT_CHANGED`.
- `ChangeActor`: `SYSTEM`, `AI`, `CONSULTANT`, `STUDENT` para indicar a categoria responsável por uma mudança sem depender da existência futura de um registro relacionado.
- `KnowledgeSourceType`: `AULA`, `LIVE`, `MENTORIA`, `PDF`, `FAQ`, `OUTRO`.

Enums devem representar conjuntos pequenos e estáveis. Informações livres ou sujeitas a expansão frequente devem permanecer como `String` ou `Json`.

### Datas e horários

- Armazenar datas como `DateTime` no Prisma e `timestamptz` no PostgreSQL (`@db.Timestamptz(3)`).
- Gravar e comparar instantes em UTC; conversão de fuso horário pertence às bordas da aplicação.
- Modelos mutáveis devem possuir `createdAt @default(now())` e `updatedAt @updatedAt`.

## Modelos propostos

### Student

Representa o aluno e seu direito de acesso ao atendimento.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `name` | `String` | Sim | Nome exibido; remover espaços externos e rejeitar valor vazio. |
| `phone` | `String` | Sim | Telefone normalizado em E.164, sem espaços ou pontuação; único. |
| `whatsappId` | `String?` | Não | Identificador do contato no WhatsApp; único quando informado. Não implica integração nesta etapa. |
| `status` | `StudentStatus` | Sim | Default `ACTIVE`. |
| `courseAccess` | `Json?` | Não | Estrutura opcional para acessos a cursos, sem abstração relacional prematura. |
| `accessGrantedAt` | `DateTime` | Sim | Instante em que o acesso foi concedido; default `now()`. |
| `accessExpiresAt` | `DateTime?` | Não | Expiração opcional; deve ser posterior a `accessGrantedAt` quando ambos existirem. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |
| `updatedAt` | `DateTime` | Sim | Atualizado automaticamente. |

Regras adicionais:

- `phone` é a identidade de contato canônica do MVP e deve ser normalizado antes de persistir.
- O conteúdo de `courseAccess` deverá ser validado quando o contrato de acesso a cursos for definido.
- Não manter o campo genérico atual `access`; ele deve ser substituído pelos campos explícitos de acesso.

### Consultant

Representa o consultor que pode assumir uma conversa.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `name` | `String` | Sim | Nome não vazio. |
| `phone` | `String?` | Não | E.164 quando informado; único. |
| `email` | `String?` | Não | Normalizado em minúsculas quando informado; único. |
| `isActive` | `Boolean` | Sim | Default `true`; inativação em vez de exclusão física. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |
| `updatedAt` | `DateTime` | Sim | Atualizado automaticamente. |

### Conversation

Agrupa mensagens, eventos e respostas de um atendimento.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `studentId` | `String @db.Uuid` | Sim | Relação obrigatória com `Student`. |
| `mode` | `ConversationMode` | Sim | Default `AI`. |
| `consultantId` | `String? @db.Uuid` | Não | Consultor responsável; esperado em modo `HUMAN`, mas pode permanecer nulo durante transição. |
| `kommoLeadId` | `String?` | Não | Referência externa única quando informada, sem integração nesta etapa. Não é chave estrangeira. |
| `lastMessageAt` | `DateTime?` | Não | Atualizada quando uma mensagem é persistida; usada para ordenação da fila. |
| `modeChangedAt` | `DateTime?` | Não | Preenchido a cada mudança de modo. |
| `modeChangedBy` | `ChangeActor?` | Não | Identifica a categoria do responsável quando conhecida. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |
| `updatedAt` | `DateTime` | Sim | Atualizado automaticamente. |

Toda mudança de `mode`, `consultantId` ou responsabilidade deve ocorrer em transação com um `ConversationEvent`. `modeChangedBy` é um resumo do estado atual; o histórico completo fica nos eventos.

### Message

Registra cada mensagem de entrada ou saída da conversa.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `conversationId` | `String @db.Uuid` | Sim | Relação obrigatória com `Conversation`. |
| `direction` | `MessageDirection` | Sim | Entrada ou saída. |
| `sender` | `MessageSender` | Sim | Inclui `SYSTEM` além dos valores atuais. |
| `whatsappMessageId` | `String?` | Não | Identificador externo único quando informado. |
| `content` | `String` | Sim | Conteúdo textual; pode ser legenda ou descrição para tipos não textuais no futuro. |
| `messageType` | `MessageType` | Sim | Default `TEXT`. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |

Prevenção de duplicidade:

- Criar restrição `@unique` em `whatsappMessageId`; PostgreSQL permite múltiplos valores nulos e rejeita a repetição de IDs reais.
- A ingestão futura deve usar operação idempotente baseada nesse campo e tratar violação única como mensagem já processada.
- Remover a relação direta opcional `Message.studentId`: o aluno já é determinado por `Message.conversation.studentId`; manter ambas permitiria inconsistência.

### ConversationEvent

Mantém a trilha auditável das mudanças relevantes da conversa.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `conversationId` | `String @db.Uuid` | Sim | Relação obrigatória com `Conversation`. |
| `type` | `ConversationEventType` | Sim | Tipo do evento. |
| `changedBy` | `ChangeActor?` | Não | Categoria do responsável quando conhecida. |
| `metadata` | `Json?` | Não | Somente contexto adicional, sem substituir colunas consultadas frequentemente. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |

Quando necessário identificar um consultor específico, `metadata` pode registrar um snapshot como `consultantId` e nome. Isso preserva auditoria mesmo após inativação, sem criar uma relação obrigatória adicional no MVP.

### KnowledgeSource

Representa uma versão de uma fonte oficial do Farmstok.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `type` | `KnowledgeSourceType` | Sim | `AULA`, `LIVE`, `MENTORIA`, `PDF`, `FAQ` ou `OUTRO`. |
| `title` | `String` | Sim | Título oficial não vazio. |
| `course` | `String` | Sim | Curso ao qual a fonte pertence. |
| `module` | `String?` | Não | Módulo ou seção. |
| `lessonNumber` | `Int?` | Não | Positivo quando informado. |
| `sourceUrl` | `String?` | Não | URL oficial; substitui o campo genérico `url`. |
| `recordedAt` | `DateTime?` | Não | Data de gravação/publicação conhecida. |
| `version` | `Int` | Sim | Default `1`; inteiro positivo. |
| `priority` | `Int` | Sim | Default `0`; maior valor significa maior precedência editorial. |
| `isActive` | `Boolean` | Sim | Default `true`; desativação lógica para impedir uso em novas respostas. |
| `storagePath` | `String?` | Não | Caminho interno do artefato, sem acoplar a um provedor. |
| `instructor` | `String?` | Não | Nome do instrutor como snapshot editorial. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |
| `updatedAt` | `DateTime` | Sim | Atualizado automaticamente. |

Ao menos `sourceUrl` ou `storagePath` deve existir para fontes que dependam de um artefato. Essa regra deve ser validada na aplicação; uma `CHECK CONSTRAINT` pode ser adicionada manualmente na migration futura se a regra estiver consolidada. Versões novas devem criar novo registro ou seguir uma identidade editorial definida antes da ingestão; não sobrescrever conteúdo já citado em respostas históricas.

### KnowledgeChunk

Representa um trecho derivado de uma fonte.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `sourceId` | `String @db.Uuid` | Sim | Relação obrigatória com `KnowledgeSource`. |
| `content` | `String` | Sim | Texto não vazio. |
| `startTime` | `String?` | Não | Timestamp do conteúdo no formato validado `HH:MM:SS`. |
| `endTime` | `String?` | Não | Deve ser posterior a `startTime` quando ambos existirem. |
| `tokenCount` | `Int?` | Não | Inteiro positivo quando calculado. |
| `metadata` | `Json?` | Não | Metadados auxiliares de ingestão. |
| `contentHash` | `String` | Sim | Hash criptográfico em formato canônico, calculado após normalização do conteúdo. |
| `embedding` | `String?` | Não | Temporário nesta etapa; sem pgvector e sem embeddings reais. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |
| `updatedAt` | `DateTime` | Sim | Atualizado automaticamente. |

Usar `@@unique([sourceId, contentHash])` para impedir o mesmo conteúdo duplicado dentro de uma fonte, sem impedir que um trecho legítimo apareça em fontes distintas. O algoritmo e o formato do hash devem ser versionados no fluxo de ingestão futuro; a recomendação inicial é SHA-256 sobre conteúdo normalizado em UTF-8.

### AnswerLog

Registra uma resposta produzida e as métricas conhecidas no instante do atendimento.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `conversationId` | `String @db.Uuid` | Sim | Relação obrigatória com `Conversation`. |
| `question` | `String` | Sim | Snapshot da pergunta. |
| `answer` | `String` | Sim | Snapshot da resposta. |
| `confidence` | `Float` | Sim | Entre `0` e `1`. |
| `needsHuman` | `Boolean` | Sim | Default `false`. |
| `model` | `String?` | Não | Identificador do modelo utilizado; nulo para resposta simulada ou sem IA. |
| `inputTokens` | `Int?` | Não | Inteiro não negativo quando disponível. |
| `outputTokens` | `Int?` | Não | Inteiro não negativo quando disponível. |
| `createdAt` | `DateTime` | Sim | Default `now()`. |

Remover a relação direta atual com `Student`, pois o aluno é obtido pela conversa. O campo atual `tokens` deve ser substituído por `inputTokens` e `outputTokens`, evitando uma métrica ambígua.

### AnswerSource

Relaciona uma resposta aos chunks efetivamente utilizados.

| Campo | Tipo proposto | Obrigatório | Regra |
|---|---|---:|---|
| `id` | `String @db.Uuid` | Sim | UUID como chave primária. |
| `answerLogId` | `String @db.Uuid` | Sim | Relação com `AnswerLog`. |
| `knowledgeChunkId` | `String @db.Uuid` | Sim | Relação com `KnowledgeChunk`. |
| `similarity` | `Float` | Sim | Entre `0` e `1` quando a busca vetorial existir. |
| `ranking` | `Int` | Sim | Inteiro positivo, começando em `1`. |

Restrições recomendadas:

- `@@unique([answerLogId, knowledgeChunkId])` para não citar o mesmo chunk duas vezes na mesma resposta.
- `@@unique([answerLogId, ranking])` para não repetir posição no ranking.
- Índice em `knowledgeChunkId` para consultar o histórico de uso de um chunk.

## Estratégia de IDs

### CUID versus UUID

| Critério | CUID atual | UUID |
|---|---|---|
| Suporte PostgreSQL | Armazenado como `TEXT` | Tipo nativo `uuid` |
| Interoperabilidade | Mais associado ao ecossistema JavaScript | Amplamente suportado por PostgreSQL, Supabase, APIs e ferramentas |
| Geração distribuída | Sim | Sim |
| Tamanho/índices | Texto maior | 16 bytes no tipo nativo |
| Exposição em APIs | Não sequencial | Não sequencial |

### Decisão recomendada

Adotar UUID v4 em todos os modelos, usando no Prisma `String @id @default(uuid()) @db.Uuid`. É uma estratégia única, simples, nativa no PostgreSQL e interoperável com o ecossistema planejado. Não misturar CUID e UUID entre tabelas.

Como a migration inicial já criou IDs CUID em colunas `TEXT`, a migration futura deve recriar ou converter as tabelas de modo controlado. Como ainda não há dados relevantes, recriar as tabelas é mais claro e seguro do que tentar converter strings CUID existentes para UUID. Essa decisão deve ser confirmada imediatamente antes da migration.

## Política de exclusão e preservação de histórico

Princípio: entidades de atendimento e auditoria não devem ser apagadas pelo fluxo normal. Alunos e consultores devem ser inativados; fontes devem usar `isActive`. Exclusão física será uma operação administrativa excepcional.

| Relacionamento | Política proposta | Justificativa |
|---|---|---|
| `Student → Conversation` | `RESTRICT` | Preserva o histórico e impede conversa órfã. |
| `Consultant → Conversation` | `SET NULL` | Permite inativação/exclusão excepcional do cadastro sem perder a conversa. Eventos mantêm o snapshot da mudança. |
| `Conversation → Message` | `CASCADE` no banco, exclusão da conversa bloqueada na aplicação | Evita órfãos se houver expurgo administrativo integral, mas o fluxo normal nunca exclui conversa. |
| `Conversation → ConversationEvent` | `CASCADE` com a mesma restrição operacional | Eventos não têm significado sem conversa. |
| `Conversation → AnswerLog` | `CASCADE` com a mesma restrição operacional | Respostas pertencem ao histórico da conversa. |
| `KnowledgeSource → KnowledgeChunk` | `RESTRICT` | Fonte citada não deve ser removida; usar `isActive`. |
| `KnowledgeChunk → AnswerSource` | `RESTRICT` | Preserva as fontes de respostas históricas. |
| `AnswerLog → AnswerSource` | `CASCADE` | A associação não possui significado sem a resposta; exclusão do log deve ser excepcional. |

`CASCADE` não é autorização para apagar histórico. Ele apenas garante consistência caso uma política futura de retenção faça expurgo completo e deliberado. Não utilizar `SET NULL` onde o registro perderia seu significado de domínio.

## Índices e constraints

### Obrigatórios

- `Student.phone`: índice único.
- `Student.whatsappId`: índice único nullable.
- `Consultant.phone`: índice único nullable.
- `Consultant.email`: índice único.
- `Message.whatsappMessageId`: índice único nullable para idempotência.
- `Message(conversationId, createdAt)`: índice composto para paginação cronológica.
- `ConversationEvent(conversationId, createdAt)`: índice composto para histórico.
- `AnswerLog(conversationId, createdAt)`: índice composto para auditoria.
- `Conversation.kommoLeadId`: índice único nullable conforme o contrato atual.
- `Conversation(studentId, lastMessageAt)`: índice composto para listar conversas recentes do aluno.
- `KnowledgeSource.isActive`: índice; preferir também `(type, isActive)` para filtrar fontes elegíveis.
- `KnowledgeSource(course, module)`: índice composto para navegação editorial.
- `KnowledgeChunk.sourceId`: índice para carregar chunks da fonte.
- `KnowledgeChunk.contentHash`: índice, além de `@@unique([sourceId, contentHash])`.
- `AnswerSource.knowledgeChunkId`: índice para rastrear uso do chunk.

### Validações de domínio

Prisma não expressa todas as `CHECK CONSTRAINTS`. A migration futura pode incluir checks explícitos para:

- `confidence BETWEEN 0 AND 1`;
- `similarity BETWEEN 0 AND 1`;
- `ranking > 0`, `lessonNumber > 0`, `version > 0`;
- contagens de tokens não negativas;
- `accessExpiresAt > accessGrantedAt` quando ambas existirem.

Validações devem existir também na camada de entrada para produzir mensagens claras; constraints permanecem como última linha de defesa.

## Nomenclatura Prisma e PostgreSQL

### Decisão recomendada

- Manter modelos e campos em camelCase/PascalCase no Prisma e no TypeScript.
- Mapear tabelas e colunas físicas para snake_case no PostgreSQL com `@@map` e `@map`.
- Usar nomes de tabelas no plural: por exemplo, `Student @@map("students")`, `createdAt @map("created_at")` e `studentId @map("student_id")`.
- Mapear enums para nomes físicos consistentes somente se isso trouxer clareza na migration; os valores podem permanecer em maiúsculas.
- Nomear índices e constraints explicitamente quando necessário para obter nomes estáveis e legíveis.

Essa separação mantém a ergonomia idiomática no código TypeScript e torna o banco previsível para SQL, observabilidade e integrações futuras. A mudança deve ser feita de uma só vez na próxima migration para não perpetuar uma mistura de estilos.

## Migration implementada

1. A migration inicial `20260717190240_init` permaneceu inalterada.
2. As nove tabelas foram verificadas antes da alteração e continham zero registros.
3. A nova migration `20260720114700_refine_prisma_schema` recriou as tabelas em snake_case e adotou UUID nativo.
4. O SQL contém aviso explícito de que a recriação destrutiva só é aceitável para o banco local confirmado como vazio.
5. Foram adicionadas constraints para períodos de acesso, intervalos de confiança e similaridade, ranking, versão, número da aula e contagens de tokens.
6. A migration foi aplicada com `prisma migrate deploy`; `db push` não foi utilizado.
7. Prisma Client, smoke test real, typecheck e os oito testes passaram após a aplicação.

## Critérios de aceitação

1. Todos os nove modelos contêm os campos e tipos aprovados nesta especificação.
2. Todos os modelos usam UUID nativo de forma uniforme.
3. Prisma usa camelCase/PascalCase e PostgreSQL usa snake_case por meio de `@map` e `@@map`.
4. Telefones são normalizados em E.164 antes da persistência e possuem unicidade conforme definido.
5. `whatsappMessageId` garante idempotência sem exigir conexão com WhatsApp.
6. `MessageSender` contém `SYSTEM` e `KnowledgeSourceType` contém os seis tipos definidos.
7. Relações redundantes `Message.studentId` e `AnswerLog.studentId` são removidas.
8. Mudanças de modo são auditáveis por `ConversationEvent`.
9. Histórico de atendimento não pode se tornar órfão e não é removido pelo fluxo normal.
10. Índices compostos e únicos previstos estão presentes.
11. `contentHash` impede duplicação dentro da mesma fonte.
12. `embedding` continua `String?`; não há extensão, coluna ou índice pgvector.
13. A migration inicial permanece byte a byte inalterada e uma nova migration é criada.
14. A nova migration é revisada e testada em banco descartável antes de uso local principal.
15. Prisma Client gera, typecheck passa e todos os testes automatizados passam.
16. Nenhuma integração com IA, WhatsApp ou Kommo é ativada.

## Casos de teste

### Validação e unicidade

1. Criar aluno com telefone E.164 válido.
2. Rejeitar aluno com telefone não normalizado.
3. Rejeitar dois alunos com o mesmo telefone.
4. Aceitar múltiplos alunos sem `whatsappId` e rejeitar repetição de um ID informado.
5. Rejeitar consultores com e-mail duplicado, considerando normalização para minúsculas.
6. Validar acesso ativo, bloqueado, expirado e ainda não concedido.

### Atendimento e idempotência

7. Criar conversa vinculada a aluno existente.
8. Alterar modo e registrar `ConversationEvent` na mesma transação.
9. Associar e remover consultor responsável preservando a conversa.
10. Persistir mensagem `SYSTEM`.
11. Inserir duas mensagens sem `whatsappMessageId`.
12. Rejeitar segunda mensagem com o mesmo `whatsappMessageId`.
13. Consultar mensagens por conversa em ordem de `createdAt`.
14. Confirmar atualização de `lastMessageAt` pelo fluxo responsável.

### Conhecimento e respostas

15. Criar cada tipo permitido de `KnowledgeSource`.
16. Desativar uma fonte sem apagá-la.
17. Rejeitar `lessonNumber`, `version` ou `tokenCount` inválidos.
18. Criar chunk sem embedding.
19. Rejeitar dois chunks com o mesmo `(sourceId, contentHash)`.
20. Permitir o mesmo `contentHash` em fontes diferentes.
21. Rejeitar `confidence` e `similarity` fora do intervalo de zero a um.
22. Rejeitar ranking repetido e chunk repetido na mesma resposta.

### Integridade e migration

23. Impedir exclusão de aluno com conversa.
24. Preservar conversa ao remover excepcionalmente um consultor, definindo `consultantId` como nulo.
25. Impedir exclusão de fonte ou chunk referenciado pelo histórico.
26. Validar migration em banco vazio do início ao fim.
27. Validar rollback em banco descartável.
28. Confirmar que a migration inicial não foi modificada.
29. Confirmar que não existe pgvector nem conexão com provedores externos.

Testes de schema e unidade devem usar mocks ou inspeção do schema quando possível. Testes de constraints e migration devem usar exclusivamente banco local descartável dedicado a testes, nunca o banco de desenvolvimento com dados.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Alterar a migration inicial aplicada | Divergência entre histórico e banco | Torná-la imutável e criar nova migration. |
| Converter CUID textual diretamente para UUID | Falha de migration e perda de referências | Recriar tabelas enquanto não há dados; replanejar com backfill se isso mudar. |
| Exclusões em cascata apagarem histórico | Perda de auditoria | Inativação lógica e bloqueio de exclusão no fluxo normal; testar políticas. |
| Índices excessivos | Escritas mais lentas e manutenção desnecessária | Criar apenas índices ligados às consultas previstas e medir depois. |
| Enum rígido mudar frequentemente | Migrations recorrentes | Reservar enums a conjuntos pequenos e estáveis. |
| `Json` concentrar dados importantes | Consultas frágeis e sem constraints | Usar colunas para campos consultados e `metadata` somente para contexto auxiliar. |
| Hash calculado de maneiras diferentes | Duplicação não detectada | Definir normalização e algoritmo únicos antes da ingestão. |
| IDs externos tratados como relações locais | Acoplamento prematuro | Mantê-los como strings opcionais e indexadas. |
| Mistura de camelCase e snake_case | SQL inconsistente | Aplicar `@map` e `@@map` de uma só vez. |

## Plano de rollback

1. Antes da nova migration, gerar backup lógico e registrar a versão do schema.
2. Testar avanço e reversão em banco descartável.
3. Se a migration ainda não tiver sido aplicada fora do banco descartável, corrigir ou substituir somente a nova migration não compartilhada; nunca alterar a inicial.
4. Se já tiver sido aplicada, criar migration compensatória explícita. Não usar `git revert` como substituto de rollback de banco.
5. Restaurar o backup caso a conversão de IDs ou constraints comprometa integridade.
6. Regenerar Prisma Client compatível com o schema restaurado e executar smoke test, typecheck e testes.
7. Preservar logs de atendimento e associações históricas durante qualquer reversão.

## Campos e capacidades fora do MVP

- Vetores pgvector, dimensão do embedding e índices HNSW/IVFFlat.
- Conteúdo binário de mídia, transcrição de áudio e processamento de anexos.
- Estado completo de entrega/leitura do WhatsApp e payload bruto permanente do provedor.
- Dados completos de lead, pipeline, tags e tarefas do Kommo.
- Prompt completo, temperatura, custos detalhados, latência por etapa e traces do provedor de IA.
- Organizações, multi-tenant, permissões granulares e autenticação de consultores.
- Campanhas, marketing, notificações e preferências avançadas do aluno.
- Soft delete genérico (`deletedAt`) em todos os modelos; usar status/isActive onde o domínio já exige inativação.
- Versionamento genérico de todos os registros, event sourcing e tabelas de auditoria universais.
- Armazenamento de arquivos e acoplamento a um provedor específico.
- Índices de busca textual ou vetorial antes de existirem consultas e volume reais.

## Próxima etapa recomendada

Definir os contratos de validação e os repositórios necessários antes da entrada de dados reais, sem antecipar integrações com IA, WhatsApp ou Kommo.
