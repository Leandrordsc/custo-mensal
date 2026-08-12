---
title: 'Etapa 1 - Fundacao tecnica local'
type: 'feature'
created: '2026-08-12'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'a95712744815e74a6e1252825930e50771f1ddd1'
context:
  - '{project-root}/_bmad-output/planning-artifacts/PRD.md'
  - '{project-root}/_bmad-output/planning-artifacts/ARCHITECTURE.md'
  - '{project-root}/_bmad-output/planning-artifacts/DATA_MODEL.md'
  - '{project-root}/_bmad-output/planning-artifacts/IMPORT_STRATEGY.md'
  - '{project-root}/_bmad-output/planning-artifacts/DASHBOARD_RULES.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** O projeto ja possui Drizzle e um schema inicial, mas ainda nao tem uma fundacao local versionada para SQLite fisico alinhada ao modelo aprovado. O schema atual ainda usa tabelas antigas como `monthly_expenses`, `card_transactions` e `investment_transactions`, sem `user_id` obrigatorio em todos os registros financeiros e sem os eixos `nature`, `subtype`, `origin` e `classification_status`.

**Approach:** Implementar somente a base tecnica local: schema Drizzle normalizado, migrations versionadas, comando de migracao, configuracao por variavel de ambiente e ignores de arquivos locais. A aplicacao visual, login real, importador completo, repositories e regras de Dashboard ficam fora desta etapa.

## Boundaries & Constraints

**Always:** Seguir o PRD revisado: `transactions` e a fonte financeira principal; nao usar `transaction_type`; separar `nature`, `subtype`, `origin`, `classification_status` e `transaction_status`; todo registro financeiro e extensao financeira deve possuir `user_id`; preservar a planilha original; usar SQLite local em desenvolvimento e manter compatibilidade conceitual com Cloudflare D1.

**Ask First:** Se for necessario instalar nova dependencia ou driver SQLite, trocar runtime, alterar UI, alterar dados historicos de `lib/finance-data.ts`, modificar a planilha, escolher provedor de login, escolher D1 definitivamente para producao ou mexer fora de arquivos de fundacao local, pausar e pedir aprovacao.

**Never:** Nao implementar login, Dashboard novo, importacao real da planilha, CRUDs, seeds historicos completos, seed com dados reais, adapter runtime local completo, adapter de producao D1, API de cotacoes ou regras financeiras fora do schema. Nao somar tabelas especializadas como fonte paralela de totais. Nao armazenar senha em texto puro. Nao criar banco local rastreado pelo Git.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Migracao local padrao | Nenhuma variavel definida | Comando de migracao usa caminho padrao em `data/` e cria SQLite local ignorado pelo Git | Se o diretorio nao existir, o comando prepara o diretorio antes de migrar |
| Caminho customizado | `LOCAL_DATABASE_PATH` definido no shell | Drizzle usa o arquivo indicado pela variavel de ambiente | Se o caminho for invalido, o comando falha com erro claro do processo |
| `.env` nao carregado pelo npm | `.env.example` existe, mas nenhuma env foi exportada | O fallback `./data/custo-mensal.local.sqlite` continua funcional | Nao depender de carregamento automatico de `.env` para a migracao padrao |
| Contrato de schema | Build/import TypeScript do schema | Exporta tabelas planejadas com `user_id`, chaves, indices e enums conceituais | Falha de typecheck/build indica contrato quebrado |
| Documentos divergentes | Artefatos citam `transaction_type` antigo | Codigo nao replica o campo antigo e registra a inconsistencia no relato final | Se divergencia bloquear schema, pausar antes de codificar |

</frozen-after-approval>

## Code Map

