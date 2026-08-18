---
title: 'Etapa 3 - Dashboard conectado ao SQLite'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: '56046376a25dced117b30d9ead249e4699c5568d'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-2-custos-persistidos-locais.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** O Dashboard ainda exibe totais estáticos da planilha via `lib/finance-data.ts`, enquanto a aba Custos já grava despesas reais em SQLite. Isso impede validar o fluxo principal do piloto: cadastrar despesa, voltar ao Dashboard e ver os indicadores atualizados sem depender de mock ou Excel.

**Approach:** Conectar o Dashboard à API local/SQLite usando `transactions` como fonte financeira principal, reutilizando as regras de Dashboard existentes e corrigindo o encaixe com a Etapa 2 para reconhecer compras de cartão por `card_id`/parcelas, mesmo quando `origin = MANUAL`.

## Boundaries & Constraints

**Always:** Usar `AuthenticatedUserContext`; todos os endpoints/repositories devem filtrar por `user_id`; totais confirmados usam somente `transactions` com `classification_status = CONFIRMADO` e `transaction_status = ACTIVE`; pendentes, rejeitados, estimados e cancelados devem aparecer separados ou ser ignorados conforme regra; pagamento de fatura e transferências internas não entram em custo de vida; cashback estimado não aumenta saldo/patrimônio; valores trafegam em centavos e são exibidos em BRL pt-BR; banco vazio retorna zeros e estado vazio.

**Ask First:** Se for necessário alterar a migration `0001`, mudar a semântica aprovada de `origin = MANUAL` para lançamentos manuais, criar login definitivo, importar a planilha, implementar CRUD de investimentos/dividendos/cartões, conectar API externa de cotação, publicar ou trocar runtime/backend.

**Never:** Não misturar dados estáticos da planilha com dados persistidos como se fossem o mesmo indicador; não usar planilha como banco; não deixar a UI enviar `user_id`; não somar tabela especializada em paralelo com `transactions`; não implementar importação XLSX, pagamentos de fatura, transferências, investimentos ou dividendos completos nesta etapa.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Banco vazio | SQLite migrado e usuário bootstrapado sem transações | Dashboard mostra zeros, aviso de ausência de lançamentos e não cai nos totais estáticos | API retorna 200 com totais zero |
| Despesa em conta | `transactions` DESPESA/COMPRA/CONFIRMADO/ACTIVE com `source_account_id` e categoria de custo | Custo de vida aumenta no mês; compras de cartão não aumentam | Relação cross-user rejeitada no repository |
| Compra no cartão manual | DESPESA/COMPRA/CONFIRMADO/ACTIVE com `card_id`, `origin = MANUAL` e/ou `card_installments` | Custo de vida e compras de cartão aumentam no mês da competência/fatura | Não depender apenas de `origin = CARTAO` |
| Parcela futura | Compra parcelada gerada pela Etapa 2 em meses sequenciais | Cada mês mostra somente a parcela da respectiva competência | Soma anual respeita todas as competências |
| Pendente/cancelada | Despesa PENDENTE_REVISAO ou CANCELADO | Não entra em total confirmado; pendente aparece em indicador próprio | Cancelada fica fora de totais |
| Fatura/transferência futura | Transação TRANSFERENCIA/PAGAMENTO_FATURA ou TRANSFERENCIA_RESERVA | Não altera custo de vida; aparece apenas no bloco de movimentações neutras | Sem dupla contagem |

</frozen-after-approval>

## Code Map

- `app/page.tsx` -- `DashboardView` ainda lê `getYearSheet`, `monthlyTotals`, `cardRows`, `dividendTotals` e mostra dados estáticos; deve trocar apenas o Dashboard para API local, preservando demais abas.
- `lib/dashboard-rules.ts` -- Calculadora pura já existe, mas `cardPurchasesCents` depende de `origin = CARTAO`; precisa reconhecer `card_id`/vínculo de cartão para lançamentos manuais da Etapa 2.
- `lib/dashboard-repository.ts` -- Repository SQLite já filtra por `user_id` e calcula summary; precisa carregar `card_id`, talvez séries mensais/categorias, e manter joins sempre por `t.user_id`.
- `scripts/local-api-server.mjs` -- API local expõe Custos; adicionar endpoint(s) de Dashboard sem aceitar `user_id`.
- `lib/local-auth.ts` e `lib/local-db.ts` -- Reutilizar contexto local e conexão SQLite; não duplicar abertura de banco.
- `lib/expense-service.ts` e `lib/finance-repositories.ts` -- Etapa 2 grava despesas manuais com `origin = MANUAL`, `card_id` para cartão e `source_account_id` para conta; Dashboard deve respeitar essa decisão.
- `tests/dashboard-rules.test.mjs` -- Já cobre dupla contagem e isolamento; atualizar/adicionar casos para cartão manual por `card_id`.
- `tests/expense-service.test.mjs` -- Pode ser reutilizado para fixtures de despesa/parcelamento persistido.
- `tests/rendered-html.test.mjs` -- SSR atual valida textos estáticos; ajustar somente se a renderização inicial do Dashboard mudar.

