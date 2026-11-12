// Formulário genérico de criação/edição com validação, mensagens por campo e Ctrl+S.
import { useEffect, useMemo, useRef, useState } from "react";
import { call, ApiError } from "../api/client";
import { useApp, type Workspace } from "../contexts/app";
import { Field, Modal } from "../components/ui";
import { FieldInput } from "./FieldInput";
import { getVal } from "../hooks/data";
import { addNavigationGuard } from "../hooks/router";
import type { FieldDef, Rec } from "./types";

interface Props {
  entity: string;
  title: string;
  fields: FieldDef[];
  ws: Workspace;
  record?: Rec | null;
  defaults?: Rec;
  parent?: { key: string; id: string };
  onClose: () => void;
  onSaved: (r: Rec) => void;
}

const DATA_ENTITIES = new Set(["subtasks", "project_steps", "goal_milestones", "shopping_items"]);

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);
}

export function buildValues(entity: string, fields: FieldDef[], form: Rec, record?: Rec | null): Rec {
  const values: Rec = {};
  const data: Rec = { ...(record?.data ?? {}) };
  let hasData = false;
  for (const f of fields) {
    let v = form[f.key];
    if (typeof v === "string") v = v.trim();
    if (f.type === "options" && Array.isArray(v)) v = (v as Rec[]).filter((o) => String(o.text ?? "").trim()).map((o) => ({ text: String(o.text).trim() }));
    if (f.type === "ingredients" && Array.isArray(v)) v = (v as Rec[]).filter((o) => String(o.name ?? "").trim());
    if (f.type === "stringlist" && Array.isArray(v)) v = (v as string[]).map((s) => s.trim()).filter(Boolean);
    if (v === "" || v === undefined) v = null;
    if (f.key.startsWith("data.")) {
      data[f.key.slice(5)] = v;
      hasData = true;
    } else {
      values[f.key] = v;
    }
  }
  if (hasData && !DATA_ENTITIES.has(entity)) values.data = data;
  return values;
}

export function RecordForm({ entity, title, fields, ws, record, defaults, parent, onClose, onSaved }: Props) {
  const { toast, confirm } = useApp();
  const visible = useMemo(() => fields.filter((f) => !f.workspaces || f.workspaces.includes(ws)), [fields, ws]);
  const initial = useMemo(() => {
    const r: Rec = {};
    for (const f of visible) {
      const v = record ? getVal(record, f.key) : getVal(defaults, f.key);
      r[f.key] = v ?? (f.type === "checkbox" ? false : f.type === "priority" ? 1 : null);
      if (f.type === "options" && !Array.isArray(r[f.key])) r[f.key] = [{ text: "" }, { text: "" }];
    }
    return r;
  }, [visible, record, defaults]);
  const [form, setForm] = useState<Rec>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => addNavigationGuard(() => !dirtyRef.current || window.confirm("Há alterações não salvas. Deseja sair mesmo assim?")), []);

  const close = async () => {
    if (dirty && !(await confirm({ title: "Descartar alterações?", message: "As alterações feitas neste formulário serão perdidas.", confirmLabel: "Descartar", danger: true }))) return;
    onClose();
  };

  const save = async () => {
    if (saving) return;
    const errs: Record<string, string> = {};
    for (const f of visible) {
      if (f.showIf && !f.showIf(form)) continue;
      if (f.required && isEmpty(form[f.key])) errs[f.key] = `${f.label} é obrigatório.`;
      if (f.type === "options" && f.required && Array.isArray(form[f.key]) && (form[f.key] as Rec[]).filter((o) => String(o.text ?? "").trim()).length < 2) errs[f.key] = "Informe ao menos duas opções.";
    }
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`f-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setSaving(true);
    setGeneralError(null);
    try {
      const shown = visible.filter((f) => !f.showIf || f.showIf(form));
      const values = buildValues(entity, shown, form, record);
      if (parent) values[parent.key] = parent.id;
      const r = record
        ? await call<Rec>("rec.update", { entity, id: record.id, values })
        : await call<Rec>("rec.create", { entity, scope: ws, values });
      dirtyRef.current = false;
      toast(record ? "Alterações salvas." : "Registro criado.");
      onSaved(r);
    } catch (e) {
      const err = e as ApiError;
      const key = visible.find((f) => f.key === err.field || f.key === `data.${err.field}`)?.key;
      if (key) {
        setErrors({ [key]: err.message });
        document.getElementById(`f-${key}`)?.focus();
      } else setGeneralError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={title} onClose={close} size={visible.length > 8 ? "lg" : undefined}
      footer={
        <>
          <span className="muted tiny grow">Campos com <span style={{ color: "var(--danger)" }}>*</span> são obrigatórios · <span className="kbd">Ctrl</span>+<span className="kbd">S</span> salva</span>
          <button className="btn" onClick={close}>Cancelar</button>
          <button className="btn primary" onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</button>
        </>
      }>
      <form
        className="form-grid"
        onSubmit={(e) => { e.preventDefault(); save(); }}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); e.stopPropagation(); save(); } }}
        noValidate
      >
        {generalError && <div className="alert danger full" role="alert">{generalError}</div>}
        {visible.filter((f) => !f.showIf || f.showIf(form)).map((f) => (
          <Field key={f.key} label={f.label} required={f.required} error={errors[f.key]} hint={f.hint} full={f.full || ["textarea", "stringlist", "checklist", "ingredients", "options", "members", "restricted", "weekdays"].includes(f.type)} htmlFor={`f-${f.key}`}>
            <FieldInput f={f} ws={ws} id={`f-${f.key}`} value={form[f.key]} invalid={!!errors[f.key]} excludeId={record?.id}
              onChange={(v) => { setForm((s) => ({ ...s, [f.key]: v })); if (errors[f.key]) setErrors((x) => { const n = { ...x }; delete n[f.key]; return n; }); }} />
          </Field>
        ))}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
