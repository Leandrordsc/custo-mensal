---
title: 'Consistencia da interface, busca e filtros'
type: 'bugfix'
created: '2026-09-30'
status: 'done'
baseline_commit: 'c308f0060599876b886ad59eef4d7a3693673b83'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/ARCHITECTURE.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A busca global apenas armazena texto, o ano selecionado diverge na tela de Cartoes, Ativos nao permite recorte mensal e alguns rotulos e alertas comunicam estados incorretos. Isso faz controles visiveis parecerem desconectados dos dados exibidos.

**Approach:** Tornar a busca aplicavel as listas da area ativa, limpando-a ao navegar, compartilhar o ano global com todas as telas, oferecer periodo mensal em Ativos e ajustar rotulos e tons conforme o estado real, preservando os contratos atuais da API.

## Boundaries & Constraints

**Always:** Manter SQLite e os endpoints atuais como fonte; filtrar somente linhas e colecoes detalhadas, mantendo KPIs, graficos e totais como agregados do periodo; normalizar busca com `trim`, espacos colapsados, minusculas e remocao de acentos; tratar cada termo como substring obrigatoria (AND) sobre o texto combinado dos campos; converter `null` e `undefined` em texto vazio; limpar a consulta ao trocar de area; ano e periodo devem disparar a recarga existente; uma resposta antiga nunca pode sobrescrever o filtro mais recente; preservar e distinguir carregamento, erro, ausencia de dados e ausencia de correspondencias.

**Ask First:** Qualquer alteracao de schema, formato de resposta da API ou regra financeira; inclusao de dependencia; mudanca destrutiva em dados locais.

**Never:** Implementar importacao ou exportacao nesta rodada; apagar ou reclassificar lancamentos; criar busca remota; transformar avisos de cotacao em falhas bloqueantes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Busca vazia | Campo vazio ou apenas espacos | Todas as linhas recebidas permanecem visiveis | N/A |
| Busca textual | Um ou mais termos com caixa, acento ou espacos diferentes | Custos pesquisa descricao, categoria, conta/cartao, meio e status; Cartoes pesquisa cartao, emissor, descricao e competencia; Ativos pesquisa ticker, nome, classe e moeda | Sem correspondencias exibe mensagem propria somente depois do carregamento e sem erro |
| Troca de area | Busca preenchida e clique em outra area | Campo e filtro sao limpos antes de exibir a nova area | N/A |
| Ano global | Alteracao entre os anos presentes em `annualCostSheets` e o ano civil corrente | Dashboard, Custos, Cartoes e Ativos usam o mesmo ano; o seletor local de Cartoes e removido | Erro da API permanece visivel na area ativa |
| Periodo de ativos | `all` inicialmente ou mes numerico de 1 a 12 | Endpoint recebe `year` e `month`; posicao representa o fechamento do periodo retornado e proventos respeitam `fromMonth/toMonth` | Mantem formularios, ignora resposta obsoleta e exibe erro existente |
| Aviso de cotacao | Alerta ja classificado pela API como ausente ou defasado | Mensagem usa `warning-banner` com `role="status"`, texto explicito e sem depender apenas de cor | N/A |

</frozen-after-approval>

## Code Map

- `app/page.tsx:243` -- `Home` concentra navegacao, busca e ano; `setActive` deve passar por um handler que tambem limpe a busca, e `years` deve ser a uniao ordenada dos anos importados com o ano civil corrente.
- `app/page.tsx:358` -- `DashboardView` conhece o periodo e deve produzir rotulo anual ou mensal coerente.
- `app/page.tsx:452` -- `CostsView` recebe `search`, filtra `expenses` para a tabela e preserva resumo e categorias agregados.
- `app/page.tsx:641` -- `CardsViewConnected` recebe `year` e `search`, remove o ano local e filtra cartoes, compras e movimentos sem alterar KPIs.
- `app/page.tsx:710` -- `InvestmentsConnectedView` recebe `search`, torna `month` editavel com `all` e 1-12, filtra posicoes/proventos e descarta respostas obsoletas.
- `app/page.tsx:981` -- `DataTable` deve aceitar mensagem de vazio contextual para distinguir ausencia de dados de ausencia de correspondencias.
- `app/globals.css:535` -- estilos existentes incluem `warning-banner` para alertas nao bloqueantes.
- `lib/ui-search.ts` -- novo helper puro para normalizacao e correspondencia textual reutilizavel.
- `tests/ui-search.test.mjs` -- cobertura deterministica de vazio, caixa, acentos e valores ausentes.
- `tests/rendered-html.test.mjs` -- verificacao estrutural dos controles, propriedades compartilhadas e ausencia do seletor concorrente.

## Tasks & Acceptance

**Execution:**
- [x] `lib/ui-search.ts` e `tests/ui-search.test.mjs` -- exportar `matchesSearch(query, values)` e testar vazio, `null`, caixa, acentos, espacos, substring e multiplos termos AND.
- [x] `app/page.tsx` -- limpar busca na navegacao; propagar busca e ano; filtrar somente colecoes detalhadas; remover o ano local de Cartoes; incluir periodo de Ativos; impedir resposta obsoleta; corrigir rotulos, estados vazios e avisos acessiveis.
- [x] `tests/rendered-html.test.mjs` -- proteger controles e propagacao na composicao React; confirmar que o seletor `Ano de Cartoes` deixou de existir.

