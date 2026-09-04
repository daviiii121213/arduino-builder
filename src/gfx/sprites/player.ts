/**
 * Arte do protagonista (Téo) — 16x18 pixels, desenhada à mão.
 * Três vistas (frente, costas, lado) com três quadros de caminhada cada.
 * A vista lateral é espelhada em tempo de execução para o lado esquerdo.
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
  M: P.pedra,
};

/** Centraliza um bloco de 10 colunas num sprite de 16. */
const F = (m: string) => '...' + m + '...';

// ---------------------------------------------------------------- tronco

const TRONCO_FRENTE = [
  F('..kkkkkk..'),
  F('.khhhhhhk.'),
  F('khhhhhhhhk'),
  F('khhhhhhhhk'),
  F('khpppppphk'),
  F('khpkppkphk'),
  F('khppppPPhk'),
  F('kkrrrrrrkk'),
  F('kssssssssk'),
  F('ksSsrrsSsk'),
  F('kssssssssk'),
  F('kpsssssspk'),
  F('kcccccccck'),
];

const TRONCO_COSTAS = [
  F('..kkkkkk..'),
  F('.khhhhhhk.'),
  F('khhhhhhhhk'),
  F('khhhhhhhhk'),
  F('khhhhhhhhk'),
  F('khHhhhhHhk'),
  F('khhhhhhhhk'),
  F('kkrrrrrrkk'),
  F('kssssssssk'),
  F('ksSssssSsk'),
  F('kssssssssk'),
  F('kpsssssspk'),
  F('kcccccccck'),
];

const TRONCO_LADO = [
  F('..kkkkk...'),
  F('.khhhhhk..'),
  F('khhhhhppk.'),
  F('khhhhpkpk.'),
  F('khhhppppk.'),
  F('.khhppPpk.'),
  F('.kkrrrrkk.'),
  F('.ksssssk..'),
  F('.ksSsssk..'),
  F('.kssssspk.'),
  F('.kssssspk.'),
  F('.ksssskkk.'),
  F('.kcccccck.'),
];

// ---------------------------------------------------------------- pernas

const PERNAS_FRENTE = [
  // parado
  [F('kccckkccck'), F('kccckkccck'), F('kCCCkkCCCk'), F('kbbbkkbbbk'), F('.kkk..kkk.')],
  // passo A
  [F('kccckkccck'), F('kccckkccck'), F('kCCCk.kCCk'), F('kbbbk.kbbk'), F('.kkk...kk.')],
  // passo B
  [F('kccckkccck'), F('kccckkccck'), F('kCCk.kCCCk'), F('kbbk.kbbbk'), F('.kk...kkk.')],
];

const PERNAS_LADO = [
  [F('.kcccccck.'), F('.kcckkcck.'), F('.kCCkkCCk.'), F('.kbbkkbbk.'), F('..kk..kk..')],
  [F('.kcccccck.'), F('.kcckkcck.'), F('.kCCkkCCk.'), F('.kbbk.kbbk'), F('..kk...kk.')],
  [F('.kcccccck.'), F('.kcckkcck.'), F('.kCCkkCCk.'), F('kbbk.kbbk.'), F('.kk...kk..')],
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

  const lanca = pintar(
    [
      '..........kkk...',
      '.........kmMMk..',
      'kttttttttkmmMMMk',
      '.........kmMMk..',
      '..........kkk...',
    ],
    PAL,
  );

  return { baixo, cima, direita, esquerda, lanca };
}

/** Largura/altura da arte do jogador (usada pelas colisões e pela câmera). */
export const JOGADOR_W = 16;
export const JOGADOR_H = 18;
