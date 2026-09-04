/**
 * Cabana de melhorias, a máquina de venda e as duas pessoas que atendem lá.
 *
 * A cabana é uma oficina de troncos, bem diferente da casa do jogador: telhado
 * de tábuas com musgo, chaminé larga de forja, porta dupla e um toldo com
 * ferramentas penduradas.
 */

import { Pincel, pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';
import { Rng } from '../../core/rng';

export const CABANA_W = 76;
export const CABANA_H = 62;
/** Colisão do corpo da cabana, relativa ao canto superior esquerdo. */
export const CABANA_COLISAO = { x: 4, y: 32, w: 68, h: 26 };
/** Porta dupla (área de interação). */
export const CABANA_PORTA = { x: 30, y: 44, w: 18, h: 14 };

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  t: P.madeira,
  T: P.madeiraClara,
  D: P.madeiraEscura,
  p: P.pedra,
  P: P.pedraClara,
  S: P.pedraEscura,
  m: P.metal,
  M: P.metalEscuro,
  f: P.fogo,
  F: P.fogoClaro,
  w: P.brilho,
  o: P.osso,
  O: P.ossoEscuro,
  a: P.ambar,
  A: P.ambarEscuro,
  v: P.vidro,
  V: P.vidroLuz,
  g: P.folha,
  G: P.folhaClara,
  c: '#b8322f',
  x: '#1a1016',
  // pele e roupas dos NPCs
  e: P.pele,
  E: P.peleSombra,
  h: '#2e1d10',
  H: '#4a2f1c',
  b: '#7a4a2a',
  n: '#3f4a6b',
  N: '#59668f',
  r: '#8c3f44',
  R: '#b0565a',
  z: '#4f6b3a',
  Z: '#6f8f52',
};

// ---------------------------------------------------------------- exterior

