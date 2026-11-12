// Visões personalizadas dos módulos familiares: cardápio, álbum, árvore, despensa, mural e aniversários.
import { useMemo, useRef, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { listAll, useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { EmptyState, ErrorState, Loading, Modal } from "../../components/ui";
import { Thumb, uploadFiles } from "../../components/Attachments";
import { addDays, fmtDate, fmtDateTime, num, parseISO, startOfWeek, toISODate, today, weekdayShort } from "../../utils/format";
import { MEAL } from "../registry";
import { canCreate } from "../ModulePage";
import type { DetailProps, ModuleViewProps, Rec } from "../types";
import { useChangedSignal, useRecordUi } from "./common";

// ---------------- Cardápio semanal ----------------
export function MenuView({ mod, ws }: ModuleViewProps) {
  const { can, toast } = useApp();
  const [start, setStart] = useState(() => addDays(startOfWeek(new Date()), 1)); // segunda-feira
  const from = toISODate(start);
  const to = toISODate(addDays(start, 6));
  const { data, loading, error, reload } = useAsync(async () => {
    const [menus, recipes] = await Promise.all([listAll("menu", ws, { from, to }), listAll("recipes", ws)]);
    return { menus, recipes };
  }, [from, to, ws]);
  useChangedSignal(reload);
  const ui = useRecordUi(mod, ws, reload);
  const [ing, setIng] = useState<{ items: Rec[]; menus_without_recipe: string[] } | null>(null);
  const [lists, setLists] = useState<Rec[]>([]);
  const [target, setTarget] = useState("");
  const [newList, setNewList] = useState("");
  const editable = canCreate(mod, ws, can);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const recipeName = (id?: string) => data?.recipes.find((r) => r.id === id)?.title;

  const generate = async () => {
    try {
      const r = await call<{ items: Rec[]; menus_without_recipe: string[] }>("menu.ingredients", { from, to });
      setIng(r);
      const ls = await listAll("shopping_lists", "family", { filters: { status: "aberta" } }).catch(() => []);
      setLists(ls.filter((l) => l.scope === "family"));
      setTarget("");
      setNewList(`Compras da semana ${fmtDate(from)}`);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const addToList = async () => {
    try {
      let id = target;
      if (!id) {
        const l = await call<Rec>("rec.create", { entity: "shopping_lists", scope: "family", values: { title: newList.trim() || "Ingredientes do cardápio", status: "aberta", category: "Cardápio" } });
        id = l.id;
      }
      const r = await call<{ items: Rec[] }>("menu.ingredients", { from, to, add_to_list: id });
      toast(`${r.items.length} ingrediente(s) adicionados à lista de compras.`);
      setIng(null);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="stack">
      <div className="toolbar">
        <button className="btn icon" aria-label="Semana anterior" onClick={() => setStart(addDays(start, -7))}><Icon name="ChevronLeft" /></button>
        <b>{fmtDate(from)} – {fmtDate(to)}</b>
        <button className="btn icon" aria-label="Próxima semana" onClick={() => setStart(addDays(start, 7))}><Icon name="ChevronRight" /></button>
        <button className="btn sm ghost" onClick={() => setStart(addDays(startOfWeek(new Date()), 1))}>Esta semana</button>
        <span className="grow" />
        <button className="btn" onClick={generate} disabled={!data?.menus.length}><Icon name="ShoppingCart" size={16} /> Gerar lista de ingredientes</button>
      </div>
      {loading && !data ? <Loading /> : (
        <div className="card card-pad">
          <div className="menu-grid" role="grid" aria-label="Cardápio da semana">
            <span />
            {days.map((d) => <div key={d.toISOString()} className={`mh ${toISODate(d) === today() ? "today" : ""}`}>{weekdayShort[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}</div>)}
            {MEAL.map((meal) => (
              <div key={meal.value} style={{ display: "contents" }}>
                <div className="ml">{meal.label}</div>
                {days.map((d) => {
                  const ds = toISODate(d);
                  const here = (data?.menus ?? []).filter((m) => (m.date_start ?? "").slice(0, 10) === ds && (m.category ?? "almoco") === meal.value);
                  return (
                    <div key={ds} className="menu-cell" role="gridcell"
                      onClick={(e) => { if (e.target === e.currentTarget && editable) ui.create({ date_start: ds, category: meal.value }); }}
                      onKeyDown={(e) => { if (e.key === "Enter" && e.target === e.currentTarget && editable) ui.create({ date_start: ds, category: meal.value }); }}
                      tabIndex={editable ? 0 : -1} aria-label={`${meal.label} de ${fmtDate(ds)}${here.length ? "" : " (vazio)"}`}>
                      {here.map((m) => (
                        <button key={m.id} className="menu-item" onClick={() => ui.open(m.id)}>
                          <b>{m.title}</b>{m.ref_id && <div className="tiny muted">{recipeName(m.ref_id) ?? "Receita"}</div>}
                        </button>
                      ))}
                      {!here.length && editable && <span aria-hidden>+ Adicionar</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
      {ing && (
        <Modal title="Ingredientes da semana" onClose={() => setIng(null)}
          footer={<><button className="btn" onClick={() => setIng(null)}>Fechar</button>
            {ing.items.length > 0 && can("shopping.create") && <button className="btn primary" onClick={addToList}>Adicionar à lista de compras</button>}</>}>
          <div className="col">
            {ing.menus_without_recipe.length > 0 && <div className="alert warning small">Refeições sem receita vinculada (não entram na lista): {ing.menus_without_recipe.join(", ")}.</div>}
            {ing.items.length === 0 ? <p className="muted">Nenhum ingrediente. Vincule receitas com ingredientes às refeições.</p> : (
              <table className="table">
                <thead><tr><th>Ingrediente</th><th className="num">Quantidade</th></tr></thead>
                <tbody>{ing.items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="num">{num(i.quantity, 2)} {i.unit}</td></tr>)}</tbody>
              </table>
            )}
            {ing.items.length > 0 && can("shopping.create") && (
              <div className="row wrap">
                <select className="input" style={{ maxWidth: 280 }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Lista de destino">
                  <option value="">Criar nova lista</option>
                  {lists.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
                {!target && <input className="input grow" value={newList} onChange={(e) => setNewList(e.target.value)} aria-label="Nome da nova lista" />}
              </div>
            )}
          </div>
        </Modal>
      )}
      {ui.ui}
    </div>
  );
}

// ---------------- Álbum de fotos ----------------
export function AlbumDetail({ record, reload }: DetailProps) {
  const { toast, confirm, perm, can } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Rec | null>(null);
  const [caption, setCaption] = useState("");
  const { data, loading, reload: reloadPhotos } = useAsync(
    () => call<{ items: Rec[] }>("rec.list", { entity: "photo", scope: "family", filters: { parent_id: record.id }, sort: "date_start DESC", page_size: 500 }),
    [record.id],
  );
  const photos = data?.items ?? [];
  const canAdd = record.can_edit || can("memories.create");
  const ids = useAsync(async () => {
    const out: Record<string, string> = {};
    await Promise.all(photos.map(async (p) => {
      const r = await call<{ items: Rec[] }>("attach.list", { entity: "photo", record_id: p.id }).catch(() => ({ items: [] }));
      const img = r.items.find((a) => a.mime?.startsWith("image/"));
      if (img) out[p.id] = img.id;
    }));
    return out;
  }, [photos.map((p) => p.id).join(",")]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let n = 0;
    try {
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const name = f.name.replace(/\.[^.]+$/, "");
        const d = f.lastModified ? toISODate(new Date(f.lastModified)) : today();
        const p = await call<Rec>("rec.create", { entity: "photo", values: { parent_id: record.id, title: name.slice(0, 200) || "Foto", date_start: d } });
        try {
          await uploadFiles("photo", p.id, [f]);
        } catch (e) {
          await call("rec.delete", { entity: "photo", id: p.id }).catch(() => {});
          throw e;
        }
        n++;
      }
      toast(`${n} foto(s) importada(s).`);
      reloadPhotos();
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="col" aria-label="Fotos do álbum">
      <div className="row between">
        <h3 className="row"><Icon name="Camera" size={17} /> Fotos ({photos.length})</h3>
        {canAdd && (
          <>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} aria-label="Selecionar fotos" data-testid="album-upload" />
            <button className="btn sm" disabled={busy} onClick={() => input.current?.click()}><Icon name="Upload" size={15} /> {busy ? "Importando…" : "Importar fotos"}</button>
          </>
        )}
      </div>
      {loading ? <Loading /> : !photos.length ? <p className="muted small">Nenhuma foto. As imagens são copiadas para a pasta local do aplicativo.</p> : (
        <div className="photo-grid">
          {photos.map((p) => (
            <figure key={p.id}>
              {ids.data?.[p.id] ? <Thumb id={ids.data[p.id]} alt={p.title} /> : <div className="skeleton" style={{ height: 140 }} />}
              <figcaption className="row">
                <span className="grow ellipsis" title={p.title}>{p.title}<span className="tiny muted"> · {fmtDate(p.date_start)}</span></span>
                {(p.owner_id === perm.user_id || can("memories.manage")) && (
                  <>
                    <button className="btn icon sm ghost" aria-label={`Editar legenda de ${p.title}`} onClick={() => { setEditing(p); setCaption(p.title); }}><Icon name="Pencil" size={13} /></button>
                    <button className="btn icon sm ghost" aria-label={`Excluir ${p.title}`} onClick={async () => {
                      if (await confirm({ title: "Excluir foto?", message: `"${p.title}" será movida para a lixeira.`, confirmLabel: "Excluir", danger: true })) {
                        await call("rec.delete", { entity: "photo", id: p.id });
                        reloadPhotos();
                        reload();
                      }
                    }}><Icon name="Trash2" size={13} /></button>
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {editing && (
        <Modal size="sm" title="Legenda da foto" onClose={() => setEditing(null)}
          footer={<><button className="btn" onClick={() => setEditing(null)}>Cancelar</button><button className="btn primary" disabled={!caption.trim()} onClick={async () => {
            try { await call("rec.update", { entity: "photo", id: editing.id, values: { title: caption.trim() } }); setEditing(null); reloadPhotos(); } catch (e) { toast((e as Error).message, "error"); }
          }}>Salvar</button></>}>
          <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} aria-label="Legenda" maxLength={200} />
        </Modal>
      )}
    </section>
  );
}

// ---------------- Árvore genealógica ----------------
export function TreeView({ mod, ws }: ModuleViewProps) {
  const { can } = useApp();
  const { data, loading, error, reload } = useAsync(() => listAll("person", ws), [ws]);
  useChangedSignal(reload);
  const ui = useRecordUi(mod, ws, reload);
  const gens = useMemo(() => {
    const people = data ?? [];
    const byId = new Map(people.map((p) => [p.id, p]));
    const parents = (p: Rec) => [p.data?.parent1, p.data?.parent2].filter((x) => x && byId.has(x)) as string[];
    const level = new Map<string, number>();
    const calc = (id: string, seen: Set<string>): number => {
      if (level.has(id)) return level.get(id)!;
      if (seen.has(id)) return 0;
      seen.add(id);
      const ps = parents(byId.get(id)!);
      const l = ps.length ? Math.max(...ps.map((x) => calc(x, seen))) + 1 : 0;
      level.set(id, l);
      return l;
    };
    people.forEach((p) => calc(p.id, new Set()));
    // cônjuges no mesmo nível (o maior dos dois)
    for (let i = 0; i < 3; i++) for (const p of people) {
      const s = p.data?.spouse;
      if (s && level.has(s)) { const m = Math.max(level.get(p.id)!, level.get(s)!); level.set(p.id, m); level.set(s, m); }
    }
    const max = Math.max(0, ...Array.from(level.values()));
    const out: Rec[][][] = [];
    for (let g = 0; g <= max; g++) {
      const inGen = people.filter((p) => level.get(p.id) === g).sort((a, b) => String(a.date_start ?? "").localeCompare(String(b.date_start ?? "")));
      const used = new Set<string>();
      const groups: Rec[][] = [];
      for (const p of inGen) {
        if (used.has(p.id)) continue;
        used.add(p.id);
        const sp = inGen.find((x) => !used.has(x.id) && (x.id === p.data?.spouse || x.data?.spouse === p.id));
        if (sp) { used.add(sp.id); groups.push([p, sp]); } else groups.push([p]);
      }
      out.push(groups);
    }
    return { out, byId };
  }, [data]);

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  const editable = canCreate(mod, ws, can);
  const name = (id?: string) => (id ? gens.byId.get(id)?.title : undefined);
  return (
    <div className="stack">
      {!data?.length ? (
        <div className="card"><EmptyState icon="GitFork" title={mod.emptyTitle!} text={mod.emptyText} action={editable ? <button className="btn primary" onClick={() => ui.create()}><Icon name="Plus" size={16} /> Adicionar pessoa</button> : undefined} /></div>
      ) : (
        <div className="card card-pad">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="muted small">Gerações calculadas a partir dos pais/mães informados. Clique em uma pessoa para ver ou editar.</span>
            {editable && <button className="btn sm" onClick={() => ui.create()}><Icon name="Plus" size={15} /> Adicionar pessoa</button>}
          </div>
          <div className="tree" role="tree" aria-label="Árvore genealógica">
            {gens.out.map((groups, g) => (
              <div key={g} className="col" style={{ gap: 6 }} role="group" aria-label={`${g + 1}ª geração`}>
                <div className="tree-gen-label">{g + 1}ª geração</div>
                <div className="tree-gen">
                  {groups.map((grp) => (
                    <div key={grp[0].id} className={`tree-couple ${grp.length > 1 ? "pair" : ""}`}>
                      {grp.map((p, i) => (
                        <span key={p.id} className="row" style={{ gap: 6 }}>
                          {i > 0 && <Icon name="Link2" size={14} label="cônjuge" />}
                          <button className={`tree-person ${p.date_end ? "dead" : ""}`} role="treeitem" onClick={() => ui.open(p.id)}>
                            <b>{p.title}</b>
                            <div className="tiny muted">{p.date_start ? fmtDate(p.date_start) : "?"}{p.date_end ? ` – ${fmtDate(p.date_end)}` : ""}</div>
                            {(p.data?.parent1 || p.data?.parent2) && <div className="tiny muted">Filho(a) de {[name(p.data.parent1), name(p.data.parent2)].filter(Boolean).join(" e ")}</div>}
                          </button>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {ui.ui}
    </div>
  );
}

// ---------------- Despensa ----------------
export function PantryView({ mod, ws }: ModuleViewProps) {
  const { can, toast, perm } = useApp();
  const [q, setQ] = useState("");
  const { data, loading, error, reload } = useAsync(() => listAll("pantry", ws, { q: q || undefined, sort: "date_end ASC" }), [ws, q]);
  useChangedSignal(reload);
  const ui = useRecordUi(mod, ws, reload);
  const t = today();
  const soon = toISODate(addDays(new Date(), 7));
  const adjust = async (r: Rec, d: number) => {
    try {
      await call("rec.update", { entity: "pantry", id: r.id, values: { amount: Math.max(0, Math.round(((Number(r.amount) || 0) + d) * 100) / 100) } });
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const canEdit = (r: Rec) => r.owner_id === perm.user_id ? can("home.create") : can("home.manage");
  const items = data ?? [];
  const expired = items.filter((r) => r.date_end && r.date_end < t).length;
  const expiring = items.filter((r) => r.date_end && r.date_end >= t && r.date_end <= soon).length;
  const low = items.filter((r) => r.data?.min_qty != null && Number(r.amount ?? 0) <= Number(r.data.min_qty)).length;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  return (
    <div className="stack">
      <div className="stats">
        <div className="card card-pad stat"><b>{items.length}</b><span>Produtos</span></div>
        <div className="card card-pad stat"><b style={{ color: expiring ? "var(--warning)" : undefined }}>{expiring}</b><span>Vencem em 7 dias</span></div>
        <div className="card card-pad stat"><b style={{ color: expired ? "var(--danger)" : undefined }}>{expired}</b><span>Vencidos</span></div>
        <div className="card card-pad stat"><b>{low}</b><span>Estoque baixo</span></div>
      </div>
      <div className="toolbar">
        <div className="search-input grow" style={{ maxWidth: 360 }}><Icon name="Search" size={16} /><input className="input" placeholder="Pesquisar na despensa…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Pesquisar na despensa" /></div>
      </div>
      {loading && !data ? <Loading /> : !items.length ? (
        <div className="card"><EmptyState icon="Package" title={q ? "Nada encontrado" : mod.emptyTitle!} text={q ? undefined : mod.emptyText} action={!q && canCreate(mod, ws, can) ? <button className="btn primary" onClick={() => ui.create()}><Icon name="Plus" size={16} /> Adicionar produto</button> : undefined} /></div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Produto</th><th className="num">Quantidade</th><th>Validade</th><th>Categoria</th><th>Local</th></tr></thead>
            <tbody>
              {items.map((r) => {
                const isExp = r.date_end && r.date_end < t;
                const isSoon = r.date_end && !isExp && r.date_end <= soon;
                const isLow = r.data?.min_qty != null && Number(r.amount ?? 0) <= Number(r.data.min_qty);
                return (
                  <tr key={r.id} className={`clickable pantry-row ${isExp ? "expired" : isLow ? "low" : ""}`} onClick={() => ui.open(r.id)}>
                    <td><div className="row"><b>{r.title}</b>{isExp && <span className="badge danger">Vencido</span>}{isSoon && <span className="badge warning">Vence em breve</span>}{isLow && <span className="badge warning">Estoque baixo</span>}</div></td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        {canEdit(r) && <button className="btn icon sm" aria-label={`Diminuir ${r.title}`} onClick={() => adjust(r, -1)} disabled={!Number(r.amount)}><Icon name="Minus" size={14} /></button>}
                        <span style={{ minWidth: 54, textAlign: "center" }}>{num(r.amount, 2)} {r.data?.unit ?? ""}</span>
                        {canEdit(r) && <button className="btn icon sm" aria-label={`Aumentar ${r.title}`} onClick={() => adjust(r, 1)}><Icon name="Plus" size={14} /></button>}
                      </div>
                    </td>
                    <td>{r.date_end ? fmtDate(r.date_end) : <span className="muted">—</span>}</td>
                    <td>{r.category ? <span className="badge">{r.category}</span> : <span className="muted">—</span>}</td>
                    <td>{r.body ?? <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {ui.ui}
    </div>
  );
}

// ---------------- Mural ----------------
export function BoardView({ mod, ws }: ModuleViewProps) {
  const { can, perm, toast } = useApp();
  const { data, loading, error, reload } = useAsync(() => listAll("board_post", ws, { sort: "created_at DESC" }), [ws]);
  useChangedSignal(reload);
  const ui = useRecordUi(mod, ws, reload);
  const posts = useMemo(() => [...(data ?? [])].sort((a, b) => (Number(b.priority ?? 0) - Number(a.priority ?? 0)) || String(b.created_at).localeCompare(String(a.created_at))), [data]);
  const pin = async (p: Rec) => {
    try { await call("rec.update", { entity: "board_post", id: p.id, values: { priority: p.priority ? 0 : 1 } }); reload(); } catch (e) { toast((e as Error).message, "error"); }
  };
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!posts.length) return <div className="card"><EmptyState icon="Megaphone" title={mod.emptyTitle!} text={mod.emptyText} action={canCreate(mod, ws, can) ? <button className="btn primary" onClick={() => ui.create()}><Icon name="Plus" size={16} /> Publicar</button> : undefined} />{ui.ui}</div>;
  return (
    <div className="grid-auto">
      {posts.map((p) => (
        <article key={p.id} className={`card card-pad col post-card ${p.priority ? "pinned" : ""}`}>
          <div className="row between">
            <span className="row">{p.priority ? <Icon name="Pin" size={15} label="Fixado" style={{ color: "var(--primary)" }} /> : null}<span className="badge">{p.category ?? "aviso"}</span></span>
            {(p.owner_id === perm.user_id || can("social.manage")) && <button className="btn icon sm ghost" aria-label={p.priority ? "Desafixar" : "Fixar no topo"} title={p.priority ? "Desafixar" : "Fixar no topo"} onClick={() => pin(p)}><Icon name={p.priority ? "PinOff" : "Pin"} size={15} /></button>}
          </div>
          <button className="btn ghost" style={{ padding: 0, height: "auto", justifyContent: "flex-start", fontSize: "1.05rem", fontWeight: 650, whiteSpace: "normal", textAlign: "left" }} onClick={() => ui.open(p.id)}>{p.title}</button>
          {p.body && <p className="small" style={{ whiteSpace: "pre-wrap" }}>{p.body}</p>}
          <span className="tiny muted">{p.owner_name} · {fmtDateTime(p.created_at)}</span>
        </article>
      ))}
      {ui.ui}
    </div>
  );
}

// ---------------- Aniversários ----------------
export function BirthdayHeader({ ws }: ModuleViewProps) {
  const { data, reload } = useAsync(() => listAll("birthday", ws), [ws]);
  useChangedSignal(reload);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const upcoming = (data ?? []).map((b) => {
    const d = parseISO(b.date_start);
    if (!d) return null;
    let next = new Date(now.getFullYear(), d.getMonth(), d.getDate());
    if (next < now) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
    const days = Math.round((next.getTime() - now.getTime()) / 86400000);
    return { b, next, days, years: next.getFullYear() - d.getFullYear() };
  }).filter((x): x is NonNullable<typeof x> => !!x && x.days <= 60).sort((a, b) => a.days - b.days);
  if (!upcoming.length) return null;
  return (
    <section className="card card-pad" style={{ marginBottom: 14 }} aria-label="Próximos aniversários">
      <h3 className="row" style={{ marginBottom: 10 }}><Icon name="Cake" size={17} /> Próximos 60 dias</h3>
      <div className="row wrap">
        {upcoming.map(({ b, next, days, years }) => (
          <div key={b.id} className="card card-pad col" style={{ gap: 2, minWidth: 170, padding: 12 }}>
            <b>{b.title}</b>
            <span className="small">{weekdayShort[next.getDay()]}, {fmtDate(toISODate(next))}</span>
            <span className={`badge ${days === 0 ? "success" : days <= 7 ? "warning" : ""}`} style={{ alignSelf: "flex-start" }}>
              {days === 0 ? "Hoje!" : days === 1 ? "Amanhã" : `Em ${days} dias`}
            </span>
            {(b.category ?? "aniversario") === "aniversario" && years > 0 && <span className="tiny muted">Completa {years} ano(s)</span>}
            {b.category === "casamento" && years > 0 && <span className="tiny muted">{years} ano(s) de casamento</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
