"use client";

import { useMemo, useState } from "react";

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const menu = ["Custos", "Investimentos", "Cartões", "FIIS - Dividendos", "Consolidado"];
const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (value: number) => value.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });

const costs = [
  { item: "Agua", values: [78, 122, 84, 84, 89, 89, 81, 0, 0, 0, 0, 0] },
  { item: "Luz", values: [215, 214, 204, 139, 211, 217, 236, 0, 0, 0, 0, 0] },
  { item: "Telefone/Internet", values: [100, 100, 100, 100, 100, 100, 82, 0, 0, 0, 0, 0] },
  { item: "Cartão Mercado Pago", values: [3970, 3042, 0, 914, 2157, 0, 3071, 0, 0, 0, 0, 0] },
  { item: "Cartão Nubank", values: [31, 0, 0, 0, 0, 45, 45, 0, 0, 0, 0, 0] },
  { item: "99 Pay - Cintia Diversão", values: [100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0] },
  { item: "FIIS - AÇÕES - RENDA FIXA", values: [2900, 2816, 2400, 5900, 3300, 2600, 1300, 0, 0, 0, 0, 0] },
  { item: "Reserva de Oportunidade", values: [900, 900, 900, 900, 900, 900, 900, 0, 0, 0, 0, 0] },
  { item: "Livia - 18 anos", values: [100, 100, 100, 100, 100, 100, 100, 0, 0, 0, 0, 0] },
  { item: "Manutenção/Seguro/Carro", values: [5123, 400, 2807, 400, 437, 6240, 0, 0, 0, 0, 0, 0] },
  { item: "Combustivel/Carro", values: [0, 0, 0, 0, 1307, 6400, 0, 0, 0, 0, 0, 0] },
];

const investments = [
  { name: "Caixa", target: 0.3, current: 0.2555, amount: 50736 },
  { name: "Ações", target: 0.2, current: 0.2103, amount: 41761 },
  { name: "FIIs", target: 0.25, current: 0.3405, amount: 67616 },
  { name: "Exterior", target: 0.25, current: 0.1937, amount: 38464 },
];

const equityCurve = [12100, 25200, 44800, 73600, 109500, 148200, 195178];

const cardRows = [
  { date: "07/07/2026", desc: "Alexa Nossa", value: 399, reserved: true },
  { date: "07/07/2026", desc: "Alexa Analia", value: 279, reserved: true },
  { date: "14/07/2026", desc: "Cigarros", value: 150, reserved: true },
  { date: "16/07/2026", desc: "Pizza", value: 102, reserved: true },
  { date: "18/07/2026", desc: "Gasolina", value: 254, reserved: true },
  { date: "26/07/2026", desc: "Compras", value: 468, reserved: true },
  { date: "30/07/2026", desc: "Estacionamento", value: 25, reserved: true },
];

const cardYield = [
  { month: "Jan", box: 19.87, cashback: 0 },
  { month: "Fev", box: 30.49, cashback: 0 },
  { month: "Mar", box: 1.89, cashback: 0 },
  { month: "Jul", box: 0, cashback: 0 },
];

const dividends = [
  { ticker: "GGRC11", company: "Zagros Renda Imobiliária", class: "FII Logística", avg: 9.9, qty: 610, now: 9.89, paid: [60.2, 61, 61, 57.95, 61, 61, 61] },
  { ticker: "RBVA11", company: "Rio Bravo Renda Varejo", class: "FII Renda Urbana", avg: 10.26, qty: 750, now: 8.94, paid: [58.5, 63, 63, 63, 63, 63, 67.5] },
  { ticker: "GARE11", company: "Guardian Logística", class: "FII Híbrido", avg: 8.89, qty: 825, now: 8.17, paid: [58.1, 58.1, 58.1, 66.4, 66.4, 66.4, 68.47] },
  { ticker: "HSML11", company: "HSI Malls", class: "FII Shoppings", avg: 89.26, qty: 80, now: 86.6, paid: [52.5, 52.5, 52.5, 56, 56.8, 60, 60] },
  { ticker: "BRCO11", company: "Bresco Logística", class: "FII Logística", avg: 118.18, qty: 65, now: 114.3, paid: [56.55, 56.55, 59.8, 59.8, 61.75, 61.75, 68.25] },
  { ticker: "BTLG11", company: "BTG Pactual Logística", class: "FII Logística", avg: 100.94, qty: 70, now: 100.37, paid: [51.35, 52, 56, 56.7, 56.7, 56.7, 56.7] },
  { ticker: "KNCR11", company: "Kinea Imobiliários", class: "FII Papel", avg: 100.58, qty: 60, now: 107.6, paid: [78, 72, 60, 69, 66, 66, 66] },
  { ticker: "HFOF11", company: "Hedge Top", class: "FII FOF", avg: 6.9, qty: 900, now: 6.39, paid: [56, 56, 48, 51.12, 51.12, 51.12, 54] },
  { ticker: "RURA11", company: "Itaú Asset Rural", class: "FIAGRO", avg: 8.2, qty: 800, now: 8.16, paid: [82.5, 90, 90, 96, 90.4, 88, 88] },
];

