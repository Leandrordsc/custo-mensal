---
title: "Ajuste UX - formulario enxuto de operacao de ativos"
type: "feature"
created: "2026-08-28"
status: "done"
route: "one-shot"
---

# Ajuste UX - formulario enxuto de operacao de ativos

## Intent

**Problem:** O formulario de operacao de ativos ainda exigia muitos campos tecnicos e deixava a inclusao de ativos menos clara. Para o uso exploratorio, o fluxo ideal e escolher compra/venda, tipo do ativo, ativo, preco e quantidade.

**Approach:** Enxugar o formulario visivel, mantendo o payload esperado pela API local. A busca de ativo usa autocomplete local com `datalist`; quando o ticker ja existe no tipo selecionado, a operacao usa o ativo existente; quando nao existe, cria o ativo com defaults de mercado/moeda por tipo.

## Suggested Review Order

**Tipos e Derivacoes**

- Tipos de ativo definem moeda, bolsa e mercado padrao.
  [`page.tsx:18`](../../app/page.tsx#L18)

- Total da operacao e derivado de quantidade e preco.
  [`page.tsx:754`](../../app/page.tsx#L754)

**Fluxo de Inclusao**

- CTA abre Operacoes ja no caminho de novo ativo.
  [`page.tsx:710`](../../app/page.tsx#L710)

- Troca de tipo limpa busca e aplica defaults coerentes.
  [`page.tsx:715`](../../app/page.tsx#L715)

**Formulario**

- Formulario visivel prioriza compra/venda, tipo, ativo, quantidade e preco.
  [`page.tsx:853`](../../app/page.tsx#L853)

- Autocomplete local antecipa futura API de consulta de ativos.
  [`page.tsx:857`](../../app/page.tsx#L857)

**Testes**

- Teste prende os novos rotulos essenciais do formulario enxuto.
  [`rendered-html.test.mjs:108`](../../tests/rendered-html.test.mjs#L108)
