# Regras do Dashboard

## Objetivo

O Dashboard e a primeira entrega. Ele deve apresentar saidas e movimentacoes do mes sem dupla contagem, usando `transactions` como livro financeiro principal e fonte unica dos totais confirmados.

Tabelas especializadas como `dividend_events`, `cashback_events`, `reserve_earnings` e `investment_events` apenas detalham eventos. Seus valores nao devem ser somados novamente se ja existe `transaction` correspondente.

## Classificacao usada

### nature

- `DESPESA`
- `RECEITA`
- `TRANSFERENCIA`
- `INVESTIMENTO`

### subtype

- `COMPRA`
- `APORTE`
- `REINVESTIMENTO`
- `PAGAMENTO_FATURA`
- `TRANSFERENCIA_RESERVA`
- `DIVIDENDO`
- `CASHBACK`
- `RENDIMENTO`
- `AJUSTE`

### origin

- `CONTA`
- `CARTAO`
- `CAIXINHA`
- `IMPORTACAO`
- `MANUAL`

### classification_status

- `CONFIRMADO`
- `ESTIMADO`
- `PENDENTE_REVISAO`
- `REJEITADO`

Categorias permanecem separadas e definem, entre outros usos, se uma despesa entra em custo de vida.

## Filtros por periodo

Filtros minimos:
- ano;
- mes;
- intervalo customizado futuro;
- cartao;
- conta;
- categoria;
- natureza;
- subtipo.

Todos os indicadores confirmados usam apenas `classification_status = CONFIRMADO` e `transaction_status = ACTIVE`.

## Indicadores e formulas

### Custo de vida

Origem: `transactions`.

Filtro:

```text
nature = DESPESA
classification_status = CONFIRMADO
transaction_status = ACTIVE
category.counts_as_living_cost = true
```

Formula:

```text
custo_de_vida = soma(amount_cents)
```

Inclui compra/cartao quando representar consumo. Exclui pagamento de fatura, transferencias, aportes, reinvestimentos, dividendos, cashback e rendimentos.

### Compras de cartao

Filtro:

```text
nature = DESPESA
subtype = COMPRA
origin = CARTAO
classification_status = CONFIRMADO
```

Formula:

```text
compras_cartao = soma(amount_cents)
```

Cada parcela e uma despesa no `statement_month` correspondente.

### Pagamento de fatura

Filtro:

```text
nature = TRANSFERENCIA
subtype = PAGAMENTO_FATURA
classification_status = CONFIRMADO
```

Efeito:

```text
impacto_custo_de_vida = 0
```

O pagamento liquida a fatura/cartao e pode debitar conta de origem, mas nao cria nova despesa quando compras/parcelas ja foram contabilizadas.

### Transferencias internas

Filtro:

```text
nature = TRANSFERENCIA
classification_status = CONFIRMADO
```

Efeito:

```text
patrimonio_consolidado = inalterado
source_account_balance -= amount_cents
target_account_balance += amount_cents
```

Transferencias entre contas, inclusive para caixinhas, nao entram em custo de vida.

### Saldo das caixinhas

Origem: `accounts` + `transactions`.

Formula:

```text
saldo_final =
  opening_balance_cents
  + entradas_confirmadas
  - saidas_confirmadas
```

Entradas/saidas sao transacoes confirmadas que tenham a caixinha como `target_account_id` ou `source_account_id`. Transferencias alteram saldo individual da conta, mas nao patrimonio total.

### Aportes

Filtro:

```text
nature = INVESTIMENTO
subtype = APORTE
classification_status = CONFIRMADO
```

Formula:

```text
aportes = soma(amount_cents)
```

Aparece em bloco proprio, fora de custo de vida.

### Reinvestimentos

Filtro:

```text
nature = INVESTIMENTO
subtype = REINVESTIMENTO
classification_status = CONFIRMADO
```

Formula:

```text
reinvestimentos = soma(amount_cents)
```

Aparece em bloco proprio e nao entra em custo de vida.

### Receitas financeiras confirmadas

