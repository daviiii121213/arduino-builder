// Painel inicial personalizável do ambiente atual (PESSOAL ou FAMÍLIA).
import { useCallback, useEffect, useState } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Loading, Modal } from "../components/ui";
import { navigate } from "../hooks/router";
import { fmtLongDate } from "../utils/format";
import { cx } from "../utils/cx";
import type { Rec } from "../modules/types";
import { WIDGET_ICONS, WidgetBody } from "./dashboard/widgets";

interface Widget {
  id?: string;
  widget_type: string;
  size: "s" | "m" | "l";
  config?: Rec;
}
interface CatalogItem {
  key: string;
  label: string;
  description: string;
}

const SIZE_LABEL: Record<string, string> = { s: "Pequeno", m: "Médio", l: "Grande" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Dashboard() {
  const { user, workspace: ws, toast, confirm } = useApp();
  const [widgets, setWidgets] = useState<Widget[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [data, setData] = useState<Rec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Widget[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setData(await call<Rec>("dashboard.data", { workspace: ws }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [ws]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [l, d] = await Promise.all([call<{ widgets: Widget[]; catalog: CatalogItem[] }>("dashboard.get", { workspace: ws }), call<Rec>("dashboard.data", { workspace: ws })]);
      setWidgets(l.widgets);
      setCatalog(l.catalog);
      setData(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [ws]);

  useEffect(() => {
    setEditing(false);
    setWidgets(null);
    load();
  }, [load]);

  useEffect(() => {
    const h = () => loadData();
    window.addEventListener("plu:changed", h);
    window.addEventListener("focus", h);
    return () => { window.removeEventListener("plu:changed", h); window.removeEventListener("focus", h); };
  }, [loadData]);

  const startEdit = () => { setDraft((widgets ?? []).map((w) => ({ ...w }))); setEditing(true); };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.length || from === to) return;
    setDraft((d) => { const n = [...d]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n; });
  };
  const save = async () => {
    setSaving(true);
    try {
      const r = await call<{ widgets: Widget[] }>("dashboard.save", { workspace: ws, widgets: draft });
      setWidgets(r.widgets);
      setEditing(false);
      toast("Painel salvo.");
      loadData();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    if (!(await confirm({ title: "Restaurar painel padrão?", message: "A organização atual dos widgets deste ambiente será substituída pelo layout padrão.", confirmLabel: "Restaurar" }))) return;
    try {
      const r = await call<{ widgets: Widget[] }>("dashboard.reset", { workspace: ws });
      setWidgets(r.widgets);
      setEditing(false);
      toast("Painel padrão restaurado.");
      loadData();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const label = (t: string) => catalog.find((c) => c.key === t)?.label ?? t;
  const list = editing ? draft : widgets ?? [];

  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon" style={ws === "family" ? { color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" } : undefined}>
            <Icon name={ws === "family" ? "Users" : "Home"} size={22} />
          </div>
          <div>
            <h1>{greeting()}, {user.full_name.split(" ")[0]}!</h1>
            <p>{fmtLongDate(new Date())} · Painel {ws === "family" ? "da FAMÍLIA" : "PESSOAL"}</p>
          </div>
        </div>
        {!data?.no_family && widgets && (
          editing ? (
            <div className="row wrap">
              <button className="btn" onClick={() => setAdding(true)}><Icon name="Plus" size={16} /> Adicionar widget</button>
              <button className="btn ghost" onClick={reset}><Icon name="RotateCcw" size={16} /> Restaurar padrão</button>
              <button className="btn" onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar painel"}</button>
            </div>
          ) : (
            <button className="btn" onClick={startEdit}><Icon name="LayoutGrid" size={16} /> Personalizar painel</button>
          )
        )}
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !widgets || !data ? <Loading /> : data.no_family ? (
        <div className="card">
          <EmptyState icon="Users" title="Você ainda não participa de uma família"
            text="Crie uma família ou aceite um convite para ver o painel compartilhado: tarefas da casa, mural, compras, contas e muito mais."
            action={<button className="btn primary" onClick={() => navigate("/familia")}>Configurar família</button>} />
        </div>
      ) : (
        <>
          {editing && <div className="alert small" style={{ marginBottom: 12 }}><Icon name="Info" size={16} /><span>Arraste os widgets para reorganizar, ou use os botões de seta. Altere o tamanho ou remova widgets e clique em <b>Salvar painel</b>.</span></div>}
          {list.length === 0 && (
            <div className="card"><EmptyState icon="LayoutGrid" title="Painel vazio" text="Adicione widgets para montar o seu painel." action={editing ? <button className="btn primary" onClick={() => setAdding(true)}>Adicionar widget</button> : <button className="btn primary" onClick={startEdit}>Personalizar painel</button>} /></div>
          )}
          <div className="dash">
            {list.map((w, i) => (
              <section key={w.id ?? `${w.widget_type}-${i}`} aria-label={label(w.widget_type)}
                className={cx("card widget", `w-${w.size}`, editing && "editing", dragIdx === i && "dragging", overIdx === i && dragIdx !== i && "drop-target")}
                draggable={editing}
                onDragStart={(e) => { setDragIdx(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); }}
                onDragOver={(e) => { if (editing) { e.preventDefault(); setOverIdx(i); } }}
                onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) move(dragIdx, i); setDragIdx(null); setOverIdx(null); }}>
                <div className="card-head">
                  <h3>{editing && <Icon name="GripVertical" size={16} />}<Icon name={WIDGET_ICONS[w.widget_type] ?? "LayoutGrid"} size={17} /> {label(w.widget_type)}</h3>
                  {editing && (
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn icon sm ghost" aria-label={`Mover ${label(w.widget_type)} para antes`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="ChevronLeft" size={15} /></button>
                      <button className="btn icon sm ghost" aria-label={`Mover ${label(w.widget_type)} para depois`} disabled={i === list.length - 1} onClick={() => move(i, i + 1)}><Icon name="ChevronRight" size={15} /></button>
                      <select className="input" style={{ height: 30, width: "auto", fontSize: "0.8rem" }} aria-label={`Tamanho de ${label(w.widget_type)}`} value={w.size}
                        onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, size: e.target.value as Widget["size"] } : x)))}>
                        {Object.entries(SIZE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button className="btn icon sm ghost" aria-label={`Remover ${label(w.widget_type)}`} onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}><Icon name="X" size={15} /></button>
                    </div>
                  )}
                </div>
                <div className="card-body grow" style={editing ? { pointerEvents: "none", opacity: 0.7 } : undefined}>
                  <WidgetBody type={w.widget_type} data={data[w.widget_type]} ws={ws} reload={loadData} />
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {adding && (
        <Modal title="Adicionar widget" onClose={() => setAdding(false)}>
          <div className="list card">
            {catalog.map((c) => {
              const used = draft.some((w) => w.widget_type === c.key);
              return (
                <div key={c.key} className="list-item">
                  <Icon name={WIDGET_ICONS[c.key] ?? "LayoutGrid"} />
                  <div className="grow"><div className="title">{c.label}</div><div className="muted tiny">{c.description}</div></div>
                  {used && <span className="badge">No painel</span>}
                  <button className="btn sm" onClick={() => { setDraft((d) => [...d, { widget_type: c.key, size: "m" }]); setAdding(false); }}><Icon name="Plus" size={14} /> Adicionar</button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
    </div>
  );
}
