//! Ambiente FAMÍLIA: criação, integrantes, convites locais, solicitações de entrada,
//! papéis, permissões e transferência de administração.
//!
//! Regras: um perfil participa de no máximo uma família; limite de 6 integrantes;
//! conhecer o FAMILY ID não concede acesso — toda entrada exige convite com código
//! temporário ou aprovação de quem gerencia integrantes.

use crate::core::{audit, Ctx, MAX_FAMILY_MEMBERS};
use crate::entities::{set_shared, ENTITIES};
use crate::error::{ApiError, ApiResult};
use crate::perms;
use crate::util::{self, now};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};

const INVITE_HOURS: i64 = 72;

fn new_family_id() -> String {
    format!("FAM-{}-{}", util::random_code(4), util::random_code(4))
}

fn member_count(conn: &Connection, fid: &str) -> ApiResult<i64> {
    Ok(conn.query_row("SELECT COUNT(*) FROM family_members WHERE family_id = ?1", params![fid], |r| r.get(0))?)
}

fn expire_old(conn: &Connection) -> ApiResult<()> {
    conn.execute("UPDATE family_invitations SET status = 'expirado' WHERE status = 'pendente' AND expires_at IS NOT NULL AND expires_at < ?1", params![now()])?;
    Ok(())
}

pub fn info(conn: &Connection, ctx: &Ctx) -> ApiResult<Value> {
    expire_old(conn)?;
    // convites recebidos (pendentes) — visíveis mesmo sem família
    let mut st = conn.prepare(
        "SELECT i.id, i.family_id, f.name, u.full_name, i.created_at, i.expires_at FROM family_invitations i
         JOIN families f ON f.id = i.family_id JOIN users u ON u.id = i.created_by
         WHERE i.user_id = ?1 AND i.kind = 'convite' AND i.status = 'pendente' ORDER BY i.created_at DESC",
    )?;
    let received: Vec<Value> = st
        .query_map(params![ctx.uid], |r| Ok(json!({"id": r.get::<_, String>(0)?, "family_id": r.get::<_, String>(1)?, "family_name": r.get::<_, String>(2)?,
            "invited_by": r.get::<_, String>(3)?, "created_at": r.get::<_, String>(4)?, "expires_at": r.get::<_, Option<String>>(5)?})))?
        .collect::<Result<_, _>>()?;
    let mut st = conn.prepare(
        "SELECT i.id, i.family_id, i.status, i.created_at FROM family_invitations i WHERE i.user_id = ?1 AND i.kind = 'solicitacao' AND i.status = 'pendente'",
    )?;
    let my_requests: Vec<Value> = st
        .query_map(params![ctx.uid], |r| Ok(json!({"id": r.get::<_, String>(0)?, "family_id": r.get::<_, String>(1)?, "status": r.get::<_, String>(2)?, "created_at": r.get::<_, String>(3)?})))?
        .collect::<Result<_, _>>()?;

    let Some(fam) = &ctx.family else {
        return Ok(json!({ "family": null, "received_invitations": received, "my_requests": my_requests, "max_members": MAX_FAMILY_MEMBERS }));
    };
    let (name, created_at): (String, String) = conn.query_row("SELECT name, created_at FROM families WHERE id = ?1", params![fam.id], |r| Ok((r.get(0)?, r.get(1)?)))?;
    let mut st = conn.prepare(
        "SELECT u.id, u.full_name, u.username, u.color, m.role, m.joined_at FROM family_members m JOIN users u ON u.id = m.user_id
         WHERE m.family_id = ?1 ORDER BY m.joined_at",
    )?;
    let raw: Vec<(String, String, String, Option<String>, String, String)> =
        st.query_map(params![fam.id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))?.collect::<Result<_, _>>()?;
    let can_perms = ctx.can("permissions.manage");
    let mut members = Vec::new();
    for (id, fname, uname, color, role, joined) in raw {
        let mut m = json!({"id": id, "full_name": fname, "username": uname, "color": color, "role": role, "joined_at": joined, "is_admin": id == fam.admin_id});
        if can_perms || id == ctx.uid {
            let c = crate::core::load_ctx(conn, &id)?;
            let set: Vec<String> = c.family.map(|f| { let mut v: Vec<String> = f.perms.into_iter().collect(); v.sort(); v }).unwrap_or_default();
            m["permissions"] = json!(set);
        }
        members.push(m);
    }
    let mut invitations = Vec::new();
    let mut requests = Vec::new();
    if ctx.can("members.manage") {
        let mut st = conn.prepare(
            "SELECT i.id, i.kind, u.full_name, u.username, i.code, i.status, i.created_at, i.expires_at FROM family_invitations i
             JOIN users u ON u.id = i.user_id WHERE i.family_id = ?1 AND i.status = 'pendente' ORDER BY i.created_at DESC",
        )?;
        let rows: Vec<(String, String, String, String, Option<String>, String, String, Option<String>)> = st
            .query_map(params![fam.id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?, r.get(7)?)))?
            .collect::<Result<_, _>>()?;
        for (id, kind, fname, uname, code, status, created, exp) in rows {
            let v = json!({"id": id, "user_name": fname, "username": uname, "code": code, "status": status, "created_at": created, "expires_at": exp});
            if kind == "convite" { invitations.push(v) } else { requests.push(v) }
        }
    }
    // perfis locais disponíveis para convite (sem família)
    let mut available = Vec::new();
    if ctx.can("members.manage") {
        let mut st = conn.prepare("SELECT id, full_name, username FROM users WHERE id NOT IN (SELECT user_id FROM family_members) ORDER BY full_name")?;
        available = st.query_map([], |r| Ok(json!({"id": r.get::<_, String>(0)?, "full_name": r.get::<_, String>(1)?, "username": r.get::<_, String>(2)?})))?.collect::<Result<_, _>>()?;
    }
    let areas: Vec<Value> = perms::AREAS.iter().map(|a| json!({"key": a.key, "label": a.label})).collect();
    let admin_perms: Vec<Value> = perms::ADMIN_PERMS.iter().map(|(k, l)| json!({"key": k, "label": l})).collect();
    let mut mine: Vec<&String> = fam.perms.iter().collect();
    mine.sort();
    Ok(json!({
        "family": {"id": fam.id, "name": name, "created_at": created_at, "admin_id": fam.admin_id, "my_role": fam.role, "my_permissions": mine},
        "members": members, "invitations": invitations, "requests": requests, "available_profiles": available,
        "received_invitations": received, "my_requests": my_requests, "max_members": MAX_FAMILY_MEMBERS,
        "areas": areas, "admin_permissions": admin_perms,
    }))
}

