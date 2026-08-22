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

async function postInvestment(db, context, path, payload) {
  const handler = createLocalApiHandler({ db, context });
  return handler(new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  }));
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

function insertPrice(db, userId, { id, assetId, price, currency, stale = 0, quotedAt = "2026-08-20T00:00:00.000Z", fetchedAt = quotedAt }) {
  db.prepare(`
    insert into asset_prices (id, user_id, asset_id, price_decimal, currency, quoted_at, provider, fetched_at, is_stale)
    values (?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(id, userId, assetId, price, currency, quotedAt, fetchedAt, stale);
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

function insertDividendTransactionOnly(db, userId, { id, assetId, amountCents, currency, month = "2026-08", date = "2026-08-25" }) {
  db.prepare(`
    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      asset_id, date, competence_month, description, amount_cents, currency, direction
    ) values (?, ?, 'RECEITA', 'DIVIDENDO', 'IMPORTACAO', 'CONFIRMADO', 'ACTIVE', ?, ?, ?, 'Dividendo sem evento', ?, ?, 'INFLOW')
  `).run(`${id}_tx`, userId, assetId, date, month, amountCents, currency);
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

test("api investments ignora ativo cadastrado sem posicao confirmada", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "sem_posicao", ticker: "ZERO11", name: "Ativo sem posicao", assetClass: "FII", currency: "BRL" });
    insertPrice(db, "user_a", { id: "price_zero", assetId: "sem_posicao", price: "10", currency: "BRL" });

    const body = await getOverview(db, context, "8");

    assert.equal(body.hasAssets, false);
    assert.equal(body.positions.length, 0);
    assert.equal(body.alerts.some((alert) => alert.assetId === "sem_posicao"), false);
  } finally {
    cleanup();
  }
});

test("api investments calcula ativo BRL e usa data da transaction quando nao ha dividend_event", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "mxrf11", ticker: "MXRF11", name: "MXRF11", assetClass: "FII", currency: "BRL", exchange: "B3", market: "BR" });
    insertInvestment(db, "user_a", { id: "aporte_mxrf", assetId: "mxrf11", amountCents: 100000, currency: "BRL", quantity: "100", unitPrice: "10" });
    insertInvestment(db, "user_a", { id: "aporte_futuro_mxrf", assetId: "mxrf11", amountCents: 999999, currency: "BRL", quantity: "999", unitPrice: "10.01", month: "2026-09" });
    insertPrice(db, "user_a", { id: "price_mxrf", assetId: "mxrf11", price: "11", currency: "BRL" });
    insertPrice(db, "user_a", { id: "price_old_refetched_mxrf", assetId: "mxrf11", price: "8", currency: "BRL", quotedAt: "2026-08-01T00:00:00.000Z", fetchedAt: "2026-08-31T00:00:00.000Z" });
    insertPrice(db, "user_a", { id: "price_futura_mxrf", assetId: "mxrf11", price: "99", currency: "BRL", quotedAt: "2026-09-01T00:00:00.000Z" });
    insertDividendTransactionOnly(db, "user_a", { id: "div_mxrf", assetId: "mxrf11", amountCents: 1200, currency: "BRL", date: "2026-08-24" });

    const body = await getOverview(db, context, "8");

    assert.equal(body.positions[0].quantityDecimal, "100");
    assert.equal(body.positions[0].currentValueCents, 110000);
    assert.equal(body.positions[0].lastPriceDecimal, "11");
    assert.equal(body.dividends[0].paymentDate, "2026-08-24");
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
    assert.equal(withoutRate.consolidatedBrl.pendingInvestedCents, 40000);
    assert.equal(withoutRate.alerts.some((alert) => alert.type === "MISSING_EXCHANGE_RATE"), true);

    insertExchange(db, "user_a", { rate: "5.10", stale: 1 });
    const staleRate = await getOverview(db, context, "8");
    assert.equal(staleRate.exchangeRate.isStale, true);
    assert.equal(staleRate.alerts.some((alert) => alert.type === "STALE_EXCHANGE_RATE"), true);
  } finally {
    cleanup();
  }
});

test("api investments sinaliza preco ausente, preco defasado e moeda sem conversao", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "sem_preco", ticker: "SPRE11", name: "Sem preco", assetClass: "FII", currency: "BRL" });
    insertInvestment(db, "user_a", { id: "aporte_sem_preco", assetId: "sem_preco", amountCents: 10000, currency: "BRL", quantity: "10", unitPrice: "10" });
    insertAsset(db, "user_a", { id: "preco_defasado", ticker: "OLD11", name: "Preco defasado", assetClass: "FII", currency: "BRL" });
    insertInvestment(db, "user_a", { id: "aporte_defasado", assetId: "preco_defasado", amountCents: 20000, currency: "BRL", quantity: "20", unitPrice: "10" });
    insertPrice(db, "user_a", { id: "price_defasado", assetId: "preco_defasado", price: "9", currency: "BRL", stale: 1 });
    insertAsset(db, "user_a", { id: "eur_asset", ticker: "EUR1", name: "Ativo EUR", assetClass: "OUTRO", currency: "EUR" });
    insertInvestment(db, "user_a", { id: "aporte_eur", assetId: "eur_asset", amountCents: 30000, currency: "EUR", quantity: "3", unitPrice: "100" });
    insertPrice(db, "user_a", { id: "price_eur", assetId: "eur_asset", price: "110", currency: "EUR" });

    const body = await getOverview(db, context, "8");

    assert.equal(body.alerts.some((alert) => alert.type === "MISSING_PRICE" && alert.assetId === "sem_preco"), true);
    assert.equal(body.alerts.some((alert) => alert.type === "STALE_PRICE" && alert.assetId === "preco_defasado"), true);
    assert.equal(body.alerts.some((alert) => alert.type === "UNSUPPORTED_CURRENCY" && alert.currency === "EUR"), true);
    assert.equal(body.consolidatedBrl.pendingInvestedCents, 0);
  } finally {
    cleanup();
  }
});

test("api investments usa ultimo dia real do mes ao selecionar preco", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "bova11", ticker: "BOVA11", name: "BOVA11", assetClass: "ETF_BR", currency: "BRL", exchange: "B3", market: "BR" });
    insertInvestment(db, "user_a", { id: "aporte_bova", assetId: "bova11", amountCents: 100000, currency: "BRL", quantity: "10", unitPrice: "100", month: "2026-02" });
    insertPrice(db, "user_a", { id: "price_fev_bova", assetId: "bova11", price: "105", currency: "BRL", quotedAt: "2026-02-28T00:00:00.000Z" });
    insertPrice(db, "user_a", { id: "price_mar_bova", assetId: "bova11", price: "130", currency: "BRL", quotedAt: "2026-03-01T00:00:00.000Z" });

    const body = await getOverview(db, context, "2");

    assert.equal(body.positions[0].lastPriceDecimal, "105");
    assert.equal(body.positions[0].currentValueCents, 105000);
  } finally {
    cleanup();
  }
});

test("api investments ignora transacoes nao confirmadas ou canceladas", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "bbas3", ticker: "BBAS3", name: "Banco do Brasil", assetClass: "ACAO_BR", currency: "BRL", exchange: "B3", market: "BR" });
    insertInvestment(db, "user_a", { id: "aporte_ok", assetId: "bbas3", amountCents: 10000, currency: "BRL", quantity: "10", unitPrice: "10" });
    insertInvestment(db, "user_a", { id: "aporte_pendente", assetId: "bbas3", amountCents: 90000, currency: "BRL", quantity: "90", unitPrice: "10" });
    db.prepare("update transactions set classification_status = 'PENDENTE_REVISAO' where id = 'aporte_pendente_tx'").run();
    insertInvestment(db, "user_a", { id: "aporte_cancelado", assetId: "bbas3", amountCents: 80000, currency: "BRL", quantity: "80", unitPrice: "10" });
    db.prepare("update transactions set transaction_status = 'CANCELADO', voided_at = '2026-08-12T00:00:00.000Z', voided_by = 'user_a' where id = 'aporte_cancelado_tx'").run();
    insertDividend(db, "user_a", { id: "div_pendente", assetId: "bbas3", amountCents: 7000, currency: "BRL" });
    db.prepare("update transactions set classification_status = 'PENDENTE_REVISAO' where id = 'div_pendente_tx'").run();

    const body = await getOverview(db, context, "8");

    assert.equal(body.positions[0].quantityDecimal, "10");
    assert.equal(body.totalsByCurrency.BRL.investedCents, 10000);
    assert.equal(body.totalsByCurrency.BRL.dividendsCents, 0);
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

test("api investments cadastra compra de ativo existente com transaction e investment_event", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "mxrf11", ticker: "MXRF11", name: "MXRF11", assetClass: "FII", currency: "BRL" });

    const response = await postInvestment(db, context, "/api/investments/operations", {
      assetId: "mxrf11",
      operationType: "COMPRA",
      subtype: "APORTE",
      quantity: "10",
      unitPrice: "10",
      totalAmount: "100,00",
      date: "2026-08-10",
      competenceMonth: "2026-08",
    });

    assert.equal(response.status, 201);
    const tx = db.prepare("select nature, subtype, classification_status, transaction_status, amount_cents, currency, direction from transactions where user_id = 'user_a'").get();
    const event = db.prepare("select quantity_decimal, unit_price_decimal, gross_amount_cents from investment_events where user_id = 'user_a'").get();
    assert.deepEqual({ ...tx }, { nature: "INVESTIMENTO", subtype: "APORTE", classification_status: "CONFIRMADO", transaction_status: "ACTIVE", amount_cents: 10000, currency: "BRL", direction: "OUTFLOW" });
    assert.deepEqual({ ...event }, { quantity_decimal: "10", unit_price_decimal: "10", gross_amount_cents: 10000 });
  } finally {
    cleanup();
  }
});

test("api investments lista ativos do usuario como bases", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    const userB = { userId: "user_b" };
    bootstrapLocalUser(db, userA);
    bootstrapLocalUser(db, userB);
    insertAsset(db, "user_a", { id: "mxrf11", ticker: "MXRF11", name: "MXRF11", assetClass: "FII", currency: "BRL" });
    insertAsset(db, "user_b", { id: "voo_b", ticker: "VOO", name: "Vanguard S&P 500", assetClass: "ETF_US", currency: "USD" });

    const handler = createLocalApiHandler({ db, context: userA });
    const response = await handler(new Request("http://local/api/investments/bases"));
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.assets.map((asset) => asset.id), ["mxrf11"]);
  } finally {
    cleanup();
  }
});

test("api investments cadastra novo ativo e compra na mesma transacao SQLite", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);

    const response = await postInvestment(db, context, "/api/investments/operations", {
      asset: { ticker: "O", name: "Realty Income", assetClass: "REIT", exchange: "NYSE", market: "US", currency: "USD" },
      operationType: "COMPRA",
      subtype: "REINVESTIMENTO",
      quantity: "1.5",
      unitPrice: "50",
      totalAmount: "75.00",
      date: "2026-08-10",
      competenceMonth: "2026-08",
      exchangeRate: "5.2",
    });

    assert.equal(response.status, 201);
    assert.equal(db.prepare("select count(*) as total from assets where user_id = 'user_a' and ticker = 'O'").get().total, 1);
    assert.equal(db.prepare("select subtype from transactions where user_id = 'user_a'").get().subtype, "REINVESTIMENTO");
    assert.equal(db.prepare("select exchange_rate_decimal from investment_events where user_id = 'user_a'").get().exchange_rate_decimal, "5.2");
  } finally {
    cleanup();
  }
});

test("api investments rejeita compra com novo ativo invalido sem gravacao parcial", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);

    const response = await postInvestment(db, context, "/api/investments/operations", {
      asset: { ticker: "BAD", name: "Ativo invalido", assetClass: "FII", currency: "EUR" },
      operationType: "COMPRA",
      subtype: "APORTE",
      quantity: "10",
      unitPrice: "10",
      totalAmount: "100,00",
      date: "2026-08-10",
      competenceMonth: "2026-08",
    });

    assert.equal(response.status, 400);
    assert.equal(db.prepare("select count(*) as total from assets where user_id = 'user_a'").get().total, 0);
    assert.equal(db.prepare("select count(*) as total from transactions where user_id = 'user_a'").get().total, 0);
  } finally {
    cleanup();
  }
});

test("api investments cadastra venda parcial e rejeita venda maior que posicao", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "bbas3", ticker: "BBAS3", name: "Banco do Brasil", assetClass: "ACAO_BR", currency: "BRL" });
    insertInvestment(db, "user_a", { id: "aporte_bbas3", assetId: "bbas3", amountCents: 100000, currency: "BRL", quantity: "100", unitPrice: "10" });

    const sale = await postInvestment(db, context, "/api/investments/operations", {
      assetId: "bbas3",
      operationType: "VENDA",
      quantity: "40",
      unitPrice: "12",
      totalAmount: "480,00",
      date: "2026-08-12",
      competenceMonth: "2026-08",
    });
    assert.equal(sale.status, 201);
    const overview = await getOverview(db, context, "8");
    assert.equal(overview.positions[0].quantityDecimal, "60");
    assert.equal(overview.positions[0].investedCents, 60000);
    assert.equal(overview.positions[0].averagePriceDecimal, "10");
    assert.equal(db.prepare("select count(*) as total from transactions where nature = 'DESPESA'").get().total, 0);

    const oversell = await postInvestment(db, context, "/api/investments/operations", {
      assetId: "bbas3",
      operationType: "VENDA",
      quantity: "61",
      unitPrice: "12",
      totalAmount: "732,00",
      date: "2026-08-13",
      competenceMonth: "2026-08",
    });
    assert.equal(oversell.status, 400);
    assert.equal(db.prepare("select count(*) as total from investment_events where user_id = 'user_a'").get().total, 2);
  } finally {
    cleanup();
  }
});

test("api investments venda total zera posicao sem custo residual", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "fracao", ticker: "FRAC11", name: "Ativo fracionario", assetClass: "FII", currency: "BRL" });
    insertInvestment(db, "user_a", { id: "aporte_fracao", assetId: "fracao", amountCents: 10000, currency: "BRL", quantity: "3", unitPrice: "33.33333333" });

    const sale = await postInvestment(db, context, "/api/investments/operations", {
      assetId: "fracao",
      operationType: "VENDA",
      quantity: "3",
      unitPrice: "35",
      totalAmount: "105,00",
      date: "2026-08-12",
      competenceMonth: "2026-08",
    });
    assert.equal(sale.status, 201);

    const overview = await getOverview(db, context, "8");
    assert.equal(overview.positions.length, 0);
    assert.equal(overview.totalsByCurrency.BRL.investedCents, 0);
  } finally {
    cleanup();
  }
});

test("api investments rejeita data impossivel e valor total zero", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "mxrf11", ticker: "MXRF11", name: "MXRF11", assetClass: "FII", currency: "BRL" });

    const impossibleDate = await postInvestment(db, context, "/api/investments/operations", {
      assetId: "mxrf11",
      operationType: "COMPRA",
      subtype: "APORTE",
      quantity: "1",
      unitPrice: "10",
      totalAmount: "10,00",
      date: "2026-02-31",
      competenceMonth: "2026-02",
    });
    assert.equal(impossibleDate.status, 400);

    const zeroAmount = await postInvestment(db, context, "/api/investments/operations", {
      assetId: "mxrf11",
      operationType: "COMPRA",
      subtype: "APORTE",
      quantity: "1",
      unitPrice: "10",
      totalAmount: "0,00",
      date: "2026-02-28",
      competenceMonth: "2026-02",
    });
    assert.equal(zeroAmount.status, 400);
    assert.equal(db.prepare("select count(*) as total from transactions where user_id = 'user_a'").get().total, 0);
  } finally {
    cleanup();
  }
});

test("api investments cadastra preco manual e rejeita moeda diferente do ativo", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    insertAsset(db, "user_a", { id: "voo", ticker: "VOO", name: "Vanguard S&P 500", assetClass: "ETF_US", currency: "USD" });

    const ok = await postInvestment(db, context, "/api/investments/prices", { assetId: "voo", price: "410.25", currency: "USD", quotedAt: "2026-08-20T10:00:00.000Z" });
    assert.equal(ok.status, 201);
    assert.equal(db.prepare("select price_decimal from asset_prices where user_id = 'user_a'").get().price_decimal, "410.25");

    const mismatch = await postInvestment(db, context, "/api/investments/prices", { assetId: "voo", price: "410.25", currency: "BRL", quotedAt: "2026-08-20T10:00:00.000Z" });
    assert.equal(mismatch.status, 400);
    const impossibleDate = await postInvestment(db, context, "/api/investments/prices", { assetId: "voo", price: "410.25", currency: "USD", quotedAt: "2026-02-31T10:00:00.000Z" });
    assert.equal(impossibleDate.status, 400);
    assert.equal(db.prepare("select count(*) as total from asset_prices where user_id = 'user_a'").get().total, 1);
  } finally {
    cleanup();
  }
});

test("api investments cadastra cambio USD/BRL e rejeita user_id e cross-user", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    const userB = { userId: "user_b" };
    bootstrapLocalUser(db, userA);
    bootstrapLocalUser(db, userB);
    insertAsset(db, "user_b", { id: "asset_b", ticker: "B", name: "Outro ativo", assetClass: "REIT", currency: "USD" });

    const exchange = await postInvestment(db, userA, "/api/investments/exchange-rates", { baseCurrency: "USD", quoteCurrency: "BRL", rate: "5.4", referenceDate: "2026-08-20" });
    assert.equal(exchange.status, 201);
    assert.equal(db.prepare("select rate_decimal from exchange_rates where user_id = 'user_a'").get().rate_decimal, "5.4");

    const userIdPayload = await postInvestment(db, userA, "/api/investments/exchange-rates", { user_id: "user_b", baseCurrency: "USD", quoteCurrency: "BRL", rate: "5.4", referenceDate: "2026-08-20" });
    assert.equal(userIdPayload.status, 400);
    const invalidPair = await postInvestment(db, userA, "/api/investments/exchange-rates", { baseCurrency: "EUR", quoteCurrency: "BRL", rate: "5.4", referenceDate: "2026-08-20" });
    assert.equal(invalidPair.status, 400);
    const zeroRate = await postInvestment(db, userA, "/api/investments/exchange-rates", { baseCurrency: "USD", quoteCurrency: "BRL", rate: "0", referenceDate: "2026-08-20" });
    assert.equal(zeroRate.status, 400);

    const crossUser = await postInvestment(db, userA, "/api/investments/operations", {
      assetId: "asset_b",
      operationType: "COMPRA",
      subtype: "APORTE",
      quantity: "1",
      unitPrice: "10",
      totalAmount: "10.00",
      date: "2026-08-10",
      competenceMonth: "2026-08",
    });
    assert.equal(crossUser.status, 400);
    assert.equal(db.prepare("select count(*) as total from investment_events where user_id = 'user_a'").get().total, 0);
  } finally {
    cleanup();
  }
});
