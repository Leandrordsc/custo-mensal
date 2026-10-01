import type { DatabaseSync } from "node:sqlite";
import type { AuthenticatedUserContext } from "./auth-context.ts";
import { requireAuthenticatedUser } from "./auth-context.ts";
import { createId, generateInstallments, normalizeExpenseInput, nowIso, type ExpenseInput } from "./expense-domain.ts";
import { AccountsRepository, CardsRepository, CategoriesRepository, TransactionsRepository } from "./finance-repositories.ts";

export class ExpenseService {
  private readonly db: DatabaseSync;
  private readonly categories: CategoriesRepository;
  private readonly accounts: AccountsRepository;
  private readonly cards: CardsRepository;
  private readonly transactions: TransactionsRepository;

  constructor(db: DatabaseSync) {
    this.db = db;
    this.categories = new CategoriesRepository(db);
    this.accounts = new AccountsRepository(db);
    this.cards = new CardsRepository(db);
    this.transactions = new TransactionsRepository(db);
  }

  listBases(context: AuthenticatedUserContext) {
    return {
      categories: this.categories.list(context),
      accounts: this.accounts.list(context),
      cards: this.cards.list(context),
    };
  }

  listExpenses(context: AuthenticatedUserContext, filters: { year: number; month?: number | null }) {
    return this.transactions.listExpenses(context, filters);
  }

  getExpense(context: AuthenticatedUserContext, id: string) {
    return this.transactions.getExpenseById(context, id);
  }

  summarize(context: AuthenticatedUserContext, filters: { year: number; month?: number | null }) {
    return this.transactions.summarizeExpenses(context, filters);
  }

