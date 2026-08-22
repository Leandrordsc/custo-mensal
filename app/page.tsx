"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { allocation, annualCostSheets, cardRows, cardYield, dividends, dividendTotals, getYearSheet, hasDetailedExpenseRows, importIssues, monthlyTotals, months, sum } from "@/lib/finance-data";

const menu = ["Dashboard", "Custos", "Cartões", "Ativos e Proventos"];
const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtCurrency = (value: number, currency: string) => value.toLocaleString("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 });
const pct = (value: number) => value.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
};
const localApiBaseUrl = "http://127.0.0.1:3001";
const monthOptions = months.map((month, index) => ({ label: month, value: index + 1 }));

type BaseOption = { id: string; name: string; status?: string };
type ExpenseRecord = {
  id: string;
  date: string;
  competenceMonth: string;
  description: string;
  amountCents: number;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethod: "CONTA" | "CARTAO";
  accountId: string | null;
  accountName: string | null;
  cardId: string | null;
  cardName: string | null;
  classificationStatus: string;
  transactionStatus: string;
  notes: string | null;
  voidedAt: string | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
};
type ExpenseSummary = {
  totalConfirmedCents: number;
  totalCardCents: number;
  totalPendingCents: number;
  count: number;
  byCategory: { category: string; amountCents: number }[];
};
type ExpenseFormState = {
  description: string;
  amount: string;
  date: string;
  competenceMonth: string;
  categoryId: string;
  paymentMethod: "CONTA" | "CARTAO";
  accountId: string;
  cardId: string;
  notes: string;
  classificationStatus: "CONFIRMADO" | "PENDENTE_REVISAO";
  isInstallment: boolean;
  installments: number;
};
type DashboardOverview = {
  summary: {
    livingCostCents: number;
    cardPurchasesCents: number;
    invoicePaymentsCents: number;
    internalTransfersCents: number;
    reserveTransfersCents: number;
    contributionsCents: number;
    reinvestmentsCents: number;
    dividendsCents: number;
    confirmedCashbackCents: number;
    estimatedCashbackCents: number;
    reserveEarningsCents: number;
    pendingReviewCents: number;
    rejectedCents: number;
    ignoredCents: number;
  };
  monthlySeries: { month: string; livingCostCents: number; cardPurchasesCents: number; pendingReviewCents: number }[];
  categories: { category: string; amountCents: number }[];
  investments: InvestmentOverview;
  transactionCount: number;
  countableTransactionCount: number;
  hasTransactions: boolean;
  hasFinancialImpact: boolean;
};
type InvestmentOverview = {
  period: { fromMonth: string; toMonth: string };
  positions: {
    assetId: string;
    ticker: string | null;
    name: string;
    assetClass: string;
    exchange: string | null;
    market: string | null;
    currency: string;
    quantityDecimal: string;
    averagePriceDecimal: string | null;
    lastPriceDecimal: string | null;
    lastPriceQuotedAt: string | null;
    lastPriceIsStale: boolean;
    investedCents: number;
    currentValueCents: number | null;
    currentValueBrlCents: number | null;
  }[];
  dividends: {
    transactionId: string;
    assetId: string | null;
    ticker: string | null;
    name: string | null;
    paymentDate: string;
    competenceMonth: string;
    description: string;
    currency: string;
    amountCents: number;
    amountBrlCents: number | null;
  }[];
  totalsByCurrency: Record<string, { investedCents: number; currentValueCents: number; dividendsCents: number }>;
  consolidatedBrl: {
    investedCents: number;
    currentValueCents: number;
    dividendsCents: number;
    pendingCurrentValueCents: number;
    pendingDividendsCents: number;
  };
  exchangeRate: { rateDecimal: string | null; referenceDate: string | null; provider: string | null; isStale: boolean };
  alerts: { type: string; message: string; ticker?: string | null; currency?: string }[];
  hasAssets: boolean;
  hasPendingConversion: boolean;
};
type CardOverview = {
  period: { fromMonth: string; toMonth: string };
  summary: {
    invoiceCents: number;
    invoiceTotalCents: number;
    purchaseCents: number;
    purchaseTotalCents: number;
    paymentCents: number;
    paymentTotalCents: number;
    confirmedCashbackCents: number;
    realCashbackCents: number;
    estimatedCashbackCents: number;
  };
  cards: {
    id: string;
    name: string;
    issuer: string | null;
    status: string;
    closingDay: number;
    dueDay: number;
    cashbackRateBps: number;
    invoiceCents: number;
    invoiceTotalCents: number;
    purchaseTotalCents: number;
    paymentCents: number;
    paymentTotalCents: number;
    confirmedCashbackCents: number;
    realCashbackCents: number;
    estimatedCashbackCents: number;
    installmentCount: number;
    purchases: CardOverview["purchases"];
  }[];
  purchases: {
    transactionId: string;
    cardId: string;
    cardName: string;
    purchaseId: string | null;
    date: string;
    statementMonth: string;
    description: string;
    amountCents: number;
    installmentNumber: number | null;
    totalInstallments: number | null;
  }[];
  monthlyHistory: { month: string; invoiceCents: number; paymentCents: number; confirmedCashbackCents: number; estimatedCashbackCents: number }[];
  monthlySeries: { month: string; invoiceTotalCents: number; estimatedCashbackCents: number; realCashbackCents: number }[];
  movements: { transactionId: string; cardId: string; cardName: string; date: string; competenceMonth: string; description: string; amountCents: number }[];
  hasPurchases: boolean;
};

