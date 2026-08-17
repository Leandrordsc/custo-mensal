import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applyMigrationAtomically, readLocalMigrations } from "../scripts/migrate-local.mjs";

let migrationsCache;

async function migrations() {
  migrationsCache ??= await readLocalMigrations();
  return migrationsCache;
}

function createTempDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "custo-mensal-db-"));
  const databasePath = join(dir, "test.sqlite");
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");

  return {
    db,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function applyMigrationIndex(db, index) {
  applyMigrationAtomically(db, (await migrations())[index]);
}

async function applyAllMigrations(db) {
  for (const migration of await migrations()) {
    applyMigrationAtomically(db, migration);
  }
}

function insertBaseData(db) {
  db.exec(`
    insert into users (id, email, name, created_at, updated_at) values
      ('user_a', 'a@example.com', 'Usuario A', '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z'),
      ('user_b', 'b@example.com', 'Usuario B', '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z');

    insert into accounts (id, user_id, name, account_type, currency, opening_balance_cents, balance_date, active) values
      ('account_a', 'user_a', 'Conta A', 'CONTA', 'BRL', 0, '2026-01-01', true),
      ('account_b', 'user_b', 'Conta B', 'CONTA', 'BRL', 0, '2026-01-01', true),
      ('reserve_a', 'user_a', 'Caixinha A', 'CAIXINHA', 'BRL', 0, '2026-01-01', true);

    insert into cards (id, user_id, name, issuer, status, closing_day, due_day) values
      ('card_a', 'user_a', 'BTG', 'BTG', 'ATIVO', 20, 10),
      ('card_b', 'user_b', 'Mercado Pago', 'Mercado Pago', 'ATIVO', 15, 5);

    insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from) values
      ('rule_a', 'user_a', 'card_a', 100, '2026-01-01'),
      ('rule_b', 'user_b', 'card_b', 50, '2026-01-01');

    insert into categories (id, user_id, name, counts_as_living_cost, active) values
      ('category_a', 'user_a', 'Moradia', true, true),
      ('category_b', 'user_b', 'Lazer', true, true);

    insert into assets (id, user_id, ticker, name, asset_class, currency) values
      ('asset_a', 'user_a', 'MXRF11', 'MXRF11', 'FII', 'BRL'),
      ('asset_b', 'user_b', 'KNRI11', 'KNRI11', 'FII', 'BRL');

    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      category_id, source_account_id, target_account_id, card_id, asset_id, date,
      competence_month, description, amount_cents, currency, direction
    ) values
      ('tx_card_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'ACTIVE', 'category_a', 'account_a', null, 'card_a', null, '2026-01-10', '2026-01', 'Compra A', 10000, 'BRL', 'OUTFLOW'),
      ('tx_card_b', 'user_b', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'ACTIVE', 'category_b', 'account_b', null, 'card_b', null, '2026-01-10', '2026-01', 'Compra B', 10000, 'BRL', 'OUTFLOW'),
      ('tx_invest_a', 'user_a', 'INVESTIMENTO', 'APORTE', 'CONTA', 'CONFIRMADO', 'ACTIVE', null, 'account_a', null, null, 'asset_a', '2026-01-11', '2026-01', 'Aporte A', 50000, 'BRL', 'OUTFLOW'),
      ('tx_dividend_a', 'user_a', 'RECEITA', 'DIVIDENDO', 'IMPORTACAO', 'CONFIRMADO', 'ACTIVE', null, null, 'account_a', null, 'asset_a', '2026-01-12', '2026-01', 'Dividendo A', 700, 'BRL', 'INFLOW'),
      ('tx_cashback_a', 'user_a', 'RECEITA', 'CASHBACK', 'CARTAO', 'CONFIRMADO', 'ACTIVE', null, null, 'account_a', 'card_a', null, '2026-01-13', '2026-01', 'Cashback A', 100, 'BRL', 'INFLOW'),
      ('tx_earning_a', 'user_a', 'RECEITA', 'RENDIMENTO', 'CAIXINHA', 'CONFIRMADO', 'ACTIVE', null, null, 'reserve_a', null, null, '2026-01-14', '2026-01', 'Rendimento A', 120, 'BRL', 'INFLOW');
  `);
}

function assertRejected(db, sql, message) {
  assert.throws(() => db.exec(sql), /constraint|foreign key|unique|CHECK|cycle/i, message);
}

function assertNoForeignKeyViolations(db) {
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
}

function assertNoPartialMigrationObjects(db) {
  assert.deepEqual(db.prepare("select name, type from sqlite_master where name like '__new_%'").all(), []);
}

test("migrations reais criam schema, indices parciais e triggers em banco novo", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    assertNoForeignKeyViolations(db);

    const tables = new Set(db.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name));
    for (const tableName of ["users", "accounts", "cards", "transactions", "cashback_events", "import_batches", "import_rows"]) {
      assert.equal(tables.has(tableName), true, `Tabela esperada ausente: ${tableName}`);
    }

    assert.ok(db.prepare("select 1 from sqlite_master where type = 'index' and name = 'import_batches_user_active_file_hash_idx'").get());
    assert.ok(db.prepare("select 1 from sqlite_master where type = 'trigger' and name = 'transactions_reversal_no_two_cycle_insert'").get());
    assert.ok(db.prepare("select 1 from sqlite_master where type = 'trigger' and name = 'transactions_reversal_no_two_cycle_update'").get());
  } finally {
    cleanup();
  }
});

