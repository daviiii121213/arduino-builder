import { spriteFromMap, type Palette } from './pixel';

/** Roadside scenery, all hand-drawn as character maps (one char = one pixel). */

const TREE_MAP = [
  '.......DDDDDD.......',
  '.....DDGGGGGGDD.....',
  '....DGGGGGGGGGGD....',
  '...DGGGGGGGGGGGGD...',
  '..DGGLLLGGGGGGGGGD..',
  '..DGLLLLLGGGGGGGGD..',
  '.DGGLLLLLGGGGGGGGGD.',
  '.DGGGLLLGGGGGGGGGGD.',
  '.DGGGGGGGGGGGGGGGGD.',
  '.DGGGGGGGTTGGGGGGGD.',
  '.DGGGGGGGTTGGGGGGGD.',
  '.DGGGGGGGGGGGGGGGGD.',
  '.DGGGGGGGGGGGGGGGGD.',
  '..DGGGGGGGGGGGGGGD..',
  '..DGGGGGGGGGGGGGGD..',
  '...DGGGGGGGGGGGGD...',
  '....DGGGGGGGGGGD....',
  '.....DDGGGGGGDD.....',
  '.......DDDDDD.......',
];

const PINE_MAP = [
  '......DDDDDD......',
  '....DDGGGGGGDD....',
  '...DGGGGDDGGGGD...',
  '..DGGGGGDDGGGGGD..',
  '.DGGGGGGDDGGGGGGD.',
  '.DGGDGGGLLGGGDGGD.',
  'DGGGDGGLLLLGGDGGGD',
  'DGGGGDGLLLLGDGGGGD',
  'DGGGGDGLTTLGDGGGGD',
  'DGGGGDGLLLLGDGGGGD',
  'DGGGDGGLLLLGGDGGGD',
  '.DGGDGGGLLGGGDGGD.',
  '.DGGGGGGDDGGGGGGD.',
  '..DGGGGGDDGGGGGD..',
  '...DGGGGDDGGGGD...',
  '....DDGGGGGGDD....',
  '......DDDDDD......',
];

const ROCK_MAP = [
  '....KKKKKK....',
  '..KKMMMMMMKK..',
  '.KMLLMMMMMMMK.',
  'KMLLLMMMMMMMMK',
  'KMLLMMMMMMMDMK',
  'KMMMMMMMMMDDMK',
  'KMMMMMMMDDDDMK',
  'KMMMMMDDDDDDMK',
  '.KMMMDDDDDDMK.',
  '..KKMMDDDDMKK.',
  '....KKKKKKKK..',
];

const BUSH_MAP = [
  '...DDDD.....',
  '..DGGGGDD...',
  '.DGLLGGGGD..',
  'DGLLGGGGGGD.',
  'DGGGGGGGGGGD',
  'DGGGGGGGGGD.',
  '.DGGGGGGGD..',
  '..DDGGGDD...',
  '....DDD.....',
];

const TYRES_MAP = [
  '...KKKKKK...',
  '.KKTTTTTTKK.',
  'KTTTKKKKTTTK',
  'KTTKMMMMKTTK',
  'KTKMMMMMMKTK',
  'KTKMMMMMMKTK',
  'KTKMMMMMMKTK',
  'KTKMMMMMMKTK',
  'KTTKMMMMKTTK',
  'KTTTKKKKTTTK',
  '.KKTTTTTTKK.',
  '...KKKKKK...',
];

const BARRIER_MAP = [
  'KKKKKKKKKKKKKKKKKKKK',
  'KWWWRRRWWWRRRWWWRRRK',
  'KWWWRRRWWWRRRWWWRRRK',
  'KWWWRRRWWWRRRWWWRRRK',
  'KDDDDDDDDDDDDDDDDDDK',
  'KDDDDDDDDDDDDDDDDDDK',
  'KKKKKKKKKKKKKKKKKKKK',
];

const HAY_MAP = [
  '..KKKKKKKKKKKKKK..',
  '.KYYLLYYYYYYLLYYK.',
  'KYYLLYYYYYYYYLLYYK',
  'KYLLYYYYYYYYYYLLYK',
  'KYYYYLLYYYYYYYYYYK',
  'KYYYYYYYYLLYYYYYYK',
  'KYLLYYYYYYYYLLYYYK',
  'KYYYYYYLLYYYYYYYYK',
  'KYYLLYYYYYYYYLLYYK',
  'KDDDDDDDDDDDDDDDDK',
  '.KDDDDDDDDDDDDDDK.',
  '..KKKKKKKKKKKKKK..',
];

const CONE_MAP = [
  '...OO...',
  '..OOOO..',
  '..OWWO..',
  '.OOWWOO.',
  '.OOOOOO.',
  'OKKOOKKO',
  'OKKKKKKO',
  '.KKKKKK.',
];

const TREE_PAL: Palette = {
  D: '#173618',
  G: '#357a35',
  L: '#67b755',
  T: '#5a3a22',
  '.': null,
};

const PINE_PAL: Palette = {
  D: '#12301c',
  G: '#256b3a',
  L: '#4fa35c',
  T: '#4a3220',
  '.': null,
};

const ROCK_PAL: Palette = {
  K: '#3a3d45',
  M: '#7b8089',
  L: '#a9b0b8',
  D: '#4f545c',
  '.': null,
};

const TYRE_PAL: Palette = {
  K: '#141519',
  T: '#2a2c33',
  M: '#6c7079',
  '.': null,
};

const BARRIER_PAL: Palette = {
  K: '#17181d',
  W: '#e8e6df',
  R: '#c8332b',
  D: '#8f8d86',
  '.': null,
};

const HAY_PAL: Palette = {
  K: '#5c4318',
  Y: '#d7b558',
  L: '#f0dc94',
  D: '#9a7c34',
  '.': null,
};

const CONE_PAL: Palette = {
  O: '#e07a25',
  W: '#f5e7cf',
  K: '#2a2118',
  '.': null,
};

export type DecorKind =
  | 'tree'
  | 'pine'
  | 'rock'
  | 'bush'
  | 'tyres'
  | 'barrier'
  | 'hay'
  | 'cone';

/** Radius used for collisions; 0 means the prop is scenery you drive over. */
export const DECOR_RADIUS: Record<DecorKind, number> = {
  tree: 9,
  pine: 8,
  rock: 6,
  bush: 0,
  tyres: 6,
  barrier: 10,
  hay: 8,
  cone: 0,
};

const DEFS: Record<DecorKind, { map: string[]; palette: Palette }> = {
  tree: { map: TREE_MAP, palette: TREE_PAL },
  pine: { map: PINE_MAP, palette: PINE_PAL },
  rock: { map: ROCK_MAP, palette: ROCK_PAL },
  bush: { map: BUSH_MAP, palette: TREE_PAL },
  tyres: { map: TYRES_MAP, palette: TYRE_PAL },
  barrier: { map: BARRIER_MAP, palette: BARRIER_PAL },
  hay: { map: HAY_MAP, palette: HAY_PAL },
  cone: { map: CONE_MAP, palette: CONE_PAL },
};

export const DECOR_MAPS = DEFS;

let cache: Record<DecorKind, HTMLCanvasElement> | null = null;

export function getDecorSprites(): Record<DecorKind, HTMLCanvasElement> {
  if (!cache) {
    const out = {} as Record<DecorKind, HTMLCanvasElement>;
    (Object.keys(DEFS) as DecorKind[]).forEach((k) => {
      out[k] = spriteFromMap(DEFS[k].map, DEFS[k].palette);
    });
    cache = out;
  }
  return cache;
}