const emptyDashboardOverview: DashboardOverview = {
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
  investments: emptyInvestmentOverview(),
  transactionCount: 0,
  countableTransactionCount: 0,
  hasTransactions: false,
  hasFinancialImpact: false,
};
function emptyInvestmentOverview(): InvestmentOverview {
  return {
    period: { fromMonth: "2026-01", toMonth: "2026-12" },
    positions: [],
    dividends: [],
    totalsByCurrency: {
      BRL: { investedCents: 0, currentValueCents: 0, dividendsCents: 0 },
      USD: { investedCents: 0, currentValueCents: 0, dividendsCents: 0 },
    },
    consolidatedBrl: { investedCents: 0, currentValueCents: 0, dividendsCents: 0, pendingCurrentValueCents: 0, pendingDividendsCents: 0 },
    exchangeRate: { rateDecimal: null, referenceDate: null, provider: null, isStale: false },
    alerts: [],
    hasAssets: false,
    hasPendingConversion: false,
  };
}
const emptyCardOverview: CardOverview = {
  period: { fromMonth: "2026-01", toMonth: "2026-12" },
  summary: {
    invoiceCents: 0,
    invoiceTotalCents: 0,
    purchaseCents: 0,
    purchaseTotalCents: 0,
    paymentCents: 0,
    paymentTotalCents: 0,
    confirmedCashbackCents: 0,
    realCashbackCents: 0,
    estimatedCashbackCents: 0,
  },
  cards: [],
  purchases: [],
  monthlyHistory: [],
  monthlySeries: [],
  movements: [],
  hasPurchases: false,
};

const emptyExpenseForm = (year: string, month: number): ExpenseFormState => ({
  description: "",
  amount: "",
  date: `${year}-${String(month).padStart(2, "0")}-01`,
  competenceMonth: `${year}-${String(month).padStart(2, "0")}`,
  categoryId: "",
  paymentMethod: "CONTA",
  accountId: "",
  cardId: "",
  notes: "",
  classificationStatus: "CONFIRMADO",
  isInstallment: false,
  installments: 1,
});

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [year, setYear] = useState("2026");
  const [search, setSearch] = useState("");
  const years = annualCostSheets.map((sheet) => String(sheet.year));

  return (
    <main className="app-shell">
      <aside className="side-menu">
        <div className="brand-mark">CM</div>
        {menu.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}>{item}</button>)}
      </aside>
      <section className="workbench">
        <header className="topbar">
          <input aria-label="Pesquisar" placeholder="Pesquisar ticker, custo ou lançamento..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Ano" value={year} onChange={(event) => setYear(event.target.value)}>{years.map((item) => <option key={item}>{item}</option>)}</select>
          <button className="primary">Importar Excel</button>
          <button>Exportar</button>
        </header>
        <Hero year={year} />
        {active === "Dashboard" && <DashboardView year={Number(year)} />}
        {active === "Custos" && <CostsView year={year} />}
        {active === "Cartões" && <CardsViewConnected />}
        {active === "Ativos e Proventos" && <InvestmentsConnectedView year={year} />}
      </section>
    </main>
  );
}

function Hero({ year }: { year: string }) {
  const { totalPaid, invested, market } = dividendTotals();
  return (
    <section className="overview">
      <div><p className="eyebrow">Controle financeiro pessoal</p><h1>Custo Mensal {year}</h1><span>Dados históricos preservados da planilha, com custos separados de aportes e investimentos.</span></div>
      <Kpi title="Patrimônio FII atual" value={fmt(market)} tone="blue" />
      <Kpi title="Dividendos 2026" value={fmt(totalPaid)} tone="green" />
      <Kpi title="Yield on cost" value={pct(totalPaid / invested)} tone="amber" />
      <Kpi title="Meta mensal" value={`${fmt(totalPaid / 6)} / ${fmt(300)}`} tone="violet" />
    </section>
  );
}

function Kpi({ title, value, tone = "neutral" }: { title: string; value: string; tone?: string }) {
  return <article className={`kpi ${tone}`}><span>{title}</span><strong>{value}</strong></article>;
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Erro na API local.");
  }
  return body;
}

function assertDashboardOverview(value: unknown): DashboardOverview {
  if (!value || typeof value !== "object") {
    throw new Error("Payload invalido do Dashboard.");
  }
  const candidate = value as Partial<DashboardOverview>;
  if (
    !candidate.summary
    || !Array.isArray(candidate.monthlySeries)
    || !Array.isArray(candidate.categories)
    || typeof candidate.transactionCount !== "number"
    || typeof candidate.countableTransactionCount !== "number"
    || typeof candidate.hasTransactions !== "boolean"
    || typeof candidate.hasFinancialImpact !== "boolean"
  ) {
    throw new Error("Payload invalido do Dashboard.");
  }
  return { ...candidate, investments: candidate.investments ?? emptyInvestmentOverview() } as DashboardOverview;
}

function assertInvestmentOverview(value: unknown): InvestmentOverview {
  if (!value || typeof value !== "object") {
    throw new Error("Payload invalido de Ativos.");
  }
  const candidate = value as Partial<InvestmentOverview>;
  if (!candidate.totalsByCurrency || !candidate.consolidatedBrl || !candidate.exchangeRate || !Array.isArray(candidate.positions) || !Array.isArray(candidate.dividends) || !Array.isArray(candidate.alerts)) {
    throw new Error("Payload invalido de Ativos.");
  }
  return candidate as InvestmentOverview;
}