test("schema rejeita associacoes cross-user em relacoes compostas criticas", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    insertBaseData(db);

    db.exec("insert into card_purchases (id, user_id, card_id, purchase_date, description, total_amount_cents, total_installments, currency) values ('purchase_a', 'user_a', 'card_a', '2026-01-01', 'Compra A', 10000, 2, 'BRL')");
    db.exec("insert into card_statements (id, user_id, card_id, statement_month, closing_date, due_date, payment_transaction_id) values ('statement_a', 'user_a', 'card_a', '2026-01', '2026-01-20', '2026-02-10', null)");
    db.exec("insert into card_installments (id, user_id, card_purchase_id, card_statement_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('installment_a', 'user_a', 'purchase_a', 'statement_a', 'tx_card_a', 1, 2, '2026-01', 5000)");
    db.exec("insert into investment_events (id, user_id, transaction_id, asset_id, gross_amount_cents) values ('investment_a', 'user_a', 'tx_invest_a', 'asset_a', 50000)");
    db.exec("insert into dividend_events (id, user_id, transaction_id, asset_id, payment_date) values ('dividend_a', 'user_a', 'tx_dividend_a', 'asset_a', '2026-01-12')");
    db.exec("insert into reserve_earnings (id, user_id, transaction_id, account_id, month) values ('earning_a', 'user_a', 'tx_earning_a', 'reserve_a', '2026-01')");
    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_a', 'user_a', 'arquivo.xlsx', 10, 'hash-a', 'v1', 'STAGED', '2026-01-01T00:00:00.000Z')");

    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, target_account_id, date, competence_month, description, amount_cents, currency, direction) values ('bad_target_account', 'user_a', 'TRANSFERENCIA', 'TRANSFERENCIA_RESERVA', 'CONTA', 'CONFIRMADO', 'ACTIVE', 'account_b', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'TRANSFER_IN')", "target_account cross-user deve falhar");
    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, asset_id, date, competence_month, description, amount_cents, currency, direction) values ('bad_tx_asset', 'user_a', 'INVESTIMENTO', 'APORTE', 'CONTA', 'CONFIRMADO', 'ACTIVE', 'asset_b', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW')", "asset cross-user em transaction deve falhar");
    assertRejected(db, "insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from) values ('bad_rule_card', 'user_a', 'card_b', 100, '2026-01-01')", "rule cross-user deve falhar");
    assertRejected(db, "insert into categories (id, user_id, name, parent_id, counts_as_living_cost, active) values ('bad_category_parent', 'user_a', 'Bad', 'category_b', true, true)", "parent category cross-user deve falhar");
    assertRejected(db, "insert into card_purchases (id, user_id, card_id, purchase_date, description, total_amount_cents, total_installments, currency) values ('bad_purchase_card', 'user_a', 'card_b', '2026-01-01', 'bad', 1, 1, 'BRL')", "purchase card cross-user deve falhar");
    assertRejected(db, "insert into card_statements (id, user_id, card_id, statement_month, closing_date, due_date, payment_transaction_id) values ('bad_statement_card', 'user_a', 'card_b', '2026-01', '2026-01-20', '2026-02-10', null)", "statement card cross-user deve falhar");
    assertRejected(db, "insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('bad_installment_purchase', 'user_b', 'purchase_a', 'tx_card_b', 1, 1, '2026-01', 1)", "installment purchase cross-user deve falhar");
    assertRejected(db, "insert into dividend_events (id, user_id, transaction_id, asset_id, payment_date) values ('bad_dividend_asset', 'user_a', 'tx_dividend_a', 'asset_b', '2026-01-12')", "dividend asset cross-user deve falhar");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('bad_cashback_card', 'user_a', 'tx_cashback_a', 'card_b', '2026-01', 1, 'REAL', 'rule_a', true)", "cashback card cross-user deve falhar");
    assertRejected(db, "insert into reserve_earnings (id, user_id, transaction_id, account_id, month) values ('bad_reserve_account', 'user_a', 'tx_earning_a', 'account_b', '2026-01')", "reserve account cross-user deve falhar");
    assertRejected(db, "insert into import_rows (id, user_id, batch_id, sheet_name, raw_row_hash, logical_fingerprint, classification_status, status) values ('bad_import_batch', 'user_b', 'batch_a', '2026', 'row-1', 'fp-1', 'PENDENTE_REVISAO', 'PENDENTE')", "import row batch cross-user deve falhar");
    assertRejected(db, "insert into classification_rules (id, user_id, pattern, nature, subtype, origin, category_id, confidence, active) values ('bad_classification_category', 'user_a', 'bad', 'DESPESA', 'COMPRA', 'MANUAL', 'category_b', 90, true)", "classification category cross-user deve falhar");
  } finally {
    cleanup();
  }
});

