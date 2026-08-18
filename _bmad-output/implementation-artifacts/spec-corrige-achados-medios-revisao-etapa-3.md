---
title: 'Corrige achados medios da revisao da Etapa 3'
type: 'bugfix'
created: '2026-08-18'
status: 'done'
baseline_commit: '24096c2cfe3dfbf1911eb69dabcb9b275da45018'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-3-dashboard-conectado-ao-sqlite.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A revisao da Etapa 3 encontrou dois riscos medios no Dashboard conectado ao SQLite: uma transacao `DESPESA/COMPRA` com `origin = CONTA` e `card_id` preenchido por erro poderia inflar compras de cartao, e `hasTransactions`/`transactionCount` nao distinguem registros brutos de movimentacoes relevantes para os indicadores.

**Approach:** Restringir a regra de compras de cartao para aceitar `origin = CARTAO` ou `origin = MANUAL` com `card_id`, e adicionar marcadores/contadores de impacto financeiro relevante sem remover o contador bruto existente.

## Boundaries & Constraints

**Always:** Preservar `transactions` como fonte financeira principal; manter filtros por `user_id`; manter valores monetarios em centavos; manter compatibilidade com `origin = CARTAO` para importacao/historico futuro; tratar `origin = MANUAL + card_id` como compra de cartao valida; manter pagamentos de fatura e transferencias fora de custo de vida; expor estado vazio coerente quando houver apenas registros cancelados/sem impacto.

**Ask First:** Se for necessario alterar migrations, schema, contrato de criacao de despesas, login, importacao, regras de cashback, publicacao ou iniciar Etapa 4.

**Never:** Nao alterar migrations; nao publicar; nao criar nova funcionalidade; nao reclassificar dados persistidos automaticamente; nao aceitar `origin = CONTA + card_id` como compra de cartao no indicador `cardPurchasesCents`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Compra manual de cartao valida | `nature=DESPESA`, `subtype=COMPRA`, `origin=MANUAL`, `card_id` preenchido | Soma em custo de vida e em compras de cartao | N/A |
| Compra historica/importada de cartao | `nature=DESPESA`, `subtype=COMPRA`, `origin=CARTAO`, sem depender de `card_id` | Soma em compras de cartao | N/A |
| Linha conflitante | `nature=DESPESA`, `subtype=COMPRA`, `origin=CONTA`, `card_id` preenchido | Nao soma em compras de cartao; pode continuar somando em custo de vida se categoria permitir | Nao corrigir dado automaticamente |
| Periodo sem impacto relevante | Apenas transacoes canceladas ou registros sem indicador relevante | API mantem contador bruto, mas informa que nao ha impacto financeiro relevante | UI usa o marcador de impacto para estado vazio |

</frozen-after-approval>

## Code Map

- `lib/dashboard-rules.ts` -- contem `DashboardTransaction` e `calculateDashboardSummary`; `cardPurchasesCents` hoje usa `origin === "CARTAO" || Boolean(cardId)`.
- `lib/dashboard-repository.ts` -- monta `DashboardOverview`; hoje retorna `transactionCount` e `hasTransactions` com base no total bruto de linhas do periodo.
- `app/page.tsx` -- tipa e valida `DashboardOverview`; hoje exibe estado vazio usando `hasTransactions` e o cabecalho do grafico usando `transactionCount`.
- `tests/dashboard-rules.test.mjs` -- cobre anti-duplicidade e compra manual por `card_id`; precisa cobrir combinacoes validas e conflitantes.
- `tests/dashboard-api.test.mjs` -- cobre endpoint `/api/dashboard`; precisa comprovar periodo com registros brutos sem impacto relevante.

## Tasks & Acceptance

**Execution:**
- [x] `lib/dashboard-rules.ts` -- criar helper de compra de cartao que aceite somente `origin = CARTAO` ou `origin = MANUAL` com `cardId` -- evita inflar indicador por dado inconsistente.
- [x] `lib/dashboard-repository.ts` -- adicionar `countableTransactionCount` e `hasFinancialImpact` ao overview -- separa registros brutos de atividade relevante para o Dashboard.
- [x] `app/page.tsx` -- atualizar tipo, validacao, estado vazio e contador exibido para usar os novos campos sem remover `transactionCount`/`hasTransactions`.
- [x] `tests/dashboard-rules.test.mjs` -- adicionar regressao para `origin = CONTA + cardId` nao contar como compra de cartao e manter casos validos.
- [x] `tests/dashboard-api.test.mjs` -- adicionar regressao para transacao cancelada/sem impacto manter contador bruto sem marcar impacto financeiro.

**Acceptance Criteria:**
- Given compra manual de cartao com `origin=MANUAL` e `card_id`, when calcular o Dashboard, then `cardPurchasesCents` inclui o valor.
- Given compra com `origin=CARTAO`, when calcular o Dashboard, then `cardPurchasesCents` inclui o valor mesmo sem depender de `card_id`.
- Given compra conflitante com `origin=CONTA` e `card_id`, when calcular o Dashboard, then `cardPurchasesCents` nao inclui o valor.
- Given periodo com apenas transacao cancelada, when consultar `/api/dashboard`, then `transactionCount` reflete o registro bruto, `countableTransactionCount` e zero, `hasFinancialImpact` e falso, e os totais confirmados permanecem zero.
- Given periodo com despesa confirmada relevante, when consultar `/api/dashboard`, then `hasFinancialImpact` e verdadeiro e `countableTransactionCount` e maior que zero.

## Spec Change Log

## Verification

**Commands:**
- `git diff --check` -- expected: sem whitespace invalido.
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:verify` -- expected: schema valido.
- `npm.cmd run test` -- expected: suite completa passando.

## Suggested Review Order

**Regra financeira**

- Primeiro revise a classificacao estrita de compra de cartao.
  [`dashboard-rules.ts:175`](../../lib/dashboard-rules.ts#L175)

- Veja onde a regra alimenta o total de compras de cartao.
  [`dashboard-rules.ts:121`](../../lib/dashboard-rules.ts#L121)

**Contrato da API**

- Confira os novos campos do overview persistido.
  [`dashboard-repository.ts:15`](../../lib/dashboard-repository.ts#L15)

- Revise a separacao entre contador bruto e atividade relevante.
  [`dashboard-repository.ts:117`](../../lib/dashboard-repository.ts#L117)

- Confira o criterio de impacto visivel no Dashboard.
  [`dashboard-repository.ts:148`](../../lib/dashboard-repository.ts#L148)

**Interface**

- Veja a validacao do novo payload antes de renderizar.
  [`page.tsx:190`](../../app/page.tsx#L190)

- Confira o estado vazio sem impacto financeiro relevante.
  [`page.tsx:240`](../../app/page.tsx#L240)

- Confira o contador exibido como lancamentos relevantes.
  [`page.tsx:243`](../../app/page.tsx#L243)

**Testes**

- Regressao da combinacao `origin` e `card_id`.
  [`dashboard-rules.test.mjs:125`](../../tests/dashboard-rules.test.mjs#L125)

- Regressao para registro bruto sem impacto.
  [`dashboard-api.test.mjs:135`](../../tests/dashboard-api.test.mjs#L135)
