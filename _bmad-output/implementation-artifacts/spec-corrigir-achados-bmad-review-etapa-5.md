---
title: 'Corrigir achados do bmad-review da Etapa 5'
type: 'bugfix'
created: '2026-08-22'
status: 'done'
baseline_commit: 'fa0f98f5138ee9e4b38120886b0ad6098b81b586'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-5-ativos-proventos-multimoeda.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A revisao adversarial da Etapa 5 encontrou fragilidades reais na leitura multi-moeda: ativos sem posicao podem aparecer como carteira, cotacoes podem ser escolhidas em ordem inadequada, conversoes pendentes ficam pouco explicitas e a UI pode quebrar ou mascarar payload incompleto.

**Approach:** Endurecer a implementacao existente de Ativos e Proventos sem iniciar nova etapa: ajustar regras de selecao/agregacao no service, tornar a UI tolerante e mais auditavel, e ampliar testes para cobrir as bordas levantadas.

## Boundaries & Constraints

**Always:** Manter `transactions` como fonte financeira principal; filtrar tudo por `user_id`; nao alterar migrations ja commitadas, especialmente `0001` e `0003`; preservar BRL/USD separados e consolidado BRL rastreavel; manter portugues do Brasil; corrigir apenas achados da revisao da Etapa 5.

**Ask First:** Se a correcao exigir nova tabela, alterar semantica de `transactions`, escolher API externa de cotacao, criar CRUD de ativos/cambio ou modificar dados historicos estaticos.

**Never:** Nao iniciar Etapa 6; nao importar planilha; nao inventar cotacao fixa; nao transformar estimativas em valores confirmados; nao somar tabelas especializadas em paralelo com `transactions`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ativo cadastrado sem posicao | `assets` existe, mas sem aporte/reinvestimento confirmado ate o periodo | Overview nao lista como posicao patrimonial nem gera alerta de preco | API retorna 200 com carteira vazia ou demais posicoes validas |
| Cotacao reprocessada | Preco antigo tem `fetched_at` mais recente que preco novo | Service escolhe o maior `quoted_at` dentro do periodo | Se faltar preco valido, alerta de preco ausente |
| Investido USD sem cambio | Posicao USD tem valor investido, mas nao ha USD/BRL valido | Consolidado BRL sinaliza pendencia de custo investido alem de valor atual/provento | Valor em USD continua separado |
| Payload parcial na UI | `totalsByCurrency.BRL` ou `USD` ausente | UI usa fallback zero e nao quebra renderizacao | Payload estrutural invalido ainda vira erro |
| Proventos por moeda | Mesmo ativo tem provento em mais de uma moeda | Total por ativo na tabela respeita moeda do provento exibido | Moeda nao suportada fica visivel e fora do consolidado |
| Data real do periodo | Fevereiro ou meses com 30 dias | Filtro usa ultimo dia real do mes | Periodo invalido continua rejeitado |

</frozen-after-approval>

## Code Map

- `lib/investment-service.ts` -- nucleo dos achados: lista posicoes, escolhe preco/cambio, converte USD para BRL, calcula pendencias e formata datas de dividendos.
- `lib/investment-view-model.ts` -- helpers puros de contrato/fallback da UI para permitir teste direto sem depender de browser.
- `app/page.tsx` -- consumidores UI do contrato de investimentos no Dashboard e na aba Ativos e Proventos; precisa fallback por moeda e agrupamento de proventos por ativo/moeda.
- `tests/investments-api.test.mjs` -- suite principal para cenarios multi-moeda, periodo, alertas, estados ignorados e isolamento.
- `tests/investment-view-model.test.mjs` -- cobre fallback de moeda, rejeicao de dashboard sem `investments` e total de proventos por ativo/moeda.
- `tests/dashboard-api.test.mjs` -- confirma adocao do overview de investimentos dentro de `/api/dashboard`.
- `tests/rendered-html.test.mjs` -- render inicial existente; nao cobre interacao client-side, mas pode validar texto base quando aplicavel.
- `db/schema.ts` e `drizzle/0003_organic_grandmaster.sql` -- somente leitura nesta correcao, salvo decisao humana explicita; migrations commitadas devem permanecer imutaveis.

