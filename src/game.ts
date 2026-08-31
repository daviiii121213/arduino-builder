import { clamp } from './math';
import { ctx2d } from './pixel';
import { drawText } from './font';
import { getCarSpecs, type CarSpec } from './cars';
import { getDecorSprites } from './decor';
import { getWeatherIcons, getTrafficLight } from './icons';
import type { Controls } from './car';
import { buildTracks, type Track } from './tracks';
import { buildWorld, type World } from './world';
import { WEATHERS } from './weather';
import { Race, STEP } from './race';
import { Celebration } from './victory';
import { t } from './i18n';
import { Input } from './input';
import { MenuModel, type MenuAction, type MenuEvent } from './menu';
import { MenuRenderer, segmentBar } from './menuRender';
import { Audio } from './audio';

export const TOTAL_LAPS = 3;
/** Roughly how many world pixels tall the view should be; sets the zoom. */
const TARGET_VIEW_HEIGHT = 360;

const INK = '#0d1014';
const BONE = '#f2f0e8';
const DIM = '#98a0ad';

type Mode = 'menu' | 'race' | 'paused' | 'victory';

/** The app: a menu with a live race behind it, and the race itself. */
export class Game {
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private input: Input;
  private specs: CarSpec[];
  private tracks: Track[];
  private worlds = new Map<string, World>();
  private audio = new Audio();

  private menu: MenuModel;
  private menuUi = new MenuRenderer();
  private mode: Mode = 'menu';
  private race: Race | null = null;
  /** All-AI race running behind the menu, previewing the current selection. */
  private attract: Race | null = null;
  private attractKey = '';
  private resultsTimer = 0;
  private celebration: Celebration | null = null;
  private zoom = 2;
  private lastTs = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = ctx2d(canvas);
    this.input = new Input(canvas);
    this.specs = getCarSpecs();
    this.tracks = buildTracks();
    this.menu = new MenuModel(this.specs.length, this.tracks.length, WEATHERS.length);
    this.audio.apply(this.menu.sound);
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  private world(track: Track): World {
    let w = this.worlds.get(track.def.id);
    if (!w) {
      w = buildWorld(track);
      this.worlds.set(track.def.id, w);
    }
    return w;
  }

