import { DatabaseSync } from "node:sqlite";
import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";
import { calculateDashboardSummary, isCardPurchase, type DashboardPeriod, type DashboardSummary, type DashboardTransaction, type EstimatedCashback } from "./dashboard-rules.ts";

export type DashboardRepository = {
  getDashboardSummary(context: AuthenticatedUserContext, period: DashboardPeriod): DashboardSummary;
  getDashboardOverview(context: AuthenticatedUserContext, period: DashboardPeriod): DashboardOverview;
};

export type DashboardOverview = {
  summary: DashboardSummary;
  monthlySeries: DashboardMonthSummary[];
  categories: DashboardCategorySummary[];
  transactionCount: number;
  countableTransactionCount: number;
  hasTransactions: boolean;
  hasFinancialImpact: boolean;
};

export type DashboardMonthSummary = {
  month: string;
  livingCostCents: number;
  cardPurchasesCents: number;
  pendingReviewCents: number;
};

export type DashboardCategorySummary = {
  category: string;
  amountCents: number;
};

type TransactionRow = {
  id: string;
  user_id: string;
  nature: DashboardTransaction["nature"];
  subtype: DashboardTransaction["subtype"];
  origin: DashboardTransaction["origin"];
  classification_status: DashboardTransaction["classificationStatus"];
  transaction_status: DashboardTransaction["transactionStatus"];
  competence_month: string;
  amount_cents: number;
  card_id: string | null;
  category_counts_as_living_cost: 0 | 1 | null;
  category_name: string | null;
};

type EstimatedCashbackRow = {
  id: string;
  user_id: string;
  month: string;
  amount_cents: number;
  value_type: "ESTIMADO";
  contabilizable: 0;
  transaction_id: null;
};

export class SQLiteDashboardRepository implements DashboardRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  getDashboardSummary(context: AuthenticatedUserContext, period: DashboardPeriod): DashboardSummary {
    return this.getDashboardOverview(context, period).summary;
  }

  getDashboardOverview(context: AuthenticatedUserContext, period: DashboardPeriod): DashboardOverview {
    const { userId } = requireAuthenticatedUser(context);

    const transactions = this.db.prepare(`
      select
        t.id,
        t.user_id,
        t.nature,
        t.subtype,
        t.origin,
        t.classification_status,
        t.transaction_status,
        t.competence_month,
        t.amount_cents,
        t.card_id,
        c.counts_as_living_cost as category_counts_as_living_cost,
        c.name as category_name
      from transactions t
      left join categories c
        on c.id = t.category_id
       and c.user_id = t.user_id
      where t.user_id = ?
        and t.competence_month >= ?
        and t.competence_month <= ?
    `).all(userId, period.fromMonth, period.toMonth) as TransactionRow[];

    const estimatedCashbacks = this.db.prepare(`
      select id, user_id, month, amount_cents, value_type, contabilizable, transaction_id
      from cashback_events
      where user_id = ?
        and month >= ?
        and month <= ?
        and value_type = 'ESTIMADO'
        and contabilizable = 0
        and transaction_id is null
    `).all(userId, period.fromMonth, period.toMonth) as EstimatedCashbackRow[];

    const mappedTransactions = transactions.map(mapTransaction);
    const summary = calculateDashboardSummary({
      period,
      transactions: mappedTransactions,
      estimatedCashbacks: estimatedCashbacks.map(mapEstimatedCashback),
    });

    return {
      summary,
      monthlySeries: buildMonthlySeries(period, mappedTransactions),
      categories: buildCategorySummary(mappedTransactions),
      transactionCount: transactions.length,
      countableTransactionCount: countDashboardActivities(mappedTransactions, estimatedCashbacks.length),
      hasTransactions: transactions.length > 0,
      hasFinancialImpact: hasDashboardImpact(summary),
    };
  }
}

function countDashboardActivities(transactions: DashboardTransaction[], estimatedCashbackCount: number) {
  return transactions.filter(isDashboardActivity).length + estimatedCashbackCount;
}

function isDashboardActivity(transaction: DashboardTransaction) {
  if (transaction.transactionStatus !== "ACTIVE") {
    return false;
  }

  if (transaction.classificationStatus === "PENDENTE_REVISAO" || transaction.classificationStatus === "REJEITADO") {
    return true;
  }

  if (transaction.classificationStatus !== "CONFIRMADO") {
    return false;
  }

  return isCardPurchase(transaction)
    || (transaction.nature === "DESPESA" && transaction.categoryCountsAsLivingCost === true)
    || transaction.nature === "TRANSFERENCIA"
    || transaction.nature === "INVESTIMENTO"
    || transaction.nature === "RECEITA";
}

function hasDashboardImpact(summary: DashboardSummary) {
  return [
    summary.livingCostCents,
    summary.cardPurchasesCents,
    summary.invoicePaymentsCents,
    summary.internalTransfersCents,
    summary.reserveTransfersCents,
    summary.contributionsCents,
    summary.reinvestmentsCents,
    summary.dividendsCents,
    summary.confirmedCashbackCents,
    summary.estimatedCashbackCents,
    summary.reserveEarningsCents,
    summary.pendingReviewCents,
    summary.rejectedCents,
  ].some((amountCents) => amountCents > 0);
}

function mapTransaction(row: TransactionRow): DashboardTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    nature: row.nature,
    subtype: row.subtype,
    origin: row.origin,
    classificationStatus: row.classification_status,
    transactionStatus: row.transaction_status,
    competenceMonth: row.competence_month,
    amountCents: row.amount_cents,
    cardId: row.card_id,
    categoryName: row.category_name,
    categoryCountsAsLivingCost: row.category_counts_as_living_cost === null ? null : row.category_counts_as_living_cost === 1,
  };
}

function mapEstimatedCashback(row: EstimatedCashbackRow): EstimatedCashback {
  return {
    id: row.id,
    userId: row.user_id,
    month: row.month,
    amountCents: row.amount_cents,
    valueType: row.value_type,
    contabilizable: false,
    transactionId: row.transaction_id,
  };
}

function buildMonthlySeries(period: DashboardPeriod, transactions: DashboardTransaction[]): DashboardMonthSummary[] {
  const months = enumerateMonths(period);
  return months.map((month) => {
    const summary = calculateDashboardSummary({
      period: { fromMonth: month, toMonth: month },
      transactions,
    });
    return {
      month,
      livingCostCents: summary.livingCostCents,
      cardPurchasesCents: summary.cardPurchasesCents,
      pendingReviewCents: summary.pendingReviewCents,
    };
  });
}

function buildCategorySummary(transactions: DashboardTransaction[]): DashboardCategorySummary[] {
  const totals = new Map<string, number>();
  for (const transaction of transactions) {
    if (
      transaction.nature === "DESPESA"
      && transaction.classificationStatus === "CONFIRMADO"
      && transaction.transactionStatus === "ACTIVE"
      && transaction.categoryCountsAsLivingCost === true
    ) {
      const category = transaction.categoryName ?? "Sem categoria";
      totals.set(category, (totals.get(category) ?? 0) + transaction.amountCents);
    }
  }
  return Array.from(totals, ([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

function enumerateMonths(period: DashboardPeriod) {
  const months: string[] = [];
  let [year, month] = period.fromMonth.split("-").map(Number);
  const [endYear, endMonth] = period.toMonth.split("-").map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}
