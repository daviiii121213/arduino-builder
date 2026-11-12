// Pesquisa global (Ctrl+K): resultados agrupados por módulo, respeitando permissões.
import { useEffect, useMemo, useRef, useState } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { Icon } from "../components/Icon";
import { Highlight, Modal, Spinner } from "../components/ui";
import { navigate } from "../hooks/router";
import { MODULES } from "../modules/registry";
import { fmtDateTime } from "../utils/format";
import type { Rec } from "../modules/types";

interface Group {
  entity: string;
  label: string;
  workspace: "personal" | "family";
  parent_entity?: string | null;
  items: Rec[];
}

export function routeFor(entity: string, ws: string, id: string, parentEntity?: string | null, parentId?: string | null): string {
  const target = parentEntity && parentId ? { e: parentEntity, id: parentId } : { e: entity, id };
  const mod = MODULES.find((m) => m.entity === target.e);
  if (!mod) return "/";
  return `/m/${mod.id}?ws=${ws}&open=${encodeURIComponent(target.id)}`;
}

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { settings, setWorkspace } = useApp();
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [cat, setCat] = useState("");
  const [ws, setWs] = useState("");
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (settings.search_history) call<{ items: string[] }>("search.history").then((r) => setHistory(r.items)).catch(() => {});
  }, [settings.search_history]);

  useEffect(() => {
    const ready = q.trim().length >= 2 || from || to || cat;
    if (!ready) { setGroups(null); setError(""); return; }
    const s = ++seq.current;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await call<{ groups: Group[] }>("search.query", { q: q.trim(), from: from || undefined, to: to || undefined, category: cat || undefined, workspace: ws || undefined });
        if (s === seq.current) { setGroups(r.groups); setError(""); }
      } catch (e) {
        if (s === seq.current) setError((e as Error).message);
      } finally {
        if (s === seq.current) setBusy(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, from, to, cat, ws]);

  const flat = useMemo(() => (groups ?? []).flatMap((g) => g.items.map((i) => ({ g, i }))), [groups]);
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [groups]);

  const open = (g: Group, i: Rec) => {
    setWorkspace(g.workspace);
    navigate(routeFor(g.entity, g.workspace, i.id, g.parent_entity, i.parent_id));
    onClose();
  };

  return (
    <Modal title="Pesquisa global" onClose={onClose} size="lg">
      <div className="col" style={{ gap: 12 }} onKeyDown={(e) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
        if (e.key === "Enter" && flat[active]) { e.preventDefault(); open(flat[active].g, flat[active].i); }
      }}>
        <div className="row">
          <div className="search-input grow">
            <Icon name="Search" size={16} />
            <input className="input" autoFocus placeholder="Pesquisar tarefas, compromissos, notas, documentos…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Termo de pesquisa" />
          </div>
          {busy && <Spinner />}
          <button className="btn" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}><Icon name="Filter" size={15} /> Filtros</button>
        </div>
        {showFilters && (
          <div className="row wrap">
            <label className="small">De <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} /></label>
            <label className="small">Até <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} /></label>
            <input className="input" placeholder="Categoria exata" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 180 }} aria-label="Categoria" />
            <select className="input" value={ws} onChange={(e) => setWs(e.target.value)} style={{ width: 170 }} aria-label="Ambiente">
              <option value="">Todos os ambientes</option><option value="personal">Somente PESSOAL</option><option value="family">Somente FAMÍLIA</option>
            </select>
          </div>
        )}
        {error && <div className="alert warning small">{error}</div>}
        {!groups && !error && (
          <div className="col">
            <p className="muted small">Digite pelo menos 2 caracteres. A pesquisa ignora acentos e mostra apenas o que você tem permissão para ver. O conteúdo de arquivos anexados não é lido.</p>
            {history.length > 0 && (
              <div className="row wrap">
                <span className="small muted">Recentes:</span>
                {history.map((h) => <button key={h} className="btn sm" onClick={() => setQ(h)}>{h}</button>)}
                <button className="btn sm ghost" onClick={async () => { await call("search.clear_history"); setHistory([]); }}>Limpar histórico</button>
              </div>
            )}
          </div>
        )}
        {groups && groups.length === 0 && <p className="muted">Nenhum resultado encontrado.</p>}
        {groups?.map((g) => (
          <section key={g.entity + g.workspace}>
            <h3 className="row small" style={{ marginBottom: 6 }}>{g.label} <span className={`badge ${g.workspace === "family" ? "accent" : "primary"}`}>{g.workspace === "family" ? "FAMÍLIA" : "PESSOAL"}</span></h3>
            <div className="list card">
              {g.items.map((i) => {
                const idx = flat.findIndex((x) => x.i === i);
                return (
                  <button key={i.id} className="list-item" onClick={() => open(g, i)} style={idx === active ? { background: "var(--bg-hover)" } : undefined} aria-current={idx === active}>
                    <div className="grow">
                      <div className="title"><Highlight text={String(i.title ?? "")} q={q} /></div>
                      {i.snippet && <div className="muted tiny ellipsis"><Highlight text={String(i.snippet)} q={q} /></div>}
                    </div>
                    {i.date && <span className="tiny muted">{fmtDateTime(i.date)}</span>}
                    <Icon name="ChevronRight" size={15} />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  );
}
