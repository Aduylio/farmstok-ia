# Feature 017 — Fundação de alunos, conversas e autorização

## Objetivo e escopo

Fornecer serviços internos para identificar alunos previamente cadastrados, manter uma conversa operacional e decidir se o assistente poderá ser usado. Não adiciona endpoint público, webhook WhatsApp, Message, AnswerLog, resposta RAG, chamada OpenAI/Kommo, embedding ou migration.

## Auditoria do schema

O schema atual já contém os elementos necessários:

- Student: UUID, name e phone obrigatórios; phone único; whatsappId opcional e único; status ACTIVE/INACTIVE/BLOCKED; courseAccess JSON opcional; datas de acesso e auditoria.
- Consultant: name obrigatório; phone/email opcionais e únicos; isActive; relação opcional com Conversation.
- Conversation: Student obrigatório com RESTRICT; Consultant opcional com SET NULL; modo AI/HUMAN/PAUSED; kommoLeadId opcional e único; timestamps e ator de mudança.
- ConversationEvent: conversa obrigatória com CASCADE; PAUSED, RESUMED, HUMAN_ASSUMED, AI_ASSUMED e CONSULTANT_CHANGED; ator e metadata opcionais.
- Message: conversa obrigatória com CASCADE; whatsappMessageId opcional e único. Não é criado nesta feature.

Phone, whatsappId e kommoLeadId são TEXT. O schema permite várias Conversations por Student: há índice em studentId, mas não constraint única. O service reutiliza a conversa mais recentemente atualizada, com desempate por ID. Isso não elimina uma corrida entre processos; uma migration futura com conceito explícito de conversa operacional será necessária antes de concorrência real.

Divergências documentais: courseAccess permanece JSON e não representa matrículas; accessExpiresAt existe paralelamente ao activeUntil do JSON v1. A política usa ambos de forma conservadora. Nenhuma mudança bloqueante de schema foi encontrada.

## Telefone brasileiro v1

`normalizeBrazilianPhone` persiste E.164 sem “+”: `5511900000000`. Aceita código 55 explícito ou DDD + assinante, remove apenas formatação permitida e rejeita letras, extensão, país explícito diferente de 55, DDD ausente e tamanho/prefixo incompatível.

Celular exige nove dígitos e prefixo 9; fixo exige oito dígitos e prefixo inicial entre 2 e 5. A validação confirma formato plausível, não existência, titularidade, portabilidade ou capacidade de WhatsApp. Números internacionais não são convertidos.

## Student

`StudentsService` oferece findById, findByPhone, findByWhatsappId, createStudent, findOrCreateByPhone, attachWhatsappId, updateCourseAccess, updateStatus e canUseAssistant.

- phone sempre é normalizado antes da consulta ou persistência;
- conflito concorrente de phone recupera o registro vencedor;
- whatsappId igual é idempotente e valor diferente nunca é sobrescrito;
- erros são genéricos e não contêm PII;
- somente ACTIVE pode prosseguir; INACTIVE e BLOCKED são negados;
- número desconhecido não cria Student no fluxo inbound.

## courseAccess v1

Formato: `{ "courses": ["Farmstok"], "activeUntil": "YYYY-MM-DD" }`. courses deve ser lista não vazia de strings não vazias. activeUntil é opcional, data civil ISO válida e vale até o fim do dia UTC informado.

Ausência, JSON inválido ou data impossível retorna INVALID_COURSE_ACCESS. Curso fora da lista retorna COURSE_ACCESS_DENIED. activeUntil ou accessExpiresAt vencido retorna COURSE_ACCESS_EXPIRED. Erros sempre negam acesso; não existe matrícula, pagamento ou concessão implícita.

## Conversation

`ConversationsService` localiza por ID, Student ou kommoLeadId, cria/reutiliza conversa, associa lead, consulta modo e altera modo por sistema ou humano.

- modo inicial AI;
- assigned consultant e lead existentes são preservados;
- lead igual é idempotente e lead conflitante nunca é transferido;
- HUMAN é protegido contra automação comum;
- transição real atualiza modeChangedAt/modeChangedBy e cria ConversationEvent na mesma transação;
- estado repetido é conferido dentro da transação e não cria evento.

A integração Kommo existente permanece inalterada: IA_PAUSADA, AI→PAUSED, retomada de pausa Kommo, proteção HUMAN, idempotência e eventos continuam válidos. Nenhuma consulta Kommo foi feita.

## Autorização e entrada futura

`resolveAssistantAccess` permite somente Student ACTIVE com courseAccess válido e Conversation AI. Motivos: STUDENT_NOT_FOUND, STUDENT_INACTIVE, STUDENT_BLOCKED, INVALID_COURSE_ACCESS, COURSE_ACCESS_DENIED, COURSE_ACCESS_EXPIRED, CONVERSATION_NOT_FOUND, CONVERSATION_PAUSED e CONVERSATION_HUMAN.

`resolveInboundConversation` normaliza phone, encontra Student, associa whatsappId apenas com segurança, encontra Conversation e retorna IDs/decisão. Não cria Student, Conversation, Message ou resposta e não chama serviço externo.

## Scripts

`npm run demo:create-student -- --name "Aluno Teste" --phone "11999999999"` é dry-run: normaliza o telefone, consulta apenas existência e informa criação/reutilização sem escrever. `--execute --yes` habilita futuramente criação/reutilização transacional, courseAccess v1 e vínculos opcionais seguros. Não foi executado nesta implementação.

`npm run db:conversation-check` é somente leitura e imprime apenas contagens agregadas, nunca nomes, identificadores externos, telefones, mensagens, perguntas, respostas ou courseAccess.

## Segurança, riscos e rollback

Não há logs de PII nos módulos. Riscos: ausência de unicidade de conversa operacional por Student; formato JSON ainda flexível no banco; validação telefônica não prova existência; dry-run pode ficar desatualizado antes de uma execução posterior. Constraints únicas protegem phone, whatsappId e kommoLeadId.

Rollback remove os módulos, scripts, testes, comandos npm e documentação. Não há dados ou migration a reverter.

## Critérios de aceitação

- telefone brasileiro determinístico e testado;
- Student previamente cadastrado e acesso conservador;
- Conversation AI criada/reutilizada internamente;
- associação WhatsApp/Kommo idempotente e sem transferência;
- transições transacionais e HUMAN protegido;
- inbound desconhecido não cria aluno;
- scripts seguros, dry-run e auditoria agregada;
- testes sem banco ou internet;
- zero endpoint, chamada externa, migration ou escrita automática.
