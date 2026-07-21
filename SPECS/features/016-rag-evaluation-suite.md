# Feature 016 - Suite de avaliacao RAG

## Objetivo

Criar uma avaliacao local, reproduzivel e auditavel da recuperacao de conhecimento antes de gerar embeddings em massa ou ativar respostas externas. A suite mede o comportamento real sem escrever no PostgreSQL, gerar embeddings, chamar IA, WhatsApp ou Kommo.

## Estado de referencia

- PostgreSQL local: 2 fontes ativas, 148 chunks e 0 embeddings.
- Fontes reais: `live:historia-farmstok` e `live:webinar-trier-compras-inteligentes`.
- Dataset: `SPECS/evaluations/knowledge-search-cases.json`.
- Baseline textual: `SPECS/evaluations/baselines/text-baseline.json`.
- Politica: `rag-evaluation-v1`; data do baseline: 21/07/2026.

## Dataset v1

Cada caso possui identificador estavel, pergunta, categoria controlada, fontes esperadas e proibidas, termos esperados, expectativa de resultados e status de revisao. O schema Zod rejeita IDs repetidos, categorias desconhecidas, source keys invalidas e conflito entre fonte esperada e proibida.

Os 25 casos cobrem compras/Trier/estoque/medicamentos, historia/metodo Farmstok, perguntas ambiguas, parafrases e perguntas fora do corpus. Sete expectativas foram marcadas `CONFIRMED`; dezoito permanecem `PENDING_MANUAL_REVIEW`. Metricas desses grupos sao sempre apresentadas separadamente para que um palpite editorial nao seja tratado como regressao confirmada.

## Modos

- `TEXT`: executa a busca textual atual.
- `HYBRID`: modo padrao junto com TEXT. Com zero embeddings, registra `effectiveMode: TEXT_ONLY`.
- `VECTOR`: existe no contrato, mas retorna `SKIPPED` enquanto nao houver embeddings; nunca cria vetores.
- `ANSWER`: reservado para o futuro. So pode ser selecionado explicitamente e exige `--execute --yes`; nesta feature permanece `SKIPPED` e nao chama provider externo.

O comando padrao e `npm run rag:evaluate`. Opcoes: `--mode`, `--case`, `--category`, `--limit`, `--json`, `--execute` e `--yes`. Compare baselines com `npm run rag:evaluate:compare -- <anterior.json> <atual.json>`.

## Regras e metricas

Para casos que esperam resultados, PASS exige fonte esperada no top 3, nenhuma fonte proibida e cobertura total dos termos; PARTIAL registra recuperacao util incompleta (fonte no top 5 ou cobertura parcial); os demais sao FAIL. Para casos sem resposta esperada, qualquer resultado e falha conservadora. Ausencia operacional gera SKIPPED.

- Top-1 = casos com primeira fonte esperada / casos avaliados.
- Top-3 = casos com fonte esperada no top 3 / casos avaliados.
- MRR = media de `1 / rank` da primeira fonte esperada, ou zero.
- Cobertura = media da fracao de termos esperados encontrada.
- Totais de PASS, PARTIAL, FAIL e SKIPPED.

JSON guarda apenas IDs, source keys e trechos curtos; nao armazena conteudo integral, segredo ou `DATABASE_URL`.

## Baseline inicial

TEXT v1: 25 casos, 15 PASS, 4 PARTIAL, 6 FAIL, Top-1 56%, Top-3 72%, MRR 0,643333 e cobertura 68%. Nos 7 confirmados: 3 PASS, 3 PARTIAL e 1 FAIL. Os 18 pendentes exigem revisao manual antes de virarem contrato de regressao.

Melhora significa subir acuracia/MRR/cobertura ou o estado de casos sem degradar confirmados. Piora significa reduzir metricas ou introduzir falha confirmada. Mudancas apenas em pendentes sinalizam revisao, nao bloqueio automatico.

## Seguranca e reproducibilidade

- Consultas sao somente leitura; nenhuma migration ou schema muda.
- Nenhum embedding, AnswerLog ou chamada externa e criado.
- Baseline registra data, politica, contagens, configuracao e resultados compactos.
- Mesmo dataset, banco e configuracao produzem JSON deterministico.
- Erros sao sanitizados, sem credenciais ou caminhos sensiveis.

## Criterios de aceitacao

