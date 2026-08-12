import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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
    userNameIdx: uniqueIndex("accounts_user_name_idx").on(table.userId, table.name),
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
    userNameIdx: uniqueIndex("cards_user_name_idx").on(table.userId, table.name),
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
    cardPeriodIdx: index("card_rules_card_period_idx").on(table.userId, table.cardId, table.validFrom),
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
    userNameIdx: uniqueIndex("categories_user_name_idx").on(table.userId, table.name),
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
    userTickerIdx: uniqueIndex("assets_user_ticker_market_idx").on(table.userId, table.ticker, table.exchange, table.market),
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
  },
  (table) => ({
    userDateIdx: index("transactions_user_date_idx").on(table.userId, table.date),
    userCompetenceIdx: index("transactions_user_competence_idx").on(table.userId, table.competenceMonth),
    userClassificationIdx: index("transactions_user_classification_idx").on(table.userId, table.nature, table.subtype, table.competenceMonth),
    userSourceHashIdx: uniqueIndex("transactions_user_source_hash_idx").on(table.userId, table.sourceHash),
    userLogicalFingerprintIdx: index("transactions_user_logical_fingerprint_idx").on(table.userId, table.logicalFingerprint),
  }),
);

export const cardPurchases = sqliteTable("card_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  cardId: text("card_id").notNull().references(() => cards.id),
  purchaseDate: text("purchase_date").notNull(),
  description: text("description").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull(),
  totalInstallments: integer("total_installments").notNull().default(1),
  currency: text("currency").notNull().default("BRL"),
  parentPurchaseId: text("parent_purchase_id"),
});

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
    userCardMonthIdx: uniqueIndex("card_statements_user_card_month_idx").on(table.userId, table.cardId, table.statementMonth),
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
    userPurchaseInstallmentIdx: uniqueIndex("card_installments_user_purchase_number_idx").on(table.userId, table.cardPurchaseId, table.installmentNumber),
    transactionIdx: uniqueIndex("card_installments_transaction_idx").on(table.transactionId),
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
    transactionIdx: uniqueIndex("investment_events_transaction_idx").on(table.transactionId),
    userAssetIdx: index("investment_events_user_asset_idx").on(table.userId, table.assetId),
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
    transactionIdx: uniqueIndex("dividend_events_transaction_idx").on(table.transactionId),
    userAssetPaymentIdx: index("dividend_events_user_asset_payment_idx").on(table.userId, table.assetId, table.paymentDate),
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
    transactionIdx: uniqueIndex("cashback_events_transaction_idx").on(table.transactionId),
    userCardMonthIdx: index("cashback_events_user_card_month_idx").on(table.userId, table.cardId, table.month),
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
    transactionIdx: uniqueIndex("reserve_earnings_transaction_idx").on(table.transactionId),
    userAccountMonthIdx: index("reserve_earnings_user_account_month_idx").on(table.userId, table.accountId, table.month),
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
    userAssetFetchedIdx: index("asset_prices_user_asset_fetched_idx").on(table.userId, table.assetId, table.fetchedAt),
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
    userFileHashIdx: index("import_batches_user_file_hash_idx").on(table.userId, table.fileHash),
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
    userBatchRowHashIdx: uniqueIndex("import_rows_user_batch_row_hash_idx").on(table.userId, table.batchId, table.rawRowHash),
    userLogicalFingerprintIdx: index("import_rows_user_logical_fingerprint_idx").on(table.userId, table.logicalFingerprint),
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
    userPatternIdx: index("classification_rules_user_pattern_idx").on(table.userId, table.pattern),
  }),
);