export default function Home() {
  const [active, setActive] = useState("FIIS - Dividendos");
  const [year, setYear] = useState("2026");
  const [search, setSearch] = useState("");
  const selectedDividends = useMemo(() => dividends.filter((row) => row.ticker.toLowerCase().includes(search.toLowerCase()) || row.company.toLowerCase().includes(search.toLowerCase())), [search]);

  return (
    <main className="app-shell">
      <aside className="side-menu">
        <div className="brand-mark">CM</div>
        {menu.map((item) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}>{item}</button>)}
      </aside>
      <section className="workbench">
        <header className="topbar">
          <input aria-label="Pesquisar" placeholder="Pesquisar ticker, custo ou lançamento..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Ano" value={year} onChange={(event) => setYear(event.target.value)}>{["2020", "2021", "2022", "2023", "2024", "2025", "2026"].map((item) => <option key={item}>{item}</option>)}</select>
          <button className="primary">Importar Excel</button>
          <button>Exportar</button>
        </header>
        <Hero year={year} />
        {active === "Custos" && <CostsView year={year} />}
        {active === "Investimentos" && <InvestmentsView />}
        {active === "Cartões" && <CardsView />}
        {active === "FIIS - Dividendos" && <DividendsView rows={selectedDividends} />}
        {active === "Consolidado" && <ConsolidatedView />}
      </section>
    </main>
  );
}

function Hero({ year }: { year: string }) {
  const totalDividends = dividends.reduce((sum, row) => sum + row.paid.reduce((a, b) => a + b, 0), 0);
  const invested = dividends.reduce((sum, row) => sum + row.avg * row.qty, 0);
  return (
    <section className="overview">
      <div><p className="eyebrow">Controle financeiro pessoal</p><h1>Custo Mensal {year}</h1><span>Baseado nas abas reais da planilha: custos, investimentos, cartões, dividendos e consolidado.</span></div>
      <Kpi title="Patrimônio total" value={fmt(195178)} tone="blue" />
      <Kpi title="Dividendos 2026" value={fmt(totalDividends)} tone="green" />
      <Kpi title="Yield carteira" value={pct(totalDividends / invested)} tone="amber" />
      <Kpi title="Meta mensal" value={`${fmt(totalDividends / 7)} / ${fmt(300)}`} tone="violet" />
    </section>
  );
}

function Kpi({ title, value, tone = "neutral" }: { title: string; value: string; tone?: string }) {
  return <article className={`kpi ${tone}`}><span>{title}</span><strong>{value}</strong></article>;
}

function CostsView({ year }: { year: string }) {
  const totals = months.map((_, index) => costs.reduce((sum, row) => sum + row.values[index], 0));
  const max = Math.max(...totals);
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba Custos</p><h2>Onde o dinheiro está escoando</h2></div><span>Matriz anual de despesas por item, com totais e picos visíveis.</span></section>
      <article className="panel">
        <div className="chart-head"><h3>Total mensal {year}</h3><strong>{fmt(totals.reduce((a, b) => a + b, 0))}</strong></div>
        <div className="month-bars labeled">{months.map((month, index) => <div key={month}><i style={{ height: `${Math.max(6, (totals[index] / max) * 100)}%` }} /><span>{month}</span><b>{fmt(totals[index])}</b></div>)}</div>
      </article>
      <MatrixTable rows={costs.map((row) => ({ label: row.item, values: row.values }))} totals={totals} />
    </>
  );
}

function InvestmentsView() {
  const total = investments.reduce((sum, item) => sum + item.amount, 0);
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
        <DataTable headers={["Data", "Descrição", "Valor", "Transferido"]} rows={cardRows.map((row) => [row.date, row.desc, fmt(row.value), row.reserved ? "Sim" : "Não"])} />
        <DataTable headers={["Mês", "Rendimento", "Cashback", "Total"]} rows={cardYield.map((row) => [row.month, fmt(row.box), fmt(row.cashback), fmt(row.box + row.cashback)])} />
      </section>
    </>
  );
}

