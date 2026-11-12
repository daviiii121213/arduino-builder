// Página genérica de módulo: busca, filtros, lista/cartões/quadro, paginação,
// criação/edição, detalhes, compartilhamento, anexos, histórico e lixeira.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { call } from "../api/client";
import { useApp, type Workspace } from "../contexts/app";
import { useAsync } from "../hooks/data";
import { Icon } from "../components/Icon";
import { Drawer, EmptyState, ErrorState, Loading, Pager, Segmented } from "../components/ui";
import { Attachments } from "../components/Attachments";
import { RecordForm } from "./RecordForm";
import { ChildrenPanel, HistoryPanel, LogsPanel } from "./panels";
import { cell } from "./cells";
import type { ModuleDef, Rec } from "./types";
import { cx } from "../utils/cx";
import { fmtDateTime } from "../utils/format";
import { emptyArt } from "../assets";

const PAGE = 30;

export function canCreate(mod: ModuleDef, ws: Workspace, can: (k: string) => boolean) {
  return ws === "personal" || can(`${mod.area}.create`);
}

/** Painel de detalhes de um registro. */
export function RecordDrawer({ mod, ws, id, onClose, onChanged, onEdit }: { mod: ModuleDef; ws: Workspace; id: string; onClose: () => void; onChanged: () => void; onEdit: (r: Rec) => void }) {
  const { toast, confirm, perm } = useApp();
  const { data: r, loading, error, reload } = useAsync(() => call<Rec>("rec.get", { entity: mod.entity, id }), [mod.entity, id]);
  const changed = useCallback(() => { reload(); onChanged(); }, [reload, onChanged]);

  if (loading && !r) return <Drawer title="Carregando…" onClose={onClose}><Loading /></Drawer>;
  if (error || !r) return <Drawer title="Registro" onClose={onClose}><ErrorState message={error ?? "Registro não encontrado."} onRetry={reload} /></Drawer>;

  const canEdit = !!r.can_edit;
  const sharedFromOther = r.scope === "personal" && r.owner_id !== perm.user_id;
  const del = async () => {
    if (!(await confirm({ title: `Excluir ${mod.singular.toLowerCase()}?`, message: <>“{r.title}” será movido para a lixeira. Você pode restaurá-lo em Configurações › Lixeira.</>, confirmLabel: "Mover para a lixeira", danger: true }))) return;
    try {
      await call("rec.delete", { entity: mod.entity, id });
      toast("Movido para a lixeira.");
      onChanged();
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const share = async (on: boolean) => {
    const ok = await confirm({
      title: on ? "Compartilhar com a família?" : "Cancelar compartilhamento?",
      message: on ? <>“{r.title}” ficará visível no ambiente <b>FAMÍLIA</b> para os integrantes com permissão. Somente você poderá editá-lo.</> : <>“{r.title}” deixará de aparecer no ambiente FAMÍLIA e voltará a ser apenas pessoal.</>,
      confirmLabel: on ? "Compartilhar" : "Cancelar compartilhamento",
    });
    if (!ok) return;
    try {
      await call(on ? "rec.share" : "rec.unshare", { entity: mod.entity, id });
      toast(on ? "Compartilhado com a família." : "Compartilhamento cancelado.");
      changed();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const Detail = mod.detail;
  const shown = mod.fields.filter((f) => (!f.workspaces || f.workspaces.includes(ws)) && !["title"].includes(f.key));
  return (
    <Drawer title={r.title} onClose={onClose}
      actions={canEdit && (
        <>
          <button className="btn sm" onClick={() => onEdit(r)}><Icon name="Pencil" size={15} /> Editar</button>
          {(r.owner_id === perm.user_id || ws === "family") && <button className="btn icon sm ghost" aria-label="Excluir" title="Excluir" onClick={del}><Icon name="Trash2" size={16} /></button>}
        </>
      )}>
      <div className="stack">
        <div className="row wrap">
          <span className={cx("badge", r.scope === "family" ? "accent" : "primary")}>{r.scope === "family" ? "FAMÍLIA" : "PESSOAL"}</span>
          {r.shared && <span className="badge accent"><Icon name="Share2" size={12} /> Compartilhado com a família</span>}
          {sharedFromOther && <span className="badge">Compartilhado por {r.owner_name} · somente leitura</span>}
          {ws === "family" && r.owner_name && <span className="badge">Criado por {r.owner_name}</span>}
          <span className="muted tiny">Atualizado em {fmtDateTime(r.updated_at)}</span>
        </div>
        {mod.shareable && r.scope === "personal" && r.owner_id === perm.user_id && (
          <div className="alert" style={{ alignItems: "center" }}>
            <Icon name="Share2" />
            <div className="grow small">
              {r.shared ? <>Este registro está <b>compartilhado</b> com a sua família.</> : perm.family_id ? <>Este registro é <b>privado</b>. Compartilhe para que a família veja.</> : <>Registro privado. Crie ou entre em uma família para compartilhar.</>}
            </div>
            {perm.family_id && <button className="btn sm" onClick={() => share(!r.shared)}>{r.shared ? "Cancelar compartilhamento" : "Compartilhar com a família"}</button>}
          </div>
        )}
        <dl className="form-grid" style={{ margin: 0 }}>
          {shown.map((f) => {
            const c = { key: f.key, label: f.label, type: f.type === "money" ? "money" : f.type === "date" ? "date" : f.type === "datetime" || f.type === "datetext" ? "datetime" : f.type === "priority" ? "priority" : f.type === "checkbox" ? "bool" : f.type === "member" ? "member" : f.type === "select" ? "badge" : undefined, options: f.options } as const;
            const raw = f.key.startsWith("data.") ? r.data?.[f.key.slice(5)] : r[f.key];
            if (raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && !raw.length)) return null;
            let content: ReactNode;
            if (f.type === "textarea") content = <p style={{ whiteSpace: "pre-wrap" }}>{String(raw)}</p>;
            else if (f.type === "stringlist") content = <ul style={{ margin: 0, paddingLeft: 18 }}>{(raw as string[]).map((s, i) => <li key={i}>{s}</li>)}</ul>;
            else if (f.type === "checklist") content = <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>{(raw as Rec[]).map((s, i) => <li key={i}><Icon name={s.done ? "CheckCircle2" : "Square"} size={14} /> {s.text}</li>)}</ul>;
            else if (f.type === "ingredients") content = <ul style={{ margin: 0, paddingLeft: 18 }}>{(raw as Rec[]).map((s, i) => <li key={i}>{s.quantity} {s.unit} {s.name}</li>)}</ul>;
            else if (f.type === "options") content = <ol style={{ margin: 0, paddingLeft: 18 }}>{(raw as Rec[]).map((s, i) => <li key={i}>{s.text}</li>)}</ol>;
            else if (f.type === "weekdays") content = (raw as number[]).map((d) => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d]).join(", ");
            else if (f.type === "members" || f.type === "restricted") content = <MemberNames ids={raw as string[]} />;
            else if (f.type === "color") content = <span className="dot" style={{ background: String(raw), width: 16, height: 16 }} />;
            else if (f.type === "ref") content = <RefName entity={f.ref!} id={String(raw)} />;
            else if (f.type === "rating") content = "★".repeat(Number(raw));
            else content = cell(c, r);
            return (
              <div key={f.key} className={cx("field", (f.full || f.type === "textarea") && "full")}>
                <dt className="label">{f.label}</dt>
                <dd style={{ margin: 0 }}>{content}</dd>
              </div>
            );
          })}
        </dl>
        {Detail && <Detail mod={mod} ws={ws} record={r} reload={changed} />}
        {mod.children?.map((c) => <ChildrenPanel key={c.entity} def={c} parentId={r.id} ws={ws} canEdit={canEdit} onChange={changed} />)}
        {mod.logs && <LogsPanel entity={mod.entity} id={r.id} label={mod.logs.label} kind={mod.logs.kind} valueLabel={mod.logs.valueLabel} noteLabel={mod.logs.noteLabel} canEdit={canEdit} />}
        {mod.attachments && <Attachments entity={mod.entity} recordId={r.id} canEdit={canEdit} onChange={onChanged} />}
        <HistoryPanel entity={mod.entity} id={r.id} />
      </div>
    </Drawer>
  );
}

function MemberNames({ ids }: { ids: string[] }) {
  const { data } = useAsync(() => call<{ items: Rec[] }>("family.members"), []);
  return <>{ids.map((id) => data?.items.find((m) => m.id === id)?.full_name ?? "Integrante").join(", ")}</>;
}

function RefName({ entity, id }: { entity: string; id: string }) {
  const { data } = useAsync(() => call<Rec>("rec.get", { entity, id }).catch(() => null), [entity, id]);
  return <>{data?.title ?? "—"}</>;
}

/** Quadro Kanban com arrastar e soltar (também operável por menu). */
function Board({ mod, items, onOpen, onMove }: { mod: ModuleDef; items: Rec[]; onOpen: (r: Rec) => void; onMove: (r: Rec, v: string) => void }) {
  const [over, setOver] = useState<string | null>(null);
  const b = mod.board!;
  return (
    <div className="kanban" style={{ gridTemplateColumns: `repeat(${b.columns.length}, minmax(220px, 1fr))` }}>
      {b.columns.map((col) => {
        const list = items.filter((r) => String(r[b.key]) === col.value);
        return (
          <div key={col.value} className={cx("kanban-col", over === col.value && "over")} onDragOver={(e) => { e.preventDefault(); setOver(col.value); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); const r = items.find((x) => x.id === id); if (r && String(r[b.key]) !== col.value) onMove(r, col.value); }}>
            <h4><span>{col.label}</span><span className="badge">{list.length}</span></h4>
            {list.map((r) => (
              <div key={r.id} className="k-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)} onDoubleClick={() => onOpen(r)}>
                <button className="btn ghost sm" style={{ padding: 0, height: "auto", fontWeight: 600, textAlign: "left", whiteSpace: "normal" }} onClick={() => onOpen(r)}>{r.title}</button>
                <div className="row wrap" style={{ marginTop: 6 }}>
                  {mod.columns.slice(0, 2).map((c) => <span key={c.key} className="tiny muted">{cell(c, r)}</span>)}
                </div>
                <select className="input" style={{ height: 28, marginTop: 6, fontSize: "0.8rem" }} aria-label={`Mover "${r.title}"`} value={String(r[b.key])} onChange={(e) => onMove(r, e.target.value)}>
                  {b.columns.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ModulePage({ mod, ws, embedded, baseFilters }: { mod: ModuleDef; ws: Workspace; embedded?: boolean; baseFilters?: Rec }) {
  const { can, toast, settings } = useApp();
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Rec>({});
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "cards" | "board">(mod.views?.[0] ?? "list");
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ record: Rec | null } | null>(null);
  const [unlocked, setUnlocked] = useState(!mod.protected || !settings.diary_lock);
  const [pw, setPw] = useState("");
  const [pwErr, setPwErr] = useState("");

  useEffect(() => { setPage(1); }, [q, filters, ws, mod.id]);
  useEffect(() => { setView(mod.views?.[0] ?? "list"); setFilters({}); setQ(""); setOpenId(null); }, [mod.id]);

  const allowed = ws === "personal" || can(`${mod.area}.view`);
  const args = useMemo(() => {
    const f: Rec = { ...(mod.baseFilters ?? {}), ...(baseFilters ?? {}) };
    for (const [k, v] of Object.entries(filters)) if (v !== "" && v !== undefined) f[k] = v === "true" ? true : v === "false" ? false : v;
    return { entity: mod.entity, scope: ws, q: q || undefined, filters: f, page: view === "board" ? 1 : page, page_size: view === "board" ? 300 : PAGE, sort: mod.sort };
  }, [mod, ws, q, filters, page, view, baseFilters]);
  const { data, loading, error, reload } = useAsync(
    () => (allowed && unlocked ? call<{ items: Rec[]; total: number }>("rec.list", args) : Promise.resolve({ items: [], total: 0 })),
    [JSON.stringify(args), allowed, unlocked],
  );

  // Ctrl+N cria registro no contexto atual
  useEffect(() => {
    const h = () => { if (canCreate(mod, ws, can) && unlocked) setForm({ record: null }); };
    window.addEventListener("plu:new", h);
    return () => window.removeEventListener("plu:new", h);
  }, [mod, ws, can, unlocked]);

  // abrir registro vindo da pesquisa global (#...?open=id)
  useEffect(() => {
    const m = /[?&]open=([^&]+)/.exec(window.location.hash);
    if (m) setOpenId(decodeURIComponent(m[1]));
  }, [mod.id]);

  const toggleDone = async (r: Rec) => {
    try {
      await call("rec.update", { entity: mod.entity, id: r.id, values: { status: r.status === "concluida" ? "pendente" : "concluida" } });
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (!allowed) {
    return <EmptyState icon="Lock" title="Sem permissão" text={`Você não tem permissão para visualizar ${mod.label.toLowerCase()} da família. Fale com o administrador.`} />;
  }
  if (!unlocked) {
    return (
      <div className="card card-pad" style={{ maxWidth: 420, margin: "40px auto" }}>
        <form className="col" onSubmit={async (e) => { e.preventDefault(); try { await call("auth.verify", { password: pw }); setUnlocked(true); } catch (err) { setPwErr((err as Error).message); } }}>
          <div className="row"><Icon name="Lock" /> <h2>{mod.label} protegido</h2></div>
          <p className="muted small">Digite a senha do seu perfil para abrir.</p>
          <input className="input" type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setPwErr(""); }} aria-label="Senha" aria-invalid={!!pwErr} />
          {pwErr && <span className="error small" role="alert" style={{ color: "var(--danger)" }}>{pwErr}</span>}
          <button className="btn primary">Desbloquear</button>
        </form>
      </div>
    );
  }

  const Header = mod.header;
  const Custom = mod.view;
  const items = data?.items ?? [];
  const showCreate = canCreate(mod, ws, can);

  return (
    <div>
      {!embedded && (
        <div className="page-head">
          <div className="title-block">
            <div className="page-icon" style={ws === "family" ? { color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" } : undefined}><Icon name={mod.icon} size={22} /></div>
            <div>
              <h1>{mod.label} <span className={cx("badge", ws === "family" ? "accent" : "primary")} style={{ verticalAlign: "middle" }}>{ws === "family" ? "FAMÍLIA" : "PESSOAL"}</span></h1>
              <p>{mod.description}</p>
            </div>
          </div>
          {showCreate && <button className="btn primary" onClick={() => setForm({ record: null })}><Icon name="Plus" size={17} /> {mod.newLabel ?? `Adicionar ${mod.singular.toLowerCase()}`}</button>}
        </div>
      )}
      {Header && <Header mod={mod} ws={ws} />}
      {Custom ? <Custom mod={mod} ws={ws} /> : (
        <>
          <div className="toolbar">
            <div className="search-input grow" style={{ maxWidth: 360 }}>
              <Icon name="Search" size={16} />
              <input className="input" placeholder={`Pesquisar em ${mod.label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Pesquisar em ${mod.label}`} />
            </div>
            {mod.filters?.map((f) => (
              <select key={f.key} className="input" style={{ width: "auto" }} value={filters[f.key] ?? ""} onChange={(e) => setFilters((s) => ({ ...s, [f.key]: e.target.value }))} aria-label={`Filtrar por ${f.label}`}>
                <option value="">{f.label}: todos</option>
                {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}
            <span className="grow" />
            {embedded && showCreate && <button className="btn primary" onClick={() => setForm({ record: null })}><Icon name="Plus" size={16} /> Novo</button>}
            {(mod.views?.length ?? 0) > 1 && (
              <Segmented label="Modo de visualização" value={view} onChange={setView}
                options={mod.views!.map((v) => ({ key: v, label: v === "list" ? "Lista" : v === "cards" ? "Cartões" : "Quadro", icon: v === "list" ? "List" : v === "cards" ? "LayoutGrid" : "Columns3" }))} />
            )}
          </div>
          {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? <Loading /> : items.length === 0 ? (
            <div className="card">
              <EmptyState image={emptyArt} title={q || Object.values(filters).some(Boolean) ? "Nada encontrado" : mod.emptyTitle ?? `Nenhum registro em ${mod.label}`}
                text={q || Object.values(filters).some(Boolean) ? "Ajuste a pesquisa ou os filtros." : mod.emptyText}
                action={showCreate && !q ? <button className="btn primary" onClick={() => setForm({ record: null })}><Icon name="Plus" size={16} /> Criar o primeiro</button> : undefined} />
            </div>
          ) : view === "board" && mod.board ? (
            <Board mod={mod} items={items} onOpen={(r) => setOpenId(r.id)} onMove={async (r, v) => { try { await call("rec.update", { entity: mod.entity, id: r.id, values: { [mod.board!.key]: v } }); reload(); } catch (e) { toast((e as Error).message, "error"); } }} />
          ) : view === "cards" ? (
            <div className="grid-auto">
              {items.map((r) => (
                <button key={r.id} className="card clickable card-pad col" onClick={() => setOpenId(r.id)} style={{ alignItems: "stretch", borderTop: r.color ? `3px solid ${r.color}` : undefined }}>
                  <div className="row between"><b className="ellipsis">{r.title}</b>{r.pinned && <Icon name="Pin" size={14} />}{r.shared && <Icon name="Share2" size={14} label="Compartilhado" />}</div>
                  {(r.content || r.body || r.description) && <p className="muted small" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.content || r.body || r.description}</p>}
                  <div className="row wrap">{mod.columns.map((c) => <span key={c.key} className="small">{cell(c, r)}</span>)}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="card table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {mod.entity === "tasks" && <th style={{ width: 36 }}><span className="sr-only">Concluída</span></th>}
                    <th>{mod.singular}</th>
                    {mod.columns.map((c) => <th key={c.key} className={c.type === "money" || c.type === "number" ? "num" : undefined}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.id} className="clickable" onClick={() => setOpenId(r.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && setOpenId(r.id)}>
                      {mod.entity === "tasks" && (
                        <td onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={r.status === "concluida"} onChange={() => toggleDone(r)} aria-label={`Concluir "${r.title}"`} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
                        </td>
                      )}
                      <td>
                        <div className="row">
                          {r.color && <span className="dot" style={{ background: r.color }} />}
                          <span style={{ fontWeight: 560, textDecoration: r.status === "concluida" ? "line-through" : undefined }}>{r.title}</span>
                          {r.is_late && <span className="badge danger">Atrasada</span>}
                          {r.shared && <span className="badge accent" title="Compartilhado"><Icon name="Share2" size={11} />{ws === "family" && r.owner_name ? ` ${r.owner_name}` : ""}</span>}
                          {r.subtasks_total > 0 && <span className="badge"><Icon name="ListChecks" size={11} /> {r.subtasks_done}/{r.subtasks_total}</span>}
                          {r.attachments > 0 && <Icon name="Paperclip" size={13} label={`${r.attachments} anexo(s)`} />}
                        </div>
                      </td>
                      {mod.columns.map((c) => <td key={c.key} className={c.type === "money" || c.type === "number" ? "num" : undefined}>{cell(c, r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view !== "board" && data && <Pager page={page} pageSize={PAGE} total={data.total} onPage={setPage} />}
        </>
      )}
      {openId && <RecordDrawer mod={mod} ws={ws} id={openId} onClose={() => setOpenId(null)} onChanged={reload} onEdit={(r) => setForm({ record: r })} />}
      {form && (
        <RecordForm entity={mod.entity} title={form.record ? `Editar ${mod.singular.toLowerCase()}` : `${mod.newLabel ?? `Adicionar ${mod.singular.toLowerCase()}`}`} fields={mod.fields} ws={ws}
          record={form.record} defaults={typeof mod.defaults === "function" ? mod.defaults() : mod.defaults}
          onClose={() => setForm(null)} onSaved={(r) => { setForm(null); reload(); window.dispatchEvent(new CustomEvent("plu:changed")); if (!form.record) setOpenId(r.id); else setOpenId(null); setTimeout(() => setOpenId(r.id), 0); }} />
      )}
    </div>
  );
}
