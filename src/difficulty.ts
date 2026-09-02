/**
 * How hard the AI races. The setting scales the opponents' skill, not the
 * player's car, so the same lap time means the same thing on every level.
 */

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'elite';

export interface DifficultyDef {
  id: DifficultyId;
  /** Multiplies how much of the corner limit the AI dares to use. */
  pace: number;
  /** Multiplies the steering gain, so a sharper driver holds a tighter line. */
  reaction: number;
  /** Multiplies how much the AI wanders off its chosen line. */
  wobble: number;
  /** Fraction of the tank an AI keeps in reserve before using nitro. */
  nitroReserve: number;
}

/**
 * The three levels a player can pick, plus the hidden one the championship's
 * final round runs. `elite` is deliberately absent from the picker.
 */
export const ALL_DIFFICULTIES: DifficultyDef[] = [
  { id: 'easy', pace: 0.84, reaction: 0.85, wobble: 1.9, nitroReserve: 0.65 },
  { id: 'normal', pace: 1, reaction: 1, wobble: 1, nitroReserve: 0.35 },
  { id: 'hard', pace: 1.1, reaction: 1.15, wobble: 0.45, nitroReserve: 0.2 },
  { id: 'elite', pace: 1.17, reaction: 1.3, wobble: 0.18, nitroReserve: 0.1 },
];

/** What the difficulty picker offers: never the hidden level. */
export const DIFFICULTIES: DifficultyDef[] = ALL_DIFFICULTIES.slice(0, 3);

export const DEFAULT_DIFFICULTY = 1;

export function difficultyAt(index: number): DifficultyDef {
  return DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, index))];
}

export function difficultyById(id: DifficultyId): DifficultyDef {
  return ALL_DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}

/**
 * How much racecraft the drivers bring: 0 is the everyday AI, 1 is the
 * championship field, which works the racing line, brakes on distance, defends
 * and passes, uses the tow and saves its nitro for the move.
 */
export const RACECRAFT_NORMAL = 0;
export const RACECRAFT_CHAMPIONSHIP = 1;

/** Field sizes the player can pick: one to five opponents. */
export const MIN_OPPONENTS = 1;
export const MAX_OPPONENTS = 5;
export const DEFAULT_OPPONENTS = 5;
