import { spriteFromMap, makeCanvas, ctx2d, type Palette } from './pixel';

/**
 * Every car is drawn as a character map, one char per pixel, nose pointing up.
 * K outline  D body shade  B body  L body highlight  S stripe
 * G glass    W glass glint H headlight R tail light  M chrome  T tyre
 */

const BOLT_MAP = [
  '....KKKKKKKK....',
  '...KHHKKKKHHK...',
  '..KKLLLLLLLLKK..',
  '..KDBBBBBBBBDK..',
  '.KKDBBBBBBBBDKK.',
  'TTKDBBBBBBBBDKTT',
  'TTKDBBSSSSBBDKTT',
  'TTKDBBSSSSBBDKTT',
  '.KKDBBSSSSBBDKK.',
  '..KDBGGGGGGBDK..',
  '..KDGGGWWGGGDK..',
  '..KDGGGGGGGGDK..',
  '..KDBGGGGGGBDK..',
  '..KDBBSSSSBBDK..',
  '..KDBBSSSSBBDK..',
  '..KDBBSSSSBBDK..',
  '..KDBBSSSSBBDK..',
  '..KDBGGGGGGBDK..',
  '..KDGGGGGGGGDK..',
  '..KDBGGGGGGBDK..',
  '.KKDBBSSSSBBDKK.',
  'TTKDBBSSSSBBDKTT',
  'TTKDBBSSSSBBDKTT',
  'TTKDBBBBBBBBDKTT',
  '.KKDBBBBBBBBDKK.',
  '..KKLLLLLLLLKK..',
  '...KRRKKKKRRK...',
  '....KKKKKKKK....',
];

const COMET_MAP = [
  '.....KKKK.....',
  '....KHHHHK....',
  '...KKLLLLKK...',
  '..KDBBBBBBDK..',
  '.KDBBBBBBBBDK.',
  'TKDBBBBBBBBDKT',
  'TKDBBGGGGBBDKT',
  'TKDBGGWWGGBDKT',
  'TKDBGGGGGGBDKT',
  '.KDBBGGGGBBDK.',
  '.KDBBBBBBBBDK.',
  '.KDBSSSSSSBDK.',
  '.KDBSSSSSSBDK.',
  '.KDBBBBBBBBDK.',
  '.KDBBBBBBBBDK.',
  '.KDBBSSSSBBDK.',
  '.KDBBSSSSBBDK.',
  '.KDBBBBBBBBDK.',
  '.KDBBBBBBBBDK.',
  '.KDBGGGGGGBDK.',
  '.KDGGGGGGGGDK.',
  '.KDBGGGGGGBDK.',
  '.KDBBBBBBBBDK.',
  '.KDBBSSSSBBDK.',
  '.KDBBSSSSBBDK.',
  'TKDBBBBBBBBDKT',
  'TKDBBBBBBBBDKT',
  'TKDBBBBBBBBDKT',
  '.KDBBBBBBBBDK.',
  '..KKLLLLLLKK..',
  '...KRRRRRRK...',
  '....KKKKKK....',
];

const PEBBLE_MAP = [
  '...KKKKKKKKKK...',
  '..KHHKKKKKKHHK..',
  '..KLLLLLLLLLLK..',
  '.KKDBBBBBBBBDKK.',
  'TTKDBGGGGGGBDKTT',
  'TTKDGGGWWGGGDKTT',
  'TTKDGGGGGGGGDKTT',
  '.KKDBGGGGGGBDKK.',
  '..KDBBBBBBBBDK..',
  '..KDBSSSSSSBDK..',
  '..KDBSSSSSSBDK..',
  '..KDBBBBBBBBDK..',
  '..KDBBBBBBBBDK..',
  '..KDBSSSSSSBDK..',
  '..KDBSSSSSSBDK..',
  '..KDBBBBBBBBDK..',
  '.KKDBGGGGGGBDKK.',
  'TTKDGGGGGGGGDKTT',
  'TTKDGGGGGGGGDKTT',
  'TTKDBGGGGGGBDKTT',
  '.KKDBBBBBBBBDKK.',
  '..KLLLLLLLLLLK..',
  '..KRRKKKKKKRRK..',
  '...KKKKKKKKKK...',
];

