// Seções de detalhe dos módulos familiares: votação, conversa, viagem e responsabilidades.
import { useCallback, useEffect, useRef, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useMembers } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { Avatar, Loading, Progress } from "../../components/ui";
import { fmtDateTime, weekdayLong } from "../../utils/format";
import type { DetailProps, Rec } from "../types";
import { weekIndex } from "./common";

export function PollDetail({ record, reload }: DetailProps) {
  const { toast, can } = useApp();
  const options: Rec[] = record.data?.options ?? [];
  const multiple = !!record.data?.multiple;
  const mine: number[] = record.my_votes ?? [];
  const [sel, setSel] = useState<number[]>(mine);
  useEffect(() => setSel(record.my_votes ?? []), [record.my_votes]);
  const votes: Record<string, number> = record.votes ?? {};
  const total = Object.values(votes).reduce((a, b) => a + b, 0);
  const closed = !!record.closed;
  const vote = async () => {
    try {
      await call("poll.vote", { poll_id: record.id, options: sel });
      toast("Voto registrado.");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <section className="col" aria-label="Votação">
      <div className="row between">
        <h3 className="row"><Icon name="Vote" size={17} /> {closed ? "Resultado final" : "Votar"}</h3>
        <span className={`badge ${closed ? "" : "success"}`}>{closed ? "Encerrada" : "Aberta"} · {record.voters ?? 0} votante(s)</span>
      </div>
      {record.date_end && <p className="muted small">{closed ? "Encerrou" : "Encerra"} em {fmtDateTime(record.date_end)}.</p>}
      {options.map((o, i) => {
        const n = votes[String(i)] ?? 0;
        const pct = total ? (n / total) * 100 : 0;
        const isMine = mine.includes(i);
        return (
          <label key={i} className={`poll-opt ${isMine ? "mine" : ""}`}>
            <span className="row">
              {!closed && (
                <input type={multiple ? "checkbox" : "radio"} name={`poll-${record.id}`} checked={sel.includes(i)}
                  onChange={(e) => setSel(multiple ? (e.target.checked ? [...sel, i] : sel.filter((x) => x !== i)) : [i])} />
              )}
              <b className="grow">{o.text}</b>
              {isMine && <span className="badge primary">Seu voto</span>}
              <span className="small">{n} voto(s) · {Math.round(pct)}%</span>
            </span>
            <Progress value={pct} tone="accent" label={`${o.text}: ${Math.round(pct)}%`} />
          </label>
        );
      })}
      {!closed && can("social.create") && (
        <button className="btn primary" style={{ alignSelf: "flex-start" }} disabled={!sel.length} onClick={vote}>{mine.length ? "Alterar voto" : "Confirmar voto"}</button>
      )}
      {!closed && !can("social.create") && <p className="muted small">Você não tem permissão para votar.</p>}
    </section>
  );
}

export function ConversationDetail({ record }: DetailProps) {
  const { perm, toast, confirm, can } = useApp();
  const [items, setItems] = useState<Rec[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const r = await call<{ items: Rec[] }>("rec.list", { entity: "message", scope: "family", filters: { parent_id: record.id }, sort: "created_at ASC", page_size: 500 });
      setItems((old) => (JSON.stringify(old?.map((x) => x.id)) === JSON.stringify(r.items.map((x) => x.id)) ? old : r.items));
    } catch {
      /* sem acesso */
    }
  }, [record.id]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [items]);
  const send = async () => {
    const b = text.trim();
    if (!b || busy) return;
    setBusy(true);
    try {
      await call("rec.create", { entity: "message", values: { parent_id: record.id, body: b } });
      setText("");
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="col" aria-label="Mensagens">
      <h3 className="row"><Icon name="MessageCircle" size={17} /> Mensagens</h3>
      <p className="tiny muted">As mensagens ficam somente nos perfis deste computador; nada é enviado pela internet.</p>
      <div className="chat-box" ref={box}>
        {!items ? <Loading /> : items.length === 0 ? <p className="muted small" style={{ padding: 12 }}>Nenhuma mensagem ainda. Escreva a primeira.</p> : (
          <div className="chat">
            {items.map((m) => {
              const me = m.owner_id === perm.user_id;
              return (
                <div key={m.id} className={`bubble ${me ? "me" : ""}`}>
                  <div className="meta">
                    {!me && <Avatar name={m.owner_name} color={m.owner_color} size="sm" />}
                    <b>{me ? "Você" : m.owner_name}</b> · {fmtDateTime(m.created_at)}
                    {(me || can("social.manage")) && (
                      <button className="btn icon sm ghost" style={{ width: 22, height: 22 }} aria-label="Excluir mensagem" onClick={async () => {
                        if (await confirm({ title: "Excluir mensagem?", message: "A mensagem será removida da conversa.", confirmLabel: "Excluir", danger: true })) {
                          await call("rec.delete", { entity: "message", id: m.id });
                          load();
                        }
                      }}><Icon name="Trash2" size={12} /></button>
                    )}
                  </div>
                  <p>{m.body}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {can("social.create") ? (
        <div className="row">
          <textarea className="input" style={{ minHeight: 44, height: 44 }} placeholder="Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)" value={text} aria-label="Nova mensagem"
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn primary" onClick={send} disabled={!text.trim() || busy}>Enviar</button>
        </div>
      ) : <p className="muted small">Você não tem permissão para enviar mensagens.</p>}
    </section>
  );
}

export function TripDetail({ record, reload, ws }: DetailProps) {
  const { toast } = useApp();
  const members = useMembers(ws);
  const list: Rec[] = record.data?.checklist ?? [];
  const parts: string[] = record.data?.participants ?? [];
  const toggle = async (i: number) => {
    const next = list.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
    try {
      await call("rec.update", { entity: "trip", id: record.id, values: { data: { ...record.data, checklist: next } } });
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const done = list.filter((x) => x.done).length;
  return (
    <section className="col" aria-label="Checklist da viagem">
      {parts.length > 0 && (
        <div className="row wrap"><span className="label">Participantes:</span>{parts.map((p) => <span key={p} className="badge">{members.find((m) => m.id === p)?.full_name ?? "Integrante"}</span>)}</div>
      )}
      <div className="row between"><h3 className="row"><Icon name="ListChecks" size={17} /> Checklist</h3>{list.length > 0 && <span className="badge">{done}/{list.length}</span>}</div>
      {list.length === 0 ? <p className="muted small">Adicione itens ao checklist editando a viagem.</p> : (
        <>
          <Progress value={(done / list.length) * 100} tone="accent" />
          <div className="list card">
            {list.map((it, i) => (
              <label key={i} className={`list-item ${it.done ? "done" : ""}`} style={{ cursor: record.can_edit ? "pointer" : undefined }}>
                <input type="checkbox" checked={!!it.done} disabled={!record.can_edit} onChange={() => toggle(i)} style={{ width: 18, height: 18, accentColor: "var(--primary)" }} />
                <span className="title">{it.text}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function DutyDetail({ record, ws }: DetailProps) {
  const members = useMembers(ws);
  const rot: string[] = record.data?.rotation ?? [];
  const days: number[] = record.data?.weekdays ?? [];
  const name = (id?: string) => members.find((m) => m.id === id)?.full_name ?? "—";
  const w = weekIndex(new Date());
  const current = rot.length ? rot[((w % rot.length) + rot.length) % rot.length] : record.assignee_id;
  const next = rot.length ? rot[(((w + 1) % rot.length) + rot.length) % rot.length] : record.assignee_id;
  return (
    <section className="col" aria-label="Escala">
      <h3 className="row"><Icon name="Repeat" size={17} /> Escala</h3>
      <div className="grid-2">
        <div className="card card-pad stat"><span>Responsável nesta semana</span><b style={{ fontSize: "1.1rem" }}>{name(current)}</b></div>
        <div className="card card-pad stat"><span>Próxima semana</span><b style={{ fontSize: "1.1rem" }}>{name(next)}</b></div>
      </div>
      <p className="small">{days.length ? <>Dias: {days.map((d) => weekdayLong[d]).join(", ")}.</> : "Sem dias específicos definidos."}</p>
      {rot.length > 0 && <p className="muted small">Rodízio semanal entre: {rot.map(name).join(" → ")}.</p>}
    </section>
  );
}
