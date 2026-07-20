# Feature 007 — Timestamps e chunking temporal de transcrições

## Status

Implementada em 20/07/2026. As duas fontes existentes não foram reprocessadas automaticamente.

## Objetivo

Interpretar timestamps isolados presentes em transcrições, removê-los do texto dos chunks e persistir limites temporais normalizados em `KnowledgeChunk.startTime` e `KnowledgeChunk.endTime`.

## Formatos aceitos

- `M:SS`
- `MM:SS`
- `H:MM:SS`
- `HH:MM:SS`

Todos são normalizados para `HH:MM:SS`:

| Entrada | Normalizado |
|---|---|
| `0:14` | `00:00:14` |
| `12:48` | `00:12:48` |
| `1:02:35` | `01:02:35` |
| `01:02:35` | `01:02:35` |

Minutos e segundos devem estar entre `00` e `59`. O parser só reconhece uma linha cujo conteúdo completo, desconsiderando espaços externos, corresponde a um dos formatos; ocorrências no meio de frases permanecem como texto.

## Parsing temporal

O pipeline normaliza quebras de linha e percorre a transcrição em ordem:

1. Acumula texto até encontrar um timestamp isolado.
2. O texto anterior ao primeiro timestamp é preservado com `startTime = null` e `endTime` igual ao primeiro marcador.
3. O marcador passa a ser o `startTime` do texto que o segue.
4. O próximo marcador encerra o segmento anterior e vira seu `endTime`.
5. Linhas vazias entre marcador e texto são ignoradas pelo `trim` do segmento.
6. O último segmento recebe `endTime = null`.
7. A linha do timestamp não integra `content`.
8. Marcadores inválidos não são interpretados e permanecem no conteúdo.

Representação intermediária:

```ts
interface TranscriptSegment {
  startTime: string | null;
  endTime: string | null;
  content: string;
}
```

## Chunking temporal

1. O parser temporal é executado antes do chunking.
2. Cada segmento ainda reutiliza `chunkText`, preservando o limite aproximado de 1.000 caracteres e o corte somente entre palavras.
3. Segmentos temporais pequenos e consecutivos são combinados quando o conteúdo resultante não ultrapassa 1.000 caracteres.
4. O chunk combinado conserva o `startTime` do primeiro segmento e o `endTime` do último.
5. Conteúdo anterior ao primeiro timestamp não é combinado com segmentos temporais, evitando perder o primeiro início conhecido.
6. A ordem original nunca é alterada.
7. Conteúdo sem qualquer timestamp válido segue exatamente pelo chunker anterior, com `startTime` e `endTime` nulos.

## Hash e tokenCount

- SHA-256 continua calculado apenas sobre o conteúdo textual normalizado do chunk.
- Timestamps removidos não participam do hash.
- A constraint `(sourceId, contentHash)` não foi alterada.
- `tokenCount` continua sendo `Math.ceil(content.length / 4)`.

## Persistência

O input de `KnowledgeChunk` agora inclui `startTime` e `endTime`. Tanto o endpoint quanto o importador local usam `prepareKnowledgeChunks`, portanto recebem o comportamento temporal sem mudar seus contratos.

Não houve alteração de schema ou migration: as colunas já existiam.

## Compatibilidade

- `POST /api/knowledge/sources` mantém o payload e a resposta atuais.
- `POST /api/knowledge/ask` permanece inalterado.
- `npm run knowledge:import` continua reutilizando o mesmo serviço.
- TXT e Markdown sem timestamps continuam usando o chunking da Feature 005.
- Nenhuma integração externa foi adicionada.

## Reprocessamento controlado

Comando:

```bash
npm run knowledge:reprocess -- <sourceId> <arquivo.txt|arquivo.md>
```

O comando:

1. Valida UUID, extensão, tamanho máximo e conteúdo não vazio.
2. Localiza a fonte dentro da transação.
3. Gera os novos chunks antes de alterar o banco.
4. Remove somente chunks do `sourceId` informado.
5. Insere os novos chunks na mesma transação.
6. Preserva a fonte e todos os seus metadados.
7. Faz rollback completo se exclusão ou criação falhar.
8. Informa quantos chunks foram removidos e criados.
9. Sempre encerra o Prisma Client.

