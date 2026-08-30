import { createDefaultGameState, type GameState } from './gameState';

const SAVE_KEY = 'corrida_turbo_save_v1';

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createDefaultGameState();
    const parsed = JSON.parse(raw);
    const base = createDefaultGameState();
    return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } };
  } catch {
    return createDefaultGameState();
  }
}

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // localStorage indisponível (modo privado, quota excedida) — ignora silenciosamente
  }
}

export function resetGame(): GameState {
  localStorage.removeItem(SAVE_KEY);
  return createDefaultGameState();
}
