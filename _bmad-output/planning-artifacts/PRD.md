# PRD - Controle Financeiro Pessoal

## Visao do produto

O produto transforma a planilha `referencias/Custo Mensal.xlsx` em uma aplicacao web de controle financeiro pessoal, com Dashboard como primeira entrega. A planilha sera usada como fonte historica e de requisitos, nunca como banco de dados operacional.

O produto deve nascer preparado para uso por mais de uma pessoa. Por isso, login faz parte do MVP e todos os registros financeiros devem pertencer obrigatoriamente a um `user_id`.

## Problema e objetivos

Hoje o projeto `custo-mensal` possui interface React/Vinext em `app/page.tsx`, estilos em `app/globals.css`, modelo Drizzle inicial em `db/schema.ts`, dados auxiliares em `lib/finance-data.ts`, fallback de precos em `lib/price-service.ts` e script inicial de staging em `scripts/import-custo-mensal.mjs`. A planilha concentra historico de 2020 a 2026, cartoes, investimentos, FIIs, dividendos, consolidado e precos tecnicos.

Objetivos do MVP:
- Entregar login e isolamento de dados por usuario.
- Consolidar a visao financeira sem duplicar despesas.
- Separar custo de vida, compras no cartao, aportes, reinvestimentos, reservas/caixinhas, dividendos, cashback e rendimentos.
- Importar historico da planilha de 2020 a 2026 por processo auditavel e idempotente.
- Permitir revisao e confirmacao em lote dos dados importados.
- Alimentar o Dashboard com dados minimos de investimentos e dividendos, sem exigir CRUD completo de carteira no MVP.
- Usar `transactions` como livro financeiro principal e fonte unica dos totais confirmados do Dashboard.
- Manter regras de negocio desacopladas do banco e do provedor de autenticacao.

## Perfis de usuario

- Usuario titular: acessa com login, cadastra/importa seus dados, revisa classificacoes, consulta Dashboard e historico.
- Usuario futuro: outros usuarios da aplicacao, com dados completamente isolados por `user_id`.
- Administrador tecnico futuro: acompanha erros operacionais e integracoes, sem acesso indevido a dados financeiros pessoais.

## Escopo do MVP

- Login obrigatorio.
- Dashboard como primeira entrega funcional.
- Modelo normalizado com `user_id` obrigatorio em todos os registros financeiros.
- Cartoes ativos: BTG e Mercado Pago.
- Cartoes historicos: Itau, Nubank, XP, 99 Pay e outros encontrados na planilha permanecem inativos/historicos, salvo alteracao manual.
- Cashback configuravel por cartao: BTG inicia com 1%, Mercado Pago com 0,5%.
- Armazenamento de cashback real e calculo separado de cashback estimado.
- Historico mensal de rendimento e cashback.
- Caixinhas/reservas como contas ou finalidade patrimonial.
- Importacao em etapas, com previa, revisao em lote, confirmacao e relatorio.
- Dados minimos de ativos, aportes, reinvestimentos e dividendos para alimentar o Dashboard.
- Tabelas especializadas para dividendos, cashback, rendimentos e investimentos apenas como extensoes de uma `transaction` confirmada.

## Funcionalidades

### Login e seguranca

O usuario deve autenticar antes de acessar dados financeiros. Todo acesso a registros deve ser escopado por `user_id`. O MVP nao define ainda o provedor de login definitivo, mas nunca deve armazenar senha em texto puro.

### Dashboard

Mostra custo de vida, compras de cartao, aportes novos, reinvestimentos, reservas/caixinhas, dividendos, cashback real, cashback estimado, rendimento de caixinhas, movimentacoes neutras e itens pendentes.

O Dashboard deve falar em "saidas e movimentacoes do mes" enquanto receitas completas nao estiverem confirmadas no escopo.

### Cartoes

Controla compras dos cartoes BTG e Mercado Pago. Deve suportar compras parceladas, data da compra, mes da fatura, vencimento da fatura e fechamento da fatura. Cada parcela deve ser contabilizada no mes da respectiva fatura.

