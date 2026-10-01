---
title: 'Importacao XLSX detalhada para staging auditavel'
type: 'feature'
created: '2026-09-15'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'c1de02ba2cd30327eaab705aa47913d16880f8c8'
context:
  - '{project-root}/_bmad-output/planning-artifacts/IMPORT_STRATEGY.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A importacao atual nao le `referencias/Custo Mensal.xlsx`; ela gera staging a partir de arrays manuais em `lib/finance-data.ts`, preservando totais agregados mas perdendo a granularidade real das abas anuais 2021-2025. Isso impede auditoria linha/celula, reconciliacao detalhada e revisao confiavel de classificacoes ambiguas.

**Approach:** Implementar um parser XLSX local que leia a planilha real e substitua a semente hardcoded no script de staging por dados extraidos de abas conhecidas. A entrega deve produzir JSON auditavel com celulas, hashes, classificacao sugerida, issues de formula e conciliacao com os totais historicos atuais, sem confirmar transacoes no banco nesta etapa.

## Boundaries & Constraints

**Always:** Manter portugues do Brasil, BRL e datas brasileiras; tratar a planilha como fonte de importacao/auditoria, nao como banco operacional; preservar `transactions` como fonte unica apenas apos confirmacao futura; gerar staging idempotente com `fileHash`, `rawRowHash` e `logicalFingerprint`; manter linhas ambiguas como `PENDENTE_REVISAO`; registrar formulas quebradas ou valores nao numericos como issue; nao alterar a planilha original; nao expor `user_id` arbitrario na UI ou APIs.

**Ask First:** Instalar uma biblioteca XLSX nova; alterar schema/migrations; confirmar importacao em `transactions`; escolher regras definitivas para linhas ambigueis de investimento/cartao/reserva que nao estejam cobertas pela estrategia existente; mover ou versionar o arquivo real fora de `referencias/`.

**Never:** Nao importar totais de linha/coluna como transacoes; nao classificar aportes, reservas, pagamentos de fatura ou transferencias como despesa operacional; nao recriar `FisWebDriver` como tela; nao apagar o fallback atual sem teste de reconciliacao; nao depender de servico externo para ler a planilha.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Abas anuais detalhadas | `referencias/Custo Mensal.xlsx` com abas 2020-2026 | `monthlyExpenses` contem linhas por rotulo, mes e celula, com totais reconciliados por ano | Linhas vazias e totais sao ignoradas ou marcadas como conciliacao |
| Ano antes agregado | Abas 2021-2025 deixam de vir de `baseRows` | Staging preserva categorias/rotulos reais em vez de uma linha `Total original` | Divergencia contra total conhecido vira issue de reconciliacao |
| Formula quebrada | Celula com `#REF!`, `#DIV/0!` ou erro equivalente | Nao gera lancamento financeiro confirmado; aparece em `importIssues` com sheet/cell | Valor bruto e tratamento ficam registrados |
| Linha ambigua | Rotulo de cartao, investimento, reserva ou descricao sem regra segura | Linha fica com `classificationStatus = PENDENTE_REVISAO` e `status = PENDENTE` | A issue explica a ambiguidade |

</frozen-after-approval>

## Code Map

