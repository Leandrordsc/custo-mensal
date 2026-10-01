import type { DatabaseSync } from "node:sqlite";
import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";

export type CardsPeriod = {
  fromMonth: string;
  toMonth: string;
};

export type CardOverview = {
  period: CardsPeriod;
  cards: CardOverviewCard[];
  purchases: CardPurchaseLine[];
  monthlyHistory: CardMonthlyHistory[];
  monthlySeries: { month: string; invoiceTotalCents: number; estimatedCashbackCents: number; realCashbackCents: number }[];
  movements: CardPaymentMovement[];
  summary: {
    invoiceCents: number;
    invoiceTotalCents: number;
    purchaseCents: number;
    purchaseTotalCents: number;
    paymentCents: number;
    paymentTotalCents: number;
    confirmedCashbackCents: number;
    realCashbackCents: number;
    estimatedCashbackCents: number;
  };
  hasPurchases: boolean;
};

export type CardOverviewCard = {
  id: string;
  name: string;
  issuer: string | null;
  status: string;
  closingDay: number;
  dueDay: number;
  cashbackRateBps: number;
  invoiceCents: number;
  invoiceTotalCents: number;
  purchaseTotalCents: number;
  paymentCents: number;
  paymentTotalCents: number;
  confirmedCashbackCents: number;
  realCashbackCents: number;
  estimatedCashbackCents: number;
  installmentCount: number;
  purchases: CardPurchaseLine[];
};

export type CardPurchaseLine = {
  transactionId: string;
  cardId: string;
  cardName: string;
  purchaseId: string | null;
  date: string;
  statementMonth: string;
  description: string;
  amountCents: number;
  installmentNumber: number | null;
  totalInstallments: number | null;
};

export type CardMonthlyHistory = {
  month: string;
  invoiceCents: number;
  paymentCents: number;
  confirmedCashbackCents: number;
  estimatedCashbackCents: number;
};

export type CardPaymentMovement = {
  transactionId: string;
  cardId: string;
  cardName: string;
  date: string;
  competenceMonth: string;
  description: string;
  amountCents: number;
};

type CardRow = {
  id: string;
  name: string;
  issuer: string | null;
  status: string;
  closing_day: number;
  due_day: number;
};

type PurchaseRow = {
  transaction_id: string;
  card_id: string;
  card_name: string;
  purchase_id: string | null;
  date: string;
  statement_month: string;
  description: string;
  amount_cents: number;
  installment_number: number | null;
  total_installments: number | null;
};

type CardAmountRow = {
  card_id: string;
  amount_cents: number;
};

type CardRateRow = {
  card_id: string;
  cashback_rate_bps: number;
};

type PaymentMovementRow = {
  transaction_id: string;
  card_id: string;
  card_name: string;
  date: string;
  competence_month: string;
  description: string;
  amount_cents: number;
};

export class CardService {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  getOverview(context: AuthenticatedUserContext, period: CardsPeriod): CardOverview {
    const { userId } = requireAuthenticatedUser(context);
    assertPeriod(period);

    const purchases = this.listPurchases(userId, period);
    const invoiceByCard = sumByCard(purchases);
    const paymentsByCard = this.sumTransactionsByCard(userId, period, "TRANSFERENCIA", "PAGAMENTO_FATURA");
    const confirmedCashbackByCard = this.sumTransactionsByCard(userId, period, "RECEITA", "CASHBACK");
    const estimatedCashbackByCard = this.estimateCashbackByCard(userId, period);
    const cashbackRatesByCard = this.currentCashbackRatesByCard(userId);
    const purchasesByCard = groupPurchasesByCard(purchases);
    const activeCards = this.listActiveCards(userId);
    const historicalCards = this.listHistoricalCardsWithPeriodMovement(userId, period);
    const cardsById = new Map<string, CardOverviewCard>();

