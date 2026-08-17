import { DatabaseSync } from "node:sqlite";
import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";
import { calculateDashboardSummary, type DashboardPeriod, type DashboardSummary, type DashboardTransaction, type EstimatedCashback } from "./dashboard-rules.ts";

export type DashboardRepository = {
  getDashboardSummary(context: AuthenticatedUserContext, period: DashboardPeriod): DashboardSummary;
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
  category_counts_as_living_cost: 0 | 1 | null;
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
        c.counts_as_living_cost as category_counts_as_living_cost
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

    return calculateDashboardSummary({
      period,
      transactions: transactions.map(mapTransaction),
      estimatedCashbacks: estimatedCashbacks.map(mapEstimatedCashback),
    });
  }
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
