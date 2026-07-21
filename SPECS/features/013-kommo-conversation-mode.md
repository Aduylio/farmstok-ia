# Feature 013 - Sincronizacao do modo da conversa por tag Kommo

## Objetivo e estado

Receber webhooks tradicionais de leads, consultar o lead atualizado uma vez e sincronizar `Conversation.mode` pela tag `IA_PAUSADA`. Implementada sem credenciais reais, chamadas externas, alteracoes operacionais ou migration.

## Regra de dominio e schema real

O schema existente usa modos `AI`, `HUMAN`, `PAUSED`, eventos `PAUSED`/`RESUMED` e ator `SYSTEM`. Nao foram criados enums paralelos. Tag presente move `AI` para `PAUSED`; tag ausente move para `AI` somente quando a pausa mais recente foi criada com `metadata.source = "kommo"`. `HUMAN` nunca e sobrescrito automaticamente. Estado igual nao atualiza conversa nem cria evento.

O evento guarda somente `{ source: "kommo", leadId: "...", tag: "IA_PAUSADA" }`. A transacao le conversa e evento mais recente, atualiza modo/instante/ator e cria evento. Student, consultor, mensagens e `kommoLeadId` permanecem intocados. Conversa ausente e ignorada; a unicidade de `kommoLeadId` impede duplicidade no schema atual.

PostgreSQL e a fonte operacional. O futuro fluxo de mensagens deve usar `canAiRespond(conversationId)`, verdadeiro apenas para `AI`, sem consultar o Kommo por mensagem.

## Webhook

`POST /webhooks/kommo`, corpo `application/x-www-form-urlencoded`, limite 64 KiB e ate 20 leads unicos. Eventos aceitos: `leads[add]`, `leads[update]` e `leads[status]`. IDs sao validados e deduplicados; as tags do payload nao sao confiadas. Para cada ID, `GET /api/v4/leads/{id}` obtem `_embedded.tags` atual.

Resposta segura: `{ accepted, processed, updated, ignored }`. Payload invalido retorna 400; segredo incorreto, 401; falha operacional, 502. O processamento e sincrono nesta versao. A documentacao Kommo pede resposta em ate 2 segundos, portanto fila devera ser avaliada antes de volume real.

## Cliente e configuracao

`KOMMO_BASE_URL` aceita somente origem HTTPS sem path, query ou credenciais e remove barra final. Token e segredo sao opcionais no startup, mas token e obrigatorio para chamada e segredo e obrigatorio para habilitar webhook em producao. Timeout inicial: 10 s, validado entre 1 e 30 s.

O client envia Bearer, valida apenas ID/tags e sanitiza 401/403, 404, 429, 5xx, timeout, rede e resposta invalida. Token, corpo integral, tags completas e dados pessoais nao sao registrados.

## Seguranca

O webhook tradicional oficial documenta form-urlencoded, mas nao apresenta assinatura criptografica verificavel. Nao foi inventado HMAC. A rota aceita segredo forte na URL configurada no Kommo ou em `x-kommo-webhook-secret`, com comparacao constante. Producao sem segredo recusa o webhook. Implantacao real exige HTTPS, segredo rotacionavel, rate limiting no proxy/aplicacao e monitoramento; allowlist de IP somente com faixa oficialmente mantida e operacionalmente confiavel.

## CLI

```bash
npm run kommo:sync-lead -- <leadId>
```

Exige base URL e token reais e imprime somente ID, presenca da tag, existencia da conversa, estados e transicao. Nao foi executado nesta feature.

## Aceitacao, riscos e rollback

- [x] Modulo separa HTTP, parser, dominio, persistencia e rota.
- [x] Form-urlencoded, eventos, deduplicacao e limites.
- [x] Regra idempotente e protecao de `HUMAN`.
- [x] Transacao com evento seguro e rollback testado.
- [x] `canAiRespond` consulta somente PostgreSQL.
- [x] Testes sem internet ou PostgreSQL real.
- [x] Nenhuma migration, credencial ou chamada real.

Riscos: autenticidade limitada do webhook tradicional, resposta sincrona dentro de 2 s, expiracao do token e reentregas. Rollback remove rota/modulo/script/configuracao; nao ha dados ou schema a reverter nesta implementacao. Antes do teste real, configurar subdominio, token longo/OAuth valido, segredo forte, URL HTTPS publica, eventos do plano Avancado e uma Conversation com `kommoLeadId` conhecido.

## Fora do escopo

WhatsApp, Chat API, widget, Salesbot, criacao de leads/alunos, telefones, mensagens, fila, Redis, cron, refresh OAuth completo, multiplas contas, embeddings e IA.
