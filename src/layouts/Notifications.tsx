// Central de notificações locais.
import { useCallback, useEffect, useRef, useState } from "react";
import { call, devTick, isTauri } from "../api/client";
import { Icon } from "../components/Icon";
import { navigate } from "../hooks/router";
import { fmtDateTime } from "../utils/format";
import { routeFor } from "./Search";
import { useApp } from "../contexts/app";
import type { Rec } from "../modules/types";

const KIND_ICON: Record<string, Parameters<typeof Icon>[0]["name"]> = {
  evento: "CalendarDays", tarefa: "CheckSquare", atraso: "AlertTriangle", vencimento: "Receipt", documento: "FileText", habito: "Flame",
  manutencao: "Wrench", despensa: "Package", aniversario: "Cake", saude: "HeartPulse", orcamento: "PiggyBank",
};

export function NotificationsButton() {
  const { setWorkspace } = useApp();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ items: Rec[]; unread: number }>({ items: [], unread: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try { setData(await call("notif.list")); } catch { /* sessão encerrada */ }
  }, []);
  useEffect(() => {
    // primeira verificação imediata; depois, a cada minuto
    call("notif.scan").then(setData).catch(() => {});
    const t = setInterval(async () => { if (!isTauri) await devTick(); load(); }, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("plu:changed", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); window.removeEventListener("plu:changed", onFocus); };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="btn icon ghost icon-btn-badge" aria-label={`Notificações (${data.unread} não lidas)`} aria-expanded={open} onClick={() => { setOpen((o) => !o); load(); }}>
        <Icon name="Bell" />
        {data.unread > 0 && <span className="count">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notificações">
          <div className="card-head">
            <h3>Notificações</h3>
            <div className="row">
              <button className="btn sm ghost" onClick={async () => setData(await call("notif.read"))} disabled={!data.unread}>Marcar todas como lidas</button>
              <button className="btn sm ghost" onClick={async () => setData(await call("notif.clear"))} title="Remove as notificações já lidas">Limpar lidas</button>
            </div>
          </div>
          {data.items.length === 0 ? <p className="muted small" style={{ padding: 16 }}>Nenhuma notificação. Lembretes de compromissos, tarefas, contas e outros avisos aparecem aqui.</p> : (
            <div className="list">
              {data.items.map((n) => (
                <button key={n.id} className="list-item" style={{ alignItems: "flex-start", opacity: n.read ? 0.65 : 1 }} onClick={async () => {
                  await call("notif.read", { id: n.id });
                  if (n.entity && n.record_id) {
                    const fam = ["family_event", "birthday", "pantry", "maintenance"].includes(n.entity);
                    if (fam) setWorkspace("family");
                    navigate(routeFor(n.entity, fam ? "family" : "personal", n.record_id));
                  }
                  setOpen(false);
                  load();
                }}>
                  <Icon name={KIND_ICON[n.kind] ?? "Bell"} size={18} />
                  <div className="grow">
                    <div className="title small">{!n.read && <span className="dot" style={{ background: "var(--primary)", marginRight: 6 }} />}{n.title}</div>
                    <div className="small muted">{n.body}</div>
                    <div className="tiny muted">{fmtDateTime(n.created_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
