// Meta: atualização rápida do valor atual e gráfico da evolução.
import { useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { Progress } from "../../components/ui";
import { fmtDate, num } from "../../utils/format";
import type { DetailProps, Rec } from "../types";

function Chart({ points, target }: { points: Array<{ d: string; v: number }>; target?: number | null }) {
  if (points.length < 1) return <p className="muted small">Ainda não há histórico. Cada atualização do valor atual gera um ponto no gráfico.</p>;
  const W = 480, H = 160, P = 28;
  const vals = points.map((p) => p.v).concat(target ? [target] : []);
  const max = Math.max(...vals, 1);
  const min = Math.min(0, ...vals);
  const x = (i: number) => P + (points.length === 1 ? (W - 2 * P) / 2 : (i / (points.length - 1)) * (W - 2 * P));
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Evolução da meta: ${points.map((p) => `${fmtDate(p.d)} ${num(p.v, 2)}`).join("; ")}`}>
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="var(--border-strong)" />
      {target ? <><line x1={P} x2={W - P} y1={y(target)} y2={y(target)} stroke="var(--accent)" strokeDasharray="5 4" /><text x={W - P} y={y(target) - 4} textAnchor="end" fontSize="10" fill="var(--accent)">alvo {num(target, 2)}</text></> : null}
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="3.5" fill="var(--primary)"><title>{`${fmtDate(p.d)}: ${num(p.v, 2)}`}</title></circle>)}
      <text x={P} y={H - 8} fontSize="10" fill="var(--text-3)">{fmtDate(points[0].d)}</text>
      <text x={W - P} y={H - 8} fontSize="10" fill="var(--text-3)" textAnchor="end">{fmtDate(points[points.length - 1].d)}</text>
    </svg>
  );
}

export function GoalDetail({ record, reload }: DetailProps) {
  const { toast } = useApp();
  const [val, setVal] = useState<string>(String(record.current_value ?? 0));
  const logs = useAsync(() => call<{ items: Rec[] }>("log.list", { entity: "goals", record_id: record.id }), [record.id, record.current_value]);
  const points = (logs.data?.items ?? []).filter((l) => l.kind === "progresso" && l.value !== null).reverse().map((l) => ({ d: l.created_at as string, v: Number(l.value) }));
  const canEdit = !!record.can_edit;
  const save = async (v: number) => {
    try {
      await call("rec.update", { entity: "goals", id: record.id, values: { current_value: v } });
      setVal(String(v));
      toast("Progresso atualizado.");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const target = record.target_value ? Number(record.target_value) : null;
  return (
    <section className="card card-pad col" aria-label="Progresso da meta">
      <div className="row between">
        <h3 className="row"><Icon name="Target" size={17} /> Progresso</h3>
        <b>{Math.round(Number(record.progress ?? 0))}%</b>
      </div>
      <Progress value={Number(record.progress ?? 0)} tone="accent" />
      <p className="muted small">
        Atual: <b>{num(record.current_value, 2)}</b>{target ? <> de <b>{num(target, 2)}</b></> : null} {record.indicator ?? ""}
        {record.milestones_total ? ` · ${record.milestones_done}/${record.milestones_total} marcos` : ""}
      </p>
      {canEdit && (
        <form className="row wrap" onSubmit={(e) => { e.preventDefault(); const n = Number(val.replace(",", ".")); if (!Number.isFinite(n)) { toast("Informe um número válido.", "error"); return; } save(n); }}>
          <label className="small" htmlFor={`gv-${record.id}`}>Novo valor atual</label>
          <input id={`gv-${record.id}`} className="input" type="number" step="0.01" style={{ width: 140 }} value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn primary">Atualizar</button>
          {[1, 5, 10].map((inc) => <button type="button" key={inc} className="btn sm" onClick={() => save(Number(record.current_value ?? 0) + inc)}>+{inc}</button>)}
        </form>
      )}
      <Chart points={points} target={target} />
    </section>
  );
}