    for (const card of [...activeCards, ...historicalCards]) {
      cardsById.set(card.id, {
        id: card.id,
        name: card.name,
        issuer: card.issuer,
        status: card.status,
        closingDay: Number(card.closing_day),
        dueDay: Number(card.due_day),
        cashbackRateBps: cashbackRatesByCard.get(card.id) ?? 0,
        invoiceCents: invoiceByCard.get(card.id) ?? 0,
        invoiceTotalCents: invoiceByCard.get(card.id) ?? 0,
        purchaseTotalCents: invoiceByCard.get(card.id) ?? 0,
        paymentCents: paymentsByCard.get(card.id) ?? 0,
        paymentTotalCents: paymentsByCard.get(card.id) ?? 0,
        confirmedCashbackCents: confirmedCashbackByCard.get(card.id) ?? 0,
        realCashbackCents: confirmedCashbackByCard.get(card.id) ?? 0,
        estimatedCashbackCents: estimatedCashbackByCard.get(card.id) ?? 0,
        installmentCount: purchasesByCard.get(card.id)?.filter((item) => item.installmentNumber !== null).length ?? 0,
        purchases: purchasesByCard.get(card.id) ?? [],
      });
    }
    const monthlyHistory = this.buildMonthlyHistory(userId, period);
    const invoiceCents = sumValues(invoiceByCard);
    const paymentCents = sumValues(paymentsByCard);
    const confirmedCashbackCents = sumValues(confirmedCashbackByCard);
    const estimatedCashbackCents = sumValues(estimatedCashbackByCard);

    return {
      period,
      cards: Array.from(cardsById.values()).sort(sortCards),
      purchases,
      monthlyHistory,
      monthlySeries: monthlyHistory.map((item) => ({
        month: item.month,
        invoiceTotalCents: item.invoiceCents,
        estimatedCashbackCents: item.estimatedCashbackCents,
        realCashbackCents: item.confirmedCashbackCents,
      })),
      movements: this.listPaymentMovements(userId, period),
      summary: {
        invoiceCents,
        invoiceTotalCents: invoiceCents,
        purchaseCents: purchases.reduce((total, item) => total + item.amountCents, 0),
        purchaseTotalCents: purchases.reduce((total, item) => total + item.amountCents, 0),
        paymentCents,
        paymentTotalCents: paymentCents,
        confirmedCashbackCents,
        realCashbackCents: confirmedCashbackCents,
        estimatedCashbackCents,
      },
      hasPurchases: purchases.length > 0,
    };
  }

  private listActiveCards(userId: string) {
    return this.db.prepare("select id, name, issuer, status, closing_day, due_day from cards where user_id = ? and status = 'ATIVO' order by name")
      .all(userId) as CardRow[];
  }

  private listHistoricalCardsWithPeriodMovement(userId: string, period: CardsPeriod) {
    return this.db.prepare(`
      select distinct c.id, c.name, c.issuer, c.status, c.closing_day, c.due_day
      from cards c
      where c.user_id = ?
        and c.status = 'HISTORICO'
        and exists (
          select 1
          from transactions t
          left join card_installments ci
            on ci.user_id = t.user_id
           and ci.transaction_id = t.id
          left join card_purchases cp
            on cp.user_id = t.user_id
           and cp.id = ci.card_purchase_id
          where t.user_id = c.user_id
            and coalesce(cp.card_id, t.card_id) = c.id
            and coalesce(ci.statement_month, t.competence_month) >= ?
            and coalesce(ci.statement_month, t.competence_month) <= ?
            and t.nature = 'DESPESA'
            and t.subtype = 'COMPRA'
            and t.origin in ('CARTAO', 'MANUAL')
            and t.classification_status = 'CONFIRMADO'
            and t.transaction_status = 'ACTIVE'
        )
      order by c.name
    `).all(userId, period.fromMonth, period.toMonth) as CardRow[];
  }

