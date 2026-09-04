/**
 * A casa do jogador e a mobília do interior.
 *
 * O exterior é desenhado pixel a pixel (telhado de telhas, paredes de tábuas,
 * alicerce de pedra, porta, janelas com vidro e lampião). A mobília é feita
 * com mapas de caracteres.
 */

import { Pincel, pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';
import { Rng } from '../../core/rng';

export const CASA_W = 88;
export const CASA_H = 82;

/** Retângulo de colisão da casa, relativo ao canto superior esquerdo. */
export const CASA_COLISAO = { x: 6, y: 42, w: 76, h: 38 };
/** Porta (área de interação), relativa ao canto superior esquerdo. */
export const CASA_PORTA = { x: 35, y: 62, w: 18, h: 18 };

function desenharCasa(): Sprite {
  const p = new Pincel(CASA_W, CASA_H);
  const rng = new Rng(4242);

  // ---------------- chaminé ----------------
  const chX = 62;
  const chW = 13;
  p.retangulo(chX, 2, chW, 22, P.tijolo);
  for (let y = 2; y < 24; y += 3) {
    p.linha(chX, y, chX + chW - 1, y, '#6f3a2c');
    for (let x = chX + (((y / 3) | 0) % 2 ? 2 : 5); x < chX + chW; x += 6) {
      p.linha(x, y, x, Math.min(23, y + 2), '#6f3a2c');
    }
  }
  p.retangulo(chX - 2, 0, chW + 4, 4, P.pedra);
  p.retangulo(chX - 2, 3, chW + 4, 1, P.pedraEscura);
  p.contorno(chX - 2, 0, chW + 4, 4, P.contorno);
  p.linha(chX, 4, chX, 23, P.contorno);
  p.linha(chX + chW - 1, 4, chX + chW - 1, 23, P.contorno);

  // ---------------- telhado ----------------
  const yTopo = 10;
  const yBase = 42;
  for (let y = yTopo; y <= yBase; y++) {
    const t = (y - yTopo) / (yBase - yTopo);
    const xe = Math.round(32 - t * 30);
    const xd = Math.round(56 + t * 30);
    for (let x = xe; x <= xd; x++) {
      // duas luzes: a metade esquerda pega o sol
      const cor = x < (xe + xd) / 2 ? P.telhadoLuz : P.telhado;
      p.ponto(x, y, cor);
    }
    // fileiras de telhas
    if ((y - yTopo) % 4 === 3) {
      for (let x = xe; x <= xd; x++) p.ponto(x, y, P.telhadoEscuro);
    }
    const grupo = Math.floor((y - yTopo) / 4);
    for (let x = xe + (grupo % 2 ? 3 : 6); x <= xd; x += 6) {
      if ((y - yTopo) % 4 !== 3) p.ponto(x, y, P.telhadoEscuro);
    }
    p.ponto(xe, y, P.contorno);
    p.ponto(xd, y, P.contorno);
  }
  // cumeeira
  p.linha(32, yTopo, 56, yTopo, P.telhadoLuz);
  p.linha(32, yTopo - 1, 56, yTopo - 1, P.contorno);
  p.linha(33, yTopo + 1, 55, yTopo + 1, '#d9705f');

  // beiral com sombra
  p.retangulo(0, yBase, CASA_W, 3, P.telhadoEscuro);
  p.linha(0, yBase, CASA_W - 1, yBase, '#5f221f');
  p.linha(0, yBase + 2, CASA_W - 1, yBase + 2, P.contorno);

  // ---------------- paredes ----------------
  const px0 = 6;
  const px1 = 81;
  const py0 = 45;
  const py1 = 72;
  p.retangulo(px0, py0, px1 - px0 + 1, py1 - py0 + 1, P.madeira);
  for (let y = py0; y <= py1; y++) {
    for (let x = px0; x <= px1; x++) {
      if (rng.chance(0.06)) p.ponto(x, y, P.madeiraClara);
      else if (rng.chance(0.05)) p.ponto(x, y, P.madeiraEscura);
    }
  }
  for (let y = py0 + 3; y <= py1; y += 4) p.linha(px0, y, px1, y, P.madeiraEscura);
  // sombra do beiral na parede
  p.retangulo(px0, py0, px1 - px0 + 1, 2, '#6d4c28');
  // cantos / vigas
  p.retangulo(px0, py0, 3, py1 - py0 + 1, P.madeiraEscura);
  p.retangulo(px1 - 2, py0, 3, py1 - py0 + 1, P.madeiraEscura);
  p.linha(px0, py0, px0, py1, P.contorno);
  p.linha(px1, py0, px1, py1, P.contorno);

  // ---------------- alicerce de pedra ----------------
  const fy0 = 71;
  const fy1 = 79;
  p.retangulo(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.pedra);
  for (let fila = 0; fila < 3; fila++) {
    const y = fy0 + fila * 3;
    p.linha(px0 - 1, y, px1 + 1, y, P.pedraEscura);
    for (let x = px0 + (fila % 2 ? 4 : 8); x < px1; x += 9) {
      p.linha(x, y, x, Math.min(fy1, y + 2), P.pedraEscura);
    }
    for (let x = px0; x <= px1; x++) if (rng.chance(0.08)) p.ponto(x, y + 1, P.pedraClara);
  }
  p.contorno(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.contorno);

  // ---------------- janelas ----------------
  const janela = (jx: number, jy: number) => {
    p.retangulo(jx - 1, jy - 1, 18, 17, P.madeiraEscura);
    p.contorno(jx - 1, jy - 1, 18, 17, P.contorno);
    p.retangulo(jx + 1, jy + 1, 14, 13, P.vidro);
    // brilho diagonal do vidro
    for (let i = 0; i < 10; i++) {
      p.ponto(jx + 2 + i, jy + 11 - i, P.vidroLuz);
      p.ponto(jx + 3 + i, jy + 11 - i, P.vidroLuz);
    }
    // caixilhos
    p.linha(jx + 8, jy + 1, jx + 8, jy + 13, P.madeiraEscura);
    p.linha(jx + 1, jy + 7, jx + 15, jy + 7, P.madeiraEscura);
    // peitoril
    p.retangulo(jx - 2, jy + 16, 20, 2, P.madeiraClara);
    p.linha(jx - 2, jy + 17, jx + 17, jy + 17, P.contorno);
  };
  janela(13, 50);
  janela(58, 50);

  // ---------------- porta ----------------
  const dx = 35;
  const dy = 55;
  const dw = 18;
  const dh = 25;
  p.retangulo(dx, dy, dw, dh, P.madeiraEscura);
  p.retangulo(dx + 2, dy + 2, dw - 4, dh - 2, P.madeiraClara);
  for (let x = dx + 2; x < dx + dw - 2; x += 4) p.linha(x, dy + 2, x, dy + dh - 1, '#8d6437');
  // arco superior
  for (let i = 0; i < 4; i++) {
    p.linha(dx + 2, dy + 2 + i, dx + 3 - i, dy + 2 + i, P.madeiraEscura);
    p.linha(dx + dw - 4 + i, dy + 2 + i, dx + dw - 3, dy + 2 + i, P.madeiraEscura);
  }
  // dobradiças e maçaneta
  p.retangulo(dx + 3, dy + 8, 3, 2, P.metalEscuro);
  p.retangulo(dx + 3, dy + 17, 3, 2, P.metalEscuro);
  p.disco(dx + dw - 5, dy + 13, 1, P.metal);
  p.ponto(dx + dw - 5, dy + 12, P.brilho);
  p.contorno(dx, dy, dw, dh, P.contorno);
  // degrau de pedra
  p.retangulo(dx - 3, dy + dh - 1, dw + 6, 3, P.pedra);
  p.linha(dx - 3, dy + dh + 1, dx + dw + 2, dy + dh + 1, P.pedraEscura);
  p.contorno(dx - 3, dy + dh - 1, dw + 6, 3, P.contorno);

  // ---------------- lampião ao lado da porta ----------------
  const lx = 56;
  const ly = 54;
  p.linha(lx, ly, lx + 3, ly, P.metalEscuro);
  p.retangulo(lx + 3, ly + 1, 5, 6, P.metalEscuro);
  p.retangulo(lx + 4, ly + 2, 3, 4, P.ambar);
  p.ponto(lx + 5, ly + 3, P.brilho);
  p.ponto(lx + 5, ly + 7, P.metalEscuro);

  return p.finalizar();
}

/** Halo suave do lampião (desenhado por cima, com transparência). */
function desenharHaloLampiao(): Sprite {
  const p = new Pincel(20, 20);
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 20; x++) {
      const d = Math.hypot(x - 9.5, y - 9.5);
      if (d < 9) p.ponto(x, y, P.ambar, 0.1 * (1 - d / 9));
    }
  }
  return p.finalizar();
}

