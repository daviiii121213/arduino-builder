import type { DifficultyId } from './difficulty';
import type { WeatherId } from './weather';

/**
 * The elimination tournament: twelve entries drawn from the game's six cars
 * (each model fields two liveries), cut down over four rounds to one champion.
 */

export type PhaseId = 'group' | 'six' | 'four' | 'final';

export interface PhaseDef {
  id: PhaseId;
  trackId: string;
  weather: WeatherId;
  difficulty: DifficultyId;
  /** How many cars line up in this phase (per group, for the group stage). */
  fieldSize: number;
  /** How many of them go through (per group, for the group stage). */
  advance: number;
  /** Groups raced in parallel; only the group stage has more than one. */
  groups: number;
}

/** Every elimination race is three laps. */
export const TOURNAMENT_LAPS = 3;

/**
 * Group stage on the wide circuit, then the loose one in the rain, then the
 * mountain at night, and a final in the dark and the wet against the hidden
 * Impossible level.
 */
export const PHASES: PhaseDef[] = [
  { id: 'group', trackId: 'bayside', weather: 'sunny', difficulty: 'hard', fieldSize: 6, advance: 3, groups: 2 },
  { id: 'six', trackId: 'dustbowl', weather: 'rain', difficulty: 'elite', fieldSize: 6, advance: 4, groups: 1 },
  { id: 'four', trackId: 'serpentine', weather: 'night', difficulty: 'elite', fieldSize: 4, advance: 2, groups: 1 },
  { id: 'final', trackId: 'serpentine', weather: 'storm', difficulty: 'impossible', fieldSize: 2, advance: 1, groups: 1 },
];

export interface Entrant {
  /** Index into the tournament's twelve-car spec list. */
  carIndex: number;
  name: string;
  isPlayer: boolean;
  /** Group letter in the opening round: 0 = A, 1 = B. */
  group: number;
  /** Which of the six cars this entry is, ignoring livery. */
  model: number;
}

export interface PhaseResult {
  phase: PhaseId;
  /** Finishing order, group by group. */
  order: Entrant[][];
  advancing: Entrant[];
  eliminated: Entrant[];
  /** Where the player came, or 0 if they were not in this phase. */
  playerPosition: number;
  playerGroup: number;
  playerAdvanced: boolean;
}

/**
 * Builds the twelve-car entry list: every car in both liveries, split into two
 * groups so a model never meets its own second entry in the opening round.
 */
export function buildEntrants(
  carCount: number,
  playerCarIndex: number,
  names: string[] = [],
): Entrant[] {
  const entrants: Entrant[] = [];
  for (let i = 0; i < carCount * 2; i++) {
    entrants.push({
      carIndex: i,
      name: names[i] ?? `CAR ${i + 1}`,
      isPlayer: i === playerCarIndex,
      // Livery A runs in group A, livery B in group B, so a model never meets
      // its own second entry until the field has been cut down.
      group: Math.floor(i / carCount),
      model: i % carCount,
    });
  }
  return entrants;
}

export class Tournament {
  /** Index into PHASES. */
  phaseIndex = 0;
  /** Everyone still in the running. */
  field: Entrant[];
  /** Set when the player's run is over, one way or the other. */
  playerOut = false;
  champion: Entrant | null = null;
  lastResult: PhaseResult | null = null;

  constructor(
    entrants: Entrant[],
    readonly phases: PhaseDef[] = PHASES,
  ) {
    this.field = entrants.map((e) => ({ ...e }));
  }

  get phase(): PhaseDef {
    return this.phases[Math.min(this.phaseIndex, this.phases.length - 1)];
  }

  get phaseNumber(): number {
    return Math.min(this.phaseIndex + 1, this.phases.length);
  }

  get totalPhases(): number {
    return this.phases.length;
  }

  get finished(): boolean {
    return this.champion !== null;
  }

  get player(): Entrant | undefined {
    return this.field.find((e) => e.isPlayer);
  }

  /** The cars in a given group of the current phase, in entry order. */
  groupField(group: number): Entrant[] {
    if (this.phase.groups <= 1) return this.field;
    return this.field.filter((e) => e.group === group);
  }

  /** Which group the player is in this phase; 0 when there is only one. */
  get playerGroup(): number {
    if (this.phase.groups <= 1) return 0;
    return this.player?.group ?? 0;
  }

  /**
   * Records a phase. `orders` holds the finishing order of each group; a
   * single-group phase passes one array. Everyone outside the advance cut is
   * eliminated, and the last phase crowns its winner.
   */
  record(orders: Entrant[][]): PhaseResult {
    const phase = this.phase;
    const advancing: Entrant[] = [];
    const eliminated: Entrant[] = [];
    orders.forEach((order) => {
      order.forEach((entrant, i) => {
        if (i < phase.advance) advancing.push(entrant);
        else eliminated.push(entrant);
      });
    });

    const player = this.player;
    const playerGroupOrder = orders.find((order) => order.some((e) => e.isPlayer));
    const playerPosition = playerGroupOrder
      ? playerGroupOrder.findIndex((e) => e.isPlayer) + 1
      : 0;
    const playerAdvanced = advancing.some((e) => e.isPlayer);
    if (player && !playerAdvanced) this.playerOut = true;

    this.field = advancing;
    if (phase.id === 'final') this.champion = advancing[0] ?? null;

    const result: PhaseResult = {
      phase: phase.id,
      order: orders.map((order) => [...order]),
      advancing: [...advancing],
      eliminated: [...eliminated],
      playerPosition,
      playerGroup: player?.group ?? 0,
      playerAdvanced,
    };
    this.lastResult = result;
    return result;
  }

  /** Moves to the next round; false when the tournament is over. */
  advance(): boolean {
    if (this.finished) return false;
    if (this.phaseIndex + 1 >= this.phases.length) return false;
    this.phaseIndex += 1;
    return true;
  }
}
