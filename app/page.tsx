"use client";

import { useMemo, useState } from "react";

const sheetTabs = ["Visão geral", "Lançamentos", "Orçamentos", "Cartões", "Categorias", "Metas", "Radar"];

const categories = [
  { name: "Mercado", value: 3180, color: "#22c55e", percent: 28 },
  { name: "Moradia", value: 2760, color: "#38bdf8", percent: 24 },
  { name: "Cartões", value: 2140, color: "#a78bfa", percent: 19 },
  { name: "Delivery", value: 1290, color: "#f97316", percent: 11 },
  { name: "Saúde", value: 980, color: "#fb7185", percent: 9 },
  { name: "Transporte", value: 860, color: "#facc15", percent: 8 },
];

const initialExpenses = [
  { desc: "Supermercado Vila", cat: "Mercado", card: "BTG", date: "12/08", value: 486.2 },
  { desc: "Aluguel", cat: "Moradia", card: "Conta Inter", date: "10/08", value: 2250 },
  { desc: "iFood", cat: "Delivery", card: "Nubank", date: "08/08", value: 92.4 },
  { desc: "Posto Shell", cat: "Transporte", card: "Mercado Pago", date: "07/08", value: 244.9 },
  { desc: "Farmácia", cat: "Saúde", card: "BTG", date: "05/08", value: 138.7 },
];

const cards = [
  { name: "BTG", spent: 3680, limit: 5000, due: "10", closing: "03" },
  { name: "Nubank", spent: 1840, limit: 3000, due: "15", closing: "08" },
  { name: "Mercado Pago", spent: 920, limit: 2200, due: "20", closing: "13" },
];

const budgets = [
  { name: "Mercado", limit: 1500, used: 3180, state: "danger" },
  { name: "Lazer", limit: 800, used: 620, state: "ok" },
  { name: "Saúde", limit: 500, used: 420, state: "warn" },
  { name: "Delivery", limit: 700, used: 1290, state: "danger" },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Home() {
  const [activeTab, setActiveTab] = useState("Visão geral");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("Aplicação pronta para receber a planilha real e gerar as abas automaticamente.");
  const [expenses, setExpenses] = useState(initialExpenses);

  const filteredExpenses = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return expenses;
    return expenses.filter((expense) =>
      [expense.desc, expense.cat, expense.card, String(expense.value)].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  }, [expenses, search]);

  function duplicateExpense(index: number) {
    const expense = filteredExpenses[index];
    setExpenses((current) => [{ ...expense, desc: `${expense.desc} (cópia)` }, ...current]);
    setNotice(`Lançamento "${expense.desc}" duplicado.`);
    setActiveTab("Lançamentos");
  }

  function deleteExpense(index: number) {
    const expense = filteredExpenses[index];
    setExpenses((current) => current.filter((item) => item !== expense));
    setNotice(`Lançamento "${expense.desc}" excluído da visualização.`);
  }

  function addExpense() {
    setExpenses((current) => [
      { desc: "Nova despesa", cat: "Categorias", card: "Conta principal", date: "Hoje", value: 0 },
      ...current,
    ]);
    setActiveTab("Lançamentos");
    setNotice("Nova despesa criada para edição futura.");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,.22),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,.20),transparent_28%),linear-gradient(135deg,rgba(15,23,42,.10),transparent)]" />

      <aside className="atlas-sidebar">
        <div className="brand-mark">C</div>
        {sheetTabs.map((item) => (
          <button key={item} className={item === activeTab ? "active" : ""} onClick={() => setActiveTab(item)}>
            {item}
          </button>
        ))}
      </aside>

      <section className="mx-auto max-w-7xl px-5 py-6 lg:pl-32">
        <header className="hero-card">
          <div>
            <p className="eyebrow">Controle de Custos · Módulo independente</p>
            <h1>Controle de Custos</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)] md:text-base">
              Aplicação organizada por abas, preparada para espelhar cada aba da planilha original
              com dados, totais e categorias condizentes após a nova importação do arquivo Excel.
            </p>
          </div>
          <div className="hero-actions">
            <button onClick={() => setNotice("Importação pronta: anexe novamente a planilha para mapear as abas reais.")}>
              Importar Excel
            </button>
            <button className="secondary" onClick={() => setNotice("Exportação simulada: CSV, Excel e PDF serão ligados aos dados reais.")}>
              Exportar PDF
            </button>
          </div>
        </header>

        <section className="filters-card">
          <input
            aria-label="Pesquisar lançamentos"
            className="filter-input"
            placeholder="Pesquisar descrição, categoria, cartão ou valor"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {["Mês: Agosto", "Ano: 2026", "Cartão: Todos"].map((filter) => (
            <button key={filter} className="filter-pill" onClick={() => setNotice(`Filtro selecionado: ${filter}`)}>
              {filter}
            </button>
          ))}
        </section>

        <div className="notice-card">{notice}</div>

        <nav className="tabs-bar" aria-label="Abas da aplicação">
          {sheetTabs.map((tab) => (
            <button key={tab} className={tab === activeTab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              {tab}
            </button>
          ))}
        </nav>

        {activeTab === "Visão geral" && <Overview />}
        {activeTab === "Lançamentos" && (
          <Expenses expenses={filteredExpenses} onAdd={addExpense} onDuplicate={duplicateExpense} onDelete={deleteExpense} />
        )}
        {activeTab === "Orçamentos" && <Budgets />}
        {activeTab === "Cartões" && <Cards />}
        {activeTab === "Categorias" && <Categories />}
        {activeTab === "Metas" && <Goals />}
        {activeTab === "Radar" && <Radar />}
      </section>
    </main>
  );
}

