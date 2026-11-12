// Manual inicial em 8 etapas. Progresso salvo no SQLite por USER ID (onboarding.save).
import "../styles/pages-d.css";
// As demonstrações usam dados fictícios em memória (classe .demo) e não alteram dados reais;
// somente ações explícitas ("Aplicar este tema", "Criar minha primeira tarefa") gravam algo.
import { useEffect, useState, type ReactNode } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { Icon, type IconName } from "../components/Icon";
import { PALETTE, Progress } from "../components/ui";
import { navigate } from "../hooks/router";
import { onboardingArt, decor } from "../onboardingAssets";
import { cx } from "../utils/cx";

interface Progress {
  current_step: number;
  completed: boolean;
  skipped: boolean;
  visited: number[];
  checklist: Record<string, boolean>;
}

const STEPS: Array<{ n: number; name: string; art: string; optional?: boolean }> = [
  { n: 1, name: "Boas-vindas", art: onboardingArt.welcomePanel },
  { n: 2, name: "Perfil", art: onboardingArt.profile },
  { n: 3, name: "Ambientes", art: onboardingArt.workspaces },
  { n: 4, name: "Família", art: onboardingArt.family, optional: true },
  { n: 5, name: "Personalização", art: onboardingArt.personalization },
  { n: 6, name: "Módulos", art: onboardingArt.modules },
  { n: 7, name: "Privacidade e segurança", art: onboardingArt.security },
  { n: 8, name: "Primeiro acesso", art: onboardingArt.firstAccess },
];

function Bullet({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <li className="row" style={{ alignItems: "flex-start", gap: 10, padding: "4px 0" }}>
      <Icon name={icon} size={18} style={{ color: "var(--primary)", flex: "none", marginTop: 2 }} />
      <span>{children}</span>
    </li>
  );
}

function List({ children }: { children: ReactNode }) {
  return <ul style={{ listStyle: "none", padding: 0, margin: "10px 0" }}>{children}</ul>;
}

/** Demonstração isolada: item fictício alternando entre PESSOAL e FAMÍLIA. */
function ShareDemo() {
  const [shared, setShared] = useState(false);
  return (
    <div className="demo" data-testid="demo-share">
      <div className="grid-2">
        <div className="card card-pad col">
          <span className="badge primary">PESSOAL</span>
          <div className="row"><Icon name="CalendarDays" size={16} /> Consulta no dentista (fictício)</div>
        </div>
        <div className="card card-pad col">
          <span className="badge accent">FAMÍLIA</span>
          {shared ? <div className="row"><Icon name="Share2" size={16} /> Consulta no dentista (compartilhado)</div> : <span className="muted small">Nada compartilhado ainda.</span>}
        </div>
      </div>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => setShared((s) => !s)}>
        <Icon name="Share2" size={15} /> {shared ? "Cancelar compartilhamento (demo)" : "Compartilhar com a família (demo)"}
      </button>
    </div>
  );
}

