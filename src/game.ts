import { clamp, lerp, type Vec } from './math';
import { ctx2d } from './pixel';
import { getCarSpecs, type CarSpec } from './cars';
import { getDecorSprites } from './decor';
import { AIDriver, RaceCar, resolveCarCollision, resolveObstacleCollision } from './car';
import { buildTracks, type Track } from './tracks';
import { buildWorld, type World } from './world';
import { Particles } from './effects';
import { Input } from './input';

export const TOTAL_LAPS = 3;
const FIELD_SIZE = 4;
/** Physics runs at a fixed step so the handling feels identical everywhere. */
const STEP = 1 / 120;
/** Roughly how many world pixels tall the view should be; sets the zoom. */
const TARGET_VIEW_HEIGHT = 360;

const AI_SKILLS = [
  { pace: 0.94, line: -0.35, reaction: 2.4 },
  { pace: 0.9, line: 0.3, reaction: 2.2 },
  { pace: 0.97, line: 0.0, reaction: 2.6 },
  { pace: 0.88, line: -0.15, reaction: 2.1 },
];

export class Game {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private input: Input;
  private specs: CarSpec[];
  private tracks: Track[];
  private worlds: Array<World | null>;
  private trackIndex = 0;
  private playerCar = 0;

  private cars: RaceCar[] = [];
  private drivers: AIDriver[] = [];
  private particles = new Particles();
  private camera: Vec = { x: 0, y: 0 };
  private zoom = 2;
  private raceTime = 0;
  private accumulator = 0;
  private lastTs = 0;
  private banner = '';
  private bannerTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = ctx2d(canvas);
    this.input = new Input();
    this.specs = getCarSpecs();
    this.tracks = buildTracks();
    this.worlds = this.tracks.map(() => null);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.startRace();
  }

  private get track(): Track {
    return this.tracks[this.trackIndex];
  }

  private world(): World {
    let w = this.worlds[this.trackIndex];
    if (!w) {
      w = buildWorld(this.track);
      this.worlds[this.trackIndex] = w;
    }
    return w;
  }

  private resize(): void {
    const cssW = Math.max(320, window.innerWidth);
    const cssH = Math.max(240, window.innerHeight);
    this.zoom = clamp(Math.round(cssH / TARGET_VIEW_HEIGHT), 2, 5);
    this.canvas.width = Math.ceil(cssW / this.zoom);
    this.canvas.height = Math.ceil(cssH / this.zoom);
    this.g = ctx2d(this.canvas);
  }

  /** Builds the grid: player plus three AI, each in a different car. */
  startRace(): void {
    const track = this.track;
    this.cars = [];
    this.drivers = [];
    this.particles.clear();
    this.raceTime = 0;
    this.accumulator = 0;
    this.banner = '';
    this.bannerTimer = 0;

    const world = this.world();
    world.marksCtx.clearRect(0, 0, world.marks.width, world.marks.height);

    for (let slot = 0; slot < FIELD_SIZE; slot++) {
      const specIndex = (this.playerCar + slot) % this.specs.length;
      const spec = this.specs[specIndex];
      const grid = track.startSlot(slot);
      const car = new RaceCar({
        pos: grid.pos,
        heading: grid.heading,
        stats: spec.stats,
        isPlayer: slot === 0,
        name: spec.name,
        carIndex: specIndex,
      });
      car.primeGrid(track);
      this.cars.push(car);
      if (slot !== 0) {
        this.drivers.push(new AIDriver(car, track, AI_SKILLS[slot % AI_SKILLS.length]));
      }
    }

    const p = this.cars[0];
    this.camera = { x: p.pos.x, y: p.pos.y };
  }

  start(): void {
    const frame = (ts: number): void => {
      const dt = this.lastTs === 0 ? 0 : Math.min(0.1, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      this.update(dt);
      this.render();
      this.input.endFrame();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private handleHotkeys(): void {
    if (this.input.tapped('r')) this.startRace();
    if (this.input.tapped('c')) {
      this.playerCar = (this.playerCar + 1) % this.specs.length;
      this.startRace();
      this.flash(`CAR: ${this.specs[this.playerCar].name}`);
    }
    for (let i = 0; i < this.tracks.length; i++) {
      if (this.input.tapped(String(i + 1)) && this.trackIndex !== i) {
        this.trackIndex = i;
        this.startRace();
        this.flash(this.track.def.name);
      }
    }
  }

  private flash(text: string): void {
    this.banner = text;
    this.bannerTimer = 2;
  }

  private playerControls(): void {
    const player = this.cars[0];
    if (player.finished) {
      player.controls = { throttle: 0, steer: 0, handbrake: false };
      return;
    }
    const up = this.input.held('w', 'arrowup');
    const down = this.input.held('s', 'arrowdown');
    const left = this.input.held('a', 'arrowleft');
    const right = this.input.held('d', 'arrowright');
    player.controls = {
      throttle: (up ? 1 : 0) + (down ? -1 : 0),
      steer: (right ? 1 : 0) + (left ? -1 : 0),
      handbrake: this.input.held(' '),
    };
  }

  private update(dt: number): void {
    this.handleHotkeys();
    this.playerControls();
    if (this.bannerTimer > 0) this.bannerTimer -= dt;

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= STEP && steps < 8) {
      this.step(STEP);
      this.accumulator -= STEP;
      steps++;
    }
    if (steps === 8) this.accumulator = 0;

    this.particles.update(dt);
    this.updateCamera(dt);
  }

  private step(dt: number): void {
    this.raceTime += dt;
    const track = this.track;

    for (const driver of this.drivers) driver.update(dt, this.cars);
    for (const car of this.cars) {
      car.update(dt, track);
      for (const prop of track.nearbySolids(car.pos)) resolveObstacleCollision(car, prop);
    }
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        resolveCarCollision(this.cars[i], this.cars[j]);
      }
    }

    for (const car of this.cars) {
      if (!car.finished && car.lap >= TOTAL_LAPS) {
        car.finished = true;
        car.finishTime = this.raceTime;
        if (car.isPlayer) this.flash(`FINISHED  P${car.position}`);
      }
    }

    this.updatePositions();
    this.emitEffects(dt);
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

  /** Skid marks on the surface plus dust puffs off the back of the cars. */
  private emitEffects(dt: number): void {
    const track = this.track;
    const dirt = track.def.surface === 'dirt';
    const marks = this.world().marksCtx;

    for (const car of this.cars) {
      const speed = car.speed;
      if (speed < 25) continue;
      const cos = Math.cos(car.heading);
      const sin = Math.sin(car.heading);
      const spec = this.specs[car.carIndex];
      const rearX = car.pos.x - cos * spec.sprite.height * 0.32;
      const rearY = car.pos.y - sin * spec.sprite.height * 0.32;
      const sliding = car.slip > 32 || car.controls.handbrake;

      if (sliding && !car.offTrack) {
        marks.fillStyle = dirt ? 'rgba(86,56,30,0.45)' : 'rgba(24,22,26,0.38)';
        for (const side of [-1, 1]) {
          const ox = -sin * side * spec.sprite.width * 0.34;
          const oy = cos * side * spec.sprite.width * 0.34;
          marks.fillRect(Math.round(rearX + ox), Math.round(rearY + oy), 3, 3);
        }
      }

      const wantsDust = car.offTrack || (dirt && (sliding || car.controls.throttle > 0));
      if (wantsDust && Math.random() < dt * 60) {
        const color = car.offTrack ? '#5c7f3c' : dirt ? '#a37c4c' : '#6a6d75';
        this.particles.spawn(
          { x: rearX, y: rearY },
          { x: cos * speed, y: sin * speed },
          color,
          car.offTrack ? 2 : 1,
        );
      }
    }
  }

  private updateCamera(dt: number): void {
    const player = this.cars[0];
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    // Look slightly ahead of the car so you can see the corner coming.
    const targetX = player.pos.x + player.vel.x * 0.28;
    const targetY = player.pos.y + player.vel.y * 0.28;
    const k = 1 - Math.exp(-6 * dt);
    this.camera.x = lerp(this.camera.x, targetX, k);
    this.camera.y = lerp(this.camera.y, targetY, k);

    const def = this.track.def;
    this.camera.x =
      def.worldW <= vw ? def.worldW / 2 : clamp(this.camera.x, vw / 2, def.worldW - vw / 2);
    this.camera.y =
      def.worldH <= vh ? def.worldH / 2 : clamp(this.camera.y, vh / 2, def.worldH - vh / 2);
  }

  private render(): void {
    const g = this.g;
    const vw = this.canvas.width;
    const vh = this.canvas.height;
    const camX = Math.round(this.camera.x - vw / 2);
    const camY = Math.round(this.camera.y - vh / 2);
    const world = this.world();

    g.imageSmoothingEnabled = false;
    g.fillStyle = '#2c5c26';
    g.fillRect(0, 0, vw, vh);
    g.drawImage(world.ground, camX, camY, vw, vh, 0, 0, vw, vh);
    g.drawImage(world.marks, camX, camY, vw, vh, 0, 0, vw, vh);
    this.particles.draw(g, camX, camY);

    for (const car of this.cars) this.drawCar(g, car, camX, camY);
    this.drawHud(g);
  }

  private drawCar(g: CanvasRenderingContext2D, car: RaceCar, camX: number, camY: number): void {
    const spec = this.specs[car.carIndex];
    const w = spec.sprite.width;
    const h = spec.sprite.height;
    g.save();
    g.translate(Math.round(car.pos.x - camX), Math.round(car.pos.y - camY));
    // Sprites are drawn nose-up, so add a quarter turn to match the heading.
    g.rotate(car.heading + Math.PI / 2);
    g.drawImage(spec.shadow, -Math.round(w / 2) + 1, -Math.round(h / 2) + 2);
    g.drawImage(spec.sprite, -Math.round(w / 2), -Math.round(h / 2));
    g.restore();
  }

  private text(
    g: CanvasRenderingContext2D,
    str: string,
    x: number,
    y: number,
    color = '#f4f2ea',
  ): void {
    g.fillStyle = '#12141a';
    g.fillText(str, x + 1, y + 1);
    g.fillStyle = color;
    g.fillText(str, x, y);
  }

  /** Deliberately minimal: laps, position, speed and the key hints. */
  private drawHud(g: CanvasRenderingContext2D): void {
    const player = this.cars[0];
    const spec = this.specs[player.carIndex];
    g.font = '10px monospace';
    g.textBaseline = 'top';
    g.textAlign = 'left';

    this.text(g, `LAP ${player.displayLap(TOTAL_LAPS)}/${TOTAL_LAPS}`, 6, 6);
    this.text(g, `POS ${player.position}/${this.cars.length}`, 6, 18);
    this.text(g, `${Math.round(Math.abs(player.forwardSpeed) * 0.75)} KM/H`, 6, 30, spec.tint);

    g.textAlign = 'right';
    const w = this.canvas.width;
    this.text(g, this.track.def.name, w - 6, 6);
    this.text(g, spec.name, w - 6, 18, spec.tint);

    g.textAlign = 'center';
    g.font = '8px monospace';
    this.text(
      g,
      'WASD / ARROWS  SPACE DRIFT   1-2 TRACK   C CAR   R RESTART',
      this.canvas.width / 2,
      this.canvas.height - 12,
      '#c9c6bd',
    );

    if (player.finished) {
      g.font = '14px monospace';
      this.text(
        g,
        `FINISHED - P${player.position}`,
        this.canvas.width / 2,
        this.canvas.height / 2 - 10,
      );
      g.font = '9px monospace';
      this.text(g, 'PRESS R TO RACE AGAIN', this.canvas.width / 2, this.canvas.height / 2 + 8);
    } else if (this.bannerTimer > 0 && this.banner) {
      g.font = '11px monospace';
      this.text(g, this.banner, this.canvas.width / 2, 44);
    }
    g.textAlign = 'left';
  }

  // --- helpers used by the automated browser smoke test ---

  trackName(): string {
    return this.track.def.name;
  }

  carsDebug(): Array<Record<string, number | string | boolean>> {
    return this.cars.map((c) => ({
      name: c.name,
      isPlayer: c.isPlayer,
      x: Math.round(c.pos.x),
      y: Math.round(c.pos.y),
      speed: Math.round(c.speed),
      heading: Number(c.heading.toFixed(3)),
      lap: c.lap,
      displayLap: c.displayLap(TOTAL_LAPS),
      position: c.position,
      offTrack: c.offTrack,
      finished: c.finished,
    }));
  }

  /** Fast-forwards the running race with an AI standing in for the player. */
  autopilot(seconds: number): void {
    const stand = new AIDriver(this.cars[0], this.track, AI_SKILLS[0]);
    this.drivers.unshift(stand);
    for (let t = 0; t < seconds; t += STEP) this.step(STEP);
    this.drivers.shift();
    this.camera = { ...this.cars[0].pos };
  }

  /** Fast-forwards a full race with an AI standing in for the player. */
  simulateRace(maxSeconds: number): Record<string, unknown> {
    this.startRace();
    const stand = new AIDriver(this.cars[0], this.track, AI_SKILLS[0]);
    this.drivers.unshift(stand);
    let t = 0;
    while (t < maxSeconds && this.cars.some((c) => !c.finished)) {
      this.step(STEP);
      t += STEP;
    }
    const result = {
      seconds: Number(t.toFixed(1)),
      laps: this.cars.map((c) => c.lap),
      positions: this.cars.map((c) => c.position),
      finishTimes: this.cars.map((c) => Number(c.finishTime.toFixed(1))),
      allFinished: this.cars.every((c) => c.finished),
    };
    this.startRace();
    return result;
  }
}

/** Touching the sprite caches early keeps the first frame hitch-free. */
export function preloadArt(): void {
  getCarSpecs();
  getDecorSprites();
}