- `package.json` -- Ja possui `drizzle-orm`, `drizzle-kit` e script `db:generate`; falta comando de migracao local e, se inevitavel, dependencia/estrategia de driver SQLite.
- `drizzle.config.ts` -- Configura Drizzle com `dialect: "sqlite"` e schema `./db/schema.ts`; falta `dbCredentials.url` baseado em variavel de ambiente/caminho local.
- `db/schema.ts` -- Schema atual e legado da primeira analise: `expense_categories`, `monthly_expenses`, `card_transactions`, `investment_transactions`, `dividend_payments`, `import_issues`; deve ser substituido pelo modelo aprovado em `DATA_MODEL.md`.
- `db/index.ts` -- Adapter atual e especifico de Cloudflare D1 via `cloudflare:workers`; nao deve ser expandido nesta etapa salvo ajuste minimo se o novo schema quebrar import. A migracao SQLite local deve ocorrer por CLI/script, nao por este adapter.
- `drizzle/meta/_journal.json` -- Existe metadado Drizzle, mas nao ha migracao SQL versionada observada; Etapa 1 deve gerar/adicionar migracao. Se o historico Drizzle estiver inconsistente, pode ser reinicializado apenas dentro de `drizzle/`, sem tocar em dados financeiros, planilha ou arquivos da aplicacao.
- `.gitignore` -- Ja ignora `.env*`, `*.xlsx`, `referencias/*.xlsx` e staging; precisa garantir explicitamente `.env`, `.env.local`, `data/`, `*.db`, `*.sqlite`, `*.sqlite3`.
- `app/page.tsx` e `lib/finance-data.ts` -- UI e dados estaticos atuais do piloto; nao alterar nesta etapa.
- `scripts/import-custo-mensal.mjs` -- Staging inicial derivado de dados estaticos; nao transformar em importador real nesta etapa.
- `worker/index.ts`, `vite.config.ts`, `.openai/hosting.json` -- Indicam runtime Vinext/Cloudflare-compatible; Etapa 1 nao deve confundir OpenAI Sites com Cloudflare Pages/Workers nem decidir producao.
- `_bmad-output/planning-artifacts/*.md` -- Documentos estao sincronizados com `nature/subtype/origin/classification_status` e `transactions` como fonte principal; `rg` nao encontrou `transaction_type`.

## Tasks & Acceptance

**Execution:**
- [x] `.gitignore` -- Adicionar entradas explicitas para env, bancos SQLite locais e diretorio `data/` -- evita vazar credenciais/arquivos locais e preserva a planilha fora do Git.
- [x] `.env.example` -- Criar exemplo sem credenciais com caminho local do banco -- documenta execucao local reproduzivel.
- [x] `drizzle.config.ts` -- Ler `LOCAL_DATABASE_PATH` com fallback para `./data/custo-mensal.local.sqlite` e configurar `dbCredentials.url` -- permite migracao fisica local.
- [x] `db/schema.ts` -- Reescrever schema Drizzle para as entidades aprovadas: `users`, `accounts`, `cards`, `card_rules`, `categories`, `transactions`, `card_purchases`, `card_installments`, `card_statements`, `assets`, `investment_events`, `dividend_events`, `cashback_events`, `reserve_earnings`, `asset_prices`, `import_batches`, `import_rows`, `classification_rules` -- corrige contrato de dominio sem implementar regras de negocio ainda.
- [x] `scripts/ensure-local-db.mjs` ou alternativa equivalente -- Criar diretorio do banco antes da migracao se o Drizzle CLI nao fizer isso sozinho -- torna `npm run db:migrate` robusto localmente.
- [x] `package.json` -- Adicionar `db:migrate` mantendo `db:generate` -- fornece comando oficial de migracao.
- [x] `drizzle/` -- Gerar ou criar migracao SQL versionada a partir do schema aprovado -- permite recriar SQLite local do zero.
- [x] `db/schema.ts` -- Remover exports de tabelas obsoletas do contrato antigo, sem reintroduzir `monthly_expenses`, `card_transactions`, `investment_transactions` ou `transaction_type` -- evita dois modelos financeiros concorrentes.
- [x] Testes/contratos minimos se necessario -- Cobrir exportacao do schema ou migracao local sem depender da UI -- reduz risco de schema quebrado passar despercebido.