  private resize(): void {
    // Measure the element, not the window, so the game fits whatever box the
    // page gives it (full screen, or a panel under a header).
    const cssW = Math.max(320, this.canvas.clientWidth || window.innerWidth);
    const cssH = Math.max(240, this.canvas.clientHeight || window.innerHeight);
    this.zoom = clamp(Math.round(cssH / TARGET_VIEW_HEIGHT), 2, 5);
    this.canvas.width = Math.ceil(cssW / this.zoom);
    this.canvas.height = Math.ceil(cssH / this.zoom);
    this.g = ctx2d(this.canvas);
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

  // ---- menu ---------------------------------------------------------------

  private updateMenu(dt: number): void {
    this.menuUi.update(dt);
    const events: MenuEvent[] = [];

    // Every key press is replayed in order, so quick taps never get swallowed.
    const bindings: Record<string, MenuAction> = {
      arrowup: 'up',
      w: 'up',
      arrowdown: 'down',
      s: 'down',
      arrowleft: 'left',
      a: 'left',
      arrowright: 'right',
      d: 'right',
      enter: 'confirm',
      ' ': 'confirm',
      escape: 'back',
      backspace: 'back',
    };
    for (const key of this.input.keyPresses) {
      const action = bindings[key];
      if (action) events.push(...this.menu.input(action));
    }

    // A click selects the row under the pointer; a second click activates it.
    for (const click of this.input.clicks) {
      const hit = this.menuUi.hitBoxes.find(
        (b) => click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h,
      );
      if (!hit) continue;
      const wasSelected = this.menu.index === hit.index;
      events.push(...this.menu.select(hit.index));
      if (wasSelected) events.push(...this.menu.input('confirm'));
    }

    for (const event of events) {
      switch (event.type) {
        case 'move':
          this.audio.move();
          break;
        case 'confirm':
          this.audio.confirm();
          break;
        case 'back':
          this.audio.back();
          break;
        case 'sound':
          this.audio.apply(this.menu.sound);
          break;
        case 'start':
          this.beginRace(event.car, event.track, event.weather);
          break;
        case 'resume':
          if (this.race) this.mode = 'race';
          break;
        case 'quit':
          this.exitToMenu();
          break;
      }
    }

    // The attract race behind the menu always shows the current selection.
    if (this.mode === 'menu' || this.mode === 'paused') {
      const track = this.tracks[this.menu.trackIndex];
      const weather = WEATHERS[this.menu.weatherIndex];
      const key = `${track.def.id}:${weather.id}`;
      if (key !== this.attractKey || !this.attract) {
        this.attractKey = key;
        this.attract = new Race({
          track,
          weather,
          specs: this.specs,
          laps: 99,
          playerCarIndex: null,
          world: this.world(track),
          skipStart: true,
        });
      }
      this.attract.update(dt, this.canvas.width, this.canvas.height);
      this.audio.idleEngine();
    }
  }

  private beginRace(carIndex: number, trackIndex: number, weatherIndex: number): void {
    const track = this.tracks[trackIndex];
    this.race = new Race({
      track,
      weather: WEATHERS[weatherIndex],
      specs: this.specs,
      laps: TOTAL_LAPS,
      playerCarIndex: carIndex,
      world: this.world(track),
    });
    this.attract = null;
    this.attractKey = '';
    this.resultsTimer = 0;
    this.celebration = null;
    this.mode = 'race';
  }

  private exitToMenu(): void {
    this.race = null;
    this.celebration = null;
    this.mode = 'menu';
    this.menu.reset();
    this.audio.idleEngine();
    this.audio.back();
  }

  // ---- race ---------------------------------------------------------------

  private playerControls(): Controls {
    const up = this.input.held('w', 'arrowup');
    const down = this.input.held('s', 'arrowdown');
    const left = this.input.held('a', 'arrowleft');
    const right = this.input.held('d', 'arrowright');
    return {
      throttle: (up ? 1 : 0) + (down ? -1 : 0),
      steer: (right ? 1 : 0) + (left ? -1 : 0),
      handbrake: this.input.held(' '),
      nitro: this.input.held('shift'),
    };
  }

  private updateRace(dt: number): void {
    const race = this.race;
    if (!race) return;

    if (this.input.tapped('escape')) {
      this.menu.openPause();
      this.mode = 'paused';
      this.audio.idleEngine();
      this.audio.back();
      return;
    }
    if (this.input.tapped('r')) {
      this.beginRace(this.menu.carIndex, this.menu.trackIndex, this.menu.weatherIndex);
      return;
    }

    race.setPlayerControls(this.playerControls());
    race.update(dt, this.canvas.width, this.canvas.height);

    // One tone per lamp, and a higher one when the lights go out.
    const beat = race.takeStartBeat();
    if (beat !== null) {
      if (beat < 3) this.audio.move();
      else this.audio.confirm();
    }

    if (race.takeFinished()) {
      this.audio.fanfare();
      const player = race.player;
      // A podium finish gets its animation before the results board.
      if (player && player.position <= 3) {
        this.celebration = new Celebration(this.specs[player.carIndex], player.position);
        this.mode = 'victory';
        return;
      }
    }

    if (race.over) {
      this.resultsTimer += dt;
      if (this.input.tapped('enter', ' ')) this.exitToMenu();
    }

    const player = race.player;
    if (player && !race.over && race.released) {
      const ratio = clamp(Math.abs(player.forwardSpeed) / player.stats.maxSpeed, 0, 1);
      this.audio.updateEngine(ratio, player.controls.throttle > 0 ? 1 : 0, player.nitroActive);
    } else {
      this.audio.idleEngine();
    }
  }

  private updateVictory(dt: number): void {
    const show = this.celebration;
    if (!show) {
      this.mode = 'race';
      return;
    }
    this.audio.idleEngine();
    show.update(dt, this.canvas.width, this.canvas.height);
    if (this.input.tapped('enter', ' ', 'escape')) show.skip();
    if (show.done) {
      this.celebration = null;
      this.resultsTimer = 0;
      this.mode = 'race';
    }
  }

  private update(dt: number): void {
    // Browsers only allow audio to start inside a gesture.
    if (this.input.anyInput) this.audio.start();
    if (this.mode === 'menu' || this.mode === 'paused') this.updateMenu(dt);
    else if (this.mode === 'victory') this.updateVictory(dt);
    else this.updateRace(dt);
  }

  // ---- drawing ------------------------------------------------------------

  private render(): void {
    const g = this.g;
    const w = this.canvas.width;
    const h = this.canvas.height;
    g.imageSmoothingEnabled = false;

    if (this.mode === 'victory') {
      this.celebration?.draw(g, w, h);
      return;
    }

    const backdrop = this.mode === 'menu' ? this.attract : this.race;
    if (backdrop) backdrop.render(g, w, h);
    else {
      g.fillStyle = INK;
      g.fillRect(0, 0, w, h);
    }

    if (this.mode === 'menu' || this.mode === 'paused') {
      this.menuUi.draw(g, w, h, this.menu, {
        specs: this.specs,
        tracks: this.tracks,
        weathers: WEATHERS,
      });
    } else {
      this.drawHud(g, w, h);
    }
  }

  /** Race HUD: laps, position, speed and the nitro gauge. */
  private drawHud(g: CanvasRenderingContext2D, w: number, h: number): void {
    const race = this.race;
    const player = race?.player;
    if (!race || !player) return;
    const spec = this.specs[player.carIndex];

    drawText(g, `${t('lap')} ${player.displayLap(TOTAL_LAPS)}/${TOTAL_LAPS}`, 8, 8, {
      scale: 2,
      color: BONE,
      shadow: INK,
    });
    drawText(g, `${t('pos')} ${player.position}/${race.cars.length}`, 8, 24, {
      scale: 2,
      color: BONE,
      shadow: INK,
    });

    drawText(g, race.track.def.name, w - 8, 8, { scale: 1, color: BONE, shadow: INK, align: 'right' });
    const icon = getWeatherIcons()[race.weather.id];
    g.drawImage(icon, w - 8 - icon.width, 18);

    // Speed and the nitro gauge sit together in the bottom-left corner.
    const baseY = h - 30;
    const kmh = `${Math.round(Math.abs(player.forwardSpeed) * 0.75)}`;
    const speedW = drawText(g, kmh, 8, baseY - 14, { scale: 2, color: spec.tint, shadow: INK });
    drawText(g, t('kmh'), 8 + speedW + 4, baseY - 8, { scale: 1, color: DIM, shadow: INK });

    const barW = 104;
    const flashing = player.nitroActive && Math.floor(race.time * 14) % 2 === 0;
    const empty = player.nitroLocked;
    drawText(g, t('nitro'), 8, baseY + 2, {
      scale: 1,
      color: empty ? '#8a3b3b' : player.nitroActive ? BONE : '#59d8f0',
      shadow: INK,
    });
    segmentBar(
      g,
      8 + 32,
      baseY,
      barW,
      10,
      player.nitroRatio,
      flashing ? '#bff6ff' : empty ? '#5c2b2b' : '#59d8f0',
      10,
    );
    if (player.nitroActive) {
      // Little exhaust ticks either side of the gauge while it burns.
      g.fillStyle = flashing ? '#ffd75e' : '#ff9a3c';
      g.fillRect(8 + 32 + barW + 3, baseY + 2, 2, 6);
      g.fillRect(8 + 32 + barW + 6, baseY + 4, 2, 2);
    }

    if (player.blinking) {
      // Tell the player why the car is flickering and being moved.
      drawText(g, t('recovering'), w / 2, h - 46, {
        scale: 1,
        color: Math.floor(race.time * 6) % 2 === 0 ? '#f2c14e' : BONE,
        shadow: INK,
        align: 'center',
      });
    }

    this.drawStartSequence(g, w, h, race);
    if (race.over) this.drawResults(g, w, h, race);
  }

  /** The gantry lights, centred over the track. */
  private drawStartSequence(g: CanvasRenderingContext2D, w: number, h: number, race: Race): void {
    const signal = race.startSignal;
    if (signal.kind === 'none') return;
    const cx = Math.round(w / 2);

    // A soft band behind the sequence so it reads over the pack and the tarmac.
    g.fillStyle = 'rgba(8,10,16,0.35)';
    g.fillRect(0, Math.round(h * 0.12), w, Math.round(h * 0.36));

    if (signal.kind === 'go') {
      const flash = Math.floor(race.startTime * 12) % 2 === 0;
      drawText(g, t('go'), cx, Math.round(h * 0.3), {
        scale: 8,
        color: flash ? '#5fd06a' : BONE,
        shadow: INK,
        align: 'center',
      });
      return;
    }

    const light = getTrafficLight(signal.state);
    const scale = 3;
    const lw = light.width * scale;
    const lh = light.height * scale;
    const lx = Math.round(cx - lw / 2);
    const ly = Math.round(h * 0.18);
    g.imageSmoothingEnabled = false;
    g.drawImage(light, lx, ly, lw, lh);

    // A soft glow behind whichever lamp is burning.
    // Fractions of the sprite height where each lamp actually sits.
    const lampY = signal.state === 'green' ? 0.62 : signal.state === 'redYellow' ? 0.41 : 0.19;
    const glow = signal.state === 'green' ? '#57e05a' : signal.state === 'redYellow' ? '#ffd53d' : '#ff4438';
    g.globalAlpha = 0.25;
    g.fillStyle = glow;
    g.fillRect(lx - 5, Math.round(ly + lh * lampY), lw + 10, 12);
    g.fillRect(lx - 9, Math.round(ly + lh * lampY) + 3, lw + 18, 6);
    g.globalAlpha = 1;
  }

  private drawResults(g: CanvasRenderingContext2D, w: number, h: number, race: Race): void {
    const standings = race.standings();
    const pw = 200;
    const rows = standings.length;
    const ph = rows * 12 + 54;
    const px = Math.round((w - pw) / 2);
    const py = Math.round((h - ph) / 2);

    g.fillStyle = 'rgba(8,10,16,0.78)';
    g.fillRect(0, 0, w, h);
    g.fillStyle = INK;
    g.fillRect(px - 2, py - 2, pw + 4, ph + 4);
    g.fillStyle = '#232936';
    g.fillRect(px, py, pw, ph);

    const player = race.player;
    drawText(g, player ? `${t('finished')}  P${player.position}` : t('results'), px + pw / 2, py + 8, {
      scale: 2,
      color: BONE,
      shadow: INK,
      align: 'center',
    });
    // Chequered rule under the heading, echoing the start/finish line.
    for (let i = 0; i * 4 < pw - 16; i++) {
      g.fillStyle = i % 2 === 0 ? BONE : INK;
      g.fillRect(px + 8 + i * 4, py + 23, 4, 2);
      g.fillStyle = i % 2 === 0 ? INK : BONE;
      g.fillRect(px + 8 + i * 4, py + 25, 4, 2);
    }

    standings.forEach((car, i) => {
      const y = py + 32 + i * 12;
      const mine = car.isPlayer;
      const spec = this.specs[car.carIndex];
      drawText(g, `${car.position}`, px + 10, y, { scale: 1, color: mine ? BONE : DIM });
      drawText(g, car.name, px + 24, y, { scale: 1, color: mine ? spec.tint : DIM });
      drawText(g, car.finished ? `${car.finishTime.toFixed(1)}S` : '-', px + pw - 10, y, {
        scale: 1,
        color: mine ? BONE : DIM,
        align: 'right',
      });
    });

    if (this.resultsTimer > 0.8 && Math.floor(this.resultsTimer * 2) % 2 === 0) {
      drawText(g, t('resultsHint'), px + pw / 2, py + ph - 12, {
        scale: 1,
        color: BONE,
        align: 'center',
      });
    }
  }

  // ---- helpers used by the automated browser smoke test --------------------

  trackName(): string {
    return (this.race ?? this.attract)?.track.def.name ?? this.tracks[this.menu.trackIndex].def.name;
  }

  menuState(): Record<string, string | number | boolean> {
    const race = this.race;
    return {
      mode: this.mode,
      screen: this.menu.screen,
      index: this.menu.index,
      car: this.menu.carIndex,
      track: this.menu.trackIndex,
      weather: this.menu.weatherIndex,
      language: this.menu.language,
      released: race ? race.released : true,
      startTime: race ? Number(race.startTime.toFixed(2)) : 0,
      startSignal: race ? race.startSignal.kind : 'none',
      celebrating: this.celebration !== null,
      place: this.celebration ? this.celebration.place : 0,
    };
  }

  /** Plays the podium scene for a given place; used by the browser test. */
  showVictory(place: number, carIndex = this.menu.carIndex): void {
    this.celebration = new Celebration(this.specs[carIndex], place);
    this.mode = 'victory';
  }

  /** Skips the start sequence; used by the automated browser test. */
  releaseStart(): void {
    this.race?.start.skip();
  }

  carsDebug(): Array<Record<string, number | string | boolean>> {
    const race = this.race ?? this.attract;
    if (!race) return [];
    return race.cars.map((c) => ({
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
      nitro: Number(c.nitro.toFixed(2)),
      nitroActive: c.nitroActive,
      recovery: c.recovery,
      offTrackTime: Number(c.offTrackTime.toFixed(2)),
    }));
  }

  /** Fast-forwards the running race with an AI standing in for the player. */
  autopilot(seconds: number): void {
    (this.race ?? this.attract)?.autopilot(seconds);
  }

  /** Runs a whole race headlessly and reports how it finished. */
  simulateRace(maxSeconds: number): Record<string, unknown> {
    const race = this.race;
    if (!race) return { error: 'not racing' };
    let t = 0;
    while (t < maxSeconds && race.cars.some((c) => !c.finished)) {
      race.autopilot(STEP);
      t += STEP;
    }
    return {
      seconds: Number(t.toFixed(1)),
      laps: race.cars.map((c) => c.lap),
      positions: race.cars.map((c) => c.position),
      finishTimes: race.cars.map((c) => Number(c.finishTime.toFixed(1))),
      allFinished: race.cars.every((c) => c.finished),
    };
  }
}

/** Touching the sprite caches early keeps the first frame hitch-free. */
export function preloadArt(): void {
  getCarSpecs();
  getDecorSprites();
  getWeatherIcons();
}
