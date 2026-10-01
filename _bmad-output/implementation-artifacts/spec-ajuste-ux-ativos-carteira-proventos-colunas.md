---
title: "Ajuste UX - ativos em colunas de carteira e proventos"
type: "feature"
created: "2026-09-03"
status: "done"
route: "one-shot"
---

# Ajuste UX - ativos em colunas de carteira e proventos

## Intent
**Problem:** A tela Ativos e Proventos ainda usava abas e controles intermediarios que escondiam Carteira e Proventos, deixando a leitura principal mais pesada que o necessario.
**Approach:** Remover a navegacao por abas da area de Ativos, manter Compra/Venda, preco e cambio como acoes expansivas, e exibir Carteira e Proventos sempre visiveis em colunas responsivas. Preservar APIs, schema, migrations e regras financeiras.

## Suggested Review Order
**Fluxo Principal**
- Acoes expansivas substituem abas e abrem apenas um formulario por vez.
  [`page.tsx:728`](../../app/page.tsx#L728)
- Carteira e Proventos ficam sempre visiveis como colunas.
  [`page.tsx:924`](../../app/page.tsx#L924)

**Acessibilidade**
- Botoes de formulario informam `aria-expanded` e `aria-controls`.
  [`page.tsx:859`](../../app/page.tsx#L859)

**Estilos**
- Botoes de acao reaproveitam o padrao visual existente.
  [`globals.css:179`](../../app/globals.css#L179)
- Colunas responsivas evitam encolhimento indevido dos paineis.
  [`globals.css:591`](../../app/globals.css#L591)

**Testes**
- Teste prende a nova estrutura sem abas antigas.
  [`rendered-html.test.mjs:111`](../../tests/rendered-html.test.mjs#L111)
