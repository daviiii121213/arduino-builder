import { spriteFromMap, type Palette } from './pixel';

/**
 * The drivers who climb out of the cars on the podium. Three builds, two poses
 * each (stood beside the car, then arms raised), painted in their car's colours
 * with its own helmet crest — one recognisable character per car.
 */

const STANDARD_IDLE = [
  '....HHHHHH....',
  '...HHHHHHHH...',
  '..HHCCCCCCHH..',
  '..HHHHHHHHHH..',
  '..HVVVVVVVVH..',
  '..HVVVVVVVVH..',
  '..HHHHHHHHHH..',
  '...KKKKKKKK...',
  '..SSSSSSSSSS..',
  '.SSSSSSSSSSSS.',
  '.SSTTTTTTTTSS.',
  '.SSTTTTTTTTSS.',
  '.SSSSSSSSSSSS.',
  '.SSSSSSSSSSSS.',
  '..SSSSSSSSSS..',
  '..SS.PPPP.SS..',
  '..SS.PPPP.SS..',
  '...S.PPPP.S...',
  '.....PPPP.....',
  '....PP..PP....',
  '...BB....BB...',
  '...BB....BB...',
];

const STANDARD_CHEER = [
  '.....SSSS.....',
  '....SS..SS....',
  '...SS.HH.SS...',
  '..SSHHHHHHSS..',
  '..SHHCCCCHHS..',
  '..SHHHHHHHHS..',
  '...HVVVVVVH...',
  '...HVVVVVVH...',
  '...HHHHHHHH...',
  '....KKKKKK....',
  '..SSSSSSSSSS..',
  '.SSSSSSSSSSSS.',
  '.SSTTTTTTTTSS.',
  '.SSTTTTTTTTSS.',
  '.SSSSSSSSSSSS.',
  '..SSSSSSSSSS..',
  '...PPPPPPPP...',
  '...PPPPPPPP...',
  '....PPPPPP....',
  '.....PPPP.....',
  '....PP..PP....',
  '...BB....BB...',
];

const SLIM_IDLE = [
  '...HHHHHH...',
  '..HHHHHHHH..',
  '..HCCCCCCH..',
  '..HHHHHHHH..',
  '..HVVVVVVH..',
  '..HVVVVVVH..',
  '..HHHHHHHH..',
  '...KKKKKK...',
  '..SSSSSSSS..',
  '.SSSSSSSSSS.',
  '.SSTTTTTTSS.',
  '.SSTTTTTTSS.',
  '.SSSSSSSSSS.',
  '..SSSSSSSS..',
  '..S.PPPP.S..',
  '..S.PPPP.S..',
  '....PPPP....',
  '....PPPP....',
  '...PP..PP...',
  '...BB..BB...',
  '...BB..BB...',
];

const SLIM_CHEER = [
  '....SSSS....',
  '...SS..SS...',
  '..SS.HH.SS..',
  '..SHHHHHHS..',
  '..SHCCCCHS..',
  '..SHHHHHHS..',
  '...HVVVVH...',
  '...HVVVVH...',
  '...HHHHHH...',
  '....KKKK....',
  '..SSSSSSSS..',
  '.SSSSSSSSSS.',
  '.SSTTTTTTSS.',
  '.SSSSSSSSSS.',
  '..SSSSSSSS..',
  '...PPPPPP...',
  '...PPPPPP...',
  '....PPPP....',
  '...PP..PP...',
  '...BB..BB...',
  '...BB..BB...',
];

const BROAD_IDLE = [
  '.....HHHHHH.....',
  '....HHHHHHHH....',
  '...HHCCCCCCHH...',
  '...HHHHHHHHHH...',
  '...HVVVVVVVVH...',
  '...HVVVVVVVVH...',
  '...HHHHHHHHHH...',
  '....KKKKKKKK....',
  '..SSSSSSSSSSSS..',
  '.SSSSSSSSSSSSSS.',
  'SSSTTTTTTTTTTSSS',
  'SSSTTTTTTTTTTSSS',
  'SSSSSSSSSSSSSSSS',
  '.SSSSSSSSSSSSSS.',
  '.SSSSSSSSSSSSSS.',
  '..SSS.PPPP.SSS..',
  '..SSS.PPPP.SSS..',
  '...SS.PPPP.SS...',
  '.....PPPPPP.....',
  '....PPP..PPP....',
  '...BBB....BBB...',
  '...BBB....BBB...',
];

const BROAD_CHEER = [
  '.....SSSSSS.....',
  '....SSS..SSS....',
  '...SSS.HH.SSS...',
  '..SSSHHHHHHSSS..',
  '..SSHHCCCCHHSS..',
  '..SSHHHHHHHHSS..',
  '...SHVVVVVVHS...',
  '...SHVVVVVVHS...',
  '....HHHHHHHH....',
  '....KKKKKKKK....',
  '..SSSSSSSSSSSS..',
  '.SSSSSSSSSSSSSS.',
  'SSSTTTTTTTTTTSSS',
  'SSSTTTTTTTTTTSSS',
  'SSSSSSSSSSSSSSSS',
  '.SSSSSSSSSSSSSS.',
  '..SSSSSSSSSSSS..',
  '....PPPPPPPP....',
  '....PPPPPPPP....',
  '.....PPPPPP.....',
  '....PPP..PPP....',
  '...BBB....BBB...',
];