- `scripts/import-custo-mensal.mjs` -- ponto atual de staging; `buildStaging()` usa `annualCostSheets`, `cardRows`, `cardYield`, `dividends` e `importIssues`, portanto e o arquivo principal a substituir ou delegar para um parser real.
- `lib/finance-data.ts` -- seed manual com 2020 e 2026 detalhados, mas 2021-2025 usam `baseRows()` agregado; deve continuar disponivel como fallback/reconciliacao durante a transicao.
- `tests/rendered-html.test.mjs` -- contem o teste "gera staging de importacao com contrato esperado"; precisa evoluir para validar contrato novo, celulas, hashes, issues e reconciliacao.
- `_bmad-output/planning-artifacts/IMPORT_STRATEGY.md` -- define abas lidas, pipeline, hashes, tratamento de erro, previa e criterios IMP-CA; fonte normativa desta etapa.
- `_bmad-output/planning-artifacts/DATA_MODEL.md` -- define campos de `import_batches` e `import_rows`, enumeracoes e regras de idempotencia que o JSON de staging deve espelhar.
- `db/schema.ts` -- ja possui tabelas de importacao e constraints; somente leitura nesta etapa, salvo aprovacao humana para migration.
- `package.json` -- atualmente nao declara biblioteca XLSX; qualquer dependencia nova exige aprovacao antes da implementacao.
- `referencias/Custo Mensal.xlsx` -- arquivo fonte real, fora do Git; parser deve lidar com ausencia do arquivo com mensagem clara.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/import-custo-mensal.mjs` -- trocar a montagem baseada apenas em `finance-data.ts` por leitura da planilha real quando o arquivo existir, mantendo fallback explicito para testes ou ausencia local -- preservar execucao local e staging auditavel.
- [x] `scripts/import-custo-mensal.mjs` ou novo helper em `lib/` -- normalizar valores monetarios, meses, referencias de celula, hashes e classificacoes sugeridas -- centralizar regras testaveis de importacao.
- [x] `scripts/import-custo-mensal.mjs` -- registrar `fileHash`, `parserVersion`, contadores, `rawRowHash`, `logicalFingerprint`, `sourceSheet`, `sourceCell`, `classificationStatus`, `status` e issues de formula/reconciliacao -- alinhar JSON ao modelo futuro de importacao.
- [x] `tests/rendered-html.test.mjs` ou novo `tests/import-custo-mensal.test.mjs` -- cobrir parser, fallback, formulas/valores invalidos, classificacao ambigua e reconciliacao dos totais conhecidos -- evitar regressao silenciosa.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- remover ou marcar como resolvida a pendencia de parser completo somente se a entrega realmente preservar granularidade 2021-2025 -- manter rastreabilidade honesta.

**Acceptance Criteria:**
- Given a planilha real disponivel em `referencias/Custo Mensal.xlsx`, when `buildStaging()` for executado, then o staging deve conter linhas detalhadas para 2021-2025 em vez de apenas `Total original <ano>`.
- Given uma celula anual com valor financeiro valido, when ela for parseada, then a linha deve preservar aba, celula, rotulo, ano, mes, valor normalizado, `rawRowHash` e `logicalFingerprint`.
- Given uma linha de total ou formula quebrada, when o parser processar a aba, then ela nao deve virar lancamento financeiro comum e deve alimentar conciliacao ou `importIssues`.
- Given o arquivo real ausente, when o script for executado em ambiente de teste/CI, then a falha deve ser clara ou o fallback deve ser explicitamente identificado, sem fingir importacao real.
- Given os totais historicos conhecidos, when o staging detalhado for gerado, then divergencias por ano devem ser reportadas no JSON e nos testes.

## Spec Change Log

## Design Notes

O contrato de staging deve ser mais rico que o array antigo, mas ainda nao precisa confirmar dados no SQLite. Uma linha anual pode nascer assim:

```json
{
  "sourceSheet": "2025",
  "sourceCell": "C12",
  "sourceLabel": "Mercado",
  "year": 2025,
  "month": 2,
  "amountCents": 12345,
  "classificationStatus": "CONFIRMADO",
  "status": "ACEITO"
}
```

## Verification

**Commands:**
- `npm.cmd run lint` -- sem erros de lint.
- `npm.cmd run test` -- testes de importacao e regressao passam.
- `npm.cmd run build` -- build Vinext continua passando.

## Suggested Review Order

**Entrada da importacao**

- Escolhe XLSX real, fallback explicito e envelope final.
  [`import-custo-mensal.mjs:363`](../../scripts/import-custo-mensal.mjs#L363)

- Monta o contrato auditavel com contadores, reconciliacao e issues.
  [`import-custo-mensal.mjs:320`](../../scripts/import-custo-mensal.mjs#L320)

**Parser XLSX**

- Le o ZIP do XLSX sem dependencia nova.
  [`import-custo-mensal.mjs:94`](../../scripts/import-custo-mensal.mjs#L94)

- Infla entradas XML e rejeita compressao nao suportada.
  [`import-custo-mensal.mjs:122`](../../scripts/import-custo-mensal.mjs#L122)

- Extrai linhas anuais, hashes, fingerprints, pendencias e conciliacao.
  [`import-custo-mensal.mjs:215`](../../scripts/import-custo-mensal.mjs#L215)

- Trata valor negativo como pendencia de revisao.
  [`import-custo-mensal.mjs:264`](../../scripts/import-custo-mensal.mjs#L264)

**Fallback e rastreabilidade**

- Mantem seed manual quando a planilha nao existe ou falha.
  [`import-custo-mensal.mjs:289`](../../scripts/import-custo-mensal.mjs#L289)

- Registra hardening XLSX futuro sem bloquear a etapa atual.
  [`deferred-work.md:10`](deferred-work.md#L10)

**Testes**

- Valida staging real, anos 2021-2025, hashes e reconciliacao.
  [`rendered-html.test.mjs:81`](../../tests/rendered-html.test.mjs#L81)

- Valida fallback e modo estrito para arquivo ausente.
  [`rendered-html.test.mjs:117`](../../tests/rendered-html.test.mjs#L117)