// ---------------------------------------------------------------- mobília

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  t: P.madeira,
  T: P.madeiraClara,
  D: P.madeiraEscura,
  w: '#f2e3c2',
  W: '#d8c69f',
  B: P.camisa,
  b: P.camisaSombra,
  M: P.metal,
  m: P.metalEscuro,
  p: P.pedra,
  P: P.pedraClara,
  S: P.pedraEscura,
  f: P.fogo,
  F: P.fogoClaro,
  o: P.osso,
  O: P.ossoEscuro,
  C: '#9a4740',
  g: P.folha,
  a: P.ambar,
  v: P.vidro,
  V: P.vidroLuz,
  d: P.folhaEscura,
  x: '#1a1016',
  n: '#a8552f',
  N: '#c46f42',
  G: P.folhaClara,
};

/** Repete uma linha (ou alterna entre várias) — encurta os móveis longos. */
function repetir(padrao: string[], vezes: number): string[] {
  return Array.from({ length: vezes }, (_, i) => padrao[i % padrao.length]);
}

// ------------------------------------------------------------------ cama
const CAMA = [
  'kkkk..................kkkk',
  'kDDkkkkkkkkkkkkkkkkkkkkDDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTTTTTTTTTTDk',
  'kDTDDDDDDDDDDDDDDDDDDDDTDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDkkkkkkkkkkkkkkkkkkkkkkDk',
  'kDkwwwwwwwwwwwwwwwwwwwwkDk',
  'kDkwWWWWWWWWWWWWWWWWWWwkDk',
  'kDkwWwwwwwwwwwwwwwwwwWwkDk',
  'kDkwWwwwwwwwwwwwwwwwwWwkDk',
  'kDkwWWWWWWWWWWWWWWWWWWwkDk',
  'kDkwwwwwwwwwwwwwwwwwwwwkDk',
  'kDkkkkkkkkkkkkkkkkkkkkkkDk',
  'kDkbbbbbbbbbbbbbbbbbbbbkDk',
  'kDkBBBBBBBBBBBBBBBBBBBBkDk',
  // colcha xadrez: listras verticais + costura horizontal a cada seis linhas
  ...repetir(
    [
      'kDkBbBBBBbBBBBbBBBBbBBBkDk',
      'kDkBbBBBBbBBBBbBBBBbBBBkDk',
      'kDkbbbbbbbbbbbbbbbbbbbbkDk',
      'kDkBbBBBBbBBBBbBBBBbBBBkDk',
      'kDkBbBBBBbBBBBbBBBBbBBBkDk',
      'kDkBbBBBBbBBBBbBBBBbBBBkDk',
    ],
    18,
  ),
  'kDkbbbbbbbbbbbbbbbbbbbbkDk',
  'kDkkkkkkkkkkkkkkkkkkkkkkDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTTTTTTTTTTDk',
  'kDDkkkkkkkkkkkkkkkkkkkkDDk',
  'kkkk..................kkkk',
];

