"use client";

import { useMemo, useState } from "react";

type Expense = {
  date: string;
  desc: string;
  cat: string;
  subcat: string;
  account: string;
  card: string;
  value: number;
  paid: boolean;
  note: string;
};

const menu = ["Dashboard", "Lançamentos", "Cartões", "Planejamento", "Relatórios", "Configurações"];
const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const categories = ["Mercado", "Combustível", "Moradia", "Saúde", "Lazer", "Cartões", "Investimentos", "Reserva", "Outros"];

const matrix = {
  Mercado: [1420, 1560, 1490, 1620, 1580, 1710, 1860, 1920, 1500, 1500, 1500, 1500],
  Combustível: [620, 580, 640, 610, 590, 720, 680, 760, 650, 650, 650, 650],
  Moradia: [2550, 2550, 2550, 2620, 2620, 2620, 2620, 2620, 2620, 2620, 2620, 2620],
  Saúde: [310, 420, 380, 260, 510, 340, 390, 420, 500, 500, 500, 500],
  Lazer: [720, 650, 810, 590, 780, 620, 710, 690, 800, 800, 800, 800],
  Cartões: [1840, 1920, 2110, 2050, 2180, 2240, 2310, 2420, 2100, 2100, 2100, 2100],
  Investimentos: [900, 900, 900, 900, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000],
  Reserva: [450, 500, 500, 500, 600, 600, 600, 600, 600, 600, 600, 600],
  Outros: [260, 310, 280, 340, 290, 330, 410, 380, 300, 300, 300, 300],
} as Record<string, number[]>;

const initialExpenses: Expense[] = [
  { date: "2026-08-12", desc: "Supermercado Vila", cat: "Mercado", subcat: "Compra mensal", account: "Conta Inter", card: "BTG", value: 486.2, paid: true, note: "Compra da semana" },
  { date: "2026-08-10", desc: "Aluguel", cat: "Moradia", subcat: "Fixo", account: "Conta Inter", card: "-", value: 2250, paid: true, note: "" },
  { date: "2026-08-08", desc: "iFood", cat: "Lazer", subcat: "Restaurante", account: "Conta Nubank", card: "Nubank", value: 92.4, paid: false, note: "Fim de semana" },
  { date: "2026-08-07", desc: "Posto Shell", cat: "Combustível", subcat: "Carro", account: "Conta principal", card: "Mercado Pago", value: 244.9, paid: true, note: "" },
  { date: "2026-08-05", desc: "Farmácia", cat: "Saúde", subcat: "Medicamentos", account: "Conta Inter", card: "BTG", value: 138.7, paid: true, note: "" },
];

const cards = [
  { name: "BTG", limit: 5000, used: 4520, closing: "03", due: "10", cashback: 84.3, boxProfit: 42.8, transferred: 650, pending: 320, invoice: 3980, future: 1240 },
  { name: "Nubank", limit: 3000, used: 1840, closing: "08", due: "15", cashback: 12.4, boxProfit: 0, transferred: 200, pending: 140, invoice: 1700, future: 620 },
  { name: "Mercado Pago", limit: 2200, used: 920, closing: "13", due: "20", cashback: 26.7, boxProfit: 18.2, transferred: 120, pending: 80, invoice: 840, future: 310 },
];