- Pelo menos 20 casos nas cinco familias obrigatorias.
- CLI executa TEXT e HYBRID por padrao, filtros e JSON.
- HYBRID informa TEXT_ONLY e VECTOR informa SKIPPED com zero embeddings.
- Metricas gerais e por status de revisao corretas.
- Baseline TEXT e comparador versionados.
- Testes por injecao, sem PostgreSQL ou internet.
- Banco preservado em 2 fontes, 148 chunks, 0 embeddings e nenhum novo log.

## Casos de teste

Validacao do dataset; IDs duplicados; categorias e source keys; PASS/PARTIAL/FAIL/SKIPPED; Top-1/Top-3/MRR/cobertura; separacao confirmado/pendente; parsing de CLI; confirmacao de ANSWER; relatorio deterministico; deltas; services simulados.

## Riscos e rollback

Riscos: expectativa incorreta, corpus alterado, configuracao divergente e falso negativo em perguntas fora do corpus. Mitigacoes: status de revisao, metadados, trechos compactos e comparacao por caso.

Rollback e apenas de arquivos. Nao ha rollback de banco porque a feature nao escreve nem executa migration.

## Proxima repeticao

Apos backfill autorizado, confirmar contagem/dimensao, executar TEXT, VECTOR e HYBRID em JSON com a mesma politica, salvar novos baselines e comparar ao TEXT v1. ANSWER permanece fora ate autorizacao explicita de custo e chamadas externas.

## Revisão incremental v2

O dataset `knowledge-search-cases-v2` mantém 25 casos e incorpora a revisão manual do usuário: 20 casos `CONFIRMED` e 5 `PENDING_MANUAL_REVIEW`. Cada caso agora possui `answerType`:

- `DIRECT`: evidência explícita em um ou mais trechos;
- `SYNTHESIS`: combinação fiel de princípios distribuídos, sem atribuir uma formulação literal inexistente;
- `METADATA`: resposta prioritariamente dependente de título, instrutor ou módulo;
- `OUT_OF_SCOPE`: pergunta sem resposta adequada no corpus atual;
- `UNCERTAIN`: presença ainda não confirmada manualmente.

`manualReviewNotes` é opcional e registra justificativas curtas, sem copiar transcrições. A pergunta ampla sobre gestão de estoque foi substituída por “Qual live ensina a configurar estoque mínimo, estoque máximo e Curva ABC?”. “Como repor sem deixar produto faltar?” foi classificada como `SYNTHESIS`, pois combina estoque de segurança, máximo e cobertura.

### Política de métricas v2

`Official confirmed metrics` inclui somente casos confirmados, excluindo `METADATA` sem suporte e `UNCERTAIN`. `Exploratory pending metrics` inclui pendentes auditáveis, mas mantém `UNCERTAIN` em grupo próprio. O relatório também agrupa casos e métricas por `answerType`.

Casos `SYNTHESIS` usam cobertura agregada dos primeiros resultados e podem aceitar múltiplas fontes; a qualidade da síntese gerada será avaliada futuramente em ANSWER. O caso `METADATA` permanece no dataset, mas fica `SKIPPED` em TEXT/HYBRID enquanto instrutor não participa da busca. Isso evita penalizar a recuperação textual por uma capacidade inexistente.

Nos quatro `OUT_OF_SCOPE`, qualquer retorno textual continua sendo FAIL conservador. Coincidência lexical não equivale a resposta válida; a rejeição definitiva dependerá do orquestrador e da política de evidência. Nenhum ajuste foi feito no algoritmo textual para favorecer esses casos.

### Baselines

- `text-baseline.json`: baseline legada v1 preservada, com política `rag-evaluation-v1`.
- `text-baseline-v2.json`: dataset `knowledge-search-cases-v2` e política `rag-evaluation-v2`.

A comparação v1→v2 não mede evolução do algoritmo: perguntas, expectativas e política mudaram. A v2 registrou 9 PASS, 9 PARTIAL, 6 FAIL e 1 SKIPPED. Nas métricas oficiais confirmadas: 6 PASS, 7 PARTIAL, 6 FAIL, Top-1 47,4%, Top-3 63,2% e MRR 0,557. A busca textual permaneceu inalterada; HYBRID continua `TEXT_ONLY` e VECTOR continua indisponível com zero embeddings.