function desenharCabana(): Sprite {
  const p = new Pincel(CABANA_W, CABANA_H);
  const rng = new Rng(9091);

  // ---- chaminé larga da forja, encostada no telhado
  const chX = 46;
  const chW = 12;
  p.retangulo(chX, 2, chW, 16, P.pedra);
  for (let y = 2; y < 18; y += 3) {
    p.linha(chX, y, chX + chW - 1, y, P.pedraEscura);
    for (let x = chX + (((y / 3) | 0) % 2 ? 2 : 6); x < chX + chW; x += 6) {
      p.linha(x, y, x, Math.min(17, y + 2), P.pedraEscura);
    }
  }
  for (let x = chX; x < chX + chW; x++) if (rng.chance(0.14)) p.ponto(x, 3 + rng.int(1, 13), P.pedraClara);
  p.retangulo(chX - 2, 0, chW + 4, 3, P.pedraEscura);
  p.retangulo(chX - 2, 1, chW + 4, 1, P.pedra);
  p.contorno(chX - 2, 0, chW + 4, 3, P.contorno);
  p.linha(chX, 3, chX, 18, P.contorno);
  p.linha(chX + chW - 1, 3, chX + chW - 1, 18, P.contorno);
  p.retangulo(chX + 3, 1, chW - 6, 1, P.fogo);

  // ---- telhado de tábuas com musgo
  const yTopo = 9;
  const yBase = 31;
  for (let y = yTopo; y <= yBase; y++) {
    const t = (y - yTopo) / (yBase - yTopo);
    const xe = Math.round(28 - t * 26);
    const xd = Math.round(48 + t * 26);
    for (let x = xe; x <= xd; x++) {
      p.ponto(x, y, x < (xe + xd) / 2 ? P.madeira : '#5f4023');
    }
    if ((y - yTopo) % 4 === 3) for (let x = xe; x <= xd; x++) p.ponto(x, y, P.madeiraEscura);
    if (rng.chance(0.45)) {
      const mx = rng.int(xe + 2, xd - 2);
      p.ponto(mx, y, rng.chance(0.5) ? P.folha : P.folhaEscura);
      p.ponto(mx + 1, y, P.folhaEscura);
    }
    p.ponto(xe, y, P.contorno);
    p.ponto(xd, y, P.contorno);
  }
  p.linha(28, yTopo, 48, yTopo, P.madeiraClara);
  p.linha(28, yTopo - 1, 48, yTopo - 1, P.contorno);
  p.retangulo(0, yBase, CABANA_W, 2, P.madeiraEscura);
  p.linha(0, yBase + 1, CABANA_W - 1, yBase + 1, P.contorno);

  // ---- paredes de troncos empilhados
  const px0 = 4;
  const px1 = 71;
  const py0 = 33;
  const py1 = 52;
  for (let y = py0; y <= py1; y++) {
    const dentro = (y - py0) % 5;
    for (let x = px0; x <= px1; x++) {
      let cor: string = P.madeira;
      if (dentro === 0) cor = P.madeiraEscura;
      else if (dentro === 1) cor = P.madeiraClara;
      else if (dentro === 4) cor = '#5f4023';
      p.ponto(x, y, cor);
      if (rng.chance(0.05)) p.ponto(x, y, '#7c5730');
    }
  }
  for (let y = py0 + 2; y <= py1; y += 5) {
    p.disco(px0 + 1, y, 1, P.madeiraClara);
    p.disco(px1 - 1, y, 1, P.madeiraClara);
  }
  p.linha(px0, py0, px0, py1, P.contorno);
  p.linha(px1, py0, px1, py1, P.contorno);

  // ---- alicerce
  const fy0 = 52;
  const fy1 = 59;
  p.retangulo(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.pedra);
  for (let fila = 0; fila < 2; fila++) {
    const y = fy0 + fila * 3;
    p.linha(px0 - 1, y, px1 + 1, y, P.pedraEscura);
    for (let x = px0 + (fila % 2 ? 4 : 9); x < px1; x += 10) {
      p.linha(x, y, x, Math.min(fy1, y + 2), P.pedraEscura);
    }
    for (let x = px0; x <= px1; x++) if (rng.chance(0.08)) p.ponto(x, y + 1, P.pedraClara);
  }
  p.contorno(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.contorno);

  // ---- janela com a luz da forja atravessando
  const jx = 10;
  const jy = 37;
  p.retangulo(jx - 1, jy - 1, 14, 12, P.madeiraEscura);
  p.contorno(jx - 1, jy - 1, 14, 12, P.contorno);
  p.retangulo(jx + 1, jy + 1, 10, 8, P.vidro);
  for (let i = 0; i < 6; i++) p.ponto(jx + 2 + i, jy + 7 - i, P.vidroLuz);
  p.retangulo(jx + 6, jy + 3, 5, 6, '#e0a24a');
  p.linha(jx + 6, jy + 1, jx + 6, jy + 8, P.madeiraEscura);
  p.linha(jx + 1, jy + 4, jx + 11, jy + 4, P.madeiraEscura);

  // ---- porta dupla com toldo
  const dx = 30;
  const dy = 40;
  const dw = 18;
  const dh = 18;
  p.retangulo(dx - 4, dy - 4, dw + 8, 3, P.madeiraClara);
  p.linha(dx - 4, dy - 2, dx + dw + 3, dy - 2, P.madeiraEscura);
  p.contorno(dx - 4, dy - 4, dw + 8, 3, P.contorno);
  p.retangulo(dx, dy, dw, dh, P.madeiraEscura);
  p.retangulo(dx + 2, dy + 2, dw / 2 - 2, dh - 2, P.madeiraClara);
  p.retangulo(dx + dw / 2 + 1, dy + 2, dw / 2 - 3, dh - 2, P.madeiraClara);
  for (let x = dx + 2; x < dx + dw - 2; x += 3) p.linha(x, dy + 2, x, dy + dh - 1, '#8d6437');
  p.linha(dx + dw / 2, dy + 1, dx + dw / 2, dy + dh - 1, P.madeiraEscura);
  p.retangulo(dx + dw / 2 - 2, dy + 8, 1, 3, P.metal);
  p.retangulo(dx + dw / 2 + 2, dy + 8, 1, 3, P.metal);
  p.contorno(dx, dy, dw, dh, P.contorno);
  p.retangulo(dx - 2, dy + dh - 1, dw + 4, 2, P.pedra);
  p.contorno(dx - 2, dy + dh - 1, dw + 4, 2, P.contorno);

  // ---- ferramentas na parede
  const fx = 54;
  const fy = 38;
  p.linha(fx - 1, fy - 1, fx + 14, fy - 1, P.madeiraEscura);
  p.retangulo(fx, fy, 1, 6, P.madeira);
  p.retangulo(fx - 1, fy, 4, 2, P.metalEscuro);
  p.retangulo(fx + 6, fy, 1, 5, P.madeira);
  p.retangulo(fx + 4, fy + 5, 6, 1, P.metal);
  p.anel(fx + 12, fy + 4, 3, P.metalEscuro, 1);

  return p.finalizar();
}

