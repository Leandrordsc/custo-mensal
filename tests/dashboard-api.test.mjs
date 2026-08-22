import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createLocalApiHandler } from "../scripts/local-api-server.mjs";
import { applyMigrationAtomically, readLocalMigrations } from "../scripts/migrate-local.mjs";
import { ExpenseService } from "../lib/expense-service.ts";
import { bootstrapLocalUser } from "../lib/local-bootstrap.ts";

let migrationsCache;

async function migrations() {
  migrationsCache ??= await readLocalMigrations();
  return migrationsCache;
}

async function createDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "custo-dashboard-api-"));
  const db = new DatabaseSync(join(dir, "test.sqlite"));
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

function expenseInput(bases, override = {}) {
  return {
    description: "Mercado",
    amount: "90,00",
    date: "2026-08-10",
    competenceMonth: "2026-08",
    categoryId: bases.categories[0].id,
    paymentMethod: "CONTA",
    accountId: bases.accounts[0].id,
    cardId: "",
    notes: "",
    classificationStatus: "CONFIRMADO",
    isInstallment: false,
    installments: 1,
    ...override,
  };
}

function insertAsset(db, userId, { id, ticker, name, assetClass, currency, exchange = null, market = null }) {
  db.prepare(`
    insert into assets (id, user_id, ticker, name, asset_class, exchange, market, currency)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, ticker, name, assetClass, exchange, market, currency);
}

function insertInvestment(db, userId, { id, assetId, amountCents, currency, quantity, unitPrice }) {
  db.prepare(`
    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      asset_id, date, competence_month, description, amount_cents, currency, direction
    ) values (?, ?, 'INVESTIMENTO', 'APORTE', 'CONTA', 'CONFIRMADO', 'ACTIVE', ?, '2026-08-10', '2026-08', 'Aporte', ?, ?, 'OUTFLOW')
  `).run(`${id}_tx`, userId, assetId, amountCents, currency);
  db.prepare(`
    insert into investment_events (id, user_id, transaction_id, asset_id, quantity_decimal, unit_price_decimal, gross_amount_cents)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, `${id}_tx`, assetId, quantity, unitPrice, amountCents);
}

function insertPrice(db, userId, { id, assetId, price, currency }) {
  db.prepare(`
    insert into asset_prices (id, user_id, asset_id, price_decimal, currency, quoted_at, provider, fetched_at, is_stale)
    values (?, ?, ?, ?, ?, '2026-08-20T00:00:00.000Z', 'manual', '2026-08-20T00:00:00.000Z', 0)
  `).run(id, userId, assetId, price, currency);
}

function insertExchange(db, userId, { id = "usd_brl", rate = "5.00" } = {}) {
  db.prepare(`
    insert into exchange_rates (id, user_id, base_currency, quote_currency, rate_decimal, reference_date, provider, fetched_at, is_stale)
    values (?, ?, 'USD', 'BRL', ?, '2026-08-20', 'manual', '2026-08-20T00:00:00.000Z', 0)
  `).run(id, userId, rate);
}

test("api dashboard retorna zeros para banco sem transacoes", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const handler = createLocalApiHandler({ db, context });
    const response = await handler(new Request("http://local/api/dashboard?year=2026&month=8"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.hasTransactions, false);
    assert.equal(body.hasFinancialImpact, false);
    assert.equal(body.countableTransactionCount, 0);
    assert.equal(body.summary.livingCostCents, 0);
    assert.equal(body.summary.cardPurchasesCents, 0);
  } finally {
    cleanup();
  }
});

