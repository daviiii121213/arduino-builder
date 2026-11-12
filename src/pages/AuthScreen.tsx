// Entrada e cadastro de perfis locais.
import { useEffect, useRef, useState } from "react";
import { call, ApiError } from "../api/client";
import { Avatar, Field, ColorPicker } from "../components/ui";
import { Icon } from "../components/Icon";
import { appIcon } from "../assets";
import { welcomeHero } from "../onboardingAssets";
import type { User } from "../contexts/app";
import { applyAppearance } from "../contexts/app";

interface Profile {
  id: string;
  username: string;
  full_name: string;
  color?: string | null;
  avatar?: string | null;
  temporarily_locked: boolean;
}

/** Reduz a imagem escolhida para 256×256 antes de enviar (menor uso de disco e memória). */
export async function resizeAvatar(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("Imagem inválida.")); img.src = url; });
    const size = 256;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    return c.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function RegisterForm({ first, onDone, onCancel }: { first: boolean; onDone: (u: User, loggedIn: boolean) => void; onCancel?: () => void }) {
  const [f, setF] = useState({ full_name: "", username: "", password: "", password_confirm: "", color: "#4f46e5" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: string, v: string) => { setF((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: "" })); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.full_name.trim().length < 2) errs.full_name = "Informe o nome completo.";
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(f.username.trim())) errs.username = "Use de 3 a 32 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.";
    if (f.password.length < 8 || !/[0-9]/.test(f.password) || !/[A-Za-zÀ-ÿ]/.test(f.password)) errs.password = "Mínimo de 8 caracteres, com letras e números.";
    if (f.password !== f.password_confirm) errs.password_confirm = "As senhas não conferem.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const r = await call<{ user: User; logged_in: boolean }>("auth.register", { ...f, avatar });
      onDone(r.user, r.logged_in);
    } catch (err) {
      const a = err as ApiError;
      setErrors({ [a.field ?? "general"]: a.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="col" style={{ gap: 14 }} onSubmit={submit} noValidate>
      {errors.general && <div className="alert danger" role="alert">{errors.general}</div>}
      <div className="row" style={{ gap: 14 }}>
        <button type="button" className="btn ghost" style={{ height: "auto", padding: 0, borderRadius: "50%" }} onClick={() => fileRef.current?.click()} aria-label="Escolher foto de perfil (opcional)">
          <Avatar name={f.full_name || "?"} color={f.color} src={avatar} size="lg" />
        </button>
        <div className="col" style={{ gap: 4 }}>
          <span className="label">Foto e cor de identificação (opcionais)</span>
          <div className="row">
            <button type="button" className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="Camera" size={15} /> Escolher foto</button>
            {avatar && <button type="button" className="btn sm ghost" onClick={() => setAvatar(null)}>Remover</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) { try { setAvatar(await resizeAvatar(file)); } catch (er) { setErrors({ general: (er as Error).message }); } } }} />
        </div>
      </div>
      <ColorPicker value={f.color} onChange={(c) => set("color", c)} label="Cor de identificação" />
      <Field label="Nome completo" required error={errors.full_name} htmlFor="r-name">
        <input id="r-name" className="input" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoComplete="name" aria-invalid={!!errors.full_name} autoFocus />
      </Field>
      <Field label="Nome de usuário" required error={errors.username} hint="Usado para entrar. Ex.: maria.silva" htmlFor="r-user">
        <input id="r-user" className="input" value={f.username} onChange={(e) => set("username", e.target.value)} autoComplete="username" aria-invalid={!!errors.username} />
      </Field>
      <div className="form-grid">
        <Field label="Senha" required error={errors.password} hint="8+ caracteres com letras e números" htmlFor="r-pass">
          <input id="r-pass" className="input" type={show ? "text" : "password"} value={f.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" aria-invalid={!!errors.password} />
        </Field>
        <Field label="Confirmação de senha" required error={errors.password_confirm} htmlFor="r-pass2">
          <input id="r-pass2" className="input" type={show ? "text" : "password"} value={f.password_confirm} onChange={(e) => set("password_confirm", e.target.value)} autoComplete="new-password" aria-invalid={!!errors.password_confirm} />
        </Field>
      </div>
      <label className="check small"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar senhas</label>
      <div className="alert small"><Icon name="Shield" size={18} /><span>A senha é guardada somente como hash seguro (Argon2id) neste computador. Não há recuperação pela internet: anote-a em local seguro.</span></div>
      <div className="row">
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancelar</button>}
        <button className="btn primary grow" disabled={busy}>{busy ? "Criando perfil…" : first ? "Criar perfil e começar" : "Criar perfil"}</button>
      </div>
    </form>
  );
}

