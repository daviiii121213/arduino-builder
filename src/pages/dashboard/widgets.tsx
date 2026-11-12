// Conteúdo de cada widget do painel (dados vindos de dashboard.data).
import { call } from "../../api/client";
import { useApp, type Workspace } from "../../contexts/app";
import { Icon, type IconName } from "../../components/Icon";
import { Avatar, Progress } from "../../components/ui";
import { navigate } from "../../hooks/router";
import { fmtDate, fmtDateTime, fmtMonth, money, relativeDay, today, weekdayShort } from "../../utils/format";
import { actionLabel } from "../../modules/panels";
import type { Rec } from "../../modules/types";

export const WIDGET_ICONS: Record<string, IconName> = {
  shortcuts: "LayoutGrid", tasks_summary: "CheckSquare", upcoming_events: "CalendarDays", goals_progress: "Target",
  finance_summary: "Wallet", recent_activity: "History", mini_calendar: "Calendar", habits_today: "Flame", bills_due: "Receipt",
  notes_pinned: "StickyNote", shopping_lists: "ShoppingCart", pantry_expiring: "Package", board_posts: "Megaphone",
  birthdays: "Cake", members: "Users",
};

const go = (to: string) => navigate(to);
const mod = (id: string, ws: Workspace, open?: string) => `/m/${id}?ws=${ws}${open ? `&open=${encodeURIComponent(open)}` : ""}`;

function Empty({ text }: { text: string }) {
  return <p className="muted small">{text}</p>;
}

const KIND_MODULE: Record<string, string> = {
  compromisso: "events", evento: "family_event", saude: "health_appointment", estudo: "study_item", aniversario: "birthday", viagem: "trip",
};