  private listPurchases(userId: string, period: CardsPeriod): CardPurchaseLine[] {
    const installmentRows = this.db.prepare(`
      select
        t.id as transaction_id,
        cp.card_id,
        c.name as card_name,
        cp.id as purchase_id,
        t.date,
        ci.statement_month,
        t.description,
        ci.amount_cents,
        ci.installment_number,
        ci.total_installments
      from card_installments ci
      join transactions t
        on t.user_id = ci.user_id
       and t.id = ci.transaction_id
      join card_purchases cp
        on cp.user_id = ci.user_id
       and cp.id = ci.card_purchase_id
      join cards c
        on c.user_id = ci.user_id
       and c.id = cp.card_id
      where ci.user_id = ?
        and ci.statement_month >= ?
        and ci.statement_month <= ?
        and t.nature = 'DESPESA'
        and t.subtype = 'COMPRA'
        and t.origin in ('CARTAO', 'MANUAL')
        and t.classification_status = 'CONFIRMADO'
        and t.transaction_status = 'ACTIVE'
      order by ci.statement_month, t.date, t.id
    `).all(userId, period.fromMonth, period.toMonth) as PurchaseRow[];

    const fallbackRows = this.db.prepare(`
      select
        t.id as transaction_id,
        t.card_id,
        c.name as card_name,
        null as purchase_id,
        t.date,
        t.competence_month as statement_month,
        t.description,
        t.amount_cents,
        null as installment_number,
        null as total_installments
      from transactions t
      join cards c
        on c.user_id = t.user_id
       and c.id = t.card_id
      left join card_installments ci
        on ci.user_id = t.user_id
       and ci.transaction_id = t.id
      where t.user_id = ?
        and t.competence_month >= ?
        and t.competence_month <= ?
        and t.nature = 'DESPESA'
        and t.subtype = 'COMPRA'
        and t.origin in ('CARTAO', 'MANUAL')
        and t.classification_status = 'CONFIRMADO'
        and t.transaction_status = 'ACTIVE'
        and t.card_id is not null
        and ci.id is null
      order by t.competence_month, t.date, t.id
    `).all(userId, period.fromMonth, period.toMonth) as PurchaseRow[];

    return [...installmentRows, ...fallbackRows]
      .sort((a, b) => a.statement_month.localeCompare(b.statement_month) || a.date.localeCompare(b.date) || a.transaction_id.localeCompare(b.transaction_id))
      .map(mapPurchase);
  }

  private sumTransactionsByCard(userId: string, period: CardsPeriod, nature: string, subtype: string) {
    const rows = this.db.prepare(`
      select card_id, sum(amount_cents) as amount_cents
      from transactions
      where user_id = ?
        and competence_month >= ?
        and competence_month <= ?
        and nature = ?
        and subtype = ?
        and classification_status = 'CONFIRMADO'
        and transaction_status = 'ACTIVE'
        and card_id is not null
      group by card_id
    `).all(userId, period.fromMonth, period.toMonth, nature, subtype) as CardAmountRow[];

    return rowsToCardMap(rows);
  }

  private estimateCashbackByCard(userId: string, period: CardsPeriod) {
    const rows = this.db.prepare(`
      with purchase_rows as (
        select
          coalesce(cp.card_id, t.card_id) as card_id,
          coalesce(ci.statement_month, t.competence_month) as statement_month,
          coalesce(ci.amount_cents, t.amount_cents) as amount_cents,
          t.date as purchase_date
        from transactions t
        left join card_installments ci
          on ci.user_id = t.user_id
         and ci.transaction_id = t.id
        left join card_purchases cp
          on cp.user_id = t.user_id
         and cp.id = ci.card_purchase_id
        where t.user_id = ?
          and coalesce(ci.statement_month, t.competence_month) >= ?
          and coalesce(ci.statement_month, t.competence_month) <= ?
          and t.nature = 'DESPESA'
          and t.subtype = 'COMPRA'
          and t.origin in ('CARTAO', 'MANUAL')
          and t.classification_status = 'CONFIRMADO'
          and t.transaction_status = 'ACTIVE'
          and coalesce(cp.card_id, t.card_id) is not null
      )
      select p.card_id, sum(cast((p.amount_cents * coalesce((
        select cr.cashback_rate_bps
        from card_rules cr
        where cr.user_id = ?
          and cr.card_id = p.card_id
          and cr.valid_from <= p.purchase_date
          and (cr.valid_to is null or cr.valid_to >= p.purchase_date)
        order by cr.valid_from desc, cr.id desc
        limit 1
      ), 0)) / 10000 as integer)) as amount_cents
      from purchase_rows p
      group by p.card_id
    `).all(userId, period.fromMonth, period.toMonth, userId) as CardAmountRow[];

    return rowsToCardMap(rows);
  }

  private currentCashbackRatesByCard(userId: string) {
    const rows = this.db.prepare(`
      select cr.card_id, cr.cashback_rate_bps
      from card_rules cr
      join (
        select user_id, card_id, max(valid_from) as valid_from
        from card_rules
        where user_id = ?
          and valid_to is null
        group by user_id, card_id
      ) latest
        on latest.user_id = cr.user_id
       and latest.card_id = cr.card_id
       and latest.valid_from = cr.valid_from
      where cr.user_id = ?
    `).all(userId, userId) as CardRateRow[];

    const rates = new Map<string, number>();
    for (const row of rows) {
      rates.set(String(row.card_id), Number(row.cashback_rate_bps));
    }
    return rates;
  }

