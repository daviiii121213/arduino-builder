// Campo de formulário conforme o tipo definido no registro de módulos.
import { useEffect, useState } from "react";
import type { FieldDef, Rec } from "./types";
import type { Workspace } from "../contexts/app";
import { listAll, useMembers } from "../hooks/data";
import { ColorPicker } from "../components/ui";
import { Icon } from "../components/Icon";
import { PRIORITY } from "./registry";
import { weekdayShort } from "../utils/format";

interface Props {
  f: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  ws: Workspace;
  id: string;
  invalid?: boolean;
  excludeId?: string;
}

function RefSelect({ f, value, onChange, ws, id, excludeId }: Props) {
  const [opts, setOpts] = useState<Rec[]>([]);
  useEffect(() => {
    const scope = ["projects", "study_subject", "health_professional"].includes(f.ref!) ? "personal" : ws;
    listAll(f.ref!, scope, f.refFilters ? { filters: f.refFilters } : {}).then(setOpts).catch(() => setOpts([]));
  }, [f.ref, ws, f.refFilters]);
  return (
    <select id={id} className="input" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— Nenhum —</option>
      {opts.filter((o) => o.id !== excludeId).map((o) => (
        <option key={o.id} value={o.id}>{o.title}</option>
      ))}
    </select>
  );
}

