// Configurações: automações, backup e dados, lixeira e sobre.
import { useState } from "react";
import { call, isTauri, ApiError } from "../../api/client";
import { openFileDialog, openFolderDialog, openPath, revealPath, saveFileDialog } from "../../api/native";
import { useApp } from "../../contexts/app";
import { ErrorState, Field, Loading, Modal } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useAsync } from "../../hooks/data";
import { bytes, fmtDateTime, toISODate } from "../../utils/format";

interface Rule {
  id: string; rule_type: string; name: string; enabled: boolean; params: Record<string, number>; last_run_at?: string | null; executions: number; description: string;
  param_spec: Array<{ key: string; label: string; min: number; max: number }>;
}

function RuleCard({ r, onSaved }: { r: Rule; onSaved: (items: Rule[]) => void }) {
  const { toast } = useApp();
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(r.param_spec.map((p) => [p.key, String(r.params[p.key] ?? "")])));
  const [err, setErr] = useState<Record<string, string>>({});
  const upd = async (body: Record<string, unknown>) => {
    try {
      const res = await call<{ items: Rule[] }>("auto.update", { id: r.id, ...body });
      setErr({});
      onSaved(res.items);
      toast("Automação atualizada.");
    } catch (e) { const a = e as ApiError; setErr({ [a.field ?? "_"]: a.message }); }
  };
  return (
    <div className="card card-pad col" data-testid={`rule-${r.rule_type}`}>
      <div className="row">
        <Icon name="Zap" size={18} style={{ color: r.enabled ? "var(--accent)" : "var(--text-3)" }} />
        <b className="grow">{r.name}</b>
        <label className="check small"><input type="checkbox" checked={r.enabled} onChange={(e) => upd({ enabled: e.target.checked })} aria-label={`Ativar ${r.name}`} /> {r.enabled ? "Ativa" : "Desativada"}</label>
      </div>
      <p className="small muted">{r.description}</p>
      {r.param_spec.map((p) => (
        <Field key={p.key} label={p.label} error={err[p.key]} hint={`Entre ${p.min} e ${p.max}`} htmlFor={`${r.id}-${p.key}`}>
          <div className="row">
            <input id={`${r.id}-${p.key}`} className="input" style={{ width: 120 }} type="number" value={vals[p.key]} aria-invalid={!!err[p.key]} onChange={(e) => setVals({ ...vals, [p.key]: e.target.value })} />
            <button className="btn sm" onClick={() => upd({ params: Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v === "" ? null : Number(v)])) })}>Salvar condição</button>
          </div>
        </Field>
      ))}
      {err._ && <span className="small" style={{ color: "var(--danger)" }}>{err._}</span>}
      <span className="tiny muted">{r.executions} execução(ões) registrada(s){r.last_run_at ? ` · última em ${fmtDateTime(r.last_run_at)}` : ""}</span>
    </div>
  );
}

export function AutomationsTab() {
  const rules = useAsync(() => call<{ items: Rule[] }>("auto.list"), []);
  const logs = useAsync(() => call<{ items: Array<{ message: string; created_at: string; rule: string }> }>("auto.logs"), []);
  if (rules.error) return <ErrorState message={rules.error} onRetry={rules.reload} />;
  if (!rules.data) return <Loading />;
  return (
    <div className="stack">
      <div className="alert small"><Icon name="Info" size={16} /> Automações são regras fixas e previsíveis, configuradas por você. Não usam inteligência artificial, não fazem operações financeiras externas e nunca excluem dados.</div>
      <div className="grid-2">{rules.data.items.map((r) => <RuleCard key={r.id} r={r} onSaved={(items) => { rules.setData({ items }); logs.reload(); }} />)}</div>
      <section className="card">
        <div className="card-head"><h3><Icon name="History" size={17} /> Execuções recentes</h3><button className="btn sm ghost" onClick={logs.reload}>Atualizar</button></div>
        {!logs.data?.items.length ? <p className="muted small card-body">Nenhuma execução registrada ainda.</p> : (
          <div className="table-wrap" style={{ maxHeight: 340, overflowY: "auto" }}>
            <table className="table"><thead><tr><th>Quando</th><th>Regra</th><th>Resultado</th></tr></thead>
              <tbody>{logs.data.items.map((l, i) => <tr key={i}><td>{fmtDateTime(l.created_at)}</td><td>{l.rule}</td><td>{l.message}</td></tr>)}</tbody></table>
          </div>
        )}
      </section>
    </div>
  );
}

