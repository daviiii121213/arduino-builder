/**
 * Fonte de bitmap 5x7 desenhada à mão, pixel por pixel.
 *
 * Os acentos do português são compostos em tempo de execução: a letra base é
 * desenhada e o sinal (agudo, grave, circunflexo, til, trema, cedilha) é
 * sobreposto. Isso mantém a fonte compacta e 100% original.
 */

import { criarCanvas, ctx2d, type Sprite } from './pixel';

export const LARG_GLIFO = 5;
export const ALT_GLIFO = 7;
/** Linhas reservadas acima da letra para os acentos. */
const ALT_ACENTO = 2;
/** Linhas reservadas abaixo para cedilha/descidas. */
const ALT_BAIXO = 2;
const ALT_CELULA = ALT_ACENTO + ALT_GLIFO + ALT_BAIXO; // 11
export const ESPACO_GLIFO = 1;
export const ALTURA_LINHA = 9;

/** Cada glifo: 7 linhas de 5 colunas, separadas por "/". */
const GLIFOS: Record<string, string> = {
  ' ': '...../...../...../...../...../...../.....',
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.####/#..../#..../#..../#..../#..../.####',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#..##/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '#####/..#../..#../..#../..#../..#../#####',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#...#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#...#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  a: '...../...../.###./....#/.####/#...#/.####',
  b: '#..../#..../####./#...#/#...#/#...#/####.',
  c: '...../...../.####/#..../#..../#..../.####',
  d: '....#/....#/.####/#...#/#...#/#...#/.####',
  e: '...../...../.###./#...#/#####/#..../.###.',
  f: '..##./.#.../.#.../####./.#.../.#.../.#...',
  g: '...../.####/#...#/#...#/.####/....#/.###.',
  h: '#..../#..../####./#...#/#...#/#...#/#...#',
  i: '..#../...../..#../..#../..#../..#../..#..',
  j: '...#./...../...#./...#./...#./#..#./.##..',
  k: '#..../#..../#..#./#.#../##.../#.#../#..#.',
  l: '.##../..#../..#../..#../..#../..#../.###.',
  m: '...../...../##.#./#.#.#/#.#.#/#...#/#...#',
  n: '...../...../####./#...#/#...#/#...#/#...#',
  o: '...../...../.###./#...#/#...#/#...#/.###.',
  p: '...../####./#...#/#...#/####./#..../#....',
  q: '...../.####/#...#/#...#/.####/....#/....#',
  r: '...../...../#.##./##.../#..../#..../#....',
  s: '...../...../.####/#..../.###./....#/####.',
  t: '.#.../.#.../####./.#.../.#.../.#.../.###.',
  u: '...../...../#...#/#...#/#...#/#...#/.####',
  v: '...../...../#...#/#...#/#...#/.#.#./..#..',
  w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
  x: '...../...../#...#/.#.#./..#../.#.#./#...#',
  y: '...../#...#/#...#/#...#/.####/....#/.###.',
  z: '...../...../#####/...#./..#../.#.../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  '.': '...../...../...../...../...../...../..#..',
  ',': '...../...../...../...../...../..#../.#...',
  ':': '...../...../..#../...../..#../...../.....',
  ';': '...../...../..#../...../..#../..#../.#...',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  "'": '..#../..#../...../...../...../...../.....',
  '"': '.#.#./.#.#./...../...../...../...../.....',
  '-': '...../...../...../.###./...../...../.....',
  '_': '...../...../...../...../...../...../#####',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '=': '...../...../#####/...../#####/...../.....',
  '*': '...../#.#../.#.../#.#../...../...../.....',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  '\\': '#..../#..../.#.../..#../...#./....#/....#',
  '(': '..##./.#.../.#.../.#.../.#.../.#.../..##.',
  ')': '.##../...#./...#./...#./...#./...#./.##..',
  '[': '..###/..#../..#../..#../..#../..#../..###',
  ']': '###../..#../..#../..#../..#../..#../###..',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  '%': '#...#/...#./..#../..#../.#.../#...#/#...#',
  '#': '.#.#./#####/.#.#./#####/.#.#./...../.....',
  '&': '.##../#..#./.##../#.#.#/#..#./#..#./.##.#',
  '@': '.###./#...#/#.###/#.#.#/#.###/#..../.###.',
  '|': '..#../..#../..#../..#../..#../..#../..#..',
  '~': '...../...../.##.#/#..##/...../...../.....',
  '°': '.##../#..#./.##../...../...../...../.....',
  '…': '...../...../...../...../...../...../#.#.#',
  '—': '...../...../...../#####/...../...../.....',
  '–': '...../...../...../.###./...../...../.....',
  '·': '...../...../...../..#../...../...../.....',
  '∞': '...../...../.#.#./#.#.#/.#.#./...../.....',
  '’': '..#../.#.../...../...../...../...../.....',
  '‘': '..#../..#../...../...../...../...../.....',
  'º': '.##../#..#./.##../...../...../...../.....',
  'ª': '.###./#..#./.###./...../...../...../.....',
  '“': '.#.#./#.#../...../...../...../...../.....',
  '”': '.#.#./..#.#/...../...../...../...../.....',
  '←': '...../..#../.#.../#####/.#.../..#../.....',
  '→': '...../..#../...#./#####/...#./..#../.....',
  '↑': '..#../.###./#.#.#/..#../..#../..#../.....',
  '↓': '...../..#../..#../#.#.#/.###./..#../.....',
};

