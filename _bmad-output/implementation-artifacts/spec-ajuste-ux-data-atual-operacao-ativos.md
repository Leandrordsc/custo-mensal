---
title: "Ajuste UX - data atual em operacao de ativos"
type: "feature"
created: "2026-08-28"
status: "done"
route: "one-shot"
---

# Ajuste UX - data atual em operacao de ativos

## Intent

**Problem:** O formulario de compra/venda de ativos iniciava com data e competencia fixas em janeiro de 2026, criando atrito para o uso diario. O usuario ainda precisa manter liberdade para informar operacoes retroativas.

**Approach:** Inicializar data e competencia com a data local atual do navegador, mantendo os campos editaveis. A competencia passou a usar input de mes para reduzir erro de formato sem impedir ajuste manual.

## Suggested Review Order

**Default de Data**

- Helper deriva data e competencia pela data local atual.
  [`page.tsx:200`](../../app/page.tsx#L200)

- Reset do formulario usa o default atual, nao o ano selecionado.
  [`page.tsx:208`](../../app/page.tsx#L208)

**Campos Editaveis**

- Data permanece editavel para operacoes retroativas.
  [`page.tsx:871`](../../app/page.tsx#L871)

- Competencia usa seletor mensal editavel.
  [`page.tsx:872`](../../app/page.tsx#L872)

**Testes**

- Teste evita regressao para data fixa antiga.
  [`rendered-html.test.mjs:108`](../../tests/rendered-html.test.mjs#L108)
