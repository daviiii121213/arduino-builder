// Revisão de vocabulário (cartões): revelar tradução e agendar a próxima revisão.
import { useMemo, useState } from "react";
import { call } from "../../api/client";
import { useApp } from "../../contexts/app";
import { useAsync } from "../../hooks/data";
import { Icon } from "../../components/Icon";
import { addDays, today, toISODate } from "../../utils/format";
import type { DetailProps, Rec } from "../types";

export function VocabReview({ record, reload }: DetailProps) {
  const { toast } = useApp();
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const { data, reload: again } = useAsync(
    () => call<{ items: Rec[] }>("rec.list", { entity: "vocab", scope: "personal", filters: { parent_id: record.id }, page_size: 500 }),
    [record.id, record.children_total],
  );
  const t = today();
  const due = useMemo(() => (data?.items ?? []).filter((v) => v.status !== "dominado" && (!v.date_start || v.date_start <= t)), [data, t]);
  const counts = useMemo(() => {
    const c = { novo: 0, aprendendo: 0, dominado: 0 } as Record<string, number>;
    for (const v of data?.items ?? []) c[v.status || "novo"] = (c[v.status || "novo"] ?? 0) + 1;
    return c;
  }, [data]);
  const card = due[idx];

  const answer = async (status: string, days: number) => {
    if (!card) return;
    try {
      await call("rec.update", { entity: "vocab", id: card.id, values: { status, date_start: toISODate(addDays(new Date(), days)) } });
      setReviewed((n) => n + 1);
      setReveal(false);
      if (idx >= due.length - 1) setIdx(0);
      again();
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <section className="card card-pad col" aria-label="Revisão de vocabulário">
      <div className="row between">
        <h3 className="row"><Icon name="Languages" size={17} /> Revisão</h3>
        <span className="small muted">{counts.novo ?? 0} novas · {counts.aprendendo ?? 0} aprendendo · {counts.dominado ?? 0} dominadas</span>
      </div>
      {!active ? (
        <div className="row">
          <span className="grow small">{due.length ? `${due.length} palavra(s) para revisar hoje.` : "Nenhuma palavra pendente de revisão hoje."}</span>
          <button className="btn primary" disabled={!due.length} onClick={() => { setActive(true); setIdx(0); setReveal(false); setReviewed(0); }}><Icon name="Play" size={15} /> Revisar</button>
        </div>
      ) : !card ? (
        <div className="row"><span className="grow">Revisão concluída: {reviewed} palavra(s). </span><button className="btn" onClick={() => setActive(false)}>Fechar</button></div>
      ) : (
        <div className="col flashcard" aria-live="polite">
          <span className="tiny muted">Cartão {Math.min(idx + 1, due.length)} de {due.length}</span>
          <div className="flash-word">{card.title}</div>
          {reveal ? (
            <>
              <div className="flash-trans">{card.body || <span className="muted">Sem tradução cadastrada</span>}</div>
              {card.data?.example && <p className="muted small">“{card.data.example}”</p>}
              <div className="row wrap" style={{ justifyContent: "center" }}>
                <button className="btn" onClick={() => answer("aprendendo", 1)}>Errei · revisar amanhã</button>
                <button className="btn" onClick={() => answer("aprendendo", 3)}>Acertei · em 3 dias</button>
                <button className="btn primary" onClick={() => answer("dominado", 7)}>Domino · em 7 dias</button>
              </div>
            </>
          ) : <button className="btn primary" style={{ alignSelf: "center" }} autoFocus onClick={() => setReveal(true)}><Icon name="Eye" size={15} /> Mostrar tradução</button>}
          <button className="btn ghost sm" style={{ alignSelf: "center" }} onClick={() => setActive(false)}>Encerrar revisão</button>
        </div>
      )}
    </section>
  );
}
