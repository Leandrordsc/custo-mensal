---
title: 'Etapa 2 - Servicos locais do Dashboard'
type: 'feature'
created: '2026-08-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: '006694a921a2fb1c27938ae95d854b3e889ab9bb'
context:
  - '{project-root}/_bmad-output/planning-artifacts/PRD.md'
  - '{project-root}/_bmad-output/planning-artifacts/ARCHITECTURE.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-1-fundacao-tecnica-local.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A Etapa 1 entregou o schema SQLite local, mas a aplicacao ainda calcula o Dashboard a partir de dados estaticos em `lib/finance-data.ts` e regras dentro da UI. Falta a primeira camada de dominio/aplicacao que use `transactions` como fonte financeira principal, preserve isolamento por usuario e prepare a UI para sair do hardcode sem iniciar importacao real ou login definitivo.

**Approach:** Criar servicos locais puros e testaveis para calcular o Dashboard por periodo a partir de transacoes normalizadas, com repository interface escopada por usuario e fixture/seed local pequeno para validar as regras aprovadas. Esta etapa nao refatora a tela inteira; ela entrega o motor de calculo e contratos que a UI e a importacao vao consumir depois.

## Boundaries & Constraints

**Always:** Usar `transactions` como fonte unica dos totais confirmados; filtrar todo acesso por `user_id` vindo de contexto autenticado; separar `nature`, `subtype`, `origin`, `classification_status` e `transaction_status`; nao somar tabelas especializadas em paralelo; manter valores monetarios em centavos; tratar cashback estimado como nao contabilizavel; preservar compatibilidade SQLite local e D1 futuro.

**Ask First:** Se for necessario escolher provedor de login, alterar UI de forma relevante, importar a planilha real, criar API HTTP publica, escolher D1 definitivamente, mudar a migration `0001`, alterar dados historicos hardcoded ou instalar novas dependencias.

**Never:** Nao iniciar Etapa 3/importacao XLSX completa; nao implementar CRUDs completos; nao permitir `user_id` vindo de input da UI; nao duplicar custo por pagamento de fatura ou transferencia para caixinha; nao editar migrations aplicadas; nao armazenar senha ou credenciais.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dashboard mensal confirmado | Transacoes `CONFIRMADO` e `ACTIVE` de um usuario no periodo | Totais separados para custo de vida, compras cartao, aportes, reinvestimentos, dividendos, cashback real, rendimentos, transferencias neutras e pendencias | Ignorar `CANCELADO`, `ESTORNADO`, `REJEITADO` e `ESTIMADO` nos totais confirmados |
| Pagamento de fatura | Compra/parcela e pagamento da fatura no mesmo periodo | Compra entra em despesa conforme categoria; pagamento entra como transferencia neutra | Se a transferencia nao tiver conta origem/destino, classificar como movimentacao neutra incompleta sem somar custo |
| Cashback estimado | Evento estimado ou calculo por regra do cartao | Exibir valor estimado separado, sem aumentar saldo/patrimonio | Se nao houver regra vigente, estimativa fica zero e pode gerar aviso de dado incompleto |
| Cross-user | Transacoes de dois usuarios no mesmo banco | Repositorio retorna/calcula somente dados do usuario autenticado | Se `user_id` ausente no contexto, falhar antes de consultar |
| Reversao/ciclo maior | Transacao tenta formar cadeia de reversao com mais de dois registros | Regra de dominio rejeita antes de persistir | Retornar erro explicito de ciclo de reversao |

</frozen-after-approval>

## Code Map

- `db/schema.ts` -- Contrato normalizado ja aprovado; `transactions`, `accounts`, `categories`, `cards`, `card_rules`, `cashback_events` e tabelas especializadas existem com `user_id`.
- `scripts/migrate-local.mjs` -- Runner local versionado; migrations aplicadas sao imutaveis e hash divergente deve falhar.
- `db/index.ts` -- Adapter atual de D1 via `cloudflare:workers`; nao serve para testes locais Node. Etapa 2 deve criar adapter local separado sem acoplar dominio ao runtime Cloudflare.
- `app/page.tsx` -- UI client ainda calcula indicadores diretamente com arrays estaticos; nao deve ser grande foco desta etapa salvo conexao minima futura.
- `lib/finance-data.ts` -- Fonte estatica atual e helpers antigos; pode fornecer dados de fixture, mas nao deve virar fonte financeira definitiva.
- `lib/price-service.ts` -- Fallback de cotacao existente; cotacoes completas continuam fora do escopo desta etapa.
- `tests/local-db-schema.test.mjs` -- Base de testes SQLite com dados multiusuario e regras de integridade; reaproveitar padrao de banco temporario.
- `tests/rendered-html.test.mjs` -- Testes atuais de UI/SSR; manter passando, mas novos testes desta etapa devem focar dominio e repositories.
- `_bmad-output/planning-artifacts/ARCHITECTURE.md` -- Contem uma frase defasada sobre reaplicar ultima migration durante Etapa 1; codigo atual ja rejeita hash divergente. Atualizar a frase nesta etapa como correcao documental pequena se tocar docs for aprovado pelo escopo.

## Tasks & Acceptance

