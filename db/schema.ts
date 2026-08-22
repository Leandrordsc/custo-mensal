import { sql } from "drizzle-orm";
import { check, foreignKey, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    accountType: text("account_type", { enum: ["CONTA", "CAIXINHA", "RESERVA", "INVESTIMENTO"] }).notNull(),
    currency: text("currency").notNull().default("BRL"),
    openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
    balanceDate: text("balance_date").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => ({
    userIdIdx: uniqueIndex("accounts_user_id_idx").on(table.userId, table.id),
    userNameIdx: uniqueIndex("accounts_user_name_idx").on(table.userId, table.name),
    accountTypeCheck: check("accounts_account_type_check", sql`${table.accountType} in ('CONTA', 'CAIXINHA', 'RESERVA', 'INVESTIMENTO')`),
    currencyCheck: check("accounts_currency_check", sql`length(${table.currency}) = 3`),
  }),
);

export const cards = sqliteTable(
  "cards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    issuer: text("issuer"),
    status: text("status", { enum: ["ATIVO", "HISTORICO", "ARQUIVADO"] }).notNull().default("ATIVO"),
    closingDay: integer("closing_day").notNull(),
    dueDay: integer("due_day").notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("cards_user_id_idx").on(table.userId, table.id),
    userNameIdx: uniqueIndex("cards_user_name_idx").on(table.userId, table.name),
    statusCheck: check("cards_status_check", sql`${table.status} in ('ATIVO', 'HISTORICO', 'ARQUIVADO')`),
    closingDayCheck: check("cards_closing_day_check", sql`${table.closingDay} between 1 and 31`),
    dueDayCheck: check("cards_due_day_check", sql`${table.dueDay} between 1 and 31`),
  }),
);