### Comandos para as duas fontes existentes

Estes comandos foram preparados, mas não executados automaticamente:

```bash
npm run knowledge:reprocess -- 6d20dd98-8829-4209-801a-f361cb7fe910 data/knowledge/processed/live-historia-do-farmstok.txt
```

```bash
npm run knowledge:reprocess -- db1214d6-f15f-4a45-b450-ca51788c5b5a data/knowledge/processed/webinar-trier-compras-inteligentes-sergio-samuel.txt
```

Antes de executar, confirmar que cada ID ainda corresponde ao título esperado. O comando não cria `KnowledgeSource`, portanto não duplica a fonte.

## Saída de sucesso

```text
Reprocessamento concluído.
Source ID: 6d20dd98-8829-4209-801a-f361cb7fe910
Chunks removidos: 61
Chunks criados: 54
```

O conteúdo da transcrição, SQL e credenciais não são impressos.

## Critérios de aceitação

- [x] Formatos de timestamp reconhecidos e normalizados.
- [x] Minutos e segundos inválidos rejeitados como marcadores.
- [x] Timestamp isolado associado ao texto seguinte.
- [x] Próximo timestamp usado como `endTime`.
- [x] Último segmento com `endTime` nulo.
- [x] Conteúdo anterior ao primeiro timestamp preservado.
- [x] Timestamp removido do conteúdo persistido.
- [x] Segmentos pequenos combinados sem perder limites temporais.
- [x] Conteúdo sem timestamp compatível com o chunker anterior.
- [x] Hash independente dos timestamps.
- [x] `startTime` e `endTime` persistidos na ingestão.
- [x] Reprocessamento substitui chunks em uma transação.
- [x] Rollback preserva chunks antigos em caso de falha.
- [x] Nenhum schema ou migration alterado.
- [x] Testes sem PostgreSQL real e regressão completa passando.

## Testes

- `M:SS`, `MM:SS`, `H:MM:SS` e `HH:MM:SS`.
- Normalização e rejeição de minuto/segundo inválido.
- Timestamp no meio de frase.
- Associação ao texto e fim pelo próximo marcador.
- Último segmento sem fim.
- Conteúdo anterior ao primeiro marcador.
- Fallback sem timestamp.
- Combinação de segmentos e preservação dos limites.
- Remoção do marcador e hash baseado apenas no conteúdo.
- Serviço de reprocessamento mantendo `sourceId`.
- Substituição transacional e rollback simulado.

## Riscos e limitações

- Timestamps inválidos isolados permanecem no conteúdo por não serem marcadores confiáveis.
- Horas aceitam até dois dígitos; transcrições acima de 99 horas não são reconhecidas.
- Segmentos sem texto entre dois timestamps não geram chunks.
- Combinar segmentos reduz a granularidade temporal: o chunk cobre do primeiro início ao último fim.
- Conteúdos repetidos em tempos diferentes continuam sujeitos à unicidade por hash dentro da mesma fonte.
- Chunks já citados por `AnswerSource` podem impedir exclusão por `RESTRICT`; a transação fará rollback.
- O comando lê o arquivo integralmente após validar o tamanho.
- Não existe histórico de versões dos chunks substituídos.

## Fora do escopo

- Embeddings, pgvector, IA e busca semântica.
- WhatsApp, Kommo e autenticação.
- Upload HTTP e transcrição automática.
- Detecção de timestamps embutidos em frases.
- Reprocessamento automático em lote.

## Rollback

Não houve migration. Para desfazer o código, reverter o pipeline temporal e o comando. Para dados já reprocessados, executar novamente o comando com a transcrição original e a versão de código desejada; não apagar a fonte.

## Próximos passos

1. Executar manualmente os dois comandos após conferência dos IDs.
2. Auditar amostras de chunks e limites temporais persistidos.
3. Definir versionamento do algoritmo antes de novos reprocessamentos.
4. Manter embeddings e busca vetorial em feature separada.
