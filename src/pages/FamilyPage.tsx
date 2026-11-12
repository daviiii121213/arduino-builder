// Ambiente FAMÍLIA: criação, entrada, integrantes, convites, permissões e administração.
import { useState } from "react";
import { call } from "../api/client";
import { useApp } from "../contexts/app";
import { invalidateMembers, useAsync } from "../hooks/data";
import { Icon } from "../components/Icon";
import { Avatar, EmptyState, ErrorState, Field, Loading, Modal, Tabs } from "../components/ui";
import { ModuleGrid } from "./Hubs";
import { modulesFor } from "../modules/registry";
import { fmtDateTime } from "../utils/format";
import { actionLabel } from "../modules/panels";
import type { Rec } from "../modules/types";
import "../styles/family.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Info = Record<string, any>;

const ROLE_LABEL: Record<string, string> = { admin: "Administrador", integrante: "Integrante", personalizado: "Personalizado" };

function useFamilyActions(reload: () => void) {
  const { toast, reloadPerm } = useApp();
  return async (cmd: string, args: Rec, okMsg?: string): Promise<Info | null> => {
    try {
      const r = await call<Info>(cmd, args);
      if (okMsg) toast(okMsg);
      invalidateMembers();
      await reloadPerm();
      reload();
      return r;
    } catch (e) {
      toast((e as Error).message, "error");
      return null;
    }
  };
}

