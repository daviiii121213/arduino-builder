// Seções do painel de detalhes: itens filhos, histórico de alterações e registros cronológicos.
import { useState } from "react";
import { call } from "../api/client";
import { useApp, type Workspace } from "../contexts/app";
import { useAsync } from "../hooks/data";
import { Icon } from "../components/Icon";
import { Loading } from "../components/ui";
import { fmtDate, fmtDateTime, today } from "../utils/format";
import { RecordForm } from "./RecordForm";
import type { ChildDef, Rec } from "./types";

const ACTIONS: Record<string, string> = {
  criar: "criou", editar: "editou", excluir: "moveu para a lixeira", restaurar: "restaurou", compartilhar: "compartilhou com a família",
  cancelar_compartilhamento: "cancelou o compartilhamento", anexar: "anexou um arquivo", remover_anexo: "removeu um anexo", votar: "votou", excluir_definitivo: "excluiu definitivamente",
};

export function actionLabel(a: string) {
  return ACTIONS[a] ?? a.replace(/_/g, " ");
}

export function HistoryPanel({ entity, id }: { entity: string; id: string }) {
  const { data, loading } = useAsync(() => call<{ items: Rec[] }>("rec.history", { entity, id }), [entity, id]);
  return (
    <section className="col" aria-label="Histórico de alterações">
      <h3 className="row"><Icon name="History" size={17} /> Histórico de alterações</h3>
      {loading ? <Loading /> : (
        <ul className="list" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {data?.items.map((h, i) => (
            <li key={i} className="small" style={{ padding: "5px 0" }}>
              <b>{h.user_name}</b> {actionLabel(h.action)}
              {h.details?.campos ? <span className="muted"> ({(h.details.campos as string[]).length} campo(s))</span> : null}
              <span className="muted"> · {fmtDateTime(h.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ChildrenPanel({ def, parentId, ws, canEdit, onChange }: { def: ChildDef; parentId: string; ws: Workspace; canEdit: boolean; onChange: () => void }) {
  const { toast, confirm } = useApp();
  const [quick, setQuick] = useState("");
  const [editing, setEditing] = useState<Rec | null | "new">(null);
  const { data, loading, reload } = useAsync(
    () => call<{ items: Rec[] }>("rec.list", { entity: def.entity, scope: ws, filters: { [def.parentKey]: parentId }, page_size: 500, sort: "position ASC" }),
    [def.entity, parentId, ws],
  );
  const items = data?.items ?? [];
  const isDone = (r: Rec) => (def.doneKey ? (def.doneValue !== undefined ? r[def.doneKey] === def.doneValue : !!r[def.doneKey]) : false);
  const done = items.filter(isDone).length;

  const add = async () => {
    const t = quick.trim();
    if (!t) return;
    try {
      await call("rec.create", { entity: def.entity, values: { [def.parentKey]: parentId, title: t, position: items.length } });
      setQuick("");
      reload();
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const toggle = async (r: Rec) => {
    if (!def.doneKey) return;
    const v = isDone(r) ? (def.undoneValue ?? false) : (def.doneValue ?? true);
    try {
      await call("rec.update", { entity: def.entity, id: r.id, values: { [def.doneKey]: v } });
      reload();
      onChange();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const remove = async (r: Rec) => {
    if (!(await confirm({ title: "Excluir item?", message: `"${r.title}" será movido para a lixeira.`, confirmLabel: "Excluir", danger: true }))) return;
    await call("rec.delete", { entity: def.entity, id: r.id });
    reload();
    onChange();
  };
  const move = async (r: Rec, dir: -1 | 1) => {
    const idx = items.findIndex((x) => x.id === r.id);
    const other = items[idx + dir];
    if (!other) return;
    await call("rec.update", { entity: def.entity, id: r.id, values: { position: idx + dir } });
    await call("rec.update", { entity: def.entity, id: other.id, values: { position: idx } });
    reload();
  };

  return (
    <section className="col" aria-label={def.label}>
      <div className="row between">
        <h3>{def.label}</h3>
        {def.doneKey && items.length > 0 && <span className="badge">{done}/{items.length} concluídos</span>}
      </div>
      {loading ? <Loading /> : (
        <div className="list card">
          {items.length === 0 && <p className="muted small" style={{ padding: 12 }}>Nenhum item ainda.</p>}
          {items.map((r, i) => (
            <div className={`list-item ${isDone(r) ? "done" : ""}`} key={r.id}>
              {def.doneKey && (
                <input type="checkbox" checked={isDone(r)} onChange={() => toggle(r)} aria-label={`Marcar "${r.title}" como concluído`} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
              )}
              <div className="grow">
                <div className="title">{r.title}</div>
                {def.subtitle && <div className="muted tiny">{def.subtitle(r)}</div>}
              </div>
              {canEdit && (
                <>
                  <button className="btn icon sm ghost" aria-label="Mover para cima" disabled={i === 0} onClick={() => move(r, -1)}><Icon name="ChevronUp" size={15} /></button>
                  <button className="btn icon sm ghost" aria-label="Mover para baixo" disabled={i === items.length - 1} onClick={() => move(r, 1)}><Icon name="ChevronDown" size={15} /></button>
                  <button className="btn icon sm ghost" aria-label={`Editar "${r.title}"`} onClick={() => setEditing(r)}><Icon name="Pencil" size={15} /></button>
                  <button className="btn icon sm ghost" aria-label={`Excluir "${r.title}"`} onClick={() => remove(r)}><Icon name="Trash2" size={15} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div className="row">
          <input className="input" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={`Adicionar a ${def.label.toLowerCase()}…`} aria-label={`Novo item em ${def.label}`}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <button className="btn" onClick={add}><Icon name="Plus" size={15} /> Adicionar</button>
          {def.fields.length > 1 && <button className="btn ghost" onClick={() => setEditing("new")} title="Adicionar com detalhes">Detalhado…</button>}
        </div>
      )}
      {editing && (
        <RecordForm entity={def.entity} title={editing === "new" ? `Novo item — ${def.label}` : `Editar — ${def.label}`} fields={def.fields} ws={ws}
          record={editing === "new" ? null : editing} parent={editing === "new" ? { key: def.parentKey, id: parentId } : undefined}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); onChange(); }} />
      )}
    </section>
  );
}

export function LogsPanel({ entity, id, label, kind, valueLabel, noteLabel, canEdit }: { entity: string; id: string; label: string; kind: string; valueLabel?: string; noteLabel?: string; canEdit: boolean }) {
  const { toast } = useApp();
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(today());
  const { data, loading, reload } = useAsync(() => call<{ items: Rec[] }>("log.list", { entity, record_id: id }), [entity, id]);
  const add = async () => {
    if (!value && !note.trim()) return;
    try {
      await call("log.add", { entity, record_id: id, kind, log_date: date, value: value === "" ? null : Number(value), note: note.trim() || null });
      setValue("");
      setNote("");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <section className="col" aria-label={label}>
      <h3 className="row"><Icon name="History" size={17} /> {label}</h3>
      {canEdit && (
        <div className="row wrap">
          <input className="input" type="date" style={{ width: 160 }} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Data do registro" />
          {valueLabel && <input className="input" type="number" style={{ width: 120 }} placeholder={valueLabel} value={value} onChange={(e) => setValue(e.target.value)} aria-label={valueLabel} />}
          <input className="input grow" placeholder={noteLabel ?? "Observação"} value={note} onChange={(e) => setNote(e.target.value)} aria-label={noteLabel ?? "Observação"} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn" onClick={add}><Icon name="Plus" size={15} /> Registrar</button>
        </div>
      )}
      {loading ? <Loading /> : !data?.items.length ? <p className="muted small">Sem registros ainda.</p> : (
        <div className="list card">
          {data.items.map((l) => (
            <div className="list-item" key={l.id}>
              <span className="badge">{fmtDate(l.log_date)}</span>
              {l.value !== null && l.value !== undefined && <b>{valueLabel ? `${valueLabel}: ` : ""}{String(l.value).replace(".", ",")}</b>}
              <span className="grow small">{l.note}</span>
              <span className="muted tiny">{l.kind === "progresso" ? "atualização automática" : l.user_name}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
