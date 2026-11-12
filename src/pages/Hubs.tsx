// Páginas "Pessoal" (todos os módulos pessoais) e rota genérica de módulo.
import { useApp } from "../contexts/app";
import { Icon } from "../components/Icon";
import { EmptyState } from "../components/ui";
import { navigate } from "../hooks/router";
import { getModule, modulesFor } from "../modules/registry";
import { ModulePage } from "../modules/ModulePage";
import type { ModuleDef } from "../modules/types";

export function ModuleGrid({ mods, family }: { mods: ModuleDef[]; family?: boolean }) {
  const groups = Array.from(new Set(mods.map((m) => m.group)));
  return (
    <div className="stack">
      {groups.map((g) => (
        <section key={g}>
          <h3 style={{ marginBottom: 10 }}>{g}</h3>
          <div className="grid-auto">
            {mods.filter((m) => m.group === g).map((m) => (
              <button key={m.id} className={`card clickable module-tile ${family ? "family" : ""}`} onClick={() => navigate(`/m/${m.id}?ws=${family ? "family" : "personal"}`)}>
                <span className="ico"><Icon name={m.icon} size={20} /></span>
                <span className="col" style={{ gap: 2 }}>
                  <b>{m.label}</b>
                  <span className="muted small">{m.description}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PersonalHub() {
  const { user } = useApp();
  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon"><Icon name="User" size={22} /></div>
          <div>
            <h1>Pessoal</h1>
            <p>Ambiente privado de {user.full_name}. Nada aparece para a família sem um compartilhamento explícito.</p>
          </div>
        </div>
        <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
          <span className="tiny muted">USER ID</span>
          <span className="id-chip">{user.id}</span>
        </div>
      </div>
      <ModuleGrid mods={[...modulesFor("personal"), ...[getModule("health_professional")!]].filter((m, i, a) => a.indexOf(m) === i)} />
    </div>
  );
}

export function ModuleRoute({ id }: { id: string }) {
  const { workspace, setWorkspace, perm } = useApp();
  const mod = getModule(id);
  if (!mod) return <EmptyState icon="AlertCircle" title="Módulo não encontrado" action={<button className="btn" onClick={() => navigate("/")}>Voltar ao início</button>} />;
  if (!mod.workspaces.includes(workspace)) {
    const other = mod.workspaces[0];
    return (
      <EmptyState icon={mod.icon} title={`${mod.label} está disponível no ambiente ${other === "personal" ? "PESSOAL" : "FAMÍLIA"}`}
        text={other === "personal" ? "Este módulo organiza informações privadas. Você pode compartilhar itens com a família quando o módulo permitir." : "Este módulo pertence ao ambiente compartilhado da família."}
        action={<button className="btn primary" onClick={() => setWorkspace(other)}>Ir para {other === "personal" ? "PESSOAL" : "FAMÍLIA"}</button>} />
    );
  }
  if (workspace === "family" && !perm.family_id) {
    return (
      <EmptyState icon="Users" title="Você ainda não participa de uma família" text="Crie uma família ou aceite um convite para usar o ambiente compartilhado."
        action={<button className="btn primary" onClick={() => navigate("/familia")}>Configurar família</button>} />
    );
  }
  return <ModulePage key={`${mod.id}-${workspace}`} mod={mod} ws={workspace} />;
}
