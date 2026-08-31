/**
 * How hard the AI races. The setting scales the opponents' skill, not the
 * player's car, so the same lap time means the same thing on every level.
 */

export type DifficultyId = 'easy' | 'normal' | 'hard';

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

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'easy', pace: 0.84, reaction: 0.85, wobble: 1.9, nitroReserve: 0.65 },
  { id: 'normal', pace: 1, reaction: 1, wobble: 1, nitroReserve: 0.35 },
  { id: 'hard', pace: 1.1, reaction: 1.15, wobble: 0.45, nitroReserve: 0.2 },
];

export const DEFAULT_DIFFICULTY = 1;

export function difficultyAt(index: number): DifficultyDef {
  return DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, index))];
}

/** Field sizes the player can pick: one to five opponents. */
export const MIN_OPPONENTS = 1;
export const MAX_OPPONENTS = 5;
export const DEFAULT_OPPONENTS = 5;