const BOULDER_MAP = [
  '.....KKKKKKKK.....',
  '....KHHKKKKHHK....',
  '...KKMMMMMMMMKK...',
  '..KKDBBBBBBBBDKK..',
  '.KKDBBBBBBBBBBDKK.',
  'TTKDBBBBBBBBBBDKTT',
  'TTKDBBSSSSSSBBDKTT',
  'TTKDBBSSSSSSBBDKTT',
  'TTKDBBSSSSSSBBDKTT',
  '.KKDBBSSSSSSBBDKK.',
  '..KDBBBSSSSBBBDK..',
  '..KDBGGGGGGGGBDK..',
  '..KDGGGGWWGGGGDK..',
  '..KDGGGGGGGGGGDK..',
  '..KDBGGGGGGGGBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBGGGGGGGGBDK..',
  '..KDGGGGGGGGGGDK..',
  '..KDBGGGGGGGGBDK..',
  '.KKDBBBBBBBBBBDKK.',
  'TTKDBBBBBBBBBBDKTT',
  'TTKDBBBBBBBBBBDKTT',
  'TTKDBBBBBBBBBBDKTT',
  '.KKDBBBBBBBBBBDKK.',
  '...KKMMMMMMMMKK...',
  '....KRRKKKKRRK....',
  '.....KKKKKKKK.....',
];

const ZEPHYR_MAP = [
  '.....KKKK.....',
  '....KHHHHK....',
  '....KLLLLK....',
  'TTKKKBBBBKKKTT',
  'TTKDBBBBBBDKTT',
  'TTKDBBBBBBDKTT',
  '.KKDBBBBBBDKK.',
  '..KDBGGGGBDK..',
  '..KDGGWWGGDK..',
  '..KDGGGGGGDK..',
  '..KDBGGGGBDK..',
  '..KDBBSSBBDK..',
  '..KDBBSSBBDK..',
  '..KDBBBBBBDK..',
  '.KKDBBBBBBDKK.',
  'TTKDBBBBBBDKTT',
  'TTKDBMMMMBDKTT',
  'TTKDBMMMMBDKTT',
  'TTKKKBBBBKKKTT',
  '....KLLLLK....',
  '....KRRRRK....',
  '.....KKKK.....',
];

const VULCAN_MAP = [
  '....KKKKKKKKKK....',
  '...KHHKMMMMKHHK...',
  '..KKLLKMMMMKLLKK..',
  '..KDBBKMMMMKBBDK..',
  '.KKDBBKMMMMKBBDKK.',
  'TTKDBBBKMMKBBBDKTT',
  'TTKDBBBBBBBBBBDKTT',
  'TTKDBBSSSSSSBBDKTT',
  '.KKDBBSSSSSSBBDKK.',
  '..KDBBSSSSSSBBDK..',
  '..KDBGGGGGGGGBDK..',
  '..KDGGGWWWWGGGDK..',
  '..KDGGGGGGGGGGDK..',
  '..KDBGGGGGGGGBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBBSSSSSSBBDK..',
  '..KDBBBBBBBBBBDK..',
  '..KDBLLLLLLLLBDK..',
  '..KDBBBBBBBBBBDK..',
  '.KKDBBBBBBBBBBDKK.',
  'TTTKDBBBBBBBBDKTTT',
  'TTTKDBBBBBBBBDKTTT',
  'TTTKDBBBBBBBBDKTTT',
  'TTTKDBBBBBBBBDKTTT',
  '.KKDBBBBBBBBBBDKK.',
  '..KKMMMMMMMMMMKK..',
  '..KRRKKKKKKKKRRK..',
  '...KKKKKKKKKKKK...',
];

export interface CarStats {
  /** Top speed on clean asphalt, world pixels per second. */
  maxSpeed: number;
  /** Forward acceleration, px/s^2. */
  accel: number;
  /** Braking force when reversing the throttle, px/s^2. */
  brake: number;
  /** Top speed while reversing. */
  reverseMax: number;
  /** Steering rate in radians/second at speed. */
  turnRate: number;
  /** Lateral grip; lower slides more. */
  grip: number;
  /** Rolling drag. */
  drag: number;
  /** Used by collisions; heavier cars shove lighter ones. */
  mass: number;
  /** Collision radius. */
  radius: number;
  /** Seconds of nitro the tank holds. */
  nitroCapacity: number;
  /** Top speed and acceleration multiplier while the nitro is burning. */
  nitroBoost: number;
  /** Nitro refilled per second while not boosting. */
  nitroRegen: number;
  /**
   * Speeds (world px/s) at which the box shifts up. One entry per change, so
   * five entries is a six-speed and four is a five-speed.
   */
  shiftUp: number[];
  /** Brake condition lost per second of hard braking, in percent. */
  brakeWear: number;
}

export interface CarSpec {
  id: string;
  name: string;
  /** One line for the car select screen, in both languages. */
  blurb: string;
  blurbPt: string;
  stats: CarStats;
  sprite: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  /** Colour used for dust/skid tint and minimal HUD readouts. */
  tint: string;
}

