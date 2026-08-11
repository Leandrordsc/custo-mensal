import { dividends } from "./finance-data.ts";

export type AssetPrice = {
  ticker: string;
  price: number;
  currency: "BRL";
  provider: string;
  capturedAt: string;
  stale: boolean;
};

export type PriceProvider = {
  getPrice(ticker: string): Promise<number>;
};

const capturedAt = "2026-06-19T16:03:00-03:00";

export const lastKnownPrices: AssetPrice[] = dividends.map((asset) => ({
  ticker: asset.ticker,
  price: asset.now,
  currency: "BRL",
  provider: "FisWebDriver importado",
  capturedAt,
  stale: true,
}));

export async function resolveAssetPrice(ticker: string, provider?: PriceProvider): Promise<AssetPrice> {
  const fallback = lastKnownPrices.find((price) => price.ticker === ticker);

  if (!provider) {
    if (!fallback) {
      throw new Error(`Preco nao encontrado para ${ticker}`);
    }
    return fallback;
  }

  try {
    const price = await provider.getPrice(ticker);
    return {
      ticker,
      price,
      currency: "BRL",
      provider: "provider-api",
      capturedAt: new Date().toISOString(),
      stale: false,
    };
  } catch {
    if (!fallback) {
      throw new Error(`Preco nao encontrado para ${ticker}`);
    }
    return fallback;
  }
}
