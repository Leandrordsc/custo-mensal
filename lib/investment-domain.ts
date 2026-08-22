import { createId, nowIso, parseBrlToCents } from "./expense-domain.ts";

export type InvestmentOperationInput = {
  assetId?: string | null;
  asset?: AssetInput | null;
  operationType: "COMPRA" | "VENDA";
  subtype?: "APORTE" | "REINVESTIMENTO" | null;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  date: string;
  competenceMonth: string;
  exchangeRate?: string | null;
  notes?: string | null;
};

export type AssetInput = {
  ticker?: string | null;
  name: string;
  assetClass: string;
  exchange?: string | null;
  market?: string | null;
  currency: string;
};

export type AssetPriceInput = {
  assetId: string;
  price: string;
  currency: string;
  quotedAt: string;
  provider?: string | null;
};

export type ExchangeRateInput = {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  referenceDate: string;
  provider?: string | null;
};

export type NormalizedInvestmentOperation = {
  assetId: string | null;
  asset: NormalizedAssetInput | null;
  operationType: "COMPRA" | "VENDA";
  subtype: "APORTE" | "REINVESTIMENTO" | "AJUSTE";
  quantityDecimal: string;
  unitPriceDecimal: string;
  totalAmountCents: number;
  date: string;
  competenceMonth: string;
  exchangeRateDecimal: string | null;
  notes: string | null;
};

export type NormalizedAssetInput = {
  ticker: string | null;
  name: string;
  assetClass: string;
  exchange: string | null;
  market: string | null;
  currency: "BRL" | "USD";
};

export type NormalizedAssetPrice = {
  assetId: string;
  priceDecimal: string;
  currency: "BRL" | "USD";
  quotedAt: string;
  provider: string;
};

export type NormalizedExchangeRate = {
  baseCurrency: "USD";
  quoteCurrency: "BRL";
  rateDecimal: string;
  referenceDate: string;
  provider: string;
};

export { createId, nowIso };

export function normalizeInvestmentOperation(input: InvestmentOperationInput): NormalizedInvestmentOperation {
  const assetId = input.assetId?.trim() || null;
  const asset = input.asset ? normalizeAsset(input.asset) : null;
  if (!assetId && !asset) {
    throw new Error("Informe um ativo existente ou os dados do novo ativo.");
  }
  if (assetId && asset) {
    throw new Error("Escolha ativo existente ou novo ativo, nao ambos.");
  }
  if (input.operationType !== "COMPRA" && input.operationType !== "VENDA") {
    throw new Error("Tipo de operacao invalido.");
  }
  const subtype = input.operationType === "VENDA" ? "AJUSTE" : normalizeBuySubtype(input.subtype);
  return {
    assetId,
    asset,
    operationType: input.operationType,
    subtype,
    quantityDecimal: normalizePositiveDecimal(input.quantity, "quantidade"),
    unitPriceDecimal: normalizePositiveDecimal(input.unitPrice, "preco unitario"),
    totalAmountCents: parseMoneyToCents(input.totalAmount),
    date: requiredDate(input.date, "data"),
    competenceMonth: requiredMonth(input.competenceMonth, "competencia"),
    exchangeRateDecimal: input.exchangeRate?.trim() ? normalizePositiveDecimal(input.exchangeRate, "cambio") : null,
    notes: input.notes?.trim() || null,
  };
}

export function normalizeAsset(input: AssetInput): NormalizedAssetInput {
  return {
    ticker: input.ticker?.trim().toUpperCase() || null,
    name: requiredText(input.name, "nome do ativo"),
    assetClass: requiredText(input.assetClass, "classe do ativo").toUpperCase(),
    exchange: input.exchange?.trim().toUpperCase() || null,
    market: input.market?.trim().toUpperCase() || null,
    currency: normalizeCurrency(input.currency),
  };
}

export function normalizeAssetPrice(input: AssetPriceInput): NormalizedAssetPrice {
  return {
    assetId: requiredText(input.assetId, "ativo"),
    priceDecimal: normalizePositiveDecimal(input.price, "preco"),
    currency: normalizeCurrency(input.currency),
    quotedAt: requiredTimestamp(input.quotedAt, "data/hora da cotacao"),
    provider: input.provider?.trim() || "manual",
  };
}

export function normalizeExchangeRate(input: ExchangeRateInput): NormalizedExchangeRate {
  const baseCurrency = input.baseCurrency?.trim().toUpperCase();
  const quoteCurrency = input.quoteCurrency?.trim().toUpperCase();
  if (baseCurrency !== "USD" || quoteCurrency !== "BRL") {
    throw new Error("Nesta etapa, apenas cambio USD/BRL pode ser cadastrado.");
  }
  return {
    baseCurrency,
    quoteCurrency,
    rateDecimal: normalizePositiveDecimal(input.rate, "taxa"),
    referenceDate: requiredDate(input.referenceDate, "data de referencia"),
    provider: input.provider?.trim() || "manual",
  };
}

function normalizeBuySubtype(value: InvestmentOperationInput["subtype"]) {
  if (value === "APORTE" || value === "REINVESTIMENTO") {
    return value;
  }
  throw new Error("Compra deve ser APORTE ou REINVESTIMENTO.");
}

function normalizeCurrency(value: string): "BRL" | "USD" {
  const currency = value?.trim().toUpperCase();
  if (currency !== "BRL" && currency !== "USD") {
    throw new Error("Moeda do ativo deve ser BRL ou USD nesta etapa.");
  }
  return currency;
}

function parseMoneyToCents(value: string) {
  const text = value?.trim();
  if (!text) {
    throw new Error("valor total obrigatorio.");
  }
  let cents: number;
  if (/^R\$/i.test(text) || text.includes(",")) {
    cents = parseBrlToCents(text);
  } else {
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
      throw new Error("Valor deve usar ate duas casas decimais.");
    }
    const [units, centsText = ""] = text.split(".");
    cents = Number.parseInt(units, 10) * 100 + Number.parseInt(centsText.padEnd(2, "0"), 10);
  }
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new Error("Valor total deve ser maior que zero e seguro para centavos.");
  }
  return cents;
}

function normalizePositiveDecimal(value: string, field: string) {
  const normalized = value?.trim().replace(",", ".");
  if (!/^\d{1,18}(\.\d{1,8})?$/.test(normalized)) {
    throw new Error(`${field} deve ser decimal positivo com ate 8 casas.`);
  }
  if (Number(normalized) <= 0) {
    throw new Error(`${field} deve ser maior que zero.`);
  }
  return normalized.replace(/^0+(?=\d)/, "");
}

function requiredText(value: string | null | undefined, field: string) {
  const text = value?.trim();
  if (!text) {
    throw new Error(`${field} obrigatorio.`);
  }
  return text;
}

function requiredDate(value: string, field: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match || !isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
    throw new Error(`${field} deve usar formato YYYY-MM-DD.`);
  }
  return value;
}

function requiredMonth(value: string, field: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error(`${field} deve usar formato YYYY-MM.`);
  }
  return value;
}

function requiredTimestamp(value: string, field: string) {
  const text = value?.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(text ?? "");
  if (!text || !match || !isValidCalendarDate(Number(match[1]), Number(match[2]), Number(match[3])) || Number.isNaN(new Date(text).getTime())) {
    throw new Error(`${field} invalida.`);
  }
  return text;
}

function isValidCalendarDate(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
    return false;
  }
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}