// --------------------------------------------------------------- armário
const ARMARIO = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTTTTTTTTTTTTDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ...repetir(
    [
      'kDttttttttttttkkttttttttttDk',
      'kDtTtttttttttSkkStttttttTttDk',
      'kDttttttttttttkkttttttttttDk',
      'kDttttttttttttkkttttttttttDk',
    ],
    10,
  ),
  'kDttttttttttMtkkMtttttttttDk',
  'kDttttttttttMtkkMtttttttttDk',
  ...repetir(
    [
      'kDttttttttttttkkttttttttttDk',
      'kDtTtttttttttSkkStttttttTttDk',
    ],
    8,
  ),
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTTTTTTTTTTTTDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '.kDDk..................kDDk.',
  '.kkkk..................kkkk.',
];

// ------------------------------------------------------------------ mesa
const MESA = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttttttttttttttttttttttttttttk',
  'ktttttttttttttttttttttttttttttttttttttttttttTk',
  'kttttttttttttttttttttttttttttttttttttttttttttk',
  'ktttttttttttttttttttttttttttttttttttttttttttTk',
  'kttttttttttttttttttttttttttttttttttttttttttttk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ...repetir(['..kDDk..................................kDDk..'], 12),
  '..kkkk..................................kkkk..',
];

// --------------------------------------------------------------- cadeira
const CADEIRA = [
  '.kkkkkkkkkkkk.',
  '.kDtttttttttDk',
  ...repetir(['.kDtTttttttTDk', '.kDtttttttttDk'], 8),
  '.kDtttttttttDk',
  '.kkkkkkkkkkkk.',
  'kttttttttttttk',
  'kTtttttttttTtk',
  'kttttttttttttk',
  'kkkkkkkkkkkkkk',
  '.kDk......kDk.',
  '.kDk......kDk.',
  '.kDk......kDk.',
  '.kDk......kDk.',
  '.kkk......kkk.',
];