function assertCardOverview(value: unknown): CardOverview {
  if (!value || typeof value !== "object") {
    throw new Error("Payload invalido de Cartoes.");
  }
  const candidate = value as Partial<CardOverview>;
  if (
    !candidate.summary
    || !Array.isArray(candidate.cards)
    || !Array.isArray(candidate.purchases)
    || !Array.isArray(candidate.monthlyHistory)
    || !Array.isArray(candidate.movements)
  ) {
    throw new Error("Payload invalido de Cartoes.");
  }
  return candidate as CardOverview;
}

function centsToInput(value: number) {
  return (value / 100).toFixed(2).replace(".", ",");
}

function DashboardView({ year }: { year: number }) {
  const [month, setMonth] = useState<string>("all");
  const [dashboard, setDashboard] = useState<DashboardOverview>(emptyDashboardOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const maxMonth = Math.max(1, ...dashboard.monthlySeries.map((item) => Math.max(item.livingCostCents, item.cardPurchasesCents, item.pendingReviewCents)));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextDashboard = assertDashboardOverview(await readJson(await fetch(`${localApiBaseUrl}/api/dashboard?year=${year}&month=${month}`)));
      setDashboard(nextDashboard);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel carregar o Dashboard local.");
      setDashboard(emptyDashboardOverview);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Dashboard SQLite</p><h2>Visao consolidada dos lancamentos persistidos</h2></div><span>Transactions e a fonte principal; faturas e transferencias ficam fora do custo de vida.</span></section>
      <section className="costs-toolbar">
        <select aria-label="Periodo do Dashboard" value={month} onChange={(event) => setMonth(event.target.value)}>
          <option value="all">Ano inteiro</option>
          {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button onClick={() => void loadDashboard()}>Atualizar</button>
      </section>
      {error && <p className="error-banner">{error}</p>}
      {!loading && !error && !dashboard.hasFinancialImpact && <p className="empty-dashboard">{dashboard.hasTransactions ? "Existem registros no periodo, mas nenhum impacto financeiro relevante para o Dashboard." : "Nenhum lancamento persistido encontrado para este periodo. Cadastre despesas na aba Custos para alimentar o Dashboard."}</p>}
      <section className="kpi-grid"><Kpi title="Custo de vida" value={fmt(dashboard.summary.livingCostCents / 100)} /><Kpi title="Compras no cartao" value={fmt(dashboard.summary.cardPurchasesCents / 100)} tone="blue" /><Kpi title="Pendentes" value={fmt(dashboard.summary.pendingReviewCents / 100)} tone="amber" /><Kpi title="Aportes novos" value={fmt(dashboard.summary.contributionsCents / 100)} tone="green" /><Kpi title="Dividendos" value={fmt(dashboard.summary.dividendsCents / 100)} tone="violet" /></section>
      <section className="kpi-grid"><Kpi title="Patrimonio BRL" value={fmt(dashboard.investments.totalsByCurrency.BRL.currentValueCents / 100)} tone="green" /><Kpi title="Patrimonio USD" value={fmtCurrency(dashboard.investments.totalsByCurrency.USD.currentValueCents / 100, "USD")} tone="blue" /><Kpi title="Consolidado em BRL" value={fmt(dashboard.investments.consolidatedBrl.currentValueCents / 100)} tone="violet" /><Kpi title="Proventos USD" value={fmtCurrency(dashboard.investments.totalsByCurrency.USD.dividendsCents / 100, "USD")} tone="amber" /></section>
      {dashboard.investments.alerts.length > 0 && <p className="error-banner">{dashboard.investments.alerts.map((alert) => alert.message).join(" ")}</p>}
      <section className="split wide-left">
        <article className="panel"><div className="chart-head"><h3>Evolucao mensal persistida</h3><strong>{loading ? "Carregando..." : `${dashboard.countableTransactionCount} relevantes`}</strong></div><div className="month-bars labeled dashboard-bars">{dashboard.monthlySeries.length ? dashboard.monthlySeries.map((item) => <div key={item.month}><i style={{ height: `${Math.max(6, (item.livingCostCents / maxMonth) * 100)}%` }} /><span>{item.month.slice(5)}</span><b>{fmt(item.livingCostCents / 100)}</b></div>) : <p className="empty-state">Sem dados para grafico.</p>}</div></article>
        <article className="panel"><div className="chart-head"><h3>Por categoria</h3><strong>{fmt(dashboard.summary.livingCostCents / 100)}</strong></div><div className="simple-bars">{dashboard.categories.length ? dashboard.categories.map((item) => <div key={item.category}><span>{item.category}</span><i style={{ width: `${Math.max(4, (item.amountCents / Math.max(1, dashboard.summary.livingCostCents)) * 100)}%` }} /><b>{fmt(item.amountCents / 100)}</b></div>) : <p className="empty-state">Sem despesas confirmadas.</p>}</div></article>
      </section>
      <section className="kpi-grid"><Kpi title="Faturas pagas" value={fmt(dashboard.summary.invoicePaymentsCents / 100)} /><Kpi title="Transferencias internas" value={fmt(dashboard.summary.internalTransfersCents / 100)} /><Kpi title="Reservas e caixinhas" value={fmt(dashboard.summary.reserveTransfersCents / 100)} /><Kpi title="Reinvestimentos" value={fmt(dashboard.summary.reinvestmentsCents / 100)} /><Kpi title="Cashback real" value={fmt(dashboard.summary.confirmedCashbackCents / 100)} tone="green" /><Kpi title="Cashback estimado" value={fmt(dashboard.summary.estimatedCashbackCents / 100)} tone="amber" /><Kpi title="Rendimentos" value={fmt(dashboard.summary.reserveEarningsCents / 100)} tone="blue" /><Kpi title="Ignorados" value={fmt(dashboard.summary.ignoredCents / 100)} /></section>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StaticDashboardView({ year }: { year: number }) {
  const sheet = getYearSheet(year);
  const allTotals = monthlyTotals(sheet.rows);
  const expenseTotals = monthlyTotals(sheet.rows, "expenses");
  const yearHasDetail = hasDetailedExpenseRows(sheet.rows);
  const yearExpenses = sum(yearHasDetail ? expenseTotals : allTotals);
  const annualHistory = annualCostSheets.map((item) => ({ year: item.year, total: sum(monthlyTotals(item.rows, hasDetailedExpenseRows(item.rows) ? "expenses" : "all")) }));
  const { totalPaid, market } = dividendTotals();
  const cardInvoice = cardRows.reduce((total, row) => total + row.value, 0);

  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Dashboard</p><h2>Visão consolidada sem copiar a aba Consolidado</h2></div><span>Custos, cartões, patrimônio, dividendos e pendências de importação.</span></section>
      <section className="kpi-grid"><Kpi title={yearHasDetail ? `Custos ${year}` : `Total original ${year}`} value={fmt(yearExpenses)} /><Kpi title="Total original da aba" value={fmt(sum(allTotals))} tone="amber" /><Kpi title="Fatura cartão" value={fmt(cardInvoice)} tone="blue" /><Kpi title="Dividendos" value={fmt(totalPaid)} tone="green" /><Kpi title="Carteira FIIs" value={fmt(market)} tone="violet" /></section>
      <section className="split wide-left">
        <article className="panel"><div className="chart-head"><h3>Evolução anual de custos</h3><strong>2020 a 2026</strong></div><LineChart values={annualHistory.map((item) => item.total)} labels={annualHistory.map((item) => String(item.year))} /></article>
        <article className="panel"><div className="chart-head"><h3>Alocação CAFE</h3><strong>Consolidado</strong></div><Allocation /></article>
      </section>
      <DataTable headers={["Aba", "Célula", "Severidade", "Tratamento"]} rows={importIssues.map((issue) => [issue.sheet, issue.cell, issue.severity, issue.treatment])} />
    </>
  );
}

function CostsView({ year }: { year: string }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [bases, setBases] = useState<{ categories: BaseOption[]; accounts: BaseOption[]; cards: BaseOption[] }>({ categories: [], accounts: [], cards: [] });
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({ totalConfirmedCents: 0, totalCardCents: 0, totalPendingCents: 0, count: 0, byCategory: [] });
  const [form, setForm] = useState<ExpenseFormState>(() => emptyExpenseForm(year, month));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = `year=${year}&month=${month}`;
      const [basesResponse, expensesResponse, summaryResponse] = await Promise.all([
        fetch(`${localApiBaseUrl}/api/costs/bases`),
        fetch(`${localApiBaseUrl}/api/costs/expenses?${params}`),
        fetch(`${localApiBaseUrl}/api/costs/summary?${params}`),
      ]);
      const [nextBases, nextExpenses, nextSummary] = await Promise.all([readJson(basesResponse), readJson(expensesResponse), readJson(summaryResponse)]);
      setBases(nextBases);
      setExpenses(nextExpenses);
      setSummary(nextSummary);
      setForm((current) => ({
        ...current,
        competenceMonth: `${year}-${String(month).padStart(2, "0")}`,
        date: current.date || `${year}-${String(month).padStart(2, "0")}-01`,
        categoryId: current.categoryId || nextBases.categories[0]?.id || "",
        accountId: current.accountId || nextBases.accounts[0]?.id || "",
        cardId: current.cardId || nextBases.cards[0]?.id || "",
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel carregar custos.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    // A aba sincroniza com a API local sempre que o periodo muda.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function submitExpense(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${localApiBaseUrl}/api/costs/expenses${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      await readJson(response);
      setEditingId(null);
      setForm(emptyExpenseForm(year, month));
      await loadData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel salvar a despesa.");
    } finally {
      setSaving(false);
    }
  }

  async function cancelExpense(id: string) {
    if (!window.confirm("Cancelar esta despesa? O registro sera preservado para auditoria.")) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await readJson(await fetch(`${localApiBaseUrl}/api/costs/expenses/${id}/cancel`, { method: "POST" }));
      await loadData();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel cancelar a despesa.");
    } finally {
      setSaving(false);
    }
  }

  function editExpense(expense: ExpenseRecord) {
    setEditingId(expense.id);
    setForm({
      description: expense.description,
      amount: centsToInput(expense.amountCents),
      date: expense.date,
      competenceMonth: expense.competenceMonth,
      categoryId: expense.categoryId ?? "",
      paymentMethod: expense.paymentMethod,
      accountId: expense.accountId ?? "",
      cardId: expense.cardId ?? "",
      notes: expense.notes ?? "",
      classificationStatus: expense.classificationStatus === "PENDENTE_REVISAO" ? "PENDENTE_REVISAO" : "CONFIRMADO",
      isInstallment: Boolean(expense.totalInstallments && expense.totalInstallments > 1),
      installments: expense.totalInstallments ?? 1,
    });
  }

  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Custos locais</p><h2>Despesas persistidas em SQLite</h2></div><span>Compras do cartao entram como despesas; pagamento de fatura nao gera nova despesa.</span></section>
      <section className="costs-toolbar">
        <select aria-label="Mes de competencia" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        <button onClick={() => { setEditingId(null); setForm(emptyExpenseForm(year, month)); }}>Nova despesa</button>
        <button onClick={() => void loadData()}>Atualizar</button>
      </section>
      {error && <p className="error-banner">{error}</p>}
      <section className="kpi-grid"><Kpi title="Despesas confirmadas" value={fmt(summary.totalConfirmedCents / 100)} /><Kpi title="No cartao" value={fmt(summary.totalCardCents / 100)} tone="blue" /><Kpi title="Pendentes" value={fmt(summary.totalPendingCents / 100)} tone="amber" /><Kpi title="Lancamentos" value={String(summary.count)} tone="green" /></section>
      <section className="split wide-left">
        <article className="panel">
          <div className="chart-head"><h3>{editingId ? "Editar despesa" : "Nova despesa"}</h3><strong>{year}/{String(month).padStart(2, "0")}</strong></div>
          <form className="expense-form" onSubmit={(event) => void submitExpense(event)}>
            <label>Descricao<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required /></label>
            <label>Valor<span className="money-input"><b>R$</b><input inputMode="decimal" placeholder="123,45" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></span></label>
            <label>Data da compra<input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
            <label>Mes da fatura<input type="month" value={form.competenceMonth} onChange={(event) => setForm({ ...form, competenceMonth: event.target.value })} required /></label>
            <label>Categoria<select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} required><option value="">Selecione</option>{bases.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Meio<select value={form.paymentMethod} onChange={(event) => setForm({ ...form, paymentMethod: event.target.value as "CONTA" | "CARTAO" })}><option value="CONTA">Conta</option><option value="CARTAO">Cartao</option></select></label>
            {form.paymentMethod === "CONTA" ? <label>Conta<select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })} required><option value="">Selecione</option>{bases.accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <label>Cartao<select value={form.cardId} onChange={(event) => setForm({ ...form, cardId: event.target.value })} required><option value="">Selecione</option>{bases.cards.map((item) => <option key={item.id} value={item.id}>{item.name}{item.status === "HISTORICO" ? " (historico)" : ""}</option>)}</select></label>}
            <label>Status<select value={form.classificationStatus} onChange={(event) => setForm({ ...form, classificationStatus: event.target.value as "CONFIRMADO" | "PENDENTE_REVISAO" })}><option value="CONFIRMADO">Confirmado</option><option value="PENDENTE_REVISAO">Pendente de revisao</option></select></label>
            <label className="checkbox-row"><input type="checkbox" checked={form.isInstallment} onChange={(event) => setForm({ ...form, isInstallment: event.target.checked, installments: event.target.checked ? Math.max(2, form.installments) : 1, paymentMethod: event.target.checked ? "CARTAO" : form.paymentMethod })} /> Parcelado</label>
            {form.isInstallment && <label>Parcelas<input type="number" min="2" value={form.installments} onChange={(event) => setForm({ ...form, installments: Number(event.target.value) })} /></label>}
            <label className="full-row">Observacao<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            <div className="form-actions"><button className="primary" disabled={saving || bases.categories.length === 0}>{saving ? "Salvando..." : editingId ? "Salvar edicao" : "Cadastrar"}</button>{editingId && <button type="button" onClick={() => { setEditingId(null); setForm(emptyExpenseForm(year, month)); }}>Cancelar edicao</button>}</div>
          </form>
        </article>
        <article className="panel">
          <div className="chart-head"><h3>Por categoria</h3><strong>{fmt(summary.totalConfirmedCents / 100)}</strong></div>
          <div className="simple-bars">{summary.byCategory.length ? summary.byCategory.map((item) => <div key={item.category}><span>{item.category}</span><i style={{ width: `${Math.max(4, (item.amountCents / Math.max(1, summary.totalConfirmedCents)) * 100)}%` }} /><b>{fmt(item.amountCents / 100)}</b></div>) : <p className="empty-state">Sem despesas confirmadas neste periodo.</p>}</div>
        </article>
      </section>
      <article className="table-panel">
        <table className="data-table">
          <thead><tr>{["Data", "Descricao", "Categoria", "Meio", "Parcela", "Status", "Valor", "Acoes"].map((head) => <th key={head}>{head}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={8}>Carregando...</td></tr> : expenses.length === 0 ? <tr><td colSpan={8}>Nenhuma despesa cadastrada no periodo. Rode o bootstrap local para criar categorias, conta e cartoes.</td></tr> : expenses.map((expense) => <tr key={expense.id} className={expense.transactionStatus !== "ACTIVE" ? "muted-row" : ""}>
            <th>{fmtDate(expense.date)}<span>{expense.competenceMonth}</span></th><td>{expense.description}</td><td>{expense.categoryName ?? "-"}</td><td>{expense.paymentMethod === "CARTAO" ? expense.cardName : expense.accountName}</td><td>{expense.installmentNumber ? `${expense.installmentNumber}/${expense.totalInstallments}` : "-"}</td><td><span className={`status-badge ${expense.transactionStatus === "ACTIVE" ? expense.classificationStatus.toLowerCase() : "cancelado"}`}>{expense.transactionStatus === "ACTIVE" ? expense.classificationStatus : "CANCELADO"}</span></td><td>{fmt(expense.amountCents / 100)}</td><td className="row-actions"><button onClick={() => editExpense(expense)} disabled={expense.transactionStatus !== "ACTIVE"}>Editar</button><button onClick={() => void cancelExpense(expense.id)} disabled={expense.transactionStatus !== "ACTIVE"}>Cancelar</button></td>
          </tr>)}</tbody>
        </table>
      </article>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StaticCostsView({ year }: { year: string }) {
  const sheet = getYearSheet(Number(year));
  const detailed = hasDetailedExpenseRows(sheet.rows);
  const totals = monthlyTotals(sheet.rows, detailed ? "expenses" : "all");
  const max = Math.max(...totals);
  const investmentLike = sheet.rows.filter((row) => row.classification === "investment_transfer" || row.classification === "reserve");
  const displayedRows = detailed ? sheet.rows.filter((row) => row.classification === "expense" || row.classification === "card_payment") : sheet.rows;
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba Custos</p><h2>{detailed ? "Despesas mensais tratadas como custos reais" : "Total mensal original pendente de detalhamento"}</h2></div><span>{detailed ? "Aportes e reservas ficam sinalizados fora do total de despesa operacional." : "Este ano ainda está preservado como total agregado; a separação fina depende do parser completo da aba."}</span></section>
      <article className="panel">
        <div className="chart-head"><h3>Total mensal {year}</h3><strong>{fmt(totals.reduce((a, b) => a + b, 0))}</strong></div>
        <div className="month-bars labeled">{months.map((month, index) => <div key={month}><i style={{ height: `${Math.max(6, (totals[index] / max) * 100)}%` }} /><span>{month}</span><b>{fmt(totals[index])}</b></div>)}</div>
      </article>
      <MatrixTable rows={displayedRows.map((row) => ({ label: row.item, values: row.values }))} totals={totals} />
      {investmentLike.length > 0 && <DataTable headers={["Linha original", "Classificação", "Total separado"]} rows={investmentLike.map((row) => [row.item, row.classification, fmt(sum(row.values))])} />}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function InvestmentsView() {
  const total = allocation.reduce((sum, item) => sum + item.amount, 0);
  const equityCurve = annualCostSheets.map((sheet) => sum(monthlyTotals(sheet.rows)));
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba Investimentos</p><h2>Histórico, posição atual e evolução patrimonial</h2></div><span>Acompanha onde o dinheiro está alocado, quanto tem no total e como evoluiu.</span></section>
      <section className="split">
        <article className="panel"><div className="chart-head"><h3>Evolução patrimonial</h3><strong>{fmt(total)}</strong></div><LineChart values={equityCurve} /></article>
        <article className="panel"><div className="chart-head"><h3>Alocação CAFE</h3><strong>{fmt(total)}</strong></div><Allocation /></article>
      </section>
    </>
  );
}

function CardsViewConnected() {
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState<string>("all");
  const [overview, setOverview] = useState<CardOverview>(emptyCardOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const maxMonth = Math.max(1, ...overview.monthlyHistory.map((item) => Math.max(item.invoiceCents, item.estimatedCashbackCents, item.confirmedCashbackCents)));

  const loadCards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOverview = assertCardOverview(await readJson(await fetch(`${localApiBaseUrl}/api/cards/overview?year=${year}&month=${month}`)));
      setOverview(nextOverview);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel carregar cartoes.");
      setOverview(emptyCardOverview);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCards();
  }, [loadCards]);

  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Cartoes SQLite</p><h2>Fatura, compras e cashback persistidos</h2></div><span>Compras entram uma vez por parcela; pagamentos de fatura aparecem separados como movimentacao.</span></section>
      <section className="costs-toolbar">
        <select aria-label="Ano de Cartoes" value={year} onChange={(event) => setYear(event.target.value)}>{annualCostSheets.map((sheet) => <option key={sheet.year}>{sheet.year}</option>)}</select>
        <select aria-label="Periodo de Cartoes" value={month} onChange={(event) => setMonth(event.target.value)}>
          <option value="all">Ano inteiro</option>
          {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button onClick={() => void loadCards()}>Atualizar</button>
      </section>
      {error && <p className="error-banner">{error}</p>}
      {!loading && !error && !overview.hasPurchases && <p className="empty-dashboard">Nenhuma compra de cartao persistida neste periodo. BTG e Mercado Pago continuam listados com totais zerados.</p>}
      <section className="kpi-grid"><Kpi title="Fatura estimada" value={fmt(overview.summary.invoiceCents / 100)} /><Kpi title="Compras" value={fmt(overview.summary.purchaseCents / 100)} tone="blue" /><Kpi title="Faturas pagas" value={fmt(overview.summary.paymentCents / 100)} /><Kpi title="Cashback real" value={fmt(overview.summary.confirmedCashbackCents / 100)} tone="green" /><Kpi title="Cashback estimado" value={fmt(overview.summary.estimatedCashbackCents / 100)} tone="amber" /></section>
      <section className="split">
        <article className="panel"><div className="chart-head"><h3>Cartoes</h3><strong>{loading ? "Carregando..." : `${overview.cards.length} cartoes`}</strong></div><div className="simple-bars">{overview.cards.map((card) => <div key={card.id}><span>{card.name}{card.status === "HISTORICO" ? " (historico)" : ""}</span><i style={{ width: `${Math.max(4, (card.invoiceCents / Math.max(1, overview.summary.invoiceCents)) * 100)}%` }} /><b>{fmt(card.invoiceCents / 100)} · cashback {fmt(card.estimatedCashbackCents / 100)}</b></div>)}</div></article>
        <article className="panel"><div className="chart-head"><h3>Evolucao mensal</h3><strong>{fmt(overview.summary.invoiceCents / 100)}</strong></div><div className="month-bars labeled dashboard-bars">{overview.monthlyHistory.length ? overview.monthlyHistory.map((item) => <div key={item.month}><i style={{ height: `${Math.max(6, (item.invoiceCents / maxMonth) * 100)}%` }} /><span>{item.month.slice(5)}</span><b>{fmt(item.invoiceCents / 100)}</b></div>) : <p className="empty-state">Sem dados para grafico.</p>}</div></article>
      </section>
      <DataTable headers={["Fatura", "Data", "Cartao", "Descricao", "Parcela", "Valor"]} rows={overview.purchases.map((purchase) => [purchase.statementMonth, fmtDate(purchase.date), purchase.cardName, purchase.description, purchase.installmentNumber ? `${purchase.installmentNumber}/${purchase.totalInstallments}` : "1/1", fmt(purchase.amountCents / 100)])} />
      <DataTable headers={["Data", "Cartao", "Movimentacao", "Competencia", "Valor"]} rows={overview.movements.map((movement) => [fmtDate(movement.date), movement.cardName, movement.description, movement.competenceMonth, fmt(movement.amountCents / 100)])} />
      <DataTable headers={["Cartao", "Pagamento de fatura", "Cashback real", "Cashback estimado"]} rows={overview.cards.map((card) => [card.name, fmt(card.paymentCents / 100), fmt(card.confirmedCashbackCents / 100), fmt(card.estimatedCashbackCents / 100)])} />
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CardsView() {
  const invoice = cardRows.reduce((sum, row) => sum + row.value, 0);
  const reserved = cardRows.filter((row) => row.reserved).reduce((sum, row) => sum + row.value, 0);
  const earnings = cardYield.reduce((sum, row) => sum + row.box + row.cashback, 0);
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba Cartão</p><h2>Fatura, caixinha, cashback e lucro do mês</h2></div><span>Compra no cartão, dinheiro reservado na caixinha e ganho consolidado.</span></section>
      <section className="kpi-grid"><Kpi title="Total da fatura" value={fmt(invoice)} /><Kpi title="Valor reservado" value={fmt(reserved)} tone="green" /><Kpi title="Falta transferir" value={fmt(invoice - reserved)} tone="amber" /><Kpi title="Rendimento + cashback" value={fmt(earnings)} tone="blue" /></section>
      <section className="split">
        <DataTable headers={["Data", "Descrição", "Valor", "Transferido"]} rows={cardRows.map((row) => [fmtDate(row.date), row.desc, fmt(row.value), row.reserved ? "Sim" : "Não"])} />
        <DataTable headers={["Mês", "Rendimento", "Cashback", "Total"]} rows={cardYield.map((row) => [row.month, fmt(row.box), fmt(row.cashback), fmt(row.box + row.cashback)])} />
      </section>
    </>
  );
}

function InvestmentsConnectedView({ year }: { year: string }) {
  const [month, setMonth] = useState<string>("all");
  const [overview, setOverview] = useState<InvestmentOverview>(emptyInvestmentOverview());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dividendsByAsset = useMemo(() => {
    const totals = new Map<string, number>();
    for (const dividend of overview.dividends) {
      if (dividend.assetId) {
        totals.set(dividend.assetId, (totals.get(dividend.assetId) ?? 0) + dividend.amountCents);
      }
    }
    return totals;
  }, [overview.dividends]);

  const loadInvestments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextOverview = assertInvestmentOverview(await readJson(await fetch(`${localApiBaseUrl}/api/investments/overview?year=${year}&month=${month}`)));
      setOverview(nextOverview);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel carregar ativos.");
      setOverview(emptyInvestmentOverview());
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvestments();
  }, [loadInvestments]);

  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Ativos SQLite</p><h2>Ativos e proventos multi-moeda</h2></div><span>Brasil em BRL, EUA em USD e consolidado em BRL por cotacao registrada.</span></section>
      <section className="costs-toolbar">
        <select aria-label="Periodo de Ativos" value={month} onChange={(event) => setMonth(event.target.value)}>
          <option value="all">Ano inteiro</option>
          {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button onClick={() => void loadInvestments()}>Atualizar</button>
      </section>
      {error && <p className="error-banner">{error}</p>}
      {!loading && !error && !overview.hasAssets && <p className="empty-dashboard">Nenhum ativo persistido encontrado. Cadastre ou importe ativos em etapa futura para alimentar esta visao.</p>}
      {overview.alerts.length > 0 && <p className="error-banner">{overview.alerts.map((alert) => alert.message).join(" ")}</p>}
      <section className="kpi-grid">
        <Kpi title="Valor atual BRL" value={fmt(overview.totalsByCurrency.BRL.currentValueCents / 100)} tone="green" />
        <Kpi title="Valor atual USD" value={fmtCurrency(overview.totalsByCurrency.USD.currentValueCents / 100, "USD")} tone="blue" />
        <Kpi title="Consolidado BRL" value={fmt(overview.consolidatedBrl.currentValueCents / 100)} tone="violet" />
        <Kpi title="Proventos BRL" value={fmt(overview.totalsByCurrency.BRL.dividendsCents / 100)} />
        <Kpi title="Proventos USD" value={fmtCurrency(overview.totalsByCurrency.USD.dividendsCents / 100, "USD")} tone="amber" />
      </section>
      <section className="split wide-left">
        <DataTable headers={["Ticker", "Classe", "Moeda", "Qtd", "Preco medio", "Preco atual", "Valor atual", "Proventos"]} rows={overview.positions.map((asset) => [asset.ticker ?? asset.name, asset.assetClass, asset.currency, asset.quantityDecimal, asset.averagePriceDecimal ? fmtCurrency(Number(asset.averagePriceDecimal), asset.currency) : "-", asset.lastPriceDecimal ? fmtCurrency(Number(asset.lastPriceDecimal), asset.currency) : "-", asset.currentValueCents === null ? "Preco pendente" : fmtCurrency(asset.currentValueCents / 100, asset.currency), fmtCurrency((dividendsByAsset.get(asset.assetId) ?? 0) / 100, asset.currency)])} />
        <DataTable headers={["Data", "Ativo", "Moeda", "Valor", "Valor BRL"]} rows={overview.dividends.map((dividend) => [fmtDate(dividend.paymentDate), dividend.ticker ?? dividend.name ?? dividend.description, dividend.currency, fmtCurrency(dividend.amountCents / 100, dividend.currency), dividend.amountBrlCents === null ? "Cambio pendente" : fmt(dividend.amountBrlCents / 100)])} />
      </section>
      <p className="empty-state">{overview.exchangeRate.rateDecimal ? `USD/BRL ${overview.exchangeRate.rateDecimal} em ${fmtDate(overview.exchangeRate.referenceDate ?? "")} (${overview.exchangeRate.provider})` : "Cotacao USD/BRL nao cadastrada."}</p>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DividendsView({ rows }: { rows: typeof dividends }) {
  const monthly = months.map((_, index) => rows.reduce((total, row) => total + row.paid[index], 0));
  const totalPaid = sum(monthly);
  const { invested, market } = dividendTotals(rows);
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba mais importante</p><h2>FIIS, dividendos, cupons e proventos</h2></div><span>Ticker por ticker, preço médio, preço atual, recebido mês a mês, ano e yield.</span></section>
      <section className="kpi-grid"><Kpi title="Recebido no ano" value={fmt(totalPaid)} tone="green" /><Kpi title="Média mensal" value={fmt(totalPaid / 7)} /><Kpi title="Custo da carteira" value={fmt(invested)} /><Kpi title="Valor hoje" value={fmt(market)} tone="blue" /><Kpi title="Dividend yield" value={pct(totalPaid / invested)} tone="amber" /></section>
      <section className="split wide-left">
        <article className="panel"><div className="chart-head"><h3>Recebimento mensal</h3><strong>{fmt(totalPaid)}</strong></div><div className="month-bars labeled">{monthly.map((value, index) => <div key={months[index]}><i style={{ height: `${Math.max(10, value / 8)}%` }} /><span>{months[index]}</span><b>{fmt(value)}</b></div>)}</div></article>
        <article className="panel"><div className="chart-head"><h3>Por classe</h3><strong>FIIs · Ações · REITs · ETFs</strong></div><ClassBars /></article>
      </section>
      <article className="table-panel">
        <table className="data-table">
          <thead><tr>{["Ticker", "Tipo", "Preço médio", "Qtd", "Valor hoje", "Recebido ano", "DY custo"].map((head) => <th key={head}>{head}</th>)}</tr></thead>
          <tbody>{rows.map((row) => {
            const paid = row.paid.reduce((a, b) => a + b, 0);
            return <tr key={row.ticker}><th>{row.ticker}<span>{row.company}</span></th><td>{row.class}</td><td>{fmt(row.avg)}</td><td>{row.qty}</td><td>{fmt(row.now * row.qty)}</td><td>{fmt(paid)}</td><td>{pct(paid / (row.avg * row.qty))}</td></tr>;
          })}</tbody>
        </table>
      </article>
    </>
  );
}

function MatrixTable({ rows, totals }: { rows: { label: string; values: number[] }[]; totals: number[] }) {
  return <article className="table-panel"><table className="data-table matrix"><thead><tr><th>Despesa</th>{months.map((month) => <th key={month}>{month}</th>)}<th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td key={months[index]} className={value > 3000 ? "hot" : ""}>{value ? fmt(value) : "-"}</td>)}<td>{fmt(row.values.reduce((a, b) => a + b, 0))}</td></tr>)}<tr className="total-row"><th>Total</th>{totals.map((value, index) => <td key={months[index]}>{value ? fmt(value) : "-"}</td>)}<td>{fmt(totals.reduce((a, b) => a + b, 0))}</td></tr></tbody></table></article>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <article className="table-panel"><table className="data-table"><thead><tr>{headers.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex ? <td key={cell}>{cell}</td> : <th key={cell}>{cell}</th>)}</tr>)}</tbody></table></article>;
}

function LineChart({ values, labels = values.map((_, index) => String(index + 1)) }: { values: number[]; labels?: string[] }) {
  const max = Math.max(...values);
  return <div className="line-chart">{values.map((value, index) => <i key={index} style={{ height: `${(value / max) * 100}%` }}><span>{labels[index]} · {fmt(value)}</span></i>)}</div>;
}

function Allocation() {
  return <div className="allocation">{allocation.map((item) => <div key={item.name}><strong>{item.name}</strong><span>{fmt(item.amount)}</span><i><b style={{ width: `${item.current * 100}%` }} /></i><small>Atual {pct(item.current)} · Ideal {pct(item.target)}</small></div>)}</div>;
}

function ClassBars() {
  const data = [{ name: "FIIs", value: 86 }, { name: "Ações", value: 8 }, { name: "REITs", value: 4 }, { name: "ETFs", value: 2 }];
  return <div className="simple-bars">{data.map((item) => <div key={item.name}><span>{item.name}</span><i style={{ width: `${item.value}%` }} /><b>{item.value}%</b></div>)}</div>;
}
