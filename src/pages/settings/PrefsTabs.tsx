// Configurações: aparência, notificações, atalhos e privacidade.
import { useEffect, useState } from "react";
import { call, isTauri } from "../../api/client";
import { autostartEnabled, setAutostart, setCloseToTray, showSystemNotification } from "../../api/native";
import { useApp } from "../../contexts/app";
import { ColorPicker, Field, Loading, Segmented } from "../../components/ui";
import { Icon } from "../../components/Icon";
import { useAsync } from "../../hooks/data";
import { SHORTCUTS, comboFromEvent, effectiveShortcuts } from "../../layouts/shortcuts";
import { fmtDateTime } from "../../utils/format";
import { actionLabel } from "../../modules/panels";

function Toggle({ label, hint, checked, onChange, disabled, id }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; id?: string }) {
  return (
    <label className="row" style={{ alignItems: "flex-start", gap: 12, padding: "8px 0", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--primary)", marginTop: 2 }} />
      <span className="col" style={{ gap: 2 }}><b className="small">{label}</b>{hint && <span className="muted tiny">{hint}</span>}</span>
    </label>
  );
}

export function AppearanceTab() {
  const { settings, saveSettings, toast, confirm } = useApp();
  const s = settings;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <section className="card card-pad stack">
        <h2>Tema</h2>
        <Segmented label="Tema" value={s.theme} onChange={(v) => saveSettings({ theme: v })} options={[{ key: "claro", label: "Claro", icon: "Sun" }, { key: "escuro", label: "Escuro", icon: "Moon" }, { key: "sistema", label: "Sistema", icon: "Monitor" }]} />
        <Field label="Cor principal"><ColorPicker value={s.primary_color} onChange={(c) => saveSettings({ primary_color: c })} label="Cor principal" /></Field>
        <Field label="Cor de destaque"><ColorPicker value={s.accent_color} onChange={(c) => saveSettings({ accent_color: c })} label="Cor de destaque" /></Field>
      </section>
      <section className="card card-pad stack">
        <h2>Leitura e movimento</h2>
        <Field label="Densidade visual"><Segmented label="Densidade" value={s.density} onChange={(v) => saveSettings({ density: v })} options={[{ key: "confortavel", label: "Confortável" }, { key: "compacta", label: "Compacta" }]} /></Field>
        <Field label="Animações" hint="Reduzir ou desativar ajuda em computadores mais simples e para quem é sensível a movimento."><Segmented label="Animações" value={s.animations} onChange={(v) => saveSettings({ animations: v })} options={[{ key: "normais", label: "Normais" }, { key: "reduzidas", label: "Reduzidas" }, { key: "desativadas", label: "Desativadas" }]} /></Field>
        <Field label={`Tamanho do texto: ${s.font_scale}%`} htmlFor="fs">
          <input id="fs" type="range" min={85} max={130} step={5} value={s.font_scale} onChange={(e) => saveSettings({ font_scale: Number(e.target.value) })} />
        </Field>
      </section>
      <div><button className="btn" onClick={async () => { if (await confirm({ title: "Restaurar padrões?", message: "Tema, cores, atalhos, notificações e demais preferências do seu perfil voltarão ao padrão.", confirmLabel: "Restaurar" })) { await call("settings.reset"); window.location.reload(); toast("Preferências restauradas."); } }}><Icon name="RotateCcw" size={16} /> Restaurar preferências padrão</button></div>
    </div>
  );
}

const CATS: Array<[string, string]> = [["evento", "Compromissos e eventos"], ["tarefa", "Tarefas"], ["atraso", "Tarefas atrasadas"], ["vencimento", "Vencimento de contas"], ["documento", "Documentos"], ["habito", "Hábitos"], ["manutencao", "Manutenção da casa"], ["despensa", "Validade da despensa"], ["aniversario", "Aniversários"], ["saude", "Saúde e consultas"], ["orcamento", "Orçamentos"]];

