// Integrações com o sistema (diálogos de arquivo, abrir arquivos, notificações e
// inicialização com o Windows). Fora do Tauri usam alternativas simples para testes.
import { isTauri } from "./client";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export async function saveFileDialog(defaultName: string, filters: FileFilter[]): Promise<string | null> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    return (await save({ defaultPath: defaultName, filters })) ?? null;
  }
  const p = window.prompt("Caminho completo do arquivo a salvar:", `/tmp/${defaultName}`);
  return p && p.trim() ? p.trim() : null;
}

export async function openFileDialog(filters: FileFilter[], title = "Selecionar arquivo"): Promise<string | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ multiple: false, directory: false, filters, title });
    return typeof r === "string" ? r : null;
  }
  const p = window.prompt(`${title} — caminho completo:`);
  return p && p.trim() ? p.trim() : null;
}

export async function openFolderDialog(title = "Selecionar pasta"): Promise<string | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ multiple: false, directory: true, title });
    return typeof r === "string" ? r : null;
  }
  const p = window.prompt(`${title} — caminho completo:`);
  return p && p.trim() ? p.trim() : null;
}

/** Abre um arquivo local no aplicativo padrão do Windows. */
export async function openPath(path: string): Promise<boolean> {
  if (isTauri) {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(path);
    return true;
  }
  return false;
}

/** Mostra a pasta que contém o arquivo no Explorador. */
export async function revealPath(path: string): Promise<boolean> {
  if (isTauri) {
    const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
    await revealItemInDir(path);
    return true;
  }
  return false;
}

export async function showSystemNotification(title: string, body: string): Promise<void> {
  if (isTauri) {
    const n = await import("@tauri-apps/plugin-notification");
    let ok = await n.isPermissionGranted();
    if (!ok) ok = (await n.requestPermission()) === "granted";
    if (ok) n.sendNotification({ title, body });
  }
}

export async function autostartEnabled(): Promise<boolean | null> {
  if (!isTauri) return null;
  const a = await import("@tauri-apps/plugin-autostart");
  return a.isEnabled();
}

export async function setAutostart(on: boolean): Promise<void> {
  if (!isTauri) return;
  const a = await import("@tauri-apps/plugin-autostart");
  if (on) await a.enable();
  else await a.disable();
}

/** Informa ao backend se, ao fechar a janela, o app deve continuar na bandeja do sistema. */
export async function setCloseToTray(on: boolean): Promise<void> {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_close_to_tray", { enabled: on });
}
