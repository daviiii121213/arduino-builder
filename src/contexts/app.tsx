// Estado global: sessão, preferências, ambiente (PESSOAL/FAMÍLIA), permissões, avisos e confirmações.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { call } from "../api/client";
import { Icon } from "../components/Icon";
import { Modal } from "../components/ui";

export type Workspace = "personal" | "family";

export interface User {
  id: string;
  username: string;
  full_name: string;
  color?: string | null;
  avatar?: string | null;
  created_at: string;
  installation_admin: boolean;
}

export interface PermCtx {
  user_id: string;
  family_id: string | null;
  family_role: string | null;
  permissions: string[] | null;
  installation_admin: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Settings = Record<string, any>;

interface ConfirmOpts {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface Toast {
  id: number;
  text: string;
  kind: "ok" | "error";
}

interface AppCtx {
  user: User;
  setUser: (u: User) => void;
  perm: PermCtx;
  reloadPerm: () => Promise<void>;
  can: (key: string) => boolean;
  settings: Settings;
  saveSettings: (v: Settings) => Promise<void>;
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
  toast: (text: string, kind?: "ok" | "error") => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  logout: () => Promise<void>;
  lock: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("AppProvider ausente");
  return c;
}

/** Aplica tema, cores, densidade e animações ao documento. */
export function applyAppearance(s: Settings) {
  const root = document.documentElement;
  const sysDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const theme = s.theme === "escuro" || (s.theme === "sistema" && sysDark) ? "dark" : "light";
  root.dataset.theme = theme;
  root.dataset.density = s.density ?? "confortavel";
  root.dataset.motion = s.animations ?? "normais";
  if (s.primary_color) root.style.setProperty("--primary", s.primary_color);
  if (s.accent_color) root.style.setProperty("--accent", s.accent_color);
  root.style.setProperty("--font-scale", String((s.font_scale ?? 100) / 100));
}

export function AppProvider({ initialUser, children, onLoggedOut, onLocked }: { initialUser: User; children: ReactNode; onLoggedOut: () => void; onLocked: () => void }) {
  const [user, setUser] = useState<User>(initialUser);
  const [perm, setPerm] = useState<PermCtx | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [workspace, setWs] = useState<Workspace>("personal");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const tid = useRef(0);

  const reloadPerm = useCallback(async () => {
    setPerm(await call<PermCtx>("auth.context"));
  }, []);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([call<PermCtx>("auth.context"), call<Settings>("settings.get")]);
      setPerm(p);
      setSettings(s);
      applyAppearance(s);
      setWs(s.last_workspace === "family" && p.family_id ? "family" : "personal");
    })().catch(() => onLoggedOut());
  }, [onLoggedOut]);

  useEffect(() => {
    if (!settings) return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const h = () => applyAppearance(settings);
    mq?.addEventListener?.("change", h);
    return () => mq?.removeEventListener?.("change", h);
  }, [settings]);

  const toast = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3200);
  }, []);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);

  const saveSettings = useCallback(async (v: Settings) => {
    const s = await call<Settings>("settings.set", { values: v });
    setSettings(s);
    applyAppearance(s);
  }, []);

  const setWorkspace = useCallback((w: Workspace) => {
    setWs(w);
    call("settings.set", { values: { last_workspace: w } }).catch(() => {});
  }, []);

  const value = useMemo<AppCtx | null>(() => {
    if (!perm || !settings) return null;
    return {
      user, setUser, perm, reloadPerm, settings, saveSettings, workspace, setWorkspace, toast, confirm,
      can: (k: string) => !!perm.permissions?.includes(k),
      logout: async () => { await call("auth.logout"); onLoggedOut(); },
      lock: async () => { await call("auth.lock"); onLocked(); },
    };
  }, [user, perm, settings, workspace, reloadPerm, saveSettings, setWorkspace, toast, confirm, onLoggedOut, onLocked]);

  if (!value) {
    return <div className="loading-block" style={{ height: "100vh", alignItems: "center" }}><div className="spinner" /></div>;
  }
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "error" : ""}`} role={t.kind === "error" ? "alert" : "status"}>
            <Icon name={t.kind === "error" ? "AlertCircle" : "CheckCircle2"} size={18} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
      {confirmState && (
        <Modal size="sm" title={confirmState.title} onClose={() => { confirmState.resolve(false); setConfirmState(null); }}
          footer={
            <>
              <button className="btn" onClick={() => { confirmState.resolve(false); setConfirmState(null); }}>Cancelar</button>
              <button className={`btn ${confirmState.danger ? "danger" : "primary"}`} autoFocus onClick={() => { confirmState.resolve(true); setConfirmState(null); }}>
                {confirmState.confirmLabel ?? "Confirmar"}
              </button>
            </>
          }>
          <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
            {confirmState.danger && <Icon name="AlertTriangle" style={{ color: "var(--danger)", flex: "none" }} />}
            <div>{confirmState.message}</div>
          </div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
