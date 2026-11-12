// Agenda e calendário (mês, semana, dia) do ambiente atual, integrando compromissos,
// tarefas, contas e demais itens com data.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMembers, type Member } from "../hooks/data";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, Loading, Segmented, Tabs } from "../components/ui";
import { useRoute } from "../hooks/router";
import { getModule } from "../modules/registry";
import { ModulePage, RecordDrawer } from "../modules/ModulePage";
import { RecordForm } from "../modules/RecordForm";
import { addDays, fmtLongDate, monthNames, parseISO, startOfWeek, toISODate, weekdayLong, weekdayShort } from "../utils/format";
import { cx } from "../utils/cx";
import type { Rec } from "../modules/types";

type View = "mes" | "semana" | "dia";

const KINDS: Record<string, { label: string; color: string; module: string; ws: Array<"personal" | "family"> }> = {
  compromisso: { label: "Compromissos", color: "#4f46e5", module: "events", ws: ["personal", "family"] },
  tarefa: { label: "Tarefas", color: "#0891b2", module: "tasks", ws: ["personal", "family"] },
  conta: { label: "Contas", color: "#dc2626", module: "bills", ws: ["personal", "family"] },
  saude: { label: "Saúde", color: "#db2777", module: "health_appointment", ws: ["personal"] },
  estudo: { label: "Estudos", color: "#ca8a04", module: "study_item", ws: ["personal"] },
  evento: { label: "Eventos", color: "#9333ea", module: "family_event", ws: ["family"] },
  aniversario: { label: "Aniversários", color: "#ea580c", module: "birthday", ws: ["family"] },
  cardapio: { label: "Cardápio", color: "#16a34a", module: "menu", ws: ["family"] },
  manutencao: { label: "Manutenção", color: "#475569", module: "maintenance", ws: ["family"] },
  viagem: { label: "Viagens", color: "#0d9488", module: "trip", ws: ["family"] },
};

function itemColor(i: Rec): string {
  return i.color || KINDS[i.kind]?.color || "#4f46e5";
}
function timeOf(i: Rec): string {
  return typeof i.start_at === "string" && i.start_at.length > 10 && !i.all_day ? i.start_at.slice(11, 16) : "";
}

function whoOf(i: Rec, members: Member[]): Member | undefined {
  const id = i.assignee_id || i.owner_id;
  return members.find((m) => m.id === id);
}

function ItemChip({ i, ws, onOpen, members }: { i: Rec; ws: string; onOpen: (i: Rec) => void; members: Member[] }) {
  const m = ws === "family" ? whoOf(i, members) : undefined;
  const who = m?.full_name ?? null;
  return (
    <button className="cal-ev" style={{ ["--c" as string]: itemColor(i), boxShadow: m?.color ? `inset -4px 0 0 ${m.color}` : undefined }} onClick={(e) => { e.stopPropagation(); onOpen(i); }}
      title={`${KINDS[i.kind]?.label ?? i.kind}: ${i.title}${who ? ` · ${who}` : ""}`}>
      {timeOf(i) && <b>{timeOf(i)} </b>}
      {i.kind === "tarefa" && i.status === "concluida" ? <s>{i.title}</s> : i.title}
      {who && <span className="muted"> · {who.split(" ")[0]}</span>}
    </button>
  );
}

