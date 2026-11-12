// Central de Ajuda: tutoriais, guia de módulos, perguntas frequentes, atalhos e versão (100% offline).
import { useMemo, useState } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { Icon, type IconName } from "../components/Icon";
import { Highlight, Tabs } from "../components/ui";
import { useAsync } from "../hooks/data";
import { navigate } from "../hooks/router";
import { MODULES } from "../modules/registry";
import { SHORTCUTS, effectiveShortcuts } from "../layouts/shortcuts";
import { mockups } from "../onboardingAssets";

interface Tutorial {
  id: string;
  title: string;
  icon: IconName;
  steps: string[];
  link: { to: string; label: string };
  image?: string;
}

export const TUTORIALS: Tutorial[] = [
  { id: "tarefa", title: "Como criar uma tarefa", icon: "CheckSquare", link: { to: "/m/tasks", label: "Abrir Tarefas" }, steps: [
    "No menu lateral, clique em Tarefas (ou pressione Ctrl+N dentro do módulo).",
    "Clique em “Adicionar tarefa” e preencha o título (obrigatório).",
    "Defina prioridade, prazo (data e horário opcional), categoria e, se quiser, a frequência de repetição.",
    "Salve com o botão Salvar ou Ctrl+S. Abra a tarefa para adicionar subtarefas, notas e anexos.",
    "Marque a caixa ao lado da tarefa para concluí-la. Tarefas vencidas aparecem como “Atrasada”.",
  ] },
  { id: "projetos", title: "Como organizar projetos", icon: "FolderKanban", link: { to: "/m/projects", label: "Abrir Projetos" }, steps: [
    "Em Projetos, crie um projeto com objetivo, prazo e cor.",
    "Abra o projeto e cadastre as etapas na seção Etapas; marque-as ao concluir.",
    "Em Tarefas, vincule tarefas ao projeto pelo campo Projeto.",
    "Use a visão Quadro (Kanban) para mover projetos entre Planejado, Em andamento, Pausado e Concluído.",
    "O progresso é recalculado automaticamente quando a automação “Atualizar progresso do projeto” está ativa.",
  ] },
  { id: "agenda", title: "Como utilizar a agenda", icon: "CalendarDays", image: mockups.calendar, link: { to: "/agenda", label: "Abrir Agenda" }, steps: [
    "Abra Agenda e escolha a visualização mensal, semanal ou diária.",
    "Clique em um dia ou em “Adicionar compromisso” e informe título, início e, se quiser, término, local e categoria.",
    "Defina repetição (diária, semanal, mensal, anual) e um lembrete local.",
    "Use os filtros para mostrar ou ocultar tipos de itens; tarefas com prazo e contas também aparecem no calendário.",
  ] },
  { id: "metas", title: "Como criar metas", icon: "Target", link: { to: "/m/goals", label: "Abrir Metas" }, steps: [
    "Em Metas, clique em “Adicionar meta” e informe título, prazo e indicador (ex.: km, livros, R$).",
    "Informe o valor alvo e o valor atual; o percentual é calculado automaticamente.",
    "Sem valor alvo, cadastre marcos: o progresso considera os marcos concluídos.",
    "Cada atualização do valor fica registrada no Histórico de progresso.",
  ] },
  { id: "familia", title: "Como configurar o ambiente familiar", icon: "Users", link: { to: "/familia", label: "Abrir Família" }, steps: [
    "Abra Família e clique em “Criar família”. Você se torna o administrador e recebe o FAMILY ID.",
    "Para convidar alguém, a pessoa precisa ter um perfil neste computador (Configurações › Perfis da instalação).",
    "Em Integrantes, convide o perfil: um código temporário (válido por 72 horas) é gerado.",
    "A pessoa entra no próprio perfil, abre Família e digita o código para aceitar.",
    "Ajuste as permissões de cada integrante (Integrante ou Personalizado). Limite: 6 integrantes.",
  ] },
  { id: "compartilhar", title: "Como compartilhar informações", icon: "Share2", link: { to: "/m/events", label: "Abrir Agenda pessoal" }, steps: [
    "Abra um compromisso, tarefa, documento, lista de compras ou meta do ambiente PESSOAL.",
    "No painel de detalhes, clique em “Compartilhar com a família” e confirme.",
    "O item passa a aparecer no ambiente FAMÍLIA para quem tem permissão, mas só você pode editá-lo.",
    "Para desfazer, abra o item e clique em “Cancelar compartilhamento”. Tudo fica registrado no histórico.",
  ] },
  { id: "backup", title: "Como criar backups", icon: "Archive", link: { to: "/config?tab=backup", label: "Abrir Backup e dados" }, steps: [
    "Abra Configurações › Backup e dados (disponível para o administrador da instalação).",
    "Clique em “Criar backup agora” e escolha onde salvar o arquivo .pluback.",
    "Opcional: defina uma senha para criptografar o backup (AES-256-GCM). Sem a senha não será possível restaurá-lo.",
    "O arquivo é verificado após a gravação. Configure também o backup automático e a pasta de destino.",
    "Qualquer perfil pode usar “Exportar meus dados” para obter uma cópia dos próprios registros.",
  ] },
  { id: "restaurar", title: "Como restaurar backups", icon: "RotateCcw", link: { to: "/config?tab=backup", label: "Abrir Backup e dados" }, steps: [
    "Em Configurações › Backup e dados, clique em “Restaurar backup” e selecione o arquivo .pluback.",
    "Confira as informações do backup (data, versão, número de perfis). Informe a senha do backup, se houver.",
    "Digite a senha do seu perfil e confirme que os dados atuais serão substituídos.",
    "Antes de restaurar, o aplicativo cria automaticamente um backup de segurança dos dados atuais.",
    "Após a restauração, entre novamente no seu perfil.",
  ] },
  { id: "painel", title: "Como personalizar o painel", icon: "LayoutGrid", image: mockups.dashboard, link: { to: "/", label: "Abrir Início" }, steps: [
    "No Início, clique em “Personalizar painel”.",
    "Adicione widgets pelo catálogo e remova os que não usa.",
    "Arraste os widgets (ou use as setas) para reorganizar e escolha o tamanho pequeno, médio ou grande.",
    "Salve. O layout é guardado por perfil e por ambiente (PESSOAL e FAMÍLIA). Use “Restaurar padrão” para voltar ao original.",
  ] },
  { id: "relatorios", title: "Como exportar relatórios", icon: "BarChart3", image: mockups.finance, link: { to: "/relatorios", label: "Abrir Relatórios" }, steps: [
    "Abra Relatórios e escolha o tipo (tarefas, projetos, metas, hábitos, finanças, contas, compras, estudos, atividades).",
    "Escolha o ambiente, o período e as colunas desejadas e confira a pré-visualização.",
    "Clique em PDF, CSV ou XLSX e escolha onde salvar o arquivo.",
    "Relatórios familiares exigem a permissão “Relatórios” e respeitam as permissões de cada área.",
  ] },
];