export function AuthScreen({ hasUsers, onLogin }: { hasUsers: boolean; onLogin: (u: User) => void }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [max, setMax] = useState(6);
  const [sel, setSel] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    applyAppearance({ theme: "sistema" });
    if (hasUsers) call<{ items: Profile[]; max: number }>("auth.profiles").then((r) => { setProfiles(r.items); setMax(r.max); if (r.items.length === 1) { setSel(r.items[0]); setUsername(r.items[0].username); } }).catch(() => {});
  }, [hasUsers]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await call<{ user: User }>("auth.login", { username, password });
      onLogin(r.user);
    } catch (err) {
      setError((err as Error).message);
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <div className="row" style={{ gap: 12 }}>
          <img src={appIcon} alt="" width={42} height={42} />
          <div className="brand-name" style={{ color: "#fff" }}>PERSONAL LIFE<span style={{ color: "#c7d2fe" }}>ULTRA</span></div>
        </div>
        <img className="hero" src={welcomeHero} alt="Ilustração: painel com agenda, tarefas e metas" />
        <div className="col" style={{ gap: 6 }}>
          <h1>Sua vida organizada, em um só lugar.</h1>
          <p style={{ opacity: 0.85 }}>Agenda, tarefas, projetos, finanças, estudos e a rotina da família — tudo guardado somente neste computador, funcionando sem internet.</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-box">
          {!hasUsers ? (
            <>
              <div>
                <h1>Bem-vindo(a)!</h1>
                <p className="muted">Crie o primeiro perfil deste computador. Ele será o administrador da instalação (backups e restauração).</p>
              </div>
              <RegisterForm first onDone={(u) => onLogin(u)} />
            </>
          ) : (
            <form className="col" style={{ gap: 16 }} onSubmit={login}>
              <div>
                <h1>Entrar</h1>
                <p className="muted">Escolha seu perfil e digite a senha.</p>
              </div>
              <div className="profile-pick" role="group" aria-label="Perfis desta instalação">
                {profiles.map((p) => (
                  <button type="button" key={p.id} aria-pressed={sel?.id === p.id} onClick={() => { setSel(p); setUsername(p.username); setError(""); setTimeout(() => document.getElementById("l-pass")?.focus(), 0); }}>
                    <Avatar name={p.full_name} color={p.color} src={p.avatar} size="lg" />
                    <b className="small ellipsis" style={{ maxWidth: "100%" }}>{p.full_name}</b>
                    <span className="tiny muted">@{p.username}{p.temporarily_locked ? " · aguardando" : ""}</span>
                  </button>
                ))}
              </div>
              <Field label="Nome de usuário" htmlFor="l-user">
                <input id="l-user" className="input" value={username} onChange={(e) => { setUsername(e.target.value); setSel(profiles.find((p) => p.username === e.target.value.toLowerCase()) ?? null); }} autoComplete="username" />
              </Field>
              <Field label="Senha" error={error} htmlFor="l-pass">
                <input id="l-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-invalid={!!error} autoFocus={profiles.length === 1} />
              </Field>
              <button className="btn primary" disabled={busy || !username || !password}>{busy ? "Entrando…" : "Entrar"}</button>
              <p className="muted tiny">{profiles.length} de {max} perfis nesta instalação. Novos perfis são cadastrados por um perfil já conectado (Configurações › Perfis).</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function LockScreen({ user, onUnlock, onSwitch }: { user: { full_name: string; color?: string | null; avatar?: string | null; username: string } | null; onUnlock: () => void; onSwitch: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="lock-screen">
      <form className="card card-pad col" style={{ width: 380, alignItems: "center", gap: 14 }} onSubmit={async (e) => {
        e.preventDefault();
        try { await call("auth.unlock", { password: pw }); onUnlock(); } catch (er) { setErr((er as Error).message); setPw(""); }
      }}>
        <Avatar name={user?.full_name} color={user?.color} src={user?.avatar} size="xl" />
        <h2>{user?.full_name ?? "Perfil bloqueado"}</h2>
        <p className="muted small row"><Icon name="Lock" size={14} /> Perfil bloqueado. Digite sua senha.</p>
        <input className="input" type="password" autoFocus value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} aria-label="Senha" aria-invalid={!!err} />
        {err && <span role="alert" className="small" style={{ color: "var(--danger)" }}>{err}</span>}
        <button className="btn primary block">Desbloquear</button>
        <button type="button" className="btn ghost block" onClick={onSwitch}>Entrar com outro perfil</button>
      </form>
    </div>
  );
}
