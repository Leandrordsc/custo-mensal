export type TransactionNature = "DESPESA" | "RECEITA" | "TRANSFERENCIA" | "INVESTIMENTO";
export type TransactionSubtype =
  | "COMPRA"
  | "APORTE"
  | "REINVESTIMENTO"
  | "PAGAMENTO_FATURA"
  | "TRANSFERENCIA_RESERVA"
  | "DIVIDENDO"
  | "CASHBACK"
  | "RENDIMENTO"
  | "AJUSTE";
export type TransactionOrigin = "CONTA" | "CARTAO" | "CAIXINHA" | "IMPORTACAO" | "MANUAL";
export type ClassificationStatus = "CONFIRMADO" | "ESTIMADO" | "PENDENTE_REVISAO" | "REJEITADO";
export type TransactionStatus = "ACTIVE" | "CANCELADO" | "ESTORNADO";

export type DashboardTransaction = {
  id: string;
  userId: string;
  nature: TransactionNature;
  subtype: TransactionSubtype;
  origin: TransactionOrigin;
  classificationStatus: ClassificationStatus;
  transactionStatus: TransactionStatus;
  competenceMonth: string;
  amountCents: number;
  categoryCountsAsLivingCost?: boolean | null;
};

export type EstimatedCashback = {
  id: string;
  userId: string;
  month: string;
  amountCents: number;
  valueType: "ESTIMADO";
  contabilizable: false;
  transactionId?: null;
};

export type DashboardPeriod = {
  fromMonth: string;
  toMonth: string;
};

export type DashboardSummary = {
  period: DashboardPeriod;
  livingCostCents: number;
  cardPurchasesCents: number;
  invoicePaymentsCents: number;
  internalTransfersCents: number;
  reserveTransfersCents: number;
  contributionsCents: number;
  reinvestmentsCents: number;
  dividendsCents: number;
  confirmedCashbackCents: number;
  estimatedCashbackCents: number;
  reserveEarningsCents: number;
  pendingReviewCents: number;
  rejectedCents: number;
  ignoredCents: number;
};

export function calculateDashboardSummary({
  period,
  transactions,
  estimatedCashbacks = [],
}: {
  period: DashboardPeriod;
  transactions: DashboardTransaction[];
  estimatedCashbacks?: EstimatedCashback[];
}): DashboardSummary {
  assertCanonicalMonth(period.fromMonth, "period.fromMonth");
  assertCanonicalMonth(period.toMonth, "period.toMonth");

  if (period.fromMonth > period.toMonth) {
    throw new Error("Periodo do Dashboard invalido: mes inicial maior que mes final.");
  }

  const summary: DashboardSummary = {
    period,
    livingCostCents: 0,
    cardPurchasesCents: 0,
    invoicePaymentsCents: 0,
    internalTransfersCents: 0,
    reserveTransfersCents: 0,
    contributionsCents: 0,
    reinvestmentsCents: 0,
    dividendsCents: 0,
    confirmedCashbackCents: 0,
    estimatedCashbackCents: 0,
    reserveEarningsCents: 0,
    pendingReviewCents: 0,
    rejectedCents: 0,
    ignoredCents: 0,
  };

  for (const transaction of transactions) {
    assertCanonicalMonth(transaction.competenceMonth, `transactions.${transaction.id}.competenceMonth`);
    assertValidCents(transaction.amountCents, `transactions.${transaction.id}.amountCents`);

    if (!isMonthInPeriod(transaction.competenceMonth, period)) {
      continue;
    }

    if (transaction.classificationStatus === "PENDENTE_REVISAO") {
      summary.pendingReviewCents += transaction.amountCents;
      continue;
    }

    if (transaction.classificationStatus === "REJEITADO") {
      summary.rejectedCents += transaction.amountCents;
      continue;
    }

    if (transaction.classificationStatus !== "CONFIRMADO" || transaction.transactionStatus !== "ACTIVE") {
      summary.ignoredCents += transaction.amountCents;
      continue;
    }

    if (transaction.nature === "DESPESA" && transaction.subtype === "COMPRA" && transaction.origin === "CARTAO") {
      summary.cardPurchasesCents += transaction.amountCents;
    }

    if (transaction.nature === "DESPESA" && transaction.categoryCountsAsLivingCost === true) {
      summary.livingCostCents += transaction.amountCents;
    }

    if (transaction.nature === "TRANSFERENCIA") {
      summary.internalTransfersCents += transaction.amountCents;

      if (transaction.subtype === "PAGAMENTO_FATURA") {
        summary.invoicePaymentsCents += transaction.amountCents;
      }

      if (transaction.subtype === "TRANSFERENCIA_RESERVA") {
        summary.reserveTransfersCents += transaction.amountCents;
      }
    }

    if (transaction.nature === "INVESTIMENTO" && transaction.subtype === "APORTE") {
      summary.contributionsCents += transaction.amountCents;
    }

    if (transaction.nature === "INVESTIMENTO" && transaction.subtype === "REINVESTIMENTO") {
      summary.reinvestmentsCents += transaction.amountCents;
    }

    if (transaction.nature === "RECEITA" && transaction.subtype === "DIVIDENDO") {
      summary.dividendsCents += transaction.amountCents;
    }

    if (transaction.nature === "RECEITA" && transaction.subtype === "CASHBACK") {
      summary.confirmedCashbackCents += transaction.amountCents;
    }

    if (transaction.nature === "RECEITA" && transaction.subtype === "RENDIMENTO") {
      summary.reserveEarningsCents += transaction.amountCents;
    }
  }

  summary.estimatedCashbackCents = estimatedCashbacks
    .filter((item) => {
      assertCanonicalMonth(item.month, `estimatedCashbacks.${item.id}.month`);
      assertValidCents(item.amountCents, `estimatedCashbacks.${item.id}.amountCents`);

      return item.valueType === "ESTIMADO" && item.contabilizable === false && !item.transactionId;
    })
    .filter((item) => isMonthInPeriod(item.month, period))
    .reduce((total, item) => total + item.amountCents, 0);

  return summary;
}

export function isMonthInPeriod(month: string, period: DashboardPeriod) {
  assertCanonicalMonth(month, "month");
  assertCanonicalMonth(period.fromMonth, "period.fromMonth");
  assertCanonicalMonth(period.toMonth, "period.toMonth");

  return month >= period.fromMonth && month <= period.toMonth;
}

export function assertCanonicalMonth(month: string, fieldName: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`${fieldName} deve usar formato YYYY-MM.`);
  }
}

function assertValidCents(value: number, fieldName: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} deve ser um inteiro seguro em centavos maior ou igual a zero.`);
  }
}
