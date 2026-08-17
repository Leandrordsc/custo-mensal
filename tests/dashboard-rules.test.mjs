import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { applyMigrationAtomically, readLocalMigrations } from "../scripts/migrate-local.mjs";
import { requireAuthenticatedUser } from "../lib/auth-context.ts";
import { calculateDashboardSummary } from "../lib/dashboard-rules.ts";
import { SQLiteDashboardRepository } from "../lib/dashboard-repository.ts";

let migrationsCache;

async function migrations() {
  migrationsCache ??= await readLocalMigrations();
  return migrationsCache;
}

async function createMigratedDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "custo-dashboard-"));
  const databasePath = join(dir, "test.sqlite");
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON");

  for (const migration of await migrations()) {
    applyMigrationAtomically(db, migration);
  }

  return {
    db,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function insertDashboardFixture(db) {
  db.exec(`
    insert into users (id, email, name, created_at, updated_at) values
      ('user_a', 'a-dashboard@example.com', 'Usuario A', '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z'),
      ('user_b', 'b-dashboard@example.com', 'Usuario B', '2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z');

    insert into accounts (id, user_id, name, account_type, currency, opening_balance_cents, balance_date, active) values
      ('account_a', 'user_a', 'Conta A', 'CONTA', 'BRL', 0, '2026-01-01', true),
      ('reserve_a', 'user_a', 'Caixinha A', 'CAIXINHA', 'BRL', 0, '2026-01-01', true),
      ('account_b', 'user_b', 'Conta B', 'CONTA', 'BRL', 0, '2026-01-01', true);

    insert into cards (id, user_id, name, issuer, status, closing_day, due_day) values
      ('card_a', 'user_a', 'BTG', 'BTG', 'ATIVO', 20, 10),
      ('card_b', 'user_b', 'Mercado Pago', 'Mercado Pago', 'ATIVO', 15, 5);

    insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from) values
      ('rule_a', 'user_a', 'card_a', 100, '2026-01-01'),
      ('rule_b', 'user_b', 'card_b', 50, '2026-01-01');

    insert into categories (id, user_id, name, counts_as_living_cost, active) values
      ('cat_living_a', 'user_a', 'Alimentacao', true, true),
      ('cat_non_living_a', 'user_a', 'Investimentos', false, true),
      ('cat_living_b', 'user_b', 'Alimentacao', true, true);

    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      category_id, source_account_id, target_account_id, card_id, date,
      competence_month, description, amount_cents, currency, direction
    ) values
      ('tx_card_purchase_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'ACTIVE', 'cat_living_a', 'account_a', null, 'card_a', '2026-06-05', '2026-06', 'Compra cartao', 10000, 'BRL', 'OUTFLOW'),
      ('tx_invoice_a', 'user_a', 'TRANSFERENCIA', 'PAGAMENTO_FATURA', 'CONTA', 'CONFIRMADO', 'ACTIVE', null, 'account_a', null, 'card_a', '2026-06-10', '2026-06', 'Pagamento fatura', 10000, 'BRL', 'TRANSFER_OUT'),
      ('tx_reserve_a', 'user_a', 'TRANSFERENCIA', 'TRANSFERENCIA_RESERVA', 'CONTA', 'CONFIRMADO', 'ACTIVE', null, 'account_a', 'reserve_a', null, '2026-06-11', '2026-06', 'Reserva', 5000, 'BRL', 'TRANSFER_OUT'),
      ('tx_contribution_a', 'user_a', 'INVESTIMENTO', 'APORTE', 'CONTA', 'CONFIRMADO', 'ACTIVE', 'cat_non_living_a', 'account_a', null, null, '2026-06-12', '2026-06', 'Aporte', 20000, 'BRL', 'OUTFLOW'),
      ('tx_reinvest_a', 'user_a', 'INVESTIMENTO', 'REINVESTIMENTO', 'CONTA', 'CONFIRMADO', 'ACTIVE', 'cat_non_living_a', 'account_a', null, null, '2026-06-13', '2026-06', 'Reinvestimento', 3000, 'BRL', 'OUTFLOW'),
      ('tx_dividend_a', 'user_a', 'RECEITA', 'DIVIDENDO', 'IMPORTACAO', 'CONFIRMADO', 'ACTIVE', null, null, 'account_a', null, '2026-06-14', '2026-06', 'Dividendo', 700, 'BRL', 'INFLOW'),
      ('tx_cashback_a', 'user_a', 'RECEITA', 'CASHBACK', 'CARTAO', 'CONFIRMADO', 'ACTIVE', null, null, 'account_a', 'card_a', '2026-06-15', '2026-06', 'Cashback real', 100, 'BRL', 'INFLOW'),
      ('tx_earning_a', 'user_a', 'RECEITA', 'RENDIMENTO', 'CAIXINHA', 'CONFIRMADO', 'ACTIVE', null, null, 'reserve_a', null, '2026-06-16', '2026-06', 'Rendimento', 120, 'BRL', 'INFLOW'),
      ('tx_pending_a', 'user_a', 'DESPESA', 'COMPRA', 'IMPORTACAO', 'PENDENTE_REVISAO', 'ACTIVE', 'cat_living_a', 'account_a', null, null, '2026-06-17', '2026-06', 'Pendente', 900, 'BRL', 'OUTFLOW'),
      ('tx_estimated_a', 'user_a', 'RECEITA', 'CASHBACK', 'CARTAO', 'ESTIMADO', 'ACTIVE', null, null, 'account_a', 'card_a', '2026-06-18', '2026-06', 'Estimado ignorado', 80, 'BRL', 'INFLOW'),
      ('tx_canceled_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'CANCELADO', 'cat_living_a', 'account_a', null, 'card_a', '2026-06-19', '2026-06', 'Cancelado', 9999, 'BRL', 'OUTFLOW'),
      ('tx_other_month_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'ACTIVE', 'cat_living_a', 'account_a', null, 'card_a', '2026-07-01', '2026-07', 'Outro mes', 2222, 'BRL', 'OUTFLOW'),
      ('tx_card_purchase_b', 'user_b', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'ACTIVE', 'cat_living_b', 'account_b', null, 'card_b', '2026-06-05', '2026-06', 'Compra outro usuario', 77777, 'BRL', 'OUTFLOW');

    insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, rule_id, contabilizable) values
      ('cashback_estimated_a', 'user_a', null, 'card_a', '2026-06', 120, 'ESTIMADO', 'rule_a', false),
      ('cashback_estimated_b', 'user_b', null, 'card_b', '2026-06', 999, 'ESTIMADO', 'rule_b', false);
  `);
}

test("calcula Dashboard mensal por transactions sem dupla contagem", () => {
  const summary = calculateDashboardSummary({
    period: { fromMonth: "2026-06", toMonth: "2026-06" },
    transactions: [
      { id: "purchase", userId: "user_a", nature: "DESPESA", subtype: "COMPRA", origin: "CARTAO", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 10000, categoryCountsAsLivingCost: true },
      { id: "invoice", userId: "user_a", nature: "TRANSFERENCIA", subtype: "PAGAMENTO_FATURA", origin: "CONTA", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 10000 },
      { id: "reserve", userId: "user_a", nature: "TRANSFERENCIA", subtype: "TRANSFERENCIA_RESERVA", origin: "CONTA", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 5000 },
      { id: "aporte", userId: "user_a", nature: "INVESTIMENTO", subtype: "APORTE", origin: "CONTA", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 20000 },
      { id: "reinvestimento", userId: "user_a", nature: "INVESTIMENTO", subtype: "REINVESTIMENTO", origin: "CONTA", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 3000 },
      { id: "dividendo", userId: "user_a", nature: "RECEITA", subtype: "DIVIDENDO", origin: "IMPORTACAO", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 700 },
      { id: "cashback", userId: "user_a", nature: "RECEITA", subtype: "CASHBACK", origin: "CARTAO", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 100 },
      { id: "rendimento", userId: "user_a", nature: "RECEITA", subtype: "RENDIMENTO", origin: "CAIXINHA", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 120 },
      { id: "pendente", userId: "user_a", nature: "DESPESA", subtype: "COMPRA", origin: "IMPORTACAO", classificationStatus: "PENDENTE_REVISAO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 900, categoryCountsAsLivingCost: true },
      { id: "estimado", userId: "user_a", nature: "RECEITA", subtype: "CASHBACK", origin: "CARTAO", classificationStatus: "ESTIMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-06", amountCents: 80 },
      { id: "cancelado", userId: "user_a", nature: "DESPESA", subtype: "COMPRA", origin: "CARTAO", classificationStatus: "CONFIRMADO", transactionStatus: "CANCELADO", competenceMonth: "2026-06", amountCents: 9999, categoryCountsAsLivingCost: true },
      { id: "fora-periodo", userId: "user_a", nature: "DESPESA", subtype: "COMPRA", origin: "CARTAO", classificationStatus: "CONFIRMADO", transactionStatus: "ACTIVE", competenceMonth: "2026-07", amountCents: 2222, categoryCountsAsLivingCost: true },
    ],
    estimatedCashbacks: [
      { id: "estimate", userId: "user_a", month: "2026-06", amountCents: 120, valueType: "ESTIMADO", contabilizable: false },
    ],
  });

  assert.equal(summary.livingCostCents, 10000);
  assert.equal(summary.cardPurchasesCents, 10000);
  assert.equal(summary.invoicePaymentsCents, 10000);
  assert.equal(summary.internalTransfersCents, 15000);
  assert.equal(summary.reserveTransfersCents, 5000);
  assert.equal(summary.contributionsCents, 20000);
  assert.equal(summary.reinvestmentsCents, 3000);
  assert.equal(summary.dividendsCents, 700);
  assert.equal(summary.confirmedCashbackCents, 100);
  assert.equal(summary.estimatedCashbackCents, 120);
  assert.equal(summary.reserveEarningsCents, 120);
  assert.equal(summary.pendingReviewCents, 900);
  assert.equal(summary.ignoredCents, 10079);
});

test("calculo do Dashboard valida meses canonicos, periodo e centavos", () => {
  const baseTransaction = {
    id: "tx",
    userId: "user_a",
    nature: "DESPESA",
    subtype: "COMPRA",
    origin: "CARTAO",
    classificationStatus: "CONFIRMADO",
    transactionStatus: "ACTIVE",
    competenceMonth: "2026-06",
    amountCents: 100,
    categoryCountsAsLivingCost: true,
  };

  assert.throws(
    () => calculateDashboardSummary({ period: { fromMonth: "2026-6", toMonth: "2026-06" }, transactions: [baseTransaction] }),
    /YYYY-MM/,
  );
  assert.throws(
    () => calculateDashboardSummary({ period: { fromMonth: "2026-07", toMonth: "2026-06" }, transactions: [baseTransaction] }),
    /mes inicial maior/,
  );
  assert.throws(
    () => calculateDashboardSummary({ period: { fromMonth: "2026-06", toMonth: "2026-06" }, transactions: [{ ...baseTransaction, competenceMonth: "06/2026" }] }),
    /YYYY-MM/,
  );
  assert.throws(
    () => calculateDashboardSummary({ period: { fromMonth: "2026-06", toMonth: "2026-06" }, transactions: [{ ...baseTransaction, amountCents: Number.NaN }] }),
    /inteiro seguro/,
  );
  assert.throws(
    () => calculateDashboardSummary({ period: { fromMonth: "2026-06", toMonth: "2026-06" }, transactions: [baseTransaction], estimatedCashbacks: [{ id: "estimate", userId: "user_a", month: "2026-13", amountCents: 1, valueType: "ESTIMADO", contabilizable: false }] }),
    /YYYY-MM/,
  );
});

test("repository SQLite exige usuario e filtra dados cross-user", async () => {
  const { db, cleanup } = await createMigratedDatabase();
  try {
    insertDashboardFixture(db);
    const repository = new SQLiteDashboardRepository(db);

    assert.throws(() => repository.getDashboardSummary({ userId: "" }, { fromMonth: "2026-06", toMonth: "2026-06" }), /Usuario autenticado obrigatorio/);
    assert.throws(() => requireAuthenticatedUser(null), /Usuario autenticado obrigatorio/);

    const summary = repository.getDashboardSummary({ userId: "user_a" }, { fromMonth: "2026-06", toMonth: "2026-06" });
    assert.equal(summary.livingCostCents, 10000);
    assert.equal(summary.cardPurchasesCents, 10000);
    assert.equal(summary.invoicePaymentsCents, 10000);
    assert.equal(summary.internalTransfersCents, 15000);
    assert.equal(summary.reserveTransfersCents, 5000);
    assert.equal(summary.contributionsCents, 20000);
    assert.equal(summary.reinvestmentsCents, 3000);
    assert.equal(summary.dividendsCents, 700);
    assert.equal(summary.confirmedCashbackCents, 100);
    assert.equal(summary.estimatedCashbackCents, 120);
    assert.equal(summary.reserveEarningsCents, 120);
    assert.equal(summary.pendingReviewCents, 900);
    assert.equal(summary.ignoredCents, 10079);
    assert.equal(summary.livingCostCents < 77777, true);

    const otherSummary = repository.getDashboardSummary({ userId: "user_b" }, { fromMonth: "2026-06", toMonth: "2026-06" });
    assert.equal(otherSummary.livingCostCents, 77777);
    assert.equal(otherSummary.estimatedCashbackCents, 999);
  } finally {
    cleanup();
  }
});
