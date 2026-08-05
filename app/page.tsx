const categories = [
  { name: "Mercado", value: 3180, color: "#22c55e", percent: 28 },
  { name: "Moradia", value: 2760, color: "#38bdf8", percent: 24 },
  { name: "Cartões", value: 2140, color: "#a78bfa", percent: 19 },
  { name: "Delivery", value: 1290, color: "#f97316", percent: 11 },
  { name: "Saúde", value: 980, color: "#fb7185", percent: 9 },
  { name: "Transporte", value: 860, color: "#facc15", percent: 8 },
];

const expenses = [
  ["Supermercado Vila", "Mercado", "BTG", "12/08", "R$ 486,20"],
  ["Aluguel", "Moradia", "Conta Inter", "10/08", "R$ 2.250,00"],
  ["iFood", "Delivery", "Nubank", "08/08", "R$ 92,40"],
  ["Posto Shell", "Transporte", "Mercado Pago", "07/08", "R$ 244,90"],
  ["Farmácia", "Saúde", "BTG", "05/08", "R$ 138,70"],
];

const cards = [
  { name: "BTG", spent: 3680, limit: 5000, due: "10", closing: "03" },
  { name: "Nubank", spent: 1840, limit: 3000, due: "15", closing: "08" },
  { name: "Mercado Pago", spent: 920, limit: 2200, due: "20", closing: "13" },
];

const budgets = [
  ["Mercado", 1500, 3180, "danger"],
  ["Lazer", 800, 620, "ok"],
  ["Saúde", 500, 420, "warn"],
  ["Delivery", 700, 1290, "danger"],
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,.22),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(59,130,246,.20),transparent_28%),linear-gradient(135deg,rgba(15,23,42,.10),transparent)]" />

      <aside className="atlas-sidebar">
        <div className="brand-mark">A</div>
        {["Visão", "Carteira", "Investimentos", "Custos", "Metas"].map((item) => (
          <span key={item} className={item === "Custos" ? "active" : ""}>
            {item}
          </span>
        ))}
      </aside>

      <section className="mx-auto max-w-7xl px-5 py-6 lg:pl-32">
        <header className="hero-card">
          <div>
            <p className="eyebrow">Atlas Financeiro · Novo módulo</p>
            <h1>Controle de Custos</h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--muted)] md:text-base">
              A lógica da planilha “Custo Mensal.xlsx” foi transformada em uma experiência moderna:
              categorias normalizadas, orçamento por categoria, cartões, recorrências, importação,
              exportação e Radar Financeiro em um só painel.
            </p>
          </div>
          <div className="hero-actions">
            <button>Importar Excel</button>
            <button className="secondary">Exportar PDF</button>
          </div>
        </header>

        <section className="filters-card">
          {["Pesquisar descrição, categoria, cartão ou valor", "Mês: Agosto", "Ano: 2026", "Cartão: Todos"].map((filter) => (
            <div key={filter} className="filter-pill">{filter}</div>
          ))}
        </section>

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
          <article className="panel col-span-7">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Gráficos</p>
                <h2>Gastos por categoria</h2>
              </div>
              <span className="status-dot">Atualizado da migração inicial</span>
            </div>
            <div className="category-chart">
              <div className="donut" />
              <div className="legend-list">
                {categories.map((cat) => (
                  <div key={cat.name} className="legend-row">
                    <i style={{ background: cat.color }} />
                    <span>{cat.name}</span>
                    <strong>R$ {cat.value.toLocaleString("pt-BR")}</strong>
                    <em>{cat.percent}%</em>
                  </div>
                ))}
              </div>
            </div>
          </article>

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

          <article className="panel col-span-8">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Lançamentos</p>
                <h2>CRUD com filtros e parcelamento</h2>
              </div>
              <button className="mini-button">Adicionar despesa</button>
            </div>
            <div className="expense-list">
              {expenses.map(([desc, cat, card, date, value]) => (
                <div className="expense-row" key={desc}>
                  <div>
                    <strong>{desc}</strong>
                    <span>{cat} · {card} · {date}</span>
                  </div>
                  <b>{value}</b>
                  <div className="row-actions">
                    <button>Editar</button>
                    <button>Duplicar</button>
                    <button>Excluir</button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel col-span-4">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Orçamentos</p>
                <h2>Alertas 80% / 100%</h2>
              </div>
            </div>
            {budgets.map(([name, limit, used, state]) => {
              const percent = Math.min(100, Math.round((Number(used) / Number(limit)) * 100));
              return (
                <div className="budget-row" key={name}>
                  <div>
                    <strong>{name}</strong>
                    <span>{percent}% usado</span>
                  </div>
                  <div className={`meter ${state}`}>
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </article>

          <article className="panel col-span-5">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Cartões</p>
                <h2>Fatura prevista</h2>
              </div>
            </div>
            {cards.map((card) => (
              <div className="card-row" key={card.name}>
                <div>
                  <strong>{card.name}</strong>
                  <span>Fecha dia {card.closing} · vence dia {card.due}</span>
                </div>
                <div className="card-limit">
                  <span>R$ {card.spent.toLocaleString("pt-BR")} / R$ {card.limit.toLocaleString("pt-BR")}</span>
                  <div><i style={{ width: `${Math.round((card.spent / card.limit) * 100)}%` }} /></div>
                </div>
              </div>
            ))}
          </article>

          <article className="panel col-span-7">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Evolução mensal · Heatmap · Metas</p>
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
            <div className="goal-chip">Meta: reduzir delivery · economia acumulada R$ 940</div>
          </article>
        </section>
      </section>
    </main>
  );
}
