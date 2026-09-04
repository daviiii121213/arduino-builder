import { clamp, lerp, wrapAngle, type Vec } from './math';
import type { CarSpec } from './cars';
import { AIDriver, RaceCar, resolveCarCollision, resolveObstacleCollision, type AISkill, type Controls } from './car';
import { difficultyAt, type DifficultyDef } from './difficulty';
import type { Track } from './tracks';
import type { World } from './world';
import { Particles } from './effects';
import { WeatherFx, type LightSource, type WeatherDef } from './weather';

/** Physics runs at a fixed step so the handling feels identical everywhere. */
export const STEP = 1 / 120;

/**
 * Start sequence: the gantry light fills red, red + yellow and green, and the
 * race is released the instant the lights go out.
 */
export const START_BEATS = { red: 0, yellow: 0.75, green: 1.5, go: 2.3 };

export type StartSignal =
  | { kind: 'light'; state: 'red' | 'redYellow' | 'green' }
  | { kind: 'go' }
  | { kind: 'none' };

/** How long the GO banner stays up once the lights go out. */
export const GO_BANNER = 0.9;

/** Pure form of the start sequence, so its timing can be tested headless. */
export function startSignalAt(time: number): StartSignal {
  if (time >= START_BEATS.go) return time < START_BEATS.go + GO_BANNER ? { kind: 'go' } : { kind: 'none' };
  if (time >= START_BEATS.green) return { kind: 'light', state: 'green' };
  if (time >= START_BEATS.yellow) return { kind: 'light', state: 'redYellow' };
  return { kind: 'light', state: 'red' };
}

/** Per-driver character, before the difficulty setting scales it. */
const AI_SKILLS = [
  { pace: 0.94, line: -0.35, reaction: 2.4 },
  { pace: 0.9, line: 0.3, reaction: 2.2 },
  { pace: 0.97, line: 0, reaction: 2.6 },
  { pace: 0.88, line: -0.15, reaction: 2.1 },
  { pace: 0.92, line: 0.18, reaction: 2.5 },
  { pace: 0.95, line: -0.22, reaction: 2.3 },
];

/**
 * Blends a driver's own character with the chosen difficulty, and with how much
 * racecraft the field is bringing (0 for a normal race, 1 for a championship).
 */
export function skillFor(slot: number, difficulty: DifficultyDef, racecraft = 0): AISkill {
  const base = AI_SKILLS[slot % AI_SKILLS.length];
  return {
    pace: base.pace * difficulty.pace,
    line: base.line,
    reaction: base.reaction * difficulty.reaction,
    wobble: difficulty.wobble,
    nitroReserve: difficulty.nitroReserve,
    racecraft,
  };
}

/**
 * Who lines up, in grid order: the player takes the middle of the pack and the
 * opponents fill in around them, each in a different car.
 */
export function buildGrid(specCount: number, playerIndex: number | null, opponents: number): number[] {
  const others: number[] = [];
  for (let i = 0; i < specCount && others.length < opponents; i++) {
    if (i !== playerIndex) others.push(i);
  }
  if (playerIndex === null) return others;
  const grid = [...others];
  grid.splice(Math.min(2, grid.length), 0, playerIndex);
  return grid;
}

/**
 * The start lights, kept as its own little clock. It keeps running for a beat
 * after the release so the GO banner clears itself instead of hanging on
 * screen for the rest of the race.
 */
export class StartSequence {
  time = 0;
  private lastBeat = -1;

  /** Point past which the sequence no longer needs to tick. */
  private static readonly END = START_BEATS.go + GO_BANNER + 0.5;

  update(dt: number): void {
    if (this.time < StartSequence.END) this.time = Math.min(StartSequence.END, this.time + dt);
  }

  /** False until the lights go out. */
  get released(): boolean {
    return this.time >= START_BEATS.go;
  }

  get signal(): StartSignal {
    return startSignalAt(this.time);
  }

  /** Jumps to the end: used by demo races and by the test hooks. */
  skip(): void {
    this.time = StartSequence.END;
  }

  /**
   * Returns the beat that has just started, once each, so the caller can play
   * a tone for it: 0-2 are the three lamps, 3 is the release.
   */
  takeBeat(): number | null {
    const beats = [START_BEATS.red, START_BEATS.yellow, START_BEATS.green, START_BEATS.go];
    let current = -1;
    for (let i = 0; i < beats.length; i++) if (this.time >= beats[i]) current = i;
    if (current > this.lastBeat) {
      this.lastBeat = current;
      return current;
    }
    return null;
  }
}