// ------------------------------------------------------------------- baú
const BAU = [
  '..kkkkkkkkkkkkkkkkkkkkkk..',
  '.kMMMMMMMMMMMMMMMMMMMMMMk.',
  'kDttttttttttttttttttttttDk',
  'kDtTttttttttttttttttttTttk',
  'kDttttttttttttttttttttttDk',
  'kDtttttttttttttttttttttttk',
  'kkkkkkkkkkkMMMMkkkkkkkkkkk',
  'kDttttttttMMMMMMttttttttDk',
  'kDtTttttttMMMMMMtttttttTtk',
  'kDttttttttttttttttttttttDk',
  'kDtttttttttttttttttttttttk',
  'kDtTttttttttttttttttttTttk',
  'kDttttttttttttttttttttttDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkk',
];

// --------------------------------------------------------------- lareira
const LAREIRA = [
  '......kkkkkkkkkkkkkkkkkkkkkkkkkk......',
  ...repetir(
    [
      '......kpSppPpSppPpSppPpSppPpSppk......',
      '......kpPpSppPpSppPpSppPpSppPpSk......',
    ],
    8,
  ),
  '..kkkkkppSppPpSppPpSppPpSppPpSppkkkkk..',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPk',
  'kSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kpPpSppPpSppPpSppPpSppPpSppPpSppPpSppk',
  'kpSppPpkkkkkkkkkkkkkkkkkkkkkkkkPpSppk',
  ...repetir(
    [
      'kppSppPkxxxxxxxxxxxxxxxxxxxxxxxxkpPpk',
      'kpSppPpkxxxxxxxxxxxxxxxxxxxxxxxxkppSk',
    ],
    10,
  ),
  'kppSppPkkxxxxxxxxxxxxxxxxxxxxxxkkpSppk',
  'kpSppPpSkkkkkkkkkkkkkkkkkkkkkkkkppPpSk',
  'kppSppPpSppPpSppPpSppPpSppPpSppPpSppPk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

const CHAMAS = [
  [
    '.....ff.....',
    '....ffFf....',
    '...ffFFff...',
    '..ffFFwFff..',
    '.fffFFwFfff.',
    '.ffFFFFFFff.',
    '..ffffffff..',
    '...kkkkkk...',
  ],
  [
    '....ff......',
    '...fFff.....',
    '..ffFFff....',
    '.ffFwFFff...',
    'fffFwFFFff..',
    '.ffFFFFFff..',
    '..fffffff...',
    '...kkkkk....',
  ],
  [
    '......ff....',
    '.....ffFf...',
    '....ffFFff..',
    '...ffFwFFff.',
    '..ffFFwFFfff',
    '..ffFFFFFff.',
    '...fffffff..',
    '....kkkkk...',
  ],
];

// -------------------------------------------------------------- estante
const ESTANTE = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDtttttttttttttttttttttttttttttttttttttttk',
  ...repetir(['kDtCCkoOkoOkCCCkoOkoOkCCkoOkoOkCCCkoOkotk'], 6),
  'kDttttttttttttttttttttttttttttttttttttttDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  ...repetir(['kDtoOkCCCkoOkoOkCCCkoOkCCkoOkoOkCCCkootDk'], 6),
  'kDttttttttttttttttttttttttttttttttttttttDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  ...repetir(['kDtCCCkoOkoOkCCkoOkCCCkoOkoOkCCkoOkoOtDk'], 6),
  'kDttttttttttttttttttttttttttttttttttttttDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

// --------------------------------------------------------------- barril
const BARRIL = [
  '..kkkkkkkkkkkkk..',
  '.kTttttttttttTk..',
  'kMMMMMMMMMMMMMMMk',
  ...repetir(
    ['kTtttttttttttttTk', 'kTttttttttttttttk', 'kTtttttttttttttTk', 'kMMMMMMMMMMMMMMMk'],
    12,
  ),
  'kMMMMMMMMMMMMMMMk',
  '.kTttttttttttTk..',
  '..kkkkkkkkkkkkk..',
];

// ---------------------------------------------------------------- quadro
const QUADRO = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDTtttttttttttttttttttTTDk',
  'kDtwwwwwwwwwwwwwwwwwwwwtDk',
  'kDtwwwwwwwwwwwwwwwwwwwwtDk',
  'kDtwwwwwwwwwwkkwwwwwwwwtDk',
  'kDtwwwwwwwwwkddkwwwwwwwtDk',
  'kDtwwwwwwwwkddddkwwwwwwtDk',
  'kDtwwwwwwwkddddddkwwwwwwtDk',
  'kDtwwwwwkddwddddddkwwwwwtDk',
  'kDtwwwwkdddddddddddkwwwwtDk',
  'kDtwwwwwkdkkddkkdkwwwwwwtDk',
  'kDtwwwwwwwwwwwwwwwwwwwwtDk',
  'kDtwwwwwwwwwwwwwwwwwwwwtDk',
  'kDTtttttttttttttttttttTTDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkk',
];

