import type { DatabaseSync } from "node:sqlite";
import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";

export type CategoryRecord = {
  id: string;
  name: string;
  countsAsLivingCost: boolean;
};

export type AccountRecord = {
  id: string;
  name: string;
  accountType: string;
};

export type CardRecord = {
  id: string;
  name: string;
  status: string;
};

export type ExpenseRecord = {
  id: string;
  date: string;
  competenceMonth: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethod: "CONTA" | "CARTAO";
  accountId: string | null;
  accountName: string | null;
  cardId: string | null;
  cardName: string | null;
  classificationStatus: string;
  transactionStatus: string;
  notes: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  cardPurchaseId: string | null;
};

export class CategoriesRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  list(context: AuthenticatedUserContext): CategoryRecord[] {
    const { userId } = requireAuthenticatedUser(context);
    return this.db.prepare("select id, name, counts_as_living_cost from categories where user_id = ? and active = 1 order by name")
      .all(userId)
      .map((row) => ({
        id: String(row.id),
        name: String(row.name),
        countsAsLivingCost: Number(row.counts_as_living_cost) === 1,
      }));
  }

  assertBelongsToUser(context: AuthenticatedUserContext, categoryId: string) {
    assertUserOwned(this.db, context, "categories", categoryId, "Categoria");
  }
}

export class AccountsRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  list(context: AuthenticatedUserContext): AccountRecord[] {
    const { userId } = requireAuthenticatedUser(context);
    return this.db.prepare("select id, name, account_type from accounts where user_id = ? and active = 1 order by name")
      .all(userId)
      .map((row) => ({ id: String(row.id), name: String(row.name), accountType: String(row.account_type) }));
  }

  assertBelongsToUser(context: AuthenticatedUserContext, accountId: string) {
    assertUserOwned(this.db, context, "accounts", accountId, "Conta");
  }
}

export class CardsRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  list(context: AuthenticatedUserContext): CardRecord[] {
    const { userId } = requireAuthenticatedUser(context);
    return this.db.prepare("select id, name, status from cards where user_id = ? and status in ('ATIVO', 'HISTORICO') order by status, name")
      .all(userId)
      .map((row) => ({ id: String(row.id), name: String(row.name), status: String(row.status) }));
  }

  assertBelongsToUser(context: AuthenticatedUserContext, cardId: string) {
    assertUserOwned(this.db, context, "cards", cardId, "Cartao");
  }
}

export class TransactionsRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  listExpenses(context: AuthenticatedUserContext, filters: { year: number; month?: number | null }): ExpenseRecord[] {
    const { userId } = requireAuthenticatedUser(context);
    const fromMonth = `${filters.year}-${String(filters.month ?? 1).padStart(2, "0")}`;
    const toMonth = `${filters.year}-${String(filters.month ?? 12).padStart(2, "0")}`;