**Acceptance Criteria:**
- Given uma consulta com um ou mais termos, when o usuario pesquisa em Custos, Cartoes ou Ativos, then somente linhas cujo texto combinado contenha todos os termos normalizados aparecem e KPIs, graficos e totais permanecem agregados ao periodo.
- Given uma busca ativa, when o usuario troca de area, then o campo e o filtro sao limpos.
- Given um ano selecionado no topo, when qualquer area conectada carrega, then ela consulta e identifica o mesmo ano sem seletor concorrente.
- Given `all` ou um mes de 1 a 12 selecionado em Ativos, when a consulta mais recente termina, then carteira e proventos refletem o periodo retornado e respostas anteriores sao ignoradas.
- Given periodo anual ou mensal no Dashboard, when o resumo aparece, then o rotulo descreve corretamente o periodo.
- Given alertas de cotacao, when exibidos, then usam o estilo de aviso existente, `role="status"` e texto que identifica a condicao.

### Review Findings

- [x] [Review][Patch] Limpar a busca ao trocar de area, conforme decisao do usuario [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:16]
- [x] [Review][Patch] Definir campos e semantica exata da busca [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:31]
- [x] [Review][Patch] Distinguir sem dados, sem correspondencias, carregamento e erro [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:31]
- [x] [Review][Patch] Explicitar quais totais permanecem agregados durante a busca [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:22]
- [x] [Review][Patch] Definir origem, intervalo e remocao do seletor concorrente de ano [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:32]
- [x] [Review][Patch] Definir semantica e valores do periodo mensal de Ativos [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:33]
- [x] [Review][Patch] Proteger a interface contra respostas atrasadas de filtros anteriores [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:33]
- [x] [Review][Patch] Tornar avisos de cotacao semanticamente acessiveis [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:34]
- [x] [Review][Patch] Cobrir interacoes reais de busca e filtros, nao apenas estrutura SSR [_bmad-output/implementation-artifacts/spec-consistencia-interface-busca-filtros.md:57]

## Spec Change Log

- 2026-09-30: Revisao adversarial definiu semantica da busca, estados vazios, totais preservados, ano unico, periodo de Ativos, respostas obsoletas, acessibilidade e verificacao. KEEP: contratos da API e regras financeiras permanecem inalterados.
- 2026-10-01: Revisao da implementacao ampliou a protecao contra respostas obsoletas para todas as views, corrigiu carregamentos, busca de metadados de cartao, navegacao e acessibilidade. KEEP: filtros alteram somente linhas detalhadas e os totais permanecem agregados ao periodo.

## Verification

**Commands:**
- `npm.cmd run lint` -- esperado: zero erros.
- `npm.cmd run test` -- esperado: build concluido e todos os testes aprovados.

**Manual checks (if no CLI):**
- No navegador desktop e mobile, pesquisar termos com acento e multiplas palavras em cada area, trocar de area e confirmar limpeza do campo.
- Trocar ano e periodo rapidamente e confirmar que apenas a ultima selecao permanece visivel, sem sobreposicao, foco perdido ou seletor concorrente.
- Conferir por teclado os rotulos dos controles e a leitura do aviso de cotacao como status.

**Resultados em 2026-10-01:**
- `npm.cmd run lint`: aprovado, zero erros.
- `npm.cmd run test`: aprovado, build concluido e 71 testes aprovados.
- Navegador desktop: Dashboard carregado com dados locais, rotulo `Resumo do ano` e layout sem sobreposicao.
- Interacoes automatizadas no Chrome: indisponiveis nesta sessao; cobertura E2E registrada em `deferred-work.md`.

## Suggested Review Order

**Estado compartilhado e navegacao**

- Centraliza ano, busca e limpeza ao trocar de area.
  [`page.tsx:243`](../../app/page.tsx#L243)

- Protege Dashboard contra respostas antigas de periodo.
  [`page.tsx:367`](../../app/page.tsx#L367)

**Busca nas areas conectadas**

- Filtra despesas sem alterar os totais do periodo.
  [`page.tsx:465`](../../app/page.tsx#L465)

- Compartilha ano e pesquisa metadados relacionados dos cartoes.
  [`page.tsx:669`](../../app/page.tsx#L669)

- Adiciona periodo mensal, filtros e protecao concorrente aos ativos.
  [`page.tsx:751`](../../app/page.tsx#L751)

- Normaliza termos com acentos, compatibilidade e semantica AND.
  [`ui-search.ts:12`](../../lib/ui-search.ts#L12)

**Estados e verificacao**

- Padroniza tabelas vazias com identidade estavel e anuncio acessivel.
  [`page.tsx:1035`](../../app/page.tsx#L1035)

- Protege a composicao dos controles compartilhados.
  [`rendered-html.test.mjs:174`](../../tests/rendered-html.test.mjs#L174)

- Exercita os limites deterministas da busca.
  [`ui-search.test.mjs:5`](../../tests/ui-search.test.mjs#L5)
