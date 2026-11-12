// Componentes de interface reutilizáveis.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "../utils/cx";

export function Spinner({ label = "Carregando" }: { label?: string }) {
  return <div className="spinner" role="status" aria-label={label} />;
}

export function Loading() {
  return (
    <div className="loading-block">
      <Spinner />
    </div>
  );
}

export function EmptyState({ icon, image, title, text, action }: { icon?: IconName; image?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {image ? <img src={image} alt="" /> : icon ? <div className="page-icon"><Icon name={icon} size={22} /></div> : null}
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert danger" role="alert">
      <Icon name="AlertCircle" />
      <div className="grow">
        <b>Não foi possível carregar.</b> <span>{message}</span>
      </div>
      {onRetry && (
        <button className="btn sm" onClick={onRetry}>
          <Icon name="RotateCcw" size={15} /> Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, size, labelledBy }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "lg"; labelledBy?: string }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button.primary") ?? ref.current;
    el?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx("modal", size)} role="dialog" aria-modal="true" aria-labelledby={labelledBy ?? id} ref={ref} tabIndex={-1}
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
        <div className="modal-head">
          <h2 id={id}>{title}</h2>
          <button className="btn icon ghost" onClick={onClose} aria-label="Fechar">
            <Icon name="X" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, actions }: { title: ReactNode; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const id = useId();
  return (
    <>
      <div className="drawer-overlay" onMouseDown={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}>
        <div className="modal-head">
          <h2 id={id} className="ellipsis">{title}</h2>
          <div className="row">
            {actions}
            <button className="btn icon ghost" onClick={onClose} aria-label="Fechar" autoFocus>
              <Icon name="X" />
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

export function Field({ label, required, error, hint, children, full, htmlFor }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode; full?: boolean; htmlFor?: string }) {
  return (
    <div className={cx("field", full && "full")}>
      <label htmlFor={htmlFor}>
        {label}
        {required && <span className="req" aria-hidden>*</span>}
        {required && <span className="sr-only"> (obrigatório)</span>}
      </label>
      {children}
      {error ? (
        <span className="error" role="alert">
          <Icon name="AlertCircle" size={14} /> {error}
        </span>
      ) : hint ? (
        <span className="hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Progress({ value, tone, label }: { value: number; tone?: "accent" | "danger" | "warning"; label?: string }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cx("progress", tone)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progresso"}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ name, color, src, size }: { name?: string; color?: string | null; src?: string | null; size?: "sm" | "lg" | "xl" }) {
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  return (
    <span className={cx("avatar", size)} style={{ background: color || undefined }} aria-hidden>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="pager">
      <span className="muted small">
        {total} registros · página {page} de {pages}
      </span>
      <div className="row">
        <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="ChevronLeft" size={15} /> Anterior
        </button>
        <button className="btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Próxima <Icon name="ChevronRight" size={15} />
        </button>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ key: T; label: string; icon?: IconName }>; value: T; onChange: (k: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}>
          {t.icon && <Icon name={t.icon} size={16} />} {t.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ key: T; label: string; icon?: IconName }>; value: T; onChange: (k: T) => void; label: string }) {
  return (
    <div className="btn-group" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} aria-pressed={value === o.key} onClick={() => onChange(o.key)} title={o.label}>
          {o.icon && <Icon name={o.icon} size={16} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export const PALETTE = ["#4f46e5", "#2563eb", "#0891b2", "#0d9488", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#9333ea", "#475569"];

export function ColorPicker({ value, onChange, label = "Cor" }: { value?: string | null; onChange: (c: string) => void; label?: string }) {
  return (
    <div className="swatches" role="group" aria-label={label}>
      {PALETTE.map((c) => (
        <button type="button" key={c} className="swatch" style={{ background: c }} aria-pressed={value === c} aria-label={`Cor ${c}`} onClick={() => onChange(c)} />
      ))}
    </div>
  );
}

export function PriorityBadge({ value }: { value?: number | null }) {
  const p = value ?? 1;
  if (p === 1) return null;
  const map: Record<number, [string, string]> = { 0: ["Baixa", ""], 2: ["Alta", "warning"], 3: ["Urgente", "danger"] };
  const [l, t] = map[p] ?? ["Normal", ""];
  return (
    <span className={cx("badge", t)}>
      <Icon name="Flag" size={12} /> {l}
    </span>
  );
}

export function Highlight({ text, q }: { text: string; q: string }) {
  if (!q || q.length < 2 || !text) return <>{text}</>;
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const t = norm(text);
  const k = norm(q);
  const out: ReactNode[] = [];
  let i = 0;
  let idx = t.indexOf(k);
  while (idx >= 0) {
    out.push(text.slice(i, idx));
    out.push(<mark className="highlight" key={idx}>{text.slice(idx, idx + k.length)}</mark>);
    i = idx + k.length;
    idx = t.indexOf(k, i);
  }
  out.push(text.slice(i));
  return <>{out}</>;
}