### Investimentos e dividendos

O MVP deve armazenar dados minimos para Dashboard:
- ativo;
- classe;
- quantidade ou posicao inicial quando disponivel;
- preco medio quando disponivel;
- aportes;
- reinvestimentos;
- dividendos recebidos;
- preco atual ou ultimo preco conhecido;
- indicacao de cotacao defasada.

Nao faz parte do MVP criar um CRUD completo de carteira.

Dividendos, cashback real, rendimentos de caixinha, aportes e reinvestimentos devem possuir uma `transaction` confirmada correspondente. As tabelas especializadas guardam detalhes do evento e nao podem ser somadas junto com `transactions` no Dashboard.

### Importacao

Le a planilha, transforma dados para staging normalizado, sugere regras, destaca ambiguidades, permite aprovacao/rejeicao em lote e grava dados definitivos apos confirmacao.

## Modelo conceitual de classificacao

O PRD separa quatro conceitos. A nomenclatura definitiva podera ser refinada no `DATA_MODEL.md`, mas a separacao e obrigatoria.

### Natureza da movimentacao

- `DESPESA`
- `RECEITA`
- `TRANSFERENCIA`
- `INVESTIMENTO`

### Subtipo/finalidade

- `COMPRA`
- `APORTE`
- `REINVESTIMENTO`
- `PAGAMENTO_FATURA`
- `TRANSFERENCIA_RESERVA`
- `DIVIDENDO`
- `CASHBACK`
- `RENDIMENTO`
- `AJUSTE`

### Meio ou origem

- `CONTA`
- `CARTAO`
- `CAIXINHA`
- `IMPORTACAO`
- `MANUAL`

### Estado da classificacao

- `CONFIRMADO`
- `ESTIMADO`
- `PENDENTE_REVISAO`
- `REJEITADO`

Categorias complementares: moradia, veiculo, alimentacao, saude, lazer, investimentos, cartao, reserva, educacao, assinaturas e outras.

## Requisitos funcionais

| ID | Requisito |
| --- | --- |
| RF-01 | O sistema deve exigir login para acesso a qualquer dado financeiro. |
| RF-02 | O sistema deve exigir `user_id` em todo registro financeiro persistido. |
| RF-03 | O sistema deve negar acesso a registros pertencentes a outro usuario. |
| RF-04 | O Dashboard deve separar custo de vida, compras de cartao, aportes, reinvestimentos, reservas, dividendos, cashback, rendimentos e pendencias. |
| RF-05 | O sistema deve separar natureza, subtipo/finalidade, meio/origem e estado da classificacao. |
| RF-06 | Compras no cartao podem ser despesas; pagamento de fatura nao pode gerar nova despesa quando a compra/parcela ja foi contabilizada. |
| RF-07 | Transferencia para caixinha/reserva deve ser transferencia entre contas ou finalidade patrimonial, sem compor custo de vida. |
| RF-08 | O sistema deve suportar compras parceladas com data da compra, mes da fatura, fechamento e vencimento da fatura. |
| RF-09 | Cada parcela deve ser contabilizada no mes da respectiva fatura. |
| RF-10 | Cashback deve armazenar valor real confirmado e permitir estimativa separada por regra configuravel do cartao. |
| RF-11 | Cashback estimado nao deve aumentar saldo, patrimonio ou ganhos confirmados. |
| RF-12 | BTG e Mercado Pago devem ser cartoes ativos iniciais, com cashback configuravel por cartao. |
| RF-13 | Cartoes historicos encontrados na planilha devem permanecer inativos/historicos salvo alteracao manual. |
| RF-14 | O sistema deve registrar dividendos recebidos para alimentar o Dashboard. |
| RF-15 | O sistema deve registrar aportes e reinvestimentos para alimentar o Dashboard, sem transforma-los em custo de vida. |
| RF-16 | O sistema deve indicar quando a cotacao de um ativo estiver defasada. |
| RF-17 | A importacao deve detectar linhas ambiguas e envia-las para revisao em lote. |
| RF-18 | A importacao deve permitir revisar, aprovar, rejeitar e confirmar lotes importados. |
| RF-19 | A importacao deve ser idempotente usando hash do arquivo, identificacao do lote, fingerprint logico de lancamento e deteccao entre versoes da planilha. |
| RF-20 | A planilha deve ser fonte de importacao e auditoria, nao banco operacional. |
| RF-21 | O sistema deve registrar relatorio de importacao com itens aceitos, rejeitados e pendentes. |
| RF-22 | `transactions` deve ser o livro financeiro principal e a fonte unica dos totais confirmados do Dashboard. |
| RF-23 | Dividendos, cashback real, rendimentos, aportes e reinvestimentos devem possuir `transaction_id` unico quando persistidos em tabelas especializadas. |
| RF-24 | Transferencias entre contas devem debitar a origem e creditar o destino sem alterar patrimonio consolidado. |
| RF-25 | Rollback de importacao deve ser auditavel e nao deve apagar definitivamente registros financeiros. |
| RF-26 | A importacao deve permitir apenas um lote ativo por `user_id + file_hash`; `STAGED`, `READY_FOR_REVIEW` e `CONFIRMED` sao ativos, enquanto `FAILED` e `ROLLED_BACK` permitem nova tentativa. |
| RF-27 | Enquanto nao houver modelo de administrador/delegacao, campos de auditoria como `voided_by` e `confirmed_by` devem apontar para o proprio `user_id` do registro. |

