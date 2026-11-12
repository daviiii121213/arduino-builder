// Hooks de dados reutilizáveis.
import { useCallback, useEffect, useRef, useState } from "react";
import { call, ApiError } from "../api/client";
import type { Workspace } from "../contexts/app";
import type { Rec } from "../modules/types";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const s = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fn();
      if (s === seq.current) setData(r);
    } catch (e) {
      if (s === seq.current) setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      if (s === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { data, error, loading, reload: run, setData };
}

export interface Member {
  id: string;
  full_name: string;
  color?: string | null;
}

let membersCache: { at: number; items: Member[] } | null = null;
export function invalidateMembers() {
  membersCache = null;
}

export function useMembers(ws: Workspace): Member[] {
  const [items, setItems] = useState<Member[]>(membersCache?.items ?? []);
  useEffect(() => {
    if (ws !== "family") return;
    if (membersCache && Date.now() - membersCache.at < 30000) {
      setItems(membersCache.items);
      return;
    }
    call<{ items: Member[] }>("family.members").then((r) => {
      membersCache = { at: Date.now(), items: r.items };
      setItems(r.items);
    }).catch(() => setItems([]));
  }, [ws]);
  return items;
}

export async function listAll(entity: string, scope: Workspace, extra: Rec = {}): Promise<Rec[]> {
  const r = await call<{ items: Rec[] }>("rec.list", { entity, scope, page_size: 500, ...extra });
  return r.items;
}

/** Lê "data.x" ou coluna simples. */
export function getVal(r: Rec | null | undefined, key: string): unknown {
  if (!r) return undefined;
  if (key.startsWith("data.")) return r.data?.[key.slice(5)];
  return r[key];
}
