// Renderização de valores conforme o tipo de coluna.
import type { ReactNode } from "react";
import type { ColumnDef, Rec } from "./types";
import { getVal } from "../hooks/data";
import { fmtDate, fmtDateTime, money, num, relativeDay } from "../utils/format";
import { PriorityBadge, Progress } from "../components/ui";
import { Icon } from "../components/Icon";

export function cell(c: ColumnDef, r: Rec): ReactNode {
  if (c.render) return c.render(r);
  const v = getVal(r, c.key);
  if (v === null || v === undefined || v === "") {
    if (c.type === "progress") return <Progress value={0} />;
    return <span className="muted">—</span>;
  }
  switch (c.type) {
    case "date":
      return <span title={relativeDay(String(v))}>{fmtDate(String(v))}</span>;
    case "datetime":
      return fmtDateTime(String(v));
    case "money":
      return <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(Number(v))}</span>;
    case "number":
      return num(Number(v), 2);
    case "progress": {
      const p = Number(r.progress_auto ?? v);
      const val = c.key === "progress" && r.progress_auto !== undefined && Number(v) === 0 ? Number(r.progress_auto) : Number(v);
      return (
        <div className="row" style={{ minWidth: 120 }}>
          <div className="grow"><Progress value={val || p} /></div>
          <span className="tiny muted">{Math.round(val || p)}%</span>
        </div>
      );
    }
    case "bool":
      return v ? <span className="badge success"><Icon name="Check" size={12} /> Sim</span> : <span className="badge">Não</span>;
    case "priority":
      return <PriorityBadge value={Number(v)} />;
    case "member":
      return c.key === "owner_id" ? r.owner_name : r.assignee_name ?? "—";
    case "badge": {
      const label = c.options?.find((o) => o.value === String(v))?.label ?? String(v).replace(/_/g, " ");
      return <span className="badge">{label}</span>;
    }
    default:
      return String(v);
  }
}
