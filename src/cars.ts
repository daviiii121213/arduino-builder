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
}

export interface CarSpec {
  id: string;
  name: string;
  stats: CarStats;
  sprite: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  /** Colour used for dust/skid tint and minimal HUD readouts. */
  tint: string;
}

interface CarDef {
  id: string;
  name: string;
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
    },
  },
  {
    id: 'comet',
    name: 'COMET',
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
    },
  },
  {
    id: 'pebble',
    name: 'PEBBLE',
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
    },
  },
  {
    id: 'boulder',
    name: 'BOULDER',
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
    },
  },
];

/** Stats only — safe to import outside the browser (tests, headless sim). */
export const CAR_STATS: Array<{ id: string; name: string; stats: CarStats }> = DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  stats: d.stats,
}));

export const CAR_MAPS: Array<{ id: string; map: string[] }> = DEFS.map((d) => ({
  id: d.id,
  map: d.map,
}));

let cache: CarSpec[] | null = null;

/** Builds (once) the sprite canvases for all four cars. */
export function getCarSpecs(): CarSpec[] {
  if (!cache) {
    cache = DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      stats: d.stats,
      tint: d.tint,
      sprite: spriteFromMap(d.map, d.palette),
      shadow: silhouette(d.map),
    }));
  }
  return cache;
}