test("schema aplica auditoria restrita ao proprietario", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    insertBaseData(db);

    db.exec("insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, voided_at, voided_by) values ('tx_voided_by_owner', 'user_a', 'DESPESA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'CANCELADO', '2026-01-01', '2026-01', 'ok', 1, 'BRL', 'OUTFLOW', '2026-01-02T00:00:00.000Z', 'user_a')");
    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, voided_at, voided_by) values ('tx_voided_by_other', 'user_a', 'DESPESA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'CANCELADO', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW', '2026-01-02T00:00:00.000Z', 'user_b')", "voided_by cross-user deve falhar");
    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, voided_by) values ('tx_voided_without_at', 'user_a', 'DESPESA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'CANCELADO', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW', 'user_a')", "voided_by sem voided_at deve falhar");
    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, voided_at) values ('tx_voided_at_without_by', 'user_a', 'DESPESA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'CANCELADO', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW', '2026-01-02T00:00:00.000Z')", "voided_at sem voided_by deve falhar");

    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at, confirmed_at, confirmed_by) values ('batch_confirmed_owner', 'user_a', 'arquivo.xlsx', 10, 'hash-confirmed-owner', 'v1', 'CONFIRMED', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'user_a')");
    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_staged_null', 'user_a', 'arquivo.xlsx', 10, 'hash-staged-null', 'v1', 'STAGED', '2026-01-01T00:00:00.000Z')");
    assertRejected(db, "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at, confirmed_at, confirmed_by) values ('batch_confirmed_other', 'user_a', 'arquivo.xlsx', 10, 'hash-confirmed-other', 'v1', 'CONFIRMED', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'user_b')", "confirmed_by cross-user deve falhar");
    assertRejected(db, "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at, confirmed_by) values ('batch_confirmed_without_at', 'user_a', 'arquivo.xlsx', 10, 'hash-confirmed-without-at', 'v1', 'CONFIRMED', '2026-01-01T00:00:00.000Z', 'user_a')", "confirmed_by sem confirmed_at deve falhar");
    assertRejected(db, "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at, confirmed_at, confirmed_by) values ('batch_staged_with_confirmation', 'user_a', 'arquivo.xlsx', 10, 'hash-staged-with-confirmation', 'v1', 'STAGED', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'user_a')", "batch nao confirmado nao deve aparentar confirmacao");
  } finally {
    cleanup();
  }
});