**Acceptance Criteria:**
- Given o repositorio sem `.env`, when executar `npm run db:generate`, then o Drizzle deve conseguir ler `db/schema.ts` e manter migrations versionadas sem erro.
- Given o repositorio sem diretorio `data/`, when executar `npm run db:migrate`, then o diretorio deve ser criado e o arquivo SQLite local deve ser gerado no caminho padrao ignorado pelo Git.
- Given `LOCAL_DATABASE_PATH` apontando para outro arquivo SQLite local, when executar `npm run db:migrate`, then a migracao deve usar esse caminho sem alterar codigo.
- Given nenhum carregador automatico de `.env`, when executar `npm run db:migrate` sem variaveis exportadas, then o fallback local deve funcionar.
- Given uma revisao do schema, when procurar `transaction_type`, then esse campo nao deve existir no codigo novo.
- Given uma revisao do schema, when procurar tabelas legadas removidas, then `monthly_expenses`, `card_transactions` e `investment_transactions` nao devem existir como exports do novo contrato.
- Given qualquer tabela financeira ou extensao financeira nova, when inspecionar o schema, then ela deve possuir `user_id` obrigatorio.
- Given `transactions`, when inspecionar colunas e indices, then devem existir `nature`, `subtype`, `origin`, `classification_status`, `transaction_status`, `amount_cents`, `competence_month`, `logical_fingerprint` e indices por usuario/periodo/classificacao.
- Given tabelas especializadas confirmadas, when inspecionar FKs, then eventos de dividendos, cashback real, rendimentos e investimentos devem apontar para `transaction_id` unico quando aplicavel.
- Given arquivos locais apos migracao, when executar `git status --short`, then `.env`, `.env.local`, `data/` e arquivos `*.db|*.sqlite|*.sqlite3` nao devem aparecer como rastreaveis.

## Spec Change Log

## Design Notes

Usar ids `text` no schema para manter portabilidade entre SQLite local e D1 futuro, evitando dependencia imediata de autoincrementos que compliquem importacao idempotente. Nesta etapa, o schema nao define default automatico para esses ids; a geracao de UUID/CUID/ULID fica para a camada de aplicacao futura. `LOCAL_DATABASE_PATH` e o nome oficial da variavel de ambiente desta etapa.

Valores monetarios devem ser `integer` em centavos; quantidades/precos unitarios com precisao decimal ficam em `text`, conforme `DATA_MODEL.md`.

Nem todas as invariantes de usuario podem ser garantidas apenas por constraints SQLite. O schema deve declarar FKs, indices compostos e unicidades possiveis agora, mas a validacao de que conta, cartao, ativo, categoria e transacao pertencem ao mesmo usuario tambem deve ser aplicada futuramente em repositories/services escopados por usuario.

## Verification

**Commands:**
- `npm run db:generate` -- expected: Drizzle gera/valida migration sem erro.
- `npm run db:migrate` -- expected: cria/aplica schema em SQLite local.
- `npm run build` -- expected: TypeScript/Vinext compila com novo schema.
- `npm run lint` -- expected: sem erros de lint nos arquivos alterados.
- `git status --short` -- expected: mostra somente arquivos de codigo/config/migration planejados, sem banco local ou planilha.

## Suggested Review Order

**Contrato Financeiro**

- Ledger principal com classificacao normalizada e idempotencia.
  [`schema.ts:97`](../../db/schema.ts#L97)

- Entidades base isolam usuario, contas, cartoes, categorias e ativos.
  [`schema.ts:3`](../../db/schema.ts#L3)

- Parcelas e faturas preservam competencia sem duplicar pagamento.
  [`schema.ts:134`](../../db/schema.ts#L134)

- Importacao fica em staging revisavel, sem virar banco operacional.
  [`schema.ts:268`](../../db/schema.ts#L268)

**SQLite Local**

- Caminho local usa env com fallback sem depender de `.env`.
  [`drizzle.config.ts:3`](../../drizzle.config.ts#L3)

- Helper cria diretorio antes da migration.
  [`ensure-local-db.mjs:4`](../../scripts/ensure-local-db.mjs#L4)

- Migration versionada recria o contrato aprovado.
  [`0000_wide_vanisher.sql:1`](../../drizzle/0000_wide_vanisher.sql#L1)

**Operacao**

- Scripts oficiais cobrem generate, migrate e verify.
  [`package.json:15`](../../package.json#L15)

- Arquivos locais e banco SQLite ficam fora do Git.
  [`.gitignore:25`](../../.gitignore#L25)

- Exemplo documenta somente caminho local sem credenciais.
  [`.env.example:1`](../../.env.example#L1)

**Verificacao**

- Contrato pos-migration valida tabelas, colunas, FKs e indices.
  [`local-db-schema.test.mjs:75`](../../tests/local-db-schema.test.mjs#L75)
