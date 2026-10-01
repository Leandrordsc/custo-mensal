---
title: "Ajuste UX - fundo, cores e inclusao de ativos"
type: "feature"
created: "2026-08-28"
status: "done"
route: "one-shot"
---

# Ajuste UX - fundo, cores e inclusao de ativos

## Intent

**Problem:** A interface ja estava mais organizada, mas o fundo e as cores ainda pareciam simples demais. A opcao para incluir ativos existia dentro de Operacoes, porem nao estava evidente para uso exploratorio.

**Approach:** Refinar a base visual com fundo em camadas sutis, variaveis de tema claro/escuro e botoes mais consistentes. Adicionar uma acao primaria "Incluir ativo" na tela de Ativos e Proventos, levando diretamente ao fluxo de novo ativo.

## Suggested Review Order

**Inclusao de Ativos**

- Header da tela mostra a acao primaria de inclusao.
  [`page.tsx:795`](../../app/page.tsx#L795)

- Clique leva direto para novo ativo, nao para ativo existente vazio.
  [`page.tsx:690`](../../app/page.tsx#L690)

- Estado vazio reforca a primeira acao disponivel.
  [`page.tsx:814`](../../app/page.tsx#L814)

**Fundo e Cores**

- Variaveis controlam paleta e adaptacao claro/escuro.
  [`globals.css:3`](../../app/globals.css#L3)

- Fundo usa camadas sutis sem mudar regras de layout.
  [`globals.css:46`](../../app/globals.css#L46)

- Acoes de cabecalho recebem alinhamento responsivo.
  [`globals.css:275`](../../app/globals.css#L275)

**Testes**

- Teste prende a presenca dos CTAs de inclusao de ativos.
  [`rendered-html.test.mjs:108`](../../tests/rendered-html.test.mjs#L108)
