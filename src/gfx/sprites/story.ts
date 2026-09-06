/**
 * Arte do desfecho: o Ancião, a cabana dele, a máquina do tempo quebrada e
 * consertada, o pedestal da Cronolita e os pais, para o reencontro.
 *
 * Mesmo traço compacto do resto do jogo — a cabana é pequena de propósito, como
 * pedido: uma peça só, telhado de palha e uma porta.
 */

import { pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  p: P.pele,
  P: P.peleSombra,
  h: '#3a2a18',
  H: '#8a4a2a',
  s: '#b06a8a',
  S: '#7a4560',
  c: P.calca,
  C: P.calcaSombra,
  b: P.bota,
  r: '#c4453f',
  w: '#e8e4d8',
  y: '#c9a45a',
  Y: '#e0bd76',
  m: P.metalEscuro,
  M: P.metal,
  d: '#6b4a2b',
  t: P.tronco,
  T: P.troncoLuz,
  D: P.madeiraEscura,
  v: '#2a3550',
  V: P.vidro,
  a: P.ambar,
  G: '#3f7f6a',
  g: '#2a5a4a',
};

const ANCIAO_A = [
  '.....kkkkkk.....',
  '...kkwwwwwwkk...',
  '..kwwwwwwwwwwk..',
  '..kwwpppppppwk..',
  '..kwpkppppkpwk..',
  '..kwppppppppwk..',
  '..kwwppPPPPwwk..',
  '..kkwwwwwwwwkk..',
  '.kmwwwwwwwwwwmk.',
  '.kmmMMMMMMMMmmk.',
  'kdmMMMMMMMMMMmdk',
  '.kmMMMMMMMMMMmk.',
  '..kMMMMMMMMMMk..',
  '..kkkkkkkkkkkk..',
];

const ANCIAO_B = [
  '.....kkkkkk.....',
  '...kkwwwwwwkk...',
  '..kwwwwwwwwwwk..',
  '..kwwpppppppwk..',
  '..kwpkppppkpwk..',
  '..kwppppppppwk..',
  '..kwwppPPPPwwk..',
  '..kkwwwwwwwwkk..',
  '.kmwwwwwwwwwwmk.',
  '.kmMMMMMMMMMMmk.',
  'kdmMMMMMMMMMMmdk',
  '.kmmMMMMMMMMmmk.',
  '..kMMMMMMMMMMk..',
  '..kkkkkkkkkkkk..',
];

const CASA_ANCIAO = [
  '.............kkkkk..............',
  '...........kkyyyyykk............',
  '.........kkyyyyyyyyykk..........',
  '.......kkyyyyyyyyyyyyykk........',
  '.....kkyyyyyyyyyyyyyyyyykk......',
  '...kkyyyyyyyyyyyyyyyyyyyyykk....',
  '.kkyyyyyyyyyyyyyyyyyyyyyyyyykk..',
  'kkyyyyyyyyyyyyyyyyyyyyyyyyyyykk.',
  'kYyyyyyyyyyyyyyyyyyyyyyyyyyyyYk.',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
  'kpppppppppppppppppppppppppppppk.',
  'kpPppSppppppppppppppppSppppppPk.',
  'kppppppppkkkkkkkkkppppppppppppk.',
  'kpPppppppkvvvvvvvkpppppSpppppPk.',
  'kppppSpppkvvVVvvvkppppppppppppk.',
  'kpPppppppkkkkkkkkkpppppppppppPk.',
  'kppppppppppkkkkkkkkkppppSppppppk',
  'kpPppSppppkDtTtTtDkppppppppppPk.',
  'kpppppppppkDtTtTtDkpppppppppppk.',
  'kpPppppppykDtTtTtDkyppppSppppPk.',
  'kppppppppykDtTtTtDkypppppppppppk',
  'kSSSSSSSSSkkkkkkkkkSSSSSSSSSSSk.',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.',
];