test("schema separa cashback real de estimado no banco", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    insertBaseData(db);

    db.exec("insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_estimated_ok', 'user_a', null, 'card_a', '2026-01', 100, 'ESTIMADO', 'rule_a', false)");
    db.exec("insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_real_ok', 'user_a', 'tx_cashback_a', 'card_a', '2026-01', 100, 'REAL', 'rule_a', true)");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_estimated_with_tx', 'user_a', 'tx_cashback_a', 'card_a', '2026-01', 100, 'ESTIMADO', 'rule_a', false)", "cashback estimado com transaction deve falhar");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_estimated_contabilizable', 'user_a', null, 'card_a', '2026-01', 100, 'ESTIMADO', 'rule_a', true)", "cashback estimado contabilizavel deve falhar");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_real_without_tx', 'user_a', null, 'card_a', '2026-01', 100, 'REAL', 'rule_a', true)", "cashback real sem transaction deve falhar");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_real_other_tx', 'user_a', 'tx_card_b', 'card_a', '2026-01', 100, 'REAL', 'rule_a', true)", "cashback real com transaction de outro usuario deve falhar");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_real_not_contabilizable', 'user_a', 'tx_cashback_a', 'card_a', '2026-02', 100, 'REAL', 'rule_a', false)", "cashback real nao contabilizavel deve falhar");
    assertRejected(db, "insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('cashback_boolean_invalid', 'user_a', null, 'card_a', '2026-03', 100, 'ESTIMADO', 'rule_a', 2)", "boolean invalido deve falhar");
  } finally {
    cleanup();
  }
});

test("schema aplica idempotencia de import_batches por lote ativo", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    insertBaseData(db);

    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_staged_a', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'STAGED', '2026-01-01T00:00:00.000Z')");
    assertRejected(db, "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_staged_a2', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'STAGED', '2026-01-01T00:00:00.000Z')", "STAGED + STAGED deve falhar");
    assertRejected(db, "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_ready_a', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'READY_FOR_REVIEW', '2026-01-01T00:00:00.000Z')", "STAGED + READY deve falhar");
    assertRejected(db, "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at, confirmed_at, confirmed_by) values ('batch_confirmed_a', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'CONFIRMED', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z', 'user_a')", "ativo + CONFIRMED deve falhar");

    db.exec("update import_batches set status = 'FAILED' where id = 'batch_staged_a'");
    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_retry_a', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'READY_FOR_REVIEW', '2026-01-03T00:00:00.000Z')");
    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_failed_extra_a', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'FAILED', '2026-01-04T00:00:00.000Z')");
    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_rolled_back_a', 'user_a', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'ROLLED_BACK', '2026-01-05T00:00:00.000Z')");
    db.exec("insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('batch_same_hash_user_b', 'user_b', 'arquivo.xlsx', 10, 'hash-1', 'v1', 'STAGED', '2026-01-01T00:00:00.000Z')");
    assertRejected(db, "update import_batches set status = 'CONFIRMED', confirmed_at = '2026-01-06T00:00:00.000Z', confirmed_by = 'user_a' where id = 'batch_failed_extra_a'", "update para ativo concorrente deve falhar");
  } finally {
    cleanup();
  }
});

