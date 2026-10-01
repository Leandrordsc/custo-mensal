---
title: 'Etapa 2 - Custos persistidos locais'
type: 'feature'
created: '2026-08-18'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/PRD.md'
  - '{project-root}/_bmad-output/planning-artifacts/ARCHITECTURE.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-1-fundacao-tecnica-local.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-etapa-2-dashboard-domain-services.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** A pagina de Custos ainda depende de arrays fixos em `lib/finance-data.ts`, entao nao permite cadastrar despesas futuras nem comprovar persistencia apos reiniciar o sistema. O piloto local precisa transformar Custos em um fluxo vertical real: cadastrar, consultar, editar e cancelar despesas usando SQLite.

**Approach:** Implementar um backend local HTTP no runtime existente, com contexto autenticado temporario do piloto, repositories escopados por usuario, casos de uso de despesas e uma UI de Custos conectada a endpoints locais. A tela deve preservar o layout geral, exibir estado vazio quando o banco nao tiver lancamentos e nunca usar dados fixos como fallback silencioso.

## Boundaries & Constraints

**Always:** Usar `transactions` como fonte financeira principal; todo acesso deve vir de `AuthenticatedUserContext`; nenhum endpoint aceita `user_id` do cliente; validar backend mesmo com validacao na UI; persistir valores em centavos; `origin = MANUAL`, `nature = DESPESA`, `subtype = COMPRA`; pendentes/cancelados fora dos totais confirmados; cancelamento auditavel com `transaction_status = CANCELADO`, `voided_at`, `voided_by`; parcelamento atomico; dados sobrevivem a nova conexao.

**Ask First:** Se for necessario mudar a migration `0001`, escolher login definitivo, instalar dependencia nova, importar XLSX real, alterar investimentos/dividendos/cartoes fora do necessario para despesas, publicar, conectar D1 ou trocar o framework/backend.

**Never:** Nao fazer DELETE fisico de transacao financeira; nao inserir mocks automaticamente no banco; nao somar dados estaticos com persistidos; nao deixar a UI escolher usuario; nao implementar login definitivo, Dashboard completo, importacao XLSX, cashback, investimentos, dividendos ou cotacoes nesta etapa.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bootstrap local | Banco vazio e `LOCAL_USER_ID` configurado ou padrao seguro | Comando explicito cria usuario, categorias, conta e cartoes iniciais sem senha | Reexecutar nao duplica dados |
| Criar despesa a vista | Descricao, valor BRL, data, competencia, categoria e conta/cartao | Cria `transactions` confirmada ou pendente e aparece na listagem apos reload | Campos obrigatorios retornam erro 400 |
| Criar despesa parcelada | Valor total e quantidade de parcelas >= 1 | Cria `card_purchases`, transacoes e `card_installments`; soma das parcelas fecha o total | Operacao inteira falha em transacao se qualquer parcela falhar |
| Editar despesa | ID de despesa do usuario autenticado | Atualiza campos permitidos e `updated_at`, preservando `created_at` | Cross-user ou cancelada retorna erro |
| Cancelar despesa | ID de despesa ativa | Marca cancelada com auditoria e remove dos totais | Nao executa DELETE fisico |
| Listar/resumir por periodo | Ano e mes escolhidos | Retorna despesas persistidas, totais confirmados, cartao, categorias e pendentes | Banco vazio retorna lista vazia e totais zero |

</frozen-after-approval>

## Registro de Implementacao

- Migration `0002_add_transaction_timestamps` adicionada sem alterar a `0001`.
- Repositories e servico de despesas criados com escopo obrigatorio por `AuthenticatedUserContext`.
- API local criada sem aceitar `user_id` no payload.
- Tela de Custos passou a consumir SQLite via API local.
- Bootstrap local idempotente criado para usuario, categorias, conta principal, BTG e Mercado Pago.
- Testes adicionados para centavos, parcelamento, persistencia, cancelamento auditavel, cross-user e payload com `user_id`.

## Code Map