## Tasks & Acceptance

**Execution:**
- [x] `lib/dashboard-rules.ts` -- Ampliar o contrato de `DashboardTransaction` para reconhecer compras de cartão por `cardId`/marcador derivado, mantendo compatibilidade com `origin = CARTAO`.
- [x] `lib/dashboard-repository.ts` -- Retornar summary, série mensal e distribuição por categoria a partir de `transactions`, sempre filtrando `user_id` e período.
- [x] `scripts/local-api-server.mjs` -- Adicionar `GET /api/dashboard?year=YYYY&month=N|all`, usando o mesmo contexto autenticado local.
- [x] `app/page.tsx` -- Substituir `DashboardView` por versão conectada à API local, com loading, erro, estado vazio, KPIs, evolução mensal e cards de pendências/movimentações.
- [x] `app/globals.css` -- Adicionar somente estilos necessários para estados de Dashboard persistido, sem redesenho amplo.
- [x] `tests/dashboard-rules.test.mjs` -- Cobrir cartão manual com `origin = MANUAL`, pendentes/cancelados e anti-duplicidade.
- [x] `tests/dashboard-api.test.mjs` ou equivalente -- Cobrir endpoint local, banco vazio, dados de usuários diferentes e integração com despesas criadas pela Etapa 2.

**Acceptance Criteria:**
- Given banco sem transações, when abrir Dashboard, then KPIs exibem zero e mensagem de ausência de lançamentos persistidos.
- Given despesa em conta confirmada no mês, when consultar Dashboard do mês, then custo de vida aumenta e compras de cartão permanece zero.
- Given compra no cartão criada pela aba Custos com `origin = MANUAL` e `card_id`, when consultar Dashboard, then custo de vida e compras de cartão aumentam.
- Given compra parcelada em 3 meses, when filtrar cada mês, then apenas a parcela daquele mês entra no Dashboard.
- Given pagamento de fatura ou transferência interna confirmada, when calcular Dashboard, then custo de vida não aumenta.
- Given despesa pendente ou cancelada, when calcular Dashboard, then ela não entra em totais confirmados e pendente aparece separada.
- Given usuário A autenticado, when existirem transações do usuário B, then nenhum indicador do Dashboard de A inclui dados de B.
- Given API recebe query de período inválida, when chamar `/api/dashboard`, then retorna erro 400 sem consultar dados fora do escopo.

## Spec Change Log

## Design Notes

A Etapa 2 escolheu corretamente `origin = MANUAL` para indicar origem de lançamento manual. Portanto, no Dashboard, “compra de cartão” não pode ser inferida só de `origin`; deve considerar `card_id` preenchido ou vínculo em `card_installments`, mantendo `origin = CARTAO` apenas como compatibilidade para dados importados/históricos futuros.

Dados históricos estáticos podem continuar em outras abas até a importação oficial. No Dashboard desta etapa, se a API local estiver indisponível, exibir erro claro em vez de voltar silenciosamente para `finance-data.ts`.

## Verification

**Commands:**
- `git diff --check` -- expected: sem whitespace inválido.
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:verify` -- expected: schema válido.
- `npm.cmd run test` -- expected: testes de Dashboard, API e regressão passam.
- `npm.cmd run build` -- expected: build Vinext passa, se não tiver sido executado por `npm test`.

## Suggested Review Order

**Entrada e contrato**

- Comece pelo endpoint local que alimenta a tela.
  [`local-api-server.mjs:23`](../../scripts/local-api-server.mjs#L23)

- Confira a validacao de periodo para mes ou ano inteiro.
  [`local-api-server.mjs:65`](../../scripts/local-api-server.mjs#L65)

**Regras financeiras**

- Verifique a regra que reconhece cartao por `origin` ou `cardId`.
  [`dashboard-rules.ts:122`](../../lib/dashboard-rules.ts#L122)

- Confira o overview consolidado com escopo por usuario.
  [`dashboard-repository.ts:66`](../../lib/dashboard-repository.ts#L66)

- Revise a serie mensal derivada de `transactions`.
  [`dashboard-repository.ts:151`](../../lib/dashboard-repository.ts#L151)

**Interface**

- Veja a validacao do payload antes de renderizar KPIs.
  [`page.tsx:176`](../../app/page.tsx#L176)

- Revise o Dashboard conectado a API local.
  [`page.tsx:197`](../../app/page.tsx#L197)

- Confira estados vazios e barras do Dashboard.
  [`globals.css:422`](../../app/globals.css#L422)

**Testes**

- Caso principal: banco vazio, parcelas, pendencias e isolamento.
  [`dashboard-api.test.mjs:53`](../../tests/dashboard-api.test.mjs#L53)

- Regressao da regra para cartao manual.
  [`dashboard-rules.test.mjs:111`](../../tests/dashboard-rules.test.mjs#L111)
