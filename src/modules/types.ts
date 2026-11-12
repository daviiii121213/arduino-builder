import type { ComponentType, ReactNode } from "react";
import type { IconName } from "../components/Icon";
import type { Workspace } from "../contexts/app";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Rec = Record<string, any>;

export type FieldType =
  | "text" | "textarea" | "number" | "money" | "date" | "datetime" | "time" | "select" | "priority" | "checkbox"
  | "color" | "member" | "members" | "ref" | "tags" | "stringlist" | "checklist" | "ingredients" | "options"
  | "restricted" | "weekdays" | "rating" | "datetext";

export interface Opt {
  value: string;
  label: string;
}

export interface FieldDef {
  /** Coluna da entidade ou "data.chave" para campos extras guardados em JSON. */
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: Opt[];
  /** Para type "ref": entidade relacionada. */
  ref?: string;
  refFilters?: Rec;
  placeholder?: string;
  hint?: string;
  full?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** Mostrar apenas nesses ambientes. */
  workspaces?: Workspace[];
  showIf?: (values: Rec) => boolean;
}

export type ColumnType = "text" | "date" | "datetime" | "money" | "badge" | "progress" | "bool" | "member" | "priority" | "number" | "rating";

export interface ColumnDef {
  key: string;
  label: string;
  type?: ColumnType;
  options?: Opt[];
  render?: (r: Rec) => ReactNode;
}

export interface ChildDef {
  entity: string;
  label: string;
  parentKey: string;
  /** Campo booleano/estado usado como "concluído" na lista de verificação. */
  doneKey?: string;
  doneValue?: string | boolean;
  undoneValue?: string | boolean;
  fields: FieldDef[];
  /** Descrição curta sob o título do item. */
  subtitle?: (r: Rec) => ReactNode;
}

export interface ModuleViewProps {
  mod: ModuleDef;
  ws: Workspace;
}

export interface DetailProps {
  mod: ModuleDef;
  ws: Workspace;
  record: Rec;
  reload: () => void;
}

export interface ModuleDef {
  id: string;
  entity: string;
  label: string;
  singular: string;
  icon: IconName;
  workspaces: Workspace[];
  /** Área de permissões no ambiente FAMÍLIA. */
  area: string;
  group: string;
  description: string;
  fields: FieldDef[];
  columns: ColumnDef[];
  filters?: Array<{ key: string; label: string; options: Opt[] }>;
  views?: Array<"list" | "cards" | "board">;
  board?: { key: string; columns: Opt[] };
  children?: ChildDef[];
  /** Seção extra no painel de detalhes. */
  detail?: ComponentType<DetailProps>;
  /** Substitui a listagem padrão. */
  view?: ComponentType<ModuleViewProps>;
  /** Componente acima da listagem padrão (resumos, timers). */
  header?: ComponentType<ModuleViewProps>;
  shareable?: boolean;
  attachments?: boolean;
  /** Histórico cronológico (record_logs) exibido no detalhe. */
  logs?: { label: string; kind: string; valueLabel?: string; noteLabel?: string };
  defaults?: Rec | (() => Rec);
  sort?: string;
  baseFilters?: Rec;
  emptyTitle?: string;
  emptyText?: string;
  newLabel?: string;
  /** Exige confirmação de senha ao abrir (Diário). */
  protected?: boolean;
  hidden?: boolean;
}
