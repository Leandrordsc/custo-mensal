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
    assert.equal(september.summary.livingCostCents, 10000);
    assert.equal(september.summary.cardPurchasesCents, 10000);
    assert.equal(august.categories[0].amountCents, 22000);
    assert.equal(august.summary.livingCostCents < 99900, true);
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
