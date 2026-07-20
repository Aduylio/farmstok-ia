# Feature 009 — Busca textual de diagnóstico

## Status

Implementada em 20/07/2026.

## Objetivo

Pesquisar os chunks persistidos por termos textuais e retornar conteúdo, fonte e timestamps, permitindo avaliar a qualidade da base antes de embeddings, pgvector ou IA.

Esta busca é diagnóstica e temporária. Não substitui recuperação semântica.

## Contrato HTTP

`GET /api/knowledge/search`

Parâmetros:

| Campo | Regra |
|---|---|
| `q` | String obrigatória, não vazia após `trim`, até 500 caracteres. |
| `limit` | Inteiro opcional entre 1 e 20; padrão 5. |
| `sourceKey` | Chave opcional no formato da Feature 008. |
| `course` | String opcional, não vazia, até 200 caracteres. |
| `type` | `AULA`, `LIVE`, `MENTORIA`, `PDF`, `FAQ` ou `OUTRO`. |

A resposta preserva `q` como recebida. A normalização é usada somente para comparação.

```json
{
  "query": "estoque mínimo Trier",
  "results": [
    {
      "chunkId": "uuid",
      "content": "Trecho encontrado...",
      "score": 23,
      "startTime": "00:32:18",
      "endTime": "00:33:04",
      "source": {
        "id": "uuid",
        "sourceKey": "live:webinar-trier-compras-inteligentes",
        "type": "LIVE",
        "title": "Webinar Trier...",
        "course": "Farmstok",
        "module": "Gestão de Compras e Estoques",
        "sourceUrl": "https://www.youtube.com/watch?v=...",
        "timestampUrl": "https://www.youtube.com/watch?v=...&t=1938s"
      }
    }
  ],
  "total": 1
}
```

`total` representa todos os candidatos relevantes após pontuação e antes do corte por `limit`.

## Normalização e tokenização

`normalizeSearchText`:

1. aplica `trim`;
2. converte para minúsculas;
3. decompõe Unicode com NFD e remove marcas de acento;
4. reduz espaços repetidos.

`tokenizeSearchQuery` separa por caracteres que não sejam letras ou números e remove termos vazios. Não existe stemming, sinônimos ou correção ortográfica.

## Ranking

Para cada termo normalizado:

- cada ocorrência em `title`: 5 pontos;
- cada ocorrência em `module`: 3 pontos;
- cada ocorrência em `content`: 1 ponto.

Bônus de frase exata normalizada:

- em `title`: 10 pontos;
- em `module`: 6 pontos;
- em `content`: 3 pontos.

Se todos os termos estiverem presentes na combinação de título, módulo e conteúdo, são acrescentados 4 pontos. Um chunk sem qualquer termo recebe zero e não é retornado.

Ordenação final:

1. score decrescente;
2. `sourceKey` crescente;
3. `startTime` crescente, com nulos ao final;
4. `chunkId` crescente.

O `limit` é aplicado somente depois da ordenação.

## Repositório e escala

O repositório usa apenas Prisma, sem SQL textual ou concatenação de entrada. Ele filtra `KnowledgeSource.isActive = true` e aplica `sourceKey`, `course` e `type` quando informados.

São carregados no máximo 500 chunks, em ordem determinística por fonte, horário e ID. A pontuação é calculada na aplicação. Esse teto evita crescimento indefinido, mas pode omitir resultados quando a base ultrapassar 500 candidatos ativos; uma futura busca PostgreSQL/pgvector deverá substituir esta estratégia.

## URLs temporais

- `timestampToSeconds` converte `HH:MM:SS` válido para segundos.
- `buildTimestampUrl` aceita `youtube.com` e subdomínios, além de `youtu.be`.
- Parâmetros existentes são preservados e `t` é criado ou substituído.
- URL externa, inválida ou chunk sem `startTime` produz `timestampUrl: null`.

## CLI

```bash
npm run knowledge:search -- "estoque mínimo Trier"
npm run knowledge:search -- "curva ABC" --limit 10
npm run knowledge:search -- "genéricos similares" --source-key live:webinar-trier-compras-inteligentes
```

O comando reutiliza repository e service da API, imprime somente título, chave, score, horário, link e trecho de até 240 caracteres, e sempre desconecta o Prisma Client.

## Erros

- query inválida: HTTP 400 `INVALID_REQUEST`;
- nenhum resultado: HTTP 200 com lista vazia;
- falha inesperada: HTTP 500 `INTERNAL_ERROR`, sem SQL, stack ou credenciais.

## Diagnóstico real inicial

| Consulta | Total | Observação do top 5 |
|---|---:|---|
| `estoque mínimo Trier` | 110 | Boa recuperação do webinar; top score 23. Muitos resultados amplos por termos isolados. |
| `curva ABC` | 34 | Boa recuperação nas duas fontes; top score 16. |
| `genéricos similares correlatos` | 15 | Baixa precisão; top score 7 e vários resultados com correspondência parcial. |
| `quando comprar` | 133 | Bons trechos operacionais; top score 15, mas consulta muito ampla. |
| `metodologia Farmstok` | 52 | Fonte histórica correta no topo, porém muitos empates em score 12 por metadados compartilhados. |
| `assunto inexistente xyzabc123` | 0 | Lista vazia correta. |

## Critérios de aceitação

- [x] Query e filtros validados com Zod.
- [x] Normalização sem acentos e busca case-insensitive.
- [x] Ranking explícito, determinístico e limitado após pontuação.
- [x] Filtros opcionais e somente fontes ativas.
- [x] Teto documentado de 500 candidatos.
- [x] Links temporais para YouTube.
- [x] Rota e CLI reutilizam o mesmo service.
- [x] Erros seguros e resultado vazio com HTTP 200.
- [x] Testes sem conexão real e regressão preservada.
- [x] Seis consultas reais executadas somente para leitura.
- [x] Schema, migrations, ingestão, chunks, hashes e dados preservados.

## Riscos e limitações

- Correspondência por substring pode aceitar partes de palavras.
- Termos frequentes geram muitos resultados e empates.
- Um único termo relevante é suficiente; consultas longas podem ter baixa precisão.
- Não há stemming, sinônimos, stop words ou semântica.
- Título e módulo repetidos elevam todos os chunks da mesma fonte.
- O primeiro lote determinístico de 500 pode não conter o melhor resultado global em bases maiores.
- A URL temporal depende de `sourceUrl` e `startTime` válidos.

## Fora do escopo e rollback

Não foram adicionados embeddings, pgvector, IA, mecanismo externo, SQL manual ou alterações de banco. O rollback consiste em remover os arquivos de busca, seu registro em `app.ts`, o script npm e a documentação; nenhum rollback de dados é necessário.

## Próximos passos

1. Avaliar stop words e exigência configurável de cobertura mínima de termos.
2. Separar peso de metadados por fonte do peso específico de cada chunk.
3. Avaliar PostgreSQL full-text search antes de crescer além de 500 chunks.
4. Usar os resultados deste diagnóstico para definir a futura busca semântica.
