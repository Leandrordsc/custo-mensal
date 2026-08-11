import assert from "node:assert/strict";
import test from "node:test";
import { annualCostSheets, dividendTotals, getYearSheet, monthlyTotals, sum } from "../lib/finance-data.ts";
import { resolveAssetPrice } from "../lib/price-service.ts";
import { buildStaging } from "../scripts/import-custo-mensal.mjs";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      IMAGES: {
        input: () => ({
          transform: () => ({
            output: async () => ({ response: () => new Response("not used") }),
          }),
        }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("preserva totais historicos anuais importados da planilha", () => {
  const expected = new Map([
    [2021, 38325.98],
    [2022, 58227.49],
    [2023, 61568.02],
    [2024, 60104.63],
    [2025, 77275.47],
    [2026, 48382.76],
  ]);

  for (const sheet of annualCostSheets.filter((item) => expected.has(item.year))) {
    assert.equal(Number(sum(monthlyTotals(sheet.rows)).toFixed(2)), expected.get(sheet.year));
  }
});

test("separa aportes e reservas do total operacional de custos", () => {
  const sheet2026 = getYearSheet(2026);
  const originalTotal = sum(monthlyTotals(sheet2026.rows));
  const expenseTotal = sum(monthlyTotals(sheet2026.rows, "expenses"));

  assert.equal(Number(originalTotal.toFixed(2)), 48382.76);
  assert.equal(Number(expenseTotal.toFixed(2)), 24216.76);
  assert.ok(originalTotal > expenseTotal);
});

test("calcula carteira de FIIs e dividendos sem depender da aba FisWebDriver", () => {
  const totals = dividendTotals();

  assert.equal(Number(totals.totalPaid.toFixed(2)), 3386.36);
  assert.equal(Number(totals.invested.toFixed(2)), 61572.45);
  assert.equal(Number(totals.market.toFixed(2)), 59533.20);
});

test("usa ultimo preco conhecido quando a API de cotacao falha", async () => {
  const price = await resolveAssetPrice("MXRF11", {
    async getPrice() {
      throw new Error("provider indisponivel");
    },
  });

  assert.equal(price.price, 9.69);
  assert.equal(price.stale, true);
  assert.equal(price.provider, "FisWebDriver importado");
});

test("gera staging de importacao com contrato esperado", () => {
  const staging = buildStaging();

  assert.equal(staging.monthlyExpenses.length, 288);
  assert.equal(staging.dividendPayments.length, 108);
  assert.equal(staging.importIssues.length, 4);
  assert.deepEqual(Object.keys(staging.monthlyExpenses[0]).sort(), ["amount", "classification", "month", "sourceCell", "sourceLabel", "sourceSheet", "year"].sort());
  assert.equal(staging.monthlyExpenses[0].month, 1);
  assert.equal(staging.monthlyExpenses.at(-1).month, 12);
  assert.ok(staging.dividendPayments.every((payment) => payment.ticker && payment.sourceSheet === "FIIS - Dividendos"));
});

test("server-renders a aplicacao financeira atual", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Controle de Custos/);
  assert.match(html, /Custo Mensal[\s\S]*2026/);
  assert.match(html, /Dashboard/);
  assert.match(html, /Dividendos 2026/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});
