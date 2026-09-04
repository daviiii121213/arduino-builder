/**
 * Arte do protagonista (Téo) — 18x16 pixels, desenhada à mão.
 *
 * Proporções propositalmente baixas e largas: cabeça grande (quase metade do
 * corpo), ombros largos e pernas curtas. Três vistas (frente, costas, lado) com
 * três quadros de caminhada cada; a vista lateral é espelhada em tempo de
 * execução.
 *
 * O corpo é a camada de baixo: a armadura entra como sobreposição do mesmo
 * tamanho (ver `armor.ts`), então basta desenhar uma camada nova para criar um
 * conjunto novo.
 */

import { P } from '../palette';
import { pintar, espelharH, type Paleta, type Sprite } from '../pixel';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  p: P.pele,
  P: P.peleSombra,
  h: P.cabelo,
  H: P.cabeloLuz,
  s: P.camisa,
  S: P.camisaSombra,
  c: P.calca,
  C: P.calcaSombra,
  b: P.bota,
  r: P.cachecol,
  m: P.pedraClara,
  t: P.tronco,
  T: P.troncoLuz,
  M: P.pedra,
};

export const JOGADOR_W = 18;
export const JOGADOR_H = 16;

// ------------------------------------------------------------------ tronco

const TRONCO_FRENTE = [
  '.....kkkkkkkk.....',
  '...kkhhhhhhhhkk...',
  '..khhhhhhhhhhhhk..',
  '..khhpppppppphhk..',
  '..khppkppppkpphk..',
  '..khpppppppppphk..',
  '..kkppPPPPPPppkk..',
  '...kkrrrrrrrrkk...',
  '..kssssssssssssk..',
  '..ksSssrrrrssSsk..',
  '.kpssssssssssspk..',
  '..kcccccccccccck..',
];

const TRONCO_COSTAS = [
  '.....kkkkkkkk.....',
  '...kkhhhhhhhhkk...',
  '..khhhhhhhhhhhhk..',
  '..khhhhhhhhhhhhk..',
  '..khhhhhhhhhhhhk..',
  '..khHhhhhhhhhHhk..',
  '..kkhhhhhhhhhhkk..',
  '...kkrrrrrrrrkk...',
  '..kssssssssssssk..',
  '..ksSssssssssSsk..',
  '.kpssssssssssspk..',
  '..kcccccccccccck..',
];

const TRONCO_LADO = [
  '....kkkkkkkk......',
  '..kkhhhhhhhhkk....',
  '.khhhhhhhhppppk...',
  '.khhhhhhhpkppk....',
  '.khhhhhhppppppk...',
  '..khhhhpppppPk....',
  '..kkhhpppPPPkk....',
  '...kkrrrrrrkk.....',
  '..ksssssssssk.....',
  '..ksSsssssssk.....',
  '..kssssssssspk....',
  '..kcccccccccck....',
];

// ------------------------------------------------------------------ pernas

const PERNAS_FRENTE = [
  // parado
  ['..kccccckkccccck..', '..kCCCCCkkCCCCCk..', '..kbbbbbkkbbbbbk..', '...kkkkk..kkkkk...'],
  // passo A
  ['..kccccckkccccck..', '..kCCCCCkkCCCCk...', '..kbbbbbkkbbbk....', '...kkkkk..kkk.....'],
  // passo B
  ['..kccccckkccccck..', '...kCCCCkkCCCCCk..', '....kbbbkkbbbbbk..', '.....kkk..kkkkk...'],
];

const PERNAS_LADO = [
  ['..kcccccccccck....', '..kCCCCkkCCCCk....', '..kbbbbkkbbbbk....', '...kkkk..kkkk.....'],
  ['..kcccccccccck....', '.kCCCCkkCCCCk.....', '.kbbbbkkbbbbk.....', '..kkkk..kkkk......'],
  ['..kcccccccccck....', '...kCCCCkkCCCCk...', '...kbbbbkkbbbbk...', '....kkkk..kkkk....'],
];

function montar(tronco: readonly string[], pernas: readonly string[]): Sprite {
  return pintar([...tronco, ...pernas], PAL);
}

export interface QuadrosJogador {
  baixo: Sprite[];
  cima: Sprite[];
  direita: Sprite[];
  esquerda: Sprite[];
  /** Sprite da lança, apontando para a direita. Pivô em (2, 2). */
  lanca: Sprite;
}

export function criarJogador(): QuadrosJogador {
  const baixo = PERNAS_FRENTE.map((p) => montar(TRONCO_FRENTE, p));
  const cima = PERNAS_FRENTE.map((p) => montar(TRONCO_COSTAS, p));
  const direita = PERNAS_LADO.map((p) => montar(TRONCO_LADO, p));
  const esquerda = direita.map((s) => espelharH(s));

  /**
   * Lança de pedra: cabo com contorno (para não desaparecer no chão de terra),
   * amarração vermelha e ponta larga. Pivô em (2, 3), na mão do jogador.
   */
  const lanca = pintar(
    [
      '.............kkk.',
      '...........kkMMMk',
      'kkkkkkkkkkkmMMMMk',
      'kTttttrrttTmmMMMk',
      'kkkkkkkkkkkmMMMk.',
      '.............kkk.',
    ],
    PAL,
  );

  return { baixo, cima, direita, esquerda, lanca };
}
