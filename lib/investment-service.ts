import type { DatabaseSync } from "node:sqlite";
import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";

export type InvestmentPeriod = {
  fromMonth: string;
  toMonth: string;
};

export type CurrencyTotals = {
  investedCents: number;
  currentValueCents: number;
  dividendsCents: number;
};

export type InvestmentAlert = {
  type: "MISSING_PRICE" | "STALE_PRICE" | "MISSING_EXCHANGE_RATE" | "STALE_EXCHANGE_RATE";
  severity: "warning";
  message: string;
  assetId?: string;
  ticker?: string | null;
  currency?: string;
};

export type InvestmentPosition = {
  assetId: string;
  ticker: string | null;
  name: string;
  assetClass: string;
  exchange: string | null;
  market: string | null;
  currency: string;
  quantityDecimal: string;
  investedCents: number;
  averagePriceDecimal: string | null;
  lastPriceDecimal: string | null;
  lastPriceQuotedAt: string | null;
  lastPriceIsStale: boolean;
  currentValueCents: number | null;
  currentValueBrlCents: number | null;
};

export type DividendLine = {
  transactionId: string;
  assetId: string | null;
  ticker: string | null;
  name: string | null;
  paymentDate: string;
  competenceMonth: string;
  description: string;
  amountCents: number;
  currency: string;
  amountBrlCents: number | null;
};

export type InvestmentOverview = {
  period: InvestmentPeriod;
  positions: InvestmentPosition[];
  dividends: DividendLine[];
  totalsByCurrency: Record<string, CurrencyTotals>;
  consolidatedBrl: {
    investedCents: number;
    currentValueCents: number;
    dividendsCents: number;
    pendingCurrentValueCents: number;
    pendingDividendsCents: number;
  };
  exchangeRate: {
    baseCurrency: "USD";
    quoteCurrency: "BRL";
    rateDecimal: string | null;
    referenceDate: string | null;
    provider: string | null;
    isStale: boolean;
  };
  alerts: InvestmentAlert[];
  hasAssets: boolean;
  hasPendingConversion: boolean;
};

type PositionRow = {
  asset_id: string;
  ticker: string | null;
  name: string;
  asset_class: string;
  exchange: string | null;
  market: string | null;
  currency: string;
  invested_cents: number | null;
  quantity_decimal: string | null;
};

type PriceRow = {
  asset_id: string;
  price_decimal: string;
  quoted_at: string;
  is_stale: 0 | 1;
};

type ExchangeRateRow = {
  rate_decimal: string;
  reference_date: string;
  provider: string;
  is_stale: 0 | 1;
};

type DividendRow = {
  transaction_id: string;
  asset_id: string | null;
  ticker: string | null;
  name: string | null;
  payment_date: string | null;
  competence_month: string;
  description: string;
  amount_cents: number;
  currency: string;
};

export class InvestmentService {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  getOverview(context: AuthenticatedUserContext, period: InvestmentPeriod): InvestmentOverview {
    const { userId } = requireAuthenticatedUser(context);
    assertPeriod(period);

    const exchangeRate = this.latestExchangeRate(userId, period);
    const alerts: InvestmentAlert[] = [];
    const positions = this.listPositions(userId, period).map((row) => this.mapPosition(userId, row, period, exchangeRate, alerts));
    const dividends = this.listDividends(userId, period).map((row) => this.mapDividend(row, exchangeRate, alerts));
    const totalsByCurrency = buildCurrencyTotals(positions, dividends);
    const consolidatedBrl = buildConsolidatedBrl(positions, dividends, exchangeRate);
    const hasPendingConversion = consolidatedBrl.pendingCurrentValueCents > 0 || consolidatedBrl.pendingDividendsCents > 0;

    return {
      period,
      positions,
      dividends,
      totalsByCurrency,
      consolidatedBrl,
      exchangeRate: {
        baseCurrency: "USD",
        quoteCurrency: "BRL",
        rateDecimal: exchangeRate?.rate_decimal ?? null,
        referenceDate: exchangeRate?.reference_date ?? null,
        provider: exchangeRate?.provider ?? null,
        isStale: exchangeRate?.is_stale === 1,
      },
      alerts: dedupeAlerts(alerts),
      hasAssets: positions.length > 0,
      hasPendingConversion,
    };
  }

  private listPositions(userId: string, period: InvestmentPeriod) {
    return this.db.prepare(`
      select
        a.id as asset_id,
        a.ticker,
        a.name,
        a.asset_class,
        a.exchange,
        a.market,
        a.currency,
        coalesce(sum(case when t.id is not null then t.amount_cents else 0 end), 0) as invested_cents,
        coalesce(sum(case when t.id is not null then cast(coalesce(ie.quantity_decimal, '0') as real) else 0 end), 0) as quantity_decimal
      from assets a
      left join investment_events ie
        on ie.user_id = a.user_id
       and ie.asset_id = a.id
      left join transactions t
        on t.user_id = ie.user_id
       and t.id = ie.transaction_id
       and t.classification_status = 'CONFIRMADO'
       and t.transaction_status = 'ACTIVE'
       and t.nature = 'INVESTIMENTO'
       and t.subtype in ('APORTE', 'REINVESTIMENTO')
       and t.competence_month <= ?
      where a.user_id = ?
      group by a.id, a.ticker, a.name, a.asset_class, a.exchange, a.market, a.currency
      order by a.currency, a.asset_class, coalesce(a.ticker, a.name)
    `).all(period.toMonth, userId) as PositionRow[];
  }

