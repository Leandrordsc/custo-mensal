import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createLocalApiHandler } from "../scripts/local-api-server.mjs";
import { applyMigrationAtomically, readLocalMigrations } from "../scripts/migrate-local.mjs";
import { bootstrapLocalUser } from "../lib/local-bootstrap.ts";

let migrationsCache;

async function migrations() {
  migrationsCache ??= await readLocalMigrations();
  return migrationsCache;
}

async function createDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "custo-investments-api-"));
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

async function getOverview(db, context, month = "all") {
  const handler = createLocalApiHandler({ db, context });
  const response = await handler(new Request(`http://local/api/investments/overview?year=2026&month=${month}`));
  assert.equal(response.status, 200);
  return response.json();
}

function insertAsset(db, userId, { id, ticker, name, assetClass, currency, exchange = null, market = null }) {
  db.prepare(`
    insert into assets (id, user_id, ticker, name, asset_class, exchange, market, currency)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, ticker, name, assetClass, exchange, market, currency);
}

function insertInvestment(db, userId, { id, assetId, amountCents, currency, quantity, unitPrice, subtype = "APORTE", month = "2026-08", grossAmountCents = amountCents }) {
  db.prepare(`
    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      asset_id, date, competence_month, description, amount_cents, currency, direction
    ) values (?, ?, 'INVESTIMENTO', ?, 'CONTA', 'CONFIRMADO', 'ACTIVE', ?, ?, ?, 'Aporte', ?, ?, 'OUTFLOW')
  `).run(`${id}_tx`, userId, subtype, assetId, `${month}-10`, month, amountCents, currency);
  db.prepare(`
    insert into investment_events (id, user_id, transaction_id, asset_id, quantity_decimal, unit_price_decimal, gross_amount_cents)
    values (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, `${id}_tx`, assetId, quantity, unitPrice, grossAmountCents);
}

