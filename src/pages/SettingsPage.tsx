// Configurações do perfil, da aparência, notificações, atalhos, privacidade, automações, backup, lixeira e sobre.
import { Icon, type IconName } from "../components/Icon";
import { Tabs } from "../components/ui";
import { navigate, useRoute } from "../hooks/router";
import { ProfileTab, ProfilesTab } from "./settings/ProfileTabs";
import { AppearanceTab, NotificationsTab, PrivacyTab, ShortcutsTab } from "./settings/PrefsTabs";
import { AboutTab, AutomationsTab, BackupTab, TrashTab } from "./settings/DataTabs";

const TABS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: "perfil", label: "Perfil", icon: "User" },
  { key: "perfis", label: "Perfis da instalação", icon: "Users" },
  { key: "aparencia", label: "Aparência", icon: "Palette" },
  { key: "notificacoes", label: "Notificações", icon: "Bell" },
  { key: "atalhos", label: "Atalhos", icon: "Keyboard" },
  { key: "privacidade", label: "Privacidade e segurança", icon: "Shield" },
  { key: "automacoes", label: "Automações", icon: "Zap" },
  { key: "backup", label: "Backup e dados", icon: "Archive" },
  { key: "lixeira", label: "Lixeira", icon: "Trash2" },
  { key: "sobre", label: "Sobre", icon: "Info" },
];

export function SettingsPage() {
  const route = useRoute();
  const tab = TABS.some((t) => t.key === route.query.get("tab")) ? route.query.get("tab")! : "perfil";
  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="Settings" size={22} /></div>
          <div><h1>Configurações</h1><p>Preferências salvas no seu perfil, neste computador.</p></div>
        </div>
      </div>
      <Tabs tabs={TABS} value={tab} onChange={(k) => navigate(`/config?tab=${k}`)} />
      {tab === "perfil" && <ProfileTab />}
      {tab === "perfis" && <ProfilesTab />}
      {tab === "aparencia" && <AppearanceTab />}
      {tab === "notificacoes" && <NotificationsTab />}
      {tab === "atalhos" && <ShortcutsTab />}
      {tab === "privacidade" && <PrivacyTab />}
      {tab === "automacoes" && <AutomationsTab />}
      {tab === "backup" && <BackupTab />}
      {tab === "lixeira" && <TrashTab />}
      {tab === "sobre" && <AboutTab />}
    </div>
  );
}
