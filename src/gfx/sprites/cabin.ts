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

export const CABANA_W = 106;
export const CABANA_H = 92;
/** Colisão do corpo da cabana, relativa ao canto superior esquerdo. */
export const CABANA_COLISAO = { x: 6, y: 46, w: 94, h: 40 };
/** Porta dupla (área de interação). */
export const CABANA_PORTA = { x: 40, y: 66, w: 26, h: 20 };

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

  // ---- chaminé larga da forja
  const chX = 62;
  const chW = 18;
  p.retangulo(chX, 4, chW, 24, P.pedra);
  for (let y = 4; y < 28; y += 3) {
    p.linha(chX, y, chX + chW - 1, y, P.pedraEscura);
    for (let x = chX + (((y / 3) | 0) % 2 ? 3 : 8); x < chX + chW; x += 8) {
      p.linha(x, y, x, Math.min(27, y + 2), P.pedraEscura);
    }
  }
  for (let x = chX; x < chX + chW; x++) if (rng.chance(0.12)) p.ponto(x, 4 + rng.int(1, 22), P.pedraClara);
  p.retangulo(chX - 3, 0, chW + 6, 5, P.pedraEscura);
  p.retangulo(chX - 3, 1, chW + 6, 2, P.pedra);
  p.contorno(chX - 3, 0, chW + 6, 5, P.contorno);
  p.linha(chX, 5, chX, 28, P.contorno);
  p.linha(chX + chW - 1, 5, chX + chW - 1, 28, P.contorno);
  // brasa vista de cima da chaminé
  p.retangulo(chX + 4, 1, chW - 8, 1, P.fogo);

  // ---- telhado de tábuas com musgo
  const yTopo = 12;
  const yBase = 45;
  for (let y = yTopo; y <= yBase; y++) {
    const t = (y - yTopo) / (yBase - yTopo);
    const xe = Math.round(38 - t * 36);
    const xd = Math.round(68 + t * 36);
    for (let x = xe; x <= xd; x++) {
      const cor = x < (xe + xd) / 2 ? P.madeira : '#5f4023';
      p.ponto(x, y, cor);
    }
    // tábuas longas: emenda escura a cada 5 linhas
    if ((y - yTopo) % 5 === 4) for (let x = xe; x <= xd; x++) p.ponto(x, y, P.madeiraEscura);
    // musgo nas beiradas
    if (rng.chance(0.5)) {
      const mx = rng.int(xe + 2, xd - 2);
      p.ponto(mx, y, rng.chance(0.5) ? P.folha : P.folhaEscura);
      p.ponto(mx + 1, y, P.folhaEscura);
    }
    p.ponto(xe, y, P.contorno);
    p.ponto(xd, y, P.contorno);
  }
  p.linha(38, yTopo, 68, yTopo, P.madeiraClara);
  p.linha(38, yTopo - 1, 68, yTopo - 1, P.contorno);
  p.retangulo(0, yBase, CABANA_W, 3, P.madeiraEscura);
  p.linha(0, yBase, CABANA_W - 1, yBase, '#33200f');
  p.linha(0, yBase + 2, CABANA_W - 1, yBase + 2, P.contorno);

  // ---- paredes de troncos empilhados
  const px0 = 6;
  const px1 = 99;
  const py0 = 48;
  const py1 = 80;
  for (let y = py0; y <= py1; y++) {
    const dentroDoTronco = (y - py0) % 6;
    for (let x = px0; x <= px1; x++) {
      let cor: string = P.madeira;
      if (dentroDoTronco === 0) cor = P.madeiraEscura;
      else if (dentroDoTronco === 1) cor = P.madeiraClara;
      else if (dentroDoTronco === 5) cor = '#5f4023';
      p.ponto(x, y, cor);
      if (rng.chance(0.04)) p.ponto(x, y, '#7c5730');
    }
  }
  // pontas dos troncos nas quinas
  for (let y = py0; y <= py1; y += 6) {
    p.disco(px0 + 2, y + 3, 2, P.madeiraClara);
    p.ponto(px0 + 2, y + 3, '#5f4023');
    p.disco(px1 - 2, y + 3, 2, P.madeiraClara);
    p.ponto(px1 - 2, y + 3, '#5f4023');
  }
  p.linha(px0, py0, px0, py1, P.contorno);
  p.linha(px1, py0, px1, py1, P.contorno);

  // ---- alicerce de pedra
  const fy0 = 79;
  const fy1 = 88;
  p.retangulo(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.pedra);
  for (let fila = 0; fila < 3; fila++) {
    const y = fy0 + fila * 3;
    p.linha(px0 - 1, y, px1 + 1, y, P.pedraEscura);
    for (let x = px0 + (fila % 2 ? 5 : 10); x < px1; x += 11) {
      p.linha(x, y, x, Math.min(fy1, y + 2), P.pedraEscura);
    }
    for (let x = px0; x <= px1; x++) if (rng.chance(0.07)) p.ponto(x, y + 1, P.pedraClara);
  }
  p.contorno(px0 - 1, fy0, px1 - px0 + 3, fy1 - fy0 + 1, P.contorno);

  // ---- janela com veneziana
  const jx = 14;
  const jy = 56;
  p.retangulo(jx - 1, jy - 1, 20, 16, P.madeiraEscura);
  p.contorno(jx - 1, jy - 1, 20, 16, P.contorno);
  p.retangulo(jx + 1, jy + 1, 16, 12, P.vidro);
  for (let i = 0; i < 9; i++) {
    p.ponto(jx + 2 + i, jy + 10 - i, P.vidroLuz);
    p.ponto(jx + 3 + i, jy + 10 - i, P.vidroLuz);
  }
  // luz alaranjada da forja atravessando o vidro
  p.retangulo(jx + 9, jy + 4, 7, 8, '#e0a24a');
  p.linha(jx + 9, jy + 1, jx + 9, jy + 12, P.madeiraEscura);
  p.linha(jx + 1, jy + 6, jx + 17, jy + 6, P.madeiraEscura);
  p.retangulo(jx - 5, jy - 1, 4, 16, P.madeira);
  p.contorno(jx - 5, jy - 1, 4, 16, P.contorno);
  p.retangulo(jx + 18, jy - 1, 4, 16, P.madeira);
  p.contorno(jx + 18, jy - 1, 4, 16, P.contorno);

  // ---- porta dupla com toldo
  const dx = 40;
  const dy = 62;
  const dw = 26;
  const dh = 26;
  // toldo
  p.retangulo(dx - 6, dy - 5, dw + 12, 4, P.madeiraClara);
  p.linha(dx - 6, dy - 2, dx + dw + 5, dy - 2, P.madeiraEscura);
  p.contorno(dx - 6, dy - 5, dw + 12, 4, P.contorno);
  p.linha(dx - 4, dy - 1, dx - 4, dy + 3, P.madeiraEscura);
  p.linha(dx + dw + 3, dy - 1, dx + dw + 3, dy + 3, P.madeiraEscura);
  // batentes e folhas
  p.retangulo(dx, dy, dw, dh, P.madeiraEscura);
  p.retangulo(dx + 2, dy + 2, dw / 2 - 2, dh - 2, P.madeiraClara);
  p.retangulo(dx + dw / 2 + 1, dy + 2, dw / 2 - 3, dh - 2, P.madeiraClara);
  for (let x = dx + 2; x < dx + dw - 2; x += 3) p.linha(x, dy + 2, x, dy + dh - 1, '#8d6437');
  p.linha(dx + dw / 2, dy + 1, dx + dw / 2, dy + dh - 1, P.madeiraEscura);
  p.retangulo(dx + dw / 2 - 3, dy + 12, 2, 3, P.metal);
  p.retangulo(dx + dw / 2 + 2, dy + 12, 2, 3, P.metal);
  p.retangulo(dx + 3, dy + 6, 2, 2, P.metalEscuro);
  p.retangulo(dx + 3, dy + 18, 2, 2, P.metalEscuro);
  p.retangulo(dx + dw - 5, dy + 6, 2, 2, P.metalEscuro);
  p.retangulo(dx + dw - 5, dy + 18, 2, 2, P.metalEscuro);
  p.contorno(dx, dy, dw, dh, P.contorno);
  p.retangulo(dx - 3, dy + dh - 1, dw + 6, 3, P.pedra);
  p.contorno(dx - 3, dy + dh - 1, dw + 6, 3, P.contorno);

  // ---- ferramentas penduradas na parede, à direita da porta
  const fx = 74;
  const fy = 56;
  p.linha(fx - 2, fy - 1, fx + 20, fy - 1, P.madeiraEscura);
  // martelo
  p.retangulo(fx, fy, 2, 9, P.madeira);
  p.retangulo(fx - 2, fy, 6, 3, P.metalEscuro);
  p.ponto(fx - 1, fy + 1, P.metal);
  // serra
  p.retangulo(fx + 8, fy, 2, 8, P.madeira);
  p.retangulo(fx + 6, fy + 7, 8, 2, P.metal);
  for (let i = 0; i < 8; i += 2) p.ponto(fx + 6 + i, fy + 9, P.metalEscuro);
  // ferradura
  p.anel(fx + 17, fy + 5, 4, P.metalEscuro, 2);
  p.retangulo(fx + 15, fy + 8, 5, 2, '#00000000');

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
  '..kkkkkkkkkkkkkkkkkk..',
  '.kMMMMMMMMMMMMMMMMMMk.',
  'kMmmmmmmmmmmmmmmmmmmMk',
  'kMmkkkkkkkkkkkkkkkkmMk',
  'kMmkxxxxxxxxxxxxxxkmMk',
  'kMmkxaaxxaaxxaaxxxkmMk',
  'kMmkxaaxxaaxxaaxxxkmMk',
  'kMmkxxxxxxxxxxxxxxkmMk',
  'kMmkkkkkkkkkkkkkkkkmMk',
  'kMmmmmmmmmmmmmmmmmmmMk',
  'kMkkkkkkkkkkkkkkkkkkMk',
  'kMkTtttttttttttttttkMk',
  'kMkTtDDDDDDDDDDDDttkMk',
  'kMkTtDvvvvvvvvvvDttkMk',
  'kMkTtDvVaaaaaaVvDttkMk',
  'kMkTtDvvaaaaaavvDttkMk',
  'kMkTtDvvvvvvvvvvDttkMk',
  'kMkTtDDDDDDDDDDDDttkMk',
  'kMkTttttttttttttttkkMk',
  'kMkTtkkkkkkkkkkkttkMkk',
  'kMkTtkxxxxxxxxxkttkMmk',
  'kMkTtkxaAaAaAaxkttkMmk',
  'kMkTtkxxxxxxxxxkttkMmk',
  'kMkTttttttttttttttkMkk',
  'kMmmmmmmmmmmmmmmmmmMk.',
  'kMMMMMMMMMMMMMMMMMMMk.',
  'kkkkkkkkkkkkkkkkkkkkk.',
  '.kMMk..........kMMk...',
  '.kmmk..........kmmk...',
  '.kkkk..........kkkk...',
];

