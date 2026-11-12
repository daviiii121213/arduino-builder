// Raiz: verifica o estado do núcleo local, autenticação, bloqueio e rotas.
import { useCallback, useEffect, useState } from "react";
import { call, onApiError } from "./api/client";
import { AppProvider, useApp, type User } from "./contexts/app";
import { AuthScreen, LockScreen } from "./pages/AuthScreen";
import { AppShell } from "./layouts/AppShell";
import { useRoute } from "./hooks/router";
import { Dashboard } from "./pages/Dashboard";
import { PersonalHub, ModuleRoute } from "./pages/Hubs";
import { FamilyPage } from "./pages/FamilyPage";
import { CalendarPage } from "./pages/CalendarPage";
import { FinancePage } from "./pages/FinancePage";
import { StudiesPage } from "./pages/StudiesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { HelpPage } from "./pages/HelpPage";
import { SettingsPage } from "./pages/SettingsPage";
import { Onboarding } from "./pages/Onboarding";
import { EmptyState } from "./components/ui";

interface Status {
  version: string;
  users: number;
  session: { user_id: string; locked: boolean } | null;
  user: User | null;
}

function Routes() {
  const route = useRoute();
  const p = route.parts;
  switch (p[0]) {
    case undefined: return <Dashboard />;
    case "pessoal": return <PersonalHub />;
    case "familia": return <FamilyPage />;
    case "agenda": return <CalendarPage />;
    case "financas": return <FinancePage />;
    case "estudos": return <StudiesPage />;
    case "relatorios": return <ReportsPage />;
    case "ajuda": return <HelpPage />;
    case "config": return <SettingsPage />;
    case "m": return <ModuleRoute id={p[1]} />;
    default: return <EmptyState icon="AlertCircle" title="Página não encontrada" />;
  }
}

function OnboardingGate() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    call<{ should_show: boolean }>("onboarding.get").then((o) => setOpen(o.should_show)).catch(() => {});
    const h = () => setOpen(true);
    window.addEventListener("plu:onboarding", h);
    return () => window.removeEventListener("plu:onboarding", h);
  }, [user.id]);
  return open ? <Onboarding onClose={() => setOpen(false)} /> : null;
}

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await call<Status>("app.status");
      setStatus(s);
      setLocked(!!s.session?.locked);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    refresh();
    return onApiError((e) => {
      if (e.code === "locked") setLocked(true);
      if (e.code === "unauthenticated") refresh();
    });
  }, [refresh]);

  const onLoggedOut = useCallback(() => { window.location.hash = "#/"; refresh(); }, [refresh]);
  const onLocked = useCallback(() => setLocked(true), []);

  if (error) {
    return (
      <div className="auth-panel" style={{ minHeight: "100vh" }}>
        <div className="alert danger" role="alert" style={{ maxWidth: 520 }}>
          <div>
            <b>Não foi possível iniciar o núcleo local.</b>
            <p className="small">{error}</p>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={refresh}>Tentar novamente</button>
          </div>
        </div>
      </div>
    );
  }
  if (!status) return <div className="loading-block" style={{ height: "100vh", alignItems: "center" }}><div className="spinner" /></div>;
  if (!status.session || (!status.user && !locked)) {
    return <AuthScreen hasUsers={status.users > 0} onLogin={() => refresh()} />;
  }
  if (locked) {
    return <LockScreen user={status.user} onUnlock={() => { setLocked(false); refresh(); }} onSwitch={async () => { await call("auth.logout"); refresh(); }} />;
  }
  return (
    <AppProvider key={status.user!.id} initialUser={status.user!} onLoggedOut={onLoggedOut} onLocked={onLocked}>
      <AppShell version={status.version}>
        <Routes />
      </AppShell>
      <OnboardingGate />
    </AppProvider>
  );
}
