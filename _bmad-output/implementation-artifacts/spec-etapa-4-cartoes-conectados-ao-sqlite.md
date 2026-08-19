---
title: 'Etapa 4 - Cartoes conectados ao SQLite'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: '73a30e466ba6417cefc7bc477a76168466074171'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/PRD.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-2-custos-persistidos-locais.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-3-dashboard-conectado-ao-sqlite.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A aba Cartoes ainda usa `cardRows` e `cardYield` estaticos de `lib/finance-data.ts`, enquanto compras no cartao ja sao persistidas em SQLite pela aba Custos. Isso impede conferir fatura, parcelas e cashback a partir do livro financeiro real do piloto local.

**Approach:** Conectar a aba Cartoes a uma API local/SQLite de leitura, usando `transactions`, `card_purchases`, `card_installments`, `cards`, `card_rules` e `cashback_events` para mostrar BTG e Mercado Pago, compras/parcelas por periodo, fatura estimada do mes e cashback real versus estimado.

## Boundaries & Constraints

**Always:** Usar `AuthenticatedUserContext`; todas as queries filtram `user_id`; `transactions` continua sendo a fonte financeira contabilizada; compras de cartao sao despesas por parcela/competencia; pagamento de fatura e transferencia para caixinha aparecem como movimentacoes, mas nao viram nova despesa; cashback real vem de `transactions` confirmada e pode ser detalhado por `cashback_events`; cashback estimado usa `card_rules.cashback_rate_bps`, fica separado e nao altera saldo/patrimonio; valores trafegam em centavos e exibem BRL pt-BR; BTG e Mercado Pago ativos devem aparecer mesmo sem compras; cartoes historicos podem aparecer apenas quando tiverem historico no periodo.

**Ask First:** Se for necessario alterar migrations/schema, mudar a semantica de `origin = MANUAL`, criar login definitivo, implementar importacao XLSX, criar CRUD completo de cartoes/regras/faturas, registrar pagamento de fatura real, registrar transferencia para caixinha pela tela de Cartoes, conectar API externa ou publicar.

**Never:** Nao somar `cashback_events` REAL em paralelo com `transactions`; nao contabilizar cashback estimado como valor confirmado; nao criar despesa para pagamento de fatura; nao misturar dados estaticos da planilha com dados persistidos no mesmo indicador; nao deixar a UI enviar `user_id`; nao alterar migrations nesta etapa.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Banco sem compras | Usuario local bootstrapado com BTG e Mercado Pago ativos | Aba Cartoes mostra ambos, totais zero e estado vazio do periodo | API retorna 200 com listas vazias |
| Compra a vista no cartao | `transactions` DESPESA/COMPRA/CONFIRMADO/ACTIVE com `card_id` e parcela 1/1 | Fatura do mes e lista de compras incluem o valor uma vez | Nao depender de `finance-data.ts` |
| Compra parcelada | `card_purchases` com `card_installments` em meses diferentes | Cada parcela aparece no `statement_month` correto e a soma do mes respeita apenas parcelas daquele mes | Se faltar `card_installments`, usar `transactions` do periodo como fallback controlado |
| Cashback estimado | Compra elegivel e `card_rules` vigente | Exibe estimativa calculada em separado por cartao e consolidada | Estimativa nao cria `transaction` |
| Cashback real | `transactions` RECEITA/CASHBACK/CONFIRMADO/ACTIVE vinculada ao cartao | Exibe valor real separado da estimativa | Nao somar evento especializado duas vezes |
| Cartao historico | Cartao `HISTORICO` com compras no periodo | Aparece na lista do periodo identificado como historico | Cartao historico sem movimento nao polui a tela inicial |
| Cross-user | Usuario A autenticado e dados de usuario B existentes | Nenhuma compra, regra ou cashback de B aparece para A | Repositories filtram e validam por `user_id` |

</frozen-after-approval>

## Code Map

- `app/page.tsx` -- `CardsView` em `app/page.tsx:456` ainda calcula fatura, reservado e ganhos com arrays estaticos; deve virar componente conectado a API local com loading/erro/periodo.
- `scripts/local-api-server.mjs` -- `createLocalApiHandler` em `scripts/local-api-server.mjs:7` ja roteia Dashboard e Custos; adicionar `GET /api/cards/overview?year=YYYY&month=N|all`.
- `lib/finance-repositories.ts` -- contem `CardsRepository` em `lib/finance-repositories.ts:94`, hoje usado apenas para bases de Custos; pode inspirar listagem segura por usuario.
- `lib/expense-service.ts` -- compras no cartao ja criam `card_purchases`, `transactions` e `card_installments`; a Etapa 4 deve consumir esse formato sem regravar dados.
- `lib/dashboard-rules.ts` -- `isCardPurchase` reconhece `origin=CARTAO` ou `origin=MANUAL + cardId`; reutilizar a mesma semantica para evitar divergencia.
- `lib/dashboard-repository.ts` -- exemplo recente de overview SQLite escopado por usuario e resposta agregada para UI.
- `db/schema.ts` -- tabelas `cards`, `card_rules`, `card_purchases`, `card_statements`, `card_installments` e `cashback_events` ja existem; nao alterar migrations.
- `lib/local-bootstrap.ts` -- cria BTG/Mercado Pago e regras iniciais de cashback; confirmar que a tela funciona com esse seed idempotente.
- `tests/dashboard-api.test.mjs` e `tests/expense-service.test.mjs` -- fixtures uteis para banco migrado, bootstrap local e compras parceladas; criar testes proprios de Cards.