interface CarDef {
  id: string;
  name: string;
  blurb: string;
  blurbPt: string;
  map: string[];
  palette: Palette;
  tint: string;
  stats: CarStats;
}

const OUTLINE = '#14161c';
const GLASS = '#2f4a63';
const GLINT = '#8fc4e0';
const HEAD = '#ffe9a8';
const TAIL = '#e04a3a';
const TYRE = '#1b1d22';
const CHROME = '#9aa3ad';

function pal(dark: string, body: string, light: string, stripe: string): Palette {
  return {
    K: OUTLINE,
    D: dark,
    B: body,
    L: light,
    S: stripe,
    G: GLASS,
    W: GLINT,
    H: HEAD,
    R: TAIL,
    M: CHROME,
    T: TYRE,
    '.': null,
  };
}

/** Flat dark silhouette of a sprite, used as the drop shadow. */
function silhouette(map: string[]): HTMLCanvasElement {
  const h = map.length;
  const w = map.reduce((m, r) => Math.max(m, r.length), 0);
  const cv = makeCanvas(w, h);
  const g = ctx2d(cv);
  g.fillStyle = 'rgba(0,0,0,0.32)';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < map[y].length; x++) {
      if (map[y][x] !== '.') g.fillRect(x, y, 1, 1);
    }
  }
  return cv;
}

const DEFS: CarDef[] = [
  {
    id: 'bolt',
    name: 'BOLT',
    blurb: 'The all-rounder. Nothing to relearn, nothing to fear.',
    blurbPt: 'O equilibrado. Nada para reaprender, nada a temer.',
    map: BOLT_MAP,
    palette: pal('#8c2020', '#d63b32', '#f27a68', '#f6e4c8'),
    tint: '#d63b32',
    stats: {
      maxSpeed: 300,
      accel: 250,
      brake: 340,
      reverseMax: 110,
      turnRate: 2.7,
      grip: 6.5,
      drag: 0.45,
      mass: 1,
      radius: 11,
      nitroCapacity: 4,
      nitroBoost: 1.28,
      nitroRegen: 0.35,
      shiftUp: [55, 105, 158, 210, 258],
      brakeWear: 1.8,
    },
  },
  {
    id: 'comet',
    name: 'COMET',
    blurb: 'Fastest thing here once it is rolling. Getting rolling takes a while.',
    blurbPt: 'O mais rápido depois que embala. Embalar é que demora.',
    map: COMET_MAP,
    palette: pal('#1c4c78', '#2f7fc4', '#79c2f0', '#ffd45e'),
    tint: '#2f7fc4',
    stats: {
      maxSpeed: 345,
      accel: 195,
      brake: 300,
      reverseMax: 100,
      turnRate: 2.2,
      grip: 5.6,
      drag: 0.38,
      mass: 1,
      radius: 11,
      nitroCapacity: 3,
      nitroBoost: 1.22,
      nitroRegen: 0.28,
      shiftUp: [62, 124, 186, 248, 302],
      brakeWear: 2.2,
    },
  },
  {
    id: 'pebble',
    name: 'PEBBLE',
    blurb: 'Slowest on the straight, untouchable through the corners.',
    blurbPt: 'O mais lento na reta, imbatível nas curvas.',
    map: PEBBLE_MAP,
    palette: pal('#6b7a1e', '#b7cc35', '#e2f07a', '#3a4a1c'),
    tint: '#b7cc35',
    stats: {
      maxSpeed: 268,
      accel: 295,
      brake: 380,
      reverseMax: 120,
      turnRate: 3.25,
      grip: 7.6,
      drag: 0.5,
      mass: 0.85,
      radius: 10,
      nitroCapacity: 5,
      nitroBoost: 1.32,
      nitroRegen: 0.5,
      shiftUp: [58, 114, 172, 224],
      brakeWear: 1.2,
    },
  },
  {
    id: 'boulder',
    name: 'BOULDER',
    blurb: 'Heavy. Wins every touch, pays for it on turn-in.',
    blurbPt: 'Pesado. Vence todo toque e paga na entrada da curva.',
    map: BOULDER_MAP,
    palette: pal('#4a2c66', '#7c4bb0', '#b78ce0', '#e8e2f2'),
    tint: '#7c4bb0',
    stats: {
      maxSpeed: 292,
      accel: 215,
      brake: 330,
      reverseMax: 105,
      turnRate: 2.35,
      grip: 6.9,
      drag: 0.42,
      mass: 1.35,
      radius: 12,
      nitroCapacity: 4.5,
      nitroBoost: 1.25,
      nitroRegen: 0.34,
      shiftUp: [64, 126, 188, 244],
      brakeWear: 2.6,
    },
  },
  {
    id: 'zephyr',
    name: 'ZEPHYR',
    blurb: 'A kart with delusions. Feather-light, and the tank never seems to empty.',
    blurbPt: 'Um kart com pretensão. Leve como pena e com tanque que não acaba.',
    map: ZEPHYR_MAP,
    palette: pal('#0f6b74', '#22b5c4', '#8ef0f5', '#f2f0e8'),
    tint: '#22b5c4',
    stats: {
      maxSpeed: 275,
      accel: 310,
      brake: 400,
      reverseMax: 125,
      turnRate: 3.4,
      grip: 8,
      drag: 0.52,
      mass: 0.72,
      radius: 10,
      nitroCapacity: 6,
      nitroBoost: 1.3,
      nitroRegen: 0.55,
      shiftUp: [44, 88, 132, 178, 228],
      brakeWear: 1,
    },
  },
  {
    id: 'vulcan',
    name: 'VULCAN',
    blurb: 'Half engine, half bodywork. Enormous tank, brutal boost, glacial refill.',
    blurbPt: 'Metade motor, metade lataria. Tanque enorme, impulso brutal, recarga lenta.',
    map: VULCAN_MAP,
    palette: pal('#8a3a10', '#e2701c', '#f7b45a', '#1b1d22'),
    tint: '#e2701c',
    stats: {
      maxSpeed: 318,
      accel: 230,
      brake: 320,
      reverseMax: 100,
      turnRate: 2.3,
      grip: 6.2,
      drag: 0.4,
      mass: 1.25,
      radius: 12,
      nitroCapacity: 7.5,
      nitroBoost: 1.38,
      nitroRegen: 0.22,
      shiftUp: [70, 138, 204, 268],
      brakeWear: 2.4,
    },
  },
];