function DividendsView({ rows }: { rows: typeof dividends }) {
  const monthly = months.slice(0, 7).map((_, index) => rows.reduce((sum, row) => sum + row.paid[index], 0));
  const totalPaid = monthly.reduce((a, b) => a + b, 0);
  const invested = rows.reduce((sum, row) => sum + row.avg * row.qty, 0);
  const market = rows.reduce((sum, row) => sum + row.now * row.qty, 0);
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba mais importante</p><h2>FIIS, dividendos, cupons e proventos</h2></div><span>Ticker por ticker, preço médio, preço atual, recebido mês a mês, ano e yield.</span></section>
      <section className="kpi-grid"><Kpi title="Recebido no ano" value={fmt(totalPaid)} tone="green" /><Kpi title="Média mensal" value={fmt(totalPaid / 7)} /><Kpi title="Custo da carteira" value={fmt(invested)} /><Kpi title="Valor hoje" value={fmt(market)} tone="blue" /><Kpi title="Dividend yield" value={pct(totalPaid / invested)} tone="amber" /></section>
      <section className="split wide-left">
        <article className="panel"><div className="chart-head"><h3>Recebimento mensal</h3><strong>{fmt(totalPaid)}</strong></div><div className="month-bars">{monthly.map((value, index) => <div key={months[index]}><i style={{ height: `${Math.max(10, value / 8)}%` }} /><span>{months[index]}</span><b>{fmt(value)}</b></div>)}</div></article>
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

function ConsolidatedView() {
  return (
    <>
      <section className="section-head"><div><p className="eyebrow">Aba Consolidado</p><h2>Metas e composição CAFE</h2></div><span>Meta de dividendos, 100k investidos e 25% em ativos internacionais.</span></section>
      <section className="kpi-grid"><Kpi title="Meta dividendos" value={`${fmt(236)} / ${fmt(300)}`} tone="green" /><Kpi title="Meta patrimônio" value={`${fmt(195178)} / ${fmt(100000)}`} tone="blue" /><Kpi title="Exterior atual" value={pct(0.1937)} tone="amber" /><Kpi title="Aporte mensal" value={fmt(3400)} /></section>
      <article className="panel"><Allocation /></article>
    </>
  );
}

function MatrixTable({ rows, totals }: { rows: { label: string; values: number[] }[]; totals: number[] }) {
  return <article className="table-panel"><table className="data-table matrix"><thead><tr><th>Despesa</th>{months.map((month) => <th key={month}>{month}</th>)}<th>Total</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th>{row.label}</th>{row.values.map((value, index) => <td key={months[index]} className={value > 3000 ? "hot" : ""}>{value ? fmt(value) : "-"}</td>)}<td>{fmt(row.values.reduce((a, b) => a + b, 0))}</td></tr>)}<tr className="total-row"><th>Total</th>{totals.map((value, index) => <td key={months[index]}>{value ? fmt(value) : "-"}</td>)}<td>{fmt(totals.reduce((a, b) => a + b, 0))}</td></tr></tbody></table></article>;
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return <article className="table-panel"><table className="data-table"><thead><tr>{headers.map((head) => <th key={head}>{head}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => cellIndex ? <td key={cell}>{cell}</td> : <th key={cell}>{cell}</th>)}</tr>)}</tbody></table></article>;
}

function LineChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return <div className="line-chart">{values.map((value, index) => <i key={index} style={{ height: `${(value / max) * 100}%` }}><span>{fmt(value)}</span></i>)}</div>;
}

function Allocation() {
  return <div className="allocation">{investments.map((item) => <div key={item.name}><strong>{item.name}</strong><span>{fmt(item.amount)}</span><i><b style={{ width: `${item.current * 100}%` }} /></i><small>Atual {pct(item.current)} · Ideal {pct(item.target)}</small></div>)}</div>;
}

function ClassBars() {
  const data = [{ name: "FIIs", value: 86 }, { name: "Ações", value: 8 }, { name: "REITs", value: 4 }, { name: "ETFs", value: 2 }];
  return <div className="simple-bars">{data.map((item) => <div key={item.name}><span>{item.name}</span><i style={{ width: `${item.value}%` }} /><b>{item.value}%</b></div>)}</div>;
}