pub fn create(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    if ctx.family.is_some() {
        return Err(ApiError::conflict("Você já participa de uma família. Saia dela antes de criar outra."));
    }
    let name = util::require_text("name", "Nome da família", util::arg_str(args, "name").unwrap_or(""), 80)?;
    let fid = new_family_id();
    let ts = now();
    crate::db::tx(conn, |conn| {
        conn.execute("INSERT INTO families (id, name, admin_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)", params![fid, name, ctx.uid, ts])?;
        conn.execute("INSERT INTO family_members (family_id, user_id, role, joined_at) VALUES (?1, ?2, 'admin', ?3)", params![fid, ctx.uid, ts])?;
        // solicitações antigas do usuário deixam de valer
        conn.execute("UPDATE family_invitations SET status = 'cancelado' WHERE user_id = ?1 AND status = 'pendente'", params![ctx.uid])?;
        audit(conn, Some(&ctx.uid), Some(&fid), "criar_familia", Some("families"), Some(&fid), None);
        Ok(())
    })?;
    let ctx2 = crate::core::load_ctx(conn, &ctx.uid)?;
    info(conn, &ctx2)
}

pub fn rename(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    ctx.require("members.manage")?;
    let fid = ctx.family_id().unwrap();
    let name = util::require_text("name", "Nome da família", util::arg_str(args, "name").unwrap_or(""), 80)?;
    conn.execute("UPDATE families SET name = ?1, updated_at = ?2 WHERE id = ?3", params![name, now(), fid])?;
    audit(conn, Some(&ctx.uid), Some(fid), "renomear_familia", Some("families"), Some(fid), None);
    info(conn, ctx)
}

