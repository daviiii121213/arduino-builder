// Controle de tempo: cronômetro persistente e totais por categoria/projeto.
import { useEffect, useMemo, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { listAll, useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { Segmented } from "../../components/ui";
import { minutesLabel, startOfWeek, toISODate, toISODateTime } from "../../utils/format";
import type { ModuleViewProps, Rec } from "../types";
import { loadLS, removeLS, saveLS, useChanged } from "./common";

const KEY = "plu.timer.state";
interface Timer { startedAt: number | null; title: string; category: string; project: string }
const EMPTY: Timer = { startedAt: null, title: "", category: "", project: "" };

function Totals({ rows, label }: { rows: Array<[string, number]>; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="col">
      <h4 className="small">{label}</h4>
      {rows.length === 0 ? <span className="muted small">Sem registros no período.</span> : rows.map(([k, v]) => (
        <div key={k} className="hbar">
          <span className="ellipsis" title={k}>{k}</span>
          <div className="progress accent"><span style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="small" style={{ textAlign: "right" }}>{minutesLabel(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function TimeTrackerHeader(_: ModuleViewProps) {
  const { toast } = useApp();
  const [t, setT] = useState<Timer>(() => loadLS(KEY, EMPTY));
  const [now, setNow] = useState(Date.now());
  const [period, setPeriod] = useState<"semana" | "mes">("semana");
  const projects = useAsync(() => listAll("projects", "personal"), []);
  const from = period === "semana" ? toISODate(startOfWeek(new Date())) : toISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const sessions = useAsync(() => listAll("time_session", "personal", { from }), [from]);
  useChanged(sessions.reload);

  useEffect(() => saveLS(KEY, t), [t]);
  useEffect(() => {
    if (!t.startedAt) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [t.startedAt]);

  const elapsed = t.startedAt ? Math.max(0, now - t.startedAt) : 0;
  const hh = Math.floor(elapsed / 3600000), mm = Math.floor((elapsed % 3600000) / 60000), ss = Math.floor((elapsed % 60000) / 1000);

  const start = () => {
    if (!t.title.trim()) { toast("Informe a atividade antes de iniciar.", "error"); document.getElementById("tt-title")?.focus(); return; }
    setNow(Date.now());
    setT({ ...t, startedAt: Date.now() });
  };
  const stop = async () => {
    if (!t.startedAt) return;
    const minutes = Math.max(0.1, Math.round(((Date.now() - t.startedAt) / 60000) * 10) / 10);
    try {
      await call("rec.create", { entity: "time_session", scope: "personal", values: {
        title: t.title.trim(), category: t.category.trim() || null, ref_id: t.project || null,
        date_start: toISODateTime(new Date(t.startedAt)), date_end: toISODateTime(new Date()), amount: minutes,
      } });
      toast(`Sessão salva: ${minutesLabel(minutes)}.`);
      setT({ ...t, startedAt: null });
      removeLS(KEY);
      sessions.reload();
      window.dispatchEvent(new CustomEvent("plu:changed"));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const discard = () => { setT({ ...t, startedAt: null }); removeLS(KEY); };

  const { byCat, byProj, total } = useMemo(() => {
    const c = new Map<string, number>(), p = new Map<string, number>();
    let tot = 0;
    for (const s of sessions.data ?? []) {
      const m = Number(s.amount ?? 0);
      tot += m;
      const ck = s.category || "Sem categoria";
      c.set(ck, (c.get(ck) ?? 0) + m);
      const pk = s.ref_id ? projects.data?.find((x: Rec) => x.id === s.ref_id)?.title ?? "Projeto removido" : "Sem projeto";
      p.set(pk, (p.get(pk) ?? 0) + m);
    }
    const sort = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return { byCat: sort(c), byProj: sort(p), total: tot };
  }, [sessions.data, projects.data]);

  return (
    <div className="grid-2" style={{ marginBottom: 16 }}>
      <div className="card card-pad col">
        <h3 className="row"><Icon name="Timer" size={17} /> Cronômetro</h3>
        <div className="stopwatch" role="timer" aria-label="Tempo decorrido">{String(hh).padStart(2, "0")}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}</div>
        <div className="form-grid">
          <label className="field full"><span className="label">Atividade<span className="req">*</span></span><input id="tt-title" className="input" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="Ex.: Revisar relatório" /></label>
          <label className="field"><span className="label">Categoria</span><input className="input" value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })} placeholder="Ex.: Trabalho" /></label>
          <label className="field"><span className="label">Projeto</span>
            <select className="input" value={t.project} onChange={(e) => setT({ ...t, project: e.target.value })}>
              <option value="">— Nenhum —</option>
              {(projects.data ?? []).map((p: Rec) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
        </div>
        <div className="row">
          {t.startedAt ? (
            <>
              <button className="btn primary" onClick={stop}><Icon name="Square" size={15} /> Parar e salvar</button>
              <button className="btn ghost" onClick={discard}>Descartar</button>
            </>
          ) : <button className="btn primary" onClick={start}><Icon name="Play" size={15} /> Iniciar</button>}
        </div>
        <p className="muted tiny">O cronômetro continua contando mesmo se você trocar de tela.</p>
      </div>
      <div className="card card-pad col">
        <div className="row between">
          <h3>Totais · {minutesLabel(total)}</h3>
          <Segmented label="Período" value={period} onChange={setPeriod} options={[{ key: "semana", label: "Semana" }, { key: "mes", label: "Mês" }]} />
        </div>
        <Totals rows={byCat} label="Por categoria" />
        <Totals rows={byProj} label="Por projeto" />
      </div>
    </div>
  );
}
