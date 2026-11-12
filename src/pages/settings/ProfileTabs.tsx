// Configurações: perfil do usuário e perfis da instalação.
import { useRef, useState } from "react";
import { call, ApiError } from "../../api/client";
import { useApp, type User } from "../../contexts/app";
import { Avatar, ColorPicker, Field, Loading, Modal } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useAsync } from "../../hooks/data";
import { RegisterForm, resizeAvatar } from "../AuthScreen";
import { fmtDateTime } from "../../utils/format";

export function ProfileTab() {
  const { user, setUser, toast, lock, confirm, perm } = useApp();
  const [name, setName] = useState(user.full_name);
  const [color, setColor] = useState(user.color ?? "#4f46e5");
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pw, setPw] = useState({ current: "", new: "", confirm: "" });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});
  const [del, setDel] = useState(false);

  const save = async (extra: Record<string, unknown> = {}) => {
    try {
      const u = await call<User>("auth.update_profile", { full_name: name, color, ...extra });
      setUser(u);
      setErr("");
      toast("Perfil atualizado.");
    } catch (e) { setErr((e as Error).message); }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await call("auth.change_password", pw);
      setPw({ current: "", new: "", confirm: "" });
      setPwErr({});
      toast("Senha alterada.");
    } catch (er) { const a = er as ApiError; setPwErr({ [a.field ?? "current"]: a.message }); }
  };

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <section className="card card-pad stack">
        <h2>Dados do perfil</h2>
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={user.full_name} color={color} src={user.avatar} size="xl" />
          <div className="col">
            <div className="row">
              <button className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="Camera" size={15} /> Alterar foto</button>
              {user.avatar && <button className="btn sm ghost" onClick={() => save({ avatar: null })}>Remover foto</button>}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { await save({ avatar: await resizeAvatar(f) }); } catch (er) { setErr((er as Error).message); } } e.target.value = ""; }} />
            <span className="muted tiny">A imagem é reduzida para 256×256 e guardada localmente.</span>
          </div>
        </div>
        <Field label="Nome completo" required error={err} htmlFor="p-name"><input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Cor de identificação"><ColorPicker value={color} onChange={setColor} /></Field>
        <div className="row"><span className="muted small grow">Nome de usuário: <b>@{user.username}</b> · criado em {fmtDateTime(user.created_at)}</span><button className="btn primary" onClick={() => save()}>Salvar perfil</button></div>
      </section>
      <section className="card card-pad col">
        <h2>Identificadores</h2>
        <span className="label">USER ID</span>
        <span className="id-chip" data-testid="user-id">{user.id}</span>
        <p className="muted small">Identificador permanente e único do seu perfil. Não muda a cada acesso, não é senha e não dá acesso a nada sozinho. É diferente do FAMILY ID{perm.family_id ? <> (sua família: <span className="mono">{perm.family_id}</span>)</> : ""}.</p>
      </section>
      <section className="card card-pad">
        <form className="stack" onSubmit={changePw}>
          <h2>Alterar senha</h2>
          <div className="form-grid">
            <Field label="Senha atual" required error={pwErr.current} htmlFor="pw-c"><input id="pw-c" className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <span />
            <Field label="Nova senha" required error={pwErr.new} hint="8+ caracteres com letras e números" htmlFor="pw-n"><input id="pw-n" className="input" type="password" autoComplete="new-password" value={pw.new} onChange={(e) => setPw({ ...pw, new: e.target.value })} /></Field>
            <Field label="Confirmar nova senha" required error={pwErr.confirm} htmlFor="pw-cf"><input id="pw-cf" className="input" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          </div>
          <div><button className="btn primary" disabled={!pw.current || !pw.new}>Alterar senha</button></div>
        </form>
      </section>
      <section className="card card-pad row wrap">
        <div className="grow"><h2>Sessão</h2><p className="muted small">Bloqueie o perfil ao se afastar do computador. Será preciso digitar a senha para voltar.</p></div>
        <button className="btn" onClick={lock}><Icon name="Lock" size={16} /> Bloquear perfil agora</button>
      </section>
      <section className="card card-pad row wrap" style={{ borderColor: "color-mix(in srgb, var(--danger) 40%, var(--border))" }}>
        <div className="grow"><h2 style={{ color: "var(--danger)" }}>Excluir meu perfil</h2><p className="muted small">Remove definitivamente seu perfil e todos os seus dados pessoais e anexos. Registros criados na família permanecem com a família.</p></div>
        <button className="btn danger" onClick={async () => { if (await confirm({ title: "Excluir perfil?", message: "Esta ação é irreversível. Considere exportar seus dados antes (Backup e dados › Exportar meus dados).", confirmLabel: "Continuar", danger: true })) setDel(true); }}><Icon name="Trash2" size={16} /> Excluir perfil</button>
      </section>
      {del && <DeleteProfile onClose={() => setDel(false)} />}
    </div>
  );
}

function DeleteProfile({ onClose }: { onClose: () => void }) {
  const { user } = useApp();
  const [pw, setPw] = useState("");
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState("");
  const go = async () => {
    try { await call("auth.delete_profile", { password: pw }); window.location.hash = "#/"; window.location.reload(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <Modal size="sm" title="Confirmar exclusão do perfil" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn danger" disabled={typed !== user.username || !pw} onClick={go}>Excluir definitivamente</button></>}>
      <div className="stack">
        <p className="small">Digite seu nome de usuário <b>{user.username}</b> e sua senha para confirmar.</p>
        <Field label="Nome de usuário" htmlFor="del-u"><input id="del-u" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
        <Field label="Senha" error={err} htmlFor="del-p"><input id="del-p" className="input" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} /></Field>
      </div>
    </Modal>
  );
}

interface Profile { id: string; username: string; full_name: string; color?: string | null; avatar?: string | null }

export function ProfilesTab() {
  const { user, toast } = useApp();
  const { data, loading, reload } = useAsync(() => call<{ items: Profile[]; max: number }>("auth.profiles"), []);
  const [adding, setAdding] = useState(false);
  if (loading || !data) return <Loading />;
  const full = data.items.length >= data.max;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="row between">
        <div><h2>Perfis desta instalação</h2><p className="muted small">{data.items.length} de {data.max} perfis. Cada perfil tem dados, configurações e senha próprios.</p></div>
        <button className="btn primary" disabled={full} onClick={() => setAdding(true)} title={full ? "Limite de perfis atingido" : undefined}><Icon name="UserPlus" size={16} /> Novo perfil</button>
      </div>
      <div className="list card">
        {data.items.map((p) => (
          <div key={p.id} className="list-item">
            <Avatar name={p.full_name} color={p.color} src={p.avatar} />
            <div className="grow"><b>{p.full_name}</b> <span className="muted small">@{p.username}</span></div>
            {p.id === user.id && <span className="badge primary">Você</span>}
          </div>
        ))}
      </div>
      {adding && (
        <Modal title="Cadastrar novo perfil" onClose={() => setAdding(false)}>
          <RegisterForm first={false} onCancel={() => setAdding(false)} onDone={(u) => { setAdding(false); toast(`Perfil de ${u.full_name} criado. A pessoa pode entrar com o próprio usuário e senha.`); reload(); }} />
        </Modal>
      )}
    </div>
  );
}
