// Estrutura principal: menu lateral, barra superior, conteúdo e rodapé.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "../contexts/app";
import { Icon, type IconName } from "../components/Icon";
import { Avatar } from "../components/ui";
import { navigate, useRoute } from "../hooks/router";
import { SearchOverlay } from "./Search";
import { NotificationsButton } from "./Notifications";
import { comboFromEvent, effectiveShortcuts } from "./shortcuts";
import { fmtLongDate } from "../utils/format";
import { appIcon } from "../assets";
import { isTauri, isWebDemo } from "../api/client";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  match: (p: string) => boolean;
}

export const NAV: Array<{ section?: string; items: NavItem[] }> = [
  { items: [
    { to: "/", label: "Início", icon: "Home", match: (p) => p === "/" },
    { to: "/pessoal", label: "Pessoal", icon: "User", match: (p) => p === "/pessoal" },
    { to: "/familia", label: "Família", icon: "Users", match: (p) => p === "/familia" },
  ] },
  { section: "Organização", items: [
    { to: "/agenda", label: "Agenda", icon: "CalendarDays", match: (p) => p === "/agenda" || p === "/m/events" },
    { to: "/m/tasks", label: "Tarefas", icon: "CheckSquare", match: (p) => p === "/m/tasks" },
    { to: "/m/projects", label: "Projetos", icon: "FolderKanban", match: (p) => p === "/m/projects" },
    { to: "/m/goals", label: "Metas", icon: "Target", match: (p) => p === "/m/goals" },
    { to: "/financas", label: "Finanças", icon: "Wallet", match: (p) => p === "/financas" },
    { to: "/estudos", label: "Estudos", icon: "GraduationCap", match: (p) => p === "/estudos" },
    { to: "/m/documents", label: "Documentos", icon: "FileText", match: (p) => p === "/m/documents" },
    { to: "/m/shopping_lists", label: "Compras", icon: "ShoppingCart", match: (p) => p === "/m/shopping_lists" },
  ] },
  { section: "Geral", items: [
    { to: "/relatorios", label: "Relatórios", icon: "BarChart3", match: (p) => p === "/relatorios" },
    { to: "/ajuda", label: "Central de Ajuda", icon: "LifeBuoy", match: (p) => p === "/ajuda" },
    { to: "/config", label: "Configurações", icon: "Settings", match: (p) => p === "/config" },
  ] },
];

export function AppShell({ children, version }: { children: ReactNode; version: string }) {
  const { user, workspace, setWorkspace, settings, saveSettings, perm, lock, logout } = useApp();
  const route = useRoute();
  const [searchOpen, setSearchOpen] = useState(false);
  const collapsed = !!settings.sidebar_collapsed;
  const keys = useMemo(() => effectiveShortcuts(settings.shortcuts), [settings.shortcuts]);
  const [menuOpen, setMenuOpen] = useState(false);

  // ambiente indicado na URL (ex.: vindo da pesquisa)
  useEffect(() => {
    const w = route.query.get("ws");
    if ((w === "personal" || w === "family") && w !== workspace) setWorkspace(w);
  }, [route, workspace, setWorkspace]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const combo = comboFromEvent(e);
      const action = Object.entries(keys).find(([, c]) => c === combo)?.[0];
      if (!action || action === "save" || action === "close") return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement).tagName);
      if (typing && !e.ctrlKey && !e.altKey && combo !== "F1") return;
      e.preventDefault();
      switch (action) {
        case "search": setSearchOpen(true); break;
        case "new": window.dispatchEvent(new CustomEvent("plu:new")); break;
        case "settings": navigate("/config"); break;
        case "home": navigate("/"); break;
        case "workspace": setWorkspace(workspace === "personal" ? "family" : "personal"); break;
        case "sidebar": saveSettings({ sidebar_collapsed: !collapsed }); break;
        case "lock": lock(); break;
        case "help": navigate("/ajuda"); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [keys, collapsed, saveSettings, workspace, setWorkspace, lock]);

  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar" aria-label="Menu principal">
        <div className="brand">
          <img src={appIcon} alt="" />
          <div className="brand-name">PERSONAL LIFE<span>ULTRA</span></div>
        </div>
        <nav className="nav">
          {NAV.map((g, i) => (
            <div key={i} className="col" style={{ gap: 2 }}>
              {g.section && <div className="nav-section">{g.section}</div>}
              {g.items.map((it) => (
                <a key={it.to} href={`#${it.to}`} className="nav-link" aria-current={it.match(route.path) ? "page" : undefined} title={collapsed ? it.label : undefined}
                  onClick={(e) => { e.preventDefault(); navigate(it.to); }}>
                  <Icon name={it.icon} size={19} />
                  <span>{it.label}</span>
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button className="nav-link" onClick={() => saveSettings({ sidebar_collapsed: !collapsed })} aria-label={collapsed ? "Expandir menu" : "Recolher menu"} title={`${collapsed ? "Expandir" : "Recolher"} menu (${keys.sidebar})`}>
            <Icon name={collapsed ? "ChevronRight" : "ChevronLeft"} size={18} /><span>Recolher menu</span>
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="ws-switch" role="group" aria-label="Ambiente">
            <button aria-pressed={workspace === "personal"} onClick={() => setWorkspace("personal")}><Icon name="User" size={15} /> PESSOAL</button>
            <button aria-pressed={workspace === "family"} onClick={() => setWorkspace("family")} title={perm.family_id ? undefined : "Você ainda não participa de uma família"}><Icon name="Users" size={15} /> FAMÍLIA</button>
          </div>
          <button className="topbar-search" onClick={() => setSearchOpen(true)} aria-label="Abrir pesquisa global">
            <Icon name="Search" size={16} /><span className="grow">Pesquisar…</span><span className="kbd">{keys.search}</span>
          </button>
          <span className="grow" />
          <span className="topbar-date">{fmtLongDate(new Date())}</span>
          <NotificationsButton />
          <button className="btn icon ghost" aria-label="Configurações" title={`Configurações (${keys.settings})`} onClick={() => navigate("/config")}><Icon name="Settings" /></button>
          <div style={{ position: "relative" }}>
            <button className="btn ghost" style={{ padding: "0 6px", height: 40 }} aria-label="Menu do perfil" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Avatar name={user.full_name} color={user.color} src={user.avatar} />
            </button>
            {menuOpen && (
              <div className="popover" style={{ width: 260 }} onMouseLeave={() => setMenuOpen(false)}>
                <div className="card-pad col" style={{ gap: 4 }}>
                  <b>{user.full_name}</b>
                  <span className="muted small">@{user.username}</span>
                </div>
                <div className="list">
                  <button className="list-item" onClick={() => { setMenuOpen(false); navigate("/config?tab=perfil"); }}><Icon name="User" size={16} /> Meu perfil</button>
                  <button className="list-item" onClick={() => { setMenuOpen(false); lock(); }}><Icon name="Lock" size={16} /> Bloquear perfil <span className="grow" /><span className="kbd">{keys.lock}</span></button>
                  <button className="list-item" onClick={() => { setMenuOpen(false); logout(); }}><Icon name="LogOut" size={16} /> Encerrar sessão</button>
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="content" id="conteudo">{children}</main>
        <footer className="app-footer">
          <span>PERSONAL LIFE ULTRA v{version}</span>
          <span className="row"><Icon name="Database" size={12} /> Dados locais · {isTauri ? "funcionando offline" : isWebDemo ? "versão web: dados salvos neste navegador" : "modo de desenvolvimento"} · {workspace === "family" ? "Ambiente FAMÍLIA" : "Ambiente PESSOAL"}</span>
        </footer>
      </div>
      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