  private listPaymentMovements(userId: string, period: CardsPeriod): CardPaymentMovement[] {
    const rows = this.db.prepare(`
      select
        t.id as transaction_id,
        t.card_id,
        c.name as card_name,
        t.date,
        t.competence_month,
        t.description,
        t.amount_cents
      from transactions t
      join cards c
        on c.user_id = t.user_id
       and c.id = t.card_id
      where t.user_id = ?
        and t.competence_month >= ?
        and t.competence_month <= ?
        and t.nature = 'TRANSFERENCIA'
        and t.subtype = 'PAGAMENTO_FATURA'
        and t.classification_status = 'CONFIRMADO'
        and t.transaction_status = 'ACTIVE'
        and t.card_id is not null
      order by t.date, t.id
    `).all(userId, period.fromMonth, period.toMonth) as PaymentMovementRow[];

    return rows.map((row) => ({
      transactionId: String(row.transaction_id),
      cardId: String(row.card_id),
      cardName: String(row.card_name),
      date: String(row.date),
      competenceMonth: String(row.competence_month),
      description: String(row.description),
      amountCents: Number(row.amount_cents),
    }));
  }

  private buildMonthlyHistory(userId: string, period: CardsPeriod): CardMonthlyHistory[] {
    return enumerateMonths(period).map((month) => {
      const monthPeriod = { fromMonth: month, toMonth: month };
      const purchases = this.listPurchases(userId, monthPeriod);
      return {
        month,
        invoiceCents: purchases.reduce((total, item) => total + item.amountCents, 0),
        paymentCents: sumValues(this.sumTransactionsByCard(userId, monthPeriod, "TRANSFERENCIA", "PAGAMENTO_FATURA")),
        confirmedCashbackCents: sumValues(this.sumTransactionsByCard(userId, monthPeriod, "RECEITA", "CASHBACK")),
        estimatedCashbackCents: sumValues(this.estimateCashbackByCard(userId, monthPeriod)),
      };
    });
  }
}

function mapPurchase(row: PurchaseRow): CardPurchaseLine {
  return {
    transactionId: String(row.transaction_id),
    cardId: String(row.card_id),
    cardName: String(row.card_name),
    purchaseId: nullableString(row.purchase_id),
    date: String(row.date),
    statementMonth: String(row.statement_month),
    description: String(row.description),
    amountCents: Number(row.amount_cents),
    installmentNumber: nullableNumber(row.installment_number),
    totalInstallments: nullableNumber(row.total_installments),
  };
}

function sumByCard(purchases: CardPurchaseLine[]) {
  const totals = new Map<string, number>();
  for (const purchase of purchases) {
    totals.set(purchase.cardId, (totals.get(purchase.cardId) ?? 0) + purchase.amountCents);
  }
  return totals;
}

function groupPurchasesByCard(purchases: CardPurchaseLine[]) {
  const grouped = new Map<string, CardPurchaseLine[]>();
  for (const purchase of purchases) {
    const current = grouped.get(purchase.cardId) ?? [];
    current.push(purchase);
    grouped.set(purchase.cardId, current);
  }
  return grouped;
}

function rowsToCardMap(rows: CardAmountRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(String(row.card_id), Number(row.amount_cents ?? 0));
  }
  return totals;
}

function sumValues(values: Map<string, number>) {
  return Array.from(values.values()).reduce((total, value) => total + value, 0);
}

function enumerateMonths(period: CardsPeriod) {
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

function sortCards(a: CardOverviewCard, b: CardOverviewCard) {
  if (a.status !== b.status) {
    return a.status === "ATIVO" ? -1 : 1;
  }
  return a.name.localeCompare(b.name, "pt-BR");
}

function assertPeriod(period: CardsPeriod) {
  assertMonth(period.fromMonth, "period.fromMonth");
  assertMonth(period.toMonth, "period.toMonth");
  if (period.fromMonth > period.toMonth) {
    throw new Error("Periodo de cartoes invalido.");
  }
}

function assertMonth(month: string, label: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`${label} deve usar formato YYYY-MM.`);
  }
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}
