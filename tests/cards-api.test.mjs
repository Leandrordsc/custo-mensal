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
  const dir = mkdtempSync(join(tmpdir(), "custo-cards-api-"));
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
    amount: "100,00",
    date: "2026-08-10",
    competenceMonth: "2026-08",
    categoryId: bases.categories[0].id,
    paymentMethod: "CARTAO",
    accountId: "",
    cardId: bases.cards[0].id,
    notes: "",
    classificationStatus: "CONFIRMADO",
    isInstallment: false,
    installments: 1,
    ...override,
  };
}

async function getOverview(db, context, month = "8") {
  const handler = createLocalApiHandler({ db, context });
  const response = await handler(new Request(`http://local/api/cards/overview?year=2026&month=${month}`));
  assert.equal(response.status, 200);
  return response.json();
}

test("api cards mostra BTG e Mercado Pago ativos com banco sem compras", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);

    const body = await getOverview(db, context);

    assert.equal(body.hasPurchases, false);
    assert.equal(body.summary.invoiceCents, 0);
    assert.equal(body.summary.estimatedCashbackCents, 0);
    assert.deepEqual(body.cards.map((card) => [card.name, card.status, card.invoiceCents]), [
      ["BTG", "ATIVO", 0],
      ["Mercado Pago", "ATIVO", 0],
    ]);
  } finally {
    cleanup();
  }
});

test("api cards soma compra a vista, pagamento de fatura e cashback separado", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const service = new ExpenseService(db);
    const bases = service.listBases(context);
    service.createExpense(context, expenseInput(bases, { amount: "200,00", cardId: bases.cards[0].id }));
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        source_account_id, card_id, date, competence_month, description, amount_cents, currency, direction
      ) values ('pay_a', 'user_a', 'TRANSFERENCIA', 'PAGAMENTO_FATURA', 'CONTA', 'CONFIRMADO', 'ACTIVE', ?, ?, '2026-08-20', '2026-08', 'Pagamento fatura', 20000, 'BRL', 'TRANSFER_OUT')
    `).run(bases.accounts[0].id, bases.cards[0].id);
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        card_id, date, competence_month, description, amount_cents, currency, direction
      ) values ('cashback_tx_a', 'user_a', 'RECEITA', 'CASHBACK', 'CARTAO', 'CONFIRMADO', 'ACTIVE', ?, '2026-08-25', '2026-08', 'Cashback real', 180, 'BRL', 'INFLOW')
    `).run(bases.cards[0].id);
    db.prepare(`
      insert into cashback_events (id, user_id, transaction_id, card_id, month, amount_cents, value_type, contabilizable)
      values ('cashback_event_a', 'user_a', 'cashback_tx_a', ?, '2026-08', 180, 'REAL', 1)
    `).run(bases.cards[0].id);

    const body = await getOverview(db, context);

    assert.equal(body.summary.invoiceCents, 20000);
    assert.equal(body.summary.purchaseCents, 20000);
    assert.equal(body.summary.paymentCents, 20000);
    assert.equal(body.summary.confirmedCashbackCents, 180);
    assert.equal(body.summary.estimatedCashbackCents, 200);
    assert.equal(body.purchases.length, 1);
    assert.equal(body.movements.length, 1);
  } finally {
    cleanup();
  }
});

test("api cards estima cashback por cartao usando uma unica regra vigente", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const service = new ExpenseService(db);
    const bases = service.listBases(context);
    const btg = bases.cards.find((card) => card.name === "BTG");
    const mercadoPago = bases.cards.find((card) => card.name === "Mercado Pago");
    assert.ok(btg);
    assert.ok(mercadoPago);
    db.prepare(`
      insert into card_rules (id, user_id, card_id, cashback_rate_bps, valid_from, valid_to)
      values ('btg_overlap', 'user_a', ?, 200, '2026-08-01', null)
    `).run(btg.id);

    service.createExpense(context, expenseInput(bases, { amount: "100,00", cardId: btg.id }));
    service.createExpense(context, expenseInput(bases, { amount: "100,00", cardId: mercadoPago.id }));

    const body = await getOverview(db, context);
    const byName = new Map(body.cards.map((card) => [card.name, card]));

    assert.equal(byName.get("BTG").estimatedCashbackCents, 200);
    assert.equal(byName.get("Mercado Pago").estimatedCashbackCents, 50);
    assert.equal(body.summary.estimatedCashbackCents, 250);
  } finally {
    cleanup();
  }
});