/** Sinais diacríticos, 5 colunas x 2 linhas (acima) ou 2 linhas (abaixo). */
const ACENTOS: Record<string, string> = {
  agudo: '...#./..#..',
  grave: '.#.../..#..',
  circunflexo: '..#../.#.#.',
  til: '.##.#/#..##',
  trema: '.#.#./.....',
};
const CEDILHA = '..#../.##..';

/** Letra acentuada -> [letra base, sinal]. */
const COMPOSTOS: Record<string, [string, string]> = {
  á: ['a', 'agudo'], à: ['a', 'grave'], â: ['a', 'circunflexo'], ã: ['a', 'til'], ä: ['a', 'trema'],
  é: ['e', 'agudo'], è: ['e', 'grave'], ê: ['e', 'circunflexo'], ë: ['e', 'trema'],
  í: ['i', 'agudo'], ì: ['i', 'grave'], î: ['i', 'circunflexo'], ï: ['i', 'trema'],
  ó: ['o', 'agudo'], ò: ['o', 'grave'], ô: ['o', 'circunflexo'], õ: ['o', 'til'], ö: ['o', 'trema'],
  ú: ['u', 'agudo'], ù: ['u', 'grave'], û: ['u', 'circunflexo'], ü: ['u', 'trema'],
  ñ: ['n', 'til'],
  Á: ['A', 'agudo'], À: ['A', 'grave'], Â: ['A', 'circunflexo'], Ã: ['A', 'til'],
  É: ['E', 'agudo'], Ê: ['E', 'circunflexo'],
  Í: ['I', 'agudo'], Î: ['I', 'circunflexo'],
  Ó: ['O', 'agudo'], Ô: ['O', 'circunflexo'], Õ: ['O', 'til'],
  Ú: ['U', 'agudo'], Û: ['U', 'circunflexo'], Ü: ['U', 'trema'],
  ç: ['c', 'cedilha'], Ç: ['C', 'cedilha'],
};

function linhasDe(txt: string): string[] {
  return txt.split('/');
}

const cacheGlifo = new Map<string, Sprite>();

