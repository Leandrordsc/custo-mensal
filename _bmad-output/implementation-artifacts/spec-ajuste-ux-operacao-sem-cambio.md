---
title: "Ajuste UX - operacao de ativos sem cambio"
type: "feature"
created: "2026-08-28"
status: "done"
route: "one-shot"
---

# Ajuste UX - operacao de ativos sem cambio

## Intent

**Problem:** O formulario de compra/venda ainda exibia cambio, embora a compra de ativo dos EUA deva ser registrada em USD e a conversao para BRL pertenca ao fluxo separado de cambio. Tambem faltava uma forma simples de informar custos adicionais da operacao.

**Approach:** Remover o campo de cambio do formulario de operacao e manter a aba Cambio como dona da cotacao USD/BRL. Adicionar "Outros custos" apenas em compras, somando esse valor ao total enviado para a API existente.

## Suggested Review Order

**Estado do Formulario**

- Estado mantem apenas custos extras, removendo campos nao digitados.
  [`page.tsx:118`](../../app/page.tsx#L118)

- Reset do formulario acompanha o novo conjunto enxuto de campos.
  [`page.tsx:201`](../../app/page.tsx#L201)

**Payload**

- Total enviado soma quantidade, preco e custos extras de compra.
  [`page.tsx:754`](../../app/page.tsx#L754)

- Payload nao recebe cambio digitado pela operacao.
  [`page.tsx:762`](../../app/page.tsx#L762)

**Interface**

- Campo "Outros custos" substitui cambio dentro de compra/venda.
  [`page.tsx:870`](../../app/page.tsx#L870)

**Testes**

- Teste garante presenca de custos extras e ausencia de cambio no formulario.
  [`rendered-html.test.mjs:108`](../../tests/rendered-html.test.mjs#L108)