**Execution:**
- [x] `lib/auth-context.ts` -- Definir `AuthenticatedUserContext` minimo com `userId` obrigatorio e helper de validacao -- impede repositories sem usuario.
- [x] `lib/dashboard-rules.ts` -- Implementar calculos puros do Dashboard por periodo usando centavos e classificacao normalizada -- centraliza anti-duplicidade fora da UI.
- [x] `lib/dashboard-repository.ts` -- Definir interface de leitura escopada e adapter SQLite local para transacoes/categorias/regras de cartao necessarias ao Dashboard -- desacopla dominio da persistencia.
- [x] `lib/reversal-rules.ts` -- Validar autorreferencia, ciclo direto e ciclos maiores de reversao antes de persistir -- fecha pendencia registrada da Etapa 1.
- [x] `tests/dashboard-rules.test.mjs` -- Cobrir calculos de custo, cartao, transferencias, aportes, reinvestimentos, dividendos, cashback real/estimado, pendencias e cross-user -- prova regras do Dashboard.
- [x] `tests/reversal-rules.test.mjs` -- Cobrir rejeicao de ciclos de reversao maiores que dois registros -- prova regra que nao cabe so na trigger SQLite.
- [x] `_bmad-output/planning-artifacts/ARCHITECTURE.md` -- Corrigir a descricao do runner para hash divergente falhar sempre -- alinha documento ao commit da Etapa 1.

**Acceptance Criteria:**
- Given transacoes confirmadas e ativas de um usuario, when calcular Dashboard mensal, then os totais confirmados devem vir somente de `transactions`.
- Given compra de cartao e pagamento de fatura, when calcular custo de vida, then a compra/parcela pode contar como despesa e o pagamento da fatura deve ficar fora do custo.
- Given transferencia para caixinha, when calcular custo de vida e patrimonio consolidado, then custo nao aumenta e patrimonio consolidado permanece neutro.
- Given aporte e reinvestimento, when calcular Dashboard, then ambos aparecem fora de custo de vida.
- Given dividendo, cashback real e rendimento confirmados, when calcular Dashboard, then aparecem separados e somados apenas pelas respectivas `transactions`.
- Given cashback estimado, when calcular Dashboard, then aparece em campo estimado e nao entra em saldo, patrimonio ou ganhos confirmados.
- Given transacoes de outro usuario no mesmo banco, when repository for chamado para um usuario autenticado, then nenhum registro cross-user deve ser retornado.
- Given contexto sem `userId`, when qualquer repository for chamado, then a operacao deve falhar antes da consulta.
- Given cadeia de reversao com ciclo maior que dois registros, when validar antes de persistir, then a regra deve rejeitar com erro explicito.

## Spec Change Log

## Design Notes

O Dashboard deve retornar um view model em centavos, sem formatacao BRL. Formatacao fica na UI. Isso evita acoplar regra financeira a React e facilita testes.

Exemplo de saida esperada:

```ts
{
  period: { from: "2026-06-01", to: "2026-06-30" },
  livingCostCents: 10000,
  cardPurchasesCents: 10000,
  invoicePaymentsCents: 10000,
  confirmedCashbackCents: 100,
  estimatedCashbackCents: 120
}
```

## Verification

**Commands:**
- `git diff --check` -- expected: sem erros de whitespace.
- `npm.cmd run lint` -- expected: sem erros ESLint.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros TypeScript.
- `npm.cmd run db:verify` -- expected: schema e migration seguem validos.
- `npm.cmd run test` -- expected: testes existentes e novos passam.
- `npm.cmd run build` -- expected: build Vinext passa.

## Suggested Review Order

**Dominio do Dashboard**

- Entrada principal dos calculos confirmados por periodo.
  [`dashboard-rules.ts:62`](../../lib/dashboard-rules.ts#L62)

- Meses canonicos protegem comparacao lexical.
  [`dashboard-rules.ts:181`](../../lib/dashboard-rules.ts#L181)

- Contexto autenticado impede consulta sem usuario.
  [`auth-context.ts:5`](../../lib/auth-context.ts#L5)

**Persistencia Local**

- Repository SQLite concentra consulta escopada.
  [`dashboard-repository.ts:32`](../../lib/dashboard-repository.ts#L32)

- Filtro por user_id evita vazamento cross-user.
  [`dashboard-repository.ts:58`](../../lib/dashboard-repository.ts#L58)

- Cashback estimado vem separado e nao contabilizavel.
  [`dashboard-repository.ts:65`](../../lib/dashboard-repository.ts#L65)

**Reversoes**

- Regra de dominio bloqueia ciclos alem da trigger.
  [`reversal-rules.ts:6`](../../lib/reversal-rules.ts#L6)

- Alvo inexistente e ids duplicados falham cedo.
  [`reversal-rules.ts:27`](../../lib/reversal-rules.ts#L27)

**Verificacao**

- Teste puro cobre anti-duplicidade do Dashboard.
  [`dashboard-rules.test.mjs:87`](../../tests/dashboard-rules.test.mjs#L87)

- Repository testado com todos os totais relevantes.
  [`dashboard-rules.test.mjs:160`](../../tests/dashboard-rules.test.mjs#L160)

- Reversoes cobrem ciclo maior que dois.
  [`reversal-rules.test.mjs:43`](../../tests/reversal-rules.test.mjs#L43)

- Suite padrao passa a incluir todos os testes.
  [`package.json:12`](../../package.json#L12)

- Arquitetura documenta migrations imutaveis.
  [`ARCHITECTURE.md:102`](../planning-artifacts/ARCHITECTURE.md#L102)