/** A alavanca em duas posições, para animar a venda. */
const ALAVANCA = [
  ['..kk..', '.kmMk.', 'kmMMmk', '.kMMk.', '..kMk.', '..kMk.', '..kMk.', '..kkk.'],
  ['......', '......', '....kk', '..kkmM', 'kkmMMm', 'kMMMk.', '.kMk..', '.kkk..'],
];

// -------------------------------------------------------- móveis da oficina

const FORNALHA = [
  '....kkkkkkkkkkkkkkkkkkkkkkkk....',
  '...kMMMMMMMMMMMMMMMMMMMMMMMMk...',
  '...kMmmmmmmmmmmmmmmmmmmmmmmMk...',
  '...kkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '.....kMMk............kMMk.......',
  '.....kMMk............kMMk.......',
  '..kkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
  '.kpSppPpSppPpSppPpSppPpSppPpSpk.',
  'kppSppPpSppPpSppPpSppPpSppPpSppk',
  'kpSppPpkkkkkkkkkkkkkkkkkPpSppPpk',
  'kppSppPkxxxxxxxxxxxxxxxkpPpSppPk',
  'kpSppPpkxfFfxxfFFfxxfFxkppSppPpk',
  'kppSppPkxFFwFFfFFwFFFFxkpSppPpSk',
  'kpSppPpkxfFFFFFFFFFFFfxkppSppPpk',
  'kppSppPkxxfffffffffffxxkpSppPpSk',
  'kpSppPpkkkkkkkkkkkkkkkkkPpSppPpk',
  'kppSppPpSppPpSppPpSppPpSppPpSppk',
  'kpSppPpSppPpSppPpSppPpSppPpSppPk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

const BIGORNA = [
  '..kkkkkkkkkkkk..',
  '.kmMMMMMMMMMMmk.',
  'kmMMMMMMMMMMMMmk',
  '.kMMmmmmmmmmMMk.',
  '..kkkkmMMmkkkk..',
  '.....kmMMmk.....',
  '.....kmMMmk.....',
  '....kmMMMMmk....',
  '...kmMMMMMMmk...',
  '...kMMMMMMMMk...',
  '...kkkkkkkkkk...',
];

const BANCADA_OFICINA = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttttttttttttttttk',
  'kttmmkttttokkotttttmmmkttttttttttk',
  'kttmMkttttoookttttmMMMkttttttttttk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '.kDDk........................kDDk.',
  '.kDDk........................kDDk.',
  '.kDDk........................kDDk.',
  '.kkkk........................kkkk.',
];

