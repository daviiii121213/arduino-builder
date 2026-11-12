// Definição de todos os módulos: campos de formulário, colunas, filtros e visões.
// Os nomes de entidades e colunas correspondem ao registro do núcleo (crates/plu-core/src/entities.rs).
import type { ChildDef, FieldDef, ModuleDef, Opt } from "./types";
import { today, toISODateTime } from "../utils/format";

const o = (...pairs: Array<[string, string]>): Opt[] => pairs.map(([value, label]) => ({ value, label }));

export const PRIORITY = o(["0", "Baixa"], ["1", "Normal"], ["2", "Alta"], ["3", "Urgente"]);
export const RECURRENCE = o(["nenhuma", "Não repete"], ["diaria", "Diariamente"], ["semanal", "Semanalmente"], ["mensal", "Mensalmente"], ["anual", "Anualmente"]);
export const TASK_STATUS = o(["pendente", "Pendente"], ["em_andamento", "Em andamento"], ["concluida", "Concluída"]);
export const PROJECT_STATUS = o(["planejado", "Planejado"], ["em_andamento", "Em andamento"], ["pausado", "Pausado"], ["concluido", "Concluído"]);
export const GOAL_STATUS = o(["em_andamento", "Em andamento"], ["pausada", "Pausada"], ["concluida", "Concluída"], ["cancelada", "Cancelada"]);
export const REMINDER = o(["", "Sem lembrete"], ["0", "Na hora"], ["10", "10 minutos antes"], ["30", "30 minutos antes"], ["60", "1 hora antes"], ["1440", "1 dia antes"]);
export const MEAL = o(["cafe", "Café da manhã"], ["almoco", "Almoço"], ["lanche", "Lanche"], ["jantar", "Jantar"]);
export const BOOK_STATUS = o(["quero_ler", "Quero ler"], ["lendo", "Lendo"], ["lido", "Lido"], ["abandonado", "Abandonado"]);

const title = (label = "Título"): FieldDef => ({ key: "title", label, type: "text", required: true, full: true });
const category = (key = "category"): FieldDef => ({ key, label: "Categoria", type: "text", placeholder: "Ex.: Trabalho" });
const notesField = (key: string, label = "Observações"): FieldDef => ({ key, label, type: "textarea", full: true });

const subtasks: ChildDef = { entity: "subtasks", label: "Subtarefas", parentKey: "task_id", doneKey: "done", fields: [title("Subtarefa")] };
const projectSteps: ChildDef = {
  entity: "project_steps", label: "Etapas", parentKey: "project_id", doneKey: "done",
  fields: [title("Etapa"), { key: "due_date", label: "Prazo", type: "date" }, notesField("description", "Descrição")],
};
const milestones: ChildDef = {
  entity: "goal_milestones", label: "Marcos", parentKey: "goal_id", doneKey: "done",
  fields: [title("Marco"), { key: "due_date", label: "Prazo", type: "date" }, { key: "assignee_id", label: "Responsável", type: "member", workspaces: ["family"] }],
};
const shoppingItems: ChildDef = {
  entity: "shopping_items", label: "Itens", parentKey: "list_id", doneKey: "bought",
  fields: [title("Produto"), { key: "quantity", label: "Quantidade", type: "number", min: 0, step: 0.1 }, { key: "unit", label: "Unidade", type: "text", placeholder: "un, kg, L" },
    { key: "est_price", label: "Preço estimado (unitário)", type: "money" }, category(), { key: "assignee_id", label: "Responsável", type: "member", workspaces: ["family"] }],
  subtitle: (r) => [r.quantity ? `${String(r.quantity).replace(".", ",")} ${r.unit ?? ""}` : "", r.category, r.assignee_name].filter(Boolean).join(" · "),
};