const MAQUINA_QUEBRADA = [
  '.......kkkkkk.......',
  '......kmMMMMmk......',
  '....kkmMMrrMMmkk....',
  '...kmMMMMMMMMMMmk...',
  '....kkmMMMMMMmkk....',
  '.......kmMMmk.......',
  '.......kmMMmk.......',
  '..kkkkkkmMMmkkkkkk..',
  '.kmMMMMMMMMMMMMMMmk.',
  'kmMMMMMMMMMMMMMMMMmk',
  'kMMkkkkkkkkkkkkkkMMk',
  'kMMkvvvvkkkvvvvvkMMk',
  'kMMkvvkkkkkkkvvvkMMk',
  'kMMkvvvkrrkkvvvvkMMk',
  'kMMkvvkkkkkkkvvvkMMk',
  'kMMkkkkkkkkkkkkkkMMk',
  'kmMMMMMMMMMMMMMMMMmk',
  '.kmmMMMMMMMMMMMMmmk.',
  '..kMMk..........kMMk',
  '..kkkk..........kkkk',
];

const MAQUINA_PRONTA = [
  '.......kkkkkk.......',
  '......kmMMMMmk......',
  '....kkmMMaaMMmkk....',
  '...kmMMMMwwMMMMmk...',
  '....kkmMMaaMMmkk....',
  '.......kmMMmk.......',
  '.......kmMMmk.......',
  '..kkkkkkmMMmkkkkkk..',
  '.kmMMMMMMMMMMMMMMmk.',
  'kmMMMMMMMMMMMMMMMMmk',
  'kMMkkkkkkkkkkkkkkMMk',
  'kMMkVVVVVVVVVVVVkMMk',
  'kMMkVVVVVaaVVVVVkMMk',
  'kMMkVVVVawwaVVVVkMMk',
  'kMMkVVVVVaaVVVVVkMMk',
  'kMMkVVVVVVVVVVVVkMMk',
  'kmMMMMMMMMMMMMMMMMmk',
  '.kmmMMMMMMMMMMMMmmk.',
  '..kMMk..........kMMk',
  '..kkkk..........kkkk',
];

const MAE = [
  '....kkkkkkkk....',
  '..kkHHHHHHHHkk..',
  '.kHHHHHHHHHHHHk.',
  '.kHHHpppppppHHk.',
  '.kHHppkppppkpHk.',
  '.kHHppppppppHHk.',
  '.kHHppPPPPPpHHk.',
  '..kkrrrrrrrrkk..',
  '.kHssssssssssHk.',
  '.kHsSsssssssSHk.',
  'kpHsssssssssssHk',
  '..kcccccccccck..',
  '..kCCCCkkCCCCk..',
  '..kbbbbkkbbbbk..',
  '...kkkk..kkkk...',
];

const PAI = [
  '....kkkkkkkk....',
  '..kkhhhhhhhhkk..',
  '.khhhhhhhhhhhhk.',
  '.khhhpppppppphk.',
  '.khppkppppkpphk.',
  '.khpppppppppphk.',
  '.kkppHHHHHHppkk.',
  '..kkrrrrrrrrkk..',
  '.kGGGGGGGGGGGk..',
  '.kGgGGGGGGGgGk..',
  'kpGGGGGGGGGGGPk.',
  '..kcccccccccck..',
  '..kCCCCkkCCCCk..',
  '..kbbbbkkbbbbk..',
  '...kkkk..kkkk...',
];

const PEDESTAL = [
  '....kkkk....',
  '...kaWWak...',
  '...kaWWak...',
  '....kaak....',
  '..kkkaakkk..',
  '.kpPppppPpk.',
  'kpPppppppPpk',
  'kSSSSSSSSSSk',
  'kkkkkkkkkkkk',
];

export interface ArteHistoria {
  casaAnciao: Sprite;
  maquinaQuebrada: Sprite;
  maquinaPronta: Sprite;
  mae: Sprite;
  pai: Sprite;
  pedestal: Sprite;
  /** O Ancião, dois quadros de respiração. */
  anciao: Sprite[];
}

export function criarHistoria(): ArteHistoria {
  return {
    casaAnciao: pintar(CASA_ANCIAO, PAL),
    maquinaQuebrada: pintar(MAQUINA_QUEBRADA, PAL),
    maquinaPronta: pintar(MAQUINA_PRONTA, PAL),
    mae: pintar(MAE, PAL),
    pai: pintar(PAI, PAL),
    pedestal: pintar(PEDESTAL, PAL),
    anciao: [pintar(ANCIAO_A, PAL), pintar(ANCIAO_B, PAL)],
  };
}
