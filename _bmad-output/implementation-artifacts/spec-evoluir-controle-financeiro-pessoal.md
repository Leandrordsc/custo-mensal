---
title: 'Evoluir custo-mensal para controle financeiro pessoal'
type: 'feature'
created: '2026-08-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '747babf5d9b149704217f73b73d1d24412a6f05a'
context:
  - '{project-root}/README.md'
  - '{project-root}/referencias/Custo Mensal.xlsx'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problema:** O projeto atual é um protótipo visual com dados hardcoded em `app/page.tsx`, sem persistência real, enquanto a planilha `referencias/Custo Mensal.xlsx` contém o histórico financeiro de 2020 a 2026, investimentos, cartões, FIIs, dividendos, metas e fórmulas. A aplicação precisa virar um sistema de controle financeiro pessoal sem misturar despesas com aportes/investimentos e sem reproduzir mecanicamente abas técnicas como `FisWebDriver`.

**Abordagem:** Construir um MVP incremental com Dashboard, Custos, Cartões, Investimentos e FIIs/Dividendos, preservando o histórico importável da planilha e migrando regras de cálculo para dados normalizados. Antes de implementação, validar o recorte, o modelo de dados, a estratégia de importação e as decisões de API de preços.

## Boundaries & Constraints

**Always:** Usar português do Brasil, BRL e datas brasileiras; preservar dados históricos de 2020 em diante; separar despesas, aportes, posições, rendimentos, cashback e dividendos; transformar `Consolidado` em dashboard funcional; substituir `FisWebDriver` por serviço/API de preços; manter funcionalidades existentes salvo justificativa explícita; desenvolver em fases.

**Ask First:** Qual provedor de preços usar; se a base inicial deve ser importada automaticamente do XLSX ou semeada por script revisável; quais lançamentos de abas anuais classificados como investimento devem migrar para investimentos em vez de custos; se cartões antigos como Itaú/Nubank entram no histórico ou só BTG/Mercado Pago no fluxo futuro.

**Never:** Não reproduzir `FisWebDriver` como página; não tratar aportes como despesas operacionais; não apagar UI atual sem substituir por funcionalidade equivalente; não implementar tudo em uma única entrega; não editar código antes de aprovação humana deste planejamento.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Importar custos históricos | Abas 2020-2026 com linhas de despesa e totais mensais | Registros mensais por ano, mês, categoria/origem, mantendo total anual auditável | Linhas vazias e totais são ignoradas; categorias ambíguas vão para fila de revisão |
| Separar aportes | Linhas como `FIIS - AÇÕES - RENDA FIXA`, `Tesouro`, `Reserva de Oportunidade` | Gerar aportes/investimentos, não despesas | Marcar regra de classificação e exigir confirmação se a linha misturar uso pessoal e investimento |
| Atualizar preços | Ativos FIIs/ações/exterior com ticker conhecido | Buscar preço atual por API e recalcular valor atual, valorização e yields | Se API falhar, manter último preço conhecido com timestamp e alerta |
| Fórmula quebrada | `#REF!` ou `#DIV/0!` no XLSX | Não importar erro como dado final; registrar inconsistência | Exibir relatório de importação com célula, aba e tratamento proposto |

</frozen-after-approval>

## Code Map

- `package.json` -- Vinext/React 19, TypeScript, Tailwind 4, Drizzle e Cloudflare; scripts atuais: `dev`, `build`, `test`, `lint`, `db:generate`.
- `app/page.tsx` -- toda a UI atual em um único client component; contém menus Dashboard-like, Custos, Investimentos, Cartões, FIIs e Consolidado, mas com arrays hardcoded.
- `app/globals.css` -- layout responsivo, sidebar, topbar, cards, tabelas e gráficos CSS; base reaproveitável, mas sem sistema de componentes.
- `app/layout.tsx` -- metadata em pt-BR; descrição ainda genérica de controle de custos.
- `db/schema.ts` -- vazio; precisa receber tabelas normalizadas.
- `db/index.ts` -- helper Drizzle para Cloudflare D1, mas `.openai/hosting.json` está com `d1: null`.
- `worker/index.ts` e `vite.config.ts` -- build para Sites/Cloudflare Worker; pronto para asset/image optimization.
- `tests/rendered-html.test.mjs` -- teste herdado de starter, divergente da aplicação atual; espera skeleton/metadata que não correspondem ao código lido.
- `README.md` -- descreve funcionalidades mais amplas que o código atual não implementa totalmente.
- `referencias/Custo Mensal.xlsx` -- fonte histórica e regras de negócio: abas 2020-2026, `Investimentos`, `Cartão`, `FIIS - Dividendos`, `Consolidado`, `FisWebDriver`.