export interface RaceOptions {
  track: Track;
  weather: WeatherDef;
  specs: CarSpec[];
  laps: number;
  /** Which car the player drives, or null for an all-AI demo race. */
  playerCarIndex: number | null;
  world: World;
  /** Demo races behind the menu skip the start sequence and roll immediately. */
  skipStart?: boolean;
  /** How many AI cars line up against the player. */
  opponents?: number;
  /** How hard those AI cars race. */
  difficulty?: DifficultyDef;
  /** 0 for a normal race, 1 for the championship field. */
  racecraft?: number;
  /**
   * Exact line-up, as indices into `specs`, in grid order. Used by the
   * tournament, where who lines up is decided by the bracket.
   */
  grid?: number[];
}

/**
 * One race: the field, the physics loop, the effects and the camera. The menu
 * runs an all-AI instance of this behind its panels as an attract screen.
 */
export class Race {
  readonly track: Track;
  readonly weather: WeatherDef;
  readonly laps: number;
  readonly cars: RaceCar[] = [];
  readonly drivers: AIDriver[] = [];
  readonly camera: Vec;

  readonly specs: CarSpec[];
  private world: World;
  private particles = new Particles();
  private fx = new WeatherFx();
  private accumulator = 0;
  private playerIndex: number | null;
  /** Kept so a stand-in driver races at the same level as the field. */
  private readonly difficulty: DifficultyDef;
  private readonly racecraft: number;

  time = 0;
  /** Set when the player (or the whole field, in a demo) has taken the flag. */
  over = false;
  /** The start lights. */
  readonly start = new StartSequence();
  /** Raised the moment the race ends, whoever advanced the clock. */
  private finishPending = false;
  private finishAnnounced = false;
  private lapMarks = new Map<RaceCar, number>();

  constructor(opts: RaceOptions) {
    this.track = opts.track;
    this.weather = opts.weather;
    this.laps = opts.laps;
    this.specs = opts.specs;
    this.world = opts.world;
    this.playerIndex = opts.playerCarIndex;

    this.world.marksCtx.clearRect(0, 0, this.world.marks.width, this.world.marks.height);

    const difficulty = opts.difficulty ?? difficultyAt(1);
    const racecraft = opts.racecraft ?? 0;
    this.difficulty = difficulty;
    this.racecraft = racecraft;
    const opponents = opts.opponents ?? this.specs.length - 1;
    const order = opts.grid ?? buildGrid(this.specs.length, this.playerIndex, opponents);

    order.forEach((specIndex, slot) => {
      const spec = this.specs[specIndex];
      const grid = this.track.startSlot(slot);
      const car = new RaceCar({
        pos: grid.pos,
        heading: grid.heading,
        stats: spec.stats,
        isPlayer: specIndex === this.playerIndex,
        name: spec.name,
        carIndex: specIndex,
      });
      car.primeGrid(this.track);
      car.autoRecover = car.isPlayer;
      this.cars.push(car);
      if (!car.isPlayer) {
        this.drivers.push(new AIDriver(car, this.track, skillFor(slot, difficulty, racecraft)));
      }
    });

    if (opts.skipStart) this.start.skip();

    const lead = this.player ?? this.cars[0];
    this.camera = { x: lead.pos.x, y: lead.pos.y };
  }

  get player(): RaceCar | null {
    return this.cars.find((c) => c.isPlayer) ?? null;
  }

  /** False until the start lights go out. */
  get released(): boolean {
    return this.start.released;
  }

  /** Seconds into the start sequence. */
  get startTime(): number {
    return this.start.time;
  }

  /** What the start sequence should be showing right now. */
  get startSignal(): StartSignal {
    return this.start.signal;
  }

  takeStartBeat(): number | null {
    return this.start.takeBeat();
  }

  /** The car the camera watches: the player, or whoever is leading a demo race. */
  get focus(): RaceCar {
    if (this.player) return this.player;
    return this.cars.reduce((best, c) => (c.raceProgress > best.raceProgress ? c : best), this.cars[0]);
  }

  setPlayerControls(controls: Controls): void {
    const p = this.player;
    if (p) p.controls = p.finished ? { throttle: 0, steer: 0, handbrake: false, nitro: false } : controls;
  }

  update(dt: number, viewW: number, viewH: number): void {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 8) {
      this.step(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === 8) this.accumulator = 0;
    this.particles.update(dt);
    this.fx.update(dt, this.weather, viewW, viewH);
    this.updateCamera(dt, viewW, viewH);
  }