/** Trophy for the winner. */
const TROPHY_MAP = [
  '.GGGGGGGGGG.',
  '.GLLLLLLLLG.',
  '.GLWWWWWWLG.',
  'HGLLLLLLLLGH',
  'HGLLLLLLLLGH',
  'HHGLLLLLLGHH',
  '.HGLLLLLLGH.',
  '..GLLLLLLG..',
  '...GLLLLG...',
  '....GLLG....',
  '.....GG.....',
  '.....GG.....',
  '....GGGG....',
  '..GGGGGGGG..',
  '..GGGGGGGG..',
];

/** Medal on a ribbon, recoloured for silver and bronze. */
const MEDAL_MAP = [
  '.RR....RR.',
  '.RR....RR.',
  '..RR..RR..',
  '..RR..RR..',
  '...RRRR...',
  '..MMMMMM..',
  '.MMLLLLMM.',
  '.MLLWWLLM.',
  '.MLLWWLLM.',
  '.MMLLLLMM.',
  '..MMMMMM..',
  '...MMMM...',
];

export type Build = 'slim' | 'standard' | 'broad';

const BUILDS: Record<Build, { idle: string[]; cheer: string[] }> = {
  slim: { idle: SLIM_IDLE, cheer: SLIM_CHEER },
  standard: { idle: STANDARD_IDLE, cheer: STANDARD_CHEER },
  broad: { idle: BROAD_IDLE, cheer: BROAD_CHEER },
};

export interface DriverLook {
  build: Build;
  /** Race suit, its shading, the helmet, the crest stripe and the visor. */
  suit: string;
  suitDark: string;
  helmet: string;
  crest: string;
}

/** One driver per car, keyed by the car id. */
export const DRIVER_LOOKS: Record<string, DriverLook> = {
  bolt: { build: 'standard', suit: '#d63b32', suitDark: '#8c2020', helmet: '#f6e4c8', crest: '#2f4a63' },
  comet: { build: 'slim', suit: '#2f7fc4', suitDark: '#1c4c78', helmet: '#ffd45e', crest: '#f2f0e8' },
  pebble: { build: 'slim', suit: '#b7cc35', suitDark: '#6b7a1e', helmet: '#e2f07a', crest: '#3a4a1c' },
  boulder: { build: 'broad', suit: '#7c4bb0', suitDark: '#4a2c66', helmet: '#e8e2f2', crest: '#4a2c66' },
  zephyr: { build: 'slim', suit: '#22b5c4', suitDark: '#0f6b74', helmet: '#f2f0e8', crest: '#0f6b74' },
  vulcan: { build: 'broad', suit: '#e2701c', suitDark: '#8a3a10', helmet: '#e8d3ad', crest: '#8a3a10' },
};

function driverPalette(look: DriverLook): Palette {
  return {
    H: look.helmet,
    C: look.crest,
    V: '#2f4a63',
    K: '#14161c',
    S: look.suit,
    T: look.suitDark,
    P: '#2b3040',
    B: '#14161c',
    '.': null,
  };
}

export interface DriverSprites {
  idle: HTMLCanvasElement;
  cheer: HTMLCanvasElement;
}

const driverCache = new Map<string, DriverSprites>();

export function getDriver(carId: string): DriverSprites {
  let sprites = driverCache.get(carId);
  if (!sprites) {
    const look = DRIVER_LOOKS[carId] ?? DRIVER_LOOKS.bolt;
    const maps = BUILDS[look.build];
    const palette = driverPalette(look);
    sprites = {
      idle: spriteFromMap(maps.idle, palette),
      cheer: spriteFromMap(maps.cheer, palette),
    };
    driverCache.set(carId, sprites);
  }
  return sprites;
}

const TROPHY_PAL: Palette = { G: '#c98f20', L: '#f5cf5b', W: '#fff3c4', H: '#a97516', '.': null };
const MEDAL_PALS: Record<'silver' | 'bronze', Palette> = {
  silver: { R: '#c8332b', M: '#9aa3ad', L: '#d7dde4', W: '#ffffff', '.': null },
  bronze: { R: '#2f6fbe', M: '#a4692f', L: '#d0904c', W: '#f2d6ae', '.': null },
};

export type Award = 'trophy' | 'silver' | 'bronze';

/** What a finishing position is worth: nothing outside the top three. */
export function awardForPlace(place: number): Award | null {
  if (place === 1) return 'trophy';
  if (place === 2) return 'silver';
  if (place === 3) return 'bronze';
  return null;
}

const awardCache = new Map<Award, HTMLCanvasElement>();

export function getAward(award: Award): HTMLCanvasElement {
  let cv = awardCache.get(award);
  if (!cv) {
    cv =
      award === 'trophy'
        ? spriteFromMap(TROPHY_MAP, TROPHY_PAL)
        : spriteFromMap(MEDAL_MAP, MEDAL_PALS[award]);
    awardCache.set(award, cv);
  }
  return cv;
}

export const DRIVER_MAPS = { ...BUILDS, trophy: { idle: TROPHY_MAP, cheer: MEDAL_MAP } };
