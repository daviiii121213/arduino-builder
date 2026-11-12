//! PERSONAL LIFE ULTRA — núcleo local.
//!
//! Toda a lógica de negócio, persistência (SQLite), autorização, backup e
//! relatórios fica neste crate, sem dependência de interface gráfica. O
//! aplicativo Tauri e o servidor de desenvolvimento apenas encaminham chamadas
//! para [`Core::call`].

pub mod attachments;
pub mod auth;
pub mod automation;
pub mod backup;
pub mod calendar;
pub mod core;
pub mod dashboard;
pub mod db;
pub mod decorate;
pub mod entities;
pub mod error;
pub mod family;
pub mod finance;
pub mod hooks;
pub mod logger;
pub mod logs;
pub mod notify;
pub mod onboarding;
pub mod pdf;
pub mod perms;
pub mod reports;
pub mod search;
pub mod settings;
pub mod util;

pub use crate::core::Core;
pub use crate::error::{ApiError, ApiResult};

use serde_json::{json, Value};

impl Core {
    /// Ponto único de entrada da API. `cmd` identifica a operação; `args` são os parâmetros em JSON.
    pub fn call(&self, cmd: &str, args: Value) -> ApiResult<Value> {
        let res = self.call_inner(cmd, &args);
        if let Err(e) = &res {
            if e.code == "internal" {
                logger::error(&format!("comando {cmd} falhou: {}", e.message));
            }
        }
        res
    }

    fn call_inner(&self, cmd: &str, args: &Value) -> ApiResult<Value> {
        let mut guard = self.conn.lock().unwrap_or_else(|p| p.into_inner());
        let conn = &mut *guard;

        // ---- comandos que não exigem sessão ----
        match cmd {
            "app.status" => {
                let users: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |r| r.get(0))?;
                let session = self.session.lock().unwrap().as_ref().map(|s| (s.user_id.clone(), s.locked));
                return Ok(json!({
                    "version": core::APP_VERSION, "schema_version": db::current_version(conn)?, "users": users,
                    "max_profiles": core::MAX_PROFILES, "data_dir": self.data_dir.to_string_lossy(),
                    "session": session.as_ref().map(|(u, l)| json!({"user_id": u, "locked": l})),
                    "user": match &session { Some((u, false)) => auth::public_user(self, conn, u).ok(), _ => None },
                }));
            }
            "auth.profiles" => return auth::list_profiles(self, conn),
            "auth.register" => return auth::register(self, conn, args),
            "auth.login" => return auth::login(self, conn, args),
            "auth.logout" => return auth::logout(self, conn),
            "auth.unlock" => return auth::unlock(self, conn, args),
            "auth.lock" => return auth::lock(self),
            _ => {}
        }