/** Renderiza (e memoriza) um caractere na cor pedida. */
function glifo(ch: string, cor: string): Sprite | null {
  const chave = ch + '|' + cor;
  const pronto = cacheGlifo.get(chave);
  if (pronto) return pronto;

  let base = ch;
  let sinal: string | null = null;
  const comp = COMPOSTOS[ch];
  if (comp) {
    base = comp[0];
    sinal = comp[1];
  }
  let desenho = GLIFOS[base];
  if (desenho === undefined) {
    // Tenta a versão maiúscula/minúscula antes de desistir.
    desenho = GLIFOS[base.toUpperCase()] ?? GLIFOS[base.toLowerCase()];
  }
  if (desenho === undefined) return null;

  const cv = criarCanvas(LARG_GLIFO, ALT_CELULA);
  const g = ctx2d(cv);
  const img = g.createImageData(LARG_GLIFO, ALT_CELULA);
  const d = img.data;
  const [r, gg, b, a] = corDe(cor);

  const marcar = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= LARG_GLIFO || y >= ALT_CELULA) return;
    const i = (y * LARG_GLIFO + x) * 4;
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    d[i + 3] = a;
  };

  const corpo = linhasDe(desenho);
  for (let y = 0; y < corpo.length; y++) {
    for (let x = 0; x < corpo[y].length; x++) {
      if (corpo[y][x] === '#') marcar(x, ALT_ACENTO + y);
    }
  }

  if (sinal === 'cedilha') {
    const ced = linhasDe(CEDILHA);
    for (let y = 0; y < ced.length; y++)
      for (let x = 0; x < ced[y].length; x++)
        if (ced[y][x] === '#') marcar(x, ALT_ACENTO + ALT_GLIFO + y);
  } else if (sinal) {
    const marca = linhasDe(ACENTOS[sinal]);
    for (let y = 0; y < marca.length; y++)
      for (let x = 0; x < marca[y].length; x++)
        if (marca[y][x] === '#') marcar(x, y);
  }

  g.putImageData(img, 0, 0);
  cacheGlifo.set(chave, cv);
  return cv;
}

function corDe(cor: string): [number, number, number, number] {
  let s = cor.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 6) s += 'ff';
  const n = parseInt(s, 16);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

export interface OpcoesTexto {
  cor?: string;
  /** Cor de contorno/sombra atrás do texto. */
  sombra?: string | null;
  /** 'esquerda' | 'centro' | 'direita' */
  alinhamento?: 'esquerda' | 'centro' | 'direita';
  /** Espaçamento extra entre caracteres. */
  espaco?: number;
  /** Contorno completo (8 direções) em vez de sombra diagonal. */
  contorno?: boolean;
}

export function larguraTexto(txt: string, espaco = ESPACO_GLIFO): number {
  if (txt.length === 0) return 0;
  return txt.length * (LARG_GLIFO + espaco) - espaco;
}

/** Desenha uma linha de texto em pixel art. y é o topo da caixa da letra. */
export function texto(
  g: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  opc: OpcoesTexto = {},
): number {
  const cor = opc.cor ?? '#f2e3c2';
  const espaco = opc.espaco ?? ESPACO_GLIFO;
  const larg = larguraTexto(txt, espaco);
  let px = Math.round(x);
  if (opc.alinhamento === 'centro') px = Math.round(x - larg / 2);
  else if (opc.alinhamento === 'direita') px = Math.round(x - larg);
  const py = Math.round(y) - ALT_ACENTO;

  const desenhar = (dx: number, dy: number, c: string) => {
    let cx = px + dx;
    for (const ch of txt) {
      const s = glifo(ch, c);
      if (s) g.drawImage(s, cx, py + dy);
      cx += LARG_GLIFO + espaco;
    }
  };

  if (opc.sombra) {
    if (opc.contorno) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]])
        desenhar(dx, dy, opc.sombra);
    } else {
      desenhar(1, 1, opc.sombra);
    }
  }
  desenhar(0, 0, cor);
  return larg;
}

/** Quebra o texto em linhas que caibam na largura pedida (em pixels). */
export function quebrarTexto(txt: string, largMax: number, espaco = ESPACO_GLIFO): string[] {
  const palavras = txt.split(/\s+/).filter((p) => p.length > 0);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual.length ? atual + ' ' + p : p;
    if (larguraTexto(tentativa, espaco) <= largMax || atual.length === 0) {
      atual = tentativa;
    } else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual.length) linhas.push(atual);
  return linhas;
}

/** Desenha um parágrafo já quebrado. Devolve a altura ocupada. */
export function paragrafo(
  g: CanvasRenderingContext2D,
  linhas: readonly string[],
  x: number,
  y: number,
  opc: OpcoesTexto = {},
): number {
  linhas.forEach((l, i) => texto(g, l, x, y + i * ALTURA_LINHA, opc));
  return linhas.length * ALTURA_LINHA;
}