/// Convida um perfil local. Gera um código temporário que o convidado digita para aceitar.
pub fn invite(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    ctx.require("members.manage")?;
    let fid = ctx.family_id().unwrap().to_string();
    let target = util::arg_str(args, "user_id")?;
    let exists: Option<String> = conn.query_row("SELECT id FROM users WHERE id = ?1", params![target], |r| r.get(0)).optional()?;
    if exists.is_none() {
        return Err(ApiError::not_found("Perfil não encontrado nesta instalação."));
    }
    let in_family: Option<String> = conn.query_row("SELECT family_id FROM family_members WHERE user_id = ?1", params![target], |r| r.get(0)).optional()?;
    if in_family.is_some() {
        return Err(ApiError::conflict("Este perfil já participa de uma família."));
    }
    let pending: i64 = conn.query_row("SELECT COUNT(*) FROM family_invitations WHERE family_id = ?1 AND status = 'pendente' AND kind = 'convite'", params![fid], |r| r.get(0))?;
    if member_count(conn, &fid)? + pending >= MAX_FAMILY_MEMBERS {
        return Err(ApiError::conflict(format!("A família atingiu o limite de {MAX_FAMILY_MEMBERS} integrantes (incluindo convites pendentes).")));
    }
    conn.execute("UPDATE family_invitations SET status = 'cancelado' WHERE family_id = ?1 AND user_id = ?2 AND status = 'pendente'", params![fid, target])?;
    let code = format!("{}-{}", util::random_code(4), util::random_code(4));
    let id = util::new_id();
    let exp = (util::now_naive() + chrono::Duration::hours(INVITE_HOURS)).format("%Y-%m-%dT%H:%M:%S").to_string();
    conn.execute(
        "INSERT INTO family_invitations (id, family_id, kind, user_id, created_by, code, status, created_at, expires_at) VALUES (?1, ?2, 'convite', ?3, ?4, ?5, 'pendente', ?6, ?7)",
        params![id, fid, target, ctx.uid, code, now(), exp],
    )?;
    audit(conn, Some(&ctx.uid), Some(&fid), "convidar", Some("family_invitations"), Some(&id), Some(json!({"user_id": target})));
    Ok(json!({ "id": id, "code": code, "expires_at": exp }))
}

pub fn cancel_invite(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    ctx.require("members.manage")?;
    let id = util::arg_str(args, "id")?;
    let n = conn.execute("UPDATE family_invitations SET status = 'cancelado', responded_at = ?1 WHERE id = ?2 AND family_id = ?3 AND status = 'pendente'",
        params![now(), id, ctx.family_id().unwrap()])?;
    if n == 0 {
        return Err(ApiError::not_found("Convite não encontrado ou já respondido."));
    }
    audit(conn, Some(&ctx.uid), ctx.family_id(), "cancelar_convite", Some("family_invitations"), Some(id), None);
    info(conn, ctx)
}

fn add_member(conn: &Connection, fid: &str, uid: &str) -> ApiResult<()> {
    if member_count(conn, fid)? >= MAX_FAMILY_MEMBERS {
        return Err(ApiError::conflict(format!("A família atingiu o limite de {MAX_FAMILY_MEMBERS} integrantes.")));
    }
    conn.execute("INSERT INTO family_members (family_id, user_id, role, joined_at) VALUES (?1, ?2, 'integrante', ?3)", params![fid, uid, now()])?;
    conn.execute("UPDATE family_invitations SET status = 'cancelado' WHERE user_id = ?1 AND status = 'pendente'", params![uid])?;
    Ok(())
}

