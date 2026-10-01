---
title: 'Etapa 5 - Ativos e proventos multi-moeda'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_commit: '03c5c044cbd263d6abe8b6f877b32c3ab94a4562'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/PRD.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-3-dashboard-conectado-ao-sqlite.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-4-cartoes-conectados-ao-sqlite.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A aplicacao ainda trata a area de proventos como "FIIS - Dividendos" e nao acomoda corretamente acoes brasileiras, ETFs brasileiros, acoes dos EUA, ETFs dos EUA e REITs. O Dashboard tambem nao consegue mostrar patrimonio/proventos separados por BRL e USD nem consolidar USD em BRL de forma rastreavel.

**Approach:** Criar a primeira leitura operacional de Ativos e Proventos multi-moeda sobre SQLite, usando `assets`, `investment_events`, `dividend_events`, `asset_prices` e `transactions` como fonte financeira principal. Ativos Brasil ficam em `BRL`, ativos EUA ficam em `USD`, e o Dashboard exibe visoes separadas por moeda mais um consolidado em BRL usando cotacao USD/BRL manual persistida.

## Boundaries & Constraints

**Always:** Usar `AuthenticatedUserContext`; filtrar todas as queries por `user_id`; manter `transactions` como fonte unica de valores financeiros confirmados; manter tabelas especializadas apenas como detalhe; preservar `quantity_decimal`, `unit_price_decimal`, `price_decimal` e cambio como decimal em string; exibir moeda original do ativo e provento; converter USD para BRL somente com cotacao registrada; sinalizar cotacao ausente ou defasada; suportar classes `FII`, `ACAO_BR`, `ETF_BR`, `ACAO_US`, `ETF_US`, `REIT` e `OUTRO`; manter portugues do Brasil e formato monetario por moeda.

**Ask First:** Se for necessario importar a planilha, conectar API externa de cotacoes, criar CRUD completo de ativos, criar fluxo de compra/venda pela UI, alterar semantica de `transactions`, alterar dados historicos estaticos em `lib/finance-data.ts`, ou escolher provedor definitivo de cotacao/login.

**Never:** Nao somar `dividend_events` em paralelo com `transactions`; nao converter USD para BRL com taxa fixa escondida no codigo; nao misturar valores BRL e USD no mesmo indicador sem rotulo; nao inventar ativos historicos ausentes no banco; nao transformar provento estimado em receita confirmada.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sem ativos persistidos | Usuario local sem `assets` | Aba Ativos mostra estado vazio e Dashboard mostra patrimonio/proventos zerados | API retorna 200 com listas vazias |
| Ativo BRL com preco | FII/acao BR com quantidade, preco medio e ultimo preco BRL | Posicao aparece em BRL; consolidado BRL usa o proprio valor BRL | Preco ausente marca valor atual como pendente |
| Ativo USD com cambio | REIT/ETF_US com preco USD e cotacao USD/BRL manual | Posicao aparece em USD e tambem no consolidado BRL convertido | Cotacao defasada sinaliza alerta |
| Provento BRL | `transactions` RECEITA/DIVIDENDO/CONFIRMADO em BRL com `dividend_events` | Provento entra uma vez nos totais BRL e no consolidado BRL | Evento sem transaction valida nao entra |
| Provento USD | `transactions` RECEITA/DIVIDENDO/CONFIRMADO em USD com cambio disponivel | Provento aparece em USD e convertido no consolidado BRL | Sem cambio, fica fora do consolidado e marcado pendente |
| Cross-user | Usuario A autenticado e ativos/precos/proventos de B | Nenhum dado de B aparece ou participa da conversao de A | Repositories validam `user_id` |

</frozen-after-approval>

## Code Map