export function WidgetBody({ type, data, ws, reload }: { type: string; data: Rec | undefined; ws: Workspace; reload: () => void }) {
  const { toast } = useApp();
  if (type !== "shortcuts" && !data) return <Empty text="Sem dados." />;
  if (data?.forbidden) return <p className="muted small row"><Icon name="Lock" size={14} /> Sem permissão para visualizar estas informações.</p>;
  if (data?.error) return <p className="small" style={{ color: "var(--danger)" }}>{data.error}</p>;
  const items: Rec[] = data?.items ?? [];

  switch (type) {
    case "shortcuts": {
      const list: Array<[string, IconName, string]> = ws === "personal"
        ? [["Tarefas", "CheckSquare", mod("tasks", ws)], ["Agenda", "CalendarDays", "/agenda"], ["Projetos", "FolderKanban", mod("projects", ws)], ["Metas", "Target", mod("goals", ws)],
           ["Finanças", "Wallet", "/financas"], ["Hábitos", "Flame", mod("habits", ws)], ["Notas", "StickyNote", mod("notes", ws)], ["Estudos", "GraduationCap", "/estudos"]]
        : [["Tarefas", "CheckSquare", mod("tasks", ws)], ["Agenda", "CalendarDays", "/agenda"], ["Compras", "ShoppingCart", mod("shopping_lists", ws)], ["Finanças", "Wallet", "/financas"],
           ["Mural", "Megaphone", mod("board_post", ws)], ["Cardápio", "UtensilsCrossed", mod("menu", ws)], ["Despensa", "Package", mod("pantry", ws)], ["Família", "Users", "/familia"]];
      return (
        <div className="shortcut-grid">
          {list.map(([l, i, to]) => (
            <button key={l} className="shortcut" onClick={() => go(to)}><span className="ico"><Icon name={i} size={17} /></span>{l}</button>
          ))}
        </div>
      );
    }
    case "tasks_summary":
      return (
        <div className="col" style={{ gap: 12 }}>
          <div className="stats">
            <div className="stat"><b>{data!.pending}</b><span>Pendentes</span></div>
            <div className="stat"><b style={{ color: data!.late ? "var(--danger)" : undefined }}>{data!.late}</b><span>Atrasadas</span></div>
            <div className="stat"><b>{data!.today}</b><span>Para hoje</span></div>
            <div className="stat"><b style={{ color: "var(--success)" }}>{data!.done_today}</b><span>Concluídas hoje</span></div>
          </div>
          {(data!.next as Rec[]).length === 0 ? <Empty text="Nenhuma tarefa pendente." /> : (
            <div className="list">
              {(data!.next as Rec[]).map((t) => (
                <div key={t.id} className="list-item" style={{ padding: "7px 2px" }}>
                  <input type="checkbox" aria-label={`Concluir "${t.title}"`} style={{ width: 17, height: 17, accentColor: "var(--primary)" }}
                    onChange={async () => { try { await call("rec.update", { entity: "tasks", id: t.id, values: { status: "concluida" } }); toast("Tarefa concluída."); reload(); } catch (e) { toast((e as Error).message, "error"); } }} />
                  <button className="btn ghost sm grow" style={{ justifyContent: "flex-start", padding: 0, fontWeight: 550 }} onClick={() => go(mod("tasks", ws, t.id))}>
                    <span className="ellipsis">{t.title}</span>
                  </button>
                  {t.is_late && <span className="badge danger">Atrasada</span>}
                  {t.due_date && <span className="tiny muted">{relativeDay(t.due_date)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    case "upcoming_events":
      return items.length === 0 ? <Empty text="Nada agendado para os próximos 7 dias." /> : (
        <div className="list">
          {items.map((e, i) => (
            <button key={`${e.id}-${i}`} className="list-item" style={{ padding: "7px 2px" }} onClick={() => go(mod(KIND_MODULE[e.kind] ?? "events", ws, e.occurrence_of ?? e.id))}>
              <span className="dot" style={{ background: e.color || e.owner_color || "var(--primary)" }} />
              <span className="grow ellipsis title">{e.title}</span>
              <span className="tiny muted">{relativeDay(e.start_at)}{e.start_at?.length > 10 ? ` · ${e.start_at.slice(11, 16)}` : ""}</span>
            </button>
          ))}
        </div>
      );
    case "goals_progress":
      return items.length === 0 ? <Empty text="Nenhuma meta em andamento." /> : (
        <div className="col" style={{ gap: 10 }}>
          {items.map((g) => (
            <button key={g.id} className="btn ghost" style={{ height: "auto", padding: "4px 2px", display: "block", textAlign: "left" }} onClick={() => go(mod("goals", ws, g.id))}>
              <div className="row between small"><span className="ellipsis">{g.title}</span><b>{Math.round(g.progress ?? 0)}%</b></div>
              <Progress value={g.progress ?? 0} label={`Progresso de ${g.title}`} />
            </button>
          ))}
        </div>
      );
    case "finance_summary":
      return (
        <div className="col" style={{ gap: 10 }}>
          <span className="tiny muted">{fmtMonth(data!.month)}</span>
          <div className="stats">
            <div className="stat"><b style={{ color: "var(--success)", fontSize: "1.15rem" }}>{money(data!.income)}</b><span>Receitas</span></div>
            <div className="stat"><b style={{ color: "var(--danger)", fontSize: "1.15rem" }}>{money(data!.expense)}</b><span>Despesas</span></div>
            <div className="stat"><b style={{ fontSize: "1.15rem" }}>{money(data!.balance)}</b><span>Saldo</span></div>
          </div>
          {(data!.by_category as Rec[]).slice(0, 3).map((c) => (
            <div key={c.category} className="row between small"><span>{c.category}</span><span>{money(c.amount)}</span></div>
          ))}
          <button className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => go("/financas")}>Ver finanças <Icon name="ChevronRight" size={14} /></button>
        </div>
      );
    case "recent_activity":
      return items.length === 0 ? <Empty text="Nenhuma atividade registrada ainda." /> : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }} className="col">
          {items.map((a, i) => (
            <li key={i} className="small">
              {a.user_name && <b>{a.user_name} </b>}{actionLabel(a.action)} <span className="muted">· {a.label ?? a.entity}</span>
              <div className="tiny muted">{fmtDateTime(a.created_at)}</div>
            </li>
          ))}
        </ul>
      );
    case "mini_calendar": {
      const [y, m] = String(data!.month).split("-").map(Number);
      const first = new Date(y, m - 1, 1);
      const days = new Date(y, m, 0).getDate();
      const t = today();
      const cells: Array<number | null> = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
      return (
        <div className="col" style={{ gap: 6 }}>
          <span className="small" style={{ fontWeight: 600, textTransform: "capitalize" }}>{fmtMonth(data!.month)}</span>
          <div className="mini-cal" role="grid" aria-label="Calendário do mês">
            {weekdayShort.map((w) => <span key={w} className="h">{w[0]}</span>)}
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const ds = `${data!.month}-${String(d).padStart(2, "0")}`;
              const n = data!.days?.[ds] ?? 0;
              return (
                <button key={i} className={`d btn ghost ${ds === t ? "today" : ""} ${n ? "has" : ""}`} style={{ height: "auto", padding: "5px 0", fontWeight: ds === t ? 700 : 400 }}
                  aria-label={`${fmtDate(ds)}${n ? `, ${n} item(ns)` : ""}`} onClick={() => go(`/agenda?date=${ds}`)}>{d}</button>
              );
            })}
          </div>
        </div>
      );
    }
    case "habits_today":
      return items.length === 0 ? <Empty text="Nenhum hábito ativo." /> : (
        <div className="list">
          {items.map((h) => (
            <label key={h.id} className="list-item check" style={{ padding: "7px 2px" }}>
              <input type="checkbox" checked={!!h.done_today} style={{ width: 17, height: 17, accentColor: h.color || "var(--accent)" }}
                onChange={async () => { try { await call("habit.toggle", { habit_id: h.id }); reload(); } catch (e) { toast((e as Error).message, "error"); } }} />
              <span className="grow">{h.title}</span>
              {h.streak > 0 && <span className="badge warning"><Icon name="Flame" size={12} /> {h.streak}</span>}
            </label>
          ))}
        </div>
      );
    case "bills_due":
      return items.length === 0 ? <Empty text="Nenhuma conta em aberto nos próximos 15 dias." /> : (
        <div className="list">
          {items.map((b) => {
            const late = b.due_date < today();
            return (
              <button key={b.id} className="list-item" style={{ padding: "7px 2px" }} onClick={() => go(mod("bills", ws, b.id))}>
                <span className="grow ellipsis title">{b.title}</span>
                <span className={`badge ${late ? "danger" : ""}`}>{late ? "Vencida" : relativeDay(b.due_date)}</span>
                <span className="small" style={{ fontVariantNumeric: "tabular-nums" }}>{money(b.amount)}</span>
              </button>
            );
          })}
        </div>
      );
    case "notes_pinned":
      return items.length === 0 ? <Empty text="Nenhuma nota fixada." /> : (
        <div className="col">
          {items.map((n) => (
            <button key={n.id} className="card clickable" style={{ padding: 10, borderLeft: `3px solid ${n.color || "var(--primary)"}` }} onClick={() => go(mod("notes", ws, n.id))}>
              <b className="small">{n.title}</b>
              {n.content && <p className="tiny muted ellipsis">{n.content}</p>}
            </button>
          ))}
        </div>
      );
    case "shopping_lists":
      return items.length === 0 ? <Empty text="Nenhuma lista aberta." /> : (
        <div className="list">
          {items.map((l) => (
            <button key={l.id} className="list-item" style={{ padding: "7px 2px" }} onClick={() => go(mod("shopping_lists", ws, l.id))}>
              <Icon name="ShoppingCart" size={16} />
              <span className="grow ellipsis title">{l.title}</span>
              <span className="tiny muted">{l.items_bought}/{l.items_total} itens</span>
            </button>
          ))}
        </div>
      );
    case "pantry_expiring":
      return items.length === 0 ? <Empty text="Nenhum produto vencendo em 7 dias." /> : (
        <div className="list">
          {items.map((p) => (
            <button key={p.id} className="list-item" style={{ padding: "7px 2px" }} onClick={() => go(mod("pantry", ws, p.id))}>
              <span className="grow ellipsis">{p.title}</span>
              <span className={`badge ${p.date_end < today() ? "danger" : "warning"}`}>{fmtDate(p.date_end)}</span>
            </button>
          ))}
        </div>
      );
    case "board_posts":
      return items.length === 0 ? <Empty text="Nenhum comunicado no mural." /> : (
        <div className="col">
          {items.map((p) => (
            <button key={p.id} className="card clickable" style={{ padding: 10 }} onClick={() => go(mod("board_post", ws, p.id))}>
              <div className="row between"><b className="small ellipsis">{p.title}</b>{p.priority ? <Icon name="Pin" size={13} label="Fixado" /> : null}</div>
              {p.body && <p className="tiny muted ellipsis">{p.body}</p>}
              <span className="tiny muted">{p.owner_name} · {fmtDateTime(p.created_at)}</span>
            </button>
          ))}
        </div>
      );
    case "birthdays":
      return items.length === 0 ? <Empty text="Nenhum aniversário nos próximos 30 dias." /> : (
        <div className="list">
          {items.map((b) => (
            <button key={b.id} className="list-item" style={{ padding: "7px 2px" }} onClick={() => go(mod("birthday", ws, b.id))}>
              <Icon name="Cake" size={16} />
              <span className="grow ellipsis">{b.title}</span>
              <span className={`badge ${b.days_left === 0 ? "accent" : ""}`}>{b.days_left === 0 ? "Hoje" : `${fmtDate(b.next_date).slice(0, 5)} · ${b.days_left} d`}</span>
            </button>
          ))}
        </div>
      );
    case "members":
      return (
        <div className="row wrap" style={{ gap: 14 }}>
          {items.map((m) => (
            <div key={m.id} className="row"><Avatar name={m.full_name} color={m.color} /><span className="small">{m.full_name}</span></div>
          ))}
          <button className="btn sm" onClick={() => go("/familia")}><Icon name="Users" size={14} /> Gerenciar família</button>
        </div>
      );
    default:
      return <Empty text="Widget indisponível." />;
  }
}
