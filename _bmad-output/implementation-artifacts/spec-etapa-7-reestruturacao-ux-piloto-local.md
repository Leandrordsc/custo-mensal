---
title: "Etapa 7 - Reestruturacao UX do piloto local"
type: "ux-improvement"
created: "2026-08-28"
status: "done"
baseline_commit: "5a3c44272f6c4144de9d8948d9c8950fed4897e9"
review_loop_iteration: 0
context:
  - "_bmad-output/planning-artifacts/PRD.md"
  - "_bmad-output/planning-artifacts/DASHBOARD_RULES.md"
  - "_bmad-output/implementation-artifacts/spec-etapa-6-cadastro-manual-ativos-operacoes-precos-cambio.md"
---

# Etapa 7 - Reestruturacao UX do piloto local

## Intencao congelada

Evoluir a interface atual do piloto local para uma experiencia mais profissional de controle financeiro pessoal, preservando as regras financeiras, o modelo de dados e os fluxos ja implementados.

A revisao de UX identificou que a aplicacao esta funcional, mas ainda parece um painel tecnico de piloto: baixa hierarquia visual, navegacao desktop sem alternativa clara no mobile, dashboard com blocos pouco organizados, area de Ativos e Proventos concentrando muitas acoes em uma unica tela, formularios sem feedback positivo claro e estados vazios pouco acionaveis.

Esta etapa deve melhorar a apresentacao, navegacao, densidade, responsividade e clareza operacional sem transformar a aplicacao em landing page e sem iniciar novas regras de negocio.

## Fora do escopo desta etapa

- Alterar migrations, schema Drizzle ou dados seed.
- Alterar regras financeiras do Dashboard.
- Alterar semantica de `nature`, `subtype`, `origin` ou `classification_status`.
- Criar endpoints novos obrigatorios.
- Implementar autenticacao real.
- Implementar importacao da planilha.
- Criar CRUD completo de ativos ou carteira alem do que ja existe.
- Publicar a aplicacao.

## Regras de preservacao

- `transactions` continua sendo a fonte financeira principal.
- Pagamento de fatura e transferencia interna continuam sem gerar despesa duplicada.
- Cashback confirmado e estimado continuam visualmente distintos.
- Ativos BRL e USD continuam separados, com consolidado em BRL quando houver cambio.
- Dados historicos, cartoes historicos e funcionalidades ja existentes nao devem ser removidos.
- A interface deve continuar em portugues do Brasil, com moeda BRL/USD e datas no padrao brasileiro.

## Escopo funcional de UX

### 1. Shell e navegacao

Reestruturar o shell principal em `app/page.tsx` para deixar a aplicacao com cara de produto operacional:

- menu lateral desktop mais claro;
- navegacao mobile acessivel para todas as secoes;
- cabecalho contextual por pagina;
- filtros globais de ano/periodo com melhor organizacao;
- remover a sensacao de hero/landing sempre presente em todas as telas.

### 2. Dashboard

Reorganizar o Dashboard em blocos de leitura:

- Resumo do mes;
- Saidas e movimentacoes;
- Cartoes;
- Investimentos e patrimonio;
- Proventos, cashback e rendimentos;
- Pendencias;
- Evolucao mensal.

Os indicadores devem distinguir claramente valores contabilizados, estimados, movimentacoes internas e pendencias.

### 3. Ativos e Proventos

Reorganizar a tela atual em abas internas:

- Carteira;
- Operacoes;
- Cotacoes;
- Cambio;
- Proventos.

As abas devem reduzir a sobrecarga visual, mantendo os formularios e tabelas ja existentes. A etapa nao deve criar novas regras de calculo.

### 4. Formularios

Melhorar a ergonomia dos formularios existentes:

- agrupamento visual por finalidade;
- labels mais diretos;
- feedback de sucesso apos salvar;
- erro visivel e especifico quando a API retornar falha;
- botoes com estado de carregamento;
- campos monetarios preservando prefixo visual de moeda quando aplicavel.

### 5. Estados vazios e alertas

Substituir mensagens genericas por estados vazios acionaveis:

- Dashboard sem dados;
- Cartoes sem compras;
- Ativos sem carteira;
- Cotacao/cambio pendente;
- Proventos sem registros.

Cada estado vazio deve orientar a proxima acao possivel sem texto longo de tutorial.

### 6. Tabelas e indicadores

Refinar componentes visuais existentes:

- tabelas com melhor leitura, densidade e cabecalho;
- badges para moeda, status, tipo de ativo, cartao historico e valores estimados;
- KPIs com hierarquia entre primarios e secundarios;
- evitar cards aninhados;
- manter responsividade sem texto sobreposto.

## Arquivos previstos

- `app/page.tsx`
  - reorganizar shell, navegacao, Dashboard, Ativos e Proventos e estados de UI.
- `app/globals.css`
  - atualizar sistema visual, responsividade, abas, badges, tabelas, feedbacks e layout.
- `tests/rendered-html.test.mjs`
  - ajustar verificacoes de estrutura renderizada e marcadores de UX.
- Testes adicionais existentes somente se precisarem acompanhar mudanca de markup.

Nao ha previsao de alterar:

- `db/`;
- `drizzle/`;
- `scripts/migrate-local.mjs`;
- `scripts/local-api-server.mjs`;
- `lib/*` de regras financeiras.

## Criterios de aceite

### CA-01 - Navegacao desktop e mobile

Dado que o usuario acessa a aplicacao,
quando a tela for desktop ou mobile,
entao as secoes Dashboard, Custos, Cartoes e Ativos e Proventos devem estar acessiveis sem depender apenas do menu lateral desktop.

### CA-02 - Dashboard organizado por decisao financeira

Dado que o usuario visualiza o Dashboard,
quando houver dados persistidos,
entao os indicadores devem estar agrupados em blocos que separem custo de vida, cartoes, investimentos, proventos, cashback/rendimentos, movimentacoes internas e pendencias.

### CA-03 - Sem dupla contagem visual

Dado que o Dashboard exibe compras, pagamentos de fatura e transferencias internas,
quando os valores forem apresentados,
entao pagamentos de fatura e transferencias devem aparecer como movimentacoes, nao como novo custo de vida.

### CA-04 - Ativos e Proventos com abas

Dado que o usuario acessa Ativos e Proventos,
quando a tela carregar,
entao deve haver abas internas para Carteira, Operacoes, Cotacoes, Cambio e Proventos.

### CA-05 - Feedback de formulario

Dado que o usuario envia um formulario manual existente com sucesso,
quando a API responder sem erro,
entao a tela deve apresentar feedback de sucesso e recarregar os dados relevantes.

### CA-06 - Erros visiveis

Dado que uma chamada de API falha,
quando o erro for capturado,
entao a interface deve exibir mensagem visivel sem quebrar a pagina.

### CA-07 - Estados vazios acionaveis

Dado que uma area nao possui dados,
quando ela for exibida,
entao o estado vazio deve informar a situacao e apontar uma acao coerente dentro da tela.

### CA-08 - Currencies e estimativas

Dado que ha valores BRL, USD, cashback real e cashback estimado,
quando forem exibidos,
entao a UI deve diferenciar moeda e natureza confirmada/estimada sem misturar saldos reais com estimativas.

### CA-09 - Regressao tecnica

Dado que a mudanca e visual,
quando os testes e build forem executados,
entao lint, typecheck, testes e build devem continuar passando sem alterar migrations ou regras financeiras.

## Plano de implementacao

1. Ajustar shell principal e navegacao responsiva.
2. Reorganizar Dashboard em blocos financeiros claros.
3. Criar abas internas na tela Ativos e Proventos.
4. Melhorar formularios com feedback de sucesso, erro e carregamento.
5. Refinar estados vazios, badges, tabelas e KPIs.
6. Atualizar testes de markup/renderizacao.
7. Rodar verificacoes finais.

## Verificacao prevista

- `git diff --check`
- `npm.cmd run lint`
- `npm.cmd exec tsc -- --noEmit`
- `npm.cmd run test`
- `npm.cmd run build`

## Pendencias e decisoes em aberto

- Validar se a tela "FIIs - Dividendos" legada deve permanecer visivel como historico separado ou ser totalmente absorvida por "Ativos e Proventos" nesta etapa. Recomendacao: manter a funcionalidade existente acessivel, mas reduzir sua proeminencia visual.
- Validar se os filtros globais devem continuar no topo para todas as telas ou se parte deles deve ser contextual por secao. Recomendacao: manter ano global no topo e filtros especificos dentro de cada secao.

## Checkpoint BMAD

Esta especificacao requer aprovacao antes de qualquer alteracao de codigo.

[A] Aprovar e implementar a Etapa 7
[E] Editar a especificacao antes de implementar

## Suggested Review Order

**Shell e Navegacao**

- Entrada principal mostra a nova estrutura operacional da aplicacao.
  [`page.tsx:227`](../../app/page.tsx#L227)

- Navegacao mobile evita dependencia exclusiva do menu lateral.
  [`page.tsx:254`](../../app/page.tsx#L254)

- Estilos do shell refinam marca, topo, mobile nav e estados desabilitados.
  [`globals.css:144`](../../app/globals.css#L144)

**Dashboard**

- Resumo separa saidas, cartoes, aportes e dividendos sem recalcular dominio.
  [`page.tsx:356`](../../app/page.tsx#L356)

- Bloco de cartoes explicita compra, fatura e cashback sem dupla contagem.
  [`page.tsx:359`](../../app/page.tsx#L359)

- Pendencias ficam separadas de valores financeiros confirmados.
  [`page.tsx:379`](../../app/page.tsx#L379)

**Ativos e Formularios**

- Tela de Ativos usa abas internas com semantica acessivel.
  [`page.tsx:797`](../../app/page.tsx#L797)

- Carteira e Proventos ganharam estados vazios por aba.
  [`page.tsx:860`](../../app/page.tsx#L860)

- Formularios exibem feedback de sucesso apos salvar dados.
  [`page.tsx:526`](../../app/page.tsx#L526)

**Acabamento e Testes**

- CSS adiciona tabs, banners, tabelas e estados vazios mais legiveis.
  [`globals.css:484`](../../app/globals.css#L484)

- Testes prendem os principais marcadores da nova UX.
  [`rendered-html.test.mjs:93`](../../tests/rendered-html.test.mjs#L93)