/** Fumaça da chaminé é feita de partículas; aqui só o brilho da forja. */
function desenharBrilhoForja(): Sprite {
  const p = new Pincel(26, 26);
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 26; x++) {
      const d = Math.hypot(x - 12.5, y - 12.5);
      if (d < 12) p.ponto(x, y, P.fogo, 0.09 * (1 - d / 12));
    }
  }
  return p.finalizar();
}

// ------------------------------------------------------- máquina de venda

/**
 * Máquina de venda: tremonha em cima para jogar os recursos, mostrador de
 * valores, alavanca do lado e bandeja de moedas embaixo.
 */
const MAQUINA_VENDA = [
  '.kkkkkkkkkkkkkkkk.',
  'kMMMMMMMMMMMMMMMMk',
  'kMmkkkkkkkkkkkkmMk',
  'kMmkxxxxxxxxxxkmMk',
  'kMmkxaaxxaaxxaxkmMk',
  'kMmkxxxxxxxxxxkmMk',
  'kMmkkkkkkkkkkkkmMk',
  'kMkTtttttttttttkMk',
  'kMkTtDDDDDDDDttkMk',
  'kMkTtDvvvvvvDttkMk',
  'kMkTtDvVaaaVvDtkMk',
  'kMkTtDvvaaavvDtkMk',
  'kMkTtDDDDDDDDttkMk',
  'kMkTttttttttttkkMk',
  'kMkTtkkkkkkkkttkMk',
  'kMkTtkxaAaAaxttkMk',
  'kMkTtkkkkkkkkttkMk',
  'kMkTttttttttttkMkk',
  'kMmmmmmmmmmmmmmMk.',
  'kMMMMMMMMMMMMMMMk.',
  'kkkkkkkkkkkkkkkk..',
  '.kMk........kMk...',
  '.kkk........kkk...',
];

/** A alavanca em duas posições, para animar a venda. */
const ALAVANCA = [
  ['..kk..', '.kmMk.', 'kmMMmk', '.kMMk.', '..kMk.', '..kMk.', '..kMk.', '..kkk.'],
  ['......', '......', '....kk', '..kkmM', 'kkmMMm', 'kMMMk.', '.kMk..', '.kkk..'],
];

// -------------------------------------------------------- móveis da oficina

const FORNALHA = [
  '..kkkkkkkkkkkkkkkk..',
  '..kMMMMMMMMMMMMMMk..',
  '..kMmmmmmmmmmmmmMk..',
  '..kkkkkkkkkkkkkkkk..',
  '....kMk........kMk..',
  '.kkkkkkkkkkkkkkkkkk.',
  'kpSppPpSppPpSppPpSpk',
  'kppSpkkkkkkkkkkpPpSk',
  'kpSppkxfFfxfFxkpSppk',
  'kppSpkxFFwFFFxkppSpk',
  'kpSppkxfFFFFfxkpSppk',
  'kppSpkxxfffffxkppSpk',
  'kpSppkkkkkkkkkkpSppk',
  'kppSppPpSppPpSppPpSk',
  'kkkkkkkkkkkkkkkkkkkk',
];

const BIGORNA = [
  '.kkkkkkkkk.',
  'kmMMMMMMMmk',
  'kMMMMMMMMMk',
  '.kMmmmmmMk.',
  '..kkkmMkkk.',
  '....kmMk...',
  '...kmMMmk..',
  '...kMMMMk..',
  '...kkkkkk..',
];

const BANCADA_OFICINA = [
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttttttk',
  'kttmmkttokkotttmmmttttttk',
  'kDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  '.kDDk................kDk',
  '.kDDk................kDk',
  '.kkkk................kkk',
];

const SUPORTE_FERRAMENTAS = [
  'kkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDk',
  'kTTTTTTTTTTTTTTTTTTk',
  'kDDDDDDDDDDDDDDDDDDk',
  '.kmk...kmmk....kmk..',
  '.kmk...kmmk....kmk..',
  'kmMmk.kmMMmk..kmMmk.',
  '.ktk...kttk....ktk..',
  '.ktk...kttk....ktk..',
  '.kkk...kkkk....kkk..',
];

const CAIXA_PECAS = [
  'kkkkkkkkkkkkkkkk',
  'kTttttttttttttTk',
  'ktmMktoOktaAkttk',
  'ktmMktoOktaAkttk',
  'kDDDDDDDDDDDDDDk',
  'ktoOktmMktmMkttk',
  'ktoOktmMktmMkttk',
  'kTttttttttttttTk',
  'kkkkkkkkkkkkkkkk',
];