/// O convidado aceita digitando o código temporário recebido.
pub fn accept_invite(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    if ctx.family.is_some() {
        return Err(ApiError::conflict("Você já participa de uma família."));
    }
    expire_old(conn)?;
    let code = util::arg_str(args, "code")?.trim().to_uppercase();
    let row: Option<(String, String)> = conn
        .query_row("SELECT id, family_id FROM family_invitations WHERE code = ?1 AND user_id = ?2 AND kind = 'convite' AND status = 'pendente'",
            params![code, ctx.uid], |r| Ok((r.get(0)?, r.get(1)?)))
        .optional()?;
    let Some((iid, fid)) = row else {
        return Err(ApiError::validation("code", "Código de convite inválido, expirado ou destinado a outro perfil."));
    };
    crate::db::tx(conn, |conn| {
        add_member(conn, &fid, &ctx.uid)?;
        conn.execute("UPDATE family_invitations SET status = 'aceito', responded_at = ?1 WHERE id = ?2", params![now(), iid])?;
        audit(conn, Some(&ctx.uid), Some(&fid), "aceitar_convite", Some("family_invitations"), Some(&iid), None);
        Ok(())
    })?;
    let ctx2 = crate::core::load_ctx(conn, &ctx.uid)?;
    info(conn, &ctx2)
}

pub fn decline_invite(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "id")?;
    let n = conn.execute("UPDATE family_invitations SET status = 'recusado', responded_at = ?1 WHERE id = ?2 AND user_id = ?3 AND kind = 'convite' AND status = 'pendente'",
        params![now(), id, ctx.uid])?;
    if n == 0 {
        return Err(ApiError::not_found("Convite não encontrado."));
    }
    audit(conn, Some(&ctx.uid), None, "recusar_convite", Some("family_invitations"), Some(id), None);
    info(conn, ctx)
}

/// Solicita entrada informando o FAMILY ID. Conhecer o ID não dá acesso: o pedido
/// precisa ser aprovado por quem gerencia integrantes.
pub fn request_join(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    if ctx.family.is_some() {
        return Err(ApiError::conflict("Você já participa de uma família."));
    }
    let fid = util::arg_str(args, "family_id")?.trim().to_uppercase();
    let exists: Option<String> = conn.query_row("SELECT id FROM families WHERE id = ?1", params![fid], |r| r.get(0)).optional()?;
    if exists.is_none() {
        return Err(ApiError::validation("family_id", "Nenhuma família com este FAMILY ID nesta instalação."));
    }
    conn.execute("UPDATE family_invitations SET status = 'cancelado' WHERE user_id = ?1 AND kind = 'solicitacao' AND status = 'pendente'", params![ctx.uid])?;
    let id = util::new_id();
    conn.execute(
        "INSERT INTO family_invitations (id, family_id, kind, user_id, created_by, status, created_at) VALUES (?1, ?2, 'solicitacao', ?3, ?3, 'pendente', ?4)",
        params![id, fid, ctx.uid, now()],
    )?;
    audit(conn, Some(&ctx.uid), Some(&fid), "solicitar_entrada", Some("family_invitations"), Some(&id), None);
    info(conn, ctx)
}

pub fn respond_request(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    ctx.require("members.manage")?;
    let fid = ctx.family_id().unwrap().to_string();
    let id = util::arg_str(args, "id")?;
    let approve = util::arg_bool(args, "approve");
    let row: Option<String> = conn
        .query_row("SELECT user_id FROM family_invitations WHERE id = ?1 AND family_id = ?2 AND kind = 'solicitacao' AND status = 'pendente'", params![id, fid], |r| r.get(0))
        .optional()?;
    let Some(uid) = row else { return Err(ApiError::not_found("Solicitação não encontrada.")) };
    crate::db::tx(conn, |conn| {
        if approve {
            let in_family: Option<String> = conn.query_row("SELECT family_id FROM family_members WHERE user_id = ?1", params![uid], |r| r.get(0)).optional()?;
            if in_family.is_some() {
                return Err(ApiError::conflict("Este perfil já participa de uma família."));
            }
            add_member(conn, &fid, &uid)?;
        }
        conn.execute("UPDATE family_invitations SET status = ?1, responded_at = ?2 WHERE id = ?3", params![if approve { "aceito" } else { "recusado" }, now(), id])?;
        audit(conn, Some(&ctx.uid), Some(&fid), if approve { "aprovar_entrada" } else { "recusar_entrada" }, Some("family_invitations"), Some(id), Some(json!({"user_id": uid})));
        Ok(())
    })?;
    info(conn, ctx)
}