export function NotificationsTab() {
  const { settings, saveSettings, toast } = useApp();
  const n = settings.notifications;
  const [auto, setAuto] = useState<boolean | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { autostartEnabled().then(setAuto).catch(() => setAuto(null)); }, []);
  const upd = async (v: Record<string, unknown>) => { try { await saveSettings({ notifications: { ...n, ...v } }); setErr(""); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      {err && <div className="alert danger" role="alert">{err}</div>}
      <section className="card card-pad">
        <h2>Notificações locais</h2>
        <Toggle label="Ativar notificações" hint="Lembretes aparecem na central de notificações (sino)." checked={!!n.enabled} onChange={(v) => upd({ enabled: v })} />
        <Toggle label="Mostrar também como notificação do Windows" checked={!!n.os} disabled={!n.enabled} onChange={(v) => upd({ os: v })} />
        <Field label="Antecedência padrão dos lembretes" htmlFor="adv">
          <select id="adv" className="input" style={{ maxWidth: 260 }} value={n.advance_minutes} onChange={(e) => upd({ advance_minutes: Number(e.target.value) })}>
            {[0, 5, 10, 15, 30, 60, 120, 1440].map((m) => <option key={m} value={m}>{m === 0 ? "Na hora" : m < 60 ? `${m} minutos antes` : m === 1440 ? "1 dia antes" : `${m / 60} hora(s) antes`}</option>)}
          </select>
        </Field>
        <button className="btn sm" style={{ marginTop: 10 }} onClick={async () => { if (isTauri) { await showSystemNotification("PERSONAL LIFE ULTRA", "Esta é uma notificação de teste."); toast("Notificação de teste enviada."); } else toast("Notificações do Windows só estão disponíveis no aplicativo instalado."); }}><Icon name="Bell" size={15} /> Testar notificação</button>
      </section>
      <section className="card card-pad">
        <h2>Horário silencioso</h2>
        <Toggle label="Não mostrar notificações do Windows neste horário" hint="Os avisos continuam registrados na central de notificações." checked={!!n.quiet_enabled} onChange={(v) => upd({ quiet_enabled: v })} />
        <div className="row">
          <Field label="Início" htmlFor="qs"><input id="qs" className="input" type="time" value={n.quiet_start} onChange={(e) => upd({ quiet_start: e.target.value })} /></Field>
          <Field label="Fim" htmlFor="qe"><input id="qe" className="input" type="time" value={n.quiet_end} onChange={(e) => upd({ quiet_end: e.target.value })} /></Field>
        </div>
      </section>
      <section className="card card-pad">
        <h2>Categorias</h2>
        <div className="grid-2">
          {CATS.map(([k, l]) => <Toggle key={k} label={l} checked={n.categories?.[k] !== false} onChange={(v) => upd({ categories: { ...n.categories, [k]: v } })} />)}
        </div>
      </section>
      <section className="card card-pad">
        <h2>Funcionamento em segundo plano no Windows</h2>
        <p className="muted small">Os lembretes são verificados a cada minuto enquanto o aplicativo está aberto ou minimizado na bandeja do sistema. Com o aplicativo totalmente encerrado, nenhum lembrete é exibido — não usamos servidores nem notificações push externas.</p>
        {!isTauri && <div className="alert warning small" style={{ marginTop: 8 }}><Icon name="Info" size={16} /> Indisponível no modo de desenvolvimento (navegador). Funciona no aplicativo instalado.</div>}
        <Toggle label="Iniciar com o Windows" hint="Abre o aplicativo minimizado ao entrar no Windows." checked={!!auto} disabled={!isTauri || auto === null} onChange={async (v) => { try { await setAutostart(v); setAuto(v); } catch (e) { toast((e as Error).message, "error"); } }} />
        <Toggle label="Manter na bandeja ao fechar a janela" hint="O botão fechar apenas oculta a janela; os lembretes continuam." checked={!!settings.close_to_tray} disabled={!isTauri} onChange={async (v) => { await saveSettings({ close_to_tray: v }); await setCloseToTray(v); }} />
      </section>
    </div>
  );
}