Dividendos:

```text
dividendos = soma(transactions.amount_cents)
where nature = RECEITA
and subtype = DIVIDENDO
and classification_status = CONFIRMADO
```

Cashback real:

```text
cashback_real = soma(transactions.amount_cents)
where nature = RECEITA
and subtype = CASHBACK
and classification_status = CONFIRMADO
```

Rendimentos:

```text
rendimentos = soma(transactions.amount_cents)
where nature = RECEITA
and subtype = RENDIMENTO
and classification_status = CONFIRMADO
```

### Cashback estimado

Origem: regra vigente em `card_rules` e compras elegiveis.

Formula:

```text
cashback_estimado = soma(compras_elegiveis.amount_cents * cashback_rate_bps / 10000)
```

Regras:
- Deve aparecer separado.
- Nunca entra em saldo, patrimonio ou total confirmado.
- Se existir registro em `cashback_events`, deve ter `value_type = ESTIMADO` e `contabilizable = false`.
- Cashback estimado nao deve possuir `transaction_id`.
- Cashback real deve possuir `transaction_id`, `value_type = REAL` e `contabilizable = true`; o valor confirmado deve ser somado por `transactions`.

### Cotacao defasada

Origem: `asset_prices`.

Regra:
- Ativos negociados em bolsa: defasado quando `fetched_at` tiver mais de 24 horas em dia util ou quando a ultima tentativa de atualizacao falhar.
- Renda fixa/manual: defasado quando passar de 30 dias, salvo regra configurada.

### Media mensal de dividendos

Formula correta para media do periodo:

```text
media_mensal_dividendos_periodo =
  total_dividendos_confirmados_no_periodo / quantidade_de_meses_do_periodo
```

Meses sem dividendos entram no denominador. Se houver outro indicador usando apenas meses com recebimento, ele deve se chamar `media_por_mes_com_recebimento`.

### Pendencias e rejeitados

Pendentes:

```text
pendencias = import_rows ou transactions com classification_status = PENDENTE_REVISAO
```

Rejeitados:

```text
rejeitados = import_rows ou transactions com classification_status = REJEITADO
```

Nenhum dos dois entra em totais confirmados.

## Regras para evitar dupla contagem

1. Somar totais confirmados apenas a partir de `transactions`.
2. Nunca somar simultaneamente `transactions` e tabela especializada do mesmo evento.
3. Compra no cartao pode ser despesa.
4. Pagamento da fatura e transferencia para caixinha nao criam nova despesa.
5. Transferencia entre contas nao altera patrimonio consolidado.
6. Cashback estimado nao altera saldo nem patrimonio confirmado.
7. Pendentes e rejeitados nao entram em totais confirmados.
8. Rollbacks/cancelamentos deixam de afetar Dashboard por `transaction_status`.

## Origem dos valores

| Indicador | Fonte financeira principal | Extensao/detalhe | Origem historica |
| --- | --- | --- | --- |
| Custo de vida | `transactions` | `categories` | Abas 2020-2026 |
| Compras cartao | `transactions` | `card_purchases`, `card_installments` | Aba Cartao e abas anuais |
| Pagamento fatura | `transactions` | `card_statements` | Aba Cartao e abas anuais |
| Caixinhas | `transactions`, `accounts` | `reserve_earnings` | Cartao, Investimentos |
| Cashback real | `transactions` | `cashback_events` | Cartao |
| Cashback estimado | Calculo | `card_rules`, `cashback_events` nao contabilizavel | Cartao |
| Rendimentos | `transactions` | `reserve_earnings` | Cartao |
| Dividendos | `transactions` | `dividend_events` | FIIS - Dividendos |
| Aportes/reinvestimentos | `transactions` | `investment_events` | Abas anuais e Investimentos |
| Pendencias | `import_rows`, `transactions` | `classification_rules` | Qualquer aba |

## Exemplos praticos

### Compra no cartao e pagamento de fatura

