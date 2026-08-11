"use client";

import { useMemo, useState } from "react";
import { allocation, annualCostSheets, cardRows, cardYield, dividends, dividendTotals, getYearSheet, hasDetailedExpenseRows, importIssues, monthlyTotals, months, sum } from "@/lib/finance-data";

const menu = ["Dashboard", "Custos", "Cartões", "Investimentos", "FIIS - Dividendos"];
const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (value: number) => value.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
};

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [year, setYear] = useState("2026");
  const [search, setSearch] = useState("");
  const selectedDividends = useMemo(() => dividends.filter((row) => row.ticker.toLowerCase().includes(search.toLowerCase()) || row.company.toLowerCase().includes(search.toLowerCase())), [search]);
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
        {active === "Investimentos" && <InvestmentsView />}
        {active === "Cartões" && <CardsView />}
        {active === "FIIS - Dividendos" && <DividendsView rows={selectedDividends} />}
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

function DashboardView({ year }: { year: number }) {
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
