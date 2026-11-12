-- PERSONAL LIFE ULTRA - migração 001: esquema inicial
-- Datas são armazenadas como texto ISO local (YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS).

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  color TEXT,
  avatar_path TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE user_settings (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE family_members (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','integrante','personalizado')),
  joined_at TEXT NOT NULL,
  PRIMARY KEY (family_id, user_id)
);

CREATE TABLE family_invitations (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('convite','solicitacao')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','aceito','recusado','cancelado','expirado')),
  created_at TEXT NOT NULL,
  expires_at TEXT,
  responded_at TEXT
);
CREATE INDEX idx_invites_family ON family_invitations(family_id, status);
CREATE INDEX idx_invites_user ON family_invitations(user_id, status);

CREATE TABLE permissions (
  family_id TEXT NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm_key TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  PRIMARY KEY (family_id, user_id, perm_key)
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT,
  all_day INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  recurrence TEXT NOT NULL DEFAULT 'nenhuma',
  recurrence_until TEXT,
  reminder_minutes INTEGER,
  color TEXT,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_events_owner ON events(owner_id, scope, deleted_at);
CREATE INDEX idx_events_family ON events(family_id, deleted_at);
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  objective TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planejado',
  start_date TEXT,
  due_date TEXT,
  category TEXT,
  color TEXT,
  progress REAL NOT NULL DEFAULT 0
);
CREATE INDEX idx_projects_owner ON projects(owner_id, scope, deleted_at);
CREATE INDEX idx_projects_family ON projects(family_id, deleted_at);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  priority INTEGER NOT NULL DEFAULT 1,
  due_date TEXT,
  category TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  recurrence TEXT NOT NULL DEFAULT 'nenhuma',
  reminder_minutes INTEGER,
  overdue INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT
);
CREATE INDEX idx_tasks_owner ON tasks(owner_id, scope, deleted_at);
CREATE INDEX idx_tasks_family ON tasks(family_id, deleted_at);
CREATE TABLE subtasks (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_subtasks_owner ON subtasks(owner_id, scope, deleted_at);
CREATE INDEX idx_subtasks_family ON subtasks(family_id, deleted_at);
CREATE TABLE project_steps (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_project_steps_owner ON project_steps(owner_id, scope, deleted_at);
CREATE INDEX idx_project_steps_family ON project_steps(family_id, deleted_at);
CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento',
  start_date TEXT,
  due_date TEXT,
  indicator TEXT,
  target_value REAL,
  current_value REAL NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX idx_goals_owner ON goals(owner_id, scope, deleted_at);
CREATE INDEX idx_goals_family ON goals(family_id, deleted_at);
CREATE TABLE goal_milestones (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_goal_milestones_owner ON goal_milestones(owner_id, scope, deleted_at);
CREATE INDEX idx_goal_milestones_family ON goal_milestones(family_id, deleted_at);
CREATE TABLE habits (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  frequency TEXT NOT NULL DEFAULT 'diario',
  weekdays TEXT,
  target_per_week INTEGER,
  reminder_time TEXT,
  color TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_habits_owner ON habits(owner_id, scope, deleted_at);
CREATE INDEX idx_habits_family ON habits(family_id, deleted_at);
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  content TEXT,
  folder TEXT,
  tags TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  color TEXT
);
CREATE INDEX idx_notes_owner ON notes(owner_id, scope, deleted_at);
CREATE INDEX idx_notes_family ON notes(family_id, deleted_at);
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  doc_number TEXT,
  issue_date TEXT,
  expiry_date TEXT,
  reminder_days INTEGER
);
CREATE INDEX idx_documents_owner ON documents(owner_id, scope, deleted_at);
CREATE INDEX idx_documents_family ON documents(family_id, deleted_at);
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('receita','despesa')),
  title TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  category TEXT,
  date TEXT NOT NULL,
  account TEXT,
  payment_method TEXT,
  notes TEXT,
  bill_id TEXT
);
CREATE INDEX idx_transactions_owner ON transactions(owner_id, scope, deleted_at);
CREATE INDEX idx_transactions_family ON transactions(family_id, deleted_at);
CREATE TABLE budgets (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  category TEXT NOT NULL,
  month TEXT,
  amount_limit REAL NOT NULL CHECK (amount_limit >= 0),
  alert_percent INTEGER NOT NULL DEFAULT 80,
  notes TEXT
);
CREATE INDEX idx_budgets_owner ON budgets(owner_id, scope, deleted_at);
CREATE INDEX idx_budgets_family ON budgets(family_id, deleted_at);
CREATE TABLE bills (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  category TEXT,
  recurrence TEXT NOT NULL DEFAULT 'nenhuma',
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  paid_amount REAL,
  reminder_days INTEGER,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT
);
CREATE INDEX idx_bills_owner ON bills(owner_id, scope, deleted_at);
CREATE INDEX idx_bills_family ON bills(family_id, deleted_at);
CREATE TABLE shopping_lists (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'aberta',
  store TEXT,
  notes TEXT,
  completed_at TEXT
);
CREATE INDEX idx_shopping_lists_owner ON shopping_lists(owner_id, scope, deleted_at);
CREATE INDEX idx_shopping_lists_family ON shopping_lists(family_id, deleted_at);
CREATE TABLE shopping_items (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT,
  category TEXT,
  est_price REAL,
  bought INTEGER NOT NULL DEFAULT 0,
  bought_at TEXT,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_shopping_items_owner ON shopping_items(owner_id, scope, deleted_at);
CREATE INDEX idx_shopping_items_family ON shopping_items(family_id, deleted_at);
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  title TEXT NOT NULL,
  category TEXT,
  servings INTEGER,
  prep_minutes INTEGER,
  instructions TEXT
);
CREATE INDEX idx_recipes_owner ON recipes(owner_id, scope, deleted_at);
CREATE INDEX idx_recipes_family ON recipes(family_id, deleted_at);
CREATE TABLE personal_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  module TEXT NOT NULL,
  parent_id TEXT REFERENCES personal_records(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT,
  status TEXT,
  priority INTEGER,
  date_start TEXT,
  date_end TEXT,
  amount REAL,
  progress REAL,
  ref_id TEXT,
  assignee_id TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_personal_records_owner ON personal_records(owner_id, scope, deleted_at);
CREATE INDEX idx_personal_records_family ON personal_records(family_id, deleted_at);
CREATE TABLE family_records (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal','family')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  family_id TEXT REFERENCES families(id) ON DELETE CASCADE,
  shared INTEGER NOT NULL DEFAULT 0,
  restricted_to TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  module TEXT NOT NULL,
  parent_id TEXT REFERENCES family_records(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  category TEXT,
  status TEXT,
  priority INTEGER,
  date_start TEXT,
  date_end TEXT,
  amount REAL,
  progress REAL,
  ref_id TEXT,
  assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_family_records_owner ON family_records(owner_id, scope, deleted_at);
CREATE INDEX idx_family_records_family ON family_records(family_id, deleted_at);

CREATE INDEX idx_events_start ON events(start_at);
CREATE INDEX idx_tasks_due ON tasks(due_date, status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_steps_project ON project_steps(project_id);
CREATE INDEX idx_milestones_goal ON goal_milestones(goal_id);
CREATE INDEX idx_transactions_date ON transactions(date, kind);
CREATE INDEX idx_bills_due ON bills(due_date, paid);
CREATE INDEX idx_items_list ON shopping_items(list_id);
CREATE INDEX idx_precords_module ON personal_records(owner_id, module, deleted_at);
CREATE INDEX idx_precords_parent ON personal_records(parent_id);
CREATE INDEX idx_frecords_module ON family_records(family_id, module, deleted_at);
CREATE INDEX idx_frecords_parent ON family_records(parent_id);

CREATE TABLE habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (habit_id, log_date)
);

-- Registros cronológicos genéricos (histórico de metas, votos, etapas de rotina,
-- progresso de leitura, revisões de vocabulário etc.).
CREATE TABLE record_logs (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'registro',
  value REAL,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_record_logs ON record_logs(entity, record_id, log_date);

CREATE TABLE attachments (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  record_id TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime TEXT,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_attachments_record ON attachments(entity, record_id);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  entity TEXT,
  record_id TEXT,
  due_at TEXT,
  dedupe_key TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  delivered INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, dedupe_key)
);
CREATE INDEX idx_notifications_user ON notifications(user_id, read, created_at);

CREATE TABLE dashboard_layouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace TEXT NOT NULL CHECK (workspace IN ('personal','family')),
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, workspace)
);

CREATE TABLE dashboard_widgets (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES dashboard_layouts(id) ON DELETE CASCADE,
  widget_type TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT 'm' CHECK (size IN ('s','m','l')),
  position INTEGER NOT NULL,
  config TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_widgets_layout ON dashboard_widgets(layout_id, position);

CREATE TABLE automation_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL,
  name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  params TEXT NOT NULL DEFAULT '{}',
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_rules_user ON automation_rules(user_id);

CREATE TABLE automation_logs (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  entity TEXT,
  record_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_rule_logs ON automation_logs(user_id, created_at);

CREATE TABLE onboarding_progress (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  visited TEXT NOT NULL DEFAULT '[]',
  checklist TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  family_id TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  record_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_record ON audit_logs(entity, record_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id, created_at);
CREATE INDEX idx_audit_family ON audit_logs(family_id, created_at);

CREATE TABLE search_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_search_history ON search_history(user_id, created_at);