export const MODULES: ModuleDef[] = [
  // ======================= PESSOAL + FAMÍLIA =======================
  {
    id: "events", entity: "events", label: "Agenda", singular: "Compromisso", icon: "CalendarDays", workspaces: ["personal", "family"], area: "agenda",
    group: "Organização", description: "Compromissos com data, horário, local, lembretes e recorrência.",
    fields: [
      title(), { key: "start_at", label: "Início", type: "datetime", required: true }, { key: "end_at", label: "Término", type: "datetime" },
      { key: "all_day", label: "Dia inteiro", type: "checkbox" }, { key: "location", label: "Local", type: "text" },
      { key: "priority", label: "Prioridade", type: "priority" }, category(), { key: "recurrence", label: "Repetição", type: "select", options: RECURRENCE },
      { key: "recurrence_until", label: "Repetir até", type: "date", showIf: (v) => !!v.recurrence && v.recurrence !== "nenhuma" },
      { key: "reminder_minutes", label: "Lembrete", type: "select", options: REMINDER }, { key: "color", label: "Cor", type: "color", full: true },
      { key: "assignee_id", label: "Responsável", type: "member", workspaces: ["family"] }, { key: "data.participants", label: "Participantes", type: "members", workspaces: ["family"], full: true },
      notesField("description", "Descrição"),
    ],
    columns: [{ key: "start_at", label: "Quando", type: "datetime" }, { key: "location", label: "Local" }, { key: "category", label: "Categoria", type: "badge" }, { key: "priority", label: "Prioridade", type: "priority" }],
    sort: "start_at ASC", shareable: true, attachments: true,
    defaults: () => { const d = new Date(); d.setMinutes(0); d.setHours(d.getHours() + 1); return { start_at: toISODateTime(d), recurrence: "nenhuma", priority: 1 }; },
    emptyTitle: "Nenhum compromisso", emptyText: "Registre consultas, reuniões e eventos com lembretes locais.",
  },
  {
    id: "tasks", entity: "tasks", label: "Tarefas", singular: "Tarefa", icon: "CheckSquare", workspaces: ["personal", "family"], area: "tasks",
    group: "Organização", description: "Tarefas com prioridade, prazo, subtarefas e recorrência. Na família, funcionam como tarefas domésticas.",
    fields: [
      title("Tarefa"), { key: "status", label: "Situação", type: "select", options: TASK_STATUS }, { key: "priority", label: "Prioridade", type: "priority" },
      { key: "due_date", label: "Prazo", type: "datetext", hint: "Data, com horário opcional" }, category(),
      { key: "project_id", label: "Projeto", type: "ref", ref: "projects", workspaces: ["personal"] },
      { key: "assignee_id", label: "Responsável", type: "member", workspaces: ["family"] },
      { key: "recurrence", label: "Frequência", type: "select", options: RECURRENCE },
      { key: "reminder_minutes", label: "Lembrete (se houver horário)", type: "select", options: REMINDER },
      notesField("notes", "Notas"),
    ],
    columns: [{ key: "due_date", label: "Prazo", type: "datetime" }, { key: "priority", label: "Prioridade", type: "priority" }, { key: "category", label: "Categoria", type: "badge" }, { key: "assignee_id", label: "Responsável", type: "member" }],
    filters: [{ key: "status", label: "Situação", options: TASK_STATUS }, { key: "overdue", label: "Atraso", options: o(["true", "Atrasadas"]) }],
    views: ["list", "board"], board: { key: "status", columns: TASK_STATUS },
    children: [subtasks], shareable: true, attachments: true, defaults: { status: "pendente", priority: 1, recurrence: "nenhuma" },
    emptyTitle: "Nenhuma tarefa", emptyText: "Crie tarefas com prazos e prioridades para organizar o seu dia.",
  },
  {
    id: "goals", entity: "goals", label: "Metas", singular: "Meta", icon: "Target", workspaces: ["personal", "family"], area: "goals",
    group: "Organização", description: "Metas com indicadores, marcos, prazos e histórico de progresso.",
    fields: [
      title("Meta"), { key: "status", label: "Situação", type: "select", options: GOAL_STATUS }, category(),
      { key: "start_date", label: "Início", type: "date" }, { key: "due_date", label: "Prazo", type: "date" },
      { key: "indicator", label: "Indicador", type: "text", placeholder: "Ex.: km, livros, R$" }, { key: "target_value", label: "Valor alvo", type: "number", step: 0.01 },
      { key: "current_value", label: "Valor atual", type: "number", step: 0.01 }, { key: "progress", label: "Progresso manual (%)", type: "number", min: 0, max: 100, hint: "Usado quando não há valor alvo nem marcos" },
      { key: "assignee_id", label: "Responsável", type: "member", workspaces: ["family"] }, notesField("description", "Descrição e notas"),
    ],
    columns: [{ key: "progress", label: "Progresso", type: "progress" }, { key: "due_date", label: "Prazo", type: "date" }, { key: "status", label: "Situação", type: "badge", options: GOAL_STATUS }],
    filters: [{ key: "status", label: "Situação", options: GOAL_STATUS }],
    children: [milestones], shareable: true, attachments: true, defaults: { status: "em_andamento" },
    logs: { label: "Histórico de progresso", kind: "progresso", valueLabel: "Valor" },
    emptyTitle: "Nenhuma meta", emptyText: "Defina objetivos com indicadores e acompanhe a evolução.",
  },
  {
    id: "transactions", entity: "transactions", label: "Lançamentos", singular: "Lançamento", icon: "Receipt", workspaces: ["personal", "family"], area: "finance",
    group: "Finanças", description: "Receitas e despesas registradas manualmente.",
    fields: [
      { key: "kind", label: "Tipo", type: "select", required: true, options: o(["despesa", "Despesa"], ["receita", "Receita"]) },
      { key: "amount", label: "Valor", type: "money", required: true }, title("Descrição"), { key: "date", label: "Data", type: "date", required: true },
      category(), { key: "account", label: "Conta/carteira", type: "text", placeholder: "Ex.: Banco, Dinheiro" },
      { key: "payment_method", label: "Forma de pagamento", type: "select", options: o(["", "—"], ["Pix", "Pix"], ["Débito", "Débito"], ["Crédito", "Crédito"], ["Dinheiro", "Dinheiro"], ["Boleto", "Boleto"], ["Transferência", "Transferência"]) },
      notesField("notes"),
    ],
    columns: [{ key: "date", label: "Data", type: "date" }, { key: "category", label: "Categoria", type: "badge" }, { key: "kind", label: "Tipo", type: "badge", options: o(["despesa", "Despesa"], ["receita", "Receita"]) }, { key: "amount", label: "Valor", type: "money" }],
    filters: [{ key: "kind", label: "Tipo", options: o(["despesa", "Despesas"], ["receita", "Receitas"]) }],
    attachments: true, defaults: () => ({ kind: "despesa", date: today() }),
    emptyTitle: "Nenhum lançamento", emptyText: "Registre receitas e despesas para acompanhar seus gastos.",
  },
  {
    id: "budgets", entity: "budgets", label: "Orçamentos", singular: "Orçamento", icon: "PiggyBank", workspaces: ["personal", "family"], area: "finance",
    group: "Finanças", description: "Limites de gastos por categoria, mensais ou recorrentes.",
    fields: [
      { key: "category", label: "Categoria", type: "text", required: true }, { key: "amount_limit", label: "Limite", type: "money", required: true },
      { key: "month", label: "Mês (AAAA-MM)", type: "text", placeholder: "Vazio = todos os meses", hint: "Deixe em branco para repetir todo mês" },
      { key: "alert_percent", label: "Avisar ao atingir (%)", type: "number", min: 1, max: 100 }, notesField("notes"),
    ],
    columns: [{ key: "amount_limit", label: "Limite", type: "money" }, { key: "month", label: "Mês" }, { key: "alert_percent", label: "Alerta (%)", type: "number" }],
    defaults: { alert_percent: 80 }, emptyTitle: "Nenhum orçamento", emptyText: "Defina limites por categoria e receba avisos ao se aproximar deles.",
  },
  {
    id: "bills", entity: "bills", label: "Contas", singular: "Conta", icon: "Receipt", workspaces: ["personal", "family"], area: "finance",
    group: "Finanças", description: "Contas a pagar com vencimentos, pagamentos e lembretes. Na família: contas da casa.",
    fields: [
      title("Conta"), { key: "amount", label: "Valor", type: "money" }, { key: "due_date", label: "Vencimento", type: "date", required: true }, category(),
      { key: "recurrence", label: "Repetição", type: "select", options: RECURRENCE }, { key: "reminder_days", label: "Avisar com antecedência (dias)", type: "number", min: 0, max: 365 },
      { key: "paid", label: "Paga", type: "checkbox" }, { key: "paid_amount", label: "Valor pago", type: "money", showIf: (v) => !!v.paid },
      { key: "assignee_id", label: "Responsável", type: "member", workspaces: ["family"] }, notesField("notes"),
    ],
    columns: [{ key: "due_date", label: "Vencimento", type: "date" }, { key: "amount", label: "Valor", type: "money" }, { key: "paid", label: "Paga", type: "bool" }, { key: "category", label: "Categoria", type: "badge" }],
    filters: [{ key: "paid", label: "Situação", options: o(["false", "Em aberto"], ["true", "Pagas"]) }],
    attachments: true, defaults: () => ({ due_date: today(), recurrence: "nenhuma", reminder_days: 3 }),
    emptyTitle: "Nenhuma conta", emptyText: "Cadastre contas para controlar vencimentos e pagamentos. Ao marcar como paga, a despesa é lançada automaticamente.",
  },
  {
    id: "shopping_lists", entity: "shopping_lists", label: "Compras", singular: "Lista de compras", icon: "ShoppingCart", workspaces: ["personal", "family"], area: "shopping",
    group: "Casa e compras", description: "Listas de compras com quantidades, preços estimados e histórico.",
    fields: [title("Nome da lista"), category(), { key: "store", label: "Local de compra", type: "text" }, { key: "status", label: "Situação", type: "select", options: o(["aberta", "Aberta"], ["concluida", "Concluída"]) }, notesField("notes")],
    columns: [{ key: "items", label: "Itens", render: (r) => `${r.items_bought ?? 0}/${r.items_total ?? 0}` }, { key: "est_total", label: "Estimado", type: "money" }, { key: "status", label: "Situação", type: "badge", options: o(["aberta", "Aberta"], ["concluida", "Concluída"]) }],
    filters: [{ key: "status", label: "Situação", options: o(["aberta", "Abertas"], ["concluida", "Histórico (concluídas)"]) }],
    children: [shoppingItems], shareable: true, defaults: { status: "aberta" },
    emptyTitle: "Nenhuma lista", emptyText: "Crie listas e marque os itens ao comprar. Listas concluídas ficam no histórico.",
  },
  {
    id: "documents", entity: "documents", label: "Documentos", singular: "Documento", icon: "FileText", workspaces: ["personal", "family"], area: "documents",
    group: "Arquivos", description: "Documentos com arquivos anexados, datas importantes e lembretes.",
    fields: [
      title("Documento"), category(), { key: "doc_number", label: "Número/identificação", type: "text" }, { key: "issue_date", label: "Emissão", type: "date" },
      { key: "expiry_date", label: "Validade / data importante", type: "date" }, { key: "reminder_days", label: "Lembrar com antecedência (dias)", type: "number", min: 0 },
      { key: "restricted_to", label: "Visível apenas para", type: "restricted", workspaces: ["family"], full: true, hint: "Vazio = todos com permissão de documentos" },
      notesField("description", "Descrição"),
    ],
    columns: [{ key: "category", label: "Categoria", type: "badge" }, { key: "expiry_date", label: "Validade", type: "date" }, { key: "attachments", label: "Arquivos", type: "number" }],
    shareable: true, attachments: true, emptyTitle: "Nenhum documento", emptyText: "Guarde documentos importantes com anexos locais e lembretes de validade.",
  },
  {
    id: "recipes", entity: "recipes", label: "Receitas", singular: "Receita", icon: "ChefHat", workspaces: ["family", "personal"], area: "home",
    group: "Casa e compras", description: "Receitas com ingredientes, quantidades, modo de preparo e fotos.",
    fields: [title("Receita"), category(), { key: "servings", label: "Porções", type: "number", min: 0 }, { key: "prep_minutes", label: "Tempo de preparo (min)", type: "number", min: 0 },
      { key: "data.ingredients", label: "Ingredientes", type: "ingredients", full: true }, notesField("instructions", "Modo de preparo")],
    columns: [{ key: "category", label: "Categoria", type: "badge" }, { key: "servings", label: "Porções", type: "number" }, { key: "prep_minutes", label: "Preparo (min)", type: "number" }],
    attachments: true, emptyTitle: "Nenhuma receita", emptyText: "Cadastre receitas para montar o cardápio e gerar a lista de ingredientes.",
  },

  // ======================= PESSOAL =======================
  {
    id: "projects", entity: "projects", label: "Projetos", singular: "Projeto", icon: "FolderKanban", workspaces: ["personal"], area: "personal",
    group: "Organização", description: "Projetos com objetivos, etapas, tarefas vinculadas, arquivos e quadro Kanban.",
    fields: [title("Projeto"), { key: "status", label: "Situação", type: "select", options: PROJECT_STATUS }, category(), { key: "start_date", label: "Início", type: "date" },
      { key: "due_date", label: "Prazo", type: "date" }, { key: "color", label: "Cor", type: "color" }, { key: "progress", label: "Progresso manual (%)", type: "number", min: 0, max: 100, hint: "Calculado automaticamente quando a automação está ativa" },
      notesField("objective", "Objetivo"), notesField("description", "Observações")],
    columns: [{ key: "progress", label: "Progresso", type: "progress" }, { key: "due_date", label: "Prazo", type: "date" }, { key: "status", label: "Situação", type: "badge", options: PROJECT_STATUS }],
    views: ["cards", "list", "board"], board: { key: "status", columns: PROJECT_STATUS }, children: [projectSteps], attachments: true, defaults: { status: "planejado" },
    emptyTitle: "Nenhum projeto", emptyText: "Organize projetos em etapas e acompanhe o progresso.",
  },
  {
    id: "habits", entity: "habits", label: "Hábitos", singular: "Hábito", icon: "Flame", workspaces: ["personal"], area: "personal", group: "Rotina",
    description: "Hábitos com frequência, registro diário, calendário e consistência.",
    fields: [title("Hábito"), { key: "frequency", label: "Frequência", type: "select", options: o(["diario", "Todos os dias"], ["semanal", "Vezes por semana"], ["dias", "Dias específicos"]) },
      { key: "target_per_week", label: "Meta semanal (vezes)", type: "number", min: 1, max: 7, showIf: (v) => v.frequency === "semanal" },
      { key: "weekdays", label: "Dias da semana", type: "weekdays", showIf: (v) => v.frequency === "dias", full: true },
      { key: "reminder_time", label: "Lembrete às", type: "time" }, category(), { key: "color", label: "Cor", type: "color" }, { key: "active", label: "Ativo", type: "checkbox" }, notesField("description", "Descrição")],
    columns: [{ key: "streak", label: "Sequência", type: "number" }, { key: "count_30", label: "Últimos 30 dias", type: "number" }],
    defaults: { frequency: "diario", active: true }, emptyTitle: "Nenhum hábito", emptyText: "Crie hábitos e registre a conclusão diariamente para acompanhar a consistência.",
  },
  {
    id: "routine", entity: "routine", label: "Rotinas", singular: "Rotina", icon: "ListChecks", workspaces: ["personal"], area: "personal", group: "Rotina",
    description: "Rotinas com etapas por horário e dias da semana.",
    fields: [title("Rotina"), { key: "data.weekdays", label: "Dias da semana", type: "weekdays", full: true }, { key: "data.time", label: "Horário de início", type: "time" }, category(), notesField("body", "Descrição")],
    columns: [{ key: "steps", label: "Hoje", render: (r) => `${r.steps_done_today ?? 0}/${r.steps_total ?? 0} etapas` }, { key: "data.time", label: "Início" }],
    children: [{ entity: "routine_step", label: "Etapas", parentKey: "parent_id", fields: [title("Etapa"), { key: "date_start", label: "Horário", type: "time" }, { key: "body", label: "Detalhes", type: "textarea", full: true }], subtitle: (r) => r.date_start }],
    emptyTitle: "Nenhuma rotina", emptyText: "Monte rotinas (manhã, estudos, treino) com etapas e marque o que já fez hoje.",
  },
  {
    id: "study_subject", entity: "study_subject", label: "Matérias", singular: "Matéria", icon: "GraduationCap", workspaces: ["personal"], area: "personal", group: "Estudos",
    description: "Matérias e disciplinas estudadas.", fields: [title("Matéria"), { key: "data.teacher", label: "Professor(a)", type: "text" }, { key: "category", label: "Período/turma", type: "text" }, { key: "data.color", label: "Cor", type: "color" }, notesField("body", "Anotações")],
    columns: [{ key: "category", label: "Período", type: "badge" }, { key: "children_total", label: "Itens", type: "number" }],
    emptyTitle: "Nenhuma matéria", emptyText: "Cadastre as matérias para organizar conteúdos, provas e entregas.",
  },
  {
    id: "study_item", entity: "study_item", label: "Cronograma de estudos", singular: "Item de estudo", icon: "CalendarDays", workspaces: ["personal"], area: "personal", group: "Estudos",
    description: "Conteúdos, tarefas escolares, provas e datas de entrega.",
    fields: [title("Item"), { key: "category", label: "Tipo", type: "select", required: true, options: o(["conteudo", "Conteúdo"], ["tarefa", "Tarefa escolar"], ["prova", "Prova"], ["entrega", "Entrega"]) },
      { key: "ref_id", label: "Matéria", type: "ref", ref: "study_subject" }, { key: "date_start", label: "Data", type: "date" }, { key: "status", label: "Situação", type: "select", options: o(["pendente", "Pendente"], ["concluido", "Concluído"]) },
      { key: "amount", label: "Nota", type: "number", step: 0.1 }, notesField("body", "Detalhes")],
    columns: [{ key: "category", label: "Tipo", type: "badge", options: o(["conteudo", "Conteúdo"], ["tarefa", "Tarefa"], ["prova", "Prova"], ["entrega", "Entrega"]) }, { key: "date_start", label: "Data", type: "date" }, { key: "status", label: "Situação", type: "badge", options: o(["pendente", "Pendente"], ["concluido", "Concluído"]) }],
    filters: [{ key: "category", label: "Tipo", options: o(["conteudo", "Conteúdos"], ["tarefa", "Tarefas"], ["prova", "Provas"], ["entrega", "Entregas"]) }, { key: "status", label: "Situação", options: o(["pendente", "Pendentes"], ["concluido", "Concluídos"]) }],
    defaults: { category: "conteudo", status: "pendente" }, sort: "date_start ASC",
    emptyTitle: "Cronograma vazio", emptyText: "Registre conteúdos, provas e entregas com datas para montar seu cronograma.",
  },
  {
    id: "study_session", entity: "study_session", label: "Sessões de estudo", singular: "Sessão de estudo", icon: "Timer", workspaces: ["personal"], area: "personal", group: "Estudos",
    description: "Tempo dedicado a cada matéria.", fields: [title("Assunto"), { key: "ref_id", label: "Matéria", type: "ref", ref: "study_subject" }, { key: "date_start", label: "Data e hora", type: "datetime", required: true }, { key: "amount", label: "Duração (min)", type: "number", min: 0, required: true }, notesField("body", "Anotações")],
    columns: [{ key: "date_start", label: "Quando", type: "datetime" }, { key: "amount", label: "Minutos", type: "number" }],
    defaults: () => ({ date_start: toISODateTime(new Date()), amount: 50 }), sort: "date_start DESC",
    emptyTitle: "Nenhuma sessão", emptyText: "Registre o tempo de estudo para acompanhar seu progresso.",
  },
  {
    id: "course", entity: "course", label: "Cursos", singular: "Curso", icon: "BookOpen", workspaces: ["personal"], area: "personal", group: "Estudos",
    description: "Cursos, aulas, materiais e certificados.",
    fields: [title("Curso"), { key: "data.platform", label: "Instituição/plataforma", type: "text" }, { key: "data.instructor", label: "Instrutor(a)", type: "text" },
      { key: "status", label: "Situação", type: "select", options: o(["planejado", "Planejado"], ["cursando", "Cursando"], ["concluido", "Concluído"]) },
      { key: "date_start", label: "Início", type: "date" }, { key: "date_end", label: "Conclusão", type: "date" }, { key: "progress", label: "Progresso (%)", type: "number", min: 0, max: 100, hint: "Atualizado automaticamente pelas aulas" },
      { key: "data.certificate", label: "Certificado (código/registro)", type: "text" }, notesField("body", "Anotações")],
    columns: [{ key: "progress", label: "Progresso", type: "progress" }, { key: "status", label: "Situação", type: "badge", options: o(["planejado", "Planejado"], ["cursando", "Cursando"], ["concluido", "Concluído"]) }],
    children: [{ entity: "course_lesson", label: "Aulas", parentKey: "parent_id", doneKey: "status", doneValue: "concluida", undoneValue: "pendente", fields: [title("Aula"), { key: "date_start", label: "Data", type: "date" }, notesField("body", "Anotações")] }],
    attachments: true, defaults: { status: "cursando" }, emptyTitle: "Nenhum curso", emptyText: "Cadastre cursos, aulas e guarde materiais e certificados.",
  },
  {
    id: "notes", entity: "notes", label: "Notas", singular: "Nota", icon: "StickyNote", workspaces: ["personal"], area: "personal", group: "Registros",
    description: "Notas com pastas, etiquetas e fixação.",
    fields: [title(), { key: "folder", label: "Pasta", type: "text", placeholder: "Ex.: Ideias" }, { key: "tags", label: "Etiquetas", type: "tags", placeholder: "Separe por vírgula" }, { key: "pinned", label: "Fixar no topo", type: "checkbox" }, { key: "color", label: "Cor", type: "color" }, { key: "content", label: "Conteúdo", type: "textarea", full: true }],
    columns: [{ key: "folder", label: "Pasta", type: "badge" }, { key: "tags", label: "Etiquetas" }, { key: "updated_at", label: "Atualizada", type: "datetime" }],
    views: ["cards", "list"], attachments: true, emptyTitle: "Nenhuma nota", emptyText: "Anote ideias e organize em pastas e etiquetas.",
  },
  {
    id: "diary", entity: "diary", label: "Diário", singular: "Registro do diário", icon: "Notebook", workspaces: ["personal"], area: "personal", group: "Registros",
    description: "Registros pessoais por data, com imagens locais e bloqueio opcional.", protected: true,
    fields: [title(), { key: "date_start", label: "Data", type: "date", required: true }, { key: "category", label: "Humor", type: "select", options: o(["", "—"], ["otimo", "Ótimo"], ["bom", "Bom"], ["neutro", "Neutro"], ["ruim", "Ruim"], ["dificil", "Difícil"]) }, { key: "body", label: "Texto", type: "textarea", full: true }],
    columns: [{ key: "date_start", label: "Data", type: "date" }, { key: "category", label: "Humor", type: "badge" }],
    attachments: true, sort: "date_start DESC", defaults: () => ({ date_start: today() }), emptyTitle: "Diário vazio", emptyText: "Escreva sobre o seu dia. O diário pode exigir senha para abrir (Configurações › Privacidade).",
  },
  {
    id: "wishlist", entity: "wishlist", label: "Lista de desejos", singular: "Desejo", icon: "Gift", workspaces: ["personal"], area: "personal", group: "Casa e compras",
    description: "Itens desejados com preço estimado, prioridade e imagens.",
    fields: [title("Item"), { key: "amount", label: "Preço estimado", type: "money" }, { key: "priority", label: "Prioridade", type: "priority" }, category(), { key: "status", label: "Situação", type: "select", options: o(["desejado", "Desejado"], ["adquirido", "Adquirido"]) }, { key: "data.where", label: "Onde encontrar", type: "text" }, notesField("body", "Descrição")],
    columns: [{ key: "amount", label: "Preço", type: "money" }, { key: "priority", label: "Prioridade", type: "priority" }, { key: "status", label: "Situação", type: "badge", options: o(["desejado", "Desejado"], ["adquirido", "Adquirido"]) }],
    filters: [{ key: "status", label: "Situação", options: o(["desejado", "Desejados"], ["adquirido", "Adquiridos"]) }],
    views: ["cards", "list"], attachments: true, defaults: { status: "desejado", priority: 1 }, emptyTitle: "Lista vazia", emptyText: "Guarde ideias de compras e presentes com imagens e preços.",
  },
  {
    id: "book", entity: "book", label: "Biblioteca", singular: "Livro", icon: "Library", workspaces: ["personal"], area: "personal", group: "Estudos",
    description: "Livros, autores, categorias, páginas e lista de leitura.",
    fields: [title("Título do livro"), { key: "data.author", label: "Autor(a)", type: "text" }, category(), { key: "status", label: "Situação", type: "select", options: BOOK_STATUS },
      { key: "data.total_pages", label: "Total de páginas", type: "number", min: 0 }, { key: "data.current_page", label: "Página atual", type: "number", min: 0 },
      { key: "date_start", label: "Início da leitura", type: "date" }, { key: "date_end", label: "Fim da leitura", type: "date" }, { key: "priority", label: "Avaliação", type: "rating" }, notesField("body", "Resenha / anotações gerais")],
    columns: [{ key: "data.author", label: "Autor" }, { key: "progress", label: "Leitura", type: "progress" }, { key: "status", label: "Situação", type: "badge", options: BOOK_STATUS }],
    filters: [{ key: "status", label: "Situação", options: BOOK_STATUS }], views: ["cards", "list"], defaults: { status: "quero_ler" },
    logs: { label: "Anotações de leitura", kind: "anotacao", valueLabel: "Página", noteLabel: "Anotação" },
    emptyTitle: "Biblioteca vazia", emptyText: "Cadastre livros, acompanhe páginas lidas e monte sua lista de leitura.",
  },
  {
    id: "language", entity: "language", label: "Idiomas", singular: "Idioma", icon: "Languages", workspaces: ["personal"], area: "personal", group: "Estudos",
    description: "Idiomas estudados, vocabulário, traduções e revisões.",
    fields: [title("Idioma"), { key: "category", label: "Nível", type: "select", options: o(["", "—"], ["A1", "A1"], ["A2", "A2"], ["B1", "B1"], ["B2", "B2"], ["C1", "C1"], ["C2", "C2"]) }, { key: "progress", label: "Progresso (%)", type: "number", min: 0, max: 100 }, notesField("body", "Objetivos e recursos")],
    columns: [{ key: "category", label: "Nível", type: "badge" }, { key: "children_total", label: "Palavras", type: "number" }, { key: "progress", label: "Progresso", type: "progress" }],
    children: [{ entity: "vocab", label: "Vocabulário", parentKey: "parent_id", fields: [title("Palavra/expressão"), { key: "body", label: "Tradução", type: "text" }, { key: "data.example", label: "Exemplo", type: "text", full: true }, { key: "status", label: "Situação", type: "select", options: o(["novo", "Novo"], ["aprendendo", "Aprendendo"], ["dominado", "Dominado"]) }, { key: "date_start", label: "Próxima revisão", type: "date" }], subtitle: (r) => [r.body, r.status, r.date_start ? `revisar ${r.date_start.split("-").reverse().join("/")}` : ""].filter(Boolean).join(" · ") }],
    emptyTitle: "Nenhum idioma", emptyText: "Cadastre idiomas e monte seu vocabulário com revisões.",
  },
  {
    id: "time_session", entity: "time_session", label: "Controle de tempo", singular: "Sessão de tempo", icon: "Clock", workspaces: ["personal"], area: "personal", group: "Rotina",
    description: "Sessões cronometradas por categoria e projeto.",
    fields: [title("Atividade"), category(), { key: "ref_id", label: "Projeto", type: "ref", ref: "projects" }, { key: "date_start", label: "Início", type: "datetime", required: true }, { key: "date_end", label: "Fim", type: "datetime" }, { key: "amount", label: "Duração (min)", type: "number", min: 0, required: true }, notesField("body", "Notas")],
    columns: [{ key: "date_start", label: "Início", type: "datetime" }, { key: "category", label: "Categoria", type: "badge" }, { key: "amount", label: "Minutos", type: "number" }],
    sort: "date_start DESC", defaults: () => ({ date_start: toISODateTime(new Date()), amount: 30 }), emptyTitle: "Nenhuma sessão", emptyText: "Use o cronômetro ou registre manualmente o tempo dedicado às atividades.",
  },
  {
    id: "pomodoro_session", entity: "pomodoro_session", label: "Pomodoro", singular: "Sessão Pomodoro", icon: "Hourglass", workspaces: ["personal"], area: "personal", group: "Rotina",
    description: "Temporizador de foco com pausas curtas e longas, ciclos e histórico.",
    fields: [title("Foco"), { key: "date_start", label: "Início", type: "datetime", required: true }, { key: "amount", label: "Duração (min)", type: "number", required: true }, { key: "category", label: "Tipo", type: "select", options: o(["foco", "Foco"], ["pausa_curta", "Pausa curta"], ["pausa_longa", "Pausa longa"]) }],
    columns: [{ key: "date_start", label: "Início", type: "datetime" }, { key: "category", label: "Tipo", type: "badge" }, { key: "amount", label: "Minutos", type: "number" }],
    sort: "date_start DESC", emptyTitle: "Nenhuma sessão", emptyText: "Inicie o temporizador acima. As sessões concluídas aparecem aqui.",
  },
  {
    id: "health_appointment", entity: "health_appointment", label: "Saúde e consultas", singular: "Consulta/exame", icon: "HeartPulse", workspaces: ["personal"], area: "personal", group: "Registros",
    description: "Consultas, exames e documentos de saúde informados por você. O aplicativo não faz diagnósticos nem recomendações.",
    fields: [title("Descrição"), { key: "category", label: "Tipo", type: "select", options: o(["consulta", "Consulta"], ["exame", "Exame"], ["vacina", "Vacina"], ["retorno", "Retorno"], ["outro", "Outro"]) }, { key: "date_start", label: "Data e hora", type: "datetime", required: true },
      { key: "ref_id", label: "Profissional", type: "ref", ref: "health_professional" }, { key: "data.location", label: "Local", type: "text" }, { key: "status", label: "Situação", type: "select", options: o(["agendado", "Agendado"], ["realizado", "Realizado"], ["cancelado", "Cancelado"]) },
      notesField("body", "Informações registradas por você")],
    columns: [{ key: "date_start", label: "Quando", type: "datetime" }, { key: "category", label: "Tipo", type: "badge" }, { key: "status", label: "Situação", type: "badge" }],
    attachments: true, sort: "date_start DESC", defaults: { category: "consulta", status: "agendado" },
    emptyTitle: "Nenhum registro de saúde", emptyText: "Registre consultas e exames e guarde documentos relacionados com privacidade.",
  },
  {
    id: "health_professional", entity: "health_professional", label: "Profissionais de saúde", singular: "Profissional", icon: "User", workspaces: ["personal"], area: "personal", group: "Registros",
    description: "Contatos de profissionais de saúde.", fields: [title("Nome"), { key: "category", label: "Especialidade", type: "text" }, { key: "data.phone", label: "Telefone", type: "text" }, { key: "data.address", label: "Endereço", type: "text", full: true }, notesField("body")],
    columns: [{ key: "category", label: "Especialidade", type: "badge" }, { key: "data.phone", label: "Telefone" }], hidden: true,
    emptyTitle: "Nenhum profissional", emptyText: "Cadastre médicos, dentistas e outros profissionais.",
  },
  {
    id: "mindmap", entity: "mindmap", label: "Mapas mentais", singular: "Mapa mental", icon: "Network", workspaces: ["personal"], area: "personal", group: "Criatividade",
    description: "Mapas com nós, conexões, cores e salvamento automático.", fields: [title("Nome do mapa"), category(), notesField("body", "Descrição")],
    columns: [{ key: "category", label: "Categoria", type: "badge" }, { key: "updated_at", label: "Atualizado", type: "datetime" }],
    emptyTitle: "Nenhum mapa mental", emptyText: "Crie mapas para organizar ideias visualmente.",
  },
  {
    id: "portfolio", entity: "portfolio", label: "Portfólio", singular: "Trabalho", icon: "Briefcase", workspaces: ["personal"], area: "personal", group: "Criatividade",
    description: "Projetos realizados, imagens, descrições e resultados.",
    fields: [title("Trabalho"), category(), { key: "date_start", label: "Data", type: "date" }, { key: "status", label: "Situação", type: "select", options: o(["em_andamento", "Em andamento"], ["concluido", "Concluído"]) }, notesField("body", "Descrição"), { key: "data.results", label: "Resultados", type: "textarea", full: true }],
    columns: [{ key: "category", label: "Categoria", type: "badge" }, { key: "date_start", label: "Data", type: "date" }],
    views: ["cards", "list"], attachments: true, emptyTitle: "Portfólio vazio", emptyText: "Registre seus trabalhos com imagens e resultados.",
  },
  {
    id: "research", entity: "research", label: "Pesquisas", singular: "Pesquisa", icon: "Microscope", workspaces: ["personal"], area: "personal", group: "Criatividade",
    description: "Pesquisas com categorias, fontes registradas manualmente, observações e anexos.",
    fields: [title("Tema"), category(), { key: "status", label: "Situação", type: "select", options: o(["aberta", "Em andamento"], ["concluida", "Concluída"]) }, { key: "data.sources", label: "Fontes", type: "stringlist", full: true, placeholder: "Livro, artigo, endereço…" }, notesField("body")],
    columns: [{ key: "category", label: "Categoria", type: "badge" }, { key: "status", label: "Situação", type: "badge" }],
    attachments: true, emptyTitle: "Nenhuma pesquisa", emptyText: "Guarde pesquisas com fontes e anexos.",
  },

  // ======================= FAMÍLIA =======================
  {
    id: "duty", entity: "duty", label: "Responsabilidades", singular: "Responsabilidade", icon: "Users", workspaces: ["family"], area: "tasks", group: "Casa e rotina",
    description: "Divisão de atividades da casa com responsáveis e escalas por dia da semana.",
    fields: [title("Atividade"), { key: "assignee_id", label: "Responsável principal", type: "member" }, { key: "data.weekdays", label: "Dias", type: "weekdays", full: true }, { key: "data.rotation", label: "Escala (rodízio semanal)", type: "members", full: true, hint: "A cada semana, o próximo integrante assume" }, category(), notesField("body")],
    columns: [{ key: "assignee_id", label: "Responsável", type: "member" }, { key: "category", label: "Categoria", type: "badge" }],
    emptyTitle: "Nenhuma responsabilidade", emptyText: "Distribua as atividades da casa entre os integrantes e crie escalas.",
  },
  {
    id: "pantry", entity: "pantry", label: "Despensa", singular: "Produto", icon: "Package", workspaces: ["family"], area: "home", group: "Casa e rotina",
    description: "Produtos, quantidades, validade e avisos de vencimento.",
    fields: [title("Produto"), { key: "amount", label: "Quantidade", type: "number", min: 0, step: 0.1 }, { key: "data.unit", label: "Unidade", type: "text" }, { key: "data.min_qty", label: "Estoque mínimo", type: "number", min: 0 }, { key: "date_end", label: "Validade", type: "date" }, category(), { key: "body", label: "Local", type: "text" }],
    columns: [{ key: "amount", label: "Qtd.", type: "number" }, { key: "date_end", label: "Validade", type: "date" }, { key: "category", label: "Categoria", type: "badge" }],
    sort: "date_end ASC", emptyTitle: "Despensa vazia", emptyText: "Cadastre produtos para controlar estoque e validade.",
  },
  {
    id: "inventory", entity: "inventory", label: "Inventário", singular: "Objeto", icon: "Boxes", workspaces: ["family"], area: "home", group: "Casa e rotina",
    description: "Objetos da casa com fotos, localização, quantidade e categoria.",
    fields: [title("Objeto"), { key: "amount", label: "Quantidade", type: "number", min: 0 }, { key: "data.location", label: "Localização", type: "text" }, category(), notesField("body", "Descrição")],
    columns: [{ key: "data.location", label: "Local" }, { key: "amount", label: "Qtd.", type: "number" }, { key: "category", label: "Categoria", type: "badge" }],
    attachments: true, views: ["list", "cards"], emptyTitle: "Inventário vazio", emptyText: "Registre objetos e onde estão guardados.",
  },
  {
    id: "menu", entity: "menu", label: "Cardápio", singular: "Refeição", icon: "UtensilsCrossed", workspaces: ["family"], area: "home", group: "Casa e rotina",
    description: "Cardápio semanal com receitas e geração da lista de ingredientes.",
    fields: [title("Refeição"), { key: "date_start", label: "Dia", type: "date", required: true }, { key: "category", label: "Tipo", type: "select", options: MEAL }, { key: "ref_id", label: "Receita", type: "ref", ref: "recipes" }, { key: "data.servings", label: "Porções", type: "number", min: 1 }, notesField("body")],
    columns: [{ key: "date_start", label: "Dia", type: "date" }, { key: "category", label: "Tipo", type: "badge", options: MEAL }], sort: "date_start ASC",
    defaults: () => ({ date_start: today(), category: "almoco" }), emptyTitle: "Cardápio vazio", emptyText: "Planeje as refeições da semana e gere a lista de ingredientes.",
  },
  {
    id: "maintenance", entity: "maintenance", label: "Manutenção da casa", singular: "Equipamento", icon: "Wrench", workspaces: ["family"], area: "home", group: "Casa e rotina",
    description: "Equipamentos, manutenções realizadas, próximas datas e documentos.",
    fields: [title("Equipamento"), category(), { key: "data.brand", label: "Marca/modelo", type: "text" }, { key: "date_start", label: "Última manutenção", type: "date" }, { key: "date_end", label: "Próxima manutenção", type: "date" }, { key: "data.interval_months", label: "Intervalo (meses)", type: "number", min: 0 }, notesField("body")],
    columns: [{ key: "date_end", label: "Próxima", type: "date" }, { key: "category", label: "Categoria", type: "badge" }],
    children: [{ entity: "maintenance_log", label: "Manutenções realizadas", parentKey: "parent_id", fields: [title("Serviço"), { key: "date_start", label: "Data", type: "date" }, { key: "amount", label: "Custo", type: "money" }, notesField("body")], subtitle: (r) => [r.date_start?.split("-").reverse().join("/"), r.amount ? `R$ ${Number(r.amount).toFixed(2).replace(".", ",")}` : ""].filter(Boolean).join(" · ") }],
    attachments: true, emptyTitle: "Nenhum equipamento", emptyText: "Cadastre equipamentos e acompanhe as manutenções.",
  },
  {
    id: "family_event", entity: "family_event", label: "Eventos", singular: "Evento", icon: "PartyPopper", workspaces: ["family"], area: "memories", group: "Convivência",
    description: "Festas e encontros com participantes, local e preparativos.",
    fields: [title("Evento"), { key: "date_start", label: "Data e hora", type: "datetime", required: true }, { key: "data.location", label: "Local", type: "text" }, { key: "data.participants", label: "Participantes", type: "members", full: true }, { key: "data.guests", label: "Convidados externos", type: "stringlist", full: true }, notesField("body", "Descrição")],
    columns: [{ key: "date_start", label: "Quando", type: "datetime" }, { key: "data.location", label: "Local" }, { key: "children_total", label: "Preparativos", type: "number" }],
    children: [{ entity: "event_task", label: "Preparativos", parentKey: "parent_id", doneKey: "status", doneValue: "concluido", undoneValue: "pendente", fields: [title("Preparativo"), { key: "assignee_id", label: "Responsável", type: "member" }], subtitle: (r) => r.assignee_name }],
    attachments: true, sort: "date_start ASC", emptyTitle: "Nenhum evento", emptyText: "Organize festas e encontros com checklist de preparativos.",
  },
  {
    id: "birthday", entity: "birthday", label: "Aniversários", singular: "Aniversário", icon: "Cake", workspaces: ["family"], area: "memories", group: "Convivência",
    description: "Aniversários e datas importantes com lembretes.",
    fields: [title("Nome"), { key: "date_start", label: "Data de nascimento / data", type: "date", required: true }, { key: "category", label: "Tipo", type: "select", options: o(["aniversario", "Aniversário"], ["casamento", "Casamento"], ["data_especial", "Data especial"]) }, notesField("body", "Ideias de presente / observações")],
    columns: [{ key: "date_start", label: "Data", type: "date" }, { key: "category", label: "Tipo", type: "badge" }], defaults: { category: "aniversario" },
    emptyTitle: "Nenhum aniversário", emptyText: "Cadastre aniversários para receber lembretes.",
  },
  {
    id: "board_post", entity: "board_post", label: "Mural", singular: "Publicação", icon: "Megaphone", workspaces: ["family"], area: "social", group: "Convivência",
    description: "Comunicados e avisos da família, com fixação.",
    fields: [title("Título"), { key: "body", label: "Mensagem", type: "textarea", full: true }, { key: "priority", label: "Fixar no topo", type: "select", options: o(["0", "Não"], ["1", "Sim"]) }, { key: "category", label: "Tipo", type: "select", options: o(["aviso", "Aviso"], ["comunicado", "Comunicado"], ["lembrete", "Lembrete"]) }],
    columns: [{ key: "owner_id", label: "Autor", type: "member" }, { key: "created_at", label: "Data", type: "datetime" }], sort: "priority DESC, created_at DESC",
    views: ["cards", "list"], defaults: { priority: 0, category: "aviso" }, emptyTitle: "Mural vazio", emptyText: "Publique avisos e comunicados para a família.",
  },
  {
    id: "conversation", entity: "conversation", label: "Mensagens", singular: "Conversa", icon: "MessageCircle", workspaces: ["family"], area: "social", group: "Convivência",
    description: "Mensagens locais entre os perfis desta instalação (sem envio pela internet).",
    fields: [title("Assunto da conversa")], columns: [{ key: "children_total", label: "Mensagens", type: "number" }, { key: "updated_at", label: "Atualizada", type: "datetime" }],
    emptyTitle: "Nenhuma conversa", emptyText: "As mensagens ficam disponíveis apenas nos perfis deste computador.",
  },
  {
    id: "poll", entity: "poll", label: "Votações", singular: "Votação", icon: "Vote", workspaces: ["family"], area: "social", group: "Convivência",
    description: "Votações com opções, encerramento e resultados.",
    fields: [title("Pergunta"), { key: "data.options", label: "Opções", type: "options", full: true, required: true }, { key: "data.multiple", label: "Permitir várias escolhas", type: "checkbox" }, { key: "date_end", label: "Encerramento", type: "datetime" }, { key: "status", label: "Situação", type: "select", options: o(["aberta", "Aberta"], ["encerrada", "Encerrada"]) }, notesField("body", "Detalhes")],
    columns: [{ key: "voters", label: "Votantes", type: "number" }, { key: "date_end", label: "Encerra", type: "datetime" }, { key: "status", label: "Situação", type: "badge" }],
    defaults: { status: "aberta", data: { options: [{ text: "" }, { text: "" }] } }, emptyTitle: "Nenhuma votação", emptyText: "Decida em família: crie votações com opções e prazo.",
  },
  {
    id: "trip", entity: "trip", label: "Viagens e passeios", singular: "Viagem", icon: "Plane", workspaces: ["family"], area: "goals", group: "Convivência",
    description: "Planejamento com destinos, datas, participantes, custos estimados e checklist.",
    fields: [title("Viagem/passeio"), { key: "date_start", label: "Ida", type: "date" }, { key: "date_end", label: "Volta", type: "date" }, { key: "data.destinations", label: "Destinos", type: "stringlist", full: true }, { key: "data.participants", label: "Participantes", type: "members", full: true }, { key: "amount", label: "Custo estimado", type: "money" }, { key: "data.checklist", label: "Checklist", type: "checklist", full: true }, { key: "status", label: "Situação", type: "select", options: o(["planejando", "Planejando"], ["confirmada", "Confirmada"], ["realizada", "Realizada"]) }, notesField("body")],
    columns: [{ key: "date_start", label: "Ida", type: "date" }, { key: "amount", label: "Estimado", type: "money" }, { key: "status", label: "Situação", type: "badge" }],
    attachments: true, defaults: { status: "planejando" }, emptyTitle: "Nenhuma viagem", emptyText: "Planeje passeios e viagens em família.",
  },
  {
    id: "album", entity: "album", label: "Álbum de fotos", singular: "Álbum", icon: "Image", workspaces: ["family"], area: "memories", group: "Memórias",
    description: "Álbuns com fotos locais, legendas, datas e controle de acesso.",
    fields: [title("Álbum"), { key: "date_start", label: "Data", type: "date" }, { key: "restricted_to", label: "Visível apenas para", type: "restricted", full: true, hint: "Vazio = toda a família" }, notesField("body", "Descrição")],
    columns: [{ key: "children_total", label: "Fotos", type: "number" }, { key: "date_start", label: "Data", type: "date" }], views: ["cards", "list"],
    emptyTitle: "Nenhum álbum", emptyText: "Crie álbuns e importe fotos do computador.",
  },
  {
    id: "memory", entity: "memory", label: "Memórias", singular: "Memória", icon: "Star", workspaces: ["family"], area: "memories", group: "Memórias",
    description: "Acontecimentos marcantes com imagens, datas e categorias.",
    fields: [title("Acontecimento"), { key: "date_start", label: "Data", type: "date" }, category(), { key: "body", label: "Relato", type: "textarea", full: true }],
    columns: [{ key: "date_start", label: "Data", type: "date" }, { key: "category", label: "Categoria", type: "badge" }], sort: "date_start DESC", attachments: true, views: ["cards", "list"],
    emptyTitle: "Nenhuma memória", emptyText: "Registre acontecimentos especiais da família.",
  },
  {
    id: "person", entity: "person", label: "Árvore genealógica", singular: "Pessoa", icon: "GitFork", workspaces: ["family"], area: "memories", group: "Memórias",
    description: "Integrantes, relações familiares e gerações.",
    fields: [title("Nome completo"), { key: "date_start", label: "Nascimento", type: "date" }, { key: "date_end", label: "Falecimento", type: "date" }, { key: "data.gender", label: "Gênero", type: "select", options: o(["", "—"], ["feminino", "Feminino"], ["masculino", "Masculino"], ["outro", "Outro"]) },
      { key: "data.parent1", label: "Mãe/pai (1)", type: "ref", ref: "person" }, { key: "data.parent2", label: "Mãe/pai (2)", type: "ref", ref: "person" }, { key: "data.spouse", label: "Cônjuge", type: "ref", ref: "person" }, notesField("body", "Biografia")],
    columns: [{ key: "date_start", label: "Nascimento", type: "date" }], emptyTitle: "Árvore vazia", emptyText: "Cadastre pessoas e relações para visualizar a árvore da família.",
  },
];

export function getModule(id: string): ModuleDef | undefined {
  return MODULES.find((m) => m.id === id);
}

export function modulesFor(ws: "personal" | "family"): ModuleDef[] {
  return MODULES.filter((m) => m.workspaces.includes(ws) && !m.hidden);
}