test("schema rejeita enums e faixas numericas invalidas", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    insertBaseData(db);

    const invalidStatements = [
      "insert into accounts (id, user_id, name, account_type, currency, opening_balance_cents, balance_date, active) values ('bad_account_type', 'user_a', 'Bad', 'FOO', 'BRL', 0, '2026-01-01', true)",
      "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('bad_nature', 'user_a', 'FOO', 'COMPRA', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW')",
      "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('bad_subtype', 'user_a', 'DESPESA', 'FOO', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW')",
      "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('bad_origin', 'user_a', 'DESPESA', 'COMPRA', 'FOO', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW')",
      "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('bad_tx_status', 'user_a', 'DESPESA', 'COMPRA', 'MANUAL', 'CONFIRMADO', 'FOO', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'OUTFLOW')",
      "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('bad_direction', 'user_a', 'DESPESA', 'COMPRA', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'SIDEWAYS')",
      "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('bad_amount', 'user_a', 'DESPESA', 'COMPRA', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', -1, 'BRL', 'OUTFLOW')",
      "insert into cards (id, user_id, name, status, closing_day, due_day) values ('bad_card_status', 'user_a', 'Bad', 'FOO', 20, 10)",
      "insert into cards (id, user_id, name, status, closing_day, due_day) values ('bad_day_0', 'user_a', 'Bad 0', 'ATIVO', 0, 10)",
      "insert into cards (id, user_id, name, status, closing_day, due_day) values ('bad_day_32', 'user_a', 'Bad 32', 'ATIVO', 20, 32)",
      "insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from) values ('bad_cashback_negative', 'user_a', 'card_a', -1, '2026-01-01')",
      "insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from) values ('bad_cashback_large', 'user_a', 'card_a', 10001, '2026-01-01')",
      "insert into card_purchases (id, user_id, card_id, purchase_date, description, total_amount_cents, total_installments, currency) values ('bad_purchase_amount', 'user_a', 'card_a', '2026-01-01', 'bad', -1, 1, 'BRL')",
      "insert into card_purchases (id, user_id, card_id, purchase_date, description, total_amount_cents, total_installments, currency) values ('bad_purchase_installments', 'user_a', 'card_a', '2026-01-01', 'bad', 1, 0, 'BRL')",
      "insert into investment_events (id, user_id, transaction_id, asset_id, gross_amount_cents) values ('bad_investment_amount', 'user_a', 'tx_invest_a', 'asset_a', -1)",
      "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('bad_batch_status', 'user_a', 'arquivo.xlsx', 10, 'hash-bad-status', 'v1', 'INVALIDO', '2026-01-01T00:00:00.000Z')",
      "insert into import_batches (id, user_id, source_file_name, source_file_size, file_hash, parser_version, status, started_at) values ('bad_batch_size', 'user_a', 'arquivo.xlsx', -1, 'hash-bad-size', 'v1', 'FAILED', '2026-01-01T00:00:00.000Z')",
      "insert into classification_rules (id, user_id, pattern, nature, subtype, origin, confidence, active) values ('bad_rule_confidence', 'user_a', 'bad', 'DESPESA', 'COMPRA', 'MANUAL', 101, true)",
      "insert into classification_rules (id, user_id, pattern, nature, subtype, origin, confidence, active) values ('bad_rule_origin', 'user_a', 'bad2', 'DESPESA', 'COMPRA', 'FOO', 90, true)",
    ];

    for (const statement of invalidStatements) {
      assertRejected(db, statement, `statement deveria falhar: ${statement}`);
    }
  } finally {
    cleanup();
  }
});