function StringList({ value, onChange, placeholder }: { value: unknown; onChange: (v: unknown) => void; placeholder?: string }) {
  const list = Array.isArray(value) ? (value as string[]) : [];
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...list, t]);
    setDraft("");
  };
  return (
    <div className="col">
      {list.map((s, i) => (
        <div key={i} className="row">
          <input className="input" value={s} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Item ${i + 1}`} />
          <button type="button" className="btn icon sm ghost" aria-label="Remover item" onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="X" size={15} /></button>
        </div>
      ))}
      <div className="row">
        <input className="input" value={draft} placeholder={placeholder ?? "Adicionar item"} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} aria-label="Novo item" />
        <button type="button" className="btn sm" onClick={add}><Icon name="Plus" size={15} /> Adicionar</button>
      </div>
    </div>
  );
}

function Checklist({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const list = Array.isArray(value) ? (value as Array<{ text: string; done?: boolean }>) : [];
  const [draft, setDraft] = useState("");
  return (
    <div className="col">
      {list.map((it, i) => (
        <div key={i} className="row">
          <input type="checkbox" checked={!!it.done} aria-label={`Concluir ${it.text}`} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
          <input className="input" value={it.text} onChange={(e) => onChange(list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label={`Item ${i + 1}`} />
          <button type="button" className="btn icon sm ghost" aria-label="Remover" onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="X" size={15} /></button>
        </div>
      ))}
      <div className="row">
        <input className="input" value={draft} placeholder="Novo item do checklist" onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) { e.preventDefault(); onChange([...list, { text: draft.trim(), done: false }]); setDraft(""); } }} aria-label="Novo item do checklist" />
        <button type="button" className="btn sm" onClick={() => { if (draft.trim()) { onChange([...list, { text: draft.trim(), done: false }]); setDraft(""); } }}><Icon name="Plus" size={15} /> Adicionar</button>
      </div>
    </div>
  );
}

function Ingredients({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const list = Array.isArray(value) ? (value as Array<{ name: string; quantity?: number | string; unit?: string }>) : [];
  const upd = (i: number, k: string, v: string) => onChange(list.map((x, j) => (j === i ? { ...x, [k]: k === "quantity" ? (v === "" ? "" : Number(v.replace(",", "."))) : v } : x)));
  return (
    <div className="col">
      {list.map((it, i) => (
        <div key={i} className="row">
          <input className="input" style={{ width: 90 }} type="number" step="0.01" min="0" value={it.quantity ?? ""} onChange={(e) => upd(i, "quantity", e.target.value)} aria-label="Quantidade" placeholder="Qtd." />
          <input className="input" style={{ width: 80 }} value={it.unit ?? ""} onChange={(e) => upd(i, "unit", e.target.value)} aria-label="Unidade" placeholder="un" />
          <input className="input" value={it.name} onChange={(e) => upd(i, "name", e.target.value)} aria-label="Ingrediente" placeholder="Ingrediente" />
          <button type="button" className="btn icon sm ghost" aria-label="Remover ingrediente" onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="X" size={15} /></button>
        </div>
      ))}
      <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...list, { name: "", quantity: "", unit: "" }])}><Icon name="Plus" size={15} /> Ingrediente</button>
    </div>
  );
}

function PollOptions({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const list = Array.isArray(value) ? (value as Array<{ text: string }>) : [];
  return (
    <div className="col">
      {list.map((it, i) => (
        <div key={i} className="row">
          <span className="badge">{i + 1}</span>
          <input className="input" value={it.text} onChange={(e) => onChange(list.map((x, j) => (j === i ? { text: e.target.value } : x)))} aria-label={`Opção ${i + 1}`} placeholder={`Opção ${i + 1}`} />
          {list.length > 2 && <button type="button" className="btn icon sm ghost" aria-label="Remover opção" onClick={() => onChange(list.filter((_, j) => j !== i))}><Icon name="X" size={15} /></button>}
        </div>
      ))}
      {list.length < 12 && <button type="button" className="btn sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...list, { text: "" }])}><Icon name="Plus" size={15} /> Opção</button>}
    </div>
  );
}

function MembersMulti({ value, onChange, ws }: { value: unknown; onChange: (v: unknown) => void; ws: Workspace }) {
  const members = useMembers(ws);
  const list = Array.isArray(value) ? (value as string[]) : [];
  if (!members.length) return <span className="muted small">Nenhum integrante disponível.</span>;
  return (
    <div className="row wrap" role="group">
      {members.map((m) => (
        <label key={m.id} className="check badge" style={{ padding: "5px 10px" }}>
          <input type="checkbox" checked={list.includes(m.id)} onChange={(e) => onChange(e.target.checked ? [...list, m.id] : list.filter((x) => x !== m.id))} />
          {m.full_name}
        </label>
      ))}
    </div>
  );
}

export function FieldInput(p: Props) {
  const { f, value, onChange, ws, id, invalid } = p;
  const members = useMembers(f.type === "member" ? ws : "personal");
  const common = { id, "aria-invalid": invalid || undefined, "aria-required": f.required || undefined };
  const str = value === null || value === undefined ? "" : String(value);
  switch (f.type) {
    case "textarea":
      return <textarea className="input" {...common} value={str} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} rows={f.key === "body" || f.key === "content" ? 8 : 4} />;
    case "number":
    case "money":
      return (
        <input className="input" type="number" inputMode="decimal" {...common} value={str} min={f.min} max={f.max} step={f.type === "money" ? 0.01 : f.step ?? 1}
          placeholder={f.type === "money" ? "0,00" : f.placeholder} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
      );
    case "date":
      return <input className="input" type="date" {...common} value={str.slice(0, 10)} onChange={(e) => onChange(e.target.value || null)} />;
    case "datetime":
      return <input className="input" type="datetime-local" {...common} value={str.slice(0, 16)} onChange={(e) => onChange(e.target.value || null)} />;
    case "datetext": {
      const d = str.slice(0, 10);
      const t = str.length > 10 ? str.slice(11, 16) : "";
      return (
        <div className="row">
          <input className="input" type="date" {...common} value={d} onChange={(e) => onChange(e.target.value ? (t ? `${e.target.value}T${t}` : e.target.value) : null)} />
          <input className="input" type="time" aria-label={`${f.label} (horário)`} style={{ width: 130 }} value={t} disabled={!d} onChange={(e) => onChange(e.target.value ? `${d}T${e.target.value}` : d)} />
        </div>
      );
    }
    case "time":
      return <input className="input" type="time" {...common} value={str} onChange={(e) => onChange(e.target.value || null)} />;
    case "select":
      return (
        <select className="input" {...common} value={str} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
          {!f.options?.some((o) => o.value === "") && !f.required && <option value="">—</option>}
          {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "priority":
      return (
        <select className="input" {...common} value={str || "1"} onChange={(e) => onChange(Number(e.target.value))}>
          {PRIORITY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case "rating":
      return (
        <div className="row" role="radiogroup" aria-label={f.label}>
          {[1, 2, 3].map((n) => (
            <button type="button" key={n} className="btn icon sm ghost" role="radio" aria-checked={Number(value) >= n} aria-label={`${n} de 3`} onClick={() => onChange(Number(value) === n ? 0 : n)}>
              <Icon name="Star" size={18} fill={Number(value) >= n ? "currentColor" : "none"} style={{ color: "var(--warning)" }} />
            </button>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="check" style={{ height: "var(--control-h)" }}>
          <input type="checkbox" id={id} checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {value ? "Sim" : "Não"}
        </label>
      );
    case "color":
      return <ColorPicker value={str} onChange={onChange} label={f.label} />;
    case "member":
      return (
        <select className="input" {...common} value={str} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">— Ninguém —</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      );
    case "members":
    case "restricted":
      return <MembersMulti value={value} onChange={onChange} ws={ws} />;
    case "ref":
      return <RefSelect {...p} />;
    case "tags":
      return <input className="input" {...common} value={str} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "stringlist":
      return <StringList value={value} onChange={onChange} placeholder={f.placeholder} />;
    case "checklist":
      return <Checklist value={value} onChange={onChange} />;
    case "ingredients":
      return <Ingredients value={value} onChange={onChange} />;
    case "options":
      return <PollOptions value={value} onChange={onChange} />;
    case "weekdays": {
      const list = Array.isArray(value) ? (value as number[]) : [];
      return (
        <div className="row wrap" role="group" aria-label={f.label}>
          {weekdayShort.map((w, i) => (
            <label key={i} className="check badge" style={{ padding: "5px 10px" }}>
              <input type="checkbox" checked={list.includes(i)} onChange={(e) => onChange(e.target.checked ? [...list, i].sort() : list.filter((x) => x !== i))} /> {w}
            </label>
          ))}
        </div>
      );
    }
    default:
      return <input className="input" {...common} value={str} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} maxLength={200} />;
  }
}
