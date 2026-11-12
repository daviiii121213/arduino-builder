// Rotina: etapas de hoje com marcação de concluídas.
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { Loading, Progress } from "../../components/ui";
import { weekdayLong } from "../../utils/format";
import type { DetailProps, Rec } from "../types";

export function RoutineDetail({ record, reload }: DetailProps) {
  const { toast } = useApp();
  const { data, loading, reload: again } = useAsync(
    () => call<{ items: Rec[] }>("rec.list", { entity: "routine_step", scope: "personal", filters: { parent_id: record.id }, page_size: 200, sort: "position ASC" }),
    [record.id, record.updated_at, record.steps_total],
  );
  const days: number[] = Array.isArray(record.data?.weekdays) ? record.data.weekdays : [];
  const todayIdx = new Date().getDay();
  const isToday = days.length === 0 || days.includes(todayIdx);
  const steps = (data?.items ?? []).slice().sort((a, b) => String(a.date_start ?? "99").localeCompare(String(b.date_start ?? "99")) || a.position - b.position);
  const done = steps.filter((s) => s.done_today).length;

  const toggle = async (s: Rec) => {
    try {
      await call("routine.toggle_step", { step_id: s.id });
      again();
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <section className="card card-pad col" aria-label="Rotina de hoje">
      <div className="row between">
        <h3 className="row"><Icon name="ListChecks" size={17} /> Hoje — {weekdayLong[todayIdx]}</h3>
        <span className={`badge ${isToday ? "success" : ""}`}>{isToday ? "Programada para hoje" : "Não programada para hoje"}</span>
      </div>
      {days.length > 0 && <p className="muted small">Dias: {days.map((d) => weekdayLong[d].split("-")[0]).join(", ")}{record.data?.time ? ` · início às ${record.data.time}` : ""}</p>}
      {loading && !data ? <Loading /> : steps.length === 0 ? (
        <p className="muted small">Adicione etapas na seção "Etapas" abaixo para acompanhar a rotina do dia.</p>
      ) : (
        <>
          <div className="row"><div className="grow"><Progress value={(done / steps.length) * 100} tone="accent" label="Etapas concluídas hoje" /></div><span className="small">{done}/{steps.length}</span></div>
          <div className="list">
            {steps.map((s) => (
              <label key={s.id} className={`list-item ${s.done_today ? "done" : ""}`} style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={!!s.done_today} onChange={() => toggle(s)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                {s.date_start && <span className="badge">{s.date_start}</span>}
                <span className="title grow">{s.title}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