test("api dashboard soma despesas persistidas por competencia e isola usuarios", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    const userB = { userId: "user_b" };
    bootstrapLocalUser(db, userA);
    bootstrapLocalUser(db, userB);
    const service = new ExpenseService(db);
    const basesA = service.listBases(userA);
    const basesB = service.listBases(userB);

    service.createExpense(userA, expenseInput(basesA, { amount: "120,00" }));
    service.createExpense(userA, expenseInput(basesA, {
      description: "Notebook",
      amount: "300,00",
      paymentMethod: "CARTAO",
      accountId: "",
      cardId: basesA.cards[0].id,
      isInstallment: true,
      installments: 3,
    }));
    service.createExpense(userA, expenseInput(basesA, { amount: "50,00", classificationStatus: "PENDENTE_REVISAO" }));
    const [canceled] = service.createExpense(userA, expenseInput(basesA, { amount: "70,00" }));
    service.cancelExpense(userA, canceled.id);
    service.createExpense(userB, expenseInput(basesB, { amount: "999,00" }));
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        source_account_id, target_account_id, card_id, date, competence_month, description,
        amount_cents, currency, direction
      ) values (?, ?, 'TRANSFERENCIA', 'PAGAMENTO_FATURA', 'CONTA', 'CONFIRMADO', 'ACTIVE', ?, null, ?, '2026-08-20', '2026-08', 'Pagamento fatura', 10000, 'BRL', 'TRANSFER_OUT')
    `).run("invoice_payment_a", "user_a", basesA.accounts[0].id, basesA.cards[0].id);
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        source_account_id, target_account_id, date, competence_month, description,
        amount_cents, currency, direction
      ) values (?, ?, 'TRANSFERENCIA', 'TRANSFERENCIA_RESERVA', 'CONTA', 'CONFIRMADO', 'ACTIVE', ?, ?, '2026-08-21', '2026-08', 'Reserva', 8000, 'BRL', 'TRANSFER_OUT')
    `).run("reserve_transfer_a", "user_a", basesA.accounts[0].id, basesA.accounts[0].id);

    const handler = createLocalApiHandler({ db, context: userA });
    const august = await (await handler(new Request("http://local/api/dashboard?year=2026&month=8"))).json();
    const september = await (await handler(new Request("http://local/api/dashboard?year=2026&month=9"))).json();

    assert.equal(august.summary.livingCostCents, 22000);
    assert.equal(august.summary.cardPurchasesCents, 10000);
    assert.equal(august.summary.pendingReviewCents, 5000);
    assert.equal(august.summary.invoicePaymentsCents, 10000);
    assert.equal(august.summary.reserveTransfersCents, 8000);
    assert.equal(august.summary.internalTransfersCents, 18000);
    assert.equal(august.hasTransactions, true);
    assert.equal(august.hasFinancialImpact, true);
    assert.equal(august.countableTransactionCount > 0, true);
    assert.equal(september.summary.livingCostCents, 10000);
    assert.equal(september.summary.cardPurchasesCents, 10000);
    assert.equal(august.categories[0].amountCents, 22000);
    assert.equal(august.summary.livingCostCents < 99900, true);
  } finally {
    cleanup();
  }
});

test("api dashboard separa registros brutos de impacto financeiro relevante", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    bootstrapLocalUser(db, userA);
    const service = new ExpenseService(db);
    const basesA = service.listBases(userA);
    const [canceled] = service.createExpense(userA, expenseInput(basesA, { amount: "70,00" }));
    service.cancelExpense(userA, canceled.id);

    const handler = createLocalApiHandler({ db, context: userA });
    const body = await (await handler(new Request("http://local/api/dashboard?year=2026&month=8"))).json();

    assert.equal(body.transactionCount, 1);
    assert.equal(body.hasTransactions, true);
    assert.equal(body.countableTransactionCount, 0);
    assert.equal(body.hasFinancialImpact, false);
    assert.equal(body.summary.livingCostCents, 0);
    assert.equal(body.summary.cardPurchasesCents, 0);
    assert.equal(body.summary.ignoredCents, 7000);
  } finally {
    cleanup();
  }
});

test("api dashboard inclui ativos USD e consolidado BRL", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "o_reit", ticker: "O", name: "Realty Income", assetClass: "REIT", currency: "USD", exchange: "NYSE", market: "US" });
    insertInvestment(db, "user_a", { id: "aporte_o", assetId: "o_reit", amountCents: 10000, currency: "USD", quantity: "2", unitPrice: "50" });
    insertPrice(db, "user_a", { id: "price_o", assetId: "o_reit", price: "60", currency: "USD" });
    insertExchange(db, "user_a");

    const handler = createLocalApiHandler({ db, context });
    const response = await handler(new Request("http://local/api/dashboard?year=2026&month=8"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.investments.totalsByCurrency.USD.currentValueCents, 12000);
    assert.equal(body.investments.consolidatedBrl.investedCents, 50000);
    assert.equal(body.investments.consolidatedBrl.currentValueCents, 60000);
  } finally {
    cleanup();
  }
});

test("api dashboard rejeita periodo invalido", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    bootstrapLocalUser(db, { userId: "user_a" });
    const handler = createLocalApiHandler({ db, context: { userId: "user_a" } });
    const response = await handler(new Request("http://local/api/dashboard?year=2026&month=13"));

    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /Mes invalido/);
  } finally {
    cleanup();
  }
});