## Requisitos nao funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Interface em portugues do Brasil, moeda BRL e datas brasileiras. |
| RNF-02 | Regras de negocio desacopladas da persistencia. |
| RNF-03 | Desenvolvimento local com SQLite. |
| RNF-04 | Producao deve permitir migracao para Cloudflare D1 ou outro banco via adapter. |
| RNF-05 | Nenhum dado financeiro de um usuario pode ser consultado sem filtro por `user_id`. |
| RNF-06 | Senhas nunca devem ser armazenadas em texto puro. |
| RNF-07 | Importacoes devem manter trilha de auditoria. |
| RNF-08 | Falhas de API de precos devem manter ultimo valor conhecido e indicar defasagem. |
| RNF-09 | Calculos financeiros devem distinguir valores confirmados de estimados. |

## Regras anti-duplicidade

- Compra no cartao: natureza `DESPESA`, subtipo `COMPRA`, meio `CARTAO`; pode compor custo conforme categoria.
- Parcela de compra: contabilizada no mes da fatura correspondente, nao necessariamente no mes da compra.
- Pagamento da fatura: natureza `TRANSFERENCIA`, subtipo `PAGAMENTO_FATURA`; nao compoe custo quando compras/parcelas ja foram contabilizadas.
- Transferencia para caixinha: natureza `TRANSFERENCIA`, subtipo `TRANSFERENCIA_RESERVA`; nao compoe custo de vida.
- Caixinha/reserva: conta ou finalidade patrimonial, nao categoria de custo por padrao.
- Cashback real: evento financeiro confirmado; pode compor ganhos confirmados.
- Cashback estimado: calculo identificado como `ESTIMADO`; nao aumenta saldo nem patrimonio.
- Cashback estimado nao possui `transaction_id` e nao e contabilizavel. Cashback real confirmado possui `transaction_id` e e contabilizavel.
- Rendimento de caixinha: natureza `RECEITA`, subtipo `RENDIMENTO`, separado de cashback.
- Dividendo: natureza `RECEITA`, subtipo `DIVIDENDO`, separado de cashback e rendimento.
- Reinvestimento: natureza `INVESTIMENTO`, subtipo `REINVESTIMENTO`, fora de custo de vida.
- Aporte: natureza `INVESTIMENTO`, subtipo `APORTE`, fora de custo de vida.

## Criterios de aceite