export function CalendarPage() {
  const { workspace: ws, perm, can } = useApp();
  const members = useMembers(ws);
  const route = useRoute();
  const [tab, setTab] = useState<"calendario" | "lista">("calendario");
  const [view, setView] = useState<View>("mes");
  const [cursor, setCursor] = useState<Date>(() => parseISO(route.query.get("date")) ?? new Date());
  const [kinds, setKinds] = useState<string[]>(Object.keys(KINDS));
  const [category, setCategory] = useState("");
  const [items, setItems] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ module: string; id: string } | null>(null);
  const [form, setForm] = useState<{ module: string; record: Rec | null; defaults?: Rec } | null>(null);

  useEffect(() => {
    const d = parseISO(route.query.get("date"));
    if (d) { setCursor(d); setView("dia"); }
  }, [route]);

  const available = Object.entries(KINDS).filter(([, k]) => k.ws.includes(ws));

  const range = useMemo(() => {
    if (view === "dia") return { from: cursor, to: cursor };
    if (view === "semana") { const s = startOfWeek(cursor); return { from: s, to: addDays(s, 6) }; }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const s = startOfWeek(first);
    return { from: s, to: addDays(s, 41) };
  }, [view, cursor]);

  const load = useCallback(async () => {
    if (ws === "family" && !perm.family_id) { setItems([]); return; }
    setError(null);
    try {
      const r = await call<{ items: Rec[] }>("calendar.range", { scope: ws, from: toISODate(range.from), to: toISODate(range.to), category: category.trim() || undefined });
      setItems(r.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [ws, range, category, perm.family_id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => { if (ws === "personal" || can("agenda.create")) setForm({ module: "events", record: null, defaults: defaultsFor(cursor) }); };
    window.addEventListener("plu:new", h);
    return () => window.removeEventListener("plu:new", h);
  }, [cursor, ws, can]);

  const visible = (items ?? []).filter((i) => kinds.includes(i.kind));
  const byDay = useMemo(() => {
    const m: Record<string, Rec[]> = {};
    for (const i of visible) {
      const d = String(i.start_at ?? "").slice(0, 10);
      (m[d] ??= []).push(i);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
    return m;
  }, [visible]);

  const step = (dir: number) => {
    const c = new Date(cursor);
    if (view === "mes") c.setMonth(c.getMonth() + dir, 1);
    else c.setDate(c.getDate() + (view === "semana" ? 7 : 1) * dir);
    setCursor(c);
  };
  const mn = monthNames[cursor.getMonth()];
  const title = view === "mes" ? `${mn[0].toUpperCase()}${mn.slice(1)} de ${cursor.getFullYear()}`
    : view === "semana" ? `${toISODate(range.from).split("-").reverse().join("/")} – ${toISODate(range.to).split("-").reverse().join("/")}`
    : fmtLongDate(cursor);

  const openItem = (i: Rec) => {
    const k = KINDS[i.kind];
    if (k) setOpen({ module: k.module, id: i.occurrence_of ?? i.id });
  };
  function defaultsFor(d: Date): Rec {
    const base = getModule("events")!.defaults;
    const def = typeof base === "function" ? base() : { ...(base ?? {}) };
    const t = String(def.start_at ?? "T09:00").slice(10) || "T09:00";
    return { ...def, start_at: `${toISODate(d)}${t}` };
  }
  const canAdd = ws === "personal" || can("agenda.create");
  const todayStr = toISODate(new Date());

  if (ws === "family" && !perm.family_id) {
    return <EmptyState icon="Users" title="Você ainda não participa de uma família" text="O calendário familiar aparece aqui após criar ou entrar em uma família." />;
  }

  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="CalendarDays" size={22} /></div>
          <div>
            <h1>Agenda <span className={cx("badge", ws === "family" ? "accent" : "primary")} style={{ verticalAlign: "middle" }}>{ws === "family" ? "FAMÍLIA" : "PESSOAL"}</span></h1>
            <p>Compromissos, prazos de tarefas, vencimentos e outras datas em um só calendário.</p>
          </div>
        </div>
        {canAdd && <button className="btn primary" onClick={() => setForm({ module: "events", record: null, defaults: defaultsFor(cursor) })}><Icon name="Plus" size={17} /> Novo compromisso</button>}
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ key: "calendario", label: "Calendário", icon: "Calendar" }, { key: "lista", label: "Compromissos", icon: "List" }]} />

      {tab === "lista" ? <ModulePage mod={getModule("events")!} ws={ws} embedded /> : (
        <>
          <div className="toolbar">
            <button className="btn" onClick={() => setCursor(new Date())}>Hoje</button>
            <button className="btn icon" aria-label="Anterior" onClick={() => step(-1)}><Icon name="ChevronLeft" /></button>
            <button className="btn icon" aria-label="Próximo" onClick={() => step(1)}><Icon name="ChevronRight" /></button>
            <h2 style={{ minWidth: 200 }} aria-live="polite">{title}</h2>
            <span className="grow" />
            <input className="input" style={{ width: 180 }} placeholder="Filtrar categoria" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrar por categoria" />
            <Segmented label="Visualização" value={view} onChange={setView} options={[{ key: "mes", label: "Mês" }, { key: "semana", label: "Semana" }, { key: "dia", label: "Dia" }]} />
          </div>
          <div className="legend" style={{ marginBottom: 12 }} role="group" aria-label="Tipos exibidos">
            {available.map(([k, d]) => (
              <label key={k}>
                <input type="checkbox" checked={kinds.includes(k)} onChange={(e) => setKinds((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                <span className="dot" style={{ background: d.color }} /> {d.label}
              </label>
            ))}
          </div>

          {error ? <ErrorState message={error} onRetry={load} /> : !items ? <Loading /> : view === "mes" ? (
            <div className="card" style={{ overflow: "hidden" }}>
              <div className="cal-grid" role="grid" aria-label="Calendário mensal">
                {weekdayShort.map((w) => <div key={w} className="hd" role="columnheader">{w}</div>)}
                {Array.from({ length: 42 }, (_, n) => {
                  const d = addDays(range.from, n);
                  const ds = toISODate(d);
                  const list = byDay[ds] ?? [];
                  return (
                    <div key={ds} role="gridcell" tabIndex={0} className={cx("cal-cell", d.getMonth() !== cursor.getMonth() && "out", ds === todayStr && "today")}
                      aria-label={`${d.getDate()} de ${monthNames[d.getMonth()]}, ${list.length} item(ns)`}
                      onClick={() => { setCursor(d); setView("dia"); }} onKeyDown={(e) => { if (e.key === "Enter") { setCursor(d); setView("dia"); } }}>
                      <span className="num">{d.getDate()}</span>
                      {list.slice(0, 3).map((i, k) => <ItemChip key={`${i.id}-${k}`} i={i} ws={ws} onOpen={openItem} members={members} />)}
                      {list.length > 3 && <span className="tiny muted">+{list.length - 3} mais</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : view === "semana" ? (
            <div className="week-grid">
              {Array.from({ length: 7 }, (_, n) => {
                const d = addDays(range.from, n);
                const ds = toISODate(d);
                const list = byDay[ds] ?? [];
                return (
                  <div key={ds} className={cx("week-col", ds === todayStr && "today")}>
                    <button className="btn ghost sm" style={{ justifyContent: "flex-start" }} onClick={() => { setCursor(d); setView("dia"); }}>
                      <b>{weekdayShort[d.getDay()]} {d.getDate()}</b>
                    </button>
                    {list.length === 0 && <span className="tiny muted">Livre</span>}
                    {list.map((i, k) => <ItemChip key={`${i.id}-${k}`} i={i} ws={ws} onOpen={openItem} members={members} />)}
                    {canAdd && <button className="btn sm ghost" onClick={() => setForm({ module: "events", record: null, defaults: defaultsFor(d) })} aria-label={`Novo compromisso em ${d.getDate()}`}><Icon name="Plus" size={14} /></button>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card">
              <div className="card-head">
                <h3>{weekdayLong[cursor.getDay()]}</h3>
                {canAdd && <button className="btn sm" onClick={() => setForm({ module: "events", record: null, defaults: defaultsFor(cursor) })}><Icon name="Plus" size={15} /> Compromisso neste dia</button>}
              </div>
              {(byDay[toISODate(cursor)] ?? []).length === 0 ? (
                <EmptyState icon="CalendarDays" title="Nada neste dia" text="Nenhum item com data para este dia nos tipos selecionados." />
              ) : (
                <div className="list">
                  {(byDay[toISODate(cursor)] ?? []).map((i, k) => (
                    <button key={`${i.id}-${k}`} className="list-item" onClick={() => openItem(i)}>
                      <span className="dot" style={{ background: itemColor(i), width: 12, height: 12 }} />
                      <span style={{ width: 52, fontVariantNumeric: "tabular-nums" }} className="small">{timeOf(i) || "Dia"}</span>
                      <div className="grow">
                        <div className="title">{i.title}</div>
                        <div className="muted tiny">
                          {KINDS[i.kind]?.label}
                          {i.location ? ` · ${i.location}` : ""}
                          {i.category ? ` · ${i.category}` : ""}
                          {ws === "family" && whoOf(i, members) ? ` · ${whoOf(i, members)!.full_name}` : ""}
                        </div>
                      </div>
                      {i.recurrence && i.recurrence !== "nenhuma" && <Icon name="Repeat" size={14} label="Recorrente" />}
                      <Icon name="ChevronRight" size={15} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {open && getModule(open.module) && (
        <RecordDrawer mod={getModule(open.module)!} ws={ws} id={open.id} onClose={() => setOpen(null)} onChanged={load}
          onEdit={(r) => { setForm({ module: open.module, record: r }); }} />
      )}
      {form && getModule(form.module) && (
        <RecordForm entity={getModule(form.module)!.entity} title={form.record ? `Editar ${getModule(form.module)!.singular.toLowerCase()}` : "Novo compromisso"}
          fields={getModule(form.module)!.fields} ws={ws} record={form.record} defaults={form.defaults}
          onClose={() => setForm(null)} onSaved={() => { setForm(null); setOpen(null); load(); window.dispatchEvent(new CustomEvent("plu:changed")); }} />
      )}
    </div>
  );
}