        let uid = self.require_user()?;
        let ctx = core::load_ctx(conn, &uid)?;
        match cmd {
            // perfil
            "auth.me" => auth::public_user(self, conn, &uid),
            "auth.verify" => auth::verify(conn, &uid, args),
            "auth.change_password" => auth::change_password(conn, &uid, args),
            "auth.update_profile" => auth::update_profile(self, conn, &uid, args),
            "auth.delete_profile" => auth::delete_profile(self, conn, &uid, args),
            "auth.context" => Ok(json!({
                "user_id": ctx.uid, "family_id": ctx.family_id(),
                "family_role": ctx.family.as_ref().map(|f| f.role.clone()),
                "permissions": ctx.family.as_ref().map(|f| { let mut v: Vec<&String> = f.perms.iter().collect(); v.sort(); v }),
                "installation_admin": settings::installation_admin(conn)?.as_deref() == Some(uid.as_str()),
            })),
            // configurações
            "settings.get" => settings::get_all(conn, &uid),
            "settings.set" => settings::set(conn, &ctx, args),
            "settings.reset" => settings::reset(conn, &ctx),
            // família
            "family.info" => family::info(conn, &ctx),
            "family.create" => family::create(conn, &ctx, args),
            "family.rename" => family::rename(conn, &ctx, args),
            "family.invite" => family::invite(conn, &ctx, args),
            "family.cancel_invite" => family::cancel_invite(conn, &ctx, args),
            "family.accept_invite" => family::accept_invite(conn, &ctx, args),
            "family.decline_invite" => family::decline_invite(conn, &ctx, args),
            "family.request_join" => family::request_join(conn, &ctx, args),
            "family.cancel_request" => family::cancel_my_request(conn, &ctx, args),
            "family.respond_request" => family::respond_request(conn, &ctx, args),
            "family.remove_member" => family::remove_member(conn, &ctx, args),
            "family.leave" => family::leave(conn, &ctx, args),
            "family.transfer_admin" => family::transfer_admin(conn, &ctx, args),
            "family.set_permissions" => family::set_permissions(conn, &ctx, args),
            "family.members" => Ok(json!({ "items": family::members_basic(conn, &ctx)? })),
            "audit.list" => family::audit_list(conn, &ctx, args),
            // registros
            "schema" => Ok(entities::schema()),
            "rec.list" => entities::list(conn, &ctx, args),
            "rec.get" => entities::get(conn, &ctx, util::arg_str(args, "entity")?, util::arg_str(args, "id")?),
            "rec.create" => entities::create(conn, &ctx, args),
            "rec.update" => entities::update(conn, &ctx, args),
            "rec.delete" => entities::delete(conn, &ctx, args),
            "rec.restore" => entities::restore(conn, &ctx, args),
            "rec.purge" => entities::purge(&self.data_dir, conn, &ctx, args),
            "rec.trash" => entities::trash(conn, &ctx),
            "rec.share" => entities::share(conn, &ctx, args, true),
            "rec.unshare" => entities::share(conn, &ctx, args, false),
            "rec.history" => entities::history(conn, &ctx, args),
            // registros cronológicos e ações específicas
            "habit.toggle" => logs::habit_toggle(conn, &ctx, args),
            "routine.toggle_step" => logs::routine_step_toggle(conn, &ctx, args),
            "poll.vote" => logs::poll_vote(conn, &ctx, args),
            "log.list" => logs::list(conn, &ctx, args),
            "log.add" => logs::add(conn, &ctx, args),
            "log.delete" => logs::delete(conn, &ctx, args),
            "menu.ingredients" => logs::menu_ingredients(conn, &ctx, args),
            "calendar.range" => calendar::range(conn, &ctx, args),
            "finance.summary" => finance::summary(conn, &ctx, args),
            // anexos
            "attach.add" => attachments::add(self, conn, &ctx, args),
            "attach.list" => attachments::list(conn, &ctx, args),
            "attach.data_url" => attachments::data_url(self, conn, &ctx, args),
            "attach.path" => Ok(json!({ "path": attachments::path_for(self, conn, &ctx, util::arg_str(args, "id")?)?.to_string_lossy() })),
            "attach.export" => attachments::export(self, conn, &ctx, args),
            "attach.delete" => attachments::delete(self, conn, &ctx, args),
            // painel
            "dashboard.get" => dashboard::get(conn, &ctx, args),
            "dashboard.save" => dashboard::save(conn, &ctx, args),
            "dashboard.reset" => dashboard::reset(conn, &ctx, args),
            "dashboard.data" => dashboard::data(conn, &ctx, args),
            // pesquisa
            "search.query" => search::query(conn, &ctx, args),
            "search.history" => search::history(conn, &ctx),
            "search.clear_history" => search::clear_history(conn, &ctx),
            // notificações
            "notif.list" => notify::list(conn, &ctx, args),
            "notif.read" => notify::mark_read(conn, &ctx, args),
            "notif.clear" => notify::clear(conn, &ctx),
            "notif.scan" => {
                notify::scan(conn, &ctx)?;
                notify::list(conn, &ctx, &json!({}))
            }
            // automações
            "auto.list" => automation::list(conn, &ctx),
            "auto.update" => automation::update(conn, &ctx, args),
            "auto.logs" => automation::logs(conn, &ctx),
            // relatórios
            "report.catalog" => Ok(reports::catalog()),
            "report.preview" => reports::preview(conn, &ctx, args),
            "report.export" => reports::export(conn, &ctx, args, &self.data_dir.join("exports")),
            // backup
            "backup.status" => backup::status(self, conn, &ctx),
            "backup.configure" => backup::configure(self, conn, &ctx, args),
            "backup.create" => backup::create(self, conn, &ctx, args),
            "backup.verify" => backup::verify(conn, &ctx, args),
            "backup.restore" => backup::restore(self, conn, &ctx, args),
            "backup.export_my_data" => backup::export_my_data(self, conn, &ctx, args),
            // manual inicial
            "onboarding.get" => onboarding::get(conn, &ctx),
            "onboarding.save" => onboarding::save(conn, &ctx, args),
            "onboarding.restart" => onboarding::restart(conn, &ctx),
            _ => Err(ApiError::bad_request(format!("Comando desconhecido: {cmd}"))),
        }
    }

    /// Tarefa periódica (a cada ~60 s): lembretes, automações, bloqueio por inatividade e backup automático.
    /// Retorna notificações a serem exibidas pelo sistema operacional.
    pub fn tick(&self) -> Vec<Value> {
        let guard = self.conn.lock().unwrap_or_else(|p| p.into_inner());
        let conn = &*guard;
        if let Err(e) = backup::auto_tick(self, conn) {
            logger::warn(&format!("backup automático falhou: {}", e.message));
        }
        let (uid, locked, idle) = match self.session.lock().unwrap().as_ref() {
            Some(s) => (s.user_id.clone(), s.locked, s.last_activity.elapsed().as_secs()),
            None => return vec![],
        };
        // bloqueio automático por inatividade
        if !locked {
            if let Ok(m) = settings::get_one(conn, &uid, "auto_lock_minutes") {
                let m = m.as_i64().unwrap_or(0);
                if m > 0 && idle >= (m as u64) * 60 {
                    if let Some(s) = self.session.lock().unwrap().as_mut() {
                        s.locked = true;
                    }
                }
            }
        }
        let Ok(ctx) = core::load_ctx(conn, &uid) else { return vec![] };
        if let Err(e) = notify::scan(conn, &ctx) {
            logger::warn(&format!("verificação de lembretes falhou: {}", e.message));
        }
        notify::take_for_os(conn, &uid).unwrap_or_default()
    }
}
