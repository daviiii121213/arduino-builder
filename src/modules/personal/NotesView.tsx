// Notas: pastas, etiquetas, fixadas primeiro e pesquisa.
import { useCallback, useMemo, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { EmptyState, ErrorState, Loading } from "../../components/ui";
import { fmtDateTime } from "../../utils/format";
import { emptyArt } from "../../assets";
import type { ModuleViewProps, Rec } from "../types";
import { useChanged, useRecordPanels } from "./common";

const tagsOf = (r: Rec): string[] => String(r.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);

export function NotesView({ mod, ws }: ModuleViewProps) {
  const { toast } = useApp();
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  // todas as notas (para pastas/etiquetas) e a lista filtrada pela busca
  const all = useAsync(() => call<{ items: Rec[] }>("rec.list", { entity: "notes", scope: ws, page_size: 500 }), [ws]);
  const found = useAsync(() => call<{ items: Rec[] }>("rec.list", { entity: "notes", scope: ws, page_size: 500, q: q || undefined, filters: folder !== null ? { folder: folder || null } : {} }), [ws, q, folder]);
  const reloadAll = all.reload, reloadFound = found.reload;
  const changed = useCallback(() => { reloadAll(); reloadFound(); }, [reloadAll, reloadFound]);
  useChanged(changed);
  const { open, panels } = useRecordPanels(mod, ws, changed);

  const folders = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of all.data?.items ?? []) m.set(n.folder ?? "", (m.get(n.folder ?? "") ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [all.data]);
  const tags = useMemo(() => Array.from(new Set((all.data?.items ?? []).flatMap(tagsOf))).sort(), [all.data]);
  const items = (found.data?.items ?? []).filter((n) => !tag || tagsOf(n).includes(tag));

  const togglePin = async (n: Rec) => {
    try {
      await call("rec.update", { entity: "notes", id: n.id, values: { pinned: !n.pinned } });
      changed();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="notes-layout">
      <nav className="card card-pad col notes-side" aria-label="Pastas de notas">
        <h3 className="small">Pastas</h3>
        <button className="nav-link" aria-current={folder === null ? "page" : undefined} onClick={() => setFolder(null)}><Icon name="Inbox" size={16} /><span className="grow">Todas</span><span className="badge">{all.data?.items.length ?? 0}</span></button>
        {folders.map(([f, n]) => (
          <button key={f || "_"} className="nav-link" aria-current={folder === f ? "page" : undefined} onClick={() => setFolder(f)}>
            <Icon name="FolderOpen" size={16} /><span className="grow ellipsis">{f || "Sem pasta"}</span><span className="badge">{n}</span>
          </button>
        ))}
        {tags.length > 0 && (
          <>
            <h3 className="small" style={{ marginTop: 10 }}>Etiquetas</h3>
            <div className="row wrap">
              {tags.map((t) => <button key={t} className={`badge ${tag === t ? "primary" : ""}`} style={{ border: 0, cursor: "pointer" }} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}><Icon name="Tag" size={11} /> {t}</button>)}
            </div>
          </>
        )}
      </nav>
      <div className="col" style={{ minWidth: 0 }}>
        <div className="search-input" style={{ maxWidth: 420 }}>
          <Icon name="Search" size={16} />
          <input className="input" placeholder="Pesquisar nas notas…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar nas notas" />
        </div>
        {found.error ? <ErrorState message={found.error} onRetry={found.reload} /> : found.loading && !found.data ? <Loading /> : items.length === 0 ? (
          <div className="card"><EmptyState image={emptyArt} title={q || folder !== null || tag ? "Nada encontrado" : mod.emptyTitle ?? "Nenhuma nota"} text={q || folder !== null || tag ? "Ajuste a pesquisa, a pasta ou a etiqueta." : `${mod.emptyText ?? ""} Use o botão "Adicionar" acima.`} /></div>
        ) : (
          <div className="grid-auto">
            {items.map((n) => (
              <article key={n.id} className="card card-pad col note-card" style={{ borderTop: n.color ? `3px solid ${n.color}` : undefined }}>
                <div className="row">
                  <button className="btn ghost sm grow" style={{ padding: 0, justifyContent: "flex-start", fontWeight: 650 }} onClick={() => open(n.id)}>{n.title}</button>
                  <button className="btn icon sm ghost" aria-pressed={!!n.pinned} aria-label={n.pinned ? `Desafixar ${n.title}` : `Fixar ${n.title}`} title={n.pinned ? "Desafixar" : "Fixar"} onClick={() => togglePin(n)}>
                    <Icon name={n.pinned ? "Pin" : "PinOff"} size={15} />
                  </button>
                </div>
                {n.content && <p className="muted small note-snippet">{n.content}</p>}
                <div className="row wrap">
                  {n.folder && <span className="badge"><Icon name="FolderOpen" size={11} /> {n.folder}</span>}
                  {tagsOf(n).map((t) => <span key={t} className="badge primary">#{t}</span>)}
                  {n.attachments > 0 && <Icon name="Paperclip" size={13} label={`${n.attachments} anexo(s)`} />}
                </div>
                <span className="tiny muted">Atualizada em {fmtDateTime(n.updated_at)}</span>
              </article>
            ))}
          </div>
        )}
      </div>
      {panels}
    </div>
  );
}
