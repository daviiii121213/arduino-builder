// Leitura: livros em andamento, atualização de página e histórico.
import { useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { Progress } from "../../components/ui";
import { fmtDate, today } from "../../utils/format";
import type { ModuleViewProps, Rec } from "../types";
import { useChanged } from "./common";

function BookCard({ b, onChanged }: { b: Rec; onChanged: () => void }) {
  const { toast } = useApp();
  const [page, setPage] = useState(String(b.data?.current_page ?? ""));
  const [show, setShow] = useState(false);
  const total = Number(b.data?.total_pages ?? 0);
  const logs = useAsync(() => (show ? call<{ items: Rec[] }>("log.list", { entity: "book", record_id: b.id }) : Promise.resolve({ items: [] as Rec[] })), [show, b.id, b.progress]);
  const save = async () => {
    const p = Math.max(0, Math.round(Number(page)));
    if (!Number.isFinite(p)) return;
    if (total && p > total) { toast(`O livro tem ${total} páginas.`, "error"); return; }
    try {
      const progress = total ? Math.round((p / total) * 1000) / 10 : b.progress ?? null;
      const done = total > 0 && p >= total;
      await call("rec.update", { entity: "book", id: b.id, values: { data: { ...(b.data ?? {}), current_page: p }, progress, ...(done ? { status: "lido", date_end: today() } : {}) } });
      toast(done ? `"${b.title}" concluído! Movido para lidos.` : "Leitura atualizada.");
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <div className="card card-pad col reading-card">
      <b className="ellipsis" title={b.title}>{b.title}</b>
      <span className="muted small">{b.data?.author ?? "Autor não informado"}</span>
      <div className="row"><div className="grow"><Progress value={Number(b.progress ?? 0)} label={`Leitura de ${b.title}`} /></div><span className="tiny">{Math.round(Number(b.progress ?? 0))}%</span></div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="sr-only" htmlFor={`pg-${b.id}`}>Página atual de {b.title}</label>
        <input id={`pg-${b.id}`} className="input" type="number" min={0} value={page} onChange={(e) => setPage(e.target.value)} style={{ width: 100 }} />
        <span className="small muted">{total ? `de ${total}` : "páginas"}</span>
        <button className="btn sm primary">Atualizar</button>
      </form>
      <button className="btn sm ghost" style={{ alignSelf: "flex-start" }} aria-expanded={show} onClick={() => setShow(!show)}><Icon name="History" size={14} /> Histórico</button>
      {show && (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {(logs.data?.items ?? []).length === 0 ? <li className="muted">Sem registros.</li> : logs.data!.items.slice(0, 8).map((l) => (
            <li key={l.id}>{fmtDate(l.log_date)}: {l.kind === "progresso" ? `${Math.round(Number(l.value))}% lido` : l.note ?? `página ${l.value}`}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ReadingHeader({ ws }: ModuleViewProps) {
  const { data, reload } = useAsync(() => call<{ items: Rec[] }>("rec.list", { entity: "book", scope: ws, filters: { status: "lendo" }, page_size: 50 }), [ws]);
  useChanged(reload);
  const items = data?.items ?? [];
  const changed = () => { reload(); window.dispatchEvent(new CustomEvent("plu:changed")); };
  return (
    <section style={{ marginBottom: 16 }} aria-label="Leitura em andamento">
      <h3 className="row" style={{ marginBottom: 8 }}><Icon name="BookOpen" size={17} /> Lendo agora</h3>
      {items.length === 0 ? (
        <p className="muted small">Nenhum livro com situação "Lendo". Marque um livro como "Lendo" para acompanhar as páginas aqui.</p>
      ) : (
        <div className="grid-auto">{items.map((b) => <BookCard key={`${b.id}-${b.updated_at}`} b={b} onChanged={changed} />)}</div>
      )}
    </section>
  );
}
