# Banco de dados

SQLite local (`plu.db`), modo WAL, `foreign_keys = ON`. Migrações versionadas em `crates/plu-core/migrations/` aplicadas por `db::migrate` (tabela `schema_migrations`), cada uma em transação.

## Colunas comuns das entidades de conteúdo
`id` (UUID), `scope` (`personal`/`family`), `owner_id` → users, `family_id` → families, `shared` (compartilhado explicitamente), `restricted_to` (JSON de USER IDs), `data` (JSON extra), `created_*`, `updated_*`, `deleted_at` (lixeira).

## Tabelas
users, user_settings, families, family_members, family_invitations (convites e solicitações), permissions (exceções do papel personalizado), events, tasks, subtasks, projects, project_steps, goals, goal_milestones, habits, habit_logs, notes, documents, attachments, transactions, budgets, bills, shopping_lists, shopping_items, recipes, personal_records, family_records, record_logs, notifications, dashboard_layouts, dashboard_widgets, automation_rules, automation_logs, onboarding_progress, audit_logs, app_settings, search_history, schema_migrations.

## Isolamento
- Pessoal: `scope='personal' AND owner_id = USER ID`.
- Família: `family_id = FAMILY ID` + permissão da área (`agenda`, `tasks`, `finance`, `shopping`, `home`, `documents`, `social`, `memories`, `goals`, `reports`) nos níveis `view`/`create`/`manage`, e `restricted_to` quando definido.
- Item pessoal compartilhado: continua do dono, aparece para a família somente leitura (exceto campos colaborativos, como "comprado").

## Índices
Por dono/ambiente, família, datas (`start_at`, `due_date`, `date`), relações pai-filho e módulo. Pesquisa sem acento via função SQL `plu_norm`.
