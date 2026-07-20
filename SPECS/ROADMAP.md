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

- [x] Criar especificação 005 de ingestão inicial.
- [x] Criar endpoint para cadastro transacional de fontes e chunks.
- [x] Dividir conteúdo em chunks por parágrafos.
- [x] Calcular hash SHA-256 e estimativa aproximada de tokens.
- [x] Evitar chunks duplicados dentro da mesma fonte.
- [x] Registrar metadados básicos da fonte e dos chunks.
- [ ] Ler transcrições automaticamente.
- [ ] Gerar embeddings.
- [x] Permitir reprocessamento manual por `sourceId`.
- [x] Definir e implementar idempotência no nível da fonte por `sourceKey`.
- [x] Criar importador local de arquivos TXT e Markdown.
- [x] Validar metadados JSON e limite configurável por arquivo.
- [x] Organizar inbox, processed e failed sem sobrescrita.
- [ ] Importar PDF, DOCX, áudio ou vídeo.
- [x] Interpretar timestamps isolados em transcrições.
- [x] Persistir `startTime` e `endTime` nos chunks.
- [x] Criar reprocessamento transacional por `sourceId`.
- [x] Reprocessar manualmente as duas fontes reais existentes.
- [x] Permitir reprocessamento preferencial por `sourceKey`.

## Etapa 5 — Busca e IA

- [x] Criar busca textual diagnóstica em chunks persistidos.
- [x] Retornar fontes, timestamps e links temporais em ranking determinístico.
- [x] Criar CLI local para diagnóstico da recuperação.
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