  createExpense(context: AuthenticatedUserContext, input: ExpenseInput) {
    const { userId } = requireAuthenticatedUser(context);
    const expense = normalizeExpenseInput(input);
    this.validateRelations(context, expense);

    const createdIds: string[] = [];
    this.transaction(() => {
      if (expense.paymentMethod === "CARTAO" && expense.installments > 1) {
        const purchaseId = createId("purchase");
        this.db.prepare(`
          insert into card_purchases (id, user_id, card_id, purchase_date, description, total_amount_cents, total_installments, currency)
          values (?, ?, ?, ?, ?, ?, ?, 'BRL')
        `).run(purchaseId, userId, expense.cardId ?? null, expense.date, expense.description, expense.amountCents, expense.installments);

        for (const installment of generateInstallments(expense.amountCents, expense.installments, expense.competenceMonth)) {
          const transactionId = createId("tx");
          createdIds.push(transactionId);
          insertExpenseTransaction(this.db, userId, transactionId, expense, installment.amountCents, installment.competenceMonth);
          this.db.prepare(`
            insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents)
            values (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(createId("installment"), userId, purchaseId, transactionId, installment.installmentNumber, installment.totalInstallments, installment.competenceMonth, installment.amountCents);
        }
      } else {
        const transactionId = createId("tx");
        createdIds.push(transactionId);
        insertExpenseTransaction(this.db, userId, transactionId, expense, expense.amountCents, expense.competenceMonth);
      }
    });

    return createdIds.map((id) => this.getExpense(context, id));
  }

  updateExpense(context: AuthenticatedUserContext, id: string, input: ExpenseInput) {
    const { userId } = requireAuthenticatedUser(context);
    const current = this.transactions.getExpenseById(context, id);
    if (current.transactionStatus !== "ACTIVE") {
      throw new Error("Despesa cancelada nao pode ser editada.");
    }

    const expense = normalizeExpenseInput(input);
    this.validateRelations(context, expense);

    this.transaction(() => {
      const relatedIds = current.cardPurchaseId ? this.listTransactionIdsForPurchase(context, current.cardPurchaseId) : [id];
      for (const transactionId of relatedIds) {
        this.transactions.assertExpenseBelongsToUser(context, transactionId);
      }

      if (current.cardPurchaseId) {
        this.db.prepare("update card_purchases set card_id = ?, purchase_date = ?, description = ?, total_amount_cents = ?, total_installments = ? where user_id = ? and id = ?")
          .run(expense.cardId ?? null, expense.date, expense.description, expense.amountCents, expense.installments, userId, current.cardPurchaseId);

        const installments = generateInstallments(expense.amountCents, expense.installments, expense.competenceMonth);
        for (const [index, transactionId] of relatedIds.entries()) {
          const installment = installments[index];
          if (!installment) {
            cancelTransaction(this.db, userId, transactionId);
            continue;
          }
          updateExpenseTransaction(this.db, userId, transactionId, expense, installment.amountCents, installment.competenceMonth);
          this.db.prepare(`
            update card_installments
            set installment_number = ?,
                total_installments = ?,
                statement_month = ?,
                amount_cents = ?
            where user_id = ?
              and card_purchase_id = ?
              and transaction_id = ?
          `).run(installment.installmentNumber, installment.totalInstallments, installment.competenceMonth, installment.amountCents, userId, current.cardPurchaseId, transactionId);
        }

        for (const installment of installments.slice(relatedIds.length)) {
          const transactionId = createId("tx");
          insertExpenseTransaction(this.db, userId, transactionId, expense, installment.amountCents, installment.competenceMonth);
          this.db.prepare(`
            insert into card_installments (id, user_id, card_purchase_id, transaction_id, installment_number, total_installments, statement_month, amount_cents)
            values (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(createId("installment"), userId, current.cardPurchaseId, transactionId, installment.installmentNumber, installment.totalInstallments, installment.competenceMonth, installment.amountCents);
        }
      } else {
        updateExpenseTransaction(this.db, userId, id, expense, expense.amountCents, expense.competenceMonth);
      }
    });

    return this.transactions.getExpenseById(context, id);
  }

  cancelExpense(context: AuthenticatedUserContext, id: string) {
    const { userId } = requireAuthenticatedUser(context);
    this.transactions.assertExpenseBelongsToUser(context, id);
    const current = this.transactions.getExpenseById(context, id);
    const ids = current.cardPurchaseId ? this.listTransactionIdsForPurchase(context, current.cardPurchaseId) : [id];
    this.transaction(() => {
      for (const transactionId of ids) {
        this.transactions.assertExpenseBelongsToUser(context, transactionId);
        cancelTransaction(this.db, userId, transactionId);
      }
    });
    return this.transactions.getExpenseById(context, id);
  }

  private validateRelations(context: AuthenticatedUserContext, expense: ReturnType<typeof normalizeExpenseInput>) {
    this.categories.assertBelongsToUser(context, expense.categoryId);
    if (expense.paymentMethod === "CONTA" && expense.accountId) {
      this.accounts.assertBelongsToUser(context, expense.accountId);
    }
    if (expense.paymentMethod === "CARTAO" && expense.cardId) {
      this.cards.assertBelongsToUser(context, expense.cardId);
    }
  }

  private listTransactionIdsForPurchase(context: AuthenticatedUserContext, purchaseId: string) {
    const { userId } = requireAuthenticatedUser(context);
    return this.db.prepare("select transaction_id from card_installments where user_id = ? and card_purchase_id = ? order by installment_number")
      .all(userId, purchaseId)
      .map((row) => String(row.transaction_id));
  }

  private transaction(work: () => void) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      work();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function insertExpenseTransaction(db: DatabaseSync, userId: string, id: string, expense: ReturnType<typeof normalizeExpenseInput>, amountCents: number, competenceMonth: string) {
  const timestamp = nowIso();
  db.prepare(`
    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      category_id, source_account_id, card_id, date, competence_month, description,
      amount_cents, currency, direction, notes, created_at, updated_at
    ) values (?, ?, 'DESPESA', 'COMPRA', ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, 'BRL', 'OUTFLOW', ?, ?, ?)
  `).run(
    id,
    userId,
    "MANUAL",
    expense.classificationStatus,
    expense.categoryId,
    expense.paymentMethod === "CONTA" ? expense.accountId ?? null : null,
    expense.paymentMethod === "CARTAO" ? expense.cardId ?? null : null,
    expense.date,
    competenceMonth,
    expense.description,
    amountCents,
    expense.notes ?? null,
    timestamp,
    timestamp,
  );
}

function updateExpenseTransaction(db: DatabaseSync, userId: string, id: string, expense: ReturnType<typeof normalizeExpenseInput>, amountCents: number, competenceMonth: string) {
  db.prepare(`
    update transactions
    set origin = 'MANUAL',
        classification_status = ?,
        category_id = ?,
        source_account_id = ?,
        card_id = ?,
        date = ?,
        competence_month = ?,
        description = ?,
        amount_cents = ?,
        notes = ?,
        updated_at = ?
    where user_id = ?
      and id = ?
      and transaction_status = 'ACTIVE'
  `).run(
    expense.classificationStatus,
    expense.categoryId,
    expense.paymentMethod === "CONTA" ? expense.accountId ?? null : null,
    expense.paymentMethod === "CARTAO" ? expense.cardId ?? null : null,
    expense.date,
    competenceMonth,
    expense.description,
    amountCents,
    expense.notes ?? null,
    nowIso(),
    userId,
    id,
  );
}

function cancelTransaction(db: DatabaseSync, userId: string, id: string) {
  const timestamp = nowIso();
  db.prepare(`
    update transactions
    set transaction_status = 'CANCELADO',
        voided_at = ?,
        voided_by = ?,
        updated_at = ?
    where user_id = ?
      and id = ?
      and transaction_status = 'ACTIVE'
  `).run(timestamp, userId, timestamp, userId, id);
}
