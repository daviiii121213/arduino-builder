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
