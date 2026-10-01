---
title: 'Etapa 6 - Cadastro manual de ativos, operacoes, precos e cambio'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_commit: 'e71e1f9b4230eba15fe899767866bae2c27fd231'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/PRD.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-5-ativos-proventos-multimoeda.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-corrigir-achados-bmad-review-etapa-5.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A aplicacao ja le Ativos e Proventos do SQLite, mas o usuario ainda nao consegue cadastrar ativos, compras, vendas, precos manuais ou cotacao USD/BRL pela interface. Isso obriga edicao direta do banco e impede validar o piloto local com dados reais de acoes, FIIs, ETFs e REITs.

**Approach:** Criar fluxo manual minimo para alimentar a carteira: cadastro/seleção de ativo, registro de compra ou venda, registro de preco atual e registro de cambio USD/BRL. Operacoes financeiras devem gravar `transactions` + `investment_events`; precos e cambio devem gravar tabelas de mercado separadas, sem alterar migrations existentes.

## Boundaries & Constraints

**Always:** Usar `AuthenticatedUserContext`; rejeitar `user_id` enviado pelo cliente; filtrar e validar tudo por `user_id`; manter `transactions` como fonte financeira principal; gravar valores monetarios em centavos na moeda original; gravar quantidade, preco unitario e cambio como decimal em string; suportar ativos BRL e USD; preservar BRL/USD separados e consolidado BRL por cambio persistido; registrar compra como `INVESTIMENTO/APORTE` ou `INVESTIMENTO/REINVESTIMENTO`; registrar venda como `INVESTIMENTO/AJUSTE` com efeito de saida de posicao, sem tratar como receita comum; manter operacoes atomicas.

**Ask First:** Se for necessario nova migration, mudar enum de `subtype`, criar regra fiscal/IR, calcular ganho de capital definitivo, conectar API externa, importar planilha, implementar login real, editar operacoes depois de criadas ou transformar esta etapa em CRUD completo de carteira.

**Never:** Nao alterar migrations `0001`, `0002` ou `0003`; nao misturar compra/venda de ativo com custo de vida; nao contabilizar preco ou cambio como transacao financeira; nao inventar cotacao fixa; nao permitir associar ativo/preco/cambio/transaction de outro usuario; nao somar `investment_events` em paralelo com `transactions` no Dashboard.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Compra de ativo existente | Ativo BRL/USD do usuario, quantidade, preco unitario, valor total, data, tipo `APORTE` ou `REINVESTIMENTO` | Cria `transactions` CONFIRMADO/ACTIVE e `investment_events`; overview passa a mostrar posicao | Erro 400 se ativo nao pertencer ao usuario |
| Compra com novo ativo | Ticker, nome, classe, mercado, moeda e dados da compra | Cria ativo e operacao na mesma transacao SQLite | Rollback integral se qualquer insert falhar |
| Venda parcial | Ativo com posicao acumulada suficiente e quantidade vendida | Cria operacao de venda que reduz quantidade no overview e fica fora de custo de vida | Rejeita venda maior que quantidade disponivel |
| Venda total | Quantidade vendida igual a posicao acumulada | Posicao some ou fica zerada no overview, sem apagar historico | Mantem transacoes historicas |
| Preco manual | Ativo do usuario, preco, data/hora de cotacao, moeda igual ao ativo | Insere `asset_prices` manual; overview usa a cotacao mais recente por `quoted_at` | Rejeita moeda diferente da moeda do ativo |
| Cambio USD/BRL | Taxa, data de referencia, provider manual | Insere `exchange_rates`; Dashboard consolida USD em BRL | Rejeita taxa <= 0 ou par que nao seja USD/BRL nesta etapa |
| Cross-user | Payload usa assetId de outro usuario | Nenhum dado e gravado para o usuario autenticado | API retorna erro e banco permanece igual |

</frozen-after-approval>

## Code Map

- `db/schema.ts` -- ja contem `assets`, `transactions`, `investment_events`, `asset_prices` e `exchange_rates`; a etapa deve reutilizar esse schema sem migration.
- `lib/investment-service.ts` -- leitura atual da carteira; hoje soma `investment_events.quantity_decimal` sem distinguir compra/venda, entao precisa aceitar quantidade negativa ou outro marcador consistente para venda.
- `lib/expense-service.ts` -- padrao local para service com validacao, transacao SQLite `BEGIN IMMEDIATE` e rollback manual.
- `lib/expense-domain.ts` -- reutilizar helpers de data, id e parser monetario quando fizer sentido; se o parser for BRL-only, criar parser decimal/moeda separado para investimentos.
- `scripts/local-api-server.mjs` -- adicionar rotas POST de investimentos, preco e cambio, com `rejectUserId(body)` antes de chamar services.
- `app/page.tsx` -- `InvestmentsConnectedView` em torno de `api/investments/overview`; adicionar formularios compactos para operacao, preco e cambio sem remover a visao conectada existente.
- `tests/investments-api.test.mjs` -- suite principal para ampliar com criacao manual, venda, preco, cambio, atomicidade e cross-user.
- `tests/rendered-html.test.mjs` -- garantir que os novos controles principais aparecem no shell renderizado.

## Tasks & Acceptance

