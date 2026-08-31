import { clamp, lerp, type Vec } from './math';
import type { CarSpec } from './cars';
import { AIDriver, RaceCar, resolveCarCollision, resolveObstacleCollision, type Controls } from './car';
import type { Track } from './tracks';
import type { World } from './world';
import { Particles } from './effects';
import { WeatherFx, type LightSource, type WeatherDef } from './weather';

/** Physics runs at a fixed step so the handling feels identical everywhere. */
export const STEP = 1 / 120;

/**
 * Start sequence: three counted beats, then the gantry lights fill red, red +
 * yellow and green. The race is released the instant the lights go out.
 */
export const START_BEATS = { three: 0, two: 0.85, one: 1.7, red: 2.55, yellow: 3.1, green: 3.65, go: 4.3 };

export type StartSignal =
  | { kind: 'count'; label: '3' | '2' | '1' }
  | { kind: 'light'; state: 'red' | 'redYellow' | 'green' }
  | { kind: 'go' }
  | { kind: 'none' };

/** Pure form of the start sequence, so its timing can be tested headless. */
export function startSignalAt(time: number): StartSignal {
  if (time >= START_BEATS.go) return time < START_BEATS.go + 0.9 ? { kind: 'go' } : { kind: 'none' };
  if (time >= START_BEATS.green) return { kind: 'light', state: 'green' };
  if (time >= START_BEATS.yellow) return { kind: 'light', state: 'redYellow' };
  if (time >= START_BEATS.red) return { kind: 'light', state: 'red' };
  if (time >= START_BEATS.one) return { kind: 'count', label: '1' };
  if (time >= START_BEATS.two) return { kind: 'count', label: '2' };
  return { kind: 'count', label: '3' };
}

const AI_SKILLS = [
  { pace: 0.94, line: -0.35, reaction: 2.4 },
  { pace: 0.9, line: 0.3, reaction: 2.2 },
  { pace: 0.97, line: 0, reaction: 2.6 },
  { pace: 0.88, line: -0.15, reaction: 2.1 },
  { pace: 0.92, line: 0.18, reaction: 2.5 },
  { pace: 0.95, line: -0.22, reaction: 2.3 },
];

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

  private specs: CarSpec[];
  private world: World;
  private particles = new Particles();
  private fx = new WeatherFx();
  private accumulator = 0;
  private playerIndex: number | null;

  time = 0;
  /** Set when the player (or the whole field, in a demo) has taken the flag. */
  over = false;
  /** Time spent in the start sequence; the field is held until it completes. */
  startTime = 0;
  /** Raised the moment the race ends, whoever advanced the clock. */
  private finishPending = false;
  private finishAnnounced = false;
  /** Beat index already announced, so the audio only fires once per light. */
  private lastBeat = -1;

  constructor(opts: RaceOptions) {
    this.track = opts.track;
    this.weather = opts.weather;
    this.laps = opts.laps;
    this.specs = opts.specs;
    this.world = opts.world;
    this.playerIndex = opts.playerCarIndex;

    this.world.marksCtx.clearRect(0, 0, this.world.marks.width, this.world.marks.height);

    // The player takes the middle of the grid; everyone else fills in around them.
    const order = this.specs.map((_, i) => i);
    if (this.playerIndex !== null) {
      order.splice(order.indexOf(this.playerIndex), 1);
      order.splice(Math.min(2, order.length), 0, this.playerIndex);
    }

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
        this.drivers.push(new AIDriver(car, this.track, AI_SKILLS[slot % AI_SKILLS.length]));
      }
    });

    if (opts.skipStart) this.startTime = START_BEATS.go + 1;

    const lead = this.player ?? this.cars[0];
    this.camera = { x: lead.pos.x, y: lead.pos.y };
  }

  get player(): RaceCar | null {
    return this.cars.find((c) => c.isPlayer) ?? null;
  }

  /** False until the start lights go out. */
  get released(): boolean {
    return this.startTime >= START_BEATS.go;
  }

  /** What the start sequence should be showing right now. */
  get startSignal(): StartSignal {
    return startSignalAt(this.startTime);
  }

  /**
   * Returns the beat that has just started, once each, so the caller can play
   * a tone for it: 0-2 are the numbers, 3-5 the lights, 6 the release.
   */
  takeStartBeat(): number | null {
    const beats = [START_BEATS.three, START_BEATS.two, START_BEATS.one, START_BEATS.red, START_BEATS.yellow, START_BEATS.green, START_BEATS.go];
    let current = -1;
    for (let i = 0; i < beats.length; i++) if (this.startTime >= beats[i]) current = i;
    if (current > this.lastBeat) {
      this.lastBeat = current;
      return current;
    }
    return null;
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
    // Nobody moves until the lights go out: the field is held on the grid.
    if (!this.released) {
      this.startTime += dt;
      for (const car of this.cars) {
        car.controls = { throttle: 0, steer: 0, handbrake: false, nitro: false };
        car.vel.x = 0;
        car.vel.y = 0;
      }
      return;
    }

    this.time += dt;
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
    const stand = player ? new AIDriver(player, this.track, AI_SKILLS[0]) : null;
    if (stand) this.drivers.push(stand);
    for (let t = 0; t < seconds; t += STEP) this.step(STEP);
    if (stand) this.drivers.pop();
  }

  /** Standings, best first — used by the results readout. */
  standings(): RaceCar[] {
    return [...this.cars].sort((a, b) => a.position - b.position);
  }
}