// ---------------------------------------------------------------- janela
const JANELA_INTERNA = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDDvvvvvvvvvvvvvvDDvvvvvvvvvvvvvDk',
  'kDDvVVvvvvvvvvvvvDDvvvvvvvvvvvvvDk',
  'kDDvVvvvvvvvvvvvvDDvvvvvvvvvvvvvDk',
  'kDDvvvvvvvvvvvvvvDDvvvvvvvvvvvvvDk',
  'kDDvvvvvvvGvvvvvvDDvvvvvvvvGvvvvDk',
  'kDDvvvvvvGGGvvvvvDDvvvvvvvGGGvvvDk',
  'kDDvvvvvGGGGGvvvvDDvvvvvvGGGGGvvDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDDvvGGGGGGGvvvvvDDvvGGvvvvvGGGvDk',
  'kDDvGGgGGGGGGvvvvDDvGGGGvvvGGGGGDk',
  'kDDvGGGGgGGGGGvvvDDGGGGGGGGGGGGGDk',
  'kDDvvGGGGGGGGGGvvDDvGGGGGGGGGGGvDk',
  'kDDvvvGGGGGGGGGvvDDvvGGGGGGGGGvvDk',
  'kDDvvvvGGGGGGGvvvDDvvvGGGGGGGvvvDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

// ----------------------------------------------------------------- banco
const BANCO = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttttttttttttttk',
  'ktttttttttttttttttttttttttttttTk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  ...repetir(['.kDDk......................kDDk.'], 8),
  '.kkkk......................kkkk.',
];

// --------------------------------------------------- prateleira de parede
const PRATELEIRA_PAREDE = [
  '...kkkk......kkkk......kkkk...',
  '..kCCCCk....koOOok....kCCCCk..',
  '..kCwCCk....koOoOk....kCwCCk..',
  '..kCCCCk....koOOok....kCCCCk..',
  '..kCCCCk....koOOok....kCCCCk..',
  '..kkkkkk....kkkkkk....kkkkkk..',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kTTTTTTTTTTTTTTTTTTTTTTTTTTTTk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '...kDk..................kDk...',
  '...kkk..................kkk...',
];

// ----------------------------------------------------------------- caixa
const CAIXA = [
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  'kTttttttttttttttttttttTk',
  'ktDttttttttttttttttttDtk',
  'kttDttttttttttttttttDttk',
  'ktttDttttttttttttttDtttk',
  'kttttDttttttttttttDttttk',
  'kDDDDDDDDDDDDDDDDDDDDDDk',
  'kttttDttttttttttttDttttk',
  'ktttDttttttttttttttDtttk',
  'kttDttttttttttttttttDttk',
  'ktDttttttttttttttttttDtk',
  'kTttttttttttttttttttttTk',
  'kkkkkkkkkkkkkkkkkkkkkkkk',
];

// ------------------------------------------------------------------- vaso
const VASO = [
  '....kGk.....kGk.....',
  '...kGGGkkkkGGGk.....',
  '..kGgGGGGGGGGGk.....',
  '..kGGkGkGkGGkGk.....',
  '...kkkkGkGkkkk......',
  '.....kGGGk..........',
  '......kGk...........',
  '......kGk...........',
  '...kkkkkkkkkkk......',
  '..kNNNNNNNNNNNk.....',
  '..kNnNNNNNNNnNk.....',
  '..kNNNNNNNNNNNk.....',
  '..kNNNNNNNNNNNk.....',
  '...knNNNNNNNnk......',
  '...kNNNNNNNNNk......',
  '....kkkkkkkkk.......',
];

const LAMPIAO = [
  '..kkkkk..',
  '.kMMMMMk.',
  'kMvvvvvMk',
  'kMvvavvMk',
  'kMvaaavMk',
  'kMvvavvMk',
  'kMvvvvvMk',
  '.kMMMMMk.',
  '..kDDDk..',
  '..kDDDk..',
  '..kkkkk..',
];

