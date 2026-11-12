// Projeto: tarefas vinculadas, mini Kanban, tempo registrado e progresso automático.
import { useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { Loading, Progress } from "../../components/ui";
import { fmtDate, minutesLabel } from "../../utils/format";
import { navigate } from "../../hooks/router";
import { TASK_STATUS } from "../registry";
import type { DetailProps, Rec } from "../types";

export function ProjectDetail({ record, reload }: DetailProps) {
  const { toast } = useApp();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const tasks = useAsync(() => call<{ items: Rec[] }>("rec.list", { entity: "tasks", scope: "personal", filters: { project_id: record.id }, page_size: 300 }), [record.id]);
  const rules = useAsync(() => call<{ items: Rec[] }>("auto.list"), []);
  const autoOn = !!rules.data?.items.find((r) => r.rule_type === "project_progress")?.enabled;
  const items = tasks.data?.items ?? [];
  const shown = Number(record.progress ?? 0);

  const refresh = () => { tasks.reload(); reload(); };
  const add = async () => {
    if (!title.trim()) return;
    try {
      await call("rec.create", { entity: "tasks", scope: "personal", values: { title: title.trim(), project_id: record.id, due_date: due || null, status: "pendente" } });
      setTitle("");
      setDue("");
      toast("Tarefa vinculada criada.");
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const move = async (t: Rec, status: string) => {
    try {
      await call("rec.update", { entity: "tasks", id: t.id, values: { status } });
      refresh();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <section className="col" aria-label="Andamento do projeto">
      <div className="card card-pad col">
        <div className="row between">
          <h3 className="row"><Icon name="BarChart3" size={17} /> Progresso</h3>
          <span className={`badge ${autoOn ? "success" : ""}`}><Icon name="Zap" size={12} /> Automação {autoOn ? "ativa" : "desativada"}</span>
        </div>
        <div className="row"><div className="grow"><Progress value={shown} /></div><b>{Math.round(shown)}%</b></div>
        <p className="muted tiny">
          Cálculo pelas etapas e tarefas: {record.steps_done}/{record.steps_total} etapas e {record.tasks_done}/{record.tasks_total} tarefas concluídas = {Math.round(record.progress_auto ?? 0)}%.{" "}
          {autoOn ? "A regra \"Atualizar progresso do projeto\" atualiza o percentual automaticamente." : "Com a regra \"Atualizar progresso do projeto\" desativada, o percentual exibido é o informado manualmente."}{" "}
          <a href="#/config?tab=automacoes" onClick={(e) => { e.preventDefault(); navigate("/config?tab=automacoes"); }}>Gerenciar automações</a>
        </p>
        <div className="row small"><Icon name="Clock" size={15} /> Tempo registrado: <b>{minutesLabel(Number(record.minutes_spent ?? 0))}</b> <span className="muted tiny">(Controle de tempo vinculado a este projeto)</span></div>
      </div>
      <div className="col">
        <h3 className="row"><Icon name="CheckSquare" size={17} /> Tarefas vinculadas ({items.length})</h3>
        <div className="row wrap">
          <input className="input grow" placeholder="Nova tarefa do projeto…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} aria-label="Título da nova tarefa vinculada" />
          <input className="input" type="date" style={{ width: 160 }} value={due} onChange={(e) => setDue(e.target.value)} aria-label="Prazo da tarefa" />
          <button className="btn" onClick={add}><Icon name="Plus" size={15} /> Criar tarefa</button>
        </div>
        {tasks.loading && !tasks.data ? <Loading /> : (
          <div className="kanban mini-kanban">
            {TASK_STATUS.map((col) => {
              const list = items.filter((t) => t.status === col.value);
              return (
                <div key={col.value} className="kanban-col" onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); const t = items.find((x) => x.id === id); if (t && t.status !== col.value) move(t, col.value); }}>
                  <h4><span>{col.label}</span><span className="badge">{list.length}</span></h4>
                  {list.map((t) => (
                    <div key={t.id} className="k-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}>
                      <b className="small" style={{ textDecoration: t.status === "concluida" ? "line-through" : undefined }}>{t.title}</b>
                      {t.due_date && <div className={`tiny ${t.is_late ? "" : "muted"}`} style={t.is_late ? { color: "var(--danger)" } : undefined}>Prazo {fmtDate(t.due_date)}</div>}
                      <select className="input" style={{ height: 28, marginTop: 6, fontSize: "0.8rem" }} value={t.status} onChange={(e) => move(t, e.target.value)} aria-label={`Mover tarefa ${t.title}`}>
                        {TASK_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