pub fn cancel_my_request(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let id = util::arg_str(args, "id")?;
    conn.execute("UPDATE family_invitations SET status = 'cancelado' WHERE id = ?1 AND user_id = ?2 AND kind = 'solicitacao' AND status = 'pendente'", params![id, ctx.uid])?;
    info(conn, ctx)
}

/// Remove um integrante da família, desfazendo compartilhamentos pessoais dele.
pub(crate) fn detach_member(conn: &Connection, fid: &str, uid: &str, admin_id: &str) -> ApiResult<()> {
    for d in ENTITIES.iter().filter(|d| d.shareable) {
        let ids: Vec<String> = {
            let mut st = conn.prepare(&format!("SELECT id FROM {} WHERE owner_id = ?1 AND scope = 'personal' AND shared = 1 AND family_id = ?2", d.table))?;
            let v: Vec<String> = st.query_map(params![uid, fid], |r| r.get(0))?.collect::<Result<_, _>>()?;
            v
        };
        for id in ids {
            set_shared(conn, d, &id, None, 0)?;
        }
    }
    // Registros familiares criados pelo integrante permanecem na família, sob o administrador.
    let mut tables: Vec<&str> = ENTITIES.iter().map(|d| d.table).collect();
    tables.sort();
    tables.dedup();
    for t in tables {
        if uid != admin_id {
            conn.execute(&format!("UPDATE {t} SET owner_id = ?1 WHERE scope = 'family' AND family_id = ?2 AND owner_id = ?3"), params![admin_id, fid, uid])?;
        }
        let has_assignee = ENTITIES.iter().any(|d| d.table == t && d.fields.iter().any(|f| f.col == "assignee_id"));
        if has_assignee {
            conn.execute(&format!("UPDATE {t} SET assignee_id = NULL WHERE family_id = ?1 AND assignee_id = ?2"), params![fid, uid])?;
        }
    }
    conn.execute("DELETE FROM permissions WHERE family_id = ?1 AND user_id = ?2", params![fid, uid])?;
    conn.execute("DELETE FROM family_members WHERE family_id = ?1 AND user_id = ?2", params![fid, uid])?;
    Ok(())
}

pub fn remove_member(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    ctx.require("members.manage")?;
    let fam = ctx.family.as_ref().unwrap();
    let target = util::arg_str(args, "user_id")?;
    if target == fam.admin_id {
        return Err(ApiError::forbidden("O administrador não pode ser removido. Transfira a administração primeiro."));
    }
    if target == ctx.uid {
        return Err(ApiError::bad_request("Para sair da família, use a opção \"Sair da família\"."));
    }
    let is_member: Option<String> = conn.query_row("SELECT user_id FROM family_members WHERE family_id = ?1 AND user_id = ?2", params![fam.id, target], |r| r.get(0)).optional()?;
    if is_member.is_none() {
        return Err(ApiError::not_found("Integrante não encontrado."));
    }
    crate::db::tx(conn, |conn| {
        detach_member(conn, &fam.id, target, &fam.admin_id)?;
        audit(conn, Some(&ctx.uid), Some(&fam.id), "remover_integrante", Some("family_members"), Some(target), None);
        Ok(())
    })?;
    info(conn, ctx)
}