function insertPrice(db, userId, { id, assetId, price, currency, stale = 0, quotedAt = "2026-08-20T00:00:00.000Z" }) {
  db.prepare(`
    insert into asset_prices (id, user_id, asset_id, price_decimal, currency, quoted_at, provider, fetched_at, is_stale)
    values (?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(id, userId, assetId, price, currency, quotedAt, quotedAt, stale);
}

function insertExchange(db, userId, { id = "usd_brl", rate = "5.00", stale = 0, referenceDate = "2026-08-20" } = {}) {
  db.prepare(`
    insert into exchange_rates (id, user_id, base_currency, quote_currency, rate_decimal, reference_date, provider, fetched_at, is_stale)
    values (?, ?, 'USD', 'BRL', ?, ?, 'manual', ?, ?)
  `).run(id, userId, rate, referenceDate, `${referenceDate}T00:00:00.000Z`, stale);
}

function insertDividend(db, userId, { id, assetId, amountCents, currency, month = "2026-08" }) {
  db.prepare(`
    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      asset_id, date, competence_month, description, amount_cents, currency, direction
    ) values (?, ?, 'RECEITA', 'DIVIDENDO', 'IMPORTACAO', 'CONFIRMADO', 'ACTIVE', ?, '2026-08-25', ?, 'Dividendo', ?, ?, 'INFLOW')
  `).run(`${id}_tx`, userId, assetId, month, amountCents, currency);
  db.prepare(`
    insert into dividend_events (id, user_id, transaction_id, asset_id, payment_date)
    values (?, ?, ?, ?, '2026-08-25')
  `).run(id, userId, `${id}_tx`, assetId);
}

test("api investments retorna vazio para usuario sem ativos", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);

    const body = await getOverview(db, context);

    assert.equal(body.hasAssets, false);
    assert.equal(body.positions.length, 0);
    assert.equal(body.totalsByCurrency.BRL.currentValueCents, 0);
    assert.equal(body.totalsByCurrency.USD.currentValueCents, 0);
  } finally {
    cleanup();
  }
});

test("api investments calcula ativo BRL, provento BRL e nao duplica dividend_events", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "mxrf11", ticker: "MXRF11", name: "MXRF11", assetClass: "FII", currency: "BRL", exchange: "B3", market: "BR" });
    insertInvestment(db, "user_a", { id: "aporte_mxrf", assetId: "mxrf11", amountCents: 100000, currency: "BRL", quantity: "100", unitPrice: "10" });
    insertInvestment(db, "user_a", { id: "aporte_futuro_mxrf", assetId: "mxrf11", amountCents: 999999, currency: "BRL", quantity: "999", unitPrice: "10.01", month: "2026-09" });
    insertPrice(db, "user_a", { id: "price_mxrf", assetId: "mxrf11", price: "11", currency: "BRL" });
    insertPrice(db, "user_a", { id: "price_futura_mxrf", assetId: "mxrf11", price: "99", currency: "BRL", quotedAt: "2026-09-01T00:00:00.000Z" });
    insertDividend(db, "user_a", { id: "div_mxrf", assetId: "mxrf11", amountCents: 1200, currency: "BRL" });

    const body = await getOverview(db, context, "8");

    assert.equal(body.positions[0].quantityDecimal, "100");
    assert.equal(body.positions[0].currentValueCents, 110000);
    assert.equal(body.totalsByCurrency.BRL.investedCents, 100000);
    assert.equal(body.totalsByCurrency.BRL.currentValueCents, 110000);
    assert.equal(body.totalsByCurrency.BRL.dividendsCents, 1200);
    assert.equal(body.consolidatedBrl.dividendsCents, 1200);
  } finally {
    cleanup();
  }
});

test("api investments calcula ativo USD e consolida em BRL com cambio manual", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "o_reit", ticker: "O", name: "Realty Income", assetClass: "REIT", currency: "USD", exchange: "NYSE", market: "US" });
    insertInvestment(db, "user_a", { id: "aporte_o", assetId: "o_reit", amountCents: 10000, currency: "USD", quantity: "2", unitPrice: "50" });
    insertPrice(db, "user_a", { id: "price_o", assetId: "o_reit", price: "60", currency: "USD" });
    insertPrice(db, "user_a", { id: "price_future_o", assetId: "o_reit", price: "90", currency: "USD", quotedAt: "2026-09-01T00:00:00.000Z" });
    insertDividend(db, "user_a", { id: "div_o", assetId: "o_reit", amountCents: 250, currency: "USD" });
    insertExchange(db, "user_a", { rate: "5.00" });
    insertExchange(db, "user_a", { id: "usd_brl_future", rate: "9.00", referenceDate: "2026-09-01" });

    const body = await getOverview(db, context, "8");

    assert.equal(body.totalsByCurrency.USD.currentValueCents, 12000);
    assert.equal(body.totalsByCurrency.USD.dividendsCents, 250);
    assert.equal(body.exchangeRate.rateDecimal, "5.00");
    assert.equal(body.consolidatedBrl.investedCents, 50000);
    assert.equal(body.consolidatedBrl.currentValueCents, 60000);
    assert.equal(body.consolidatedBrl.dividendsCents, 1250);
    assert.equal(body.hasPendingConversion, false);
  } finally {
    cleanup();
  }
});

test("api investments sinaliza cambio ausente e defasado para ativos USD", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "voo", ticker: "VOO", name: "Vanguard S&P 500", assetClass: "ETF_US", currency: "USD", exchange: "NYSE", market: "US" });
    insertInvestment(db, "user_a", { id: "aporte_voo", assetId: "voo", amountCents: 40000, currency: "USD", quantity: "1", unitPrice: "400" });
    insertPrice(db, "user_a", { id: "price_voo", assetId: "voo", price: "410", currency: "USD" });

    const withoutRate = await getOverview(db, context, "8");
    assert.equal(withoutRate.hasPendingConversion, true);
    assert.equal(withoutRate.alerts.some((alert) => alert.type === "MISSING_EXCHANGE_RATE"), true);

    insertExchange(db, "user_a", { rate: "5.10", stale: 1 });
    const staleRate = await getOverview(db, context, "8");
    assert.equal(staleRate.exchangeRate.isStale, true);
    assert.equal(staleRate.alerts.some((alert) => alert.type === "STALE_EXCHANGE_RATE"), true);
  } finally {
    cleanup();
  }
});

test("api investments isola ativos, precos, cambio e proventos por usuario", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    const userB = { userId: "user_b" };
    bootstrapLocalUser(db, userA);
    bootstrapLocalUser(db, userB);
    insertAsset(db, "user_b", { id: "b_reit", ticker: "B", name: "Outro REIT", assetClass: "REIT", currency: "USD", exchange: "NYSE", market: "US" });
    insertInvestment(db, "user_b", { id: "aporte_b", assetId: "b_reit", amountCents: 99900, currency: "USD", quantity: "10", unitPrice: "99.9" });
    insertPrice(db, "user_b", { id: "price_b", assetId: "b_reit", price: "100", currency: "USD" });
    insertDividend(db, "user_b", { id: "div_b", assetId: "b_reit", amountCents: 777, currency: "USD" });
    insertExchange(db, "user_b", { id: "usd_brl_b", rate: "9.99" });

    const body = await getOverview(db, userA, "8");

    assert.equal(body.positions.length, 0);
    assert.equal(body.dividends.length, 0);
    assert.equal(body.exchangeRate.rateDecimal, null);
    assert.equal(body.totalsByCurrency.USD.currentValueCents, 0);
  } finally {
    cleanup();
  }
});