| ID | Criterio |
| --- | --- |
| CA-01 | Dado um usuario nao autenticado, quando tentar acessar o Dashboard, entao o sistema deve bloquear o acesso e solicitar login. |
| CA-02 | Dado um usuario autenticado, quando consultar dados financeiros, entao apenas registros com seu `user_id` devem ser usados. |
| CA-03 | Dado um usuario autenticado, quando tentar acessar registro de outro usuario, entao o sistema deve negar a operacao. |
| CA-04 | Dada uma movimentacao importada, quando ela for classificada, entao natureza, subtipo/finalidade, meio/origem e estado devem ser armazenados separadamente. |
| CA-05 | Dada uma compra no cartao e seu pagamento de fatura, quando calcular custo de vida, entao somente a compra/parcela contabilizada pode compor despesa. |
| CA-06 | Dada uma compra parcelada, quando houver parcelas em meses diferentes de fatura, entao cada parcela deve ser contabilizada no respectivo mes da fatura. |
| CA-07 | Dada uma compra com data de compra, fechamento e vencimento da fatura, quando gerar parcelas, entao o mes da fatura deve respeitar a regra de fechamento do cartao. |
| CA-08 | Dada uma transferencia para caixinha, quando calcular custo de vida, entao ela nao deve entrar como despesa. |
| CA-09 | Dado cashback real confirmado, quando abrir Dashboard, entao ele deve aparecer separado e tambem no total consolidado de cashback confirmado. |
| CA-10 | Dado cashback estimado, quando abrir Dashboard, entao ele deve aparecer identificado como estimado e nao deve aumentar saldo ou patrimonio confirmado. |
| CA-11 | Dado cartao historico inativo, quando importar historico antigo, entao os lancamentos devem ser preservados sem tornar o cartao ativo. |
| CA-12 | Dado dividendo recebido, quando abrir Dashboard, entao ele deve aparecer como receita de investimento separada de cashback e rendimento de caixinha. |
| CA-13 | Dado aporte ou reinvestimento, quando abrir Dashboard, entao ele deve aparecer como movimentacao de investimento fora de custo de vida. |
| CA-14 | Dada cotacao defasada, quando exibir valor atual de ativo, entao o Dashboard deve indicar que o preco esta desatualizado. |
| CA-15 | Dado arquivo ja importado, quando processar novamente o mesmo arquivo, entao o sistema nao deve duplicar lancamentos. |
| CA-16 | Dado lancamento repetido em versao diferente da planilha, quando importar, entao o fingerprint logico deve detectar possivel duplicidade e enviar para revisao ou bloquear duplicacao. |
| CA-17 | Dada linha ambigua, quando importar, entao ela deve aparecer como `PENDENTE_REVISAO`. |
| CA-18 | Dado lote importado com regras sugeridas, quando o usuario aprovar em lote, entao os itens afetados devem mudar para estado confirmado conforme a regra aprovada. |
| CA-19 | Dado lote importado, quando o usuario rejeitar em lote, entao os itens rejeitados nao devem gerar registros financeiros definitivos. |
| CA-20 | Dado lote confirmado, quando gerar relatorio final, entao o relatorio deve listar aceitos, rejeitados e pendentes. |
| CA-21 | Dada uma transferencia entre contas, quando calcular patrimonio consolidado, entao o saldo da origem deve diminuir, o saldo do destino deve aumentar e o patrimonio total deve permanecer igual. |
| CA-22 | Dada uma caixinha com saldo inicial, entradas confirmadas e saidas confirmadas, quando calcular saldo final, entao o resultado deve ser saldo inicial mais entradas menos saidas. |
| CA-23 | Dada compra parcelada antes do fechamento do cartao, quando gerar parcelas, entao a primeira parcela deve entrar na fatura do ciclo vigente conforme fechamento configurado. |
| CA-24 | Dada compra parcelada depois do fechamento do cartao, quando gerar parcelas, entao a primeira parcela deve entrar na proxima fatura. |
| CA-25 | Dado cashback estimado, quando calcular saldos e patrimonio, entao ele nao deve ser contabilizado como valor confirmado. |
| CA-26 | Dado dividendo, cashback real ou rendimento com tabela especializada, quando calcular Dashboard, entao o valor deve ser somado pela `transaction` correspondente uma unica vez. |
| CA-27 | Dado arquivo atualizado com lancamento ja existente em versao anterior, quando importar, entao o `logical_fingerprint` deve detectar duplicidade provavel e impedir confirmacao duplicada sem revisao. |
| CA-28 | Dado rollback de lote confirmado, quando executado, entao registros financeiros devem ser marcados como cancelados/estornados ou vinculados a reversao, permanecendo auditaveis e fora dos totais confirmados. |
| CA-29 | Dada tentativa de associar cartao, conta, ativo ou categoria de outro usuario, quando salvar registro financeiro, entao o sistema deve rejeitar a operacao. |
| CA-30 | Dado periodo de 12 meses com dividendos em apenas 8 meses, quando calcular media mensal de dividendos do periodo, entao o denominador deve ser 12. |
| CA-31 | Dado lote `STAGED`, `READY_FOR_REVIEW` ou `CONFIRMED`, quando outro lote do mesmo usuario e mesmo arquivo for criado como ativo, entao o sistema deve rejeitar. |
| CA-32 | Dado lote `FAILED` ou `ROLLED_BACK`, quando o mesmo arquivo for processado novamente pelo mesmo usuario, entao o sistema deve permitir nova tentativa auditavel. |
| CA-33 | Dada transacao de um usuario, quando anulada, entao `voided_by` deve ser nulo ou igual ao proprio `user_id`, com `voided_at` preenchido quando houver anulacao. |
| CA-34 | Dado lote confirmado, quando persistido, entao `confirmed_by` deve ser igual ao proprio `user_id` e `confirmed_at` deve estar preenchido. |