test("schema rejeita parent, parcelamento e reversal invalidos", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyAllMigrations(db);
    insertBaseData(db);

    db.exec("insert into categories (id, user_id, name, parent_id, counts_as_living_cost, active) values ('category_child_a', 'user_a', 'Aluguel', 'category_a', true, true)");
    assertRejected(db, "insert into categories (id, user_id, name, parent_id, counts_as_living_cost, active) values ('bad_category_parent_missing', 'user_a', 'Missing', 'missing', true, true)", "parent category inexistente deve falhar");
    assertRejected(db, "insert into categories (id, user_id, name, parent_id, counts_as_living_cost, active) values ('bad_category_parent_self', 'user_a', 'Self', 'bad_category_parent_self', true, true)", "parent category para si deve falhar");

    db.exec("insert into card_purchases (id, user_id, card_id, purchase_date, description, total_amount_cents, total_installments, currency) values ('purchase_a', 'user_a', 'card_a', '2026-01-01', 'Compra parcelada', 10000, 2, 'BRL')");
    db.exec("insert into card_statements (id, user_id, card_id, statement_month, closing_date, due_date, payment_transaction_id) values ('statement_a', 'user_a', 'card_a', '2026-01', '2026-01-20', '2026-02-10', null)");
    db.exec("insert into card_installments (id, user_id, card_purchase_id, card_statement_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('installment_a', 'user_a', 'purchase_a', 'statement_a', 'tx_card_a', 1, 2, '2026-01', 5000)");
    assertRejected(db, "insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('bad_installment_zero', 'user_a', 'purchase_a', 'tx_dividend_a', 0, 2, '2026-01', 5000)", "parcela 0 deve falhar");
    assertRejected(db, "insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('bad_installment_bounds', 'user_a', 'purchase_a', 'tx_dividend_a', 3, 2, '2026-01', 5000)", "parcela maior que total deve falhar");
    assertRejected(db, "insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('bad_installment_duplicate_number', 'user_a', 'purchase_a', 'tx_dividend_a', 1, 2, '2026-01', 5000)", "numero de parcela duplicado deve falhar");
    assertRejected(db, "insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents) values ('bad_installment_duplicate_tx', 'user_a', 'purchase_a', 'tx_card_a', 2, 2, '2026-02', 5000)", "transaction duplicada em parcela deve falhar");

    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, reversal_transaction_id) values ('bad_reversal_user', 'user_a', 'RECEITA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'INFLOW', 'tx_card_b')", "reversal de outro usuario deve falhar");
    assertRejected(db, "insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, reversal_transaction_id) values ('bad_reversal_self', 'user_a', 'RECEITA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'bad', 1, 'BRL', 'INFLOW', 'bad_reversal_self')", "autorreferencia de reversal deve falhar");
    db.exec("insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction) values ('tx_reversal_a', 'user_a', 'DESPESA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'base', 1, 'BRL', 'OUTFLOW')");
    db.exec("insert into transactions (id, user_id, nature, subtype, origin, classification_status, transaction_status, date, competence_month, description, amount_cents, currency, direction, reversal_transaction_id) values ('tx_reversal_b', 'user_a', 'RECEITA', 'AJUSTE', 'MANUAL', 'CONFIRMADO', 'ACTIVE', '2026-01-01', '2026-01', 'reversal', 1, 'BRL', 'INFLOW', 'tx_reversal_a')");
    assertRejected(db, "update transactions set reversal_transaction_id = 'tx_reversal_b' where id = 'tx_reversal_a'", "ciclo direto de reversal deve falhar");
  } finally {
    cleanup();
  }
});