const SUPORTE_FERRAMENTAS = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kTTTTTTTTTTTTTTTTTTTTTTTTTTTTk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  '..kmk....kmmk....kmk....kmmk..',
  '..kmk....kmmk....kmk....kmmk..',
  '.kmMmk..kmMMmk..kmMmk..kmMMmk.',
  '.kmMmk..kmMMmk..kmMmk..kmMMmk.',
  '..ktk....kttk....ktk....kttk..',
  '..ktk....kttk....ktk....kttk..',
  '..ktk....kttk....ktk....kttk..',
  '..kkk....kkkk....kkk....kkkk..',
];

const CAIXA_PECAS = [
  'kkkkkkkkkkkkkkkkkkkkkk',
  'kTttttttttttttttttttTk',
  'ktmMkttoOkttaAkttmMttk',
  'ktmMkttoOkttaAkttmMttk',
  'kDDDDDDDDDDDDDDDDDDDDk',
  'ktoOkttmMkttmMkttaAttk',
  'ktoOkttmMkttmMkttaAttk',
  'kTttttttttttttttttttTk',
  'kkkkkkkkkkkkkkkkkkkkkk',
];

// -------------------------------------------------------------------- NPCs

/** Bruna, a ferreira: avental de couro, lenço na cabeça, martelo na mão. */
const FERREIRA = [
  [
    '....kkkkkk....',
    '...krrrrrrk...',
    '..krrrrrrrrk..',
    '..kreeeeeerk..',
    '..kekeeekeek..',
    '..keeeeeeeek..',
    '..kkeeEEeekk..',
    '..kbbbbbbbbk..',
    '.kbbTTTTTTbbk.',
    '.kbTTTTTTTTbk.',
    '.kebTTTTTTbek.',
    '.kkbTTTTTTbkk.',
    '..kbbbbbbbbk..',
    '..knnnknnnnk..',
    '..knnnknnnnk..',
    '..kNNnkNNnnk..',
    '..kkkkkkkkkk..',
  ],
  [
    '....kkkkkk..mk',
    '...krrrrrrkkMk',
    '..krrrrrrrrkkk',
    '..kreeeeeerk..',
    '..kekeeekeek..',
    '..keeeeeeeek..',
    '..kkeeEEeekk..',
    '..kbbbbbbbbk..',
    '.kbbTTTTTTbek.',
    '.kbTTTTTTTTbk.',
    '.kebTTTTTTbbk.',
    '.kkbTTTTTTbkk.',
    '..kbbbbbbbbk..',
    '..knnnnknnnk..',
    '..knnnnknnnk..',
    '..kNNnnkNNnk..',
    '..kkkkkkkkkk..',
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
    '.kkZkZZZZkZkk.',
    '..kZZZZZZZZk..',
    '..kbbbkbbbbk..',
    '..kbbbkbbbbk..',
    '..kDDbkDDbbk..',
    '..kkkkkkkkkk..',
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
    '.kZZkZZZZkZkk.',
    '..kZZZZZZZZk..',
    '..kbbbbkbbbk..',
    '..kbbbbkbbbk..',
    '..kDDbbkDDbk..',
    '..kkkkkkkkkk..',
  ],
];

/** Balão de fala com "..." — aviso de que dá para conversar. */
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