test("api cards respeita mes da parcela e inclui cartao historico com movimento", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const service = new ExpenseService(db);
    const bases = service.listBases(context);
    service.createExpense(context, expenseInput(bases, {
      description: "Notebook",
      amount: "90,00",
      isInstallment: true,
      installments: 3,
      cardId: bases.cards[0].id,
    }));
    db.prepare(`
      insert into cards (id, user_id, name, issuer, status, closing_day, due_day)
      values ('hist_card_a', 'user_a', 'Itau antigo', 'Itau', 'HISTORICO', 20, 10)
    `).run();
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        card_id, date, competence_month, description, amount_cents, currency, direction
      ) values ('hist_tx_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'ACTIVE', 'hist_card_a', '2026-09-02', '2026-09', 'Compra historica', 5000, 'BRL', 'OUTFLOW')
    `).run();

    const august = await getOverview(db, context, "8");
    const september = await getOverview(db, context, "9");
    const november = await getOverview(db, context, "11");

    assert.equal(august.summary.invoiceCents, 3000);
    assert.equal(september.summary.invoiceCents, 8000);
    assert.equal(november.summary.invoiceCents, 0);
    assert.equal(september.cards.some((card) => card.name === "Itau antigo" && card.status === "HISTORICO"), true);
    assert.equal(august.cards.some((card) => card.name === "Itau antigo"), false);
  } finally {
    cleanup();
  }
});

test("api cards nao lista cartao historico apenas com movimento pendente ou cancelado", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    db.prepare(`
      insert into cards (id, user_id, name, issuer, status, closing_day, due_day)
      values ('hist_pending_a', 'user_a', 'Historico pendente', 'Itau', 'HISTORICO', 20, 10)
    `).run();
    db.prepare(`
      insert into cards (id, user_id, name, issuer, status, closing_day, due_day)
      values ('hist_canceled_a', 'user_a', 'Historico cancelado', 'Nubank', 'HISTORICO', 20, 10)
    `).run();
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        card_id, date, competence_month, description, amount_cents, currency, direction
      ) values ('hist_pending_tx_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'PENDENTE_REVISAO', 'ACTIVE', 'hist_pending_a', '2026-08-02', '2026-08', 'Compra pendente', 5000, 'BRL', 'OUTFLOW')
    `).run();
    db.prepare(`
      insert into transactions (
        id, user_id, nature, subtype, origin, classification_status, transaction_status,
        card_id, date, competence_month, description, amount_cents, currency, direction
      ) values ('hist_canceled_tx_a', 'user_a', 'DESPESA', 'COMPRA', 'CARTAO', 'CONFIRMADO', 'CANCELADO', 'hist_canceled_a', '2026-08-02', '2026-08', 'Compra cancelada', 5000, 'BRL', 'OUTFLOW')
    `).run();

    const body = await getOverview(db, context);

    assert.equal(body.cards.some((card) => card.name === "Historico pendente"), false);
    assert.equal(body.cards.some((card) => card.name === "Historico cancelado"), false);
  } finally {
    cleanup();
  }
});

test("api cards isola dados de outro usuario", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    const userB = { userId: "user_b" };
    bootstrapLocalUser(db, userA);
    bootstrapLocalUser(db, userB);
    const service = new ExpenseService(db);
    const basesB = service.listBases(userB);
    service.createExpense(userB, expenseInput(basesB, { amount: "999,00", cardId: basesB.cards[0].id }));

    const body = await getOverview(db, userA);

    assert.equal(body.summary.invoiceCents, 0);
    assert.equal(body.purchases.length, 0);
    assert.deepEqual(body.cards.map((card) => card.name), ["BTG", "Mercado Pago"]);
  } finally {
    cleanup();
  }
});

test("api cards rejeita periodo invalido", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const handler = createLocalApiHandler({ db, context });
    const response = await handler(new Request("http://local/api/cards/overview?year=2026&month=13"));

    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /Mes invalido/);
  } finally {
    cleanup();
  }
});