- `db/schema.ts` -- ja possui `assets`, `investment_events`, `dividend_events` e `asset_prices`; precisa de tabela simples para cotacao cambial persistida por usuario, sem reaproveitar `asset_prices` como atalho.
- `drizzle/0001_bumpy_leopardon.sql`, `drizzle/0002_add_transaction_timestamps.sql` e `drizzle/meta/_journal.json` -- migrations existentes sao imutaveis; qualquer schema novo deve virar a proxima migration disponivel (`0003`), com snapshot/journal consistentes.
- `lib/dashboard-rules.ts` -- hoje soma dividendos/aportes por `transactions`, mas nao possui visao patrimonial nem separacao BRL/USD.
- `lib/dashboard-repository.ts` -- endpoint `/api/dashboard` ja agrega por periodo; deve receber bloco opcional de patrimonio/proventos multi-moeda sem quebrar contrato atual.
- `scripts/local-api-server.mjs` -- ja roteia Dashboard, Custos e Cartoes; adicionar endpoint de Ativos/Proventos e manter validacao de periodo.
- `app/page.tsx` -- menu ainda exibe `Investimentos` e `FIIS - Dividendos` com dados estaticos; etapa deve introduzir tela conectada para Ativos/Proventos e mostrar resumo multi-moeda no Dashboard.
- `lib/finance-data.ts` e `lib/price-service.ts` -- permanecem como referencia historica/fallback estatico; nao devem ser usados como banco operacional da nova tela.
- `tests/dashboard-api.test.mjs`, `tests/local-db-schema.test.mjs` e `tests/rendered-html.test.mjs` -- padroes para fixtures SQLite, isolamento por usuario, schema/migration e renderizacao.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema.ts`, `drizzle/0003_*.sql`, `drizzle/meta/*` -- adicionar `exchange_rates` local com `user_id`, par de moedas, taxa decimal, data de referencia, provider/manual, defasagem e indices; manter migrations anteriores imutaveis.
- [x] `lib/investment-service.ts` -- criar overview de ativos/proventos por periodo e usuario: posicoes por ativo, totais por moeda, dividendos por moeda, consolidado BRL e alertas de preco/cambio ausente ou defasado.
- [x] `scripts/local-api-server.mjs` -- expor `GET /api/investments/overview?year=YYYY&month=N|all`, sem aceitar `user_id` da UI.
- [x] `lib/dashboard-repository.ts` e tipos relacionados -- incluir resumo patrimonial multi-moeda no Dashboard sem alterar as regras anti-duplicidade de `transactions`.
- [x] `app/page.tsx` -- substituir a leitura principal de `FIIS - Dividendos` por uma visao conectada de Ativos e Proventos, preservando abas existentes quando necessario, e adicionar cards BRL/USD/consolidado no Dashboard.
- [x] `tests/investments-api.test.mjs` e testes existentes -- cobrir ativos BRL/USD, proventos BRL/USD, cambio ausente, cambio defasado, dupla contagem e cross-user.

**Acceptance Criteria:**
- Given usuario sem ativos, when consultar Ativos, then a API retorna totais BRL/USD zerados e a UI mostra estado vazio.
- Given ativo BRL com quantidade, preco medio e ultimo preco, when consultar Ativos, then valor investido e valor atual aparecem em BRL.
- Given ativo USD com ultimo preco USD e cotacao USD/BRL, when abrir Dashboard, then aparece valor em USD e consolidado em BRL convertido pela cotacao registrada.
- Given ativo USD sem cotacao USD/BRL valida, when abrir Dashboard, then o valor USD aparece separado e o consolidado BRL sinaliza pendencia de cambio.
- Given provento confirmado em BRL ou USD, when calcular Dashboard, then o valor e somado uma unica vez a partir de `transactions`.
- Given usuario A autenticado, when existirem ativos, precos, cambio e proventos de usuario B, then nada de B aparece para A.

## Spec Change Log

## Design Notes

`asset_prices` deve continuar representando preco do ativo na moeda dele. A conversao USD/BRL e outro tipo de dado, por isso deve ficar em `exchange_rates`: isso evita tratar `USD/BRL` como se fosse um ativo e torna possivel auditar provider, data e defasagem.

Valores monetarios confirmados continuam em centavos na moeda da propria `transaction`. Para consolidar em BRL, usar:

```text
valor_brl = valor_usd_cents * usd_brl_rate_decimal
```

O resultado convertido deve ser arredondado para centavos de BRL apenas na borda de agregacao/exibicao. A moeda original nunca deve ser perdida.

## Verification

**Commands:**
- `git diff --check` -- expected: sem whitespace invalido.
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:verify` -- expected: migration 0003 valida, sem quebrar 0000/0001/0002.
- `npm.cmd run db:migrate` -- expected: aplica migrations locais uma vez e ignora reaplicacao com mesmo hash.
- `npm.cmd run test` -- expected: suite completa passando.

## Suggested Review Order

**Contrato financeiro multi-moeda**

- Entrada principal preserva usuario, periodo e fonte financeira em `transactions`.
  [`investment-service.ts:125`](../../lib/investment-service.ts#L125)

- Posicoes usam `transactions.amount_cents` e respeitam o mes selecionado.
  [`investment-service.ts:157`](../../lib/investment-service.ts#L157)

- Preco e cambio sao escolhidos por moeda e periodo, evitando vazamento futuro.
  [`investment-service.ts:187`](../../lib/investment-service.ts#L187)

- Consolidado BRL converte patrimonio e proventos USD somente com cambio persistido.
  [`investment-service.ts:328`](../../lib/investment-service.ts#L328)

**Persistencia e API**

- Cambio USD/BRL fica em tabela propria, auditavel por usuario.
  [`schema.ts:454`](../../db/schema.ts#L454)

- Migration 0003 cria apenas `exchange_rates`, sem alterar migrations antigas.
  [`0003_organic_grandmaster.sql:1`](../../drizzle/0003_organic_grandmaster.sql#L1)

- Endpoint local expõe overview de investimentos sem aceitar `user_id` da UI.
  [`local-api-server.mjs:33`](../../scripts/local-api-server.mjs#L33)

- Dashboard agrega o bloco patrimonial sem mexer nas regras anti-duplicidade.
  [`dashboard-repository.ts:121`](../../lib/dashboard-repository.ts#L121)

**Experiencia conectada**

- Menu substitui a visao estreita de FIIs por Ativos e Proventos.
  [`page.tsx:7`](../../app/page.tsx#L7)

- Dashboard mostra BRL, USD e consolidado BRL com alertas.
  [`page.tsx:400`](../../app/page.tsx#L400)

- Aba conectada busca `/api/investments/overview` e renderiza KPIs/tabelas.
  [`page.tsx:705`](../../app/page.tsx#L705)

**Verificacao**

- Testes cobrem BRL, USD, periodo, cambio, dupla contagem e isolamento.
  [`investments-api.test.mjs:88`](../../tests/investments-api.test.mjs#L88)

- Dashboard API agora prova que o bloco de investimentos chega no contrato final.
  [`dashboard-api.test.mjs:191`](../../tests/dashboard-api.test.mjs#L191)
