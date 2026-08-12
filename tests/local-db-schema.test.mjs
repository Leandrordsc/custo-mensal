import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

const databasePath = resolve(process.cwd(), process.env.LOCAL_DATABASE_PATH ?? "./data/custo-mensal.local.sqlite");

function openDatabase() {
  assert.equal(existsSync(databasePath), true, `Banco SQLite local nao encontrado em ${databasePath}. Execute npm run db:migrate antes deste teste.`);
  return new DatabaseSync(databasePath, { readOnly: true });
}

test("schema SQLite local contem contrato financeiro normalizado", () => {
  const db = openDatabase();
  const tables = new Set(
    db
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => row.name),
  );

  for (const tableName of [
    "users",
    "accounts",
    "cards",
    "card_rules",
    "categories",
    "transactions",
    "card_purchases",
    "card_installments",
    "card_statements",
    "assets",
    "investment_events",
    "dividend_events",
    "cashback_events",
    "reserve_earnings",
    "asset_prices",
    "import_batches",
    "import_rows",
    "classification_rules",
  ]) {
    assert.equal(tables.has(tableName), true, `Tabela esperada ausente: ${tableName}`);
  }

  for (const legacyTable of ["monthly_expenses", "card_transactions", "investment_transactions"]) {
    assert.equal(tables.has(legacyTable), false, `Tabela legada nao deveria existir: ${legacyTable}`);
  }

  db.close();
});

test("transactions possui eixos de classificacao e campos de idempotencia", () => {
  const db = openDatabase();
  const columns = new Set(db.prepare("pragma table_info(transactions)").all().map((row) => row.name));

  for (const columnName of [
    "user_id",
    "nature",
    "subtype",
    "origin",
    "classification_status",
    "transaction_status",
    "amount_cents",
    "competence_month",
    "logical_fingerprint",
  ]) {
    assert.equal(columns.has(columnName), true, `Coluna esperada ausente em transactions: ${columnName}`);
  }

  assert.equal(columns.has("transaction_type"), false);
  db.close();
});

test("schema SQLite local possui FKs e indices criticos", () => {
  const db = openDatabase();
  const transactionForeignKeys = new Set(db.prepare("pragma foreign_key_list(transactions)").all().map((row) => row.from));
  const transactionIndexes = new Set(db.prepare("pragma index_list(transactions)").all().map((row) => row.name));

  for (const foreignKey of ["user_id", "category_id", "source_account_id", "target_account_id", "card_id", "asset_id", "voided_by"]) {
    assert.equal(transactionForeignKeys.has(foreignKey), true, `FK esperada ausente em transactions: ${foreignKey}`);
  }

  for (const indexName of [
    "transactions_user_date_idx",
    "transactions_user_competence_idx",
    "transactions_user_classification_idx",
    "transactions_user_source_hash_idx",
    "transactions_user_logical_fingerprint_idx",
  ]) {
    assert.equal(transactionIndexes.has(indexName), true, `Indice esperado ausente em transactions: ${indexName}`);
  }

  for (const [tableName, columnName] of [
    ["card_installments", "transaction_id"],
    ["investment_events", "transaction_id"],
    ["dividend_events", "transaction_id"],
    ["cashback_events", "transaction_id"],
    ["reserve_earnings", "transaction_id"],
  ]) {
    const indexes = db.prepare(`pragma index_list(${tableName})`).all();
    const hasUniqueTransactionIndex = indexes.some((row) => {
      if (!row.unique) {
        return false;
      }

      return db.prepare(`pragma index_info(${row.name})`).all().some((column) => column.name === columnName);
    });

    assert.equal(hasUniqueTransactionIndex, true, `Indice unico esperado para ${tableName}.${columnName}`);
  }

  db.close();
});

test("tabelas financeiras possuem user_id obrigatorio", () => {
  const db = openDatabase();

  for (const tableName of [
    "accounts",
    "cards",
    "card_rules",
    "categories",
    "transactions",
    "card_purchases",
    "card_installments",
    "card_statements",
    "assets",
    "investment_events",
    "dividend_events",
    "cashback_events",
    "reserve_earnings",
    "asset_prices",
    "import_batches",
    "import_rows",
    "classification_rules",
  ]) {
    const userIdColumn = db.prepare(`pragma table_info(${tableName})`).all().find((row) => row.name === "user_id");
    assert.ok(userIdColumn, `Tabela sem user_id: ${tableName}`);
    assert.equal(userIdColumn.notnull, 1, `user_id deve ser obrigatorio em ${tableName}`);
  }

  db.close();
});
