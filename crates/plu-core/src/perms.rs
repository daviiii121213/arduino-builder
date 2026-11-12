//! Permissões do ambiente FAMÍLIA.
//!
//! Cada módulo familiar pertence a uma "área". Para cada área existem três níveis:
//! `view` (visualizar), `create` (criar e editar os próprios registros) e
//! `manage` (editar/excluir registros de qualquer integrante).
//! Há também permissões administrativas: `members.manage` e `permissions.manage`.

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct Area {
    pub key: &'static str,
    pub label: &'static str,
}

pub const AREAS: &[Area] = &[
    Area { key: "agenda", label: "Agenda e calendário" },
    Area { key: "tasks", label: "Tarefas e responsabilidades" },
    Area { key: "finance", label: "Finanças e contas" },
    Area { key: "shopping", label: "Compras" },
    Area { key: "home", label: "Casa (despensa, inventário, cardápio, receitas, manutenção)" },
    Area { key: "documents", label: "Documentos" },
    Area { key: "social", label: "Mural, mensagens e votações" },
    Area { key: "memories", label: "Eventos, aniversários, álbum, memórias e árvore" },
    Area { key: "goals", label: "Metas e viagens" },
    Area { key: "reports", label: "Relatórios" },
];

pub const ADMIN_PERMS: &[(&str, &str)] = &[
    ("members.manage", "Gerenciar integrantes e convites"),
    ("permissions.manage", "Gerenciar permissões"),
];

pub fn all_keys() -> Vec<String> {
    let mut v = Vec::new();
    for a in AREAS {
        for lvl in ["view", "create", "manage"] {
            v.push(format!("{}.{}", a.key, lvl));
        }
    }
    for (k, _) in ADMIN_PERMS {
        v.push((*k).to_string());
    }
    v
}

pub fn is_valid_key(k: &str) -> bool {
    all_keys().iter().any(|x| x == k)
}

/// Permissões padrão por papel. Papel "personalizado" parte do padrão de integrante
/// e aplica as exceções gravadas na tabela `permissions`.
pub fn default_allowed(role: &str, key: &str) -> bool {
    match role {
        "admin" => true,
        _ => {
            if key.ends_with(".manage") {
                return false;
            }
            !matches!(key, "finance.create" | "documents.create")
        }
    }
}