/** Demonstração isolada: reorganizar widgets fictícios. */
function WidgetDemo() {
  const [w, setW] = useState(["Resumo de tarefas", "Próximos compromissos", "Metas em andamento", "Resumo financeiro"]);
  const move = (i: number, d: number) => {
    const n = [...w];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    setW(n);
  };
  return (
    <div className="demo">
      <div className="col">
        {w.map((x, i) => (
          <div key={x} className="card row" style={{ padding: "6px 10px" }}>
            <Icon name="GripVertical" size={15} /> <span className="grow small">{x}</span>
            <button className="btn icon sm ghost" aria-label={`Subir ${x}`} onClick={() => move(i, -1)}><Icon name="ChevronUp" size={14} /></button>
            <button className="btn icon sm ghost" aria-label={`Descer ${x}`} onClick={() => move(i, 1)}><Icon name="ChevronDown" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Demonstração isolada de tema e cor (pré-visualização local). */
function ThemeDemo() {
  const { saveSettings, toast } = useApp();
  const [dark, setDark] = useState(false);
  const [color, setColor] = useState(PALETTE[0]);
  const bg = dark ? "#0f1115" : "#ffffff";
  const fg = dark ? "#eceef2" : "#171a21";
  return (
    <div className="demo">
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <div className="btn-group" role="group" aria-label="Tema da prévia">
          <button aria-pressed={!dark} onClick={() => setDark(false)}><Icon name="Sun" size={15} /> Claro</button>
          <button aria-pressed={dark} onClick={() => setDark(true)}><Icon name="Moon" size={15} /> Escuro</button>
        </div>
        <div className="swatches">
          {PALETTE.slice(0, 7).map((c) => <button key={c} className="swatch" style={{ background: c }} aria-pressed={color === c} aria-label={`Cor ${c}`} onClick={() => setColor(c)} />)}
        </div>
      </div>
      <div style={{ background: bg, color: fg, borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
        <b>Prévia do painel</b>
        <div style={{ height: 8, borderRadius: 4, background: color, width: "60%", margin: "10px 0" }} />
        <button style={{ background: color, color: "#fff", border: 0, borderRadius: 7, padding: "6px 12px" }}>Botão principal</button>
      </div>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={async () => { await saveSettings({ theme: dark ? "escuro" : "claro", primary_color: color }); toast("Tema aplicado ao seu perfil."); }}>
        <Icon name="Palette" size={15} /> Aplicar este tema de verdade
      </button>
    </div>
  );
}

function FirstTask({ onCreated }: { onCreated: () => void }) {
  const { toast } = useApp();
  const [title, setTitle] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const create = async () => {
    if (!title.trim()) { setErr("Digite um título para a tarefa."); return; }
    try {
      await call("rec.create", { entity: "tasks", scope: "personal", values: { title: title.trim(), status: "pendente", priority: 1 } });
      setDone(true);
      toast("Primeira tarefa criada!");
      onCreated();
    } catch (e) { setErr((e as Error).message); }
  };
  if (done) return <div className="alert success"><Icon name="CheckCircle2" /> Tarefa “{title}” criada em Tarefas (PESSOAL).</div>;
  return (
    <div className="col">
      <label className="label" htmlFor="onb-task">Criar minha primeira tarefa (real)</label>
      <div className="row">
        <input id="onb-task" className="input" value={title} placeholder="Ex.: Organizar documentos" onChange={(e) => { setTitle(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && create()} aria-invalid={!!err} />
        <button className="btn primary" onClick={create}><Icon name="Plus" size={15} /> Criar</button>
      </div>
      {err && <span className="small" role="alert" style={{ color: "var(--danger)" }}>{err}</span>}
    </div>
  );
}

export function Onboarding({ onClose }: { onClose: () => void }) {
  const { user, perm } = useApp();
  const [p, setP] = useState<Progress | null>(null);
  const [step, setStep] = useState(1);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    call<Progress>("onboarding.get").then(async (r) => { setStep(r.current_step || 1); setP(r.visited?.length ? r : await call<Progress>("onboarding.save", { current_step: r.current_step || 1 })); }).catch(() => onClose());
  }, [onClose]);

  const save = async (vals: Partial<Progress>) => {
    try { setP(await call<Progress>("onboarding.save", vals)); } catch { /* sessão encerrada */ }
  };
  const go = (n: number) => { setStep(n); setHelpOpen(false); save({ current_step: n }); };
  const check = (k: string) => save({ checklist: { [k]: true } });
  const finish = async () => { await save({ current_step: 8, completed: true, checklist: { manual: true } }); onClose(); };
  const skip = async () => { await save({ current_step: step, skipped: true }); onClose(); };
  const close = async () => { await save({ current_step: step }); onClose(); };

  if (!p) return null;
  const s = STEPS[step - 1];
  const visited = new Set([...(p.visited ?? []), step]);
  const cl = p.checklist ?? {};

  const content: Record<number, ReactNode> = {
    1: (
      <>
        <p>O <b>PERSONAL LIFE ULTRA</b> é a sua central de organização pessoal e familiar: agenda, tarefas, projetos, metas, finanças, estudos, documentos, compras e a rotina da casa — tudo guardado <b>somente neste computador</b> e funcionando sem internet.</p>
        <List>
          <Bullet icon="LayoutGrid">Menu lateral com os módulos; recolha-o com <span className="kbd">Ctrl</span>+<span className="kbd">B</span>.</Bullet>
          <Bullet icon="Search">Pesquisa global em qualquer tela com <span className="kbd">Ctrl</span>+<span className="kbd">K</span>.</Bullet>
          <Bullet icon="Users">Alternância entre os ambientes <b>PESSOAL</b> e <b>FAMÍLIA</b> no topo da tela.</Bullet>
          <Bullet icon="Bell">Notificações locais de compromissos, prazos e vencimentos.</Bullet>
        </List>
        <p className="muted small">Este manual leva cerca de 10 minutos. Você pode pular, fechar e continuar depois de onde parou.</p>
      </>
    ),
    2: (
      <>
        <p>Cada pessoa usa um <b>perfil local</b> com senha própria. Seus dados pessoais e suas preferências pertencem só ao seu perfil.</p>
        <div className="card card-pad col" style={{ gap: 6 }}>
          <span className="label">Seu USER ID</span>
          <span className="id-chip" data-testid="onb-user-id">{user.id}</span>
          <span className="muted small">Identificador permanente do seu perfil. Ele não muda entre acessos, não é uma senha e é diferente do FAMILY ID.</span>
        </div>
        <List>
          <Bullet icon="Pencil">Edite nome, foto e cor em <b>Configurações › Perfil</b>.</Bullet>
          <Bullet icon="KeyRound">Altere a senha e bloqueie o perfil (<span className="kbd">Ctrl</span>+<span className="kbd">L</span>) quando se afastar.</Bullet>
          <Bullet icon="Settings">Preferências (tema, notificações, atalhos) são salvas por perfil.</Bullet>
        </List>
        <button className="btn sm" onClick={() => { check("perfil"); navigate("/config?tab=perfil"); close(); }}><Icon name="User" size={15} /> Abrir meu perfil</button>
      </>
    ),
    3: (
      <>
        <p>O aplicativo tem dois ambientes separados:</p>
        <List>
          <Bullet icon="User"><b>PESSOAL</b> — privado. Ninguém mais vê esses dados.</Bullet>
          <Bullet icon="Users"><b>FAMÍLIA</b> — compartilhado entre os integrantes, de acordo com as permissões de cada um.</Bullet>
          <Bullet icon="Share2">Nada pessoal aparece na família sem um <b>compartilhamento explícito</b>, que pode ser cancelado depois.</Bullet>
        </List>
        <ShareDemo />
      </>
    ),
    4: (
      <>
        <p>Etapa opcional. A família organiza a rotina da casa entre os perfis <b>deste computador</b>.</p>
        <List>
          <Bullet icon="Crown">Quem cria a família é o <b>administrador</b> e define permissões (Administrador, Integrante ou Personalizado).</Bullet>
          <Bullet icon="Building2">A família recebe um <b>FAMILY ID</b> permanente. Conhecê-lo não dá acesso: a entrada precisa de aprovação.</Bullet>
          <Bullet icon="Mail">Convites locais geram um <b>código temporário</b> (válido por 72 h), diferente do FAMILY ID.</Bullet>
          <Bullet icon="Users">Limite de <b>6 integrantes</b> por família e de 6 perfis por instalação.</Bullet>
          <Bullet icon="Info">Não há sincronização pela internet entre computadores nesta versão.</Bullet>
        </List>
        <div className="row wrap">
          {perm.family_id ? <span className="badge accent">Você já participa da família {perm.family_id}</span>
            : <button className="btn sm" onClick={() => { check("familia"); navigate("/familia"); close(); }}><Icon name="Users" size={15} /> Configurar família agora</button>}
          <button className="btn sm ghost" onClick={() => go(5)}>Deixar para depois</button>
        </div>
      </>
    ),
    5: (
      <>
        <p>Deixe o aplicativo do seu jeito: tema claro, escuro ou do sistema, cor principal e de destaque, densidade e animações. No <b>Início</b>, use “Personalizar painel” para adicionar, remover, reordenar e redimensionar widgets.</p>
        <div className="grid-2">
          <ThemeDemo />
          <WidgetDemo />
        </div>
      </>
    ),
    6: (
      <>
        <p>Principais módulos:</p>
        <div className="grid-2">
          {([["CalendarDays", "Agenda", "Compromissos, recorrências e lembretes."], ["CheckSquare", "Tarefas", "Prazos, prioridades e subtarefas."], ["FolderKanban", "Projetos", "Etapas, Kanban e progresso."], ["Target", "Metas", "Indicadores, marcos e histórico."],
            ["Wallet", "Finanças", "Receitas, despesas, orçamentos e contas."], ["GraduationCap", "Estudos", "Matérias, provas, cursos e sessões."], ["FileText", "Documentos", "Anexos locais e datas importantes."], ["ShoppingCart", "Compras", "Listas, itens e histórico."]] as Array<[IconName, string, string]>).map(([i, t, d]) => (
            <div key={t} className="row" style={{ alignItems: "flex-start" }}>
              <span className="page-icon" style={{ width: 34, height: 34 }}><Icon name={i} size={17} /></span>
              <div><b>{t}</b><div className="muted small">{d}</div></div>
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 10 }}>Veja todos em <b>Pessoal</b> e <b>Família</b> no menu lateral.</p>
      </>
    ),
    7: (
      <>
        <List>
          <Bullet icon="Database">Os dados ficam em um banco SQLite na pasta do aplicativo deste computador. Nada é enviado para servidores ou nuvem.</Bullet>
          <Bullet icon="KeyRound">Senhas são guardadas apenas como hash Argon2id. Não existe recuperação de senha pela internet.</Bullet>
          <Bullet icon="Shield">Permissões controlam o que cada integrante vê e edita na família.</Bullet>
          <Bullet icon="Archive">O <b>backup</b> gera um arquivo .pluback com banco e anexos, verificado por SHA-256, opcionalmente protegido por senha (AES-256-GCM).</Bullet>
          <Bullet icon="RotateCcw">A <b>restauração</b> valida o arquivo e cria antes um backup de segurança dos dados atuais.</Bullet>
          <Bullet icon="Info">Limites offline: sem sincronização entre computadores; lembretes funcionam com o app aberto ou na bandeja do sistema.</Bullet>
        </List>
        <button className="btn sm" onClick={() => { check("backup"); navigate("/config?tab=backup"); close(); }}><Icon name="Archive" size={15} /> Ver backup e restauração</button>
      </>
    ),
    8: (
      <>
        <p>Tudo pronto! Checklist para começar:</p>
        <List>
          {([["perfil", "Revisar meu perfil"], ["tarefa", "Criar a primeira tarefa"], ["familia", "Configurar a família (opcional)"], ["backup", "Conhecer o backup"]] as Array<[string, string]>).map(([k, l]) => (
            <Bullet key={k} icon={cl[k] ? "CheckCircle2" : "Square"}>{l}</Bullet>
          ))}
        </List>
        <FirstTask onCreated={() => check("tarefa")} />
        <img src={decor.waves} alt="" style={{ width: "100%", height: 40, objectFit: "cover", marginTop: 14, opacity: 0.8 }} />
      </>
    ),
  };

  const pct = Math.round((step / 8) * 100);
  return (
    <div className="overlay" onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <div className="modal onb" role="dialog" aria-modal="true" aria-labelledby="onb-title">
        <nav className="onb-steps" aria-label="Etapas do manual">
          <div className="row" style={{ marginBottom: 10 }}><Icon name="Sparkles" size={18} style={{ color: "var(--primary)" }} /><b>Manual inicial</b></div>
          {STEPS.map((st) => (
            <button key={st.n} className={cx("onb-step", visited.has(st.n) && st.n !== step && "done")} aria-current={st.n === step ? "step" : undefined} onClick={() => go(st.n)}>
              <span className="n">{visited.has(st.n) && st.n !== step ? <Icon name="Check" size={13} /> : st.n}</span>
              <span>{st.name}{st.optional && <span className="tiny muted"> (opcional)</span>}</span>
            </button>
          ))}
          <span className="grow" />
          <span className="tiny muted">Seu progresso é salvo automaticamente.</span>
        </nav>
        <div className="onb-main">
          <div className="modal-head">
            <div className="col" style={{ gap: 4, flex: 1 }}>
              <span className="tiny muted">Etapa {step} de 8</span>
              <h2 id="onb-title">{s.name}</h2>
              <Progress value={pct} label="Progresso do manual" />
            </div>
            <button className="btn icon ghost" aria-label="Ajuda sobre o manual" aria-expanded={helpOpen} onClick={() => setHelpOpen((h) => !h)}><Icon name="HelpCircle" /></button>
            <button className="btn icon ghost" aria-label="Fechar manual" onClick={close}><Icon name="X" /></button>
          </div>
          <div className="onb-body">
            {helpOpen && (
              <div className="alert small" style={{ marginBottom: 12 }}>
                <Icon name="Info" size={16} />
                <span>Use <b>Próximo</b>/<b>Anterior</b> ou clique nas etapas à esquerda. <b>Fechar</b> guarda onde você parou; <b>Pular</b> encerra o manual. Ele pode ser reaberto a qualquer momento na <b>Central de Ajuda</b>. As áreas marcadas como demonstração não alteram seus dados.</span>
              </div>
            )}
            <img className="onb-illu" src={s.art} alt={`Ilustração: ${s.name}`} />
            {content[step]}
          </div>
          <div className="modal-foot">
            <button className="btn ghost" onClick={skip}>Pular manual</button>
            <span className="grow" />
            <button className="btn" disabled={step === 1} onClick={() => go(step - 1)}><Icon name="ChevronLeft" size={15} /> Anterior</button>
            {step < 8 ? <button className="btn primary" onClick={() => go(step + 1)}>Próximo <Icon name="ChevronRight" size={15} /></button>
              : <button className="btn primary" onClick={finish}><Icon name="Check" size={15} /> Concluir manual</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
