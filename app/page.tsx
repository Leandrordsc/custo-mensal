"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { allocation, annualCostSheets, cardRows, cardYield, dividends, dividendTotals, getYearSheet, hasDetailedExpenseRows, importIssues, monthlyTotals, months, sum } from "@/lib/finance-data";
import { assertDashboardOverview, assertInvestmentOverview, dividendTotalForPosition, emptyInvestmentOverview, totalForCurrency, type DashboardOverview, type InvestmentOverview } from "@/lib/investment-view-model";

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
const assetTypeOptions = [
  { value: "ACAO", label: "Acao", currency: "BRL" as const, exchange: "B3", market: "BR" },
  { value: "FII", label: "FII", currency: "BRL" as const, exchange: "B3", market: "BR" },
  { value: "REIT", label: "REIT", currency: "USD" as const, exchange: "NYSE", market: "US" },
  { value: "ETF", label: "ETF internacional", currency: "USD" as const, exchange: "NASDAQ", market: "US" },
];

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
type InvestmentAssetOption = { id: string; ticker: string | null; name: string; assetClass: string; exchange: string | null; market: string | null; currency: string };
type InvestmentBases = { assets: InvestmentAssetOption[] };
type InvestmentOperationForm = {
  assetMode: "existente" | "novo";
  assetId: string;
  operationType: "COMPRA" | "VENDA";
  subtype: "APORTE" | "REINVESTIMENTO";
  ticker: string;
  name: string;
  assetClass: string;
  exchange: string;
  market: string;
  currency: "BRL" | "USD";
  quantity: string;
  unitPrice: string;
  otherCosts: string;
  date: string;
  competenceMonth: string;
  notes: string;
};
type InvestmentPriceForm = { assetId: string; price: string; currency: "BRL" | "USD"; quotedAt: string };
type InvestmentExchangeForm = { rate: string; referenceDate: string };

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

const emptyInvestmentOperationForm = (year: string): InvestmentOperationForm => ({
  assetMode: "existente",
  assetId: "",
  operationType: "COMPRA",
  subtype: "APORTE",
  ticker: "",
  name: "",
  assetClass: "FII",
  exchange: "B3",
  market: "BR",
  currency: "BRL",
  quantity: "",
  unitPrice: "",
  otherCosts: "",
  date: `${year}-01-01`,
  competenceMonth: `${year}-01`,
  notes: "",
});

const emptyInvestmentPriceForm = (): InvestmentPriceForm => ({
  assetId: "",
  price: "",
  currency: "BRL",
  quotedAt: new Date().toISOString().slice(0, 16),
});

const emptyInvestmentExchangeForm = (): InvestmentExchangeForm => ({
  rate: "",
  referenceDate: new Date().toISOString().slice(0, 10),
});

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [year, setYear] = useState("2026");
  const [search, setSearch] = useState("");
  const years = annualCostSheets.map((sheet) => String(sheet.year));
  const pageCopy: Record<string, { eyebrow: string; title: string; text: string }> = {
    Dashboard: { eyebrow: "Visao geral", title: "Controle financeiro pessoal", text: "Saidas, cartoes, investimentos, dividendos e pendencias sem dupla contagem." },
    Custos: { eyebrow: "Custos", title: "Despesas do mes", text: "Compras no cartao entram como despesa; pagamento de fatura fica separado." },
    [menu[2]]: { eyebrow: "Cartoes", title: "Faturas e cashback", text: "BTG, Mercado Pago e historico preservado com cashback real separado do estimado." },
    "Ativos e Proventos": { eyebrow: "Carteira", title: "Ativos e proventos", text: "Brasil em BRL, EUA em USD e consolidado em BRL quando houver cambio." },
  };
  const currentPage = pageCopy[active] ?? pageCopy.Dashboard;

  return (
    <main className="app-shell">
      <aside className="side-menu">
        <div className="brand-lockup"><div className="brand-mark">CM</div><div><strong>Custo Mensal</strong><span>Piloto local</span></div></div>
        {menu.map((item) => <button key={item} className={active === item ? "active" : ""} aria-current={active === item ? "page" : undefined} onClick={() => setActive(item)}>{item}</button>)}
      </aside>
      <section className="workbench">
        <header className="topbar">
          <div className="topbar-title"><strong>Custo Mensal</strong><span>SQLite local</span></div>
          <input aria-label="Pesquisar" placeholder="Pesquisar ticker, custo ou lançamento..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Ano" value={year} onChange={(event) => setYear(event.target.value)}>{years.map((item) => <option key={item}>{item}</option>)}</select>
          <button className="primary" disabled title="Importacao sera ativada na etapa de importacao">Importar Excel</button>
          <button disabled title="Exportacao fora do escopo desta etapa">Exportar</button>
        </header>
        <nav className="mobile-nav" aria-label="Navegacao principal">
          {menu.map((item) => <button key={item} className={active === item ? "active" : ""} aria-current={active === item ? "page" : undefined} onClick={() => setActive(item)}>{item}</button>)}
        </nav>
        <PageHeader {...currentPage} year={year} />
        {active === "Dashboard" && <DashboardView year={Number(year)} />}
        {active === "Custos" && <CostsView year={year} />}
        {active === "Cartões" && <CardsViewConnected />}
        {active === "Ativos e Proventos" && <InvestmentsConnectedView year={year} />}
      </section>
    </main>
  );
}