/** Stats only — safe to import outside the browser (tests, headless sim). */
export const CAR_STATS: Array<{
  id: string;
  name: string;
  blurb: string;
  blurbPt: string;
  stats: CarStats;
}> = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  blurb: d.blurb,
  blurbPt: d.blurbPt,
  stats: d.stats,
}));

export const CAR_MAPS: Array<{ id: string; map: string[] }> = DEFS.map((d) => ({
  id: d.id,
  map: d.map,
}));

/**
 * Second liveries. A tournament runs twelve entries drawn from the same six
 * cars, so each model fields a second car in its own colours: same shape, same
 * stats, unmistakably a different entry on track.
 */
const LIVERY_B: Record<string, [string, string, string, string]> = {
  bolt: ['#1f4f6b', '#38a2c8', '#8fdcef', '#12222c'],
  comet: ['#6b1f5a', '#c23fa0', '#f08fd8', '#2b0f24'],
  pebble: ['#7a4a12', '#e0912a', '#f7cc7a', '#3a2408'],
  boulder: ['#1d5137', '#2f9c66', '#7fdcaa', '#0e2a1c'],
  zephyr: ['#7a2020', '#d64545', '#f79a9a', '#2c0d0d'],
  vulcan: ['#3a3f4a', '#8b95a6', '#d7dde6', '#14161c'],
};

let cache: CarSpec[] | null = null;
let tournamentCache: CarSpec[] | null = null;

/**
 * The twelve tournament entries: every car in its own colours, then every car
 * again in its second livery, named "II".
 */
export function getTournamentSpecs(): CarSpec[] {
  if (!tournamentCache) {
    const first = getCarSpecs();
    const second = DEFS.map((d) => {
      const alt = LIVERY_B[d.id] ?? ['#333', '#777', '#bbb', '#111'];
      const palette = pal(alt[0], alt[1], alt[2], alt[3]);
      return {
        id: `${d.id}-ii`,
        name: `${d.name} II`,
        blurb: d.blurb,
        blurbPt: d.blurbPt,
        stats: d.stats,
        tint: alt[1],
        sprite: spriteFromMap(d.map, palette),
        shadow: silhouette(d.map),
      };
    });
    tournamentCache = [...first, ...second];
  }
  return tournamentCache;
}

/** Builds (once) the sprite canvases for all four cars. */
export function getCarSpecs(): CarSpec[] {
  if (!cache) {
    cache = DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      blurb: d.blurb,
      blurbPt: d.blurbPt,
      stats: d.stats,
      tint: d.tint,
      sprite: spriteFromMap(d.map, d.palette),
      shadow: silhouette(d.map),
    }));
  }
  return cache;
}