  private latestPrice(userId: string, assetId: string, currency: string, period: InvestmentPeriod) {
    return this.db.prepare(`
      select asset_id, price_decimal, quoted_at, is_stale
      from asset_prices
      where user_id = ?
        and asset_id = ?
        and currency = ?
        and quoted_at <= ?
      order by fetched_at desc, quoted_at desc, id desc
      limit 1
    `).get(userId, assetId, currency, maxTimestampForMonth(period.toMonth)) as PriceRow | undefined;
  }

  private latestExchangeRate(userId: string, period: InvestmentPeriod) {
    return this.db.prepare(`
      select rate_decimal, reference_date, provider, is_stale
      from exchange_rates
      where user_id = ?
        and base_currency = 'USD'
        and quote_currency = 'BRL'
        and reference_date <= ?
      order by reference_date desc, fetched_at desc, id desc
      limit 1
    `).get(userId, maxDateForMonth(period.toMonth)) as ExchangeRateRow | undefined;
  }

  private listDividends(userId: string, period: InvestmentPeriod) {
    return this.db.prepare(`
      select
        t.id as transaction_id,
        coalesce(de.asset_id, t.asset_id) as asset_id,
        a.ticker,
        a.name,
        de.payment_date,
        t.competence_month,
        t.description,
        t.amount_cents,
        t.currency
      from transactions t
      left join dividend_events de
        on de.user_id = t.user_id
       and de.transaction_id = t.id
      left join assets a
        on a.user_id = t.user_id
       and a.id = coalesce(de.asset_id, t.asset_id)
      where t.user_id = ?
        and t.competence_month >= ?
        and t.competence_month <= ?
        and t.nature = 'RECEITA'
        and t.subtype = 'DIVIDENDO'
        and t.classification_status = 'CONFIRMADO'
        and t.transaction_status = 'ACTIVE'
      order by t.competence_month, coalesce(de.payment_date, t.date), t.id
    `).all(userId, period.fromMonth, period.toMonth) as DividendRow[];
  }

  private mapPosition(userId: string, row: PositionRow, period: InvestmentPeriod, exchangeRate: ExchangeRateRow | undefined, alerts: InvestmentAlert[]): InvestmentPosition {
    return mapPositionRow(row, this.latestPrice(userId, row.asset_id, row.currency, period), exchangeRate, alerts);
  }

  private mapDividend(row: DividendRow, exchangeRate: ExchangeRateRow | undefined, alerts: InvestmentAlert[]): DividendLine {
    const amountBrlCents = row.currency === "BRL" ? Number(row.amount_cents) : row.currency === "USD" ? convertUsdToBrl(Number(row.amount_cents), exchangeRate) : null;
    if (row.currency === "USD" && amountBrlCents === null) {
      alerts.push({ type: "MISSING_EXCHANGE_RATE", severity: "warning", message: "Ha proventos em USD sem cotacao USD/BRL registrada.", currency: "USD" });
    }
    if (row.currency === "USD" && exchangeRate?.is_stale === 1) {
      alerts.push({ type: "STALE_EXCHANGE_RATE", severity: "warning", message: "A cotacao USD/BRL registrada esta defasada.", currency: "USD" });
    }

    return {
      transactionId: String(row.transaction_id),
      assetId: nullableString(row.asset_id),
      ticker: nullableString(row.ticker),
      name: nullableString(row.name),
      paymentDate: String(row.payment_date ?? row.competence_month),
      competenceMonth: String(row.competence_month),
      description: String(row.description),
      amountCents: Number(row.amount_cents),
      currency: String(row.currency),
      amountBrlCents,
    };
  }
}