function NoFamily({ info, reload }: { info: Info; reload: () => void }) {
  const act = useFamilyActions(reload);
  const [name, setName] = useState("");
  const [fid, setFid] = useState("");
  const [accepting, setAccepting] = useState<Info | null>(null);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");
  const { confirm } = useApp();

  return (
    <div className="stack">
      <div className="alert">
        <Icon name="Info" />
        <div className="small">
          O ambiente <b>FAMÍLIA</b> reúne agenda, tarefas domésticas, compras, finanças da casa e memórias compartilhadas entre até 6 perfis
          <b> deste computador</b>. Seus dados pessoais continuam privados: nada aparece para a família sem um compartilhamento explícito.
        </div>
      </div>
      <div className="grid-2">
        <section className="card card-pad col">
          <h2 className="row"><Icon name="Plus" /> Criar uma família</h2>
          <p className="muted small">Você será o administrador e poderá convidar outros perfis locais.</p>
          <form className="col" onSubmit={async (e) => { e.preventDefault(); if (name.trim()) await act("family.create", { name: name.trim() }, "Família criada."); }}>
            <Field label="Nome da família" required htmlFor="fam-name">
              <input id="fam-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Família Souza" />
            </Field>
            <button className="btn primary" disabled={!name.trim()}>Criar família</button>
          </form>
        </section>
        <section className="card card-pad col">
          <h2 className="row"><Icon name="DoorOpen" /> Pedir para entrar</h2>
          <p className="muted small">
            Informe o FAMILY ID. <b>Conhecer o identificador não dá acesso:</b> o pedido fica pendente até ser aprovado por quem gerencia os integrantes.
          </p>
          <form className="col" onSubmit={async (e) => { e.preventDefault(); if (fid.trim() && (await act("family.request_join", { family_id: fid.trim() }, "Solicitação enviada."))) setFid(""); }}>
            <Field label="FAMILY ID" htmlFor="fam-id">
              <input id="fam-id" className="input mono" value={fid} onChange={(e) => setFid(e.target.value)} placeholder="FAM-XXXX-XXXX" />
            </Field>
            <button className="btn" disabled={!fid.trim()}>Enviar solicitação</button>
          </form>
          {info.my_requests?.length > 0 && (
            <div className="list card">
              {info.my_requests.map((r: Info) => (
                <div key={r.id} className="list-item">
                  <Icon name="Hourglass" size={16} />
                  <div className="grow small">Aguardando aprovação · <span className="mono">{r.family_id}</span><div className="tiny muted">{fmtDateTime(r.created_at)}</div></div>
                  <button className="btn sm" onClick={() => act("family.cancel_request", { id: r.id }, "Solicitação cancelada.")}>Cancelar</button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h3 className="row"><Icon name="Mail" size={17} /> Convites recebidos</h3></div>
        {!info.received_invitations?.length ? (
          <p className="muted small card-body">Nenhum convite pendente. Peça ao administrador de uma família para convidar o seu perfil.</p>
        ) : (
          <div className="list">
            {info.received_invitations.map((i: Info) => (
              <div key={i.id} className="list-item">
                <Icon name="Users" />
                <div className="grow">
                  <div className="title">{i.family_name}</div>
                  <div className="tiny muted">Convidado por {i.invited_by} · expira em {fmtDateTime(i.expires_at)}</div>
                </div>
                <button className="btn sm primary" onClick={() => { setAccepting(i); setCode(""); setCodeErr(""); }}>Aceitar</button>
                <button className="btn sm" onClick={async () => { if (await confirm({ title: "Recusar convite?", message: `O convite de ${i.family_name} será recusado.`, confirmLabel: "Recusar" })) act("family.decline_invite", { id: i.id }, "Convite recusado."); }}>Recusar</button>
              </div>
            ))}
          </div>
        )}
      </section>
      {accepting && (
        <Modal size="sm" title={`Entrar em ${accepting.family_name}`} onClose={() => setAccepting(null)}
          footer={<><button className="btn" onClick={() => setAccepting(null)}>Cancelar</button>
            <button className="btn primary" disabled={!code.trim()} onClick={async () => {
              try {
                await call("family.accept_invite", { code: code.trim() });
                setAccepting(null);
                invalidateMembers();
                act("family.info", {}, "Você entrou na família.");
              } catch (e) { setCodeErr((e as Error).message); }
            }}>Entrar na família</button></>}>
          <div className="col">
            <p className="small">Digite o <b>código temporário</b> que o administrador recebeu ao criar o convite. Ele é diferente do FAMILY ID.</p>
            <Field label="Código do convite" error={codeErr} htmlFor="inv-code">
              <input id="inv-code" className="input mono" value={code} onChange={(e) => { setCode(e.target.value); setCodeErr(""); }} placeholder="XXXX-XXXX" autoFocus />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MembersTab({ info, reload }: { info: Info; reload: () => void }) {
  const { can, confirm, perm } = useApp();
  const act = useFamilyActions(reload);
  const manage = can("members.manage");
  const [created, setCreated] = useState<Info | null>(null);
  const [target, setTarget] = useState("");
  const full = info.members.length + (info.invitations?.length ?? 0) >= info.max_members;
  return (
    <div className="stack">
      <section className="card">
        <div className="card-head"><h3>Integrantes ({info.members.length}/{info.max_members})</h3></div>
        <div className="list">
          {info.members.map((m: Info) => (
            <div key={m.id} className="list-item">
              <Avatar name={m.full_name} color={m.color} />
              <div className="grow">
                <div className="title">{m.full_name} {m.id === perm.user_id && <span className="muted small">(você)</span>}</div>
                <div className="tiny muted">@{m.username} · desde {fmtDateTime(m.joined_at)}</div>
              </div>
              <span className={`badge ${m.role === "admin" ? "primary" : m.role === "personalizado" ? "warning" : ""}`}>{m.role === "admin" && <Icon name="Crown" size={12} />} {ROLE_LABEL[m.role]}</span>
              {manage && !m.is_admin && m.id !== perm.user_id && (
                <button className="btn sm ghost" aria-label={`Remover ${m.full_name}`} onClick={async () => {
                  if (await confirm({ title: "Remover integrante?", danger: true, confirmLabel: "Remover", message: <>{m.full_name} deixará a família. Os itens pessoais que ele compartilhou deixam de aparecer; registros familiares criados por ele permanecem, sob o administrador.</> }))
                    act("family.remove_member", { user_id: m.id }, "Integrante removido.");
                }}><Icon name="Trash2" size={15} /> Remover</button>
              )}
            </div>
          ))}
        </div>
      </section>
      {manage && (
        <section className="card card-pad col">
          <h3 className="row"><Icon name="UserPlus" size={17} /> Convidar perfil deste computador</h3>
          {full ? <p className="muted small">Limite de {info.max_members} integrantes atingido (contando convites pendentes).</p> : !info.available_profiles?.length ? (
            <p className="muted small">Não há perfis locais disponíveis. Cadastre um novo perfil em Configurações › Perfis — perfis que já participam de outra família não podem ser convidados.</p>
          ) : (
            <div className="row wrap">
              <select className="input" style={{ maxWidth: 300 }} value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Perfil a convidar">
                <option value="">Selecione um perfil…</option>
                {info.available_profiles.map((p: Info) => <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>)}
              </select>
              <button className="btn primary" disabled={!target} onClick={async () => {
                const r = await act("family.invite", { user_id: target }, "Convite criado.");
                if (r) { setCreated({ ...r, name: info.available_profiles.find((p: Info) => p.id === target)?.full_name }); setTarget(""); }
              }}>Gerar convite</button>
            </div>
          )}
          {created && (
            <div className="alert success" role="status">
              <Icon name="KeyRound" />
              <div className="col" style={{ gap: 4 }}>
                <span>Convite para <b>{created.name}</b> criado. Informe este código temporário — {created.name} deve entrar no próprio perfil, abrir <b>Família</b> e digitá-lo:</span>
                <span className="id-chip invite-code" data-testid="invite-code">{created.code}</span>
                <span className="tiny muted">Válido até {fmtDateTime(created.expires_at)}. O código não é o FAMILY ID e só funciona para este perfil.</span>
              </div>
            </div>
          )}
          {info.invitations?.length > 0 && (
            <>
              <h4>Convites pendentes</h4>
              <div className="list card">
                {info.invitations.map((i: Info) => (
                  <div key={i.id} className="list-item">
                    <Icon name="Mail" size={16} />
                    <div className="grow small">{i.user_name} <span className="muted">· código <span className="mono">{i.code}</span> · expira {fmtDateTime(i.expires_at)}</span></div>
                    <button className="btn sm" onClick={() => act("family.cancel_invite", { id: i.id }, "Convite cancelado.")}>Cancelar</button>
                  </div>
                ))}
              </div>
            </>
          )}
          {info.requests?.length > 0 && (
            <>
              <h4>Solicitações de entrada</h4>
              <div className="list card">
                {info.requests.map((r: Info) => (
                  <div key={r.id} className="list-item">
                    <Icon name="DoorOpen" size={16} />
                    <div className="grow small">{r.user_name} <span className="muted">(@{r.username}) · {fmtDateTime(r.created_at)}</span></div>
                    <button className="btn sm primary" disabled={info.members.length >= info.max_members} onClick={() => act("family.respond_request", { id: r.id, approve: true }, "Solicitação aprovada.")}>Aprovar</button>
                    <button className="btn sm" onClick={() => act("family.respond_request", { id: r.id, approve: false }, "Solicitação recusada.")}>Recusar</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function PermEditor({ member, info, reload, onClose }: { member: Info; info: Info; reload: () => void; onClose: () => void }) {
  const act = useFamilyActions(reload);
  const [role, setRole] = useState<string>(member.role === "admin" ? "integrante" : member.role);
  const [set, setSet] = useState<Set<string>>(new Set(member.permissions ?? []));
  const toggle = (k: string, on: boolean) => setSet((s) => { const n = new Set(s); if (on) n.add(k); else n.delete(k); return n; });
  return (
    <Modal size="lg" title={`Permissões de ${member.full_name}`} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" onClick={async () => { if (await act("family.set_permissions", { user_id: member.id, role, permissions: Array.from(set) }, "Permissões atualizadas.")) onClose(); }}>Salvar permissões</button></>}>
      <div className="col">
        <Field label="Papel" htmlFor="perm-role">
          <select id="perm-role" className="input" style={{ maxWidth: 320 }} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="integrante">Integrante (permissões padrão)</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </Field>
        {role === "integrante" ? (
          <p className="muted small">Integrantes visualizam e criam em todas as áreas, editam os próprios registros e não gerenciam integrantes, permissões, finanças ou documentos (criação).</p>
        ) : (
          <div className="table-wrap">
            <table className="table perm-matrix">
              <thead><tr><th>Área</th><th>Visualizar</th><th>Criar e editar os próprios</th><th>Gerenciar tudo</th></tr></thead>
              <tbody>
                {info.areas.map((a: Info) => (
                  <tr key={a.key}>
                    <td>{a.label}</td>
                    {["view", "create", "manage"].map((l) => {
                      const k = `${a.key}.${l}`;
                      return <td key={l}><input type="checkbox" checked={set.has(k)} aria-label={`${a.label}: ${l}`} onChange={(e) => toggle(k, e.target.checked)} /></td>;
                    })}
                  </tr>
                ))}
                {info.admin_permissions.map((a: Info) => (
                  <tr key={a.key}><td>{a.label}</td><td colSpan={3}><input type="checkbox" checked={set.has(a.key)} aria-label={a.label} onChange={(e) => toggle(a.key, e.target.checked)} /></td></tr>
                ))}
              </tbody>
            </table>
            <p className="tiny muted">Criar ou gerenciar uma área inclui automaticamente a permissão de visualizá-la.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PermissionsTab({ info, reload }: { info: Info; reload: () => void }) {
  const { can } = useApp();
  const [editing, setEditing] = useState<Info | null>(null);
  if (!can("permissions.manage")) {
    return (
      <section className="card card-pad col">
        <h3>Minhas permissões</h3>
        <div className="row wrap">{(info.family.my_permissions as string[]).map((p) => <span key={p} className="badge">{p}</span>)}</div>
        <p className="muted small">Somente quem gerencia permissões pode alterá-las.</p>
      </section>
    );
  }
  return (
    <section className="card">
      <div className="list">
        {info.members.map((m: Info) => (
          <div key={m.id} className="list-item">
            <Avatar name={m.full_name} color={m.color} />
            <div className="grow">
              <div className="title">{m.full_name}</div>
              <div className="tiny muted">{m.is_admin ? "Administrador: todas as permissões" : `${(m.permissions ?? []).length} permissões ativas`}</div>
            </div>
            <span className="badge">{ROLE_LABEL[m.role]}</span>
            {!m.is_admin && <button className="btn sm" onClick={() => setEditing(m)}><Icon name="Shield" size={15} /> Editar permissões</button>}
          </div>
        ))}
      </div>
      {editing && <PermEditor member={editing} info={info} reload={reload} onClose={() => setEditing(null)} />}
    </section>
  );
}

function AdminTab({ info, reload }: { info: Info; reload: () => void }) {
  const { perm, can, confirm } = useApp();
  const act = useFamilyActions(reload);
  const [to, setTo] = useState("");
  const isAdmin = info.family.admin_id === perm.user_id;
  const others = info.members.filter((m: Info) => m.id !== perm.user_id);
  const audit = useAsync(() => (can("members.manage") ? call<{ items: Info[] }>("audit.list", { family: true }) : Promise.resolve({ items: [] })), [info.family.id, info.members.length]);
  return (
    <div className="stack">
      {isAdmin && (
        <section className="card card-pad col">
          <h3 className="row"><Icon name="Crown" size={17} /> Transferir administração</h3>
          {others.length === 0 ? <p className="muted small">Não há outros integrantes para receber a administração.</p> : (
            <div className="row wrap">
              <select className="input" style={{ maxWidth: 300 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Novo administrador">
                <option value="">Escolha o novo administrador…</option>
                {others.map((m: Info) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <button className="btn" disabled={!to} onClick={async () => {
                const name = others.find((m: Info) => m.id === to)?.full_name;
                if (await confirm({ title: "Transferir administração?", message: <>{name} passará a administrar a família e você se tornará integrante.</>, confirmLabel: "Transferir" }))
                  act("family.transfer_admin", { user_id: to }, "Administração transferida.");
              }}>Transferir</button>
            </div>
          )}
        </section>
      )}
      <section className="card card-pad col">
        <h3 className="row"><Icon name="LogOut" size={17} /> Sair da família</h3>
        <p className="muted small">
          {isAdmin && others.length > 0 ? "Como administrador, transfira a administração antes de sair." :
            others.length === 0 ? "Você é o último integrante: ao sair, a família e todos os registros familiares serão excluídos." :
              "Seus itens pessoais compartilhados voltarão a ser privados. Registros familiares que você criou permanecem com a família."}
        </p>
        <button className="btn danger" style={{ alignSelf: "flex-start" }} disabled={isAdmin && others.length > 0} onClick={async () => {
          if (await confirm({ title: "Sair da família?", danger: true, confirmLabel: "Sair da família", message: others.length === 0 ? "A família e todos os registros familiares serão excluídos definitivamente." : "Você perderá o acesso ao ambiente FAMÍLIA até ser convidado novamente." }))
            act("family.leave", { confirm: true }, "Você saiu da família.");
        }}>Sair da família</button>
      </section>
      {can("members.manage") && (
        <section className="card">
          <div className="card-head"><h3 className="row"><Icon name="History" size={17} /> Registro de atividades da família</h3></div>
          {audit.loading ? <Loading /> : !audit.data?.items.length ? <p className="muted small card-body">Sem atividades.</p> : (
            <div className="list" style={{ maxHeight: 380, overflow: "auto" }}>
              {audit.data.items.map((a: Info, i: number) => (
                <div key={i} className="list-item small"><b>{a.user_name}</b> {actionLabel(a.action)}{a.entity ? <span className="muted"> · {a.entity}</span> : null}<span className="grow" /><span className="tiny muted">{fmtDateTime(a.created_at)}</span></div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function FamilyPage() {
  const { can, toast, perm } = useApp();
  const { data: info, loading, error, reload } = useAsync(() => call<Info>("family.info"), [perm.family_id, perm.family_role]);
  const [tab, setTab] = useState<"modulos" | "integrantes" | "permissoes" | "admin">("modulos");
  const [renaming, setRenaming] = useState<string | null>(null);
  const act = useFamilyActions(reload);

  if (loading && !info) return <Loading />;
  if (error || !info) return <ErrorState message={error ?? "Falha ao carregar."} onRetry={reload} />;
  const fam = info.family;
  const mods = modulesFor("family").filter((m) => can(`${m.area}.view`));
  const hidden = modulesFor("family").length - mods.length;

  return (
    <div>
      <div className="page-head">
        <div className="title-block">
          <div className="page-icon" style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}><Icon name="Users" size={22} /></div>
          <div>
            <h1 className="row">{fam ? fam.name : "Família"}
              {fam && can("members.manage") && <button className="btn icon sm ghost" aria-label="Renomear família" onClick={() => setRenaming(fam.name)}><Icon name="Pencil" size={15} /></button>}
            </h1>
            <p>{fam ? `${ROLE_LABEL[fam.my_role]} · ${info.members.length}/${info.max_members} integrantes` : "Organize a rotina da casa com quem mora com você."}</p>
          </div>
        </div>
        {fam && (
          <div className="col" style={{ alignItems: "flex-end", gap: 4 }}>
            <span className="tiny muted">FAMILY ID (identifica a família — não é senha nem USER ID)</span>
            <div className="row">
              <span className="id-chip" data-testid="family-id">{fam.id}</span>
              <button className="btn icon sm ghost" aria-label="Copiar FAMILY ID" onClick={() => navigator.clipboard?.writeText(fam.id).then(() => toast("FAMILY ID copiado.")).catch(() => {})}><Icon name="Copy" size={15} /></button>
            </div>
          </div>
        )}
      </div>
      {!fam ? <NoFamily info={info} reload={reload} /> : (
        <>
          <Tabs value={tab} onChange={setTab} tabs={[
            { key: "modulos", label: "Módulos", icon: "LayoutGrid" },
            { key: "integrantes", label: "Integrantes", icon: "Users" },
            { key: "permissoes", label: "Permissões", icon: "Shield" },
            { key: "admin", label: "Administração", icon: "Settings" },
          ]} />
          {tab === "modulos" && (
            <>
              {hidden > 0 && <div className="alert small" style={{ marginBottom: 14 }}><Icon name="Lock" size={16} /> {hidden} módulo(s) ocultos porque você não tem permissão para visualizá-los.</div>}
              {mods.length ? <ModuleGrid mods={mods} family /> : <EmptyState icon="Lock" title="Sem módulos disponíveis" text="Peça ao administrador para liberar permissões." />}
            </>
          )}
          {tab === "integrantes" && <MembersTab info={info} reload={reload} />}
          {tab === "permissoes" && <PermissionsTab info={info} reload={reload} />}
          {tab === "admin" && <AdminTab info={info} reload={reload} />}
        </>
      )}
      {renaming !== null && (
        <Modal size="sm" title="Renomear família" onClose={() => setRenaming(null)}
          footer={<><button className="btn" onClick={() => setRenaming(null)}>Cancelar</button><button className="btn primary" disabled={!renaming.trim()} onClick={async () => { if (await act("family.rename", { name: renaming.trim() }, "Nome atualizado.")) setRenaming(null); }}>Salvar</button></>}>
          <Field label="Nome da família" htmlFor="fam-rename"><input id="fam-rename" className="input" value={renaming} maxLength={80} onChange={(e) => setRenaming(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  );
}
