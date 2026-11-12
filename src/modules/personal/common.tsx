// Utilitários compartilhados pelas visões pessoais.
import { useEffect, useState } from "react";
import type { Workspace } from "../../contexts/app";
import { RecordDrawer } from "../ModulePage";
import { RecordForm } from "../RecordForm";
import type { ModuleDef, Rec } from "../types";

/** Lê/grava JSON no localStorage sem falhar quando o armazenamento estiver indisponível. */
export function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
export function saveLS(key: string, v: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* armazenamento indisponível */
  }
}
export function removeLS(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Recarrega quando qualquer registro é salvo em outro lugar (evento global). */
export function useChanged(fn: () => void) {
  useEffect(() => {
    window.addEventListener("plu:changed", fn);
    return () => window.removeEventListener("plu:changed", fn);
  }, [fn]);
}

/** Painel de detalhes + formulário de edição para visões personalizadas. */
export function useRecordPanels(mod: ModuleDef, ws: Workspace, onChanged: () => void) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Rec | null>(null);
  const panels = (
    <>
      {openId && <RecordDrawer mod={mod} ws={ws} id={openId} onClose={() => setOpenId(null)} onChanged={onChanged} onEdit={(r) => setEdit(r)} />}
      {edit && (
        <RecordForm entity={mod.entity} title={`Editar ${mod.singular.toLowerCase()}`} fields={mod.fields} ws={ws} record={edit}
          onClose={() => setEdit(null)} onSaved={(r) => { setEdit(null); onChanged(); setOpenId(null); setTimeout(() => setOpenId(r.id), 0); }} />
      )}
    </>
  );
  return { open: setOpenId, panels };
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "desativadas";
  } catch {
    return false;
  }
}
