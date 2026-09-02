import type { DifficultyId } from './difficulty';
import type { WeatherId } from './weather';

/**
 * The championship: three rounds on the circuits the game already has, run
 * back to back, with points carried between them.
 */

/** Points for finishing 1st through 6th. */
export const POINTS = [10, 7, 5, 3, 2, 1];

export function pointsFor(position: number): number {
  return POINTS[position - 1] ?? 0;
}

export type RoundLabel = 'easy' | 'medium' | 'hard';

export interface RoundDef {
  /** Circuit id, from the existing three. */
  trackId: string;
  laps: number;
  /** The label shown to the player, which is also the AI's level. */
  label: RoundLabel;
  /** The level the AI actually races at; the last round runs the hidden one. */
  difficulty: DifficultyId;
  weather: WeatherId;
}

/**
 * Easy on the wide circuit, medium on the loose one, and the hard round on the
 * narrow mountain track in the dark. The last round's AI is the hidden level,
 * which is never offered on the single-race screen.
 */
export const ROUNDS: RoundDef[] = [
  { trackId: 'bayside', laps: 3, label: 'easy', difficulty: 'easy', weather: 'sunny' },
  { trackId: 'dustbowl', laps: 4, label: 'medium', difficulty: 'normal', weather: 'rain' },
  { trackId: 'serpentine', laps: 6, label: 'hard', difficulty: 'elite', weather: 'night' },
];

export interface Entrant {
  carIndex: number;
  name: string;
  isPlayer: boolean;
}

export interface Standing extends Entrant {
  /** Points scored across the rounds run so far. */
  points: number;
  /** Points from the round just finished, or 0 before any round. */
  lastPoints: number;
  /** Finishing position in the round just finished, or 0. */
  lastPosition: number;
  /** Championship position, 1-based. */
  place: number;
}

/** Running order of a championship: rounds completed, and points to date. */
export class Championship {
  /** Index of the round being raced, 0-based. */
  round = 0;
  /** How many rounds have been scored. */
  completed = 0;

  private totals = new Map<number, number>();
  private last = new Map<number, { points: number; position: number }>();
  private entrants: Entrant[] = [];

  constructor(readonly rounds: RoundDef[] = ROUNDS) {}

  get currentRound(): RoundDef {
    return this.rounds[Math.min(this.round, this.rounds.length - 1)];
  }

  get roundNumber(): number {
    return Math.min(this.round + 1, this.rounds.length);
  }

  get totalRounds(): number {
    return this.rounds.length;
  }

  /** True once every round has been scored. */
  get finished(): boolean {
    return this.completed >= this.rounds.length;
  }

  /** Points a driver has so far. */
  pointsOf(carIndex: number): number {
    return this.totals.get(carIndex) ?? 0;
  }

  /**
   * Scores a finished race. `order` is the field in finishing order, so the
   * first entry took the win.
   */
  scoreRace(order: Entrant[]): void {
    this.entrants = order.map((e) => ({ ...e }));
    this.last.clear();
    order.forEach((entrant, i) => {
      const position = i + 1;
      const points = pointsFor(position);
      this.totals.set(entrant.carIndex, this.pointsOf(entrant.carIndex) + points);
      this.last.set(entrant.carIndex, { points, position });
    });
    this.completed += 1;
  }

  /** Moves on to the next round; returns false when the season is over. */
  advance(): boolean {
    if (this.round + 1 >= this.rounds.length) return false;
    this.round += 1;
    return true;
  }

  /**
   * The table: most points first, and a driver who won more recently edges a
   * tie, so the order never flickers between equal scores.
   */
  standings(): Standing[] {
    const rows = this.entrants.map((entrant) => {
      const last = this.last.get(entrant.carIndex);
      return {
        ...entrant,
        points: this.pointsOf(entrant.carIndex),
        lastPoints: last?.points ?? 0,
        lastPosition: last?.position ?? 0,
        place: 0,
      };
    });
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (a.lastPosition !== b.lastPosition) {
        // A driver with no result yet sorts behind one who has finished.
        if (a.lastPosition === 0) return 1;
        if (b.lastPosition === 0) return -1;
        return a.lastPosition - b.lastPosition;
      }
      return a.carIndex - b.carIndex;
    });
    rows.forEach((row, i) => {
      row.place = i + 1;
    });
    return rows;
  }

  /** Whoever leads the table; after the last round, the champion. */
  get leader(): Standing | null {
    return this.standings()[0] ?? null;
  }
}