function Kpi({ title, value, tone = "neutral" }: { title: string; value: string; tone?: string }) {
  return <article className={`kpi ${tone}`}><span>{title}</span><strong>{value}</strong></article>;
}

function PageHeader({ eyebrow, title, text, year }: { eyebrow: string; title: string; text: string; year: string }) {
  return <section className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><span>{text}</span></div><Badge>{year}</Badge></section>;
}

function ActionHeader({ eyebrow, title, note, action }: { eyebrow: string; title: string; note: string; action?: ReactNode }) {
  return <section className="section-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><span>{note}</span></div>{action && <div className="section-actions">{action}</div>}</section>;
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function SectionBlock({ eyebrow, title, note, children }: { eyebrow: string; title: string; note?: string; children: ReactNode }) {
  return <section className="section-block"><div className="section-head compact"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{note && <span>{note}</span>}</div>{children}</section>;
}

function EmptyState({ title, action }: { title: string; action?: string }) {
  return <p className="empty-dashboard"><strong>{title}</strong>{action && <span>{action}</span>}</p>;
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Erro na API local.");
  }
  return body;
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

function parseDecimalInput(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isValidOptionalMoney(value: string) {
  return value.trim() === "" || parseDecimalInput(value) >= 0;
}

function decimalToInput(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function DashboardView({ year }: { year: number }) {
  const [month, setMonth] = useState<string>("all");
  const [dashboard, setDashboard] = useState<DashboardOverview>(emptyDashboardOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const maxMonth = Math.max(1, ...dashboard.monthlySeries.map((item) => Math.max(item.livingCostCents, item.cardPurchasesCents, item.pendingReviewCents)));
  const investmentBrl = totalForCurrency(dashboard.investments, "BRL");
  const investmentUsd = totalForCurrency(dashboard.investments, "USD");

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
      {!loading && !error && !dashboard.hasFinancialImpact && <EmptyState title={dashboard.hasTransactions ? "Sem impacto financeiro relevante no periodo." : "Nenhum lancamento persistido encontrado."} action={dashboard.hasTransactions ? "Revise classificacoes pendentes para decidir o que entra no Dashboard." : "Cadastre despesas na aba Custos para alimentar a visao consolidada."} />}
      <SectionBlock eyebrow="Resumo do mes" title="Saidas e entradas financeiras" note="Compras, aportes e proventos ficam separados.">
        <section className="kpi-grid"><Kpi title="Custo de vida" value={fmt(dashboard.summary.livingCostCents / 100)} /><Kpi title="Compras no cartao" value={fmt(dashboard.summary.cardPurchasesCents / 100)} tone="blue" /><Kpi title="Aportes novos" value={fmt(dashboard.summary.contributionsCents / 100)} tone="green" /><Kpi title="Dividendos" value={fmt(dashboard.summary.dividendsCents / 100)} tone="violet" /></section>
      </SectionBlock>
      <SectionBlock eyebrow="Cartoes" title="Compras e fatura" note="A compra compoe despesa; pagamento de fatura fica em movimentacoes.">
        <section className="kpi-grid"><Kpi title="Compras no cartao" value={fmt(dashboard.summary.cardPurchasesCents / 100)} tone="blue" /><Kpi title="Faturas pagas" value={fmt(dashboard.summary.invoicePaymentsCents / 100)} /><Kpi title="Cashback real" value={fmt(dashboard.summary.confirmedCashbackCents / 100)} tone="green" /><Kpi title="Cashback estimado" value={fmt(dashboard.summary.estimatedCashbackCents / 100)} tone="amber" /></section>
      </SectionBlock>
      <SectionBlock eyebrow="Investimentos" title="Patrimonio por moeda" note="USD permanece separado e so entra no consolidado quando existe cambio.">
        <section className="kpi-grid"><Kpi title="Patrimonio BRL" value={fmt(investmentBrl.currentValueCents / 100)} tone="green" /><Kpi title="Patrimonio USD" value={fmtCurrency(investmentUsd.currentValueCents / 100, "USD")} tone="blue" /><Kpi title="Consolidado em BRL" value={fmt(dashboard.investments.consolidatedBrl.currentValueCents / 100)} tone="violet" /><Kpi title="Proventos USD" value={fmtCurrency(investmentUsd.dividendsCents / 100, "USD")} tone="amber" /></section>
      </SectionBlock>
      <SectionBlock eyebrow="Proventos" title="Dividendos, cashback e rendimentos" note="Estimativas nao aumentam patrimonio confirmado.">
        <section className="kpi-grid"><Kpi title="Dividendos" value={fmt(dashboard.summary.dividendsCents / 100)} tone="violet" /><Kpi title="Cashback real" value={fmt(dashboard.summary.confirmedCashbackCents / 100)} tone="green" /><Kpi title="Cashback estimado" value={fmt(dashboard.summary.estimatedCashbackCents / 100)} tone="amber" /><Kpi title="Rendimentos" value={fmt(dashboard.summary.reserveEarningsCents / 100)} tone="blue" /></section>
      </SectionBlock>
      {dashboard.investments.hasPendingConversion && <p className="empty-state">Consolidado em BRL parcial: existem valores em moeda original sem conversao disponivel.</p>}
      {dashboard.investments.alerts.length > 0 && <p className="error-banner">{dashboard.investments.alerts.map((alert) => alert.message).join(" ")}</p>}
      <SectionBlock eyebrow="Evolucao" title="Meses e categorias" note="Leitura operacional para acompanhar tendencia e concentracao.">
      <section className="split wide-left">
        <article className="panel"><div className="chart-head"><h3>Evolucao mensal persistida</h3><strong>{loading ? "Carregando..." : `${dashboard.countableTransactionCount} relevantes`}</strong></div><div className="month-bars labeled dashboard-bars">{dashboard.monthlySeries.length ? dashboard.monthlySeries.map((item) => <div key={item.month}><i style={{ height: `${Math.max(6, (item.livingCostCents / maxMonth) * 100)}%` }} /><span>{item.month.slice(5)}</span><b>{fmt(item.livingCostCents / 100)}</b></div>) : <p className="empty-state">Sem dados para grafico.</p>}</div></article>
        <article className="panel"><div className="chart-head"><h3>Por categoria</h3><strong>{fmt(dashboard.summary.livingCostCents / 100)}</strong></div><div className="simple-bars">{dashboard.categories.length ? dashboard.categories.map((item) => <div key={item.category}><span>{item.category}</span><i style={{ width: `${Math.max(4, (item.amountCents / Math.max(1, dashboard.summary.livingCostCents)) * 100)}%` }} /><b>{fmt(item.amountCents / 100)}</b></div>) : <p className="empty-state">Sem despesas confirmadas.</p>}</div></article>
      </section>
      </SectionBlock>
      <SectionBlock eyebrow="Movimentacoes" title="Nao duplicar custo de vida" note="Fatura paga e transferencia interna sao movimentacoes, nao novas despesas.">
        <section className="kpi-grid"><Kpi title="Faturas pagas" value={fmt(dashboard.summary.invoicePaymentsCents / 100)} /><Kpi title="Transferencias internas" value={fmt(dashboard.summary.internalTransfersCents / 100)} /><Kpi title="Reservas e caixinhas" value={fmt(dashboard.summary.reserveTransfersCents / 100)} /><Kpi title="Reinvestimentos" value={fmt(dashboard.summary.reinvestmentsCents / 100)} /></section>
      </SectionBlock>
      <SectionBlock eyebrow="Pendencias" title="Itens para revisao" note="Valores pendentes ou rejeitados nao devem entrar como confirmados.">
        <section className="kpi-grid"><Kpi title="Pendentes" value={fmt(dashboard.summary.pendingReviewCents / 100)} tone="amber" /><Kpi title="Ignorados" value={fmt(dashboard.summary.ignoredCents / 100)} /><Kpi title="Rejeitados" value={fmt(dashboard.summary.rejectedCents / 100)} /></section>
      </SectionBlock>
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
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async (clearNotice = true) => {
    setLoading(true);
    setError(null);
    if (clearNotice) setNotice(null);
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
    setNotice(null);
    try {
      const response = await fetch(`${localApiBaseUrl}/api/costs/expenses${editingId ? `/${editingId}` : ""}`, {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      await readJson(response);
      setEditingId(null);
      setForm(emptyExpenseForm(year, month));
      setNotice(editingId ? "Despesa atualizada com sucesso." : "Despesa cadastrada com sucesso.");
      await loadData(false);
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
    setNotice(null);
    try {
      await readJson(await fetch(`${localApiBaseUrl}/api/costs/expenses/${id}/cancel`, { method: "POST" }));
      setNotice("Despesa cancelada com sucesso.");
      await loadData(false);
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
      {notice && <p className="success-banner">{notice}</p>}
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
      {!loading && !error && !overview.hasPurchases && <EmptyState title="Nenhuma compra de cartao persistida neste periodo." action="Cadastre compras em Custos usando meio Cartao; BTG e Mercado Pago permanecem listados." />}
      <section className="kpi-grid"><Kpi title="Fatura estimada" value={fmt(overview.summary.invoiceCents / 100)} /><Kpi title="Compras" value={fmt(overview.summary.purchaseCents / 100)} tone="blue" /><Kpi title="Faturas pagas" value={fmt(overview.summary.paymentCents / 100)} /><Kpi title="Cashback real" value={fmt(overview.summary.confirmedCashbackCents / 100)} tone="green" /><Kpi title="Cashback estimado" value={fmt(overview.summary.estimatedCashbackCents / 100)} tone="amber" /></section>
      <section className="split">
        <article className="panel"><div className="chart-head"><h3>Cartoes</h3><strong>{loading ? "Carregando..." : `${overview.cards.length} cartoes`}</strong></div><div className="simple-bars">{overview.cards.map((card) => <div key={card.id}><span>{card.name}{card.status === "HISTORICO" && <Badge tone="historico">Historico</Badge>}</span><i style={{ width: `${Math.max(4, (card.invoiceCents / Math.max(1, overview.summary.invoiceCents)) * 100)}%` }} /><b>{fmt(card.invoiceCents / 100)} · cashback {fmt(card.estimatedCashbackCents / 100)}</b></div>)}</div></article>
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
  const [activeTab, setActiveTab] = useState("Carteira");
  const [bases, setBases] = useState<InvestmentBases>({ assets: [] });
  const [overview, setOverview] = useState<InvestmentOverview>(emptyInvestmentOverview());
  const [operationForm, setOperationForm] = useState<InvestmentOperationForm>(() => emptyInvestmentOperationForm(year));
  const [priceForm, setPriceForm] = useState<InvestmentPriceForm>(() => emptyInvestmentPriceForm());
  const [exchangeForm, setExchangeForm] = useState<InvestmentExchangeForm>(() => emptyInvestmentExchangeForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const overviewBrl = totalForCurrency(overview, "BRL");
  const overviewUsd = totalForCurrency(overview, "USD");
  const selectedPriceAsset = bases.assets.find((asset) => asset.id === priceForm.assetId);
  const matchingOperationAsset = bases.assets.find((asset) => {
    const query = operationForm.ticker.trim().toUpperCase();
    return query && asset.assetClass === operationForm.assetClass && [asset.ticker, asset.name].some((value) => value?.toUpperCase() === query);
  });
  const filteredOperationAssets = bases.assets.filter((asset) => asset.assetClass === operationForm.assetClass);
  const operationCurrency = (matchingOperationAsset?.currency as "BRL" | "USD" | undefined) ?? operationForm.currency;

  function startNewAssetFlow() {
    setActiveTab("Operacoes");
    setOperationForm((current) => ({ ...current, assetMode: "novo", assetId: "", ticker: "", name: "", operationType: "COMPRA", subtype: "APORTE" }));
  }

  function setOperationAssetType(assetClass: string) {
    const defaults = assetTypeOptions.find((option) => option.value === assetClass) ?? assetTypeOptions[0];
    setOperationForm((current) => ({ ...current, assetClass, currency: defaults.currency, exchange: defaults.exchange, market: defaults.market, assetId: "", ticker: "", name: "" }));
  }

  const loadInvestments = useCallback(async (clearNotice = true) => {
    setLoading(true);
    setError(null);
    if (clearNotice) setNotice(null);
    try {
      const [basesResponse, overviewResponse] = await Promise.all([
        fetch(`${localApiBaseUrl}/api/investments/bases`),
        fetch(`${localApiBaseUrl}/api/investments/overview?year=${year}&month=${month}`),
      ]);
      const nextBases = await readJson(basesResponse) as InvestmentBases;
      const nextOverview = assertInvestmentOverview(await readJson(overviewResponse));
      setBases(nextBases);
      setOverview(nextOverview);
      setOperationForm((current) => ({ ...current, assetId: current.assetId || nextBases.assets[0]?.id || "" }));
      setPriceForm((current) => ({ ...current, assetId: current.assetId || nextBases.assets[0]?.id || "", currency: (nextBases.assets.find((asset) => asset.id === (current.assetId || nextBases.assets[0]?.id))?.currency as "BRL" | "USD" | undefined) ?? current.currency }));
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

  async function submitOperation(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const grossAmount = parseDecimalInput(operationForm.quantity) * parseDecimalInput(operationForm.unitPrice);
      if (!isValidOptionalMoney(operationForm.otherCosts)) {
        throw new Error("Outros custos deve ser zero ou positivo.");
      }
      const totalAmount = decimalToInput(grossAmount + (operationForm.operationType === "COMPRA" ? parseDecimalInput(operationForm.otherCosts) : 0));
      const operationAsset = matchingOperationAsset;
      const payload = {
        assetId: operationAsset ? operationAsset.id : null,
        asset: operationAsset ? null : {
          ticker: operationForm.ticker,
          name: operationForm.name || operationForm.ticker,
          assetClass: operationForm.assetClass,
          exchange: operationForm.exchange,
          market: operationForm.market,
          currency: operationForm.currency,
        },
        operationType: operationForm.operationType,
        subtype: operationForm.subtype,
        quantity: operationForm.quantity,
        unitPrice: operationForm.unitPrice,
        totalAmount,
        date: operationForm.date,
        competenceMonth: operationForm.competenceMonth,
        notes: operationForm.notes,
      };
      await readJson(await fetch(`${localApiBaseUrl}/api/investments/operations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }));
      setOperationForm(emptyInvestmentOperationForm(year));
      setNotice("Operacao registrada com sucesso.");
      await loadInvestments(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel salvar operacao.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPrice(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await readJson(await fetch(`${localApiBaseUrl}/api/investments/prices`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...priceForm, quotedAt: new Date(priceForm.quotedAt).toISOString(), provider: "manual" }) }));
      setPriceForm(emptyInvestmentPriceForm());
      setNotice("Preco manual salvo com sucesso.");
      await loadInvestments(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel salvar preco.");
    } finally {
      setSaving(false);
    }
  }

  async function submitExchange(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await readJson(await fetch(`${localApiBaseUrl}/api/investments/exchange-rates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ baseCurrency: "USD", quoteCurrency: "BRL", rate: exchangeForm.rate, referenceDate: exchangeForm.referenceDate, provider: "manual" }) }));
      setExchangeForm(emptyInvestmentExchangeForm());
      setNotice("Cambio USD/BRL salvo com sucesso.");
      await loadInvestments(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Nao foi possivel salvar cambio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <ActionHeader
        eyebrow="Ativos SQLite"
        title="Ativos e proventos multi-moeda"
        note="Brasil em BRL, EUA em USD e consolidado em BRL por cotacao registrada."
        action={<button className="primary inline-action" onClick={startNewAssetFlow} disabled={loading || Boolean(error)}>Incluir ativo</button>}
      />
      <section className="costs-toolbar">
        <select aria-label="Periodo de Ativos" value={month} onChange={(event) => setMonth(event.target.value)}>
          <option value="all">Ano inteiro</option>
          {monthOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button onClick={() => void loadInvestments()}>Atualizar</button>
      </section>
      {error && <p className="error-banner">{error}</p>}
      {notice && <p className="success-banner">{notice}</p>}
      <div className="tabs" role="tablist" aria-label="Abas de Ativos e Proventos">
        {["Carteira", "Operacoes", "Cotacoes", "Cambio", "Proventos"].map((tab) => <button key={tab} role="tab" aria-selected={activeTab === tab} aria-controls={`ativos-panel-${tab.toLowerCase()}`} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}
      </div>
      {!loading && !error && !overview.hasAssets && <div className="empty-dashboard actionable"><strong>Nenhum ativo persistido encontrado.</strong><span>Comece cadastrando o ativo e a primeira compra no mesmo formulario.</span><button className="primary inline-action" onClick={startNewAssetFlow}>Incluir primeiro ativo</button></div>}
      {overview.alerts.length > 0 && <p className="error-banner">{overview.alerts.map((alert) => alert.message).join(" ")}</p>}
      <section className="kpi-grid">
        <Kpi title="Valor atual BRL" value={fmt(overviewBrl.currentValueCents / 100)} tone="green" />
        <Kpi title="Valor atual USD" value={fmtCurrency(overviewUsd.currentValueCents / 100, "USD")} tone="blue" />
        <Kpi title="Consolidado BRL" value={fmt(overview.consolidatedBrl.currentValueCents / 100)} tone="violet" />
        <Kpi title="Proventos BRL" value={fmt(overviewBrl.dividendsCents / 100)} />
        <Kpi title="Proventos USD" value={fmtCurrency(overviewUsd.dividendsCents / 100, "USD")} tone="amber" />
      </section>
      {overview.hasPendingConversion && <p className="empty-state">Consolidado BRL parcial: existem valores em moeda original sem conversao disponivel.</p>}
      {activeTab === "Operacoes" && <section className="split wide-left" role="tabpanel" id="ativos-panel-operacoes">
        <article className="panel">
          <div className="chart-head"><h3>Compra / Venda</h3><strong>{matchingOperationAsset ? "Ativo existente" : "Novo ativo"}</strong></div>
          <form className="expense-form" onSubmit={(event) => void submitOperation(event)}>
            <label>Operacao<select value={operationForm.operationType} onChange={(event) => setOperationForm({ ...operationForm, operationType: event.target.value as "COMPRA" | "VENDA" })}><option value="COMPRA">Compra</option><option value="VENDA">Venda</option></select></label>
            <label>Tipo de ativo<select value={operationForm.assetClass} onChange={(event) => setOperationAssetType(event.target.value)}>{assetTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="full-row">Selecionar o ativo<input list="operation-assets" value={operationForm.ticker} onChange={(event) => {
              const ticker = event.target.value.toUpperCase();
              const exists = bases.assets.some((asset) => asset.assetClass === operationForm.assetClass && [asset.ticker, asset.name].some((value) => value?.toUpperCase() === ticker));
              setOperationForm({ ...operationForm, ticker, assetMode: exists ? "existente" : "novo" });
            }} placeholder={operationForm.assetClass === "FII" ? "Digite MXR... para MXRF11" : "Digite IT... para ITUB4"} required /><datalist id="operation-assets">{filteredOperationAssets.map((asset) => <option key={asset.id} value={asset.ticker ?? asset.name}>{asset.name}</option>)}</datalist><small>{matchingOperationAsset ? `${matchingOperationAsset.name} encontrado na carteira.` : "Se nao existir, o ativo sera criado com esse ticker."}</small></label>
            {operationForm.operationType === "COMPRA" && <label>Subtipo<select value={operationForm.subtype} onChange={(event) => setOperationForm({ ...operationForm, subtype: event.target.value as "APORTE" | "REINVESTIMENTO" })}><option value="APORTE">Aporte</option><option value="REINVESTIMENTO">Reinvestimento</option></select></label>}
            <label>Quantidade<input value={operationForm.quantity} onChange={(event) => setOperationForm({ ...operationForm, quantity: event.target.value })} placeholder="10,5" required /></label>
            <label>Preco unitario<span className="money-input"><b>{operationCurrency === "USD" ? "US$" : "R$"}</b><input inputMode="decimal" value={operationForm.unitPrice} onChange={(event) => setOperationForm({ ...operationForm, unitPrice: event.target.value })} placeholder="100,00" required /></span></label>
            {operationForm.operationType === "COMPRA" && <label>Outros custos<small>Corretagem, taxas ou impostos da compra.</small><span className="money-input"><b>{operationCurrency === "USD" ? "US$" : "R$"}</b><input inputMode="decimal" value={operationForm.otherCosts} onChange={(event) => setOperationForm({ ...operationForm, otherCosts: event.target.value })} placeholder="0,00" /></span></label>}
            <label>Data<input type="date" value={operationForm.date} onChange={(event) => setOperationForm({ ...operationForm, date: event.target.value })} required /></label>
            <label>Competencia<input value={operationForm.competenceMonth} onChange={(event) => setOperationForm({ ...operationForm, competenceMonth: event.target.value })} placeholder="2026-08" required /></label>
            <label>Observacao<input value={operationForm.notes} onChange={(event) => setOperationForm({ ...operationForm, notes: event.target.value })} placeholder="opcional" /></label>
            <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Cadastrar operacao"}</button>
          </form>
        </article>
      </section>}
      {(activeTab === "Cotacoes" || activeTab === "Cambio") && <section className="single-panel" role="tabpanel" id={`ativos-panel-${activeTab.toLowerCase()}`}>
        {activeTab === "Cotacoes" && <article className="panel">
          <div className="chart-head"><h3>Dados de mercado</h3><strong>Preco e cambio</strong></div>
          <form className="expense-form" onSubmit={(event) => void submitPrice(event)}>
            <label>Ativo<select value={priceForm.assetId} onChange={(event) => {
              const asset = bases.assets.find((item) => item.id === event.target.value);
              setPriceForm({ ...priceForm, assetId: event.target.value, currency: (asset?.currency as "BRL" | "USD" | undefined) ?? priceForm.currency });
            }} required><option value="">Selecione</option>{bases.assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.ticker ?? asset.name} - {asset.currency}</option>)}</select></label>
            <label>Moeda<input value={selectedPriceAsset?.currency ?? priceForm.currency} readOnly /></label>
            <label>Preco atual<span className="money-input"><b>{(selectedPriceAsset?.currency ?? priceForm.currency) === "USD" ? "US$" : "R$"}</b><input inputMode="decimal" value={priceForm.price} onChange={(event) => setPriceForm({ ...priceForm, price: event.target.value })} required /></span></label>
            <label>Data/hora<input type="datetime-local" value={priceForm.quotedAt} onChange={(event) => setPriceForm({ ...priceForm, quotedAt: event.target.value })} required /></label>
            <button className="primary" disabled={saving || bases.assets.length === 0}>{saving ? "Salvando..." : "Salvar preco manual"}</button>
          </form>
        </article>}
        {activeTab === "Cambio" && <article className="panel">
          <div className="chart-head"><h3>Cambio manual</h3><strong>USD/BRL</strong></div>
          <form className="expense-form" onSubmit={(event) => void submitExchange(event)}>
            <label>Par<input value="USD/BRL" readOnly /></label>
            <label>Taxa<span className="money-input"><b>R$</b><input inputMode="decimal" value={exchangeForm.rate} onChange={(event) => setExchangeForm({ ...exchangeForm, rate: event.target.value })} placeholder="5,40" required /></span></label>
            <label>Referencia<input type="date" value={exchangeForm.referenceDate} onChange={(event) => setExchangeForm({ ...exchangeForm, referenceDate: event.target.value })} required /></label>
            <button className="primary" disabled={saving}>{saving ? "Salvando..." : "Salvar cambio USD/BRL"}</button>
          </form>
          <p className="empty-state">{overview.exchangeRate.rateDecimal ? `USD/BRL ${overview.exchangeRate.rateDecimal} em ${fmtDate(overview.exchangeRate.referenceDate ?? "")} (${overview.exchangeRate.provider})` : "Cotacao USD/BRL nao cadastrada."}</p>
        </article>}
      </section>}
      {activeTab === "Carteira" && <section className="split wide-left" role="tabpanel" id="ativos-panel-carteira">
        {overview.positions.length ? <DataTable headers={["Ticker", "Classe", "Moeda", "Qtd", "Preco medio", "Preco atual", "Valor atual", "Proventos"]} rows={overview.positions.map((asset) => [asset.ticker ?? asset.name, asset.assetClass, asset.currency, asset.quantityDecimal, asset.averagePriceDecimal ? fmtCurrency(Number(asset.averagePriceDecimal), asset.currency) : "-", asset.lastPriceDecimal ? fmtCurrency(Number(asset.lastPriceDecimal), asset.currency) : "-", asset.currentValueCents === null ? "Preco pendente" : fmtCurrency(asset.currentValueCents / 100, asset.currency), fmtCurrency(dividendTotalForPosition(overview, asset.assetId, asset.currency) / 100, asset.currency)])} /> : <EmptyState title="Carteira sem posicoes confirmadas." action="Use Operacoes para cadastrar uma compra manual." />}
      </section>}
      {activeTab === "Proventos" && <section className="split wide-left" role="tabpanel" id="ativos-panel-proventos">
        {overview.dividends.length ? <DataTable headers={["Data", "Ativo", "Moeda", "Valor", "Valor BRL"]} rows={overview.dividends.map((dividend) => [fmtDate(dividend.paymentDate), dividend.ticker ?? dividend.name ?? dividend.description, dividend.currency, fmtCurrency(dividend.amountCents / 100, dividend.currency), dividend.amountBrlCents === null ? "Cambio pendente" : fmt(dividend.amountBrlCents / 100)])} /> : <EmptyState title="Nenhum provento registrado." action="Dividendos confirmados aparecerao aqui quando existirem eventos financeiros." />}
      </section>}
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
  return <article className="table-panel"><table className="data-table"><thead><tr>{headers.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex ? <td key={`${index}-${cellIndex}`}>{cell}</td> : <th key={`${index}-${cellIndex}`}>{cell}</th>)}</tr>)}</tbody></table></article>;
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
