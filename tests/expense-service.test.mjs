import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createLocalApiHandler } from "../scripts/local-api-server.mjs";
import { applyMigrationAtomically, readLocalMigrations } from "../scripts/migrate-local.mjs";
import { parseBrlToCents, generateInstallments } from "../lib/expense-domain.ts";
import { ExpenseService } from "../lib/expense-service.ts";
import { bootstrapLocalUser } from "../lib/local-bootstrap.ts";

let migrationsCache;

async function migrations() {
  migrationsCache ??= await readLocalMigrations();
  return migrationsCache;
}

async function createDatabase() {
  const dir = mkdtempSync(join(tmpdir(), "custo-mensal-expense-"));
  const path = join(dir, "test.sqlite");
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  for (const migration of await migrations()) {
    applyMigrationAtomically(db, migration);
  }
  return {
    db,
    path,
    cleanup() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function sampleExpense(bases, override = {}) {
  return {
    description: "Mercado",
    amount: "123,45",
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

test("normaliza BRL para centavos e distribui parcelas com arredondamento deterministico", () => {
  assert.equal(parseBrlToCents("123,45"), 12345);
  assert.equal(parseBrlToCents("10"), 1000);
  assert.deepEqual(generateInstallments(10000, 3, "2026-08").map((item) => [item.installmentNumber, item.competenceMonth, item.amountCents]), [
    [1, "2026-08", 3334],
    [2, "2026-09", 3333],
    [3, "2026-10", 3333],
  ]);
});

test("servico cria, lista, edita e cancela despesa sem delete fisico", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const service = new ExpenseService(db);
    const bases = service.listBases(context);

    const [created] = service.createExpense(context, sampleExpense(bases));
    assert.equal(created.amountCents, 12345);
    assert.equal(created.paymentMethod, "CONTA");
    assert.equal(created.transactionStatus, "ACTIVE");
    assert.equal(db.prepare("select origin from transactions where id = ?").get(created.id).origin, "MANUAL");

    assert.equal(service.summarize(context, { year: 2026, month: 8 }).totalConfirmedCents, 12345);
    service.updateExpense(context, created.id, sampleExpense(bases, { description: "Mercado editado", amount: "130,00" }));
    assert.equal(service.getExpense(context, created.id).description, "Mercado editado");
    assert.equal(service.summarize(context, { year: 2026, month: 8 }).totalConfirmedCents, 13000);

    service.cancelExpense(context, created.id);
    assert.equal(service.getExpense(context, created.id).transactionStatus, "CANCELADO");
    assert.equal(db.prepare("select count(*) as total from transactions where id = ?").get(created.id).total, 1);
    assert.equal(service.summarize(context, { year: 2026, month: 8 }).totalConfirmedCents, 0);
  } finally {
    cleanup();
  }
});

test("servico persiste despesas apos reabrir o SQLite", async () => {
  const createdDb = await createDatabase();
  const { db, path } = createdDb;
  const context = { userId: "user_a" };
  bootstrapLocalUser(db, context);
  const service = new ExpenseService(db);
  const bases = service.listBases(context);
  service.createExpense(context, sampleExpense(bases, { description: "Persistida" }));
  db.close();

  const reopened = new DatabaseSync(path);
  try {
    reopened.exec("PRAGMA foreign_keys = ON");
    const reopenedService = new ExpenseService(reopened);
    assert.equal(reopenedService.listExpenses(context, { year: 2026, month: 8 })[0].description, "Persistida");
  } finally {
    reopened.close();
    rmSync(dirname(path), { recursive: true, force: true });
  }
});

test("servico cria compra parcelada por mes de fatura e cancela todas as parcelas", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const service = new ExpenseService(db);
    const bases = service.listBases(context);
    const created = service.createExpense(context, sampleExpense(bases, {
      description: "Notebook",
      amount: "100,00",
      paymentMethod: "CARTAO",
      accountId: "",
      cardId: bases.cards[0].id,
      isInstallment: true,
      installments: 3,
    }));

    assert.equal(created.length, 3);
    assert.deepEqual(created.map((item) => [item.installmentNumber, item.totalInstallments, item.competenceMonth, item.paymentMethod]), [
      [1, 3, "2026-08", "CARTAO"],
      [2, 3, "2026-09", "CARTAO"],
      [3, 3, "2026-10", "CARTAO"],
    ]);
    assert.equal(created.reduce((total, item) => total + item.amountCents, 0), 10000);
    assert.equal(service.summarize(context, { year: 2026, month: 8 }).totalCardCents, 3334);

    service.cancelExpense(context, created[0].id);
    assert.equal(db.prepare("select count(*) as total from transactions where transaction_status = 'CANCELADO'").get().total, 3);
    assert.equal(db.prepare("select count(*) as total from card_installments").get().total, 3);
    assert.equal(service.summarize(context, { year: 2026, month: 8 }).totalConfirmedCents, 0);
  } finally {
    cleanup();
  }
});

test("servico rejeita relacionamento cross-user", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const userA = { userId: "user_a" };
    const userB = { userId: "user_b" };
    bootstrapLocalUser(db, userA);
    bootstrapLocalUser(db, userB);
    const service = new ExpenseService(db);
    const basesA = service.listBases(userA);
    const basesB = service.listBases(userB);

    assert.throws(() => service.createExpense(userA, sampleExpense(basesA, { categoryId: basesB.categories[0].id })), /Categoria nao pertence/);
    assert.throws(() => service.createExpense(userA, sampleExpense(basesA, { accountId: basesB.accounts[0].id })), /Conta nao pertence/);
    assert.throws(() => service.createExpense(userA, sampleExpense(basesA, { paymentMethod: "CARTAO", accountId: "", cardId: basesB.cards[0].id })), /Cartao nao pertence/);
  } finally {
    cleanup();
  }
});

test("api local rejeita user_id no payload e usa contexto autenticado", async () => {
  const { db, cleanup } = await createDatabase();
  try {
    const context = { userId: "user_a" };
    bootstrapLocalUser(db, context);
    const handler = createLocalApiHandler({ db, context });
    const bases = await (await handler(new Request("http://local/api/costs/bases"))).json();
    const response = await handler(new Request("http://local/api/costs/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...sampleExpense(bases), user_id: "user_b" }),
    }));

    assert.equal(response.status, 400);
    assert.match(JSON.stringify(await response.json()), /user_id nao pode ser informado/);
    assert.equal(db.prepare("select count(*) as total from transactions").get().total, 0);
  } finally {
    cleanup();
  }
});