export const FAQ: Array<{ q: string; a: string }> = [
  { q: "O aplicativo precisa de internet?", a: "Não. Todas as funções principais funcionam offline. Não há servidores, nuvem, contas externas ou inteligência artificial; fontes, ícones e imagens estão dentro do aplicativo." },
  { q: "Onde ficam meus dados?", a: "Em um banco SQLite e em uma pasta de anexos dentro do diretório de dados do aplicativo neste computador (no Windows, em %APPDATA%\\com.personallifeultra.app). O caminho exato aparece em Configurações › Sobre. A desinstalação e as atualizações não apagam esses dados." },
  { q: "Esqueci minha senha. E agora?", a: "Por segurança, a senha é guardada apenas como hash e não existe recuperação pela internet. Se houver um backup, o administrador da instalação pode restaurá-lo; caso contrário, será necessário criar um novo perfil." },
  { q: "Quantos perfis e integrantes posso ter?", a: "Até 6 perfis por instalação e até 6 integrantes por família." },
  { q: "Como funcionam as notificações no Windows?", a: "Os lembretes são verificados a cada minuto enquanto o aplicativo está aberto ou minimizado na bandeja do sistema. Ative “Iniciar com o Windows” e “Manter na bandeja ao fechar” em Configurações › Notificações para recebê-los mesmo sem a janela aberta. Com o aplicativo totalmente encerrado, os lembretes não são exibidos." },
  { q: "Como funcionam os convites da família?", a: "Os convites são locais: valem apenas para perfis cadastrados neste computador. O administrador gera um código temporário que o convidado digita no próprio perfil. Também é possível solicitar entrada informando o FAMILY ID, mas a solicitação precisa ser aprovada." },
  { q: "Qual a diferença entre USER ID e FAMILY ID?", a: "O USER ID identifica permanentemente o seu perfil; o FAMILY ID identifica a família. Nenhum dos dois é senha nem concede acesso sozinho." },
  { q: "Meus dados pessoais aparecem para a família?", a: "Não. Somente itens que você compartilha explicitamente aparecem no ambiente FAMÍLIA, e o compartilhamento pode ser cancelado." },
  { q: "Os dados são criptografados?", a: "As senhas são protegidas com Argon2id e os backups podem ser criptografados com senha (AES-256-GCM). O banco local em uso não é criptografado: proteja o acesso à sua conta do Windows." },
  { q: "Como recupero algo que excluí?", a: "Itens excluídos vão para a lixeira (Configurações › Lixeira), de onde podem ser restaurados ou excluídos definitivamente." },
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function HelpPage() {
  const { settings, toast } = useApp();
  const [tab, setTab] = useState<"tutoriais" | "modulos" | "faq" | "atalhos" | "sobre">("tutoriais");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data: status } = useAsync(() => call<{ version: string; schema_version: number; data_dir: string }>("app.status"), []);
  const keys = effectiveShortcuts(settings.shortcuts);

  const k = norm(q.trim());
  const tutorials = useMemo(() => TUTORIALS.filter((t) => !k || norm(t.title + " " + t.steps.join(" ")).includes(k)), [k]);
  const faq = useMemo(() => FAQ.filter((f) => !k || norm(f.q + " " + f.a).includes(k)), [k]);
  const mods = useMemo(() => MODULES.filter((m) => !k || norm(m.label + " " + m.description).includes(k)), [k]);

  const reopen = async () => {
    try {
      await call("onboarding.restart");
      window.dispatchEvent(new CustomEvent("plu:onboarding"));
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="LifeBuoy" size={22} /></div>
          <div>
            <h1>Central de Ajuda</h1>
            <p>Tutoriais, perguntas frequentes e atalhos — disponível sem internet.</p>
          </div>
        </div>
        <button className="btn primary" onClick={reopen}><Icon name="Sparkles" size={16} /> Reabrir manual inicial</button>
      </div>
      <div className="search-input" style={{ maxWidth: 520, marginBottom: 14 }}>
        <Icon name="Search" size={16} />
        <input className="input" placeholder="Pesquisar na ajuda…" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value && tab !== "tutoriais" && tab !== "faq" && tab !== "modulos") setTab("tutoriais"); }} aria-label="Pesquisar na ajuda" />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "tutoriais", label: `Tutoriais (${tutorials.length})`, icon: "BookOpen" }, { key: "modulos", label: `Módulos (${mods.length})`, icon: "LayoutGrid" },
        { key: "faq", label: `Perguntas frequentes (${faq.length})`, icon: "HelpCircle" }, { key: "atalhos", label: "Atalhos", icon: "Keyboard" }, { key: "sobre", label: "Versão", icon: "Info" },
      ]} />
      {tab === "tutoriais" && (
        <div className="col" style={{ gap: 10 }}>
          {tutorials.length === 0 && <p className="muted">Nenhum tutorial encontrado.</p>}
          {tutorials.map((t) => {
            const isOpen = open === t.id || !!k;
            return (
              <div key={t.id} className="card">
                <button className="list-item" aria-expanded={isOpen} onClick={() => setOpen(open === t.id ? null : t.id)}>
                  <span className="page-icon" style={{ width: 34, height: 34 }}><Icon name={t.icon} size={17} /></span>
                  <b className="grow"><Highlight text={t.title} q={q} /></b>
                  <Icon name={isOpen ? "ChevronUp" : "ChevronDown"} size={16} />
                </button>
                {isOpen && (
                  <div className="card-body" style={{ paddingTop: 4 }}>
                    <div className="grid-2" style={{ alignItems: "start" }}>
                      <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                        {t.steps.map((s, i) => <li key={i}><Highlight text={s} q={q} /></li>)}
                      </ol>
                      {t.image && <img src={t.image} alt={`Ilustração: ${t.title}`} style={{ width: "100%", borderRadius: 10, border: "1px solid var(--border)" }} />}
                    </div>
                    <button className="btn sm" style={{ marginTop: 10 }} onClick={() => navigate(t.link.to)}><Icon name="ArrowUpRight" size={15} /> {t.link.label}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === "modulos" && (
        <div className="grid-auto">
          {mods.map((m) => (
            <button key={m.id} className="card clickable module-tile" onClick={() => navigate(`/m/${m.id}?ws=${m.workspaces[0]}`)}>
              <span className="ico"><Icon name={m.icon} size={20} /></span>
              <span className="col" style={{ gap: 2 }}>
                <b><Highlight text={m.label} q={q} /></b>
                <span className="tiny"><span className={`badge ${m.workspaces.includes("family") ? "accent" : "primary"}`}>{m.workspaces.map((w) => (w === "family" ? "FAMÍLIA" : "PESSOAL")).join(" · ")}</span></span>
                <span className="muted small"><Highlight text={m.description} q={q} /></span>
              </span>
            </button>
          ))}
        </div>
      )}
      {tab === "faq" && (
        <div className="col" style={{ gap: 10 }}>
          {faq.length === 0 && <p className="muted">Nenhuma pergunta encontrada.</p>}
          {faq.map((f) => (
            <details key={f.q} className="card card-pad" open={!!k}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}><Highlight text={f.q} q={q} /></summary>
              <p style={{ marginTop: 8 }} className="small"><Highlight text={f.a} q={q} /></p>
            </details>
          ))}
        </div>
      )}
      {tab === "atalhos" && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Ação</th><th>Atalho</th><th /></tr></thead>
            <tbody>
              {SHORTCUTS.map((s) => (
                <tr key={s.action}>
                  <td>{s.label}</td>
                  <td>{keys[s.action].split("+").map((p, i) => <span key={i}>{i > 0 && " + "}<span className="kbd">{p}</span></span>)}</td>
                  <td className="muted small">{s.fixed ? "fixo" : keys[s.action] !== s.combo ? "personalizado" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="card-body"><button className="btn sm" onClick={() => navigate("/config?tab=atalhos")}><Icon name="Keyboard" size={15} /> Personalizar atalhos</button></div>
        </div>
      )}
      {tab === "sobre" && (
        <div className="card card-pad col">
          <h2>PERSONAL LIFE ULTRA</h2>
          <p>Versão {status?.version ?? "—"} · esquema do banco v{status?.schema_version ?? "—"}</p>
          <p className="muted small">Aplicativo local de organização pessoal e familiar. Funciona sem internet, sem servidores externos e sem inteligência artificial.</p>
          <p className="small">Pasta de dados: <span className="id-chip">{status?.data_dir}</span></p>
        </div>
      )}
    </div>
  );
}