/**
 * Bruna, a ferreira: lenço na cabeça, avental de couro e martelo.
 * Proporção baixa e larga, igual à do jogador.
 */
const FERREIRA = [
  [
    '....kkkkkk....',
    '..kkrrrrrrkk..',
    '.krrrrrrrrrrk.',
    '.kreeeeeeeerk.',
    '.kekeeeeeekek.',
    '.keeeeeeeeeek.',
    '..kkeeEEeekk..',
    '..kbbbbbbbbk..',
    '.kbTTTTTTTTbk.',
    'kebTTTTTTTTbek',
    '.kbTTTTTTTTbk.',
    '..kbbbbbbbbk..',
    '..knnnknnnnk..',
    '..kNNnkNNnnk..',
    '..kkkk.kkkk...',
  ],
  [
    '....kkkkkk..mk',
    '..kkrrrrrrkkMk',
    '.krrrrrrrrrkkk',
    '.kreeeeeeeerk.',
    '.kekeeeeeekek.',
    '.keeeeeeeeeek.',
    '..kkeeEEeekk..',
    '..kbbbbbbbbk..',
    '.kebTTTTTTTbk.',
    '.kbTTTTTTTTbek',
    '.kbTTTTTTTTbk.',
    '..kbbbbbbbbk..',
    '..knnnnknnnk..',
    '..kNNnnkNNnk..',
    '...kkkk.kkkk..',
  ],
];

/** Nilo, o marceneiro: boné, barba grisalha e suspensórios. */
const MARCENEIRO = [
  [
    '...kkkkkkkk...',
    '..kzzzzzzzzk..',
    '.kzZzzzzzzZzk.',
    '..kkeeeeeekk..',
    '..kekeeekeek..',
    '..keeeeeeeek..',
    '..koeeeeeeok..',
    '..kkooooookk..',
    '..kZZZZZZZZk..',
    '.kZZkZZZZkZZk.',
    '.keZkZZZZkZek.',
    '..kZZZZZZZZk..',
    '..kbbbkbbbbk..',
    '..kDDbkDDbbk..',
    '..kkkk.kkkk...',
  ],
  [
    '...kkkkkkkk...',
    '..kzzzzzzzzk..',
    '.kzZzzzzzzZzk.',
    '..kkeeeeeekk..',
    '..keeeeeeeek..',
    '..keeeeeeeek..',
    '..koeeeeeeok..',
    '..kkooooookk..',
    '..kZZZZZZZZk..',
    '.keZkZZZZkZZk.',
    '.kkZkZZZZkZek.',
    '..kZZZZZZZZk..',
    '..kbbbbkbbbk..',
    '..kDDbbkDDbk..',
    '...kkkk.kkkk..',
  ],
];

const BALAO = [
  '.kkkkkkkkk.',
  'koooooooook',
  'koOkoOkoOok',
  'koooooooook',
  '.kkkkkkkkk.',
  '..kkk......',
  '...k.......',
];

export interface ArteCabana {
  exterior: Sprite;
  brilhoForja: Sprite;
  maquinaVenda: Sprite;
  alavanca: Sprite[];
  fornalha: Sprite;
  bigorna: Sprite;
  bancadaOficina: Sprite;
  suporteFerramentas: Sprite;
  caixaPecas: Sprite;
  ferreira: Sprite[];
  marceneiro: Sprite[];
  balao: Sprite;
}

export function criarCabana(): ArteCabana {
  return {
    exterior: desenharCabana(),
    brilhoForja: desenharBrilhoForja(),
    maquinaVenda: pintar(MAQUINA_VENDA, PAL),
    alavanca: ALAVANCA.map((a) => pintar(a, PAL)),
    fornalha: pintar(FORNALHA, PAL),
    bigorna: pintar(BIGORNA, PAL),
    bancadaOficina: pintar(BANCADA_OFICINA, PAL),
    suporteFerramentas: pintar(SUPORTE_FERRAMENTAS, PAL),
    caixaPecas: pintar(CAIXA_PECAS, PAL),
    ferreira: FERREIRA.map((f) => pintar(f, PAL)),
    marceneiro: MARCENEIRO.map((f) => pintar(f, PAL)),
    balao: pintar(BALAO, PAL),
  };
}