    return this.db.prepare(`
      select
        t.id, t.date, t.competence_month, t.description, t.amount_cents, t.category_id,
        c.name as category_name, t.source_account_id, a.name as account_name,
        t.card_id, cd.name as card_name, t.origin, t.classification_status,
        t.transaction_status, t.notes, t.voided_at, t.voided_by,
        ci.installment_number, ci.total_installments, ci.card_purchase_id
      from transactions t
      left join categories c on c.user_id = t.user_id and c.id = t.category_id
      left join accounts a on a.user_id = t.user_id and a.id = t.source_account_id
      left join cards cd on cd.user_id = t.user_id and cd.id = t.card_id
      left join card_installments ci on ci.user_id = t.user_id and ci.transaction_id = t.id
      where t.user_id = ?
        and t.nature = 'DESPESA'
        and t.subtype = 'COMPRA'
        and t.origin in ('CONTA', 'CARTAO', 'MANUAL')
        and t.competence_month >= ?
        and t.competence_month <= ?
      order by t.date desc, t.id desc
      limit 500
    `).all(userId, fromMonth, toMonth).map(mapExpenseRow);
  }

  getExpenseById(context: AuthenticatedUserContext, id: string): ExpenseRecord {
    const { userId } = requireAuthenticatedUser(context);
    const row = this.db.prepare(`
      select
        t.id, t.date, t.competence_month, t.description, t.amount_cents, t.category_id,
        c.name as category_name, t.source_account_id, a.name as account_name,
        t.card_id, cd.name as card_name, t.origin, t.classification_status,
        t.transaction_status, t.notes, t.voided_at, t.voided_by,
        ci.installment_number, ci.total_installments, ci.card_purchase_id
      from transactions t
      left join categories c on c.user_id = t.user_id and c.id = t.category_id
      left join accounts a on a.user_id = t.user_id and a.id = t.source_account_id
      left join cards cd on cd.user_id = t.user_id and cd.id = t.card_id
      left join card_installments ci on ci.user_id = t.user_id and ci.transaction_id = t.id
      where t.user_id = ? and t.id = ? and t.nature = 'DESPESA' and t.subtype = 'COMPRA'
    `).get(userId, id);

    if (!row) {
      throw new Error("Despesa nao encontrada.");
    }

    return mapExpenseRow(row);
  }

  summarizeExpenses(context: AuthenticatedUserContext, filters: { year: number; month?: number | null }) {
    const expenses = this.listExpenses(context, filters);
    const activeConfirmed = expenses.filter((expense) => expense.classificationStatus === "CONFIRMADO" && expense.transactionStatus === "ACTIVE");
    const pending = expenses.filter((expense) => expense.classificationStatus === "PENDENTE_REVISAO" && expense.transactionStatus === "ACTIVE");
    const byCategory = new Map<string, number>();

    for (const expense of activeConfirmed) {
      const category = expense.categoryName ?? "Sem categoria";
      byCategory.set(category, (byCategory.get(category) ?? 0) + expense.amountCents);
    }

    return {
      totalConfirmedCents: activeConfirmed.reduce((total, expense) => total + expense.amountCents, 0),
      totalCardCents: activeConfirmed.filter((expense) => expense.paymentMethod === "CARTAO").reduce((total, expense) => total + expense.amountCents, 0),
      totalPendingCents: pending.reduce((total, expense) => total + expense.amountCents, 0),
      count: activeConfirmed.length,
      byCategory: Array.from(byCategory, ([category, amountCents]) => ({ category, amountCents })),
    };
  }

  assertExpenseBelongsToUser(context: AuthenticatedUserContext, id: string) {
    assertUserOwned(this.db, context, "transactions", id, "Despesa");
  }
}

export function assertUserOwned(db: DatabaseSync, context: AuthenticatedUserContext, table: string, id: string, label: string) {
  const { userId } = requireAuthenticatedUser(context);
  const row = db.prepare(`select id from ${table} where user_id = ? and id = ?`).get(userId, id);
  if (!row) {
    throw new Error(`${label} nao pertence ao usuario autenticado.`);
  }
}

function mapExpenseRow(row: Record<string, unknown>): ExpenseRecord {
  return {
    id: String(row.id),
    date: String(row.date),
    competenceMonth: String(row.competence_month),
    description: String(row.description),
    amountCents: Number(row.amount_cents),
    categoryId: nullableString(row.category_id),
    categoryName: nullableString(row.category_name),
    paymentMethod: nullableString(row.card_id) ? "CARTAO" : "CONTA",
    accountId: nullableString(row.source_account_id),
    accountName: nullableString(row.account_name),
    cardId: nullableString(row.card_id),
    cardName: nullableString(row.card_name),
    classificationStatus: String(row.classification_status),
    transactionStatus: String(row.transaction_status),
    notes: nullableString(row.notes),
    voidedAt: nullableString(row.voided_at),
    voidedBy: nullableString(row.voided_by),
    installmentNumber: nullableNumber(row.installment_number),
    totalInstallments: nullableNumber(row.total_installments),
    cardPurchaseId: nullableString(row.card_purchase_id),
  };
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}
