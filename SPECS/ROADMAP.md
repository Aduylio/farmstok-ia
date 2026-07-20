# Roadmap

## Etapa 1 — Estrutura base

- [x] Inicializar o projeto Node.js.
- [x] Configurar TypeScript.
- [x] Configurar Fastify.
- [x] Configurar variáveis de ambiente.
- [x] Criar health check.
- [x] Iniciar servidor local.
- [x] Criar testes automatizados.

## Etapa 2 — Módulo de conhecimento simulado

- [x] Criar schema da pergunta.
- [x] Criar serviço com respostas simuladas.
- [x] Criar rota POST /api/knowledge/ask.
- [x] Validar entrada inválida.
- [x] Criar testes automatizados.
- [ ] Documentar contrato final.

## Etapa 3 — Supabase

- [x] Configurar Prisma ORM com adapter PostgreSQL.
- [x] Definir schema Prisma inicial.
- [x] Preparar migration inicial versionada.
- [x] Validar `DATABASE_URL` como variável obrigatória.
- [x] Configurar PostgreSQL local e aplicar a migration inicial.
- [x] Executar smoke test de conexão.
- [x] Criar especificação 004 para refinamento do schema Prisma.
- [x] Revisar e implementar o refinamento do schema Prisma em nova migration.
- [x] Adotar UUID nativo e mapeamento snake_case.
- [x] Criar e validar o smoke test `db:check`.
- [ ] Criar projeto.
- [ ] Configurar cliente no backend.
- [x] Criar migrations.
- [ ] Ativar pgvector.
- [x] Criar tabelas da base de conhecimento.
- [x] Testar conexão.
- [ ] Testar inserção e leitura.

## Etapa 4 — Ingestão

- [ ] Ler transcrições.
- [ ] Dividir conteúdo em chunks.
- [ ] Registrar metadados.
- [ ] Gerar embeddings.
- [ ] Evitar duplicações.
- [ ] Permitir reprocessamento.

## Etapa 5 — Busca e IA

- [ ] Implementar busca vetorial.
- [ ] Recuperar fontes.
- [ ] Conectar provedor de IA.
- [ ] Validar resposta estruturada.
- [ ] Registrar logs.
- [ ] Implementar fallback seguro.

## Etapa 6 — WhatsApp

- [ ] Configurar Meta.
- [ ] Validar webhook.
- [ ] Receber mensagens.
- [ ] Evitar duplicação.
- [ ] Enviar respostas.

## Etapa 7 — Kommo

- [ ] Configurar webhook.
- [ ] Implementar tag IA_PAUSADA.
- [ ] Sincronizar estado com Supabase.
- [ ] Testar pausa e retomada.
