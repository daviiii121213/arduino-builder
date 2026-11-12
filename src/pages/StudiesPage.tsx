// Estudos: matérias, cronograma, sessões, cursos, biblioteca e idiomas.
import { useState } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { useAsync } from "../hooks/data";
import { Icon, type IconName } from "../components/Icon";
import { EmptyState, Tabs } from "../components/ui";
import { getModule } from "../modules/registry";
import { ModulePage } from "../modules/ModulePage";
import { fmtDate, minutesLabel, relativeDay, startOfWeek, toISODate, today } from "../utils/format";
import type { Rec } from "../modules/types";

type Tab = "study_subject" | "study_item" | "study_session" | "course" | "book" | "language";
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: "study_subject", label: "Matérias", icon: "GraduationCap" },
  { key: "study_item", label: "Cronograma", icon: "CalendarDays" },
  { key: "study_session", label: "Sessões", icon: "Timer" },
  { key: "course", label: "Cursos", icon: "BookOpen" },
  { key: "book", label: "Biblioteca", icon: "Library" },
  { key: "language", label: "Idiomas", icon: "Languages" },
];

function readTab(): Tab {
  const m = /[?&]tab=([a-z_]+)/.exec(window.location.hash);
  return (TABS.find((t) => t.key === m?.[1])?.key ?? "study_subject") as Tab;
}

function Summary() {
  const t = today();
  const week = toISODate(startOfWeek(new Date()));
  const { data } = useAsync(async () => {
    const [items, sessions, courses] = await Promise.all([
      call<{ items: Rec[] }>("rec.list", { entity: "study_item", scope: "personal", filters: { status: "pendente", category: ["prova", "entrega"] }, from: t, sort: "date_start ASC", page_size: 5 }),
      call<{ items: Rec[] }>("rec.list", { entity: "study_session", scope: "personal", from: week, page_size: 500 }),
      call<{ items: Rec[] }>("rec.list", { entity: "course", scope: "personal", filters: { status: "cursando" }, page_size: 50 }),
    ]);
    return { upcoming: items.items, minutes: sessions.items.reduce((s, x) => s + Number(x.amount ?? 0), 0), sessions: sessions.items.length, courses: courses.items };
  }, [t, week]);
  return (
    <div className="studies-summary">
      <div className="card card-pad col">
        <h3 className="row small"><Icon name="Flag" size={15} /> Próximas provas e entregas</h3>
        {!data?.upcoming.length ? <span className="muted small">Nada agendado.</span> : data.upcoming.map((i) => (
          <div key={i.id} className="row small"><span className={`badge ${i.category === "prova" ? "warning" : "primary"}`}>{i.category === "prova" ? "Prova" : "Entrega"}</span><span className="grow ellipsis">{i.title}</span><span className="muted" title={fmtDate(i.date_start)}>{relativeDay(i.date_start)}</span></div>
        ))}
      </div>
      <div className="card card-pad stat">
        <span className="row"><Icon name="Timer" size={15} /> Estudado nesta semana</span>
        <b>{minutesLabel(data?.minutes ?? 0)}</b>
        <span>{data?.sessions ?? 0} sessão(ões) registradas</span>
      </div>
      <div className="card card-pad col">
        <h3 className="row small"><Icon name="BookOpen" size={15} /> Cursos em andamento</h3>
        {!data?.courses.length ? <span className="muted small">Nenhum curso em andamento.</span> : data.courses.slice(0, 4).map((c) => (
          <div key={c.id} className="row small"><span className="grow ellipsis">{c.title}</span><span className="muted">{Math.round(Number(c.progress ?? 0))}%</span></div>
        ))}
      </div>
    </div>
  );
}

export function StudiesPage() {
  const { workspace, setWorkspace } = useApp();
  const [tab, setTab] = useState<Tab>(readTab);
  if (workspace !== "personal") {
    return <EmptyState icon="GraduationCap" title="Estudos fica no ambiente PESSOAL" text="Matérias, cronograma, cursos, biblioteca e idiomas são registros privados do seu perfil."
      action={<button className="btn primary" onClick={() => setWorkspace("personal")}>Ir para PESSOAL</button>} />;
  }
  const mod = getModule(tab)!;
  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="GraduationCap" size={22} /></div>
          <div>
            <h1>Estudos <span className="badge primary" style={{ verticalAlign: "middle" }}>PESSOAL</span></h1>
            <p>Matérias, cronograma de conteúdos, provas e entregas, sessões de estudo, cursos, leitura e idiomas.</p>
          </div>
        </div>
      </div>
      <Summary />
      <Tabs tabs={TABS} value={tab} onChange={(k) => { setTab(k); window.history.replaceState(null, "", `#/estudos?tab=${k}`); }} />
      <p className="muted small" style={{ marginBottom: 10 }}>{mod.description}</p>
      <ModulePage key={tab} mod={mod} ws="personal" embedded />
    </div>
  );
}