pub(crate) fn leave_inner(conn: &Connection, ctx: &Ctx, fid: &str, deleting_profile: bool) -> ApiResult<()> {
    let fam = ctx.family.as_ref().unwrap();
    let members = member_count(conn, fid)?;
    if fam.role == "admin" && members > 1 {
        return Err(ApiError::conflict("Transfira a administração para outro integrante antes de sair."));
    }
    if members <= 1 {
        // último integrante: a família e seus registros familiares são excluídos
        for d in ENTITIES.iter().filter(|d| d.shareable) {
            conn.execute(&format!("UPDATE {} SET family_id = NULL, shared = 0 WHERE scope = 'personal' AND family_id = ?1", d.table), params![fid])?;
        }
        conn.execute("DELETE FROM attachments WHERE record_id IN (SELECT id FROM family_records WHERE family_id = ?1)", params![fid])?;
        let mut tables: Vec<&str> = ENTITIES.iter().map(|d| d.table).collect();
        tables.sort();
        tables.dedup();
        // remove filhos antes dos pais por causa das chaves estrangeiras
        for t in ["subtasks", "project_steps", "goal_milestones", "shopping_items"] {
            conn.execute(&format!("DELETE FROM {t} WHERE scope = 'family' AND family_id = ?1"), params![fid])?;
        }
        for t in tables {
            conn.execute(&format!("DELETE FROM {t} WHERE scope = 'family' AND family_id = ?1"), params![fid])?;
        }
        conn.execute("DELETE FROM families WHERE id = ?1", params![fid])?;
        audit(conn, Some(&ctx.uid), Some(fid), "excluir_familia", Some("families"), Some(fid), None);
    } else {
        detach_member(conn, fid, &ctx.uid, &fam.admin_id)?;
        audit(conn, Some(&ctx.uid), Some(fid), if deleting_profile { "perfil_excluido" } else { "sair_familia" }, Some("family_members"), Some(&ctx.uid), None);
    }
    Ok(())
}

pub fn leave(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let fam = ctx.require_family()?.clone();
    if !util::arg_bool(args, "confirm") {
        return Err(ApiError::bad_request("Confirme a saída da família."));
    }
    crate::db::tx(conn, |conn| leave_inner(conn, ctx, &fam.id, false))?;
    let ctx2 = crate::core::load_ctx(conn, &ctx.uid)?;
    info(conn, &ctx2)
}

pub fn transfer_admin(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let fam = ctx.require_family()?.clone();
    if fam.admin_id != ctx.uid {
        return Err(ApiError::forbidden("Somente o administrador pode transferir a administração."));
    }
    let target = util::arg_str(args, "user_id")?;
    let is_member: Option<String> = conn.query_row("SELECT user_id FROM family_members WHERE family_id = ?1 AND user_id = ?2", params![fam.id, target], |r| r.get(0)).optional()?;
    if is_member.is_none() || target == ctx.uid {
        return Err(ApiError::bad_request("Escolha outro integrante da família."));
    }
    crate::db::tx(conn, |conn| {
        conn.execute("UPDATE families SET admin_id = ?1, updated_at = ?2 WHERE id = ?3", params![target, now(), fam.id])?;
        conn.execute("UPDATE family_members SET role = 'admin' WHERE family_id = ?1 AND user_id = ?2", params![fam.id, target])?;
        conn.execute("UPDATE family_members SET role = 'integrante' WHERE family_id = ?1 AND user_id = ?2", params![fam.id, ctx.uid])?;
        conn.execute("DELETE FROM permissions WHERE family_id = ?1 AND user_id = ?2", params![fam.id, target])?;
        audit(conn, Some(&ctx.uid), Some(&fam.id), "transferir_administracao", Some("families"), Some(&fam.id), Some(json!({"novo_admin": target})));
        Ok(())
    })?;
    let ctx2 = crate::core::load_ctx(conn, &ctx.uid)?;
    info(conn, &ctx2)
}

