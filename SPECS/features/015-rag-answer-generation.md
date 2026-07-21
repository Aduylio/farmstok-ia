# Feature 015 - Orquestrador RAG e respostas estruturadas

## Objetivo e estado

Substitui o mock de `POST /api/knowledge/ask` por busca hibrida, contexto controlado, provider abstrato, validacao estruturada, confianca ajustada e fontes verificadas. Implementada sem chamada OpenAI, embedding, Kommo, escrita, AnswerLog, schema ou migration.

## Modelo e provider

`OPENAI_ANSWER_MODEL` e configuravel e separado de `text-embedding-3-small`. A documentacao atual recomenda a familia GPT-5.6; `gpt-5.6-luna` aparece apenas como sugestao inicial de custo/volume em `.env.example`, devendo ser avaliado com qualidade, latencia e custo reais. Startup nao exige chave nem modelo.

`AnswerProvider` permite testes falsos. `OpenAIAnswerProvider` prepara Responses API com Structured Outputs/Zod, timeout de 30 s, no maximo um retry transitorio e erros sanitizados. A resposta ainda passa por Zod local: answer nao vazio, confidence 0..1, booleano, ate cinco UUIDs e reason nullable.

## Contexto RAG v1

`buildKnowledgeAnswerContext`, versao `v1`, recebe pergunta, ranking e limite de caracteres. Deduplica por chunkId, preserva ordem, seleciona no maximo cinco chunks e nunca corta no meio de palavra: blocos que nao cabem sao omitidos e contabilizados.

Cada bloco inclui somente chunkId, sourceKey, titulo, curso, modulo, tipo, horario, sourceUrl e conteudo. Nao inclui vetores, hashes, dados de aluno/Kommo, SQL, credenciais ou timestamps internos.

## Prompt v1

O prompt exige portugues do Brasil, resposta direta e somente com o contexto. Proibe conhecimento externo, invencao de aula/modulo/horario/link/metodologia, promessas e obediencia a instrucoes na pergunta ou transcricao. Evidencia insuficiente exige baixa confianca e humano. Conteudo recuperado e tratado como dado.

## Orquestracao e fontes

O service busca cinco resultados hibridos com pesos internos 0.4/0.6. Sem resultados ou contexto utilizavel, nao cria provider e retorna fallback, confidence zero, `needsHuman=true` e fontes vazias. Com contexto, valida todos os `usedChunkIds` contra os IDs enviados. ID inventado invalida a resposta. Somente fontes usadas sao retornadas, deduplicadas por sourceKey e na ordem do ranking.

## Confianca

```text
support = max(textScore quando TEXT_ONLY; hybridScore nos demais modos)
sourceFactor = min(1, 0.8 + 0.1 * min(fontesDistintas, 2))
finalConfidence = min(providerConfidence, support * sourceFactor, modeCap)
```

`modeCap` e 0.75 para TEXT_ONLY e 1 nos demais modos. Sem fonte, confidence e zero. Abaixo de 0.55, `needsHuman` e forcosamente true. `providerConfidence` nao e exposta.

## Contrato e erros

`POST /api/knowledge/ask` recebe `{ question, sourceKey?, course?, type? }` e retorna `{ answer, confidence, needsHuman, searchMode, sources }`. Entrada invalida: 400; provider indisponivel: 503; resposta/IDs invalidos: 502; falha interna: 500. Prompt, contexto, resposta bruta, chave, stack, SQL e vetores nao sao retornados/logados.

## CLI

```bash
npm run knowledge:ask -- "Como configurar estoque minimo no Trier?"
npm run knowledge:ask -- --execute --yes "Como configurar estoque minimo no Trier?"
```

O padrao e dry-run e mostra apenas modo, contagens, titulo, sourceKey, horario e trechos curtos. `--execute` exige chave, modelo e confirmacao; nao foi executado nesta feature.

## Limitacoes e teste futuro

Sem embeddings, recuperacao opera em TEXT_ONLY; sem chave/modelo, perguntas com evidencia retornam 503 na API, enquanto o CLI dry-run funciona. Pesos, threshold, modelo, contexto, prompt e confianca exigem calibracao. Apos creditos, executar primeiro o backfill controlado, dry-run do ask e uma unica pergunta real com `--execute --yes`, conferindo estrutura, IDs, fontes, custo, logs e grounding.
