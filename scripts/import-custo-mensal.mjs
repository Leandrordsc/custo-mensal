import { createHash } from "node:crypto";
import { existsSync, statSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { annualCostSheets, cardRows, cardYield, dividends, importIssues } from "../lib/finance-data.ts";

const outputDir = new URL("../_bmad-output/import-staging/", import.meta.url);
const defaultWorkbook = new URL("../referencias/Custo Mensal.xlsx", import.meta.url);
const parserVersion = "xlsx-detail-v1";
const yearSheets = new Set(["2020", "2021", "2022", "2023", "2024", "2025", "2026"]);
const monthLabels = new Map([
  ["jan", 1],
  ["janeiro", 1],
  ["fev", 2],
  ["fevereiro", 2],
  ["mar", 3],
  ["marco", 3],
  ["março", 3],
  ["abr", 4],
  ["abril", 4],
  ["mai", 5],
  ["maio", 5],
  ["jun", 6],
  ["junho", 6],
  ["jul", 7],
  ["julho", 7],
  ["ago", 8],
  ["agosto", 8],
  ["set", 9],
  ["setembro", 9],
  ["out", 10],
  ["outubro", 10],
  ["nov", 11],
  ["novembro", 11],
  ["dez", 12],
  ["dezembro", 12],
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeXml(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function columnIndex(cellRef) {
  const letters = /^[A-Z]+/.exec(cellRef)?.[0] ?? "";
  return [...letters].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
}

function rowIndex(cellRef) {
  return Number(/\d+/.exec(cellRef)?.[0] ?? 0);
}

function centsFromNumber(value) {
  return Math.round(Number(value) * 100);
}

function classifyLabel(label) {
  const normalized = normalizeText(label);
  if (!normalized) return { classification: "review", nature: null, subtype: null, origin: null, confidence: 0, status: "PENDENTE", classificationStatus: "PENDENTE_REVISAO", issue: "Rotulo vazio." };
  if (/(total|soma|media|m[eé]dia|saldo|meta|subtotal)/i.test(normalized)) {
    return { classification: "aggregate", nature: null, subtype: null, origin: null, confidence: 100, status: "REJEITADO", classificationStatus: "REJEITADO", issue: "Linha de total/conciliacao, nao importada como lancamento." };
  }
  if (/(fii|fiis|acoes|a[cç]oes|renda fixa|tesouro|invest)/i.test(normalized)) {
    return { classification: "investment_transfer", nature: "INVESTIMENTO", subtype: "APORTE", origin: "IMPORTACAO", confidence: 80, status: "ACEITO", classificationStatus: "CONFIRMADO", issue: null };
  }
  if (/(reserva|caixinha|poupanca|poupan[cç]a)/i.test(normalized)) {
    return { classification: "reserve", nature: "TRANSFERENCIA", subtype: "TRANSFERENCIA_RESERVA", origin: "IMPORTACAO", confidence: 75, status: "PENDENTE", classificationStatus: "PENDENTE_REVISAO", issue: "Transferencia/reserva exige revisao de conta origem/destino." };
  }
  if (/cartao|cart[aã]o|fatura|itau|ita[uú]|nubank|mercado pago|btg/i.test(normalized)) {
    return { classification: "card_payment", nature: "TRANSFERENCIA", subtype: "PAGAMENTO_FATURA", origin: "IMPORTACAO", confidence: 70, status: "PENDENTE", classificationStatus: "PENDENTE_REVISAO", issue: "Linha de cartao pode representar fatura ou compra agregada." };
  }
  return { classification: "expense", nature: "DESPESA", subtype: "COMPRA", origin: "IMPORTACAO", confidence: 85, status: "ACEITO", classificationStatus: "CONFIRMADO", issue: null };
}

function readZipEntries(buffer) {
  let eocdOffset = -1;
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Arquivo XLSX invalido: diretorio ZIP nao encontrado.");

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let pointer = buffer.readUInt32LE(eocdOffset + 16);
  const entries = new Map();
  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(pointer) !== 0x02014b50) throw new Error("Arquivo XLSX invalido: entrada ZIP corrompida.");
    const method = buffer.readUInt16LE(pointer + 10);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const extraLength = buffer.readUInt16LE(pointer + 30);
    const commentLength = buffer.readUInt16LE(pointer + 32);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.subarray(pointer + 46, pointer + 46 + nameLength).toString("utf8");
    entries.set(name, { method, compressedSize, localOffset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipText(buffer, entries, name) {
  const entry = entries.get(name);
  if (!entry) return "";
  if (entry.method !== 0 && entry.method !== 8) throw new Error(`Entrada XLSX com compressao nao suportada: ${name}`);
  const header = entry.localOffset;
  const nameLength = buffer.readUInt16LE(header + 26);
  const extraLength = buffer.readUInt16LE(header + 28);
  const dataStart = header + 30 + nameLength + extraLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  const data = entry.method === 8 ? inflateRawSync(compressed) : compressed;
  return data.toString("utf8");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si[\s\S]*?<\/si>/g)].map(([item]) => {
    const parts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
    return parts.join("");
  });
}

function parseWorkbook(buffer) {
  const entries = readZipEntries(buffer);
  const workbookXml = readZipText(buffer, entries, "xl/workbook.xml");
  const relsXml = readZipText(buffer, entries, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(readZipText(buffer, entries, "xl/sharedStrings.xml"));
  const rels = new Map([...relsXml.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map((match) => [match[1], match[2]]));

  const sheets = [...workbookXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*sheetId="([^"]+)"[^>]*r:id="([^"]+)"/g)].map((match) => {
    const target = decodeXml(rels.get(match[3]) ?? `worksheets/sheet${match[2]}.xml`).replace(/\\/g, "/");
    const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`;
    return { name: decodeXml(match[1]), sheetId: match[2], path };
  });

  return { buffer, entries, sharedStrings, sheets };
}

function parseSheetCells(workbook, sheet) {
  const xml = readZipText(workbook.buffer, workbook.entries, sheet.path);
  const cells = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    for (const cellMatch of rowMatch[2].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = /r="([^"]+)"/.exec(attrs)?.[1];
      if (!ref) continue;
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const valueXml = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      const inline = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1];
      const formula = /<f[^>]*>([\s\S]*?)<\/f>/.exec(body)?.[1];
      const rawValue = valueXml == null ? "" : decodeXml(valueXml);
      let value = rawValue;
      if (type === "s") value = workbook.sharedStrings[Number(rawValue)] ?? "";
      if (type === "inlineStr") value = decodeXml(inline ?? "");
      cells.push({
        ref,
        row: rowIndex(ref),
        column: columnIndex(ref),
        value,
        rawValue,
        type,
        formula: formula ? decodeXml(formula) : null,
      });
    }
  }
  return cells;
}

function findMonthHeader(cells) {
  const byRow = Map.groupBy(cells, (cell) => cell.row);
  for (const [row, rowCells] of byRow) {
    const candidates = rowCells
      .map((cell) => ({ column: cell.column, month: monthLabels.get(normalizeText(cell.value)) }))
      .filter((cell) => cell.month)
      .sort((a, b) => a.column - b.column);
    const months = new Map();
    let expected = 1;
    for (const cell of candidates) {
      if (cell.month === expected) {
        months.set(cell.column, cell.month);
        expected += 1;
      } else if (cell.month === 1 && months.size < 6) {
        months.clear();
        months.set(cell.column, 1);
        expected = 2;
      }
      if (expected === 13) break;
    }
    if (months.size >= 6) return { row, months };
  }
  return null;
}

function extractAnnualRows(workbook, sheet, knownTotalsByYear) {
  const cells = parseSheetCells(workbook, sheet);
  const header = findMonthHeader(cells);
  const issues = [];
  const rows = [];
  if (!header) {
    issues.push({ sheet: sheet.name, cell: null, severity: "error", message: "Cabecalho mensal nao encontrado.", treatment: "Aba nao importada; revisar layout." });
    return { rows, issues, reconciliation: null };
  }

  const byRow = Map.groupBy(cells.filter((cell) => cell.row > header.row), (cell) => cell.row);
  const labelColumns = [...cells.filter((cell) => cell.row === header.row && !header.months.has(cell.column)).map((cell) => cell.column), 1];
  const maxLabelColumn = Math.min(...labelColumns.filter((column) => column < Math.min(...header.months.keys())));

  for (const [rowNumber, rowCells] of byRow) {
    const labelCell = rowCells
      .filter((cell) => cell.column <= Math.min(...header.months.keys()) && String(cell.value).trim())
      .sort((a, b) => Math.abs(a.column - maxLabelColumn) - Math.abs(b.column - maxLabelColumn))[0];
    const label = String(labelCell?.value ?? "").trim();
    if (!label) continue;
    const classification = classifyLabel(label);
    for (const [column, month] of header.months) {
      const cell = rowCells.find((item) => item.column === column);
      if (!cell || cell.value === "") continue;
      if (cell.type === "e" || /^#/.test(String(cell.value))) {
        issues.push({ sheet: sheet.name, cell: cell.ref, severity: "error", message: `Formula/valor invalido em ${label}: ${cell.value}`, treatment: "Nao importar como dado financeiro; revisar celula." });
        continue;
      }
      const amount = Number(cell.value);
      if (!Number.isFinite(amount) || amount === 0) continue;
      const isNegativeAmount = amount < 0;
      const amountCents = Math.abs(centsFromNumber(amount));
      if (classification.classification === "aggregate") continue;
      const base = {
        year: Number(sheet.name),
        month,
        sourceLabel: label,
        classification: classification.classification,
        amount: amountCents / 100,
        amountCents,
        sourceSheet: sheet.name,
        sourceCell: cell.ref,
        rawValue: String(cell.value),
        suggestedNature: classification.nature,
        suggestedSubtype: classification.subtype,
        suggestedOrigin: classification.origin,
        classificationStatus: isNegativeAmount ? "PENDENTE_REVISAO" : classification.classificationStatus,
        status: isNegativeAmount ? "PENDENTE" : classification.status,
        confidence: classification.confidence,
        issue: isNegativeAmount ? "Valor negativo na planilha; revisar natureza antes de confirmar." : classification.issue,
      };
      const fingerprintSeed = ["user_a", base.suggestedNature, base.suggestedSubtype, `${base.year}-${String(month).padStart(2, "0")}`, amountCents, normalizeText(label)].join("|");
      rows.push({
        ...base,
        rawRowHash: sha256([sheet.name, rowNumber, cell.ref, label, cell.value].join("|")),
        logicalFingerprint: sha256(fingerprintSeed),
      });
    }
  }

  const totalCents = rows.reduce((total, row) => total + row.amountCents, 0);
  const expectedCents = knownTotalsByYear.get(Number(sheet.name));
  const reconciliation = {
    year: Number(sheet.name),
    expectedCents,
    parsedCents: totalCents,
    differenceCents: expectedCents == null ? null : totalCents - expectedCents,
  };
  if (expectedCents != null && Math.abs(totalCents - expectedCents) > 1) {
    issues.push({ sheet: sheet.name, cell: null, severity: "warning", message: `Total parseado difere do total conhecido em ${(totalCents - expectedCents) / 100}.`, treatment: "Manter staging e revisar conciliacao antes de confirmar." });
  }
  return { rows, issues, reconciliation };
}

function buildFallbackStaging(reason) {
  const monthlyExpenses = annualCostSheets.flatMap((sheet) =>
    sheet.rows.flatMap((row) =>
      row.values.map((amount, monthIndex) => ({
        year: sheet.year,
        month: monthIndex + 1,
        sourceLabel: row.item,
        classification: row.classification,
        amount,
        amountCents: centsFromNumber(amount),
        sourceSheet: String(sheet.year),
        sourceCell: null,
        rawRowHash: sha256([sheet.year, row.item, monthIndex + 1, amount].join("|")),
        logicalFingerprint: sha256(["fallback", sheet.year, row.item, monthIndex + 1, amount].join("|")),
        classificationStatus: row.classification === "review" ? "PENDENTE_REVISAO" : "CONFIRMADO",
        status: row.classification === "review" ? "PENDENTE" : "ACEITO",
      })),
    ),
  );

  return createStagingEnvelope({
    mode: "fallback",
    sourceFile: "referencias/Custo Mensal.xlsx",
    fileHash: null,
    sourceFileSize: null,
    monthlyExpenses,
    importIssues: [{ sheet: null, cell: null, severity: "warning", message: reason, treatment: "Fallback manual usado; nao tratar como importacao real." }, ...importIssues],
    reconciliations: [],
  });
}

function createStagingEnvelope({ mode, sourceFile, fileHash, sourceFileSize, monthlyExpenses, importIssues, reconciliations }) {
  const dividendPayments = dividends.flatMap((asset) =>
    asset.paid.map((amount, monthIndex) => ({
      ticker: asset.ticker,
      year: 2026,
      month: monthIndex + 1,
      amount,
      amountCents: centsFromNumber(amount),
      sourceSheet: "FIIS - Dividendos",
    })),
  );

  return {
    source: sourceFile,
    mode,
    parserVersion,
    fileHash,
    sourceFileSize,
    generatedAt: new Date().toISOString(),
    note: mode === "xlsx" ? "Staging gerado a partir da planilha real. Revisar pendencias antes de confirmar qualquer transacao." : "Staging fallback derivado da analise manual da planilha.",
    counters: {
      rowsTotal: monthlyExpenses.length,
      rowsAccepted: monthlyExpenses.filter((row) => row.status === "ACEITO").length,
      rowsRejected: monthlyExpenses.filter((row) => row.status === "REJEITADO").length,
      rowsPending: monthlyExpenses.filter((row) => row.status === "PENDENTE").length,
    },
    reconciliations,
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

export function buildStaging(options = {}) {
  const sourcePath = options.sourcePath ?? fileURLToPath(defaultWorkbook);
  if (!existsSync(sourcePath)) {
    if (options.allowFallback === false) throw new Error(`Planilha nao encontrada: ${sourcePath}`);
    return buildFallbackStaging(`Planilha nao encontrada: ${sourcePath}`);
  }

  try {
    const buffer = readFileSync(sourcePath);
    const workbook = parseWorkbook(buffer);
    const knownTotalsByYear = new Map(annualCostSheets.map((sheet) => [sheet.year, centsFromNumber(sheet.rows.reduce((total, row) => total + row.values.reduce((sum, value) => sum + value, 0), 0))]));
    const monthlyExpenses = [];
    const issues = [];
    const reconciliations = [];

    for (const sheet of workbook.sheets.filter((item) => yearSheets.has(item.name))) {
      const extracted = extractAnnualRows(workbook, sheet, knownTotalsByYear);
      monthlyExpenses.push(...extracted.rows);
      issues.push(...extracted.issues);
      if (extracted.reconciliation) reconciliations.push(extracted.reconciliation);
    }

    return createStagingEnvelope({
      mode: "xlsx",
      sourceFile: sourcePath,
      fileHash: sha256(buffer),
      sourceFileSize: statSync(sourcePath).size,
      monthlyExpenses,
      importIssues: [...issues, ...importIssues],
      reconciliations,
    });
  } catch (error) {
    if (options.allowFallback === false) throw error;
    return buildFallbackStaging(`Falha ao ler planilha real: ${error.message}`);
  }
}

export async function writeStaging(options = {}) {
  const staging = buildStaging(options);
  const outputFile = new URL("custo-mensal-staging.json", outputDir);

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, JSON.stringify(staging, null, 2), "utf8");

  return { outputFile, staging };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { outputFile, staging } = await writeStaging();

  console.log(`Staging gerado: ${outputFile.pathname}`);
  console.log(`Modo: ${staging.mode}`);
  console.log(`Arquivo: ${basename(staging.source)}`);
  console.log(`Lancamentos mensais: ${staging.monthlyExpenses.length}`);
  console.log(`Dividendos: ${staging.dividendPayments.length}`);
  console.log(`Pendentes: ${staging.counters.rowsPending}`);
  console.log(`Inconsistencias: ${staging.importIssues.length}`);
}