**Execution:**
- [x] `lib/investment-domain.ts` -- criar normalizacao/validacao de entrada para ativo, operacao, preco e cambio, preservando decimal em string e valores em centavos.
- [x] `lib/investment-service.ts` -- adicionar casos de uso `listBases`, `createInvestmentOperation`, `createAssetPrice` e `createExchangeRate`, com transacao atomica e validacao de propriedade por `user_id`.
- [x] `lib/investment-service.ts` -- ajustar leitura de posicao para que vendas reduzam quantidade e custo investido sem afetar custo de vida.
- [x] `scripts/local-api-server.mjs` -- expor `GET /api/investments/bases`, `POST /api/investments/operations`, `POST /api/investments/prices` e `POST /api/investments/exchange-rates`.
- [x] `app/page.tsx` -- incluir formularios pt-BR na aba Ativos e Proventos para compra/venda, preco manual e USD/BRL; recarregar overview apos sucesso.
- [x] `tests/investments-api.test.mjs` e/ou novo teste dedicado -- cobrir matriz de I/O, anti-duplicidade de fonte financeira, isolamento multiusuario e rollback.
- [x] `tests/rendered-html.test.mjs` -- validar presenca dos controles de cadastro manual.

**Acceptance Criteria:**
- Given usuario autenticado e ativo BRL existente, when cadastrar compra confirmada, then uma `transaction` `INVESTIMENTO/APORTE/CONFIRMADO` e um `investment_event` do mesmo usuario sao criados.
- Given compra marcada como reinvestimento, when salvar, then a `transaction` usa subtype `REINVESTIMENTO` e nao altera custo de vida.
- Given venda parcial de ativo, when salvar, then a quantidade da posicao diminui no overview e nenhum valor entra em despesas.
- Given venda maior que a quantidade disponivel, when salvar, then a API retorna erro e nenhuma tabela fica parcialmente alterada.
- Given preco manual de ativo USD, when salvar com moeda USD, then o overview usa esse preco no calculo USD.
- Given preco manual com moeda diferente do ativo, when salvar, then a API rejeita a entrada.
- Given cambio USD/BRL valido, when salvar e abrir Dashboard, then o consolidado BRL passa a converter os valores USD por essa taxa.
- Given payload com `user_id`, when chamar qualquer POST novo, then a API rejeita a requisicao.
- Given assetId de outro usuario, when tentar cadastrar operacao ou preco, then a API rejeita e dados cross-user nao sao associados.

## Spec Change Log

## Design Notes

Venda ainda nao tem regra fiscal confirmada. Para o piloto, ela deve ajustar posicao patrimonial e ficar fora de custo de vida; ganho/prejuizo realizado nao deve ser apresentado como receita confirmada ate termos regra explicita. A implementacao pode usar `investment_events.quantity_decimal` negativo para venda e `transactions.direction = INFLOW`, mantendo `amount_cents` absoluto, desde que os testes prendam esse contrato.

Precos (`asset_prices`) e cambio (`exchange_rates`) sao dados de mercado. Eles alimentam valor atual e consolidado, mas nao entram em `transactions`, saldos ou patrimonio confirmado como eventos financeiros.

## Verification

**Commands:**
- `git diff --check` -- expected: sem whitespace invalido.
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:verify` -- expected: migrations existentes continuam validas.
- `npm.cmd run test` -- expected: suite completa passando.
- `npm.cmd run build` -- expected: build da UI sem erro.

## Suggested Review Order

**Contrato de dominio**

- Normalizacao central protege payloads antes de tocar no banco.
  [`investment-domain.ts:83`](../../lib/investment-domain.ts#L83)

- Valores monetarios viram centavos positivos e seguros.
  [`investment-domain.ts:162`](../../lib/investment-domain.ts#L162)

- Datas impossiveis de cotacao sao rejeitadas cedo.
  [`investment-domain.ts:217`](../../lib/investment-domain.ts#L217)

**Regras financeiras**

- Operacao manual cria ativo, transaction e evento em bloco atomico.
  [`investment-service.ts:204`](../../lib/investment-service.ts#L204)

- Posicoes sao derivadas de eventos confirmados por usuario e periodo.
  [`investment-service.ts:262`](../../lib/investment-service.ts#L262)

- Venda baixa custo medio sem criar despesa ou receita comum.
  [`investment-service.ts:463`](../../lib/investment-service.ts#L463)

- Transaction segue fonte financeira principal do investimento.
  [`investment-service.ts:487`](../../lib/investment-service.ts#L487)

**API local**

- Bases de ativos sao listadas sem aceitar usuario externo.
  [`local-api-server.mjs:36`](../../scripts/local-api-server.mjs#L36)

- POST de operacao rejeita `user_id` antes do service.
  [`local-api-server.mjs:58`](../../scripts/local-api-server.mjs#L58)

**Interface**

- UI carrega bases e overview juntos para formularios conectados.
  [`page.tsx:651`](../../app/page.tsx#L651)

- Submit monta payload unico para compra, venda ou novo ativo.
  [`page.tsx:673`](../../app/page.tsx#L673)

- Formulario fica dentro de Ativos e Proventos com moeda visivel.
  [`page.tsx:761`](../../app/page.tsx#L761)

**Verificacao**

- Testes cobrem compra manual e persistencia ledger/evento.
  [`investments-api.test.mjs:311`](../../tests/investments-api.test.mjs#L311)

- Testes prendem venda total sem sobra patrimonial.
  [`investments-api.test.mjs:452`](../../tests/investments-api.test.mjs#L452)

- Render/source test garante entrada visual dos controles.
  [`rendered-html.test.mjs:107`](../../tests/rendered-html.test.mjs#L107)