## Tasks & Acceptance

**Execution:**
- [x] `lib/card-service.ts` ou `lib/card-repository.ts` -- criar consulta de overview de cartoes por periodo usando SQLite e `AuthenticatedUserContext`, sem aceitar `user_id` externo.
- [x] `scripts/local-api-server.mjs` -- expor `GET /api/cards/overview?year=YYYY&month=N|all` com validacao de periodo equivalente ao Dashboard.
- [x] `app/page.tsx` -- substituir `CardsView` estatico por versao conectada, preservando demais abas e exibindo BTG/Mercado Pago, fatura, compras, cashback real/estimado e historico mensal.
- [x] `tests/cards-api.test.mjs` -- cobrir banco vazio, compra a vista, parcelamento por mes, cashback estimado/real, cartao historico com movimento e isolamento cross-user.
- [x] `tests/rendered-html.test.mjs` ou teste existente aplicavel -- garantir que a aplicacao ainda renderiza apos a troca da aba Cartoes.

**Acceptance Criteria:**
- Given banco bootstrapado sem compras, when consultar `/api/cards/overview`, then BTG e Mercado Pago aparecem ativos com totais zero.
- Given compra no cartao criada pela aba Custos, when abrir Cartoes no mesmo mes, then a fatura do mes inclui a parcela uma unica vez.
- Given compra parcelada em tres meses, when filtrar cada mes, then apenas a parcela do respectivo `statement_month` entra no total daquele mes.
- Given pagamento de fatura existente como `TRANSFERENCIA/PAGAMENTO_FATURA`, when calcular Cartoes, then ele aparece como movimentacao de pagamento, mas nao aumenta compras nem custo.
- Given regra BTG 100 bps e Mercado Pago 50 bps, when houver compras elegiveis, then o cashback estimado e calculado por cartao e identificado como estimado.
- Given cashback real confirmado em `transactions`, when abrir Cartoes, then ele aparece separado do estimado e nao e somado duas vezes por `cashback_events`.
- Given usuario A autenticado, when existirem cartoes, regras e compras de usuario B, then a resposta de A nao inclui dados de B.

## Spec Change Log

## Design Notes

A primeira entrega de Cartoes deve ser principalmente leitura operacional. A criacao de compras permanece na aba Custos; pagamentos de fatura, transferencias para caixinha e edicao de regras de cashback podem ser fluxos futuros. Isso reduz risco porque reaproveita o schema e evita decidir agora telas transacionais que ainda precisam de UX melhor.

O total de fatura do periodo deve ser derivado das parcelas/transacoes de compra do cartao. `card_statements` pode enriquecer fechamento/vencimento quando existir, mas a ausencia de statement formal nao deve esconder compras ja persistidas.

## Verification

**Commands:**
- `git diff --check` -- expected: sem whitespace invalido.
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:verify` -- expected: schema valido sem migrations novas.
- `npm.cmd run test` -- expected: suite completa passando.

## Suggested Review Order

**Fluxo principal**

- Servico centraliza fatura, compras, pagamentos e cashback por usuario.
  [`card-service.ts:130`](../../lib/card-service.ts#L130)

- Endpoint local expõe o overview sem aceitar `user_id` externo.
  [`local-api-server.mjs:28`](../../scripts/local-api-server.mjs#L28)

**Regras financeiras**

- Compras confirmadas entram por parcela ou fallback controlado.
  [`card-service.ts:228`](../../lib/card-service.ts#L228)

- Cartoes historicos aparecem somente com compra valida no periodo.
  [`card-service.ts:204`](../../lib/card-service.ts#L204)

- Cashback estimado usa uma unica regra vigente por compra.
  [`card-service.ts:322`](../../lib/card-service.ts#L322)

- Pagamento de fatura fica separado das compras contabilizadas.
  [`card-service.ts:388`](../../lib/card-service.ts#L388)

**Interface**

- Aba Cartoes troca dados estaticos por componente conectado.
  [`page.tsx:217`](../../app/page.tsx#L217)

- Componente busca SQLite local e mostra KPIs, compras e movimentos.
  [`page.tsx:542`](../../app/page.tsx#L542)

- Movimentacoes de pagamento ficam auditaveis na tela.
  [`page.tsx:588`](../../app/page.tsx#L588)

**Verificacao**

- Testes cobrem compra, pagamento, cashback real e estimado.
  [`cards-api.test.mjs:80`](../../tests/cards-api.test.mjs#L80)

- Teste garante regra unica de cashback e Mercado Pago 0,5%.
  [`cards-api.test.mjs:119`](../../tests/cards-api.test.mjs#L119)

- Teste impede historico pendente ou cancelado na lista.
  [`cards-api.test.mjs:188`](../../tests/cards-api.test.mjs#L188)

- Isolamento cross-user segue coberto no endpoint de Cartoes.
  [`cards-api.test.mjs:223`](../../tests/cards-api.test.mjs#L223)