export const cardRules = sqliteTable(
  "card_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    cardId: text("card_id").notNull().references(() => cards.id),
    cashbackRateBps: integer("cashback_rate_bps").notNull(),
    validFrom: text("valid_from").notNull(),
    validTo: text("valid_to"),
  },
  (table) => ({
    userIdIdx: uniqueIndex("card_rules_user_id_idx").on(table.userId, table.id),
    cardPeriodIdx: index("card_rules_card_period_idx").on(table.userId, table.cardId, table.validFrom),
    cardUserFk: foreignKey({
      name: "card_rules_card_user_fk",
      columns: [table.userId, table.cardId],
      foreignColumns: [cards.userId, cards.id],
    }).onDelete("restrict"),
    cashbackRateCheck: check("card_rules_cashback_rate_bps_check", sql`${table.cashbackRateBps} between 0 and 10000`),
  }),
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull(),
    parentId: text("parent_id"),
    countsAsLivingCost: integer("counts_as_living_cost", { mode: "boolean" }).notNull().default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => ({
    userIdIdx: uniqueIndex("categories_user_id_idx").on(table.userId, table.id),
    userNameIdx: uniqueIndex("categories_user_name_idx").on(table.userId, table.name),
    parentUserFk: foreignKey({
      name: "categories_parent_user_fk",
      columns: [table.userId, table.parentId],
      foreignColumns: [table.userId, table.id],
    }).onDelete("restrict"),
    parentNotSelfCheck: check("categories_parent_not_self_check", sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`),
  }),
);

export const assets = sqliteTable(
  "assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    ticker: text("ticker"),
    name: text("name").notNull(),
    assetClass: text("asset_class").notNull(),
    exchange: text("exchange"),
    market: text("market"),
    currency: text("currency").notNull().default("BRL"),
  },
  (table) => ({
    userIdIdx: uniqueIndex("assets_user_id_idx").on(table.userId, table.id),
    userTickerIdx: uniqueIndex("assets_user_ticker_market_idx").on(table.userId, table.ticker, table.exchange, table.market),
    currencyCheck: check("assets_currency_check", sql`length(${table.currency}) = 3`),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    nature: text("nature", { enum: ["DESPESA", "RECEITA", "TRANSFERENCIA", "INVESTIMENTO"] }).notNull(),
    subtype: text("subtype", { enum: ["COMPRA", "APORTE", "REINVESTIMENTO", "PAGAMENTO_FATURA", "TRANSFERENCIA_RESERVA", "DIVIDENDO", "CASHBACK", "RENDIMENTO", "AJUSTE"] }).notNull(),
    origin: text("origin", { enum: ["CONTA", "CARTAO", "CAIXINHA", "IMPORTACAO", "MANUAL"] }).notNull(),
    classificationStatus: text("classification_status", { enum: ["CONFIRMADO", "ESTIMADO", "PENDENTE_REVISAO", "REJEITADO"] }).notNull(),
    transactionStatus: text("transaction_status", { enum: ["ACTIVE", "CANCELADO", "ESTORNADO"] }).notNull().default("ACTIVE"),
    categoryId: text("category_id").references(() => categories.id),
    sourceAccountId: text("source_account_id").references(() => accounts.id),
    targetAccountId: text("target_account_id").references(() => accounts.id),
    cardId: text("card_id").references(() => cards.id),
    assetId: text("asset_id").references(() => assets.id),
    date: text("date").notNull(),
    competenceMonth: text("competence_month").notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("BRL"),
    direction: text("direction", { enum: ["INFLOW", "OUTFLOW", "TRANSFER_OUT", "TRANSFER_IN", "NEUTRAL"] }).notNull(),
    sourceHash: text("source_hash"),
    logicalFingerprint: text("logical_fingerprint"),
    voidedAt: text("voided_at"),
    voidedBy: text("voided_by").references(() => users.id),
    reversalTransactionId: text("reversal_transaction_id"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default("1970-01-01T00:00:00.000Z"),
    updatedAt: text("updated_at").notNull().default("1970-01-01T00:00:00.000Z"),
  },
  (table) => ({
    userIdIdx: uniqueIndex("transactions_user_id_idx").on(table.userId, table.id),
    userDateIdx: index("transactions_user_date_idx").on(table.userId, table.date),
    userCompetenceIdx: index("transactions_user_competence_idx").on(table.userId, table.competenceMonth),
    userClassificationIdx: index("transactions_user_classification_idx").on(table.userId, table.nature, table.subtype, table.competenceMonth),
    userSourceHashIdx: uniqueIndex("transactions_user_source_hash_idx").on(table.userId, table.sourceHash),
    userLogicalFingerprintIdx: index("transactions_user_logical_fingerprint_idx").on(table.userId, table.logicalFingerprint),
    categoryUserFk: foreignKey({
      name: "transactions_category_user_fk",
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }).onDelete("restrict"),
    sourceAccountUserFk: foreignKey({
      name: "transactions_source_account_user_fk",
      columns: [table.userId, table.sourceAccountId],
      foreignColumns: [accounts.userId, accounts.id],
    }).onDelete("restrict"),
    targetAccountUserFk: foreignKey({
      name: "transactions_target_account_user_fk",
      columns: [table.userId, table.targetAccountId],
      foreignColumns: [accounts.userId, accounts.id],
    }).onDelete("restrict"),
    cardUserFk: foreignKey({
      name: "transactions_card_user_fk",
      columns: [table.userId, table.cardId],
      foreignColumns: [cards.userId, cards.id],
    }).onDelete("restrict"),
    assetUserFk: foreignKey({
      name: "transactions_asset_user_fk",
      columns: [table.userId, table.assetId],
      foreignColumns: [assets.userId, assets.id],
    }).onDelete("restrict"),
    reversalUserFk: foreignKey({
      name: "transactions_reversal_user_fk",
      columns: [table.userId, table.reversalTransactionId],
      foreignColumns: [table.userId, table.id],
    }).onDelete("restrict"),
    natureCheck: check("transactions_nature_check", sql`${table.nature} in ('DESPESA', 'RECEITA', 'TRANSFERENCIA', 'INVESTIMENTO')`),
    subtypeCheck: check("transactions_subtype_check", sql`${table.subtype} in ('COMPRA', 'APORTE', 'REINVESTIMENTO', 'PAGAMENTO_FATURA', 'TRANSFERENCIA_RESERVA', 'DIVIDENDO', 'CASHBACK', 'RENDIMENTO', 'AJUSTE')`),
    originCheck: check("transactions_origin_check", sql`${table.origin} in ('CONTA', 'CARTAO', 'CAIXINHA', 'IMPORTACAO', 'MANUAL')`),
    classificationStatusCheck: check("transactions_classification_status_check", sql`${table.classificationStatus} in ('CONFIRMADO', 'ESTIMADO', 'PENDENTE_REVISAO', 'REJEITADO')`),
    transactionStatusCheck: check("transactions_transaction_status_check", sql`${table.transactionStatus} in ('ACTIVE', 'CANCELADO', 'ESTORNADO')`),
    directionCheck: check("transactions_direction_check", sql`${table.direction} in ('INFLOW', 'OUTFLOW', 'TRANSFER_OUT', 'TRANSFER_IN', 'NEUTRAL')`),
    currencyCheck: check("transactions_currency_check", sql`length(${table.currency}) = 3`),
    amountCheck: check("transactions_amount_cents_check", sql`${table.amountCents} >= 0`),
    reversalNotSelfCheck: check("transactions_reversal_not_self_check", sql`${table.reversalTransactionId} is null or ${table.reversalTransactionId} <> ${table.id}`),
    voidedAuditCheck: check(
      "transactions_voided_audit_check",
      sql`((${table.voidedAt} is null and ${table.voidedBy} is null) or (${table.voidedAt} is not null and ${table.voidedBy} is not null and ${table.voidedBy} = ${table.userId}))`,
    ),
  }),
);

export const cardPurchases = sqliteTable(
  "card_purchases",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    cardId: text("card_id").notNull().references(() => cards.id),
    purchaseDate: text("purchase_date").notNull(),
    description: text("description").notNull(),
    totalAmountCents: integer("total_amount_cents").notNull(),
    totalInstallments: integer("total_installments").notNull().default(1),
    currency: text("currency").notNull().default("BRL"),
    parentPurchaseId: text("parent_purchase_id"),
  },
  (table) => ({
    userIdIdx: uniqueIndex("card_purchases_user_id_idx").on(table.userId, table.id),
    cardUserFk: foreignKey({
      name: "card_purchases_card_user_fk",
      columns: [table.userId, table.cardId],
      foreignColumns: [cards.userId, cards.id],
    }).onDelete("restrict"),
    parentUserFk: foreignKey({
      name: "card_purchases_parent_user_fk",
      columns: [table.userId, table.parentPurchaseId],
      foreignColumns: [table.userId, table.id],
    }).onDelete("restrict"),
    amountCheck: check("card_purchases_total_amount_cents_check", sql`${table.totalAmountCents} >= 0`),
    currencyCheck: check("card_purchases_currency_check", sql`length(${table.currency}) = 3`),
    installmentsCheck: check("card_purchases_total_installments_check", sql`${table.totalInstallments} >= 1`),
    parentNotSelfCheck: check("card_purchases_parent_not_self_check", sql`${table.parentPurchaseId} is null or ${table.parentPurchaseId} <> ${table.id}`),
  }),
);

export const cardStatements = sqliteTable(
  "card_statements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    cardId: text("card_id").notNull().references(() => cards.id),
    statementMonth: text("statement_month").notNull(),
    closingDate: text("closing_date").notNull(),
    dueDate: text("due_date").notNull(),
    paymentTransactionId: text("payment_transaction_id").references(() => transactions.id),
  },
  (table) => ({
    userIdIdx: uniqueIndex("card_statements_user_id_idx").on(table.userId, table.id),
    userCardMonthIdx: uniqueIndex("card_statements_user_card_month_idx").on(table.userId, table.cardId, table.statementMonth),
    cardUserFk: foreignKey({
      name: "card_statements_card_user_fk",
      columns: [table.userId, table.cardId],
      foreignColumns: [cards.userId, cards.id],
    }).onDelete("restrict"),
    paymentTransactionUserFk: foreignKey({
      name: "card_statements_payment_transaction_user_fk",
      columns: [table.userId, table.paymentTransactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
  }),
);

export const cardInstallments = sqliteTable(
  "card_installments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    cardPurchaseId: text("card_purchase_id").notNull().references(() => cardPurchases.id),
    cardStatementId: text("card_statement_id").references(() => cardStatements.id),
    transactionId: text("transaction_id").notNull().references(() => transactions.id),
    installmentNumber: integer("installment_number").notNull(),
    totalInstallments: integer("total_installments").notNull(),
    statementMonth: text("statement_month").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("card_installments_user_id_idx").on(table.userId, table.id),
    userPurchaseInstallmentIdx: uniqueIndex("card_installments_user_purchase_number_idx").on(table.userId, table.cardPurchaseId, table.installmentNumber),
    transactionIdx: uniqueIndex("card_installments_transaction_idx").on(table.transactionId),
    purchaseUserFk: foreignKey({
      name: "card_installments_purchase_user_fk",
      columns: [table.userId, table.cardPurchaseId],
      foreignColumns: [cardPurchases.userId, cardPurchases.id],
    }).onDelete("restrict"),
    statementUserFk: foreignKey({
      name: "card_installments_statement_user_fk",
      columns: [table.userId, table.cardStatementId],
      foreignColumns: [cardStatements.userId, cardStatements.id],
    }).onDelete("restrict"),
    transactionUserFk: foreignKey({
      name: "card_installments_transaction_user_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    amountCheck: check("card_installments_amount_cents_check", sql`${table.amountCents} >= 0`),
    installmentNumberCheck: check("card_installments_installment_number_check", sql`${table.installmentNumber} >= 1`),
    totalInstallmentsCheck: check("card_installments_total_installments_check", sql`${table.totalInstallments} >= 1`),
    installmentBoundsCheck: check("card_installments_bounds_check", sql`${table.installmentNumber} <= ${table.totalInstallments}`),
  }),
);

export const investmentEvents = sqliteTable(
  "investment_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    transactionId: text("transaction_id").notNull().references(() => transactions.id),
    assetId: text("asset_id").notNull().references(() => assets.id),
    quantityDecimal: text("quantity_decimal"),
    unitPriceDecimal: text("unit_price_decimal"),
    exchangeRateDecimal: text("exchange_rate_decimal"),
    grossAmountCents: integer("gross_amount_cents").notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("investment_events_user_id_idx").on(table.userId, table.id),
    transactionIdx: uniqueIndex("investment_events_transaction_idx").on(table.transactionId),
    userAssetIdx: index("investment_events_user_asset_idx").on(table.userId, table.assetId),
    transactionUserFk: foreignKey({
      name: "investment_events_transaction_user_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    assetUserFk: foreignKey({
      name: "investment_events_asset_user_fk",
      columns: [table.userId, table.assetId],
      foreignColumns: [assets.userId, assets.id],
    }).onDelete("restrict"),
    grossAmountCheck: check("investment_events_gross_amount_cents_check", sql`${table.grossAmountCents} >= 0`),
  }),
);

export const dividendEvents = sqliteTable(
  "dividend_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    transactionId: text("transaction_id").notNull().references(() => transactions.id),
    assetId: text("asset_id").notNull().references(() => assets.id),
    declaredDate: text("declared_date"),
    paymentDate: text("payment_date").notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("dividend_events_user_id_idx").on(table.userId, table.id),
    transactionIdx: uniqueIndex("dividend_events_transaction_idx").on(table.transactionId),
    userAssetPaymentIdx: index("dividend_events_user_asset_payment_idx").on(table.userId, table.assetId, table.paymentDate),
    transactionUserFk: foreignKey({
      name: "dividend_events_transaction_user_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    assetUserFk: foreignKey({
      name: "dividend_events_asset_user_fk",
      columns: [table.userId, table.assetId],
      foreignColumns: [assets.userId, assets.id],
    }).onDelete("restrict"),
  }),
);

export const cashbackEvents = sqliteTable(
  "cashback_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    transactionId: text("transaction_id").references(() => transactions.id),
    cardId: text("card_id").notNull().references(() => cards.id),
    month: text("month").notNull(),
    amountCents: integer("amount_cents").notNull(),
    valueType: text("value_type", { enum: ["REAL", "ESTIMADO"] }).notNull(),
    ruleId: text("rule_id").references(() => cardRules.id),
    contabilizable: integer("contabilizable", { mode: "boolean" }).notNull().default(false),
  },
  (table) => ({
    userIdIdx: uniqueIndex("cashback_events_user_id_idx").on(table.userId, table.id),
    transactionIdx: uniqueIndex("cashback_events_transaction_idx").on(table.transactionId),
    userCardMonthIdx: index("cashback_events_user_card_month_idx").on(table.userId, table.cardId, table.month),
    transactionUserFk: foreignKey({
      name: "cashback_events_transaction_user_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    cardUserFk: foreignKey({
      name: "cashback_events_card_user_fk",
      columns: [table.userId, table.cardId],
      foreignColumns: [cards.userId, cards.id],
    }).onDelete("restrict"),
    ruleUserFk: foreignKey({
      name: "cashback_events_rule_user_fk",
      columns: [table.userId, table.ruleId],
      foreignColumns: [cardRules.userId, cardRules.id],
    }).onDelete("restrict"),
    valueTypeCheck: check("cashback_events_value_type_check", sql`${table.valueType} in ('REAL', 'ESTIMADO')`),
    amountCheck: check("cashback_events_amount_cents_check", sql`${table.amountCents} >= 0`),
    contabilizableCheck: check("cashback_events_contabilizable_check", sql`${table.contabilizable} in (0, 1)`),
    valueConsistencyCheck: check(
      "cashback_events_value_consistency_check",
      sql`((${table.valueType} = 'ESTIMADO' and ${table.transactionId} is null and ${table.contabilizable} = 0) or (${table.valueType} = 'REAL' and ${table.transactionId} is not null and ${table.contabilizable} = 1))`,
    ),
  }),
);

export const reserveEarnings = sqliteTable(
  "reserve_earnings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    transactionId: text("transaction_id").notNull().references(() => transactions.id),
    accountId: text("account_id").notNull().references(() => accounts.id),
    month: text("month").notNull(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("reserve_earnings_user_id_idx").on(table.userId, table.id),
    transactionIdx: uniqueIndex("reserve_earnings_transaction_idx").on(table.transactionId),
    userAccountMonthIdx: index("reserve_earnings_user_account_month_idx").on(table.userId, table.accountId, table.month),
    transactionUserFk: foreignKey({
      name: "reserve_earnings_transaction_user_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    accountUserFk: foreignKey({
      name: "reserve_earnings_account_user_fk",
      columns: [table.userId, table.accountId],
      foreignColumns: [accounts.userId, accounts.id],
    }).onDelete("restrict"),
  }),
);

export const assetPrices = sqliteTable(
  "asset_prices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    assetId: text("asset_id").notNull().references(() => assets.id),
    priceDecimal: text("price_decimal").notNull(),
    currency: text("currency").notNull().default("BRL"),
    quotedAt: text("quoted_at").notNull(),
    provider: text("provider").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    isStale: integer("is_stale", { mode: "boolean" }).notNull().default(false),
    sourceHash: text("source_hash"),
  },
  (table) => ({
    userIdIdx: uniqueIndex("asset_prices_user_id_idx").on(table.userId, table.id),
    userAssetFetchedIdx: index("asset_prices_user_asset_fetched_idx").on(table.userId, table.assetId, table.fetchedAt),
    assetUserFk: foreignKey({
      name: "asset_prices_asset_user_fk",
      columns: [table.userId, table.assetId],
      foreignColumns: [assets.userId, assets.id],
    }).onDelete("restrict"),
    currencyCheck: check("asset_prices_currency_check", sql`length(${table.currency}) = 3`),
  }),
);

export const exchangeRates = sqliteTable(
  "exchange_rates",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    baseCurrency: text("base_currency").notNull(),
    quoteCurrency: text("quote_currency").notNull(),
    rateDecimal: text("rate_decimal").notNull(),
    referenceDate: text("reference_date").notNull(),
    provider: text("provider").notNull(),
    fetchedAt: text("fetched_at").notNull(),
    isStale: integer("is_stale", { mode: "boolean" }).notNull().default(false),
    sourceHash: text("source_hash"),
  },
  (table) => ({
    userIdIdx: uniqueIndex("exchange_rates_user_id_idx").on(table.userId, table.id),
    userPairReferenceIdx: index("exchange_rates_user_pair_reference_idx").on(table.userId, table.baseCurrency, table.quoteCurrency, table.referenceDate),
    currencyPairCheck: check("exchange_rates_currency_pair_check", sql`length(${table.baseCurrency}) = 3 and length(${table.quoteCurrency}) = 3 and ${table.baseCurrency} <> ${table.quoteCurrency}`),
    staleCheck: check("exchange_rates_is_stale_check", sql`${table.isStale} in (0, 1)`),
    rateCheck: check("exchange_rates_rate_decimal_check", sql`cast(${table.rateDecimal} as real) > 0`),
  }),
);

export const importBatches = sqliteTable(
  "import_batches",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    sourceFileName: text("source_file_name").notNull(),
    sourceFileSize: integer("source_file_size").notNull(),
    fileHash: text("file_hash").notNull(),
    parserVersion: text("parser_version").notNull(),
    status: text("status", { enum: ["STAGED", "READY_FOR_REVIEW", "CONFIRMED", "FAILED", "ROLLED_BACK"] }).notNull().default("STAGED"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    confirmedAt: text("confirmed_at"),
    confirmedBy: text("confirmed_by").references(() => users.id),
    errorSummary: text("error_summary"),
    rowsTotal: integer("rows_total").notNull().default(0),
    rowsAccepted: integer("rows_accepted").notNull().default(0),
    rowsRejected: integer("rows_rejected").notNull().default(0),
    rowsPending: integer("rows_pending").notNull().default(0),
  },
  (table) => ({
    userIdIdx: uniqueIndex("import_batches_user_id_idx").on(table.userId, table.id),
    userFileHashIdx: index("import_batches_user_file_hash_idx").on(table.userId, table.fileHash),
    activeFileHashIdx: uniqueIndex("import_batches_user_active_file_hash_idx").on(table.userId, table.fileHash).where(sql`${table.status} in ('STAGED', 'READY_FOR_REVIEW', 'CONFIRMED')`),
    statusCheck: check("import_batches_status_check", sql`${table.status} in ('STAGED', 'READY_FOR_REVIEW', 'CONFIRMED', 'FAILED', 'ROLLED_BACK')`),
    sourceFileSizeCheck: check("import_batches_source_file_size_check", sql`${table.sourceFileSize} >= 0`),
    countersCheck: check("import_batches_counters_check", sql`${table.rowsTotal} >= 0 and ${table.rowsAccepted} >= 0 and ${table.rowsRejected} >= 0 and ${table.rowsPending} >= 0`),
    confirmedAuditCheck: check(
      "import_batches_confirmed_audit_check",
      sql`((${table.status} = 'CONFIRMED' and ${table.confirmedAt} is not null and ${table.confirmedBy} is not null and ${table.confirmedBy} = ${table.userId}) or (${table.status} <> 'CONFIRMED' and ${table.confirmedAt} is null and ${table.confirmedBy} is null))`,
    ),
  }),
);

export const importRows = sqliteTable(
  "import_rows",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    batchId: text("batch_id").notNull().references(() => importBatches.id),
    sheetName: text("sheet_name").notNull(),
    cellRef: text("cell_ref"),
    rawLabel: text("raw_label"),
    rawValue: text("raw_value"),
    rawRowHash: text("raw_row_hash").notNull(),
    logicalFingerprint: text("logical_fingerprint").notNull(),
    suggestedNature: text("suggested_nature", { enum: ["DESPESA", "RECEITA", "TRANSFERENCIA", "INVESTIMENTO"] }),
    suggestedSubtype: text("suggested_subtype", { enum: ["COMPRA", "APORTE", "REINVESTIMENTO", "PAGAMENTO_FATURA", "TRANSFERENCIA_RESERVA", "DIVIDENDO", "CASHBACK", "RENDIMENTO", "AJUSTE"] }),
    suggestedOrigin: text("suggested_origin", { enum: ["CONTA", "CARTAO", "CAIXINHA", "IMPORTACAO", "MANUAL"] }),
    classificationStatus: text("classification_status", { enum: ["CONFIRMADO", "ESTIMADO", "PENDENTE_REVISAO", "REJEITADO"] }).notNull(),
    normalizedAmountCents: integer("normalized_amount_cents"),
    status: text("status", { enum: ["PENDENTE", "ACEITO", "REJEITADO", "CONFIRMADO"] }).notNull().default("PENDENTE"),
    issue: text("issue"),
    transactionId: text("transaction_id").references(() => transactions.id),
  },
  (table) => ({
    userIdIdx: uniqueIndex("import_rows_user_id_idx").on(table.userId, table.id),
    userBatchRowHashIdx: uniqueIndex("import_rows_user_batch_row_hash_idx").on(table.userId, table.batchId, table.rawRowHash),
    userLogicalFingerprintIdx: index("import_rows_user_logical_fingerprint_idx").on(table.userId, table.logicalFingerprint),
    batchUserFk: foreignKey({
      name: "import_rows_batch_user_fk",
      columns: [table.userId, table.batchId],
      foreignColumns: [importBatches.userId, importBatches.id],
    }).onDelete("restrict"),
    transactionUserFk: foreignKey({
      name: "import_rows_transaction_user_fk",
      columns: [table.userId, table.transactionId],
      foreignColumns: [transactions.userId, transactions.id],
    }).onDelete("restrict"),
    suggestedNatureCheck: check("import_rows_suggested_nature_check", sql`${table.suggestedNature} is null or ${table.suggestedNature} in ('DESPESA', 'RECEITA', 'TRANSFERENCIA', 'INVESTIMENTO')`),
    suggestedSubtypeCheck: check("import_rows_suggested_subtype_check", sql`${table.suggestedSubtype} is null or ${table.suggestedSubtype} in ('COMPRA', 'APORTE', 'REINVESTIMENTO', 'PAGAMENTO_FATURA', 'TRANSFERENCIA_RESERVA', 'DIVIDENDO', 'CASHBACK', 'RENDIMENTO', 'AJUSTE')`),
    suggestedOriginCheck: check("import_rows_suggested_origin_check", sql`${table.suggestedOrigin} is null or ${table.suggestedOrigin} in ('CONTA', 'CARTAO', 'CAIXINHA', 'IMPORTACAO', 'MANUAL')`),
    classificationStatusCheck: check("import_rows_classification_status_check", sql`${table.classificationStatus} in ('CONFIRMADO', 'ESTIMADO', 'PENDENTE_REVISAO', 'REJEITADO')`),
    statusCheck: check("import_rows_status_check", sql`${table.status} in ('PENDENTE', 'ACEITO', 'REJEITADO', 'CONFIRMADO')`),
    normalizedAmountCheck: check("import_rows_normalized_amount_cents_check", sql`${table.normalizedAmountCents} is null or ${table.normalizedAmountCents} >= 0`),
  }),
);

export const classificationRules = sqliteTable(
  "classification_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    pattern: text("pattern").notNull(),
    nature: text("nature", { enum: ["DESPESA", "RECEITA", "TRANSFERENCIA", "INVESTIMENTO"] }).notNull(),
    subtype: text("subtype", { enum: ["COMPRA", "APORTE", "REINVESTIMENTO", "PAGAMENTO_FATURA", "TRANSFERENCIA_RESERVA", "DIVIDENDO", "CASHBACK", "RENDIMENTO", "AJUSTE"] }).notNull(),
    origin: text("origin", { enum: ["CONTA", "CARTAO", "CAIXINHA", "IMPORTACAO", "MANUAL"] }).notNull(),
    categoryId: text("category_id").references(() => categories.id),
    confidence: integer("confidence").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
  },
  (table) => ({
    userIdIdx: uniqueIndex("classification_rules_user_id_idx").on(table.userId, table.id),
    userPatternIdx: index("classification_rules_user_pattern_idx").on(table.userId, table.pattern),
    categoryUserFk: foreignKey({
      name: "classification_rules_category_user_fk",
      columns: [table.userId, table.categoryId],
      foreignColumns: [categories.userId, categories.id],
    }).onDelete("restrict"),
    natureCheck: check("classification_rules_nature_check", sql`${table.nature} in ('DESPESA', 'RECEITA', 'TRANSFERENCIA', 'INVESTIMENTO')`),
    subtypeCheck: check("classification_rules_subtype_check", sql`${table.subtype} in ('COMPRA', 'APORTE', 'REINVESTIMENTO', 'PAGAMENTO_FATURA', 'TRANSFERENCIA_RESERVA', 'DIVIDENDO', 'CASHBACK', 'RENDIMENTO', 'AJUSTE')`),
    originCheck: check("classification_rules_origin_check", sql`${table.origin} in ('CONTA', 'CARTAO', 'CAIXINHA', 'IMPORTACAO', 'MANUAL')`),
    confidenceCheck: check("classification_rules_confidence_check", sql`${table.confidence} between 0 and 100`),
  }),
);
