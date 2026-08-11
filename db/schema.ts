import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const expenseCategories = sqliteTable("expense_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["expense", "investment_transfer", "card_payment", "reserve", "review"] }).notNull().default("expense"),
  sourceLabel: text("source_label"),
});

export const monthlyExpenses = sqliteTable(
  "monthly_expenses",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    categoryId: integer("category_id").references(() => expenseCategories.id),
    sourceLabel: text("source_label").notNull(),
    amount: real("amount").notNull(),
    sourceSheet: text("source_sheet").notNull(),
    sourceCell: text("source_cell"),
  },
  (table) => ({
    sourceIdx: uniqueIndex("monthly_expenses_source_idx").on(table.sourceSheet, table.sourceCell),
  }),
);

export const cards = sqliteTable("cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  issuer: text("issuer"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const cardTransactions = sqliteTable("card_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").references(() => cards.id),
  date: text("date").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  transferredToBox: integer("transferred_to_box", { mode: "boolean" }).notNull().default(false),
  sourceSheet: text("source_sheet"),
  sourceRow: integer("source_row"),
});

export const cardMonthlySummaries = sqliteTable("card_monthly_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id").references(() => cards.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  invoiceAmount: real("invoice_amount").notNull().default(0),
  boxAmount: real("box_amount").notNull().default(0),
  boxYield: real("box_yield").notNull().default(0),
  cashback: real("cashback").notNull().default(0),
});

export const investmentAssets = sqliteTable("investment_assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticker: text("ticker").notNull(),
  name: text("name").notNull(),
  assetClass: text("asset_class").notNull(),
  currency: text("currency").notNull().default("BRL"),
});

export const investmentTransactions = sqliteTable("investment_transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").references(() => investmentAssets.id),
  date: text("date").notNull(),
  type: text("type", { enum: ["aporte", "compra", "venda", "resgate", "ajuste"] }).notNull(),
  quantity: real("quantity"),
  unitPrice: real("unit_price"),
  amount: real("amount").notNull(),
  sourceSheet: text("source_sheet"),
  sourceCell: text("source_cell"),
});

export const assetPrices = sqliteTable("asset_prices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").references(() => investmentAssets.id),
  price: real("price").notNull(),
  currency: text("currency").notNull().default("BRL"),
  capturedAt: text("captured_at").notNull(),
  provider: text("provider").notNull(),
});

export const dividendPayments = sqliteTable("dividend_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").references(() => investmentAssets.id),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  amount: real("amount").notNull(),
  sourceSheet: text("source_sheet"),
  sourceCell: text("source_cell"),
});

export const importBatches = sqliteTable("import_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fileName: text("file_name").notNull(),
  importedAt: text("imported_at").notNull(),
  status: text("status", { enum: ["staged", "imported", "failed"] }).notNull().default("staged"),
});

export const importIssues = sqliteTable("import_issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").references(() => importBatches.id),
  sheetName: text("sheet_name").notNull(),
  cellRef: text("cell_ref"),
  severity: text("severity", { enum: ["info", "warning", "error"] }).notNull(),
  message: text("message").notNull(),
  proposedTreatment: text("proposed_treatment").notNull(),
});
