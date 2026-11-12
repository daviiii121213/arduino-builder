// Roteador mínimo baseado em hash (#/caminho?param=valor), com histórico do navegador.
import { useSyncExternalStore } from "react";

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const h = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  return { path, parts: path.split("/").filter(Boolean), query: new URLSearchParams(qs || "") };
}

let current = parse();
const subs = new Set<() => void>();
window.addEventListener("hashchange", () => {
  current = parse();
  subs.forEach((s) => s());
});

/** Guardas de navegação (ex.: formulário com alterações não salvas). */
const guards = new Set<() => boolean>();
export function addNavigationGuard(g: () => boolean) {
  guards.add(g);
  return () => {
    guards.delete(g);
  };
}

export function navigate(to: string) {
  for (const g of guards) if (!g()) return;
  const target = to.startsWith("#") ? to : `#${to}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    () => current,
  );
}
