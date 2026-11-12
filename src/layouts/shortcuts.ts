// Atalhos de teclado (personalizáveis em Configurações › Atalhos).
export interface ShortcutDef {
  action: string;
  label: string;
  combo: string;
  fixed?: boolean;
}

export const SHORTCUTS: ShortcutDef[] = [
  { action: "search", label: "Abrir pesquisa global", combo: "Ctrl+K" },
  { action: "new", label: "Criar novo registro no contexto atual", combo: "Ctrl+N" },
  { action: "save", label: "Salvar formulário", combo: "Ctrl+S", fixed: true },
  { action: "settings", label: "Abrir configurações", combo: "Ctrl+," },
  { action: "home", label: "Ir para o início", combo: "Alt+H" },
  { action: "workspace", label: "Alternar PESSOAL/FAMÍLIA", combo: "Alt+W" },
  { action: "sidebar", label: "Recolher/expandir menu lateral", combo: "Ctrl+B" },
  { action: "lock", label: "Bloquear perfil", combo: "Ctrl+L" },
  { action: "help", label: "Abrir Central de Ajuda", combo: "F1" },
  { action: "close", label: "Fechar janela ou modal", combo: "Esc", fixed: true },
];

export function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let k = e.key;
  if (k === " ") k = "Space";
  if (k.length === 1) k = k.toUpperCase();
  if (["Control", "Alt", "Shift", "Meta"].includes(k)) return parts.join("+");
  parts.push(k);
  return parts.join("+");
}

export function effectiveShortcuts(custom: Record<string, string> | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of SHORTCUTS) map[s.action] = (!s.fixed && custom?.[s.action]) || s.combo;
  return map;
}