```text
Compra Mercado Pago: R$ 100,00
nature = DESPESA, subtype = COMPRA, origin = CARTAO

Transferencia para caixinha: R$ 100,00
nature = TRANSFERENCIA, subtype = TRANSFERENCIA_RESERVA

Pagamento da fatura: R$ 100,00
nature = TRANSFERENCIA, subtype = PAGAMENTO_FATURA

Custo de vida confirmado: R$ 100,00, nao R$ 300,00.
```

### Compra antes/depois do fechamento

```text
Cartao fecha dia 20.
Compra em 19/06: primeira parcela entra em statement_month 2026-06.
Compra em 21/06: primeira parcela entra em statement_month 2026-07.
```

### Cashback

```text
Compra BTG elegivel: R$ 1.000,00.
Regra BTG: 1%.
Cashback estimado: R$ 10,00, nao contabilizavel.
Cashback real recebido: R$ 9,80, transaction RECEITA/CASHBACK/CONFIRMADO.
```

### Reinvestimento

```text
Dividendo recebido: R$ 300,00 -> RECEITA/DIVIDENDO.
Compra de FII com esse valor -> INVESTIMENTO/REINVESTIMENTO.
Custo de vida: R$ 0,00.
```

## Criterios de aceite do Dashboard

| ID | Criterio |
| --- | --- |
| DASH-CA-01 | Dado pagamento de fatura confirmado, quando calcular custo de vida, entao ele nao duplica compra/parcela ja contabilizada. |
| DASH-CA-02 | Dada transferencia para caixinha, quando calcular custo de vida, entao ela nao aumenta despesa. |
| DASH-CA-03 | Dado cashback real e estimado, quando exibir Dashboard, entao eles aparecem separados. |
| DASH-CA-04 | Dado cashback estimado, quando calcular saldo/patrimonio, entao ele nao entra em totais confirmados. |
| DASH-CA-05 | Dado reinvestimento, quando exibir Dashboard, entao ele aparece fora de custo de vida. |
| DASH-CA-06 | Dadas pendencias e rejeitados, quando calcular totais confirmados, entao eles nao entram nos indicadores finais. |
| DASH-CA-07 | Dado filtro de periodo, quando alterar mes/ano, entao todos os indicadores recalculam pelo mesmo periodo. |
| DASH-CA-08 | Dada transferencia entre contas, quando calcular patrimonio, entao patrimonio consolidado permanece igual. |
| DASH-CA-09 | Dada caixinha com saldo inicial e transacoes confirmadas, quando calcular saldo, entao aplica saldo inicial + entradas - saidas. |
| DASH-CA-10 | Dado evento especializado com `transaction_id`, quando calcular Dashboard, entao o valor e somado uma vez por `transactions`. |
| DASH-CA-11 | Dado periodo com meses sem dividendos, quando calcular media mensal de dividendos, entao todos os meses do periodo entram no denominador. |

## Matriz de rastreabilidade

| Requisito | Regra | Entidade | Documento | Criterio |
| --- | --- | --- | --- | --- |
| RF-04 | Separar indicadores por eixos | `transactions`, `categories` | PRD.md | DASH-CA-03, DASH-CA-05 |
| RF-05 | Nature/subtype/origin/status | `transactions` | DATA_MODEL.md | DASH-CA-06 |
| RF-06 | Fatura nao duplica | `transactions`, `card_statements` | PRD.md | DASH-CA-01 |
| RF-07 | Transferencia de reserva neutra | `accounts`, `transactions` | DATA_MODEL.md | DASH-CA-02, DASH-CA-08 |
| RF-10 | Cashback real/estimado | `card_rules`, `cashback_events` | DATA_MODEL.md | DASH-CA-03, DASH-CA-04 |
| RF-14 | Dividendos | `transactions`, `dividend_events` | DATA_MODEL.md | DASH-CA-11 |
| RF-22 | Livro financeiro principal | `transactions` | PRD.md | DASH-CA-10 |
| RF-24 | Saldos derivados | `accounts`, `transactions` | DATA_MODEL.md | DASH-CA-08, DASH-CA-09 |