- `app/page.tsx` -- `CostsView` usa `getYearSheet`, `monthlyTotals` e `MatrixTable` com dados estaticos; deve trocar apenas Custos para estado/API persistidos, preservando demais abas.
- `app/globals.css` -- Possui layout, paineis, tabelas e botoes base; adicionar estilos pontuais para formulario, badges, estado vazio, erro e acoes.
- `lib/finance-data.ts` -- Origem dos mocks atuais de custos; nao usar como fallback da pagina de Custos apos a troca.
- `lib/auth-context.ts` -- Ja fornece contexto autenticado minimo; ampliar ou reutilizar para piloto local sem login definitivo.
- `lib/dashboard-rules.ts` -- Regras ja distinguem confirmados, pendentes, cancelados e compras no cartao; pode inspirar resumo mensal.
- `db/schema.ts` -- Nao possui `created_at`/`updated_at` em `transactions`; como `0001` nao deve mudar, auditoria de edicao deve usar campos existentes quando possivel e registrar limitacao se necessario.
- `scripts/migrate-local.mjs` -- Runner local imutavel; nao alterar migrations aplicadas.
- `worker/index.ts`, `vite.config.ts` -- Estrutura Vinext/Worker existe, mas ainda nao ha rotas API locais claras; investigar antes de escolher endpoint.
- `tests/*.test.mjs` -- Testes Node ja usam SQLite temporario; seguir padrao para repositories/casos de uso/API.

## Tasks & Acceptance

**Execution:**
- [ ] `lib/local-auth.ts` -- Criar contexto autenticado temporario do piloto via env/bootstrap, sem senha fixa e sem aceitar usuario do cliente.
- [ ] `lib/local-db.ts` -- Abrir SQLite local por `LOCAL_DATABASE_PATH` com `PRAGMA foreign_keys = ON`.
- [ ] `lib/expense-domain.ts` -- Validar payload, converter BRL para centavos sem float, gerar parcelas deterministicas e calcular competencia mensal.
- [ ] `lib/finance-repositories.ts` -- Implementar `CategoriesRepository`, `AccountsRepository`, `CardsRepository`, `TransactionsRepository` escopados por usuario e com validacao cross-user.
- [ ] `lib/expense-service.ts` -- Implementar casos de uso: listar bases, criar, listar por periodo, obter por ID, editar, cancelar e resumo mensal.
- [ ] `scripts/bootstrap-local-user.mjs` -- Criar usuario local, categorias, conta e cartoes BTG/Mercado Pago de forma idempotente.
- [ ] API/backend local -- Expor endpoints para bases, despesas CRUD auditavel e resumo, rejeitando `user_id` no payload.
- [ ] `app/page.tsx` -- Substituir apenas Custos por fluxo persistido com loading, erro, vazio, filtros, formulario, editar e cancelar.
- [ ] `app/globals.css` -- Adicionar estilos minimos para o novo fluxo sem redesenho amplo.
- [ ] Testes -- Cobrir dominio, repositories/API e interface renderizada para cadastro, persistencia, edicao, cancelamento, parcelamento, cross-user, banco vazio e ausencia de fallback fixo.

**Acceptance Criteria:**
- Given banco vazio, when abrir Custos, then a tela mostra estado vazio e totais zero sem carregar `annualCostSheets`.
- Given usuario local inicializado, when cadastrar despesa a vista em conta, then ela aparece no mes filtrado e permanece apos nova conexao SQLite.
- Given valor `123,45`, when salvar despesa, then `amount_cents` deve ser `12345`.
- Given compra no cartao parcelada em 3 vezes, when salvar, then as parcelas somam o total e cada parcela tem competencia mensal sequencial.
- Given despesa pendente, when calcular resumo, then ela aparece separada e nao entra no total confirmado.
- Given despesa cancelada, when listar e resumir, then ela permanece auditavel, nao entra nos totais e possui `voided_at`/`voided_by`.
- Given usuario A autenticado, when tentar usar categoria, conta, cartao ou transacao do usuario B, then o backend rejeita.
- Given payload com `user_id`, when chamar endpoint, then o backend ignora ou rejeita sem alterar o escopo autenticado.
- Given app reiniciado, when consultar o mesmo banco SQLite, then a despesa cadastrada continua disponivel.

## Spec Change Log

## Design Notes

Como `transactions` nao possui `created_at`/`updated_at` na `0001`, a edicao nesta etapa deve preservar auditoria possivel com `notes`, `logical_fingerprint` ou regra documentada, sem alterar migration aplicada. Se isso se mostrar insuficiente para atender auditoria minima, pausar antes de mudar schema.

## Verification

**Commands:**
- `npm.cmd run lint` -- expected: sem erros.
- `npm.cmd exec tsc -- --noEmit` -- expected: sem erros.
- `npm.cmd run db:migrate` -- expected: migrations imutaveis aplicadas/ignoradas sem erro.
- `npm.cmd run db:verify` -- expected: schema permanece valido.
- `npm.cmd run test` -- expected: testes de dominio/API/UI passam.
- `npm.cmd run build` -- expected: build Vinext passa.
