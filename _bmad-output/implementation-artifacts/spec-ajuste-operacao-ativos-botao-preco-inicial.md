---
title: "Ajuste - botao de operacao e preco inicial de ativos"
type: "fix"
created: "2026-09-03"
status: "done"
route: "one-shot"
---

# Ajuste - botao de operacao e preco inicial de ativos

## Intent
**Problem:** O botao de cadastrar operacao aparecia perdido no grid do formulario e ativos recem-cadastrados ficavam com alerta de preco ausente mesmo quando a compra ja tinha preco unitario informado.
**Approach:** Transformar o botao em rodape visual do formulario, trocar alertas de preco para aviso resumido, gravar uma cotacao tecnica `manual_operation` somente em compras, e usar preco medio como estimativa visual quando ainda nao houver cotacao real. Nada cria transaction extra, altera migrations ou muda o schema.

## Suggested Review Order
**Regra de Preco**
- Compra manual gera snapshot de preco sem nova transaction.
  [`investment-service.ts:210`](../../lib/investment-service.ts#L210)
- Snapshot tecnico fica restrito a compras, nao vendas.
  [`investment-service.ts:227`](../../lib/investment-service.ts#L227)
- Ativo sem cotacao usa preco medio como estimativa visual e mantem aviso.
  [`investment-service.ts:533`](../../lib/investment-service.ts#L533)

**UX do Formulario**
- Avisos de cotacao usam texto resumido.
  [`page.tsx:345`](../../app/page.tsx#L345)
- Botao de cadastro fica no rodape do formulario.
  [`page.tsx:906`](../../app/page.tsx#L906)
- Estilo do rodape ocupa a largura do grid.
  [`globals.css:511`](../../app/globals.css#L511)

**Testes**
- Compra valida snapshot, custo total e ausencia de transaction extra.
  [`investments-api.test.mjs:332`](../../tests/investments-api.test.mjs#L332)
- Venda nao cria snapshot automatico.
  [`investments-api.test.mjs:444`](../../tests/investments-api.test.mjs#L444)
- Render prende aviso e rodape visual do submit.
  [`rendered-html.test.mjs:113`](../../tests/rendered-html.test.mjs#L113)
