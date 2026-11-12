// Finanças: resumo mensal com gráficos leves (SVG), lançamentos, orçamentos e contas.
// Organizador de registros: não faz recomendações de investimento nem promete resultados.
import { useState } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Loading, Progress, Tabs } from "../components/ui";
import { useAsync } from "../hooks/data";
import { getModule } from "../modules/registry";
import { ModulePage } from "../modules/ModulePage";
import { fmtMonth, money, monthNames } from "../utils/format";
import { cx } from "../utils/cx";
import type { Rec } from "../modules/types";

type Tab = "resumo" | "lancamentos" | "orcamentos" | "contas";

function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function MonthsChart({ months, current }: { months: Rec[]; current: string }) {
  // garante os 6 meses mesmo sem lançamentos
  const keys = Array.from({ length: 6 }, (_, i) => shiftMonth(current, i - 5));
  const rows = keys.map((k) => months.find((m) => m.month === k) ?? { month: k, income: 0, expense: 0 });
  const max = Math.max(1, ...rows.flatMap((r) => [r.income, r.expense]));
  const W = 560, H = 190, pad = 26, gw = (W - pad * 2) / rows.length;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H + 24}`} width="100%" role="img" aria-labelledby="fin-chart-title fin-chart-desc">
        <title id="fin-chart-title">Receitas e despesas dos últimos 6 meses</title>
        <desc id="fin-chart-desc">{rows.map((r) => `${fmtMonth(r.month)}: receitas ${money(r.income)}, despesas ${money(r.expense)}`).join("; ")}</desc>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={pad} x2={W - pad} y1={H - t * (H - 20)} y2={H - t * (H - 20)} stroke="var(--border)" strokeDasharray={t ? "4 4" : undefined} />
        ))}
        {rows.map((r, i) => {
          const x = pad + i * gw + gw * 0.18;
          const bw = gw * 0.3;
          const hi = (r.income / max) * (H - 20);
          const he = (r.expense / max) * (H - 20);
          const [y, m] = r.month.split("-").map(Number);
          return (
            <g key={r.month}>
              <rect x={x} y={H - hi} width={bw} height={Math.max(hi, 1)} rx={3} fill="var(--success)"><title>{`Receitas ${money(r.income)}`}</title></rect>
              <rect x={x + bw + 3} y={H - he} width={bw} height={Math.max(he, 1)} rx={3} fill="var(--danger)"><title>{`Despesas ${money(r.expense)}`}</title></rect>
              <text x={x + bw} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--text-3)" fontWeight={r.month === current ? 700 : 400}>
                {monthNames[m - 1].slice(0, 3)}/{String(y).slice(2)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="legend"><span className="row"><span className="dot" style={{ background: "var(--success)" }} /> Receitas</span><span className="row"><span className="dot" style={{ background: "var(--danger)" }} /> Despesas</span></figcaption>
    </figure>
  );
}

function Summary({ ws }: { ws: "personal" | "family" }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data, loading, error, reload } = useAsync(() => call<Rec>("finance.summary", { scope: ws, month }), [ws, month]);
  return (
    <div className="stack">
      <div className="toolbar" style={{ marginBottom: 0 }}>
        <button className="btn icon" aria-label="Mês anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}><Icon name="ChevronLeft" /></button>
        <input className="input" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} style={{ width: 170 }} aria-label="Mês" />
        <button className="btn icon" aria-label="Próximo mês" onClick={() => setMonth((m) => shiftMonth(m, 1))}><Icon name="ChevronRight" /></button>
        <h2 style={{ textTransform: "capitalize" }}>{fmtMonth(month)}</h2>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading || !data ? <Loading /> : (
        <>
          <div className="grid-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
            <div className="card card-pad stat"><span className="row"><Icon name="ArrowUpRight" size={16} style={{ color: "var(--success)" }} /> Receitas</span><b style={{ color: "var(--success)" }}>{money(data.income)}</b></div>
            <div className="card card-pad stat"><span className="row"><Icon name="ArrowDownRight" size={16} style={{ color: "var(--danger)" }} /> Despesas</span><b style={{ color: "var(--danger)" }}>{money(data.expense)}</b></div>
            <div className="card card-pad stat"><span className="row"><Icon name="Wallet" size={16} /> Saldo do mês</span><b style={{ color: data.balance < 0 ? "var(--danger)" : undefined }}>{money(data.balance)}</b></div>
            <div className="card card-pad stat"><span className="row"><Icon name="Receipt" size={16} /> Contas em aberto</span><b>{money(data.bills_open_amount)}</b><span>{data.bills_open} conta(s) até este mês</span></div>
          </div>
          <div className="grid-2">
            <section className="card">
              <div className="card-head"><h3><Icon name="BarChart3" size={17} /> Últimos 6 meses</h3></div>
              <div className="card-body"><MonthsChart months={data.months} current={month} /></div>
            </section>
            <section className="card">
              <div className="card-head"><h3><Icon name="Tag" size={17} /> Despesas por categoria</h3></div>
              <div className="card-body col" style={{ gap: 10 }}>
                {(data.by_category as Rec[]).length === 0 ? <p className="muted small">Nenhuma despesa neste mês.</p> : (data.by_category as Rec[]).map((c) => {
                  const pct = data.expense ? (c.amount / data.expense) * 100 : 0;
                  return (
                    <div key={c.category} className="hbar">
                      <span className="ellipsis" title={c.category}>{c.category}</span>
                      <Progress value={pct} tone="accent" label={`${c.category}: ${pct.toFixed(0)}% das despesas`} />
                      <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(c.amount)}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <section className="card">
            <div className="card-head"><h3><Icon name="PiggyBank" size={17} /> Orçamentos do mês</h3></div>
            <div className="card-body col" style={{ gap: 12 }}>
              {(data.budgets as Rec[]).length === 0 ? <p className="muted small">Nenhum orçamento definido. Crie orçamentos na aba “Orçamentos” para acompanhar limites por categoria.</p> : (data.budgets as Rec[]).map((b) => (
                <div key={b.id} className="col" style={{ gap: 4 }}>
                  <div className="row between small">
                    <b>{b.category}</b>
                    <span className="row">
                      {money(b.spent)} de {money(b.limit)}
                      <span className={cx("badge", b.status === "excedido" ? "danger" : b.status === "alerta" ? "warning" : "success")}>
                        {b.status === "excedido" ? "Excedido" : b.status === "alerta" ? "Atenção" : "Dentro do limite"} · {Math.round(b.percent)}%
                      </span>
                    </span>
                  </div>
                  <Progress value={b.percent} tone={b.status === "excedido" ? "danger" : b.status === "alerta" ? "warning" : "accent"} label={`Orçamento ${b.category}`} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function FinancePage() {
  const { workspace: ws, perm, can } = useApp();
  const [tab, setTab] = useState<Tab>("resumo");
  if (ws === "family" && !perm.family_id) {
    return <EmptyState icon="Users" title="Você ainda não participa de uma família" text="As finanças compartilhadas aparecem após criar ou entrar em uma família." />;
  }
  if (ws === "family" && !can("finance.view")) {
    return <EmptyState icon="Lock" title="Sem permissão" text="Você não tem permissão para visualizar as finanças da família. Fale com o administrador." />;
  }
  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="Wallet" size={22} /></div>
          <div>
            <h1>Finanças <span className={cx("badge", ws === "family" ? "accent" : "primary")} style={{ verticalAlign: "middle" }}>{ws === "family" ? "FAMÍLIA" : "PESSOAL"}</span></h1>
            <p>{ws === "family" ? "Receitas, despesas e contas da casa." : "Receitas, despesas, orçamentos e contas pessoais."}</p>
          </div>
        </div>
      </div>
      <div className="alert small" style={{ marginBottom: 14 }}>
        <Icon name="Info" size={16} />
        <span>Este módulo apenas organiza os registros financeiros que você informa. Ele não movimenta dinheiro, não se conecta a bancos e não faz recomendações de investimento.</span>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "resumo", label: "Resumo", icon: "BarChart3" }, { key: "lancamentos", label: "Lançamentos", icon: "Receipt" },
        { key: "orcamentos", label: "Orçamentos", icon: "PiggyBank" }, { key: "contas", label: ws === "family" ? "Contas da casa" : "Contas", icon: "Calendar" },
      ]} />
      {tab === "resumo" && <Summary key={ws} ws={ws} />}
      {tab === "lancamentos" && <ModulePage key={`t-${ws}`} mod={getModule("transactions")!} ws={ws} embedded />}
      {tab === "orcamentos" && <ModulePage key={`b-${ws}`} mod={getModule("budgets")!} ws={ws} embedded />}
      {tab === "contas" && <ModulePage key={`c-${ws}`} mod={getModule("bills")!} ws={ws} embedded />}
    </div>
  );
}