  /** One fixed physics step: AI, cars, collisions, scoring, effects. */
  step(dt: number): void {
    // The sequence keeps running after the release so its banner expires.
    this.start.update(dt);

    // Nobody moves until the lights go out: the field is held on the grid.
    if (!this.released) {
      for (const car of this.cars) {
        car.controls = { throttle: 0, steer: 0, handbrake: false, nitro: false };
        car.vel.x = 0;
        car.vel.y = 0;
      }
      return;
    }

    this.time += dt;
    this.updateSlipstream();
    for (const driver of this.drivers) driver.update(dt, this.cars);
    for (const car of this.cars) {
      car.update(dt, this.track, this.weather);
      for (const prop of this.track.nearbySolids(car.pos)) resolveObstacleCollision(car, prop);
    }
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        resolveCarCollision(this.cars[i], this.cars[j]);
      }
    }
    for (const car of this.cars) {
      if (!car.finished && car.lap >= this.laps) {
        car.finished = true;
        car.finishTime = this.time;
      }
    }
    this.timeLaps();
    this.updatePositions();
    const player = this.player;
    this.over = player ? player.finished : this.cars.every((c) => c.finished);
    if (this.over && !this.finishAnnounced) {
      this.finishAnnounced = true;
      this.finishPending = true;
    }
    this.emitEffects(dt);
  }

  /**
   * Times every completed lap. A lap only counts once the car has been round
   * from the line, so the run out of the grid is never recorded as one.
   */
  private timeLaps(): void {
    for (const car of this.cars) {
      const lapNow = car.lap;
      const previous = this.lapMarks.get(car);
      if (previous === undefined) {
        this.lapMarks.set(car, lapNow);
        continue;
      }
      if (lapNow === previous) continue;
      this.lapMarks.set(car, lapNow);
      if (lapNow > previous) {
        // The first crossing only starts the clock; there is no lap behind it.
        if (previous >= 0) {
          const lapTime = this.time - car.lapStart;
          car.lastLap = lapTime;
          if (car.bestLap === 0 || lapTime < car.bestLap) car.bestLap = lapTime;
        }
        car.lapStart = this.time;
      } else {
        car.lapStart = this.time;
      }
    }
  }

  /**
   * Marks how deep each car is sitting in the wake of the one in front. It is
   * plain physics, so the player gets the tow on equal terms with the AI.
   */
  private updateSlipstream(): void {
    const REACH = 150;
    for (const car of this.cars) {
      const cos = Math.cos(car.heading);
      const sin = Math.sin(car.heading);
      let best = 0;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.pos.x - car.pos.x;
        const dy = other.pos.y - car.pos.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 14 || distance > REACH) continue;
        // Directly in front, pointing the same way, and actually moving.
        const alongAhead = (dx * cos + dy * sin) / distance;
        if (alongAhead < 0.94) continue;
        if (Math.abs(wrapAngle(other.heading - car.heading)) > 0.5) continue;
        if (other.forwardSpeed < 60) continue;
        best = Math.max(best, 1 - distance / REACH);
      }
      car.slipstream = best;
    }
  }

  /**
   * True exactly once, on the first read after the race ends. Reported by the
   * race rather than watched frame by frame, so a fast-forward can't miss it.
   */
  takeFinished(): boolean {
    if (!this.finishPending) return false;
    this.finishPending = false;
    return true;
  }

  private updatePositions(): void {
    const order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.raceProgress - a.raceProgress;
    });
    order.forEach((car, i) => {
      car.position = i + 1;
    });
  }

  /** Skid marks on the surface, dust off the tyres and nitro flames. */
  private emitEffects(dt: number): void {
    const theme = this.track.def.theme;
    const dirt = this.track.def.surface === 'dirt';
    const wet = this.weather.id === 'rain';
    const marks = this.world.marksCtx;

    for (const car of this.cars) {
      const cos = Math.cos(car.heading);
      const sin = Math.sin(car.heading);
      const spec = this.specs[car.carIndex];

      if (car.respawned) {
        // A ring of pixels bursting outwards where the car rejoins.
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          this.particles.spawn(
            { x: car.pos.x + Math.cos(a) * 8, y: car.pos.y + Math.sin(a) * 8 },
            { x: -Math.cos(a) * 260, y: -Math.sin(a) * 260 },
            i % 2 === 0 ? '#f2f0e8' : '#59d8f0',
            1,
          );
        }
      }
      const rearX = car.pos.x - cos * spec.sprite.height * 0.32;
      const rearY = car.pos.y - sin * spec.sprite.height * 0.32;

      if (car.nitroActive && Math.random() < dt * 90) {
        // Twin flames out of the exhausts, cyan at the core and orange outside.
        for (const side of [-1, 1]) {
          const ox = -sin * side * spec.sprite.width * 0.22;
          const oy = cos * side * spec.sprite.width * 0.22;
          this.particles.spawn(
            { x: rearX + ox, y: rearY + oy },
            { x: cos * 240, y: sin * 240 },
            Math.random() < 0.55 ? '#7ff0ff' : '#ffb347',
            1,
          );
        }
      }

      const speed = car.speed;
      if (speed < 25) continue;
      const sliding = car.slip > 32 || car.controls.handbrake;

      if (sliding && !car.offTrack) {
        marks.fillStyle = theme.skid;
        for (const side of [-1, 1]) {
          const ox = -sin * side * spec.sprite.width * 0.34;
          const oy = cos * side * spec.sprite.width * 0.34;
          marks.fillRect(Math.round(rearX + ox), Math.round(rearY + oy), 3, 3);
        }
      }

      const wantsDust = car.offTrack || wet || (dirt && (sliding || car.controls.throttle > 0));
      if (wantsDust && Math.random() < dt * 60) {
        const color = car.offTrack ? theme.grass.light : wet ? '#b9d2ea' : theme.dust;
        this.particles.spawn(
          { x: rearX, y: rearY },
          { x: cos * speed, y: sin * speed },
          color,
          car.offTrack ? 2 : 1,
        );
      }
    }
  }

  private updateCamera(dt: number, viewW: number, viewH: number): void {
    const car = this.focus;
    // Look slightly ahead of the car so you can see the corner coming.
    const targetX = car.pos.x + car.vel.x * 0.28;
    const targetY = car.pos.y + car.vel.y * 0.28;
    const k = 1 - Math.exp(-6 * dt);
    this.camera.x = lerp(this.camera.x, targetX, k);
    this.camera.y = lerp(this.camera.y, targetY, k);

    const def = this.track.def;
    this.camera.x =
      def.worldW <= viewW ? def.worldW / 2 : clamp(this.camera.x, viewW / 2, def.worldW - viewW / 2);
    this.camera.y =
      def.worldH <= viewH ? def.worldH / 2 : clamp(this.camera.y, viewH / 2, def.worldH - viewH / 2);
  }

  render(g: CanvasRenderingContext2D, viewW: number, viewH: number): void {
    const camX = Math.round(this.camera.x - viewW / 2);
    const camY = Math.round(this.camera.y - viewH / 2);

    g.imageSmoothingEnabled = false;
    g.fillStyle = this.track.def.theme.grass.deep;
    g.fillRect(0, 0, viewW, viewH);
    g.drawImage(this.world.ground, camX, camY, viewW, viewH, 0, 0, viewW, viewH);
    g.drawImage(this.world.marks, camX, camY, viewW, viewH, 0, 0, viewW, viewH);
    this.particles.draw(g, camX, camY);

    for (const car of this.cars) this.drawCar(g, car, camX, camY);

    const lights: LightSource[] = this.cars.map((car) => ({
      pos: { x: car.pos.x - camX, y: car.pos.y - camY },
      heading: car.heading,
      strength: car.isPlayer ? 1.35 : 1,
    }));
    this.fx.draw(g, this.weather, lights);
  }

  private drawCar(g: CanvasRenderingContext2D, car: RaceCar, camX: number, camY: number): void {
    // A car under recovery flickers, fast while it waits, slower on the way out.
    if (car.blinking) {
      const rate = car.recovery === 'blink' ? 14 : 8;
      if (Math.floor(this.time * rate) % 2 === 0) return;
    }
    const spec = this.specs[car.carIndex];
    const w = spec.sprite.width;
    const h = spec.sprite.height;
    const x = Math.round(car.pos.x - camX);
    const y = Math.round(car.pos.y - camY);

    if (car.nitroActive) {
      // A short blue glow trailing the car while the bottle is open.
      const cos = Math.cos(car.heading);
      const sin = Math.sin(car.heading);
      g.globalAlpha = 0.5;
      g.fillStyle = '#59d8f0';
      for (let i = 1; i <= 3; i++) {
        const size = 6 - i;
        g.fillRect(Math.round(x - cos * (h * 0.4 + i * 4)) - size / 2, Math.round(y - sin * (h * 0.4 + i * 4)) - size / 2, size, size);
      }
      g.globalAlpha = 1;
    }

    g.save();
    g.translate(x, y);
    // Sprites are drawn nose-up, so add a quarter turn to match the heading.
    g.rotate(car.heading + Math.PI / 2);
    g.drawImage(spec.shadow, -Math.round(w / 2) + 1, -Math.round(h / 2) + 2);
    g.drawImage(spec.sprite, -Math.round(w / 2), -Math.round(h / 2));
    g.restore();
  }

  /**
   * Fast-forwards the race with an AI standing in for the player. Used by the
   * demo screenshots and the automated browser test.
   */
  autopilot(seconds: number): void {
    const player = this.player;
    // The stand-in races at the level of the field it is standing in against.
    const stand = player
      ? new AIDriver(player, this.track, skillFor(0, this.difficulty, this.racecraft))
      : null;
    if (stand) this.drivers.push(stand);
    for (let t = 0; t < seconds; t += STEP) this.step(STEP);
    if (stand) this.drivers.pop();
  }

  /** Standings, best first — used by the results readout. */
  standings(): RaceCar[] {
    return [...this.cars].sort((a, b) => a.position - b.position);
  }
}
