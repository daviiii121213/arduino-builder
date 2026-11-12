// Cliente da API do núcleo local.
// No aplicativo instalado, as chamadas vão para o backend Rust via IPC do Tauri.
// Em desenvolvimento/testes no navegador, vão para o servidor local plu-devserver
// (127.0.0.1), que executa exatamente o mesmo núcleo.

export class ApiError extends Error {
  code: string;
  field?: string;
  constructor(code: string, message: string, field?: string) {
    super(message);
    this.code = code;
    this.field = field;
  }
}

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
/** Versão web: o núcleo Rust roda no navegador via WebAssembly (dados guardados neste navegador). */
export const isWebDemo = !!import.meta.env.VITE_WEB_DEMO;

const DEV_URL = (import.meta.env.VITE_DEV_CORE_URL as string | undefined) ?? "http://127.0.0.1:1430";

type Listener = (e: ApiError) => void;
const listeners = new Set<Listener>();
/** Permite reagir globalmente a erros de sessão (ex.: perfil bloqueado). */
export function onApiError(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function toError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e && typeof e === "object" && "code" in e && "message" in e) {
    const o = e as { code: string; message: string; field?: string };
    return new ApiError(o.code, o.message, o.field);
  }
  if (typeof e === "string") return new ApiError("internal", e);
  return new ApiError("internal", "Não foi possível comunicar com o núcleo local do aplicativo.");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function call<T = any>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  try {
    if (isTauri) {
      const { invoke } = await import("@tauri-apps/api/core");
      return (await invoke("api", { cmd, args })) as T;
    }
    if (isWebDemo) {
      const { webCall } = await import("./webcore");
      return (await webCall(cmd, args)) as T;
    }
    if (!import.meta.env.DEV && !import.meta.env.VITE_ALLOW_DEV_CORE) {
      throw new ApiError("internal", "Este aplicativo deve ser executado pelo PERSONAL LIFE ULTRA instalado.");
    }
    const res = await fetch(DEV_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cmd, args }) });
    const json = await res.json();
    if (!json.ok) throw toError(json.error);
    return json.data as T;
  } catch (e) {
    const err = toError(e);
    if (err.code === "unauthenticated" || err.code === "locked") listeners.forEach((l) => l(err));
    throw err;
  }
}

/** Executa a rotina periódica do núcleo no modo de desenvolvimento (no app, roda no backend). */
export async function devTick(): Promise<void> {
  if (isTauri) return;
  if (isWebDemo) {
    const { webCall } = await import("./webcore");
    await webCall("__tick", {}).catch(() => {});
    return;
  }
  try {
    await fetch(DEV_URL, { method: "POST", body: JSON.stringify({ cmd: "__tick" }) });
  } catch {
    /* sem núcleo de desenvolvimento */
  }
}
