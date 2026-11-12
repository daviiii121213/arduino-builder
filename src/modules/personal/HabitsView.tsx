// Hábitos: grade de 14 dias com registro diário, sequência, consistência e calendário mensal.
import { useCallback, useMemo, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { EmptyState, ErrorState, Loading } from "../../components/ui";
import { addDays, monthNames, toISODate, today, weekdayShort } from "../../utils/format";
import { emptyArt } from "../../assets";
import type { ModuleViewProps, Rec } from "../types";
import { useChanged, useRecordPanels } from "./common";

function scheduled(h: Rec, d: Date): boolean {
  if (h.frequency === "dias" && Array.isArray(h.weekdays) && h.weekdays.length) return h.weekdays.includes(d.getDay());
  return true;
}

function MonthCalendar({ habit, onToggle }: { habit: Rec; onToggle: (date: string) => void }) {
  const now = new Date();
  const [offset, setOffset] = useState(0); // 0 = mês atual; até -2 (histórico disponível de 90 dias)
  const base = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const first = base.getDay();
  const days = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const logs: string[] = habit.logs ?? [];
  const t = today();
  const cells: Array<Date | null> = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(base.getFullYear(), base.getMonth(), i + 1))];
  const done = cells.filter((d) => d && logs.includes(toISODate(d))).length;
  return (
    <div className="card card-pad col" aria-label={`Calendário do hábito ${habit.title}`}>
      <div className="row between">
        <button className="btn icon sm ghost" aria-label="Mês anterior" disabled={offset <= -2} onClick={() => setOffset(offset - 1)}><Icon name="ChevronLeft" size={16} /></button>
        <b>{monthNames[base.getMonth()]} de {base.getFullYear()}</b>
        <button className="btn icon sm ghost" aria-label="Próximo mês" disabled={offset >= 0} onClick={() => setOffset(offset + 1)}><Icon name="ChevronRight" size={16} /></button>
      </div>
      <div className="mini-cal">
        {weekdayShort.map((w) => <span key={w} className="h">{w[0]}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const ds = toISODate(d);
          const on = logs.includes(ds);
          const future = ds > t;
          return (
            <button key={i} type="button" className={`habit-day ${on ? "on" : ""} ${future ? "future" : ""}`} style={{ "--c": habit.color || undefined, aspectRatio: "auto", padding: "4px 0", fontSize: "0.75rem", color: on ? "#fff" : undefined } as React.CSSProperties}
              disabled={future} aria-pressed={on} aria-label={`${d.getDate()} de ${monthNames[d.getMonth()]}: ${on ? "concluído" : "não registrado"}`} onClick={() => onToggle(ds)}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <span className="muted tiny">{done} dia(s) registrados neste mês · histórico dos últimos 90 dias</span>
    </div>
  );
}

export function HabitsView({ mod, ws }: ModuleViewProps) {
  const { toast } = useApp();
  const [showInactive, setShowInactive] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const { data, loading, error, reload } = useAsync(
    () => call<{ items: Rec[] }>("rec.list", { entity: "habits", scope: ws, page_size: 200, filters: showInactive ? {} : { active: true } }),
    [ws, showInactive],
  );
  const changed = useCallback(() => { reload(); }, [reload]);
  useChanged(changed);
  const { open, panels } = useRecordPanels(mod, ws, changed);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(new Date(), i - 13)), []);
  const t = today();

  const toggle = async (h: Rec, date: string) => {
    try {
      const r = await call<{ done: boolean }>("habit.toggle", { habit_id: h.id, date });
      if (r.done && date === t) toast(`"${h.title}" registrado hoje.`);
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const items = data?.items ?? [];
  const selected = items.find((h) => h.id === sel) ?? items[0];
  const doneToday = items.filter((h) => h.done_today).length;

  return (
    <div className="stack">
      <div className="toolbar">
        <span className="badge primary"><Icon name="Flame" size={13} /> {doneToday}/{items.length} hábitos feitos hoje</span>
        <span className="grow" />
        <label className="check small"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Mostrar inativos</label>
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState image={emptyArt} title={mod.emptyTitle ?? "Nenhum hábito"} text={`${mod.emptyText ?? ""} Use o botão "Adicionar" acima.`} /></div>
      ) : (
        <div className="habits-layout">
          <div className="card table-wrap">
            <table className="table habits-table">
              <thead>
                <tr>
                  <th>Hábito</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className="hd-day" title={toISODate(d)}>
                      <span className="tiny">{weekdayShort[d.getDay()][0]}</span><br />{d.getDate()}
                    </th>
                  ))}
                  <th className="num">Sequência</th>
                  <th className="num">30 dias</th>
                </tr>
              </thead>
              <tbody>
                {items.map((h) => (
                  <tr key={h.id} className={selected?.id === h.id ? "sel-row" : undefined}>
                    <td>
                      <div className="row">
                        <span className="dot" style={{ background: h.color || "var(--accent)" }} />
                        <button className="btn ghost sm" style={{ padding: 0, fontWeight: 600 }} onClick={() => open(h.id)} aria-label={`Abrir detalhes de ${h.title}`}>{h.title}</button>
                        {!h.active && <span className="badge">Inativo</span>}
                      </div>
                      <button className="btn sm ghost tiny" style={{ height: 22, padding: "0 4px" }} onClick={() => setSel(h.id)}>Ver calendário</button>
                    </td>
                    {days.map((d) => {
                      const ds = toISODate(d);
                      const on = (h.logs ?? []).includes(ds);
                      const sch = scheduled(h, d);
                      return (
                        <td key={ds} style={{ padding: 3 }}>
                          <button type="button" className={`habit-day ${on ? "on" : ""}`} style={{ "--c": h.color || undefined, width: 26, opacity: sch || on ? 1 : 0.45 } as React.CSSProperties}
                            aria-pressed={on} aria-label={`${h.title} em ${d.getDate()}/${d.getMonth() + 1}: ${on ? "concluído" : "não registrado"}`}
                            onClick={() => toggle(h, ds)}>
                            {on && <Icon name="Check" size={13} color="#fff" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="num"><b>{h.streak ?? 0}</b> <span className="tiny muted">dia(s)</span></td>
                    <td className="num">{h.count_30 ?? 0}/30</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <div className="col">
              <h3 className="row"><span className="dot" style={{ background: selected.color || "var(--accent)" }} /> {selected.title}</h3>
              <button className={`btn ${selected.done_today ? "" : "primary"}`} onClick={() => toggle(selected, t)}>
                <Icon name={selected.done_today ? "RotateCcw" : "Check"} size={16} /> {selected.done_today ? "Desfazer registro de hoje" : "Concluir hoje"}
              </button>
              <MonthCalendar key={selected.id} habit={selected} onToggle={(ds) => toggle(selected, ds)} />
              <p className="muted tiny">Consistência (30 dias): {Math.round(((selected.count_30 ?? 0) / 30) * 100)}% · Frequência: {selected.frequency === "diario" ? "todos os dias" : selected.frequency === "semanal" ? `${selected.target_per_week ?? "?"}x por semana` : "dias específicos"}</p>
            </div>
          )}
        </div>
      )}
      {panels}
    </div>
  );
}