test("migration incremental preserva dados validos e falha atomicamente em dados invalidos", async () => {
  const { db, cleanup } = createTempDatabase();
  try {
    await applyMigrationIndex(db, 0);
    insertBaseData(db);
    db.exec("insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values ('invalid_old_cashback', 'user_a', 'tx_cashback_a', 'card_a', '2026-01', 100, 'ESTIMADO', 'rule_a', true)");

    assert.throws(() => applyMigrationAtomically(db, migrationsCache[1]), /CHECK|constraint/i);
    assert.equal(db.prepare("select count(*) as total from transactions").get().total, 6);
    assert.equal(db.prepare("select count(*) as total from cashback_events where id = 'invalid_old_cashback'").get().total, 1);
    assert.equal(db.prepare("select count(*) as total from __drizzle_migrations where created_at = ?").get(migrationsCache[1].createdAt).total, 0);
    assert.equal(db.prepare("select name from sqlite_master where type = 'table' and name = 'accounts'").get().name, "accounts");
    assert.equal(db.prepare("select name from sqlite_master where type = 'table' and name = 'cashback_events'").get().name, "cashback_events");
    assert.equal(db.prepare("select count(*) as total from sqlite_master where type = 'table' and name = 'cashback_events'").get().total, 1);
    assertNoPartialMigrationObjects(db);
    assertNoForeignKeyViolations(db);

    db.exec("delete from cashback_events where id = 'invalid_old_cashback'");
    applyMigrationAtomically(db, migrationsCache[1]);
    assert.equal(db.prepare("select count(*) as total from transactions").get().total, 6);
    assert.ok(db.prepare("select 1 from sqlite_master where type = 'index' and name = 'accounts_user_id_idx'").get());
    assertNoForeignKeyViolations(db);
  } finally {
    cleanup();
  }
});

test("db:migrate rejeita hash divergente de migration ja aplicada sem tocar no banco", () => {
  const dir = mkdtempSync(join(tmpdir(), "custo-mensal-migrate-"));
  const databasePath = join(dir, "immutability.sqlite");
  const migrationsDir = join(dir, "drizzle");

  try {
    cpSync("drizzle", migrationsDir, { recursive: true });

    const runMigrate = () => spawnSync(
      process.execPath,
      ["scripts/migrate-local.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          LOCAL_DATABASE_PATH: databasePath,
          LOCAL_MIGRATIONS_DIR: migrationsDir,
        },
        encoding: "utf8",
      },
    );

    const firstRun = runMigrate();
    assert.equal(firstRun.status, 0, firstRun.stderr || firstRun.stdout);

    let db = new DatabaseSync(databasePath);
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("insert into users (id, email, name, created_at, updated_at) values ('hash_user', 'hash@example.com', 'Hash User', '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z')");

    const schemaBefore = db.prepare("select type, name, tbl_name, sql from sqlite_master where name not like 'sqlite_%' order by type, name").all();
    const userCountBefore = db.prepare("select count(*) as total from users").get().total;
    const migrationHashBefore = db.prepare("select hash from __drizzle_migrations order by created_at desc limit 1").get().hash;
    db.close();

    const journal = JSON.parse(readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8"));
    const lastMigrationPath = join(migrationsDir, `${journal.entries.at(-1).tag}.sql`);
    const originalMigration = readFileSync(lastMigrationPath, "utf8");

    try {
      writeFileSync(
        lastMigrationPath,
        `${originalMigration}\n--> statement-breakpoint\nCREATE TABLE hash_divergence_should_not_run (id text PRIMARY KEY);\n`,
      );

      const secondRun = runMigrate();
      assert.notEqual(secondRun.status, 0, secondRun.stdout);
      assert.match(secondRun.stderr + secondRun.stdout, /Migration aplicada mudou/);
      assert.match(secondRun.stderr + secondRun.stdout, /Hash registrado:/);
      assert.match(secondRun.stderr + secondRun.stdout, /Hash atual:/);
      assert.match(secondRun.stderr + secondRun.stdout, /Crie uma nova migration numerada, como 0002/);

      db = new DatabaseSync(databasePath);
      db.exec("PRAGMA foreign_keys = ON");
      const schemaAfter = db.prepare("select type, name, tbl_name, sql from sqlite_master where name not like 'sqlite_%' order by type, name").all();
      assert.deepEqual(schemaAfter, schemaBefore);
      assert.equal(db.prepare("select count(*) as total from users").get().total, userCountBefore);
      assert.equal(db.prepare("select count(*) as total from sqlite_master where name = 'hash_divergence_should_not_run'").get().total, 0);
      assert.equal(db.prepare("select hash from __drizzle_migrations order by created_at desc limit 1").get().hash, migrationHashBefore);
      assertNoForeignKeyViolations(db);
      db.close();
    } finally {
      writeFileSync(lastMigrationPath, originalMigration);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