## Fora do escopo

- Conexao bancaria automatica.
- Reproducao visual da aba Consolidado.
- Reproducao da aba FisWebDriver como pagina.
- Escolha definitiva de provedor de login.
- API paga de cotacoes.
- CRUD completo de carteira de investimentos.
- Multiusuario comercial completo com planos e cobranca.
- Controle completo de receitas recorrentes, salvo decisao posterior.

## Riscos

- Ambiguidade historica em linhas da planilha.
- Dados de 2020 a 2026 podem exigir parser detalhado para preservar categorias, competencias e parcelas com precisao.
- API gratuita de cotacoes pode falhar, atrasar ou impor limites.
- Escolha prematura de banco/provedor de login pode acoplar a arquitetura.
- Erros de classificacao podem distorcer custo de vida e patrimonio.
- Parcelamento e mes de fatura podem divergir do mes da compra se a regra de fechamento nao for bem definida.
- Cashback estimado pode ser confundido com valor real se a UI nao sinalizar claramente.

## Evolucao futura

- CRUD completo de categorias, contas, cartoes e ativos.
- Controle completo de receitas.
- API de cotacoes configuravel.
- Multiusuario com permissoes e compartilhamento familiar.
- Relatorios anuais e comparativos.
- Exportacao de dados.
- Alertas de fatura, metas e divergencias.

## Em aberto

| Tema | Alternativas | Recomendacao |
| --- | --- | --- |
| Provedor de login | Auth.js, Clerk, Cloudflare Access, Supabase Auth | Avaliar antes da implementacao; login e obrigatorio no MVP, mas o provedor ainda nao esta definido. |
| Banco de producao | Cloudflare D1, Postgres, LibSQL/Turso | Manter repository interface; decidir apos confirmar plataforma de deploy. |
| Cotacoes | API gratuita, scraping controlado, entrada manual | Comecar com API gratuita + ultimo preco conhecido + entrada manual. |
| Receitas completas | Incluir receitas no MVP ou limitar a dividendos/cashback/rendimentos | Recomendacao: MVP usa "saidas e movimentacoes do mes"; receitas completas ficam fora ate decisao explicita. |
| Regra exata de fechamento por cartao | Configurar por cartao ou derivar da planilha | Recomendacao: configurar fechamento e vencimento por cartao. |

