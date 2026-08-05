# Atlas Financeiro — Controle de Custos

Módulo web de Controle de Custos criado a partir da lógica da planilha **Custo Mensal.xlsx**.

A proposta não é reproduzir a planilha, mas transformar sua estrutura em uma aplicação moderna para o Atlas Financeiro, com dashboard, cartões, orçamentos, lançamentos, gráficos e sinais informativos do Radar Financeiro.

## Funcionalidades desta versão

- Dashboard com indicadores principais:
  - gasto do mês;
  - gasto anual;
  - média mensal;
  - maior categoria;
  - maior cartão;
  - saldo disponível;
  - economia do mês;
  - comparação com mês anterior.
- Visualização de gastos por categoria.
- Evolução mensal em gráfico de barras.
- Heatmap de dias com maior gasto.
- Listagem de lançamentos com ações de editar, duplicar e excluir.
- Área de orçamento por categoria com alerta visual.
- Controle visual de cartões, limite, fechamento e vencimento.
- Botões de importação e exportação previstos na interface.
- Radar Financeiro com mensagens informativas.
- Layout responsivo com suporte a modo claro e escuro.

## Tecnologias

- React
- Vinext
- TypeScript
- Tailwind CSS
- Drizzle ORM, preparado para futuras migrações
- Sites / Cloudflare Worker compatible build

## Requisitos

- Node.js `>=22.13.0`
- npm

## Como rodar localmente

Instale as dependências:

```bash
npm install
```

Inicie o servidor local:

```bash
npm run dev
```

Depois acesse:

```text
http://localhost:3000
```

## Como gerar build

```bash
npm run build
```

## Estrutura principal

- `app/page.tsx`: página principal do módulo de Controle de Custos.
- `app/globals.css`: estilos globais, tema claro/escuro, cards, gráficos e layout.
- `app/layout.tsx`: metadados e estrutura base da aplicação.
- `db/schema.ts`: ponto de partida para modelagem futura do banco.
- `.openai/hosting.json`: configuração de publicação no Sites.

## Modelo de dados planejado

O módulo foi pensado para evoluir com tabelas normalizadas:

- `expenses`
- `expense_categories`
- `expense_subcategories`
- `cards`
- `accounts`
- `budgets`

Essas tabelas devem permitir lançar despesas, vincular cartões e contas, controlar orçamento por categoria, tratar parcelamentos e registrar recorrências.

## Observações

- A planilha original foi usada apenas como referência inicial.
- A aplicação não depende da planilha em tempo de execução.
- Dados reais devem ser migrados futuramente para banco de dados.
- As mensagens do Radar Financeiro são informativas e não devem ser tratadas como recomendação financeira.

## Publicação

O projeto também está preparado para publicação via Sites.

Repositório GitHub:

```text
https://github.com/Leandrordsc/custo-mensal
```
