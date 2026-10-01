import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  assert.equal(staging.mode, "xlsx");
  assert.equal(staging.parserVersion, "xlsx-detail-v1");
  assert.match(staging.fileHash, /^[a-f0-9]{64}$/);
  assert.ok(staging.monthlyExpenses.length > 288);
  assert.equal(staging.dividendPayments.length, 108);
  assert.ok(staging.importIssues.length >= 4);
  assert.ok(staging.importIssues.some((issue) => /#REF!|#DIV\/0!|Formula|formula/i.test(issue.message)));
  assert.deepEqual(staging.reconciliations.map((item) => item.year), [2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.ok(staging.reconciliations.some((item) => item.differenceCents !== 0));
  assert.ok(staging.reconciliations.every((item) => Number.isInteger(item.parsedCents) && (item.differenceCents === null || Number.isInteger(item.differenceCents))));
  assert.deepEqual(
    Object.keys(staging.monthlyExpenses[0]).sort(),
    ["amount", "amountCents", "classification", "classificationStatus", "confidence", "issue", "logicalFingerprint", "month", "rawRowHash", "rawValue", "sourceCell", "sourceLabel", "sourceSheet", "status", "suggestedNature", "suggestedOrigin", "suggestedSubtype", "year"].sort(),
  );
  assert.equal(staging.monthlyExpenses[0].month, 1);
  assert.ok(staging.monthlyExpenses.every((row) => Number.isInteger(row.year) && row.year >= 2020 && row.year <= 2026));
  assert.ok(staging.monthlyExpenses.every((row) => Number.isInteger(row.month) && row.month >= 1 && row.month <= 12));
  assert.ok(staging.monthlyExpenses.every((row) => Number.isInteger(row.amountCents) && row.amountCents > 0));
  assert.ok(staging.monthlyExpenses.every((row) => row.sourceSheet && row.sourceCell && row.rawRowHash && row.logicalFingerprint));
  assert.ok(staging.monthlyExpenses.every((row) => ["CONFIRMADO", "PENDENTE_REVISAO", "REJEITADO"].includes(row.classificationStatus)));
  assert.ok(staging.monthlyExpenses.every((row) => ["ACEITO", "PENDENTE", "REJEITADO"].includes(row.status)));
  for (const year of [2021, 2022, 2023, 2024, 2025]) {
    assert.ok(staging.monthlyExpenses.some((row) => row.year === year && row.sourceLabel !== `Total original ${year}` && row.sourceCell && row.rawRowHash && row.logicalFingerprint));
  }
  assert.ok(staging.monthlyExpenses.some((row) => row.classificationStatus === "PENDENTE_REVISAO" && row.status === "PENDENTE"));
  assert.ok(staging.dividendPayments.every((payment) => payment.ticker && payment.sourceSheet === "FIIS - Dividendos"));

  const repeated = buildStaging();
  assert.equal(repeated.fileHash, staging.fileHash);
  assert.equal(repeated.monthlyExpenses[0].rawRowHash, staging.monthlyExpenses[0].rawRowHash);
  assert.equal(repeated.monthlyExpenses[0].logicalFingerprint, staging.monthlyExpenses[0].logicalFingerprint);
});

test("fallback de staging explicita ausencia da planilha real", () => {
  const staging = buildStaging({ sourcePath: "referencias/arquivo-inexistente.xlsx" });

  assert.equal(staging.mode, "fallback");
  assert.equal(staging.fileHash, null);
  assert.equal(staging.monthlyExpenses.length, 288);
  assert.match(staging.importIssues[0].message, /Planilha nao encontrada/);
  assert.ok(staging.monthlyExpenses.some((row) => row.sourceCell === null));
  assert.throws(() => buildStaging({ sourcePath: "referencias/arquivo-inexistente.xlsx", allowFallback: false }), /Planilha nao encontrada/);
});

test("server-renders a aplicacao financeira atual", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Controle de Custos/);
  assert.match(html, /Controle financeiro pessoal/);
  assert.match(html, /Dashboard/);
  assert.match(html, /Ativos e Proventos/);
  assert.match(html, /Navegacao principal/);
  assert.match(html, /Resumo do ano/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("codigo renderizado contem controles de cadastro manual de ativos", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /Acoes de ativos/);
  assert.match(source, /asset-columns/);
  assert.match(source, /warning-banner/);
  assert.match(source, /Incluir primeiro ativo/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /asset-operation-panel/);
  assert.doesNotMatch(source, /Abas de Ativos e Proventos/);
  assert.doesNotMatch(source, /role="tablist"/);
  assert.doesNotMatch(source, /aria-selected/);
  assert.match(source, /Carteira/);
  assert.match(source, /Proventos/);
  assert.match(source, /Compra \/ Venda/);
  assert.match(source, /Tipo de ativo/);
  assert.match(source, /Selecionar o ativo/);
  assert.match(source, /Outros custos/);
  assert.match(source, /localDateParts/);
  assert.match(source, /type="month" value=\{operationForm\.competenceMonth\}/);
  assert.doesNotMatch(source, /date: `\\$\\{year\\}-01-01`/);
  assert.doesNotMatch(source, /Cambio usado/);
  assert.match(source, /submit-row/);
  assert.match(source, /Cadastrar operacao/);
  assert.match(source, /Salvar preco manual/);
  assert.match(source, /Salvar cambio USD\/BRL/);
  assert.match(source, /Operacao registrada com sucesso/);
  assert.match(source, /Nenhum provento registrado/);
  assert.match(source, /Historico/);
});

test("codigo da interface compartilha busca e ano entre as areas conectadas", () => {
  const source = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(source, /const navigateTo = \(item: string\)/);
  assert.match(source, /setSearch\(""\)/);
  assert.match(source, /<CostsView year=\{year\} search=\{search\}/);
  assert.match(source, /<CardsViewConnected year=\{year\} search=\{search\}/);
  assert.match(source, /<InvestmentsConnectedView year=\{year\} search=\{search\}/);
  assert.doesNotMatch(source, /aria-label="Ano de Cartoes"/);
  assert.match(source, /aria-label="Periodo de Ativos"/);
  assert.match(source, /requestId !== requestIdRef\.current/);
  assert.match(source, /warning-banner" role="status"/);
  assert.match(source, /month === "all" \? "Resumo do ano" : "Resumo do mes"/);
});
