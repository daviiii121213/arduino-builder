// Utilitários das visões familiares.
import { useEffect, useState } from "react";
import type { Workspace } from "../../contexts/app";
import { RecordDrawer } from "../ModulePage";
import { RecordForm } from "../RecordForm";
import type { ModuleDef, Rec } from "../types";

/** Recarrega quando qualquer registro é salvo pelo botão do cabeçalho do módulo. */
export function useChangedSignal(reload: () => void) {
  useEffect(() => {
    window.addEventListener("plu:changed", reload);
    return () => window.removeEventListener("plu:changed", reload);
  }, [reload]);
}

/** Drawer de detalhes + formulário de edição/criação para visões personalizadas. */
export function useRecordUi(mod: ModuleDef, ws: Workspace, reload: () => void) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ record: Rec | null; defaults?: Rec } | null>(null);
  const ui = (
    <>
      {openId && <RecordDrawer mod={mod} ws={ws} id={openId} onClose={() => setOpenId(null)} onChanged={reload} onEdit={(r) => setForm({ record: r })} />}
      {form && (
        <RecordForm entity={mod.entity} title={form.record ? `Editar ${mod.singular.toLowerCase()}` : `Adicionar ${mod.singular.toLowerCase()}`} fields={mod.fields} ws={ws}
          record={form.record} defaults={form.defaults ?? (typeof mod.defaults === "function" ? mod.defaults() : mod.defaults)}
          onClose={() => setForm(null)} onSaved={(r) => { const wasEdit = !!form.record; setForm(null); reload(); if (wasEdit) { setOpenId(null); setTimeout(() => setOpenId(r.id), 0); } }} />
      )}
    </>
  );
  return { ui, open: setOpenId, create: (defaults?: Rec) => setForm({ record: null, defaults }), edit: (r: Rec) => setForm({ record: r }) };
}

export function weekIndex(d: Date): number {
  const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  // semanas iniciando na segunda-feira (1970-01-05 foi segunda)
  return Math.floor((utc / 86400000 - 4) / 7);
}
