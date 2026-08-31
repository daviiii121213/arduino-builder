import { spriteFromMap, type Palette } from './pixel';

/** Weather icons for the picker, drawn pixel by pixel like everything else. */

const SUN_MAP = [
  '................',
  '.......##.......',
  '...#...##...#...',
  '....#..##..#....',
  '......####......',
  '....#OOOOOO#....',
  '..##OOWWWWOO##..',
  '....OOWWWWOO....',
  '....OOOOOOOO....',
  '..##OOOOOOOO##..',
  '....#OOOOOO#....',
  '......####......',
  '....#..##..#....',
  '...#...##...#...',
  '.......##.......',
  '................',
];

const RAIN_MAP = [
  '................',
  '.....CCCC.......',
  '...CCLLLLCC.....',
  '..CCLLLLLLCC....',
  '.CCLLLLLLLLCCC..',
  '.CCCCCCCCCCCCC..',
  '..CCCCCCCCCCC...',
  '................',
  '...D...D...D....',
  '...D...D...D....',
  '................',
  '....D...D...D...',
  '....D...D...D...',
  '................',
  '..D...D...D.....',
  '..D...D...D.....',
];

const NIGHT_MAP = [
  '................',
  '.......MMMM.....',
  '.....MMMMMMM....',
  '....MMMM...MM...',
  '...MMMM.....M...',
  '...MMM..........',
  '..MMMM..........',
  '..MMMM.......S..',
  '..MMMM..........',
  '...MMM.......S..',
  '...MMMM.....M...',
  '....MMMM...MM...',
  '.....MMMMMMM....',
  '.......MMMM.....',
  '..S.............',
  '................',
];

const SUN_PAL: Palette = { '#': '#e8a92c', O: '#ffd75e', W: '#fff3c4', '.': null };
const RAIN_PAL: Palette = { C: '#5f7186', L: '#93a4b8', D: '#8fc4e8', '.': null };
const NIGHT_PAL: Palette = { M: '#dfe4f2', S: '#fff3c4', '.': null };

/** Start-line gantry light: one housing, three lamps, four lit states. */
const LIGHT_MAP = [
  '......KKKK......',
  '......KMMK......',
  '...KKKKMMKKKK...',
  '..KHHHHHHHHHHK..',
  '..KHHHRRRRHHHK..',
  '..KHHRRRRRRHHK..',
  '..KHHRRRRRRHHK..',
  '..KHHHRRRRHHHK..',
  '..KHHHHHHHHHHK..',
  '..KHHHYYYYHHHK..',
  '..KHHYYYYYYHHK..',
  '..KHHYYYYYYHHK..',
  '..KHHHYYYYHHHK..',
  '..KHHHHHHHHHHK..',
  '..KHHHGGGGHHHK..',
  '..KHHGGGGGGHHK..',
  '..KHHGGGGGGHHK..',
  '..KHHHGGGGHHHK..',
  '..KHHHHHHHHHHK..',
  '...KKKKKKKKKK...',
  '......KMMK......',
  '......KMMK......',
  '.....KKMMKK.....',
];

export type LightState = 'off' | 'red' | 'redYellow' | 'green';

const LAMP_OFF = { R: '#4a1d1d', Y: '#4a411d', G: '#1d4a24' };
const LAMP_ON = { R: '#ff4438', Y: '#ffd53d', G: '#57e05a' };

function lightPalette(state: LightState): Palette {
  return {
    K: '#14161c',
    H: '#3a3f4a',
    M: '#5a6172',
    R: state === 'red' || state === 'redYellow' ? LAMP_ON.R : LAMP_OFF.R,
    Y: state === 'redYellow' ? LAMP_ON.Y : LAMP_OFF.Y,
    G: state === 'green' ? LAMP_ON.G : LAMP_OFF.G,
    '.': null,
  };
}

const lightCache = new Map<LightState, HTMLCanvasElement>();

/** The start light in one of its four states, built once each. */
export function getTrafficLight(state: LightState): HTMLCanvasElement {
  let cv = lightCache.get(state);
  if (!cv) {
    cv = spriteFromMap(LIGHT_MAP, lightPalette(state));
    lightCache.set(state, cv);
  }
  return cv;
}

export const LIGHT_MAP_ROWS = LIGHT_MAP;

const DEFS: Record<string, { map: string[]; palette: Palette }> = {
  sunny: { map: SUN_MAP, palette: SUN_PAL },
  rain: { map: RAIN_MAP, palette: RAIN_PAL },
  night: { map: NIGHT_MAP, palette: NIGHT_PAL },
};

export const ICON_MAPS = DEFS;

let cache: Record<string, HTMLCanvasElement> | null = null;

export function getWeatherIcons(): Record<string, HTMLCanvasElement> {
  if (!cache) {
    cache = {};
    for (const [k, def] of Object.entries(DEFS)) cache[k] = spriteFromMap(def.map, def.palette);
  }
  return cache;
}