interface BStatus {
  is_installation_admin: boolean; last_backup_at?: string | null; last_backup_path?: string | null; folder: string; auto_enabled: boolean; auto_interval_days: number; auto_keep: number; data_dir: string;
  recent: Array<{ path: string; size: number; modified_at: string }>;
}
interface Manifest { created_at: string; app_version: string; schema_version: number; profiles: number; encrypted?: boolean; files: unknown[] }

const PLUBACK = [{ name: "Backup do PERSONAL LIFE ULTRA", extensions: ["pluback"] }];

export function BackupTab() {
  const { toast, confirm } = useApp();
  const st = useAsync(() => call<BStatus>("backup.status"), []);
  const [creating, setCreating] = useState(false);
  const [restore, setRestore] = useState<{ path: string; encrypted: boolean; manifest?: Manifest } | null>(null);
  const [cfg, setCfg] = useState<{ interval: string; keep: string } | null>(null);
  const [cfgErr, setCfgErr] = useState("");

  const verify = async () => {
    const path = await openFileDialog(PLUBACK, "Selecionar backup para verificar");
    if (!path) return;
    try {
      const r = await call<{ manifest: Manifest; encrypted: boolean }>("backup.verify", { path });
      toast(`Backup válido: criado em ${fmtDateTime(r.manifest.created_at)}, ${r.manifest.files.length} arquivo(s) conferido(s).`);
    } catch (e) {
      const a = e as ApiError;
      if (a.code === "password_required") {
        const pw = window.prompt("Este backup é protegido por senha. Digite a senha do backup:");
        if (!pw) return;
        try {
          const r = await call<{ manifest: Manifest }>("backup.verify", { path, password: pw });
          toast(`Backup válido e senha correta: criado em ${fmtDateTime(r.manifest.created_at)}.`);
        } catch (e2) { toast((e2 as Error).message, "error"); }
      } else toast(a.message, "error");
    }
  };
  const pickRestore = async () => {
    const path = await openFileDialog(PLUBACK, "Selecionar backup para restaurar");
    if (!path) return;
    try {
      const r = await call<{ manifest: Manifest; encrypted: boolean }>("backup.verify", { path });
      setRestore({ path, encrypted: r.encrypted, manifest: r.manifest });
    } catch (e) {
      const a = e as ApiError;
      if (a.code === "password_required") setRestore({ path, encrypted: true });
      else toast(a.message, "error");
    }
  };
  const exportMine = async () => {
    const path = await saveFileDialog(`meus-dados-${toISODate(new Date())}.zip`, [{ name: "Arquivo ZIP", extensions: ["zip"] }]);
    if (!path) return;
    try { const r = await call<{ path: string }>("backup.export_my_data", { path }); toast(`Dados exportados: ${r.path}`); } catch (e) { toast((e as Error).message, "error"); }
  };
  const configure = async (body: Record<string, unknown>) => {
    try { st.setData(await call<BStatus>("backup.configure", body)); setCfgErr(""); toast("Configuração de backup salva."); } catch (e) { setCfgErr((e as Error).message); }
  };

  if (st.error) return <ErrorState message={st.error} onRetry={st.reload} />;
  if (!st.data) return <Loading />;
  const s = st.data;
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <section className="card card-pad stack">
        <div className="row between wrap">
          <div>
            <h2>Backup completo</h2>
            <p className="muted small">Último backup: <b data-testid="last-backup">{s.last_backup_at ? fmtDateTime(s.last_backup_at) : "nunca realizado"}</b></p>
          </div>
          {s.is_installation_admin && (
            <div className="row wrap">
              <button className="btn primary" onClick={() => setCreating(true)}><Icon name="Archive" size={16} /> Criar backup agora</button>
              <button className="btn" onClick={pickRestore}><Icon name="RotateCcw" size={16} /> Restaurar backup</button>
            </div>
          )}
        </div>
        {!s.is_installation_admin ? (
          <div className="alert small"><Icon name="Shield" size={16} /> O backup completo contém os dados de <b>todos os perfis</b> deste computador e por isso só pode ser criado ou restaurado pelo administrador da instalação (o primeiro perfil cadastrado). Use “Exportar meus dados” para obter uma cópia dos seus próprios registros.</div>
        ) : (
          <p className="small muted">O arquivo .pluback contém o banco de dados e todos os anexos, com verificação de integridade (SHA-256) após a gravação. A restauração cria antes um backup de segurança dos dados atuais.</p>
        )}
        <button className="btn" style={{ alignSelf: "flex-start" }} onClick={verify}><Icon name="CheckCircle2" size={16} /> Verificar um arquivo de backup</button>
      </section>
      {s.is_installation_admin && (
        <section className="card card-pad stack">
          <h2>Backup automático</h2>
          {cfgErr && <div className="alert danger small" role="alert">{cfgErr}</div>}
          <label className="check"><input type="checkbox" checked={s.auto_enabled} onChange={(e) => configure({ auto_enabled: e.target.checked })} /> Criar backups automaticamente (enquanto o aplicativo estiver aberto)</label>
          <div className="row wrap" style={{ alignItems: "flex-end" }}>
            <Field label="Intervalo (dias)" htmlFor="bk-int"><input id="bk-int" className="input" type="number" min={1} max={90} style={{ width: 120 }} value={cfg?.interval ?? s.auto_interval_days} onChange={(e) => setCfg({ interval: e.target.value, keep: cfg?.keep ?? String(s.auto_keep) })} /></Field>
            <Field label="Manter os últimos" htmlFor="bk-keep"><input id="bk-keep" className="input" type="number" min={1} max={100} style={{ width: 120 }} value={cfg?.keep ?? s.auto_keep} onChange={(e) => setCfg({ keep: e.target.value, interval: cfg?.interval ?? String(s.auto_interval_days) })} /></Field>
            <button className="btn" disabled={!cfg} onClick={() => cfg && configure({ auto_interval_days: Number(cfg.interval), auto_keep: Number(cfg.keep) }).then(() => setCfg(null))}>Salvar</button>
          </div>
          <div className="row wrap">
            <span className="small">Pasta de destino: <span className="id-chip">{s.folder}</span></span>
            <button className="btn sm" onClick={async () => { const f = await openFolderDialog("Pasta para os backups"); if (f) configure({ folder: f }); }}><Icon name="FolderOpen" size={15} /> Alterar pasta</button>
            <button className="btn sm ghost" onClick={() => configure({ folder: "" })}>Usar pasta padrão</button>
          </div>
          <p className="tiny muted">Backups automáticos não são criptografados; guarde-os em local seguro. Apenas backups automáticos antigos são apagados pela retenção.</p>
        </section>
      )}
      <section className="card card-pad row wrap">
        <div className="grow"><h2>Exportar meus dados</h2><p className="muted small">Cópia dos seus registros pessoais (JSON) e anexos em um arquivo ZIP. Disponível para todos os perfis.</p></div>
        <button className="btn" onClick={exportMine}><Icon name="Download" size={16} /> Exportar meus dados</button>
      </section>
      {s.recent.length > 0 && (
        <section className="card">
          <div className="card-head"><h3>Backups na pasta de destino</h3></div>
          <div className="list">
            {s.recent.map((b) => (
              <div key={b.path} className="list-item">
                <Icon name="Archive" size={16} />
                <span className="grow small ellipsis" title={b.path}>{b.path.split(/[\\/]/).pop()}</span>
                <span className="tiny muted">{bytes(b.size)} · {fmtDateTime(b.modified_at)}</span>
                {isTauri && <button className="btn icon sm ghost" aria-label="Mostrar na pasta" onClick={() => revealPath(b.path)}><Icon name="FolderOpen" size={15} /></button>}
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="small muted">Pasta de dados do aplicativo: <span className="id-chip">{s.data_dir}</span></p>
      {creating && <CreateBackup onClose={() => setCreating(false)} onDone={() => { setCreating(false); st.reload(); }} />}
      {restore && <RestoreBackup info={restore} onClose={() => setRestore(null)} confirm={confirm} />}
    </div>
  );
}

function CreateBackup({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useApp();
  const [protect, setProtect] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (protect && pw.length < 8) { setErr({ password: "Mínimo de 8 caracteres." }); return; }
    if (protect && pw !== pw2) { setErr({ password_confirm: "As senhas não conferem." }); return; }
    const path = await saveFileDialog(`PersonalLifeUltra-${toISODate(new Date())}.pluback`, PLUBACK);
    if (!path) return;
    setBusy(true);
    try {
      const r = await call<{ path: string; size: number }>("backup.create", { path, ...(protect ? { password: pw, password_confirm: pw2 } : {}) });
      toast(`Backup criado e verificado (${bytes(r.size)}): ${r.path}`);
      if (isTauri) revealPath(r.path).catch(() => {});
      onDone();
    } catch (e) { const a = e as ApiError; setErr({ [a.field ?? "_"]: a.message }); } finally { setBusy(false); }
  };
  return (
    <Modal size="sm" title="Criar backup" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy} onClick={go}>{busy ? "Criando…" : "Escolher local e criar"}</button></>}>
      <div className="stack">
        <label className="check"><input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} /> Proteger o backup com senha (AES-256-GCM)</label>
        {protect && (
          <>
            <Field label="Senha do backup" required error={err.password} htmlFor="bp1"><input id="bp1" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
            <Field label="Confirmar senha" required error={err.password_confirm} htmlFor="bp2"><input id="bp2" className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
            <div className="alert warning small"><Icon name="AlertTriangle" size={16} /> Sem esta senha o backup não poderá ser restaurado. Ela não é guardada em lugar nenhum.</div>
          </>
        )}
        {err._ && <div className="alert danger small" role="alert">{err._}</div>}
      </div>
    </Modal>
  );
}

function RestoreBackup({ info, onClose, confirm }: { info: { path: string; encrypted: boolean; manifest?: Manifest }; onClose: () => void; confirm: ReturnType<typeof useApp>["confirm"] }) {
  const [pw, setPw] = useState("");
  const [account, setAccount] = useState("");
  const [ack, setAck] = useState(false);
  const [manifest, setManifest] = useState<Manifest | undefined>(info.manifest);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const check = async () => {
    try { const r = await call<{ manifest: Manifest }>("backup.verify", { path: info.path, password: pw }); setManifest(r.manifest); setErr({}); } catch (e) { setErr({ password: (e as Error).message }); }
  };
  const go = async () => {
    if (!(await confirm({ title: "Substituir todos os dados?", message: "Todos os dados atuais desta instalação (todos os perfis) serão substituídos pelo conteúdo do backup. Um backup de segurança será criado antes.", confirmLabel: "Restaurar agora", danger: true }))) return;
    setBusy(true);
    try {
      await call("backup.restore", { path: info.path, password: pw || undefined, account_password: account, confirm: true });
      window.alert("Backup restaurado com sucesso. Entre novamente no seu perfil.");
      window.location.hash = "#/";
      window.location.reload();
    } catch (e) { const a = e as ApiError; setErr({ [a.field ?? "_"]: a.message }); setBusy(false); }
  };
  return (
    <Modal title="Restaurar backup" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn danger" disabled={busy || !manifest || !ack || !account} onClick={go}>{busy ? "Restaurando…" : "Restaurar"}</button></>}>
      <div className="stack">
        <p className="small">Arquivo: <span className="id-chip">{info.path}</span></p>
        {info.encrypted && !manifest && (
          <Field label="Senha do backup" required error={err.password} htmlFor="rs-pw">
            <div className="row"><input id="rs-pw" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /><button className="btn" onClick={check}>Verificar</button></div>
          </Field>
        )}
        {manifest && (
          <div className="card card-pad small">
            <b>Backup válido</b> — criado em {fmtDateTime(manifest.created_at)} · versão {manifest.app_version} · esquema v{manifest.schema_version} · {manifest.profiles} perfil(is) · {manifest.files.length} arquivo(s) conferido(s){info.encrypted ? " · criptografado" : ""}
          </div>
        )}
        <div className="alert danger small"><Icon name="AlertTriangle" size={16} /> Os dados atuais serão substituídos. Antes disso, um backup de segurança dos dados atuais é criado automaticamente na pasta de backups.</div>
        <Field label="Senha do seu perfil (confirmação)" required error={err.account_password} htmlFor="rs-acc"><input id="rs-acc" className="input" type="password" value={account} onChange={(e) => setAccount(e.target.value)} /></Field>
        <label className="check small"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> Entendo que os dados atuais serão substituídos.</label>
        {err._ && <div className="alert danger small" role="alert">{err._}</div>}
      </div>
    </Modal>
  );
}

interface TrashItem { id: string; title: string; entity: string; label: string; deleted_at: string; scope: string }

export function TrashTab() {
  const { toast, confirm } = useApp();
  const { data, loading, reload } = useAsync(() => call<{ items: TrashItem[] }>("rec.trash"), []);
  const restore = async (t: TrashItem) => { try { await call("rec.restore", { entity: t.entity, id: t.id }); toast("Registro restaurado."); reload(); } catch (e) { toast((e as Error).message, "error"); } };
  const purge = async (t: TrashItem) => {
    if (!(await confirm({ title: "Excluir definitivamente?", message: `“${t.title}” e seus anexos serão apagados para sempre. Esta ação não pode ser desfeita.`, confirmLabel: "Excluir definitivamente", danger: true }))) return;
    try { await call("rec.purge", { entity: t.entity, id: t.id }); toast("Excluído definitivamente."); reload(); } catch (e) { toast((e as Error).message, "error"); }
  };
  if (loading || !data) return <Loading />;
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <p className="muted small">Registros que você excluiu ficam aqui até serem restaurados ou excluídos definitivamente.</p>
      {data.items.length === 0 ? <div className="card card-pad muted">A lixeira está vazia.</div> : (
        <div className="list card">
          {data.items.map((t) => (
            <div key={t.entity + t.id} className="list-item">
              <Icon name="Trash2" size={16} />
              <div className="grow"><b>{t.title}</b><div className="tiny muted">{t.label} · {t.scope === "family" ? "FAMÍLIA" : "PESSOAL"} · excluído em {fmtDateTime(t.deleted_at)}</div></div>
              <button className="btn sm" onClick={() => restore(t)}><Icon name="Undo2" size={14} /> Restaurar</button>
              <button className="btn sm ghost" onClick={() => purge(t)} aria-label={`Excluir definitivamente ${t.title}`}><Icon name="X" size={14} /> Excluir</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AboutTab() {
  const { data } = useAsync(() => call<{ version: string; schema_version: number; data_dir: string; users: number; max_profiles: number }>("app.status"), []);
  if (!data) return <Loading />;
  return (
    <div className="card card-pad stack" style={{ maxWidth: 760 }}>
      <h2>PERSONAL LIFE ULTRA</h2>
      <p>Versão <b>{data.version}</b> · esquema do banco v{data.schema_version} · {data.users}/{data.max_profiles} perfis</p>
      <p className="small">Aplicativo de organização pessoal e familiar 100% offline: sem servidores externos, sem nuvem, sem contas on-line e sem inteligência artificial.</p>
      <div className="row wrap"><span className="small">Pasta de dados:</span><span className="id-chip">{data.data_dir}</span>{isTauri && <button className="btn sm" onClick={() => openPath(data.data_dir)}><Icon name="FolderOpen" size={14} /> Abrir</button>}</div>
      <p className="muted small">Contém <span className="mono">plu.db</span> (SQLite), <span className="mono">attachments/</span> (anexos), <span className="mono">backups/</span> e <span className="mono">logs/</span>. Atualizações e a desinstalação não apagam esta pasta.</p>
      <p className="muted tiny">Componentes de código aberto utilizados: Tauri, React, SQLite (rusqlite), lucide (ícones), Argon2, AES-GCM, rust_xlsxwriter e zip — cada um sob sua respectiva licença (MIT/Apache-2.0/ISC/domínio público).</p>
    </div>
  );
}