function mapPositionRow(row: PositionRow, price: PriceRow | undefined, exchangeRate: ExchangeRateRow | undefined, alerts: InvestmentAlert[]): InvestmentPosition {
  const quantity = Number(row.quantity_decimal ?? 0);
  const investedCents = Number(row.invested_cents ?? 0);
  const currentValueCents = price ? Math.round(quantity * Number(price.price_decimal) * 100) : null;
  const currentValueBrlCents = row.currency === "BRL" ? currentValueCents : row.currency === "USD" ? convertUsdToBrl(currentValueCents, exchangeRate) : null;

  if (!price) {
    alerts.push({ type: "MISSING_PRICE", severity: "warning", message: `Preco ausente para ${row.ticker ?? row.name}.`, assetId: row.asset_id, ticker: row.ticker, currency: row.currency });
  } else if (price.is_stale === 1) {
    alerts.push({ type: "STALE_PRICE", severity: "warning", message: `Preco defasado para ${row.ticker ?? row.name}.`, assetId: row.asset_id, ticker: row.ticker, currency: row.currency });
  }

  if (row.currency === "USD" && currentValueCents !== null && currentValueBrlCents === null) {
    alerts.push({ type: "MISSING_EXCHANGE_RATE", severity: "warning", message: "Ha posicoes em USD sem cotacao USD/BRL registrada.", currency: "USD" });
  }
  if (row.currency === "USD" && exchangeRate?.is_stale === 1) {
    alerts.push({ type: "STALE_EXCHANGE_RATE", severity: "warning", message: "A cotacao USD/BRL registrada esta defasada.", currency: "USD" });
  }

  return {
    assetId: String(row.asset_id),
    ticker: nullableString(row.ticker),
    name: String(row.name),
    assetClass: String(row.asset_class),
    exchange: nullableString(row.exchange),
    market: nullableString(row.market),
    currency: String(row.currency),
    quantityDecimal: formatDecimal(quantity),
    investedCents,
    averagePriceDecimal: quantity > 0 ? formatDecimal(investedCents / 100 / quantity) : null,
    lastPriceDecimal: price?.price_decimal ?? null,
    lastPriceQuotedAt: price?.quoted_at ?? null,
    lastPriceIsStale: price?.is_stale === 1,
    currentValueCents,
    currentValueBrlCents,
  };
}

function buildCurrencyTotals(positions: InvestmentPosition[], dividends: DividendLine[]) {
  const totals: Record<string, CurrencyTotals> = {
    BRL: { investedCents: 0, currentValueCents: 0, dividendsCents: 0 },
    USD: { investedCents: 0, currentValueCents: 0, dividendsCents: 0 },
  };

  for (const position of positions) {
    totals[position.currency] ??= { investedCents: 0, currentValueCents: 0, dividendsCents: 0 };
    totals[position.currency].investedCents += position.investedCents;
    totals[position.currency].currentValueCents += position.currentValueCents ?? 0;
  }
  for (const dividend of dividends) {
    totals[dividend.currency] ??= { investedCents: 0, currentValueCents: 0, dividendsCents: 0 };
    totals[dividend.currency].dividendsCents += dividend.amountCents;
  }

  return totals;
}

function buildConsolidatedBrl(positions: InvestmentPosition[], dividends: DividendLine[], exchangeRate: ExchangeRateRow | undefined) {
  return {
    investedCents: positions.reduce((total, item) => {
      if (item.currency === "BRL") {
        return total + item.investedCents;
      }
      if (item.currency === "USD") {
        return total + (convertUsdToBrl(item.investedCents, exchangeRate) ?? 0);
      }
      return total;
    }, 0),
    currentValueCents: positions.reduce((total, item) => total + (item.currentValueBrlCents ?? 0), 0),
    dividendsCents: dividends.reduce((total, item) => total + (item.amountBrlCents ?? 0), 0),
    pendingCurrentValueCents: positions.filter((item) => item.currency !== "BRL" && item.currentValueCents !== null && item.currentValueBrlCents === null).reduce((total, item) => total + (item.currentValueCents ?? 0), 0),
    pendingDividendsCents: dividends.filter((item) => item.currency !== "BRL" && item.amountBrlCents === null).reduce((total, item) => total + item.amountCents, 0),
  };
}

function convertUsdToBrl(valueCents: number | null, exchangeRate: ExchangeRateRow | undefined) {
  if (valueCents === null) {
    return null;
  }
  if (!exchangeRate) {
    return null;
  }
  return Math.round(valueCents * Number(exchangeRate.rate_decimal));
}

function dedupeAlerts(alerts: InvestmentAlert[]) {
  const seen = new Set<string>();
  return alerts.filter((alert) => {
    const key = `${alert.type}:${alert.assetId ?? ""}:${alert.currency ?? ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function assertPeriod(period: InvestmentPeriod) {
  assertMonth(period.fromMonth, "period.fromMonth");
  assertMonth(period.toMonth, "period.toMonth");
  if (period.fromMonth > period.toMonth) {
    throw new Error("Periodo de investimentos invalido.");
  }
}

function assertMonth(month: string, label: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error(`${label} deve usar formato YYYY-MM.`);
  }
}

function maxDateForMonth(month: string) {
  return `${month}-31`;
}

function maxTimestampForMonth(month: string) {
  return `${maxDateForMonth(month)}T23:59:59.999Z`;
}

function nullableString(value: unknown) {
  return value === null || value === undefined ? null : String(value);
}

function formatDecimal(value: number) {
  return Number.isFinite(value) ? value.toFixed(8).replace(/\.?0+$/, "") : "0";
}
