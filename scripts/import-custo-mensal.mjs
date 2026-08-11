import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { annualCostSheets, cardRows, cardYield, dividends, importIssues } from "../lib/finance-data.ts";

const outputDir = new URL("../_bmad-output/import-staging/", import.meta.url);

export function buildStaging() {
  const monthlyExpenses = annualCostSheets.flatMap((sheet) =>
    sheet.rows.flatMap((row) =>
      row.values.map((amount, monthIndex) => ({
        year: sheet.year,
        month: monthIndex + 1,
        sourceLabel: row.item,
        classification: row.classification,
        amount,
        sourceSheet: String(sheet.year),
        sourceCell: null,
      })),
    ),
  );

  const dividendPayments = dividends.flatMap((asset) =>
    asset.paid.map((amount, monthIndex) => ({
      ticker: asset.ticker,
      year: 2026,
      month: monthIndex + 1,
      amount,
      sourceSheet: "FIIS - Dividendos",
    })),
  );

  return {
    source: "referencias/Custo Mensal.xlsx",
    generatedAt: new Date().toISOString(),
    note: "Staging inicial derivado da analise da planilha. A proxima fase deve substituir esta semente por parser XLSX completo ou confirmar a importacao assistida.",
    monthlyExpenses,
    cardTransactions: cardRows,
    cardMonthlySummaries: cardYield,
    assets: dividends.map((asset) => ({
      ticker: asset.ticker,
      company: asset.company,
      class: asset.class,
      avg: asset.avg,
      qty: asset.qty,
      now: asset.now,
    })),
    dividendPayments,
    importIssues,
  };
}

export async function writeStaging() {
  const staging = buildStaging();
  const outputFile = new URL("custo-mensal-staging.json", outputDir);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(staging, null, 2), "utf8");

  return { outputFile, staging };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { outputFile, staging } = await writeStaging();

  console.log(`Staging gerado: ${outputFile.pathname}`);
  console.log(`Lancamentos mensais: ${staging.monthlyExpenses.length}`);
  console.log(`Dividendos: ${staging.dividendPayments.length}`);
  console.log(`Inconsistencias: ${staging.importIssues.length}`);
}
