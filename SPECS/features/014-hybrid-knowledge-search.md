# Feature 014 - Busca hibrida de conhecimento

## Objetivo e estado

Combina as buscas textual e vetorial existentes em ranking unico, deterministico e explicavel, sem duplicar SQL. Implementada sem OpenAI, embeddings, Kommo, escrita, schema ou migration.

## Contrato

`GET /api/knowledge/hybrid-search` aceita `q`, `limit` (1..20, padrao 5), `sourceKey`, `course`, `type`, `minSimilarity`, `textWeight` (padrao 0.4) e `vectorWeight` (padrao 0.6). Pesos ficam entre 0 e 1, nao podem ser ambos zero e sao normalizados internamente.

A resposta contem `query`, `results`, `total`, `mode` (`HYBRID`, `TEXT_ONLY` ou `VECTOR_ONLY`) e `reason` (`VECTOR_UNAVAILABLE`, `NO_RELEVANT_RESULTS` ou null). Cada resultado expoe scores hibrido/textual/vetorial, `matchedBy`, chunk, timestamps e fonte.

## Ranking

Cada busca recebe os mesmos filtros e ate `min(20, limit * 4)` candidatos. O score textual e normalizado por `score / maiorScoreTextual`; scores iguais nao perdem equivalencia. Similaridade vetorial e limitada a 0..1. Resultados sao agrupados por `chunkId`.

```text
hybridScore =
  textScoreNormalizado * textWeightNormalizado
  + vectorScore * vectorWeightNormalizado
  + 0.05 quando o chunk aparece nas duas buscas
```

O resultado e limitado a 0..1. Desempate: score hibrido, dupla correspondencia, score vetorial, score textual, `sourceKey`, `startTime` com nulos ao final e `chunkId`.

## Fallback sem embeddings

O service vetorial verifica a contagem antes de criar o provider. Com zero embeddings retorna `NO_EMBEDDINGS_AVAILABLE`; a busca hibrida usa normalmente os resultados textuais, responde `mode=TEXT_ONLY` e `reason=VECTOR_UNAVAILABLE`, sem exigir chave ou chamar OpenAI.

Se o texto estiver vazio e o vetor retornar resultados, o modo e `VECTOR_ONLY`. Se nenhum mecanismo retornar resultado, a razao e `NO_RELEVANT_RESULTS`.

## CLI

```bash
npm run knowledge:hybrid-search -- "estoque minimo Trier"
```

Aceita todas as opcoes do endpoint. No estado atual informa `Modo: TEXT_ONLY` e indisponibilidade vetorial, listando resultados textuais.

## Limitacoes e proximos ajustes

Pesos e bonus sao heuristicos; score textual depende do conjunto recuperado; `minSimilarity` depende de embeddings reais. Apos o backfill, calibrar pesos, threshold, quantidade de candidatos e bonus com perguntas reais. RRF e reranker podem ser avaliados futuramente, mas nao fazem parte desta versao.

## Aceitacao e rollback

- [x] Services existentes injetados, sem SQL duplicado.
- [x] Pesos, normalizacao, bonus, limite e desempate documentados/testados.
- [x] Fallback textual sem provider.
- [x] Rotas textual e vetorial preservadas.
- [x] Testes sem internet ou banco real.
- [x] Nenhuma migration ou escrita.

Rollback remove modulo, rota, script e documentacao; nao ha dados a reverter.
