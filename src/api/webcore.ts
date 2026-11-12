// Núcleo em WebAssembly para a versão web: mesmo código Rust e SQLite do aplicativo,
// executado no navegador. O banco é salvo no armazenamento local deste navegador.
import init, { call, export_db, init as initCore } from "../wasm-pkg/plu_wasm.js";
import wasmUrl from "../wasm-pkg/plu_wasm_bg.wasm?url";

const KEY = "plu-web-db-v1";
let ready: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function load(): Uint8Array | undefined {
  try {
    const b64 = localStorage.getItem(KEY);
    if (!b64) return undefined;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return undefined;
  }
}

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const bytes = export_db();
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      localStorage.setItem(KEY, btoa(bin));
    } catch {
      /* armazenamento indisponível ou cheio: os dados ficam só nesta sessão */
    }
  }, 300);
}

const READ_ONLY = /^(app\.status|auth\.profiles|auth\.me|auth\.context|settings\.get|family\.info|family\.members|schema|rec\.(list|get|trash|history)|log\.list|calendar\.range|finance\.summary|attach\.(list|data_url)|dashboard\.(get|data)|search\.history|notif\.list|auto\.(list|logs)|report\.(catalog|preview)|backup\.status|onboarding\.get|audit\.list)$/;

export async function webCall(cmd: string, args: Record<string, unknown>): Promise<unknown> {
  if (!ready) {
    ready = (async () => {
      await init({ module_or_path: wasmUrl });
      initCore(load());
    })();
  }
  await ready;
  const res = JSON.parse(call(cmd, JSON.stringify(args ?? {})));
  if (!READ_ONLY.test(cmd)) save();
  if (!res.ok) throw res.error;
  return res.data;
}

export function resetWebData() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignora */
  }
}
