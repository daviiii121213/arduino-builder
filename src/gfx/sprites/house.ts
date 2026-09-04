/**
 * A casa do jogador e a mobília do interior.
 *
 * Escala compacta: a casa cabe em 64x56 pixels e cada móvel ocupa pouco espaço,
 * para o interior ficar apertadinho e cheio em vez de grande e vazio. O
 * exterior é desenhado pixel a pixel; a mobília usa mapas de caracteres.
 */

import { Pincel, pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';
import { Rng } from '../../core/rng';

export const CASA_W = 64;
export const CASA_H = 56;

/** Retângulo de colisão da casa, relativo ao canto superior esquerdo. */
export const CASA_COLISAO = { x: 4, y: 28, w: 56, h: 26 };
/** Porta (área de interação), relativa ao canto superior esquerdo. */
export const CASA_PORTA = { x: 25, y: 40, w: 15, h: 14 };

function desenharCasa(telhadoNovo = false): Sprite {
  const p = new Pincel(CASA_W, CASA_H);
  const rng = new Rng(4242);

  // ---------------- chaminé ----------------
  const chX = 44;
  const chW = 9;
  p.retangulo(chX, 2, chW, 14, P.tijolo);
  for (let y = 2; y < 16; y += 3) {
    p.linha(chX, y, chX + chW - 1, y, '#6f3a2c');
    for (let x = chX + (((y / 3) | 0) % 2 ? 2 : 5); x < chX + chW; x += 5) {
      p.linha(x, y, x, Math.min(15, y + 2), '#6f3a2c');
    }
  }
  p.retangulo(chX - 2, 0, chW + 4, 3, P.pedra);
  p.linha(chX - 2, 2, chX + chW + 1, 2, P.pedraEscura);
  p.contorno(chX - 2, 0, chW + 4, 3, P.contorno);
  p.linha(chX, 3, chX, 15, P.contorno);
  p.linha(chX + chW - 1, 3, chX + chW - 1, 15, P.contorno);

  // ---------------- telhado ----------------
  const corTelha = telhadoNovo ? '#c9553f' : P.telhado;
  const corTelhaLuz = telhadoNovo ? '#e8785c' : P.telhadoLuz;
  const corTelhaEscura = telhadoNovo ? '#8e2f28' : P.telhadoEscuro;
  const yTopo = 8;
  const yBase = 28;
  for (let y = yTopo; y <= yBase; y++) {
    const t = (y - yTopo) / (yBase - yTopo);
    const xe = Math.round(24 - t * 22);
    const xd = Math.round(40 + t * 22);
    for (let x = xe; x <= xd; x++) {
      p.ponto(x, y, x < (xe + xd) / 2 ? corTelhaLuz : corTelha);
    }
    if ((y - yTopo) % 3 === 2) for (let x = xe; x <= xd; x++) p.ponto(x, y, corTelhaEscura);
    const grupo = Math.floor((y - yTopo) / 3);
    for (let x = xe + (grupo % 2 ? 2 : 4); x <= xd; x += 5) {
      if ((y - yTopo) % 3 !== 2) p.ponto(x, y, corTelhaEscura);
    }
    p.ponto(xe, y, P.contorno);
    p.ponto(xd, y, P.contorno);
  }
  p.linha(24, yTopo, 40, yTopo, corTelhaLuz);
  p.linha(24, yTopo - 1, 40, yTopo - 1, P.contorno);
  if (telhadoNovo) {
    // cata-vento: sinal visível da melhoria comprada
    p.linha(32, yTopo - 6, 32, yTopo - 1, P.metalEscuro);
    p.retangulo(33, yTopo - 6, 3, 2, P.metal);
    p.ponto(31, yTopo - 5, P.metal);
    p.ponto(32, yTopo - 7, P.ambar);
  }
  // beiral
  p.retangulo(0, yBase, CASA_W, 2, corTelhaEscura);
  p.linha(0, yBase + 1, CASA_W - 1, yBase + 1, P.contorno);

  // ---------------- paredes de tábuas ----------------
  const px0 = 4;
  const px1 = 59;
  const py0 = 30;
  const py1 = 48;
  p.retangulo(px0, py0, px1 - px0 + 1, py1 - py0 + 1, P.madeira);
  for (let y = py0; y <= py1; y++) {
    for (let x = px0; x <= px1; x++) {
      if (rng.chance(0.06)) p.ponto(x, y, P.madeiraClara);
      else if (rng.chance(0.05)) p.ponto(x, y, P.madeiraEscura);
    }
  }
  for (let y = py0 + 2; y <= py1; y += 3) p.linha(px0, y, px1, y, P.madeiraEscura);
  p.retangulo(px0, py0, px1 - px0 + 1, 1, '#6d4c28');
  p.retangulo(px0, py0, 2, py1 - py0 + 1, P.madeiraEscura);
  p.retangulo(px1 - 1, py0, 2, py1 - py0 + 1, P.madeiraEscura);
  p.linha(px0, py0, px0, py1, P.contorno);
  p.linha(px1, py0, px1, py1, P.contorno);

  // ---------------- alicerce de pedra ----------------
  const fy0 = 48;
  const fy1 = 54;
  p.retangulo(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.pedra);
  for (let fila = 0; fila < 2; fila++) {
    const y = fy0 + fila * 3;
    p.linha(px0 - 1, y, px1 + 1, y, P.pedraEscura);
    for (let x = px0 + (fila % 2 ? 3 : 7); x < px1; x += 8) {
      p.linha(x, y, x, Math.min(fy1, y + 2), P.pedraEscura);
    }
    for (let x = px0; x <= px1; x++) if (rng.chance(0.09)) p.ponto(x, y + 1, P.pedraClara);
  }
  p.contorno(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.contorno);

  // ---------------- janelas ----------------
  const janela = (jx: number, jy: number) => {
    p.retangulo(jx - 1, jy - 1, 13, 12, P.madeiraEscura);
    p.contorno(jx - 1, jy - 1, 13, 12, P.contorno);
    p.retangulo(jx + 1, jy + 1, 9, 8, P.vidro);
    for (let i = 0; i < 6; i++) {
      p.ponto(jx + 2 + i, jy + 7 - i, P.vidroLuz);
      p.ponto(jx + 3 + i, jy + 7 - i, P.vidroLuz);
    }
    p.linha(jx + 5, jy + 1, jx + 5, jy + 8, P.madeiraEscura);
    p.linha(jx + 1, jy + 4, jx + 10, jy + 4, P.madeiraEscura);
    p.retangulo(jx - 2, jy + 11, 15, 1, P.madeiraClara);
    p.linha(jx - 2, jy + 12, jx + 12, jy + 12, P.contorno);
  };
  janela(8, 33);
  janela(43, 33);

  // ---------------- porta ----------------
  const dx = 25;
  const dy = 36;
  const dw = 15;
  const dh = 18;
  p.retangulo(dx, dy, dw, dh, P.madeiraEscura);
  p.retangulo(dx + 2, dy + 2, dw - 4, dh - 2, P.madeiraClara);
  for (let x = dx + 2; x < dx + dw - 2; x += 3) p.linha(x, dy + 2, x, dy + dh - 1, '#8d6437');
  for (let i = 0; i < 3; i++) {
    p.linha(dx + 2, dy + 2 + i, dx + 3 - i, dy + 2 + i, P.madeiraEscura);
    p.linha(dx + dw - 4 + i, dy + 2 + i, dx + dw - 3, dy + 2 + i, P.madeiraEscura);
  }
  p.retangulo(dx + 3, dy + 7, 2, 2, P.metalEscuro);
  p.retangulo(dx + 3, dy + 13, 2, 2, P.metalEscuro);
  p.ponto(dx + dw - 4, dy + 10, P.metal);
  p.ponto(dx + dw - 4, dy + 9, P.brilho);
  p.contorno(dx, dy, dw, dh, P.contorno);
  p.retangulo(dx - 2, dy + dh - 1, dw + 4, 2, P.pedra);
  p.contorno(dx - 2, dy + dh - 1, dw + 4, 2, P.contorno);

  // ---------------- lampião ----------------
  const lx = 41;
  const ly = 36;
  p.linha(lx, ly, lx + 2, ly, P.metalEscuro);
  p.retangulo(lx + 2, ly + 1, 4, 5, P.metalEscuro);
  p.retangulo(lx + 3, ly + 2, 2, 3, P.ambar);
  p.ponto(lx + 3, ly + 2, P.brilho);

  return p.finalizar();
}

/** Halo suave do lampião (desenhado por cima, com transparência). */
function desenharHaloLampiao(): Sprite {
  const p = new Pincel(18, 18);
  for (let y = 0; y < 18; y++) {
    for (let x = 0; x < 18; x++) {
      const d = Math.hypot(x - 8.5, y - 8.5);
      if (d < 8) p.ponto(x, y, P.ambar, 0.11 * (1 - d / 8));
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
  A: P.ambarEscuro,
  v: P.vidro,
  V: P.vidroLuz,
  d: P.folhaEscura,
  x: '#1a1016',
  n: '#a8552f',
  N: '#c46f42',
  G: P.folhaClara,
};

// ---- cama 18x24: cabeceira, travesseiro e colcha xadrez
const CAMA = [
  'kkk..........kkkk',
  'kDkkkkkkkkkkkkkDk',
  'kDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTDk',
  'kDkkkkkkkkkkkkkDk',
  'kDkwwwwwwwwwwwkDk',
  'kDkwWWWWWWWWWwkDk',
  'kDkwwwwwwwwwwwkDk',
  'kDkkkkkkkkkkkkkDk',
  'kDkbbbbbbbbbbbkDk',
  'kDkBbBBBBbBBBBkDk',
  'kDkBbBBBBbBBBBkDk',
  'kDkbbbbbbbbbbbkDk',
  'kDkBbBBBBbBBBBkDk',
  'kDkBbBBBBbBBBBkDk',
  'kDkBbBBBBbBBBBkDk',
  'kDkbbbbbbbbbbbkDk',
  'kDkBbBBBBbBBBBkDk',
  'kDkkkkkkkkkkkkkDk',
  'kDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTDk',
  'kkk..........kkkk',
];

// ---- armário 18x22
const ARMARIO = [
  'kkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDk',
  'kDTTTTTTTTTTTTTTDk',
  'kkkkkkkkkkkkkkkkkk',
  'kDttttttkkttttttDk',
  'kDtTtttSkkStttTtDk',
  'kDttttttkkttttttDk',
  'kDttttttkkttttttDk',
  'kDtttttMkkMtttttDk',
  'kDttttttkkttttttDk',
  'kDtTtttSkkStttTtDk',
  'kDttttttkkttttttDk',
  'kDttttttkkttttttDk',
  'kDtTtttSkkStttTtDk',
  'kDttttttkkttttttDk',
  'kkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkk',
  '.kDk..........kDk.',
  '.kkk..........kkk.',
];

// ---- mesa 30x16 com duas cadeiras separadas
const MESA = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttttttttttttk',
  'ktttttttttttttttttttttttttttTk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '..kDDk....................kDDk',
  '..kDDk....................kDDk',
  '..kDDk....................kDDk',
  '..kkkk....................kkkk',
];

const CADEIRA = [
  '.kkkkkkkk.',
  '.kDttttDk.',
  '.kDtTttDk.',
  '.kDttttDk.',
  '.kDttttDk.',
  '.kkkkkkkk.',
  'kttttttttk',
  'kTtttttTtk',
  'kkkkkkkkkk',
  '.kDk..kDk.',
  '.kDk..kDk.',
  '.kkk..kkk.',
];

// ---- baú 18x11
const BAU = [
  '.kkkkkkkkkkkkkkkk.',
  'kMMMMMMMMMMMMMMMMk',
  'kDttttttttttttttDk',
  'kDtTtttttttttttTDk',
  'kkkkkkkMMMkkkkkkkk',
  'kDtttttMMMMttttttk',
  'kDtTtttMMMttttttDk',
  'kDttttttttttttttDk',
  'kkkkkkkkkkkkkkkkkk',
];

const BAU_ABERTO = [
  '.kkkkkkkkkkkkkkkk.',
  'kDttttttttttttttDk',
  'kMMMMMMMMMMMMMMMMk',
  'kkkkkkkkkkkkkkkkkk',
  'kDxxxxxxxxxxxxxxDk',
  'kDxaAxxoOxxxMmxxDk',
  'kDxaAxxoOxxxMmxxDk',
  'kDxxxxxxxxxxxxxxDk',
  'kMMMMMMMMMMMMMMMMk',
  'kDttttttttttttttDk',
  'kkkkkkkkkkkkkkkkkk',
];

// ---- lareira 26x22 com cornija e boca acesa
const LAREIRA = [
  '.....kkkkkkkkkkkkkkkk.....',
  '.....kpSppPpSppPpSppk.....',
  '.....kpPpSppPpSppPpSk.....',
  '..kkkkppSppPpSppPpSpkkkk..',
  'kkppSppPpSppPpSppPpSppPpSk',
  'kPPPPPPPPPPPPPPPPPPPPPPPPk',
  'kSSSSSSSSSSSSSSSSSSSSSSSSk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kpPpSppPpSppPpSppPpSppPpSk',
  'kpSppPkkkkkkkkkkkkkPpSppPk',
  'kppSppkxxxxxxxxxxxkpPpSppk',
  'kpSppPkxxxxxxxxxxxkppSppPk',
  'kppSppkxxxxxxxxxxxkpSppPpk',
  'kpSppPkxxxxxxxxxxxkppSppPk',
  'kppSppkkxxxxxxxxxkkpSppPpk',
  'kpSppPpkkkkkkkkkkkPpSppPpk',
  'kppSppPpSppPpSppPpSppPpSpk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkk',
];

const CHAMAS = [
  ['...ff...', '..ffFf..', '.ffFwFf.', 'ffFFwFff', '.ffFFff.', '..kkkk..'],
  ['..ff....', '.fFff...', 'ffFwFf..', 'fFwFFff.', '.fffff..', '..kkk...'],
  ['....ff..', '...ffFf.', '..fFwFff', '.ffFwFFf', '..fffff.', '...kkk..'],
];

// ---- estante 28x20
const ESTANTE = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDttttttttttttttttttttttttDk',
  'kDtCCkoOkCCCkoOkoOkCCkoOttDk',
  'kDtCCkoOkCCCkoOkoOkCCkoOttDk',
  'kDtCCkoOkCCCkoOkoOkCCkoOttDk',
  'kDttttttttttttttttttttttttDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDtoOkCCCkoOkCCkoOkCCCkoOtDk',
  'kDtoOkCCCkoOkCCkoOkCCCkoOtDk',
  'kDtoOkCCCkoOkCCkoOkCCCkoOtDk',
  'kDttttttttttttttttttttttttDk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kDtCCCkoOkCCkoOkCCCkoOkoOtDk',
  'kDtCCCkoOkCCkoOkCCCkoOkoOtDk',
  'kDttttttttttttttttttttttttDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

// ---- barril 12x14
const BARRIL = [
  '..kkkkkkkk..',
  '.kTttttttTk.',
  'kMMMMMMMMMMk',
  'kTtttttttttk',
  'kTttttttttTk',
  'kMMMMMMMMMMk',
  'kTtttttttttk',
  'kTttttttttTk',
  'kMMMMMMMMMMk',
  '.kTttttttTk.',
  '..kkkkkkkk..',
];

// ---- quadro 16x12
const QUADRO = [
  'kkkkkkkkkkkkkkkk',
  'kDTttttttttttTDk',
  'kDtwwwwwwwwwwtDk',
  'kDtwwwwwkkwwwtDk',
  'kDtwwwwkddkwwtDk',
  'kDtwwwkddddkwtDk',
  'kDtwwkddwdddktDk',
  'kDtwwkddddddktDk',
  'kDtwwwkdkkdkwtDk',
  'kDtwwwwwwwwwwtDk',
  'kDTttttttttttTDk',
  'kkkkkkkkkkkkkkkk',
];

// ---- janela interna 22x16 com vista da selva
const JANELA_INTERNA = [
  'kkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDk',
  'kDDvvvvvvvvDDvvvvvvvDk',
  'kDDvVvvvvvvDDvvvvvvvDk',
  'kDDvvvvvvvvDDvvvvvvvDk',
  'kDDvvvvGvvvDDvvvGvvvDk',
  'kDDvvvGGGvvDDvvGGGvvDk',
  'kDDDDDDDDDDDDDDDDDDDDk',
  'kDDvGGGGGGvvDDGGvvGGDk',
  'kDDvGgGGGGGvDDGGGGGGDk',
  'kDDvvGGGGGGvDDvGGGGvDk',
  'kDDvvvGGGGvvDDvvGGvvDk',
  'kDDDDDDDDDDDDDDDDDDDDk',
  'kTTTTTTTTTTTTTTTTTTTTk',
  'kkkkkkkkkkkkkkkkkkkkkk',
];

// ---- banco 20x11
const BANCO = [
  'kkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttk',
  'kDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkk',
  '.kDDk............kDk',
  '.kDDk............kDk',
  '.kkkk............kkk',
];

// ---- prateleira de parede 22x11
const PRATELEIRA_PAREDE = [
  '..kkkk.....kkkk.......',
  '.kCCCCk...koOOok......',
  '.kCwCCk...koOoOk......',
  '.kCCCCk...koOOok......',
  '.kkkkkk...kkkkkk......',
  'kDDDDDDDDDDDDDDDDDDDDk',
  'kTTTTTTTTTTTTTTTTTTTTk',
  'kkkkkkkkkkkkkkkkkkkkkk',
  '..kDk............kDk..',
  '..kkk............kkk..',
];

// ---- caixa 16x11
const CAIXA = [
  'kkkkkkkkkkkkkkkk',
  'kTttttttttttttTk',
  'ktDttttttttttDtk',
  'kttDttttttttDttk',
  'kDDDDDDDDDDDDDDk',
  'kttDttttttttDttk',
  'ktDttttttttttDtk',
  'kTttttttttttttTk',
  'kkkkkkkkkkkkkkkk',
];

// ---- vaso com planta 12x14
const VASO = [
  '..kGk.kGk...',
  '.kGGGkGGGk..',
  'kGgGGGGGGGk.',
  'kGGkGkGkGGk.',
  '.kkkGkGkkk..',
  '...kGGGk....',
  '..kkkkkkk...',
  '.kNNNNNNNk..',
  '.kNnNNNnNk..',
  '.kNNNNNNNk..',
  '..knNNNnk...',
  '..kkkkkkk...',
];

const LAMPIAO = [
  '.kkkkk.',
  'kMMMMMk',
  'kMvavMk',
  'kMaaaMk',
  'kMvavMk',
  'kMMMMMk',
  '.kDDDk.',
  '.kkkkk.',
];

const CERCA = [
  '.k......k...',
  'kTk....kTk..',
  'kTk....kTk..',
  'kkkkkkkkkkkk',
  'kTk....kTk..',
  'kTk....kTk..',
  'kkkkkkkkkkkk',
  'kTk....kTk..',
  'kkk....kkk..',
];

const PLACA = [
  'kkkkkkkkkkk',
  'kTtttttttTk',
  'ktDDttDttTk',
  'ktttDttDttk',
  'kTtttttttTk',
  'kkkkDDkkkkk',
  '...kDDk....',
  '...kkkk....',
];

const HORTA = [
  'kkkkkkkkkkkk',
  'kSSSSSSSSSSk',
  'kSgSSgSSgSSk',
  'kSggSggSggSk',
  'kSSSSSSSSSSk',
  'kSgSSgSSgSSk',
  'kkkkkkkkkkkk',
];

/** Tapete da sala: compacto, tecido em camadas. */
function desenharTapete(): Sprite {
  const W = 52;
  const H = 34;
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
  const cx = W / 2;
  const cy = H / 2;
  for (let i = 0; i < 9; i++) {
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
  exteriorNovo: Sprite;
  haloLampiao: Sprite;
  cama: Sprite;
  armario: Sprite;
  mesa: Sprite;
  cadeira: Sprite;
  bau: Sprite;
  bauAberto: Sprite;
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
    exterior: desenharCasa(false),
    exteriorNovo: desenharCasa(true),
    haloLampiao: desenharHaloLampiao(),
    cama: pintar(CAMA, PAL),
    armario: pintar(ARMARIO, PAL),
    mesa: pintar(MESA, PAL),
    cadeira: pintar(CADEIRA, PAL),
    bau: pintar(BAU, PAL),
    bauAberto: pintar(BAU_ABERTO, PAL),
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