## Tasks & Acceptance

**Execution:**
- [x] `db/schema.ts` -- modelar entidades financeiras normalizadas -- permitir importação histórica e evolução sem hardcode.
- [x] `app/page.tsx` -- decompor protótipo em views/componentes conectados a dados -- reduzir risco do arquivo único e preservar layout atual.
- [x] `app/*` ou rotas server/actions -- criar consultas para dashboard, custos, cartões, investimentos e FIIs -- centralizar regras de cálculo.
- [x] `scripts/import-custo-mensal.*` -- importar XLSX para staging auditável -- preservar histórico e registrar inconsistências.
- [x] `tests/*` -- substituir teste de starter por validações reais -- cobrir totais mensais/anuais e cálculos de carteira.

**Acceptance Criteria:**
- Given histórico importado de 2020 a 2026, when o usuário abre Custos por ano, then vê totais mensais e anual reconciliados com a planilha, sem aportes classificados como despesa.
- Given ativos com quantidade, preço médio, dividendos e preço atual, when o usuário abre FIIs/Dividendos, then vê total recebido, DY, YoC e valorização/desvalorização.
- Given compras de cartão e valores transferidos, when o usuário abre Cartões, then vê fatura, transferido para caixinha, falta transferir, rendimento, cashback e lucro mensal.
- Given API de preços indisponível, when o dashboard carregar, then usa último preço salvo e sinaliza a defasagem.

## Spec Change Log

## Design Notes

O MVP deve tratar a planilha como fonte de importação/auditoria, não como modelo de tela. A normalização recomendada evita repetir uma tabela por ano e permite que dashboard, custos e carteira consultem a mesma base com filtros de período.

## Verification

**Commands:**
- `npm run build` -- passou em 2026-08-11.
- `npm run lint` -- passou em 2026-08-11.
- `npm run test` -- passou em 2026-08-11 com 6 testes.

**Manual checks:**
- Comparar totais anuais das abas 2020-2026 com a importação.
- Conferir se `FIIS - AÇÕES - RENDA FIXA`, reservas e renda fixa não entram como despesa comum.
- Conferir UI mobile/desktop para tabelas largas e KPIs em BRL.

## Suggested Review Order

**Modelo financeiro**

- Comece pelo contrato normalizado que separa custos, cartões, ativos e importação.
  [`schema.ts:3`](../../db/schema.ts#L3)

- Veja a fonte inicial classificada e os helpers de cálculo usados pela UI.
  [`finance-data.ts:108`](../../lib/finance-data.ts#L108)

- Confira o fallback de preços que substitui a aba técnica `FisWebDriver`.
  [`price-service.ts:27`](../../lib/price-service.ts#L27)

**UI e regras**

- Entrada principal: Dashboard vira a leitura funcional do Consolidado.
  [`page.tsx:62`](../../app/page.tsx#L62)

- Custos usa detalhe quando existe e evita fingir granularidade em anos agregados.
  [`page.tsx:85`](../../app/page.tsx#L85)

- Cartões formatam datas brasileiras com guarda contra datas inválidas.
  [`page.tsx:9`](../../app/page.tsx#L9)

**Importação**

- Staging gera JSON auditável com custos, cartões, ativos, dividendos e issues.
  [`import-custo-mensal.mjs:7`](../../scripts/import-custo-mensal.mjs#L7)

**Verificação**

- Testes cobrem totais, separação de aportes, fallback de preço, staging e SSR.
  [`rendered-html.test.mjs:34`](../../tests/rendered-html.test.mjs#L34)

- ESLint ignora artefatos gerados do Sites para focar código-fonte.
  [`eslint.config.mjs:11`](../../eslint.config.mjs#L11)