/// Define papel e permissões de um integrante (papel "personalizado" usa as permissões enviadas).
pub fn set_permissions(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    ctx.require("permissions.manage")?;
    let fam = ctx.family.as_ref().unwrap();
    let target = util::arg_str(args, "user_id")?;
    if target == fam.admin_id {
        return Err(ApiError::bad_request("O administrador possui todas as permissões."));
    }
    let role = util::arg_str(args, "role")?;
    if !matches!(role, "integrante" | "personalizado") {
        return Err(ApiError::validation("role", "Papel inválido."));
    }
    let is_member: Option<String> = conn.query_row("SELECT user_id FROM family_members WHERE family_id = ?1 AND user_id = ?2", params![fam.id, target], |r| r.get(0)).optional()?;
    if is_member.is_none() {
        return Err(ApiError::not_found("Integrante não encontrado."));
    }
    crate::db::tx(conn, |conn| {
        conn.execute("UPDATE family_members SET role = ?1 WHERE family_id = ?2 AND user_id = ?3", params![role, fam.id, target])?;
        conn.execute("DELETE FROM permissions WHERE family_id = ?1 AND user_id = ?2", params![fam.id, target])?;
        if role == "personalizado" {
            let list = args.get("permissions").and_then(|v| v.as_array()).ok_or_else(|| ApiError::validation("permissions", "Informe as permissões."))?;
            let allowed: Vec<&str> = list.iter().filter_map(|v| v.as_str()).collect();
            for k in &allowed {
                if !perms::is_valid_key(k) {
                    return Err(ApiError::validation("permissions", format!("Permissão desconhecida: {k}")));
                }
            }
            for k in perms::all_keys() {
                let mut a = allowed.contains(&k.as_str());
                // coerência: criar/gerenciar implicam visualizar
                if k.ends_with(".view") {
                    let base = k.trim_end_matches(".view");
                    a = a || allowed.contains(&format!("{base}.create").as_str()) || allowed.contains(&format!("{base}.manage").as_str());
                }
                conn.execute("INSERT INTO permissions (family_id, user_id, perm_key, allowed) VALUES (?1, ?2, ?3, ?4)", params![fam.id, target, k, a as i64])?;
            }
        }
        audit(conn, Some(&ctx.uid), Some(&fam.id), "alterar_permissoes", Some("family_members"), Some(target), Some(json!({"papel": role})));
        Ok(())
    })?;
    info(conn, ctx)
}

pub fn members_basic(conn: &Connection, ctx: &Ctx) -> ApiResult<Vec<Value>> {
    let Some(fid) = ctx.family_id() else { return Ok(vec![]) };
    let mut st = conn.prepare("SELECT u.id, u.full_name, u.color FROM family_members m JOIN users u ON u.id = m.user_id WHERE m.family_id = ?1 ORDER BY m.joined_at")?;
    let v = st.query_map(params![fid], |r| Ok(json!({"id": r.get::<_, String>(0)?, "full_name": r.get::<_, String>(1)?, "color": r.get::<_, Option<String>>(2)?})))?.collect::<Result<_, _>>()?;
    Ok(v)
}

pub fn audit_list(conn: &Connection, ctx: &Ctx, args: &Value) -> ApiResult<Value> {
    let family = util::arg_bool(args, "family");
    let (sql, key) = if family {
        ctx.require("members.manage")?;
        ("SELECT a.action, a.entity, a.record_id, a.details, a.created_at, COALESCE(u.full_name,'—') FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.family_id = ?1 ORDER BY a.created_at DESC LIMIT 300", ctx.family_id().unwrap().to_string())
    } else {
        ("SELECT a.action, a.entity, a.record_id, a.details, a.created_at, COALESCE(u.full_name,'—') FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
          WHERE a.user_id = ?1 ORDER BY a.created_at DESC LIMIT 300", ctx.uid.clone())
    };
    let mut st = conn.prepare(sql)?;
    let items: Vec<Value> = st
        .query_map(params![key], |r| Ok(json!({"action": r.get::<_, String>(0)?, "entity": r.get::<_, Option<String>>(1)?, "record_id": r.get::<_, Option<String>>(2)?,
            "details": r.get::<_, Option<String>>(3)?.and_then(|s| serde_json::from_str::<Value>(&s).ok()), "created_at": r.get::<_, String>(4)?, "user_name": r.get::<_, String>(5)?})))?
        .collect::<Result<_, _>>()?;
    Ok(json!({ "items": items }))
}
