/**
 * Arte da interface: corações, barra de itens, cursor, ícones e painéis.
 * Tudo em pixel art original, no mesmo estilo do resto do jogo.
 */

import { Pincel, pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  C: P.coracao,
  c: P.coracaoLuz,
  v: P.coracaoVazio,
  w: P.brilho,
  o: P.osso,
  O: P.ossoEscuro,
  a: P.ambar,
  A: P.ambarEscuro,
  m: P.metal,
  M: P.metalEscuro,
  t: P.madeira,
  T: P.madeiraClara,
  D: P.madeiraEscura,
  f: P.fome,
  g: P.folha,
  p: P.pele,
  s: P.pedra,
  x: P.magia,
  X: P.magiaClara,
};

const CORACAO_CHEIO = [
  '.kk.kk..',
  'kCckCCk.',
  'kcwCCCCk',
  'kCCCCCCk',
  '.kCCCCk.',
  '..kCCk..',
  '...kk...',
];

const CORACAO_MEIO = [
  '.kk.kk..',
  'kCckvvk.',
  'kcwCkvvk',
  'kCCCkvvk',
  '.kCCkvk.',
  '..kCvk..',
  '...kk...',
];

const CORACAO_VAZIO = [
  '.kk.kk..',
  'kvvkvvk.',
  'kvvvvvvk',
  'kvvvvvvk',
  '.kvvvvk.',
  '..kvvk..',
  '...kk...',
];

const ICONE_FOME = [
  '....kkk.',
  '...kfffk',
  '...kfffk',
  '..kfffk.',
  '.kffk...',
  'kook....',
  'kok.....',
  'kk......',
];

const ICONE_DIARIO = [
  'kkkkkkkk',
  'kttttttk',
  'ktoooootk',
  'ktoOOOotk',
  'ktoooootk',
  'ktoOOOotk',
  'kttttttk',
  'kkkkkkkk',
];

const ICONE_LANCA = [
  '......ks',
  '.....kss',
  '....ksk.',
  '...kDk..',
  '..kDk...',
  '.kDk....',
  'kDk.....',
  'kk......',
];

const CURSOR = [
  'ko.......',
  'koo......',
  'kooo.....',
  'koooo....',
  'kooooo...',
  'koooooo..',
  'kooookkk.',
  'kookoo...',
  'kok.koo..',
  'kk...kok.',
  '......kk.',
];

const CURSOR_PRONTO = [
  'ka.......',
  'kaw......',
  'kaww.....',
  'kawww....',
  'kawwww...',
  'kawwwww..',
  'kawwwkkk.',
  'kawwkaa..',
  'kak.kaw..',
  'kk...kak.',
  '......kk.',
];

/** Moldura de item da barra inferior (10 espaços, estilo original). */
function slot(selecionado: boolean): Sprite {
  const p = new Pincel(20, 20);
  p.retangulo(0, 0, 20, 20, P.painel);
  p.retangulo(2, 2, 16, 16, '#1c1727');
  p.contorno(0, 0, 20, 20, P.contorno);
  const borda = selecionado ? P.ambar : P.ossoEscuro;
  p.contorno(1, 1, 18, 18, borda);
  // cantos em osso, como rebites
  for (const [x, y] of [
    [1, 1],
    [18, 1],
    [1, 18],
    [18, 18],
  ]) {
    p.ponto(x, y, selecionado ? P.brilho : P.osso);
  }
  // brilho interno
  p.linha(3, 3, 16, 3, selecionado ? '#3a3050' : '#241f33');
  p.linha(3, 3, 3, 16, selecionado ? '#3a3050' : '#241f33');
  return p.finalizar();
}

/** Painel de diálogo/menu com moldura de madeira e osso. */
export function desenharPainel(w: number, h: number): Sprite {
  const p = new Pincel(w, h);
  p.retangulo(0, 0, w, h, P.painel);
  p.retangulo(2, 2, w - 4, h - 4, '#1d1828');
  p.contorno(0, 0, w, h, P.contorno);
  p.contorno(1, 1, w - 2, h - 2, P.ossoEscuro);
  p.contorno(3, 3, w - 6, h - 6, '#332a44');
  // rebites nos cantos
  for (const [x, y] of [
    [3, 3],
    [w - 4, 3],
    [3, h - 4],
    [w - 4, h - 4],
  ]) {
    p.ponto(x, y, P.osso);
    p.ponto(x, y + 1, P.ossoEscuro);
  }
  return p.finalizar();
}

/** Botão da interface, em dois estados. */
export function desenharBotao(w: number, h: number, aceso: boolean): Sprite {
  const p = new Pincel(w, h);
  p.retangulo(0, 0, w, h, aceso ? P.madeiraClara : P.madeira);
  p.retangulo(1, 1, w - 2, h - 2, aceso ? '#b98a52' : '#7c5730');
  p.linha(1, 1, w - 2, 1, aceso ? P.ambar : P.madeiraClara);
  p.linha(1, h - 2, w - 2, h - 2, P.madeiraEscura);
  p.contorno(0, 0, w, h, P.contorno);
  if (aceso) {
    p.ponto(2, 2, P.brilho);
    p.ponto(w - 3, h - 3, P.ambarEscuro);
  }
  return p.finalizar();
}

/** Barra de vida flutuante dos dinossauros. */
export function desenharBarraVida(w: number): { moldura: Sprite; largura: number } {
  const p = new Pincel(w, 5);
  p.retangulo(0, 0, w, 5, P.contorno);
  p.retangulo(1, 1, w - 2, 3, '#3a2b33');
  return { moldura: p.finalizar(), largura: w - 2 };
}

/** Vinheta escura nas bordas da tela (atmosfera). */
export function desenharVinheta(w: number, h: number): Sprite {
  const p = new Pincel(w, h);
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.hypot(cx, cy);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxD;
      const t = Math.max(0, d - 0.62) / 0.38;
      if (t > 0) p.ponto(x, y, '#0a0812', Math.min(0.55, t * t * 0.6));
    }
  }
  return p.finalizar();
}

export interface ArteUI {
  coracaoCheio: Sprite;
  coracaoMeio: Sprite;
  coracaoVazio: Sprite;
  iconeFome: Sprite;
  iconeDiario: Sprite;
  iconeLanca: Sprite;
  cursor: Sprite;
  cursorPronto: Sprite;
  slot: Sprite;
  slotSelecionado: Sprite;
}

export function criarUI(): ArteUI {
  return {
    coracaoCheio: pintar(CORACAO_CHEIO, PAL),
    coracaoMeio: pintar(CORACAO_MEIO, PAL),
    coracaoVazio: pintar(CORACAO_VAZIO, PAL),
    iconeFome: pintar(ICONE_FOME, PAL),
    iconeDiario: pintar(ICONE_DIARIO, PAL),
    iconeLanca: pintar(ICONE_LANCA, PAL),
    cursor: pintar(CURSOR, PAL),
    cursorPronto: pintar(CURSOR_PRONTO, PAL),
    slot: slot(false),
    slotSelecionado: slot(true),
  };
}