export function ShortcutsTab() {
  const { settings, saveSettings, toast } = useApp();
  const custom: Record<string, string> = settings.shortcuts ?? {};
  const eff = effectiveShortcuts(custom);
  const [rec, setRec] = useState<string | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!rec) return;
    const h = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") { setRec(null); return; }
      const combo = comboFromEvent(e);
      if (!combo || ["Ctrl", "Alt", "Shift", "Ctrl+Alt", "Ctrl+Shift", "Alt+Shift"].includes(combo)) return;
      if (!combo.includes("+") && !/^F\d+$/.test(combo)) { setErr("Use uma combinação com Ctrl, Alt ou Shift (ou uma tecla F1–F12)."); return; }
      const clash = SHORTCUTS.find((s) => s.action !== rec && eff[s.action] === combo);
      if (clash) { setErr(`“${combo}” já é usado em: ${clash.label}.`); return; }
      setErr("");
      setRec(null);
      await saveSettings({ shortcuts: { ...custom, [rec]: combo } });
      toast(`Atalho definido: ${combo}`);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [rec, custom, eff, saveSettings, toast]);
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      {err && <div className="alert warning" role="alert">{err}</div>}
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Ação</th><th>Atalho</th><th /></tr></thead>
          <tbody>
            {SHORTCUTS.map((s) => (
              <tr key={s.action}>
                <td>{s.label}</td>
                <td>{rec === s.action ? <span className="badge warning" role="status">Pressione a nova combinação… (Esc cancela)</span> : <span className="kbd" data-testid={`sc-${s.action}`}>{eff[s.action]}</span>}</td>
                <td className="num">
                  {s.fixed ? <span className="muted tiny">fixo</span> : (
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn sm" onClick={() => { setErr(""); setRec(s.action); }}><Icon name="Keyboard" size={14} /> Alterar</button>
                      {custom[s.action] && <button className="btn sm ghost" onClick={() => { const c = { ...custom }; delete c[s.action]; saveSettings({ shortcuts: c }); }}>Padrão ({s.combo})</button>}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PrivacyTab() {
  const { settings, saveSettings, toast } = useApp();
  const audit = useAsync(() => call<{ items: Array<{ action: string; entity?: string; created_at: string; user_name: string }> }>("audit.list"), []);
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <section className="card card-pad">
        <h2>Proteção</h2>
        <Toggle label="Exigir senha para abrir o Diário" checked={!!settings.diary_lock} onChange={(v) => saveSettings({ diary_lock: v })} />
        <Field label="Bloquear o perfil após inatividade" htmlFor="al">
          <select id="al" className="input" style={{ maxWidth: 260 }} value={settings.auto_lock_minutes} onChange={(e) => saveSettings({ auto_lock_minutes: Number(e.target.value) })}>
            {[0, 5, 10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m === 0 ? "Nunca" : `${m} minutos`}</option>)}
          </select>
        </Field>
        <Toggle label="Guardar histórico de pesquisas" checked={!!settings.search_history} onChange={(v) => saveSettings({ search_history: v })} />
        <button className="btn sm" onClick={async () => { await call("search.clear_history"); toast("Histórico de pesquisas apagado."); }}><Icon name="Trash2" size={15} /> Apagar histórico de pesquisas</button>
      </section>
      <section className="card card-pad">
        <h2>Como seus dados são protegidos</h2>
        <ul className="small" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Tudo fica armazenado localmente neste computador (SQLite + pasta de anexos). Nada é enviado à internet.</li>
          <li>Senhas: guardadas apenas como hash <b>Argon2id</b> com salt — nunca em texto puro.</li>
          <li>Backups: podem ser criptografados com senha (<b>AES-256-GCM</b>, chave derivada por Argon2id).</li>
          <li><b>O banco de dados em uso não é criptografado em disco.</b> Proteja sua conta do Windows (senha/BitLocker) para impedir acesso direto aos arquivos.</li>
          <li>Cada perfil só acessa os próprios dados pessoais; dados da família respeitam as permissões de cada integrante.</li>
        </ul>
      </section>
      <section className="card">
        <div className="card-head"><h3><Icon name="History" size={17} /> Minhas atividades registradas</h3></div>
        {audit.loading ? <Loading /> : (
          <div className="table-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
            <table className="table">
              <thead><tr><th>Data e hora</th><th>Ação</th><th>Módulo</th></tr></thead>
              <tbody>{audit.data?.items.map((a, i) => <tr key={i}><td>{fmtDateTime(a.created_at)}</td><td>{actionLabel(a.action)}</td><td className="muted">{a.entity ?? "—"}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
