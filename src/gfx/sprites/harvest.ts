/**
 * Arte dos nós de recurso: tocos, entulho, montinhos de terra, buracos e
 * rochas com minério — tudo desenhado à mão.
 */

import { pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  t: P.tronco,
  T: P.troncoLuz,
  O: '#3f2a17',
  p: P.pedra,
  P: P.pedraClara,
  S: P.pedraEscura,
  F: '#e6dcc4',
  R: '#b8763f',
  m: P.magia,
  M: P.magiaClara,
  d: P.terra,
  D: P.terraClara,
  e: P.terraEscura,
  f: P.folha,
  G: P.folhaClara,
  o: P.osso,
};

/** Toco que sobra depois de derrubar a árvore. */
const TOCO = [
  '...kkkkkkk....',
  '..kTtttttTk...',
  '.kTtOOtOOttk..',
  'kTttOOtOOtttk.',
  'kttttttttttttk',
  '.kttttttttttk.',
  '..kkkkkkkkkk..',
];

/** Entulho que sobra depois de quebrar a pedra. */
const ENTULHO = [
  '.....kkk......',
  '..kkkPppkk....',
  '.kPpppppSk.kk.',
  'kppppSSSSkkPpk',
  '.kkpSSSkkkpSk.',
  '...kkkkk.kkk..',
];

/** Montinho de terra fofa: é aqui que a pá acha coisa enterrada. */
const MONTINHO = [
  '.....kkkk.....',
  '...kkDDDDkk...',
  '..kDDdddDDDk..',
  '.kDdddOdddDDk.',
  'kDddddddddDDDk',
  '.kkkkkkkkkkkk.',
];

/** Buraco aberto depois de escavar. */
const BURACO = [
  '.....kkkkk....',
  '..kkkeeeeekk..',
  '.keeeeeeeeeek.',
  '.keeeeeeeeeek.',
  '..kkeeeeeekk..',
  '....kkkkkk....',
];

/** Rocha com veios de ferro. */
const ROCHA_FERRO = [
  '.....kkkkkk.....',
  '...kkPPPPppkk...',
  '..kPPFppFppppk..',
  '.kPPpFFppppFpSk.',
  'kPppppFFpppFSSSk',
  'kpppFppppSSSSSSk',
  'kppppppFFSSSSSSk',
  '.kpppFpSSSSSSSk.',
  '..kkppSSSSSSkk..',
  '....kkkkkkkk....',
];

/** Rocha com cristais crescendo dentro. */
const ROCHA_CRISTAL = [
  '.....kkkkkk.....',
  '...kkPPPPppkk...',
  '..kPPpMmppppk...',
  '.kPPpmMMmpppSk..',
  'kPppppmMmppSSSk.',
  'kppppppppSSSSSk.',
  'kpppmMmppSSSSSSk',
  '.kppmMMmSSSSSSk.',
  '..kkppSSSSSSkk..',
  '....kkkkkkkk....',
];

/** Capim alto: a enxada tira fibra e semente daqui. */
const CAPIM_ALTO = [
  '..k...k....k..',
  '.kGk.kGk..kGk.',
  '.kGk.kGk..kGk.',
  'kGfk.kGfk.kGfk',
  '.kfkkkfkkkkfk.',
  '..kfffffffffk.',
  '...kkkkkkkkk..',
];

/** Terra arada, desenhada como objeto por cima do chão. */
const TERRA_ARADA = [
  'kkkkkkkkkkkkkkkk',
  'keeeeeeeeeeeeeek',
  'kdddddddddddddek',
  'keeeeeeeeeeeeeek',
  'kdddddddddddddek',
  'keeeeeeeeeeeeeek',
  'kdddddddddddddek',
  'kkkkkkkkkkkkkkkk',
];

/** Placa de madeira usada nas fazendas de recurso e na cabana. */
const PLACA_RECURSO = [
  '.kkkkkkkkkkkk.',
  'kTttttttttttTk',
  'ktOttOttOttOtk',
  'ktttOttOttOttk',
  'kTttttttttttTk',
  '.kkkkkOOkkkkk.',
  '.....kOOk.....',
  '.....kkkk.....',
];

export interface ArteColheita {
  toco: Sprite;
  entulho: Sprite;
  montinho: Sprite;
  buraco: Sprite;
  rochaFerro: Sprite;
  rochaCristal: Sprite;
  capimAlto: Sprite;
  terraArada: Sprite;
  placa: Sprite;
}

export function criarColheita(): ArteColheita {
  return {
    toco: pintar(TOCO, PAL),
    entulho: pintar(ENTULHO, PAL),
    montinho: pintar(MONTINHO, PAL),
    buraco: pintar(BURACO, PAL),
    rochaFerro: pintar(ROCHA_FERRO, PAL),
    rochaCristal: pintar(ROCHA_CRISTAL, PAL),
    capimAlto: pintar(CAPIM_ALTO, PAL),
    terraArada: pintar(TERRA_ARADA, PAL),
    placa: pintar(PLACA_RECURSO, PAL),
  };
}
