import type { DatabaseSync } from "node:sqlite";
import { requireAuthenticatedUser, type AuthenticatedUserContext } from "./auth-context.ts";
import { createId, normalizeAssetPrice, normalizeExchangeRate, normalizeInvestmentOperation, nowIso, type AssetPriceInput, type ExchangeRateInput, type InvestmentOperationInput, type NormalizedInvestmentOperation } from "./investment-domain.ts";

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
  type: "MISSING_PRICE" | "STALE_PRICE" | "MISSING_EXCHANGE_RATE" | "STALE_EXCHANGE_RATE" | "UNSUPPORTED_CURRENCY";
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
    pendingInvestedCents: number;
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

type PositionEventRow = PositionRow & {
  transaction_id: string | null;
  subtype: "APORTE" | "REINVESTIMENTO" | "AJUSTE" | null;
  amount_cents: number | null;
  event_quantity_decimal: string | null;
  competence_month: string | null;
};

export type InvestmentBases = {
  assets: {
    id: string;
    ticker: string | null;
    name: string;
    assetClass: string;
    exchange: string | null;
    market: string | null;
    currency: string;
  }[];
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
  date: string;
  competence_month: string;
  description: string;
  amount_cents: number;
  currency: string;
};

type PositionAccumulator = {
  asset_id: string;
  ticker: string | null;
  name: string;
  asset_class: string;
  exchange: string | null;
  market: string | null;
  currency: string;
  investedCents: number;
  quantity: number;
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
    const hasPendingConversion = consolidatedBrl.pendingInvestedCents > 0 || consolidatedBrl.pendingCurrentValueCents > 0 || consolidatedBrl.pendingDividendsCents > 0;

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

  listBases(context: AuthenticatedUserContext): InvestmentBases {
    const { userId } = requireAuthenticatedUser(context);
    return {
      assets: this.db.prepare(`
        select id, ticker, name, asset_class as assetClass, exchange, market, currency
        from assets
        where user_id = ?
        order by currency, asset_class, coalesce(ticker, name)
      `).all(userId) as InvestmentBases["assets"],
    };
  }

  createInvestmentOperation(context: AuthenticatedUserContext, input: InvestmentOperationInput) {
    const { userId } = requireAuthenticatedUser(context);
    const operation = normalizeInvestmentOperation(input);
    let assetId: string | null = operation.assetId;
    const transactionId = createId("tx");
    const eventId = createId("investment_event");
    const priceId = createId("asset_price");

    this.transaction(() => {
      if (operation.asset) {
        assetId = createId("asset");
        this.db.prepare(`
          insert into assets (id, user_id, ticker, name, asset_class, exchange, market, currency)
          values (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(assetId, userId, operation.asset.ticker, operation.asset.name, operation.asset.assetClass, operation.asset.exchange, operation.asset.market, operation.asset.currency);
      }

      const asset = this.getAssetForUser(userId, assetId);
      if (operation.operationType === "VENDA") {
        this.assertAvailableQuantity(userId, asset.id, operation.quantityDecimal, operation.competenceMonth);
      }
      insertInvestmentOperation(this.db, userId, transactionId, eventId, asset.id, asset.currency, operation);
      if (operation.operationType === "COMPRA") {
        insertOperationPriceSnapshot(this.db, userId, priceId, asset.id, asset.currency, operation);
      }
    });

    return {
      transactionId,
      investmentEventId: eventId,
      assetPriceId: operation.operationType === "COMPRA" ? priceId : null,
      assetId: assetId!,
    };
  }

  createAssetPrice(context: AuthenticatedUserContext, input: AssetPriceInput) {
    const { userId } = requireAuthenticatedUser(context);
    const price = normalizeAssetPrice(input);
    const asset = this.getAssetForUser(userId, price.assetId);
    if (asset.currency !== price.currency) {
      throw new Error("Moeda do preco deve ser igual a moeda do ativo.");
    }
    const id = createId("asset_price");
    const fetchedAt = nowIso();
    this.db.prepare(`
      insert into asset_prices (id, user_id, asset_id, price_decimal, currency, quoted_at, provider, fetched_at, is_stale)
      values (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, userId, asset.id, price.priceDecimal, price.currency, price.quotedAt, price.provider, fetchedAt);
    return { id, assetId: asset.id };
  }

  createExchangeRate(context: AuthenticatedUserContext, input: ExchangeRateInput) {
    const { userId } = requireAuthenticatedUser(context);
    const exchangeRate = normalizeExchangeRate(input);
    const id = createId("exchange_rate");
    const fetchedAt = nowIso();
    this.db.prepare(`
      insert into exchange_rates (id, user_id, base_currency, quote_currency, rate_decimal, reference_date, provider, fetched_at, is_stale)
      values (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(id, userId, exchangeRate.baseCurrency, exchangeRate.quoteCurrency, exchangeRate.rateDecimal, exchangeRate.referenceDate, exchangeRate.provider, fetchedAt);
    return { id };
  }

  private listPositions(userId: string, period: InvestmentPeriod) {
    const rows = this.db.prepare(`
      select
        a.id as asset_id,
        a.ticker,
        a.name,
        a.asset_class,
        a.exchange,
        a.market,
        a.currency,
        t.id as transaction_id,
        t.subtype,
        t.amount_cents,
        ie.quantity_decimal as event_quantity_decimal,
        t.competence_month
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
       and t.subtype in ('APORTE', 'REINVESTIMENTO', 'AJUSTE')
       and t.competence_month <= ?
      where a.user_id = ?
      order by a.currency, a.asset_class, coalesce(a.ticker, a.name), t.competence_month, t.date, t.id
    `).all(period.toMonth, userId) as PositionEventRow[];

    const byAsset = new Map<string, PositionAccumulator>();
    for (const row of rows) {
      const accumulator = byAsset.get(row.asset_id) ?? {
        asset_id: row.asset_id,
        ticker: row.ticker,
        name: row.name,
        asset_class: row.asset_class,
        exchange: row.exchange,
        market: row.market,
        currency: row.currency,
        investedCents: 0,
        quantity: 0,
      };

      if (row.transaction_id) {
        applyPositionEvent(accumulator, row);
      }
      byAsset.set(row.asset_id, accumulator);
    }

    return Array.from(byAsset.values())
      .filter((item) => item.investedCents > 0 || item.quantity > 0)
      .map((item) => ({
        asset_id: item.asset_id,
        ticker: item.ticker,
        name: item.name,
        asset_class: item.asset_class,
        exchange: item.exchange,
        market: item.market,
        currency: item.currency,
        invested_cents: item.investedCents,
        quantity_decimal: formatDecimal(item.quantity),
      }));
  }

  private getAssetForUser(userId: string, assetId: string | null) {
    if (!assetId) {
      throw new Error("Ativo obrigatorio.");
    }
    const asset = this.db.prepare(`
      select id, currency
      from assets
      where user_id = ?
        and id = ?
    `).get(userId, assetId) as { id: string; currency: string } | undefined;
    if (!asset) {
      throw new Error("Ativo nao pertence ao usuario autenticado.");
    }
    return asset;
  }

  private assertAvailableQuantity(userId: string, assetId: string, requestedQuantity: string, competenceMonth: string) {
    const row = this.db.prepare(`
      select coalesce(sum(cast(coalesce(ie.quantity_decimal, '0') as real)), 0) as quantity
      from investment_events ie
      join transactions t
        on t.user_id = ie.user_id
       and t.id = ie.transaction_id
       and t.classification_status = 'CONFIRMADO'
       and t.transaction_status = 'ACTIVE'
       and t.nature = 'INVESTIMENTO'
       and t.subtype in ('APORTE', 'REINVESTIMENTO', 'AJUSTE')
       and t.competence_month <= ?
      where ie.user_id = ?
        and ie.asset_id = ?
    `).get(competenceMonth, userId, assetId) as { quantity: number } | undefined;
    if (Number(row?.quantity ?? 0) + 1e-8 < Number(requestedQuantity)) {
      throw new Error("Venda maior que a quantidade disponivel.");
    }
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

  private latestPrice(userId: string, assetId: string, currency: string, period: InvestmentPeriod) {
    return this.db.prepare(`
      select asset_id, price_decimal, quoted_at, is_stale
      from asset_prices
      where user_id = ?
        and asset_id = ?
        and currency = ?
        and quoted_at <= ?
      order by quoted_at desc, fetched_at desc, id desc
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
        t.date,
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
    if (row.currency !== "BRL" && row.currency !== "USD") {
      alerts.push({ type: "UNSUPPORTED_CURRENCY", severity: "warning", message: `Moeda ${row.currency} ainda nao possui conversao para o consolidado BRL.`, currency: row.currency });
    }

    return {
      transactionId: String(row.transaction_id),
      assetId: nullableString(row.asset_id),
      ticker: nullableString(row.ticker),
      name: nullableString(row.name),
      paymentDate: String(row.payment_date ?? row.date),
      competenceMonth: String(row.competence_month),
      description: String(row.description),
      amountCents: Number(row.amount_cents),
      currency: String(row.currency),
      amountBrlCents,
    };
  }
}

function applyPositionEvent(position: PositionAccumulator, row: PositionEventRow) {
  const quantity = Number(row.event_quantity_decimal ?? 0);
  if (!Number.isFinite(quantity) || quantity === 0) {
    return;
  }

  if (row.subtype === "AJUSTE" && quantity < 0) {
    const quantitySold = Math.abs(quantity);
    const averageCostCents = position.quantity > 0 ? position.investedCents / position.quantity : 0;
    position.quantity = Math.max(0, position.quantity - quantitySold);
    position.investedCents = Math.max(0, position.investedCents - Math.round(averageCostCents * quantitySold));
    if (position.quantity <= 1e-8) {
      position.quantity = 0;
      position.investedCents = 0;
    }
    return;
  }

  if (row.subtype === "APORTE" || row.subtype === "REINVESTIMENTO") {
    position.quantity += quantity;
    position.investedCents += Number(row.amount_cents ?? 0);
  }
}

function insertInvestmentOperation(db: DatabaseSync, userId: string, transactionId: string, eventId: string, assetId: string, currency: string, operation: NormalizedInvestmentOperation) {
  const timestamp = nowIso();
  const signedQuantity = operation.operationType === "VENDA" ? `-${operation.quantityDecimal}` : operation.quantityDecimal;
  db.prepare(`
    insert into transactions (
      id, user_id, nature, subtype, origin, classification_status, transaction_status,
      asset_id, date, competence_month, description, amount_cents, currency, direction, notes, created_at, updated_at
    ) values (?, ?, 'INVESTIMENTO', ?, 'MANUAL', 'CONFIRMADO', 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    transactionId,
    userId,
    operation.subtype,
    assetId,
    operation.date,
    operation.competenceMonth,
    operation.operationType === "VENDA" ? "Venda manual de ativo" : "Compra manual de ativo",
    operation.totalAmountCents,
    currency,
    operation.operationType === "VENDA" ? "INFLOW" : "OUTFLOW",
    operation.notes,
    timestamp,
    timestamp,
  );
  db.prepare(`
    insert into investment_events (id, user_id, transaction_id, asset_id, quantity_decimal, unit_price_decimal, exchange_rate_decimal, gross_amount_cents)
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(eventId, userId, transactionId, assetId, signedQuantity, operation.unitPriceDecimal, operation.exchangeRateDecimal, operation.totalAmountCents);
}

function insertOperationPriceSnapshot(db: DatabaseSync, userId: string, priceId: string, assetId: string, currency: string, operation: NormalizedInvestmentOperation) {
  const fetchedAt = nowIso();
  db.prepare(`
    insert into asset_prices (id, user_id, asset_id, price_decimal, currency, quoted_at, provider, fetched_at, is_stale)
    values (?, ?, ?, ?, ?, ?, 'manual_operation', ?, 0)
  `).run(priceId, userId, assetId, operation.unitPriceDecimal, currency, `${operation.date}T00:00:00.000Z`, fetchedAt);
}

function mapPositionRow(row: PositionRow, price: PriceRow | undefined, exchangeRate: ExchangeRateRow | undefined, alerts: InvestmentAlert[]): InvestmentPosition {
  const quantity = Number(row.quantity_decimal ?? 0);
  const investedCents = Number(row.invested_cents ?? 0);
  const averagePriceDecimal = quantity > 0 ? formatDecimal(investedCents / 100 / quantity) : null;
  const effectivePriceDecimal = price?.price_decimal ?? averagePriceDecimal;
  const currentValueCents = effectivePriceDecimal ? Math.round(quantity * Number(effectivePriceDecimal) * 100) : null;
  const currentValueBrlCents = row.currency === "BRL" ? currentValueCents : row.currency === "USD" ? convertUsdToBrl(currentValueCents, exchangeRate) : null;

  if (!price) {
    alerts.push({ type: "MISSING_PRICE", severity: "warning", message: `Cotacao ausente para ${row.ticker ?? row.name}; usando preco medio como estimativa.`, assetId: row.asset_id, ticker: row.ticker, currency: row.currency });
  } else if (price.is_stale === 1) {
    alerts.push({ type: "STALE_PRICE", severity: "warning", message: `Preco defasado para ${row.ticker ?? row.name}.`, assetId: row.asset_id, ticker: row.ticker, currency: row.currency });
  }

  if (row.currency === "USD" && currentValueCents !== null && currentValueBrlCents === null) {
    alerts.push({ type: "MISSING_EXCHANGE_RATE", severity: "warning", message: "Ha posicoes em USD sem cotacao USD/BRL registrada.", currency: "USD" });
  }
  if (row.currency === "USD" && exchangeRate?.is_stale === 1) {
    alerts.push({ type: "STALE_EXCHANGE_RATE", severity: "warning", message: "A cotacao USD/BRL registrada esta defasada.", currency: "USD" });
  }
  if (row.currency !== "BRL" && row.currency !== "USD") {
    alerts.push({ type: "UNSUPPORTED_CURRENCY", severity: "warning", message: `Moeda ${row.currency} ainda nao possui conversao para o consolidado BRL.`, assetId: row.asset_id, ticker: row.ticker, currency: row.currency });
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
    averagePriceDecimal,
    lastPriceDecimal: effectivePriceDecimal,
    lastPriceQuotedAt: price?.quoted_at ?? null,
    lastPriceIsStale: !price || price.is_stale === 1,
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
    pendingInvestedCents: positions.filter((item) => item.currency === "USD" && item.investedCents > 0 && !canConvertUsd(exchangeRate)).reduce((total, item) => total + item.investedCents, 0),
    pendingCurrentValueCents: positions.filter((item) => item.currency === "USD" && item.currentValueCents !== null && item.currentValueBrlCents === null).reduce((total, item) => total + (item.currentValueCents ?? 0), 0),
    pendingDividendsCents: dividends.filter((item) => item.currency === "USD" && item.amountBrlCents === null).reduce((total, item) => total + item.amountCents, 0),
  };
}

function convertUsdToBrl(valueCents: number | null, exchangeRate: ExchangeRateRow | undefined) {
  if (valueCents === null) {
    return null;
  }
  if (!canConvertUsd(exchangeRate)) {
    return null;
  }
  return Math.round(valueCents * Number(exchangeRate!.rate_decimal));
}

function canConvertUsd(exchangeRate: ExchangeRateRow | undefined) {
  return Boolean(exchangeRate && Number.isFinite(Number(exchangeRate.rate_decimal)));
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
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
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