## Tasks & Acceptance

**Execution:**
- [x] `lib/investment-service.ts` -- filtrar ativos sem posicao patrimonial confirmada, ordenar precos por `quoted_at`, usar ultimo dia real do mes e expor pendencia de investido USD sem cambio.
- [x] `lib/investment-service.ts` -- tornar fallback de `paymentDate` consistente usando `t.date` quando nao houver `dividend_events.payment_date`, e emitir alerta para moeda nao suportada.
- [x] `app/page.tsx` -- adicionar fallback seguro para totais BRL/USD, nao mascarar ausencia de `investments` no Dashboard e agrupar proventos por ativo e moeda.
- [x] `tests/investments-api.test.mjs` e `tests/dashboard-api.test.mjs` -- cobrir os cenarios da matriz, incluindo preco ausente/defasado, estados ignorados e payload esperado do dashboard.
- [x] `tests/rendered-html.test.mjs` ou teste existente equivalente -- garantir que a tela renderizada continua expondo a entrada de Ativos e Proventos.

**Acceptance Criteria:**
- Given ativo sem aporte confirmado, when consultar Ativos, then ele nao aparece como posicao patrimonial.
- Given duas cotacoes no periodo com `quoted_at` diferente, when calcular valor atual, then vence a cotacao de maior `quoted_at`.
- Given posicao USD sem cambio, when consultar Dashboard, then o consolidado BRL informa pendencia de conversao sem zerar os totais USD.
- Given payload com total BRL ou USD ausente, when renderizar a UI, then os KPIs usam zero e nao quebram.
- Given `investments` ausente em `/api/dashboard`, when validar payload, then a UI trata como contrato invalido em vez de mascarar zeros.
- Given teste completo, when executar lint, typecheck, db verify, migrate e test, then todos passam.

## Spec Change Log

## Design Notes

Nao ha alteracao de modelo nesta correcao. Duplicidade logica em `exchange_rates` fica registrada como melhoria futura porque resolver por constraint exigiria nova migration; nesta rodada o service deve escolher deterministicamente e os testes devem prender esse comportamento.

## Verification

**Commands:**
- `git diff --check` -- expected: sem whitespace invalido.
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:verify` -- expected: migrations continuam validas.
- `npm.cmd run db:migrate` -- expected: nenhuma migration antiga e reaplicada indevidamente.
- `npm.cmd run test` -- expected: suite completa passando.

## Suggested Review Order

**Regras financeiras**

- Overview preserva periodo, usuario e posicoes patrimoniais reais.
  [`investment-service.ts:127`](../../lib/investment-service.ts#L127)

- Posicoes sem aporte confirmado sao filtradas antes de gerar alertas.
  [`investment-service.ts:159`](../../lib/investment-service.ts#L159)

- Preco/cambio respeitam periodo e ordem deterministica.
  [`investment-service.ts:190`](../../lib/investment-service.ts#L190)

- Consolidado BRL separa conversao USD de moedas nao suportadas.
  [`investment-service.ts:338`](../../lib/investment-service.ts#L338)

**Contrato de UI**

- Helpers puros validam payload e fallback de moeda.
  [`investment-view-model.ts:90`](../../lib/investment-view-model.ts#L90)

- Dashboard consome contrato endurecido sem zerar payload ausente.
  [`page.tsx:253`](../../app/page.tsx#L253)

- Aba Ativos usa total por moeda e provento por ativo/moeda.
  [`page.tsx:577`](../../app/page.tsx#L577)

**Verificacao**

- Testes prendem bordas de posicao, preco, cambio e estados ignorados.
  [`investments-api.test.mjs:114`](../../tests/investments-api.test.mjs#L114)

- Testes de view-model cobrem fallback e contrato parcial da UI.
  [`investment-view-model.test.mjs:35`](../../tests/investment-view-model.test.mjs#L35)

- SSR garante entrada de Ativos e Proventos no shell.
  [`rendered-html.test.mjs:101`](../../tests/rendered-html.test.mjs#L101)
