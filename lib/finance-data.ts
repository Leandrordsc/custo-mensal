export const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export type Classification = "expense" | "investment_transfer" | "card_payment" | "reserve" | "review";

export type AnnualCostRow = {
  item: string;
  classification: Classification;
  values: number[];
  isAggregate?: boolean;
};

export type AnnualCostSheet = {
  year: number;
  rows: AnnualCostRow[];
};

export const annualCostSheets: AnnualCostSheet[] = [
  {
    year: 2020,
    rows: [
      { item: "Agua", classification: "expense", values: [52.62, 53.55, 52.28, 48.02, 51.61, 53.65, 52.88, 51.79, 56.35, 55.79, 54.73, 54.67] },
      { item: "Luz", classification: "expense", values: [76.91, 73.55, 80.9, 85.34, 107.09, 96.02, 107.77, 117.09, 99.31, 109.93, 203.94, 195.05] },
      { item: "Telefone/Internet", classification: "expense", values: [70, 70, 70, 65, 65, 65, 65, 65, 65, 66, 65, 65] },
      { item: "Cartão Itau", classification: "card_payment", values: [270, 270, 500, 350, 350, 640, 290, 400, 3200, 0, 100, 90.57] },
      { item: "Poupança Nossa", classification: "investment_transfer", values: [500, 400, 500, 500, 500, 600, 700, 700, 3700, 400, 400, 400] },
      { item: "Compras", classification: "expense", values: [640, 540, 610, 580, 700, 820, 680, 620, 1230, 730, 840, 1241.86] },
      { item: "Combustivel - Carro", classification: "expense", values: [80, 90, 85, 85, 95, 100, 100, 100, 110, 110, 125, 130] },
      { item: "Cigarros", classification: "expense", values: [220, 240, 260, 240, 270, 300, 260, 250, 310, 280, 310, 346.75] },
    ],
  },
  { year: 2021, rows: baseRows(2021, [2231.55, 1869.96, 2995.15, 3342.07, 2980.67, 3428.58, 5313.96, 3053.6, 5480.46, 2544.07, 3767.83, 1318.08]) },
  { year: 2022, rows: baseRows(2022, [5207.12, 2206.07, 3730.95, 3645.17, 4272.48, 7547.42, 5804.6, 2964.54, 4316.04, 5229.72, 6039.95, 7263.43]) },
  { year: 2023, rows: baseRows(2023, [3963.46, 4293.85, 3685.95, 4395.05, 4399.65, 5632.33, 6063.44, 4972.48, 4521.19, 4991.57, 5184.61, 9464.44]) },
  { year: 2024, rows: baseRows(2024, [5500.9, 4831.91, 4913.2, 4540.43, 4640.09, 3832.73, 7901.33, 3775.78, 3802.44, 4217.39, 2627.1, 9521.33]) },
  { year: 2025, rows: baseRows(2025, [5693.01, 16181.88, 4661.7, 5305.56, 4986.3, 10203.6, 6291.42, 4292.31, 5776.24, 4725.82, 3870.63, 5287]) },
  {
    year: 2026,
    rows: [
      { item: "Agua", classification: "expense", values: [78.21, 121.85, 83.56, 83.56, 89.27, 89.27, 0.76, 0, 0, 0, 0, 0] },
      { item: "Luz", classification: "expense", values: [214.83, 214.31, 203.77, 139.03, 210.97, 217.29, 237.62, 0, 0, 0, 0, 0] },
      { item: "Telefone/Internet", classification: "expense", values: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0] },
      { item: "Cartão Mercado Pago", classification: "card_payment", values: [3970.28, 3042.5, 0, 913.87, 2157.12, 0, 0, 0, 0, 0, 0, 0] },
      { item: "Cartão Nubank", classification: "card_payment", values: [31.49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      { item: "99 Pay - Cintia Diversão", classification: "expense", values: [100, 100, 100, 100, 100, 50, 0, 0, 0, 0, 0, 0] },
      { item: "FIIS - AÇÕES - RENDA FIXA", classification: "investment_transfer", values: [2900, 2816, 2400, 5900, 3300, 1300, 0, 0, 0, 0, 0, 0] },
      { item: "Reserva de Oportunidade", classification: "reserve", values: [900, 900, 900, 900, 900, 450, 0, 0, 0, 0, 0, 0] },
      { item: "Livia - 18 anos", classification: "reserve", values: [100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0, 0] },
      { item: "Manutenção/Seguro/Carro", classification: "expense", values: [5123.62, 399.99, 2807.32, 399.95, 436.32, 0, 0, 0, 0, 0, 0, 0] },
      { item: "Cigarros", classification: "expense", values: [465, 420, 465, 450, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  },
];

export const cardRows = [
  { date: "2026-06-06", desc: "Cigarros", value: 150, reserved: true },
  { date: "2026-06-07", desc: "Bananas Outlet", value: 238.8, reserved: true },
  { date: "2026-06-07", desc: "Gasolina", value: 135.26, reserved: true },
  { date: "2026-06-10", desc: "Celular Mae", value: 20, reserved: true },
  { date: "2026-06-10", desc: "PowerBank/Nincho", value: 123.82, reserved: true },
  { date: "2026-06-13", desc: "Mercado", value: 72.5, reserved: true },
  { date: "2026-06-15", desc: "Gasolina", value: 220.01, reserved: true },
  { date: "2026-06-15", desc: "Cigarros", value: 75, reserved: true },
  { date: "2026-06-17", desc: "Botas", value: 145.34, reserved: true },
];

export const cardYield = [
  { month: "Dez", box: 5.5, cashback: 0 },
  { month: "Jan", box: 19.87, cashback: 0 },
  { month: "Fev", box: 30.49, cashback: 0 },
  { month: "Mar", box: 1.89, cashback: 0 },
  { month: "Abr", box: 6.86, cashback: 0 },
  { month: "Mai", box: 18.09, cashback: 39.14 },
  { month: "Jun", box: 3.01, cashback: 14.39 },
];

export const dividends = [
  { ticker: "MXRF11", company: "MAXI RENDA FDO INV IMOB", class: "Híbrido", avg: 9.76, qty: 610, now: 9.69, paid: [60.2, 61, 61, 57.95, 61, 61, 0, 0, 0, 0, 0, 0] },
  { ticker: "RBVA11", company: "RIO BRAVO RENDA VAREJO", class: "Renda Urbana", avg: 10.18, qty: 750, now: 8.91, paid: [58.5, 63, 63, 63, 63, 63, 0, 0, 0, 0, 0, 0] },
  { ticker: "GARE11", company: "GUARDIAN LOGÍSTICA", class: "Híbrido", avg: 8.87, qty: 825, now: 8.13, paid: [58.1, 58.1, 58.1, 66.4, 66.4, 66.4, 0, 0, 0, 0, 0, 0] },
  { ticker: "HSML11", company: "HSI MALLS", class: "Shoppings", avg: 89.26, qty: 80, now: 86.16, paid: [52.5, 52.5, 52.5, 56, 56.8, 60, 0, 0, 0, 0, 0, 0] },
  { ticker: "BRCO11", company: "BRESCO LOGISTICA", class: "Logística", avg: 118.18, qty: 65, now: 112.77, paid: [56.55, 56.55, 59.8, 59.8, 61.75, 61.75, 0, 0, 0, 0, 0, 0] },
  { ticker: "BTLG11", company: "BTG PACTUAL LOGISTICA", class: "Logística", avg: 100.94, qty: 70, now: 102.25, paid: [51.35, 52, 56, 56.7, 56.7, 56.7, 0, 0, 0, 0, 0, 0] },
  { ticker: "KNCR11", company: "KINEA IMOBILIÁRIOS", class: "Papel", avg: 100.58, qty: 60, now: 107.12, paid: [78, 72, 60, 69, 66, 66, 0, 0, 0, 0, 0, 0] },
  { ticker: "HFOF11", company: "HEDGE TOP", class: "FOF", avg: 6.87, qty: 900, now: 6.41, paid: [56, 56, 48, 51.12, 51.12, 51.12, 0, 0, 0, 0, 0, 0] },
  { ticker: "RURA11", company: "ITAÚ ASSET RURAL FIAGRO", class: "FIAGRO", avg: 8.2, qty: 800, now: 8.32, paid: [82.5, 90, 90, 96, 90.4, 88, 0, 0, 0, 0, 0, 0] },
];

export const allocation = [
  { name: "Caixa", target: 0.3, current: 0.2555, amount: 47155.07 },
  { name: "Ações", target: 0.2, current: 0.2103, amount: 38812.96 },
  { name: "FIIs", target: 0.25, current: 0.3405, amount: 62842.66 },
  { name: "Exterior", target: 0.25, current: 0.1937, amount: 35749.26 },
];

export const importIssues = [
  { sheet: "2020", cell: "E39:M39", severity: "error", message: "#REF! em fórmulas fora da matriz principal", treatment: "Não importar como dado financeiro; registrar para auditoria." },
  { sheet: "Investimentos", cell: "O30/O42", severity: "error", message: "#REF! em cálculo de ações compradas", treatment: "Reclassificar como item pendente de revisão antes de consolidar posição." },
  { sheet: "FIIS - Dividendos", cell: "V6:W15", severity: "warning", message: "#DIV/0! em linhas vazias/incompletas", treatment: "Ignorar linhas sem ticker e calcular yield apenas quando base > 0." },
  { sheet: "FisWebDriver", cell: "B3:B29", severity: "info", message: "Preços armazenados como texto BRL", treatment: "Substituir por asset_prices com provider e timestamp." },
];

function baseRows(year: number, totals: number[]): AnnualCostRow[] {
  return [
    { item: `Total original ${year}`, classification: "review", values: totals, isAggregate: true },
  ];
}

export function hasDetailedExpenseRows(rows: AnnualCostRow[]) {
  return rows.some((row) => !row.isAggregate && (row.classification === "expense" || row.classification === "card_payment"));
}

export function getYearSheet(year: number) {
  return annualCostSheets.find((sheet) => sheet.year === year) ?? annualCostSheets.at(-1)!;
}

export function monthlyTotals(rows: AnnualCostRow[], mode: "all" | "expenses" = "all") {
  return months.map((_, index) =>
    rows
      .filter((row) => mode === "all" || row.classification === "expense" || row.classification === "card_payment")
      .reduce((sum, row) => sum + row.values[index], 0),
  );
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

export function dividendTotals(rows = dividends) {
  const totalPaid = rows.reduce((total, row) => total + sum(row.paid), 0);
  const invested = rows.reduce((total, row) => total + row.avg * row.qty, 0);
  const market = rows.reduce((total, row) => total + row.now * row.qty, 0);
  return { totalPaid, invested, market };
}
