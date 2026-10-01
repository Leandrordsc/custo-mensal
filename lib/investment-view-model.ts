export type DashboardOverview = {
  summary: {
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
  monthlySeries: { month: string; livingCostCents: number; cardPurchasesCents: number; pendingReviewCents: number }[];
  categories: { category: string; amountCents: number }[];
  investments: InvestmentOverview;
  transactionCount: number;
  countableTransactionCount: number;
  hasTransactions: boolean;
  hasFinancialImpact: boolean;
};

export type InvestmentOverview = {
  period: { fromMonth: string; toMonth: string };
  positions: {
    assetId: string;
    ticker: string | null;
    name: string;
    assetClass: string;
    exchange: string | null;
    market: string | null;
    currency: string;
    quantityDecimal: string;
    averagePriceDecimal: string | null;
    lastPriceDecimal: string | null;
    lastPriceQuotedAt: string | null;
    lastPriceIsStale: boolean;
    investedCents: number;
    currentValueCents: number | null;
    currentValueBrlCents: number | null;
  }[];
  dividends: {
    transactionId: string;
    assetId: string | null;
    ticker: string | null;
    name: string | null;
    paymentDate: string;
    competenceMonth: string;
    description: string;
    currency: string;
    amountCents: number;
    amountBrlCents: number | null;
  }[];
  totalsByCurrency: Record<string, { investedCents: number; currentValueCents: number; dividendsCents: number }>;
  consolidatedBrl: {
    investedCents: number;
    currentValueCents: number;
    dividendsCents: number;
    pendingInvestedCents: number;
    pendingCurrentValueCents: number;
    pendingDividendsCents: number;
  };
  exchangeRate: { rateDecimal: string | null; referenceDate: string | null; provider: string | null; isStale: boolean };
  alerts: { type: string; message: string; ticker?: string | null; currency?: string }[];
  hasAssets: boolean;
  hasPendingConversion: boolean;
};

export function emptyInvestmentOverview(): InvestmentOverview {
  return {
    period: { fromMonth: "2026-01", toMonth: "2026-12" },
    positions: [],
    dividends: [],
    totalsByCurrency: {
      BRL: { investedCents: 0, currentValueCents: 0, dividendsCents: 0 },
      USD: { investedCents: 0, currentValueCents: 0, dividendsCents: 0 },
    },
    consolidatedBrl: { investedCents: 0, currentValueCents: 0, dividendsCents: 0, pendingInvestedCents: 0, pendingCurrentValueCents: 0, pendingDividendsCents: 0 },
    exchangeRate: { rateDecimal: null, referenceDate: null, provider: null, isStale: false },
    alerts: [],
    hasAssets: false,
    hasPendingConversion: false,
  };
}

export function assertDashboardOverview(value: unknown): DashboardOverview {
  if (!value || typeof value !== "object") {
    throw new Error("Payload invalido do Dashboard.");
  }
  const candidate = value as Partial<DashboardOverview>;
  if (
    !candidate.summary
    || !Array.isArray(candidate.monthlySeries)
    || !Array.isArray(candidate.categories)
    || typeof candidate.transactionCount !== "number"
    || typeof candidate.countableTransactionCount !== "number"
    || typeof candidate.hasTransactions !== "boolean"
    || typeof candidate.hasFinancialImpact !== "boolean"
    || !candidate.investments
  ) {
    throw new Error("Payload invalido do Dashboard.");
  }
  return { ...candidate, investments: assertInvestmentOverview(candidate.investments) } as DashboardOverview;
}

export function assertInvestmentOverview(value: unknown): InvestmentOverview {
  if (!value || typeof value !== "object") {
    throw new Error("Payload invalido de Ativos.");
  }
  const candidate = value as Partial<InvestmentOverview>;
  if (
    !candidate.totalsByCurrency
    || !candidate.consolidatedBrl
    || typeof candidate.consolidatedBrl.investedCents !== "number"
    || typeof candidate.consolidatedBrl.currentValueCents !== "number"
    || typeof candidate.consolidatedBrl.dividendsCents !== "number"
    || typeof candidate.consolidatedBrl.pendingInvestedCents !== "number"
    || typeof candidate.consolidatedBrl.pendingCurrentValueCents !== "number"
    || typeof candidate.consolidatedBrl.pendingDividendsCents !== "number"
    || !candidate.exchangeRate
    || !Array.isArray(candidate.positions)
    || !Array.isArray(candidate.dividends)
    || !Array.isArray(candidate.alerts)
  ) {
    throw new Error("Payload invalido de Ativos.");
  }
  return candidate as InvestmentOverview;
}

export function totalForCurrency(overview: InvestmentOverview, currency: string) {
  return overview.totalsByCurrency[currency] ?? { investedCents: 0, currentValueCents: 0, dividendsCents: 0 };
}

export function dividendTotalForPosition(overview: InvestmentOverview, assetId: string, currency: string) {
  return overview.dividends
    .filter((dividend) => dividend.assetId === assetId && dividend.currency === currency)
    .reduce((total, dividend) => total + dividend.amountCents, 0);
}
