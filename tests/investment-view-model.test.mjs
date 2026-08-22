import assert from "node:assert/strict";
import test from "node:test";
import { assertDashboardOverview, dividendTotalForPosition, emptyInvestmentOverview, totalForCurrency } from "../lib/investment-view-model.ts";

function dashboardPayload(investments = emptyInvestmentOverview()) {
  return {
    summary: {
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
    },
    monthlySeries: [],
    categories: [],
    investments,
    transactionCount: 0,
    countableTransactionCount: 0,
    hasTransactions: false,
    hasFinancialImpact: false,
  };
}

test("view model usa total zero quando moeda esperada nao vem no payload", () => {
  const overview = {
    ...emptyInvestmentOverview(),
    totalsByCurrency: {
      USD: { investedCents: 10000, currentValueCents: 12000, dividendsCents: 250 },
    },
  };

  assert.deepEqual(totalForCurrency(overview, "BRL"), { investedCents: 0, currentValueCents: 0, dividendsCents: 0 });
  assert.deepEqual(totalForCurrency(overview, "USD"), { investedCents: 10000, currentValueCents: 12000, dividendsCents: 250 });
});

test("view model rejeita dashboard sem bloco investments", () => {
  const payload = dashboardPayload();
  delete payload.investments;

  assert.throws(() => assertDashboardOverview(payload), /Payload invalido do Dashboard/);
});

test("view model soma proventos por ativo e moeda", () => {
  const overview = {
    ...emptyInvestmentOverview(),
    dividends: [
      { transactionId: "brl", assetId: "asset_1", ticker: "ABC", name: "ABC", paymentDate: "2026-08-10", competenceMonth: "2026-08", description: "BRL", currency: "BRL", amountCents: 1000, amountBrlCents: 1000 },
      { transactionId: "usd", assetId: "asset_1", ticker: "ABC", name: "ABC", paymentDate: "2026-08-11", competenceMonth: "2026-08", description: "USD", currency: "USD", amountCents: 500, amountBrlCents: 2500 },
      { transactionId: "other", assetId: "asset_2", ticker: "XYZ", name: "XYZ", paymentDate: "2026-08-12", competenceMonth: "2026-08", description: "Outro", currency: "BRL", amountCents: 700, amountBrlCents: 700 },
    ],
  };

  assert.equal(dividendTotalForPosition(overview, "asset_1", "BRL"), 1000);
  assert.equal(dividendTotalForPosition(overview, "asset_1", "USD"), 500);
});