const CERCA = [
  '..k........k....',
  '.kTk......kTk...',
  '.kTk......kTk...',
  'kkkkkkkkkkkkkkkk',
  '.kTk......kTk...',
  '.kTk......kTk...',
  'kkkkkkkkkkkkkkkk',
  '.kTk......kTk...',
  '.kTk......kTk...',
  '.kkk......kkk...',
];

const PLACA = [
  '.kkkkkkkkkkkkk.',
  'kTtttttttttttTk',
  'ktDDttDttDDttTk',
  'ktttDttDttDtttk',
  'kTtttttttttttTk',
  '.kkkkkDDkkkkkk.',
  '.....kDDk......',
  '.....kDDk......',
  '.....kkkk......',
];

const HORTA = [
  'kkkkkkkkkkkkkkkk',
  'kSSSSSSSSSSSSSSk',
  'kSgSSgSSgSSgSSSk',
  'kSggSggSggSggSSk',
  'kSSSSSSSSSSSSSSk',
  'kSgSSgSSgSSgSSSk',
  'kSggSggSggSggSSk',
  'kkkkkkkkkkkkkkkk',
];

/** Tapete grande da sala, tecido em camadas. */
function desenharTapete(): Sprite {
  const W = 84;
  const H = 56;
  const p = new Pincel(W, H);
  const rng = new Rng(3131);
  p.retangulo(0, 0, W, H, '#8c3f44');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((x + y) % 5 === 0) p.ponto(x, y, '#7a353c');
      if (rng.chance(0.04)) p.ponto(x, y, '#9e4a4a');
    }
  }
  p.contorno(0, 0, W, H, '#5c2429');
  p.contorno(2, 2, W - 4, H - 4, '#c9803f');
  p.contorno(4, 4, W - 8, H - 8, '#e0b070');
  p.contorno(8, 8, W - 16, H - 16, '#c9803f');
  const cx = W / 2;
  const cy = H / 2;
  for (let i = 0; i < 15; i++) {
    const cor = i % 2 ? '#e0b070' : '#c9803f';
    p.linha(cx - i, cy, cx, cy - i, cor);
    p.linha(cx + i, cy, cx, cy - i, cor);
    p.linha(cx - i, cy, cx, cy + i, cor);
    p.linha(cx + i, cy, cx, cy + i, cor);
  }
  for (let x = 2; x < W - 2; x += 3) {
    p.ponto(x, 0, '#e0b070');
    p.ponto(x, H - 1, '#e0b070');
  }
  return p.finalizar();
}

export interface ArteCasa {
  exterior: Sprite;
  haloLampiao: Sprite;
  cama: Sprite;
  armario: Sprite;
  mesa: Sprite;
  cadeira: Sprite;
  bau: Sprite;
  lareira: Sprite;
  chamas: Sprite[];
  estante: Sprite;
  barril: Sprite;
  quadro: Sprite;
  janela: Sprite;
  banco: Sprite;
  prateleiraParede: Sprite;
  caixa: Sprite;
  vaso: Sprite;
  lampiao: Sprite;
  tapete: Sprite;
  cerca: Sprite;
  placa: Sprite;
  horta: Sprite;
}

export function criarCasa(): ArteCasa {
  return {
    exterior: desenharCasa(),
    haloLampiao: desenharHaloLampiao(),
    cama: pintar(CAMA, PAL),
    armario: pintar(ARMARIO, PAL),
    mesa: pintar(MESA, PAL),
    cadeira: pintar(CADEIRA, PAL),
    bau: pintar(BAU, PAL),
    lareira: pintar(LAREIRA, PAL),
    chamas: CHAMAS.map((c) => pintar(c, PAL)),
    estante: pintar(ESTANTE, PAL),
    barril: pintar(BARRIL, PAL),
    quadro: pintar(QUADRO, PAL),
    janela: pintar(JANELA_INTERNA, PAL),
    banco: pintar(BANCO, PAL),
    prateleiraParede: pintar(PRATELEIRA_PAREDE, PAL),
    caixa: pintar(CAIXA, PAL),
    vaso: pintar(VASO, PAL),
    lampiao: pintar(LAMPIAO, PAL),
    tapete: desenharTapete(),
    cerca: pintar(CERCA, PAL),
    placa: pintar(PLACA, PAL),
    horta: pintar(HORTA, PAL),
  };
}