function Overview() {
  return (
    <>
      <section className="kpi-grid">
        {[
          ["Gasto do mês", "R$ 11.210", "+8% vs julho"],
          ["Gasto anual", "R$ 86.430", "72% do previsto"],
          ["Média mensal", "R$ 10.804", "base 8 meses"],
          ["Maior categoria", "Mercado", "R$ 3.180"],
          ["Maior cartão", "BTG", "74% do limite"],
          ["Saldo disponível", "R$ 5.760", "cartões + contas"],
          ["Economia do mês", "R$ 940", "meta acumulada"],
          ["Comparação", "+R$ 830", "mês anterior"],
        ].map(([title, value, note]) => (
          <article className="kpi-card" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>
      <section className="dashboard-grid">
        <CategoryPanel />
        <Radar />
        <Consolidated />
      </section>
    </>
  );
}

function CategoryPanel() {
  return (
    <article className="panel col-span-7">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Gráficos</p>
          <h2>Gastos por categoria</h2>
        </div>
        <span className="status-dot">Aguardando planilha real</span>
      </div>
      <div className="category-chart">
        <div className="donut" />
        <div className="legend-list">
          {categories.map((cat) => (
            <div key={cat.name} className="legend-row">
              <i style={{ background: cat.color }} />
              <span>{cat.name}</span>
              <strong>{formatCurrency(cat.value)}</strong>
              <em>{cat.percent}%</em>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function Expenses({
  expenses,
  onAdd,
  onDuplicate,
  onDelete,
}: {
  expenses: typeof initialExpenses;
  onAdd: () => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
}) {
  return (
    <section className="dashboard-grid">
      <article className="panel col-span-12">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Lançamentos</p>
            <h2>Adicionar, editar, excluir, duplicar e parcelar</h2>
          </div>
          <button className="mini-button" onClick={onAdd}>Adicionar despesa</button>
        </div>
        <div className="expense-list">
          {expenses.map((expense, index) => (
            <div className="expense-row" key={`${expense.desc}-${index}`}>
              <div>
                <strong>{expense.desc}</strong>
                <span>{expense.cat} · {expense.card} · {expense.date}</span>
              </div>
              <b>{formatCurrency(expense.value)}</b>
              <div className="row-actions">
                <button onClick={() => onAdd()}>Editar</button>
                <button onClick={() => onDuplicate(index)}>Duplicar</button>
                <button onClick={() => onDelete(index)}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function Budgets() {
  return (
    <section className="dashboard-grid">
      <article className="panel col-span-12">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Orçamentos</p>
            <h2>Controle por categoria</h2>
          </div>
        </div>
        {budgets.map((budget) => {
          const percent = Math.min(100, Math.round((budget.used / budget.limit) * 100));
          return (
            <div className="budget-row" key={budget.name}>
              <div>
                <strong>{budget.name}</strong>
                <span>{formatCurrency(budget.used)} de {formatCurrency(budget.limit)} · {percent}% usado</span>
              </div>
              <div className={`meter ${budget.state}`}>
                <i style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </article>
    </section>
  );
}

function Cards() {
  return (
    <section className="dashboard-grid">
      <article className="panel col-span-12">
        <div className="panel-head">
          <div>
            <p className="eyebrow">Cartões</p>
            <h2>Limite, fechamento, vencimento e fatura prevista</h2>
          </div>
        </div>
        {cards.map((card) => (
          <div className="card-row" key={card.name}>
            <div>
              <strong>{card.name}</strong>
              <span>Fecha dia {card.closing} · vence dia {card.due}</span>
            </div>
            <div className="card-limit">
              <span>{formatCurrency(card.spent)} / {formatCurrency(card.limit)}</span>
              <div><i style={{ width: `${Math.round((card.spent / card.limit) * 100)}%` }} /></div>
            </div>
          </div>
        ))}
      </article>
    </section>
  );
}

function Categories() {
  return (
    <section className="dashboard-grid">
      <CategoryPanel />
      <article className="panel col-span-5">
        <p className="eyebrow">Subcategorias</p>
        <h2>Mapeamento planejado</h2>
        <div className="radar-list">
          <p>Mercado: compras mensais, atacado, feira.</p>
          <p>Cartões: compras parceladas, assinaturas, fatura.</p>
          <p>Transporte: combustível, app, manutenção.</p>
        </div>
      </article>
    </section>
  );
}

function Goals() {
  return (
    <section className="dashboard-grid">
      <article className="panel col-span-12">
        <p className="eyebrow">Metas</p>
        <h2>Economia acumulada</h2>
        <div className="goal-chip">Meta: reduzir delivery · economia acumulada R$ 940</div>
        <div className="goal-chip">Meta: reduzir combustível · variação -15%</div>
      </article>
    </section>
  );
}

function Radar() {
  return (
    <article className="panel col-span-5">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Radar Financeiro</p>
          <h2>Sinais informativos</h2>
        </div>
      </div>
      <div className="radar-list">
        <p>Delivery ficou 18% acima da média dos últimos 3 meses.</p>
        <p>Mercado aumentou R$ 230 em relação a julho.</p>
        <p>O cartão BTG atingiu 74% do limite cadastrado.</p>
        <p>Saúde ficou abaixo da média mensal histórica.</p>
      </div>
    </article>
  );
}

function Consolidated() {
  return (
    <article className="panel col-span-7">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Evolução mensal · Heatmap</p>
          <h2>Visão consolidada</h2>
        </div>
      </div>
      <div className="bars">
        {[62, 74, 68, 81, 58, 92, 76, 88].map((height, index) => (
          <i key={index} style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="heatmap">
        {Array.from({ length: 35 }).map((_, index) => (
          <span key={index} className={`level-${(index * 7) % 5}`} />
        ))}
      </div>
    </article>
  );
}