## Matriz de rastreabilidade

| Requisito | Regra de negocio | Entidade | Documento | Criterio de aceite |
| --- | --- | --- | --- | --- |
| RF-01 | Login obrigatorio | `users`, sessao/auth | ARCHITECTURE.md | CA-01 |
| RF-02 | Isolamento por usuario | `users`, todas financeiras | DATA_MODEL.md | CA-02 |
| RF-03 | Bloqueio cross-user | `users`, repositories | ARCHITECTURE.md | CA-03 |
| RF-04 | Dashboard separado por natureza | `transactions`, `categories`, eventos | DASHBOARD_RULES.md | CA-05, CA-08, CA-12, CA-13 |
| RF-05 | Classificacao conceitual separada | `transactions`, `import_rows` | DATA_MODEL.md | CA-04 |
| RF-06 | Anti-duplicidade fatura | `transactions`, `cards` | DASHBOARD_RULES.md | CA-05 |
| RF-07 | Transferencia para caixinha neutra | `accounts`, `transactions` | DASHBOARD_RULES.md | CA-08 |
| RF-08 | Compras parceladas e fatura | `cards`, `transactions` | DATA_MODEL.md | CA-06, CA-07 |
| RF-09 | Parcela no mes da fatura | `transactions`, `cards` | DASHBOARD_RULES.md | CA-06 |
| RF-10 | Cashback real e estimado | `card_rules`, `cashback_events` | DATA_MODEL.md | CA-09, CA-10 |
| RF-11 | Estimativa nao confirma patrimonio | `cashback_events` | DASHBOARD_RULES.md | CA-10 |
| RF-12 | Cartoes ativos configuraveis | `cards`, `card_rules` | DATA_MODEL.md | CA-09 |
| RF-13 | Cartoes historicos inativos | `cards` | IMPORT_STRATEGY.md | CA-11 |
| RF-14 | Dividendos no Dashboard | `dividend_events`, `assets` | DASHBOARD_RULES.md | CA-12 |
| RF-15 | Aportes e reinvestimentos | `investments`, `transactions` | DASHBOARD_RULES.md | CA-13 |
| RF-16 | Cotacao defasada | `asset_prices` | ARCHITECTURE.md | CA-14 |
| RF-17 | Revisao em lote | `import_rows`, `classification_rules` | IMPORT_STRATEGY.md | CA-17, CA-18 |
| RF-18 | Confirmacao/rejeicao de lote | `import_batches`, `import_rows` | IMPORT_STRATEGY.md | CA-18, CA-19, CA-20 |
| RF-19 | Idempotencia ampliada | `import_batches`, `import_rows`, `transactions` | IMPORT_STRATEGY.md | CA-15, CA-16 |
| RF-20 | Planilha como fonte, nao banco | `import_batches`, `import_rows` | IMPORT_STRATEGY.md | CA-20 |
| RF-21 | Relatorio de importacao | `import_batches`, `import_rows` | IMPORT_STRATEGY.md | CA-20 |
| RF-22 | Fonte unica de totais | `transactions` | DATA_MODEL.md | CA-26 |
| RF-23 | Extensoes sem dupla soma | `transactions`, tabelas especializadas | DATA_MODEL.md | CA-26 |
| RF-24 | Transferencia preserva patrimonio | `accounts`, `transactions` | DASHBOARD_RULES.md | CA-21, CA-22 |
| RF-25 | Rollback auditavel | `import_batches`, `transactions` | IMPORT_STRATEGY.md | CA-28 |
| RF-26 | Um lote ativo por arquivo | `import_batches` | IMPORT_STRATEGY.md | CA-31, CA-32 |
| RF-27 | Auditoria restrita ao proprietario | `transactions`, `import_batches` | DATA_MODEL.md | CA-33, CA-34 |