const quickActions = ["Mercado", "Combustível", "Restaurante", "Pix", "Cartão", "Receita"];
const fmt = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("Ago");
  const [year, setYear] = useState("2026");
  const [modalOpen, setModalOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState("Mercado");
  const [notice, setNotice] = useState("Dica: clique em uma célula da grade mensal para abrir os lançamentos daquela categoria e mês.");
  const [expenses, setExpenses] = useState(initialExpenses);

  const monthIndex = months.indexOf(selectedMonth);
  const monthExpense = categories.reduce((sum, cat) => sum + matrix[cat][monthIndex], 0);
  const revenue = 13200;
  const cardTotal = cards.reduce((sum, card) => sum + card.used, 0);
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return expenses.filter((expense) =>
      !term || Object.values(expense).join(" ").toLowerCase().includes(term),
    );
  }, [expenses, search]);

  function openNew(category = "Mercado") {
    setDraftCategory(category === "Restaurante" ? "Lazer" : category === "Pix" ? "Outros" : category === "Receita" ? "Receita" : category);
    setModalOpen(true);
  }

  function saveDraft() {
    setExpenses((current) => [
      { date: `${year}-08-15`, desc: "Novo lançamento", cat: draftCategory, subcat: "Rápido", account: "Conta principal", card: draftCategory === "Receita" ? "-" : "BTG", value: 0, paid: false, note: "Criado pelo atalho" },
      ...current,
    ]);
    setModalOpen(false);
    setActive("Lançamentos");
    setNotice("Lançamento criado. Edite direto na grade, como em uma planilha.");
  }

  function openCell(category: string, month: string) {
    setSelectedMonth(month);
    setActive("Lançamentos");
    setSearch(category);
    setNotice(`Exibindo lançamentos de ${category} em ${month}/${year}.`);
  }

  return (
    <main className="app-shell">
      <aside className="side-menu">
        <div className="brand-mark">C</div>
        {menu.map((item) => (
          <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}>
            {item}
          </button>
        ))}
      </aside>

      <section className="workbench">
        <header className="topbar">
          <input aria-label="Pesquisar lançamento" placeholder="Pesquisar lançamento..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select aria-label="Selecionar mês" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {months.map((month) => <option key={month}>{month}</option>)}
          </select>
          <select aria-label="Selecionar ano" value={year} onChange={(event) => setYear(event.target.value)}>
            {["2025", "2026", "2027"].map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="primary" onClick={() => openNew()}>+ Novo Lançamento</button>
          <button onClick={() => setNotice("Importação pronta para mapear as abas da planilha enviada.")}>Importar Excel</button>
          <button onClick={() => setNotice("Exportação Excel preparada para a grade atual.")}>Exportar Excel</button>
        </header>

        <div className="notice-card">{notice}</div>

        <section className="quick-actions">
          {quickActions.map((action) => (
            <button key={action} onClick={() => openNew(action)}>+ {action}</button>
          ))}
        </section>

        {active === "Dashboard" && (
          <Dashboard
            selectedMonth={selectedMonth}
            year={year}
            revenue={revenue}
            monthExpense={monthExpense}
            cardTotal={cardTotal}
            openCell={openCell}
          />
        )}
        {active === "Lançamentos" && <LaunchTable expenses={filtered} setExpenses={setExpenses} openNew={openNew} />}
        {active === "Cartões" && <CardsView />}
        {active === "Planejamento" && <Planning openCell={openCell} />}
        {active === "Relatórios" && <Reports />}
        {active === "Configurações" && <Settings />}
      </section>

      {modalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Novo lançamento">
          <form className="quick-modal" onSubmit={(event) => { event.preventDefault(); saveDraft(); }}>
            <div className="modal-head">
              <div>
                <p className="eyebrow">Cadastro rápido</p>
                <h2>Novo lançamento</h2>
              </div>
              <button type="button" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <label>Descrição<input defaultValue="Novo lançamento" /></label>
            <label>Categoria<select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)}>{[...categories, "Receita"].map((cat) => <option key={cat}>{cat}</option>)}</select></label>
            <label>Subcategoria<input defaultValue="Rápido" /></label>
            <label>Conta<input defaultValue="Conta principal" /></label>
            <label>Cartão<select defaultValue="BTG"><option>BTG</option><option>Nubank</option><option>Mercado Pago</option><option>-</option></select></label>
            <label>Valor<input type="number" defaultValue="0" /></label>
            <label>Data<input type="date" defaultValue="2026-08-15" /></label>
            <label className="check-row"><input type="checkbox" /> Pago?</label>
            <div className="modal-actions">
              <button type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button className="primary" type="submit">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Dashboard({ selectedMonth, year, revenue, monthExpense, cardTotal, openCell }: {
  selectedMonth: string;
  year: string;
  revenue: number;
  monthExpense: number;
  cardTotal: number;
  openCell: (category: string, month: string) => void;
}) {
  return (
    <>
      <section className="monthly-panel">
        <div>
          <p className="eyebrow">Painel mensal</p>
          <h1>{selectedMonth}/{year}</h1>
        </div>
        <div className="compact-kpis">
          <Kpi title="Receitas" value={fmt(revenue)} />
          <Kpi title="Despesas" value={fmt(monthExpense)} />
          <Kpi title="Saldo" value={fmt(revenue - monthExpense)} />
          <Kpi title="Economia" value={fmt(1000)} />
          <Kpi title="Cartões" value={fmt(cardTotal)} />
        </div>
        <div className="due-card">
          <strong>Próximos vencimentos</strong>
          <span>BTG em 3 dias · Nubank em 8 dias</span>
        </div>
        <div className="due-card">
          <strong>Resumo dos cartões</strong>
          <span>{cards.map((card) => `${card.name}: ${Math.round((card.used / card.limit) * 100)}%`).join(" · ")}</span>
        </div>
      </section>
      <MonthlyGrid openCell={openCell} />
      <section className="dashboard-grid">
        <CategoryChart />
        <MonthlyEvolution />
      </section>
    </>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return <article className="small-kpi"><span>{title}</span><strong>{value}</strong></article>;
}

function MonthlyGrid({ openCell }: { openCell: (category: string, month: string) => void }) {
  const totals = months.map((_, index) => categories.reduce((sum, cat) => sum + matrix[cat][index], 0));
  return (
    <article className="sheet-panel">
      <div className="sheet-title"><h2>Grade mensal por categoria</h2><span>Clique em qualquer célula</span></div>
      <div className="sheet-scroll">
        <table className="sheet-table">
          <thead><tr><th>Categoria</th>{months.map((month) => <th key={month}>{month}</th>)}</tr></thead>
          <tbody>
            {categories.map((cat) => (
              <tr key={cat}>
                <th>{cat}</th>
                {months.map((month, index) => (
                  <td key={month}><button onClick={() => openCell(cat, month)}>{fmt(matrix[cat][index])}</button></td>
                ))}
              </tr>
            ))}
            <tr className="total-row"><th>Total do mês</th>{totals.map((total, index) => <td key={months[index]}>{fmt(total)}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}

function LaunchTable({ expenses, setExpenses, openNew }: {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  openNew: (category?: string) => void;
}) {
  function update(index: number, field: keyof Expense, value: string | boolean) {
    setExpenses((current) => current.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: field === "value" ? Number(value) : value } : item,
    ));
  }

  return (
    <article className="sheet-panel">
      <div className="sheet-title"><h2>Lançamentos</h2><button className="primary" onClick={() => openNew()}>+ Novo</button></div>
      <div className="sheet-scroll">
        <table className="sheet-table editable">
          <thead><tr>{["Data", "Descrição", "Categoria", "Subcategoria", "Conta", "Cartão", "Valor", "Pago", "Observação"].map((head) => <th key={head}>{head}</th>)}</tr></thead>
          <tbody>
            {expenses.map((expense, index) => (
              <tr key={`${expense.desc}-${index}`}>
                <td><input value={expense.date} onChange={(e) => update(index, "date", e.target.value)} /></td>
                <td><input value={expense.desc} onChange={(e) => update(index, "desc", e.target.value)} /></td>
                <td><input value={expense.cat} onChange={(e) => update(index, "cat", e.target.value)} /></td>
                <td><input value={expense.subcat} onChange={(e) => update(index, "subcat", e.target.value)} /></td>
                <td><input value={expense.account} onChange={(e) => update(index, "account", e.target.value)} /></td>
                <td><input value={expense.card} onChange={(e) => update(index, "card", e.target.value)} /></td>
                <td><input type="number" value={expense.value} onChange={(e) => update(index, "value", e.target.value)} /></td>
                <td><input type="checkbox" checked={expense.paid} onChange={(e) => update(index, "paid", e.target.checked)} /></td>
                <td><input value={expense.note} onChange={(e) => update(index, "note", e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function CardsView() {
  return (
    <section className="cards-grid">
      {cards.map((card) => (
        <article className="credit-card" key={card.name}>
          <div className="card-header"><h2>{card.name}</h2><span>Vence dia {card.due}</span></div>
          <div className="limit-bar"><i style={{ width: `${Math.round((card.used / card.limit) * 100)}%` }} /></div>
          <div className="card-metrics">
            <Kpi title="Limite" value={fmt(card.limit)} />
            <Kpi title="Utilizado" value={fmt(card.used)} />
            <Kpi title="Disponível" value={fmt(card.limit - card.used)} />
            <Kpi title="Fechamento" value={`Dia ${card.closing}`} />
            <Kpi title="Cashback" value={fmt(card.cashback)} />
            <Kpi title="Lucro caixinha" value={fmt(card.boxProfit)} />
            <Kpi title="Transferido" value={fmt(card.transferred)} />
            <Kpi title="Pendente" value={fmt(card.pending)} />
            <Kpi title="Fatura prevista" value={fmt(card.invoice)} />
            <Kpi title="Parcelas futuras" value={fmt(card.future)} />
          </div>
        </article>
      ))}
    </section>
  );
}

function Planning({ openCell }: { openCell: (category: string, month: string) => void }) {
  return (
    <article className="sheet-panel">
      <div className="sheet-title"><h2>Planejamento anual</h2><span>Total anual · média mensal · comparação com ano anterior</span></div>
      <div className="sheet-scroll">
        <table className="sheet-table editable">
          <thead><tr><th>Categoria</th>{months.map((month) => <th key={month}>{month}</th>)}<th>Total anual</th><th>Média</th><th>Vs ano anterior</th></tr></thead>
          <tbody>
            {categories.map((cat) => {
              const annual = matrix[cat].reduce((sum, value) => sum + value, 0);
              return (
                <tr key={cat}>
                  <th>{cat}</th>
                  {months.map((month, index) => <td key={month}><button onClick={() => openCell(cat, month)}>{fmt(matrix[cat][index])}</button></td>)}
                  <td>{fmt(annual)}</td>
                  <td>{fmt(annual / 12)}</td>
                  <td>{cat.length % 2 ? "+6%" : "-3%"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function Reports() {
  return (
    <section className="dashboard-grid">
      <CategoryChart />
      <MonthlyEvolution />
      <article className="panel col-span-12"><p className="eyebrow">Alertas inteligentes</p><h2>Informativos</h2><div className="alert-list"><p>Mercado consumiu 82% do orçamento.</p><p>BTG atingiu 90% do limite.</p><p>Combustível acima da média dos últimos seis meses.</p><p>Próximo vencimento em três dias.</p></div></article>
    </section>
  );
}

function Settings() {
  return <article className="panel col-span-12"><p className="eyebrow">Configurações</p><h2>Mapeamento da planilha</h2><p className="muted">Área reservada para categorias, subcategorias, contas, cartões e importação das abas originais.</p></article>;
}

function CategoryChart() {
  return <article className="panel col-span-6"><p className="eyebrow">Gráfico</p><h2>Gastos por categoria</h2><div className="simple-bars">{categories.slice(0, 6).map((cat) => <div key={cat}><span>{cat}</span><i style={{ width: `${Math.min(100, matrix[cat][7] / 25)}%` }} /></div>)}</div></article>;
}

function MonthlyEvolution() {
  return <article className="panel col-span-6"><p className="eyebrow">Gráfico</p><h2>Evolução mensal</h2><div className="bars">{months.map((month, index) => <i key={month} title={month} style={{ height: `${45 + (index % 5) * 10}%` }} />)}</div></article>;
}
