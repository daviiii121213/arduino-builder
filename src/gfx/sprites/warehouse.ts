/**
 * Arte do galpão do avô e da máquina do tempo (usada na cinemática de
 * abertura). Também desenhada inteiramente à mão.
 */

import { pintar, Pincel, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';
import { Rng } from '../../core/rng';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  C: '#cfc4a8',
  c: '#a89b7f',
  s: '#8b8069',
  m: P.metalEscuro,
  ' ': null,
  M: P.metal,
  L: '#c2c8d4',
  v: P.vidro,
  V: P.vidroLuz,
  x: P.magia,
  X: P.magiaClara,
  r: P.raio,
  d: P.ossoEscuro,
  D: '#4a4f5a',
  t: P.madeira,
  T: P.madeiraClara,
  E: P.madeiraEscura,
  a: P.ambar,
  A: P.ambarEscuro,
  w: P.brilho,
  o: P.osso,
  g: '#6b7280',
  f: P.fogo,
  p: '#5a5a68',
};

/** Repete (ou alterna) linhas — encurta as peças altas. */
function repetir(padrao: string[], vezes: number): string[] {
  return Array.from({ length: vezes }, (_, i) => padrao[i % padrao.length]);
}

/** A máquina coberta pelo pano — o mistério do começo do jogo. */
const MAQUINA_COBERTA = [
  '............kkkkkkkkkkkk............',
  '.........kkkCCCCCCCCCCCCkkk.........',
  '.......kkCCCCCCCCCCCCCCCCCCkk.......',
  '.....kkCCCCCCCcCCCCCCCCcCCCCCCkk....',
  '...kkCCCCCCCccCCCCCCCCCCccCCCCCCkk..',
  '..kCCCCCCCcCCCCCCCCCCCCCCCcCCCCCCCk.',
  '.kCCCCCCcCCCCCCCCCCCCCCCCCCcCCCCCCk.',
  'kCCCCCCcCCCCCCCCCCCCCCCCCCCCcCCCCCCk',
  'kCCCCCcCCCCCCCCCCCCCCCCCCCCCCcCCCCCk',
  'kCCCCcCCCCCCCCCCCCCCCCCCCCCCCCcCCCCk',
  'kssssssssssssssssssssssssssssssssssk',
  'kCcCCCCCCCCCcCCCCCCCCCCCCcCCCCCCCcCk',
  ...repetir(
    [
      'kCcCCCCCCCCCcCCCCCCCCCCCCcCCCCCCCcCk',
      'kCCCCCCCCCCCcCCCCCCCCCCCCcCCCCCCCCCk',
      'kCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCk',
      'kCcCCCCCCcCCCCCCCCCCCCCCCCCCcCCCCcCk',
    ],
    12,
  ),
  'kssssssssssssssssssssssssssssssssssk',
  'kCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCk',
  'kCcCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCcCk',
  'kccCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCcck',
  'ksssccCCCCCCCCCCCCCCCCCCCCCCCCcssssk',
  '.kkssssscccccccccccccccccccssssskk..',
  '...kkkkssssssssssssssssssssskkkk....',
  '......kkkkkkkkkkkkkkkkkkkkkkkk......',
  '.....kMMk................kMMk.......',
  '.....kmmk................kmmk.......',
  '.....kkkk................kkkk.......',
];

/** A máquina do tempo revelada: cilindro de vidro, anel e painéis. */
const MAQUINA = (() => {
  const vidro = (inner: string, dial = false) =>
    (dial ? 'kDdk ' : '     ') + 'kMMk' + inner + 'kMMk' + (dial ? ' kdDk' : '');
  const nucleo = [
    'vvvvvvvvvvvvvvvvvv',
    'vvvvvvvvvxxvvvvvvv',
    'vvvvvvvvxXXxvvvvvv',
    'vvvvvvvxXXXXxvvvvv',
    'vvvvvvxXXXXXXxvvvv',
    'vvvvvxXXXXrXXxvvvv',
    'vvvvvxXXXXXXXxvvvv',
    'vvvvvvxXXXXXxvvvvv',
    'vvvvvvvxXXXxvvvvvv',
    'vvvvvvvvxXxvvvvvvv',
    'vvvvvvvvvxvvvvvvvv',
    'vvvvvvvvvvvvvvvvvv',
  ];
  return [
    '                kkkk                ',
    '               kmMMmk               ',
    '            kkkmMrrMmkkk            ',
    '           kmMMMMMMMMMMmk           ',
    '            kkkmMMMMmkkk            ',
    '               kmMMmk               ',
    '                kMMk                ',
    '                kMMk                ',
    '        kkkkkkkkkMMkkkkkkkkk        ',
    '      kkmMMMMMMMMMMMMMMMMMMmkk      ',
    '     kmMMMMMMMMMMMMMMMMMMMMMMmk     ',
    '     kMMkkkkkkkkkkkkkkkkkkkkMMk     ',
    vidro('vvvvvvvvvvvvvvvvvv'),
    vidro('vvvvvvvvvvvvvvvvvv'),
    vidro('MMMMMMMMMMMMMMMMMM'),
    ...nucleo.map((l, i) => vidro(l, i >= 3 && i <= 7)),
    vidro('MMMMMMMMMMMMMMMMMM'),
    vidro('vvvvvvvvvvvvvvvvvv'),
    vidro('vvvvvvvvvvvvvvvvvv'),
    '     kMMkkkkkkkkkkkkkkkkkkkkMMk     ',
    '     kmMMMMMMMMMMMMMMMMMMMMMMmk     ',
    '      kmMMMMMMMMMMMMMMMMMMMMmk      ',
    '     kkmmMMMMMMMMMMMMMMMMMMmmkk     ',
    '   kmMMMMMMMMMMMMMMMMMMMMMMMMMMmk   ',
    '   kMMkkkkkkkkkkkkkkkkkkkkkkkkMMk   ',
    '   kMMk......................kMMk   ',
    '   kMMk......................kMMk   ',
    '   kkkk......................kkkk   ',
  ];
})();

const CAIXOTE = [
  'kkkkkkkkkkkkkkkkkk',
  'kTttttttttttttttTk',
  'ktEtttttttttttEttk',
  'kttEttttttttEtttttk',
  'ktttEttttttEttttttk',
  'kttttEttttEtttttttk',
  'kEEEEEEEEEEEEEEEEEk',
  'kttttEttttEtttttttk',
  'ktttEttttttEttttttk',
  'kttEttttttttEttttk',
  'ktEtttttttttttEttk',
  'kTttttttttttttttTk',
  'kkkkkkkkkkkkkkkkkk',
];

const PRATELEIRA = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kEEEEEEEEEEEEEEEEEEEEEEEEEEEEk',
  'kEttoookkAAAkkoookkttookkAAAkk',
  'kEttoookkAAAkkoookkttookkAAAkk',
  'kEEEEEEEEEEEEEEEEEEEEEEEEEEEEk',
  'kEkkAAAkkttookkoookkAAAkkttook',
  'kEkkAAAkkttookkoookkAAAkkttook',
  'kEEEEEEEEEEEEEEEEEEEEEEEEEEEEk',
  'kEttookkoookkAAAkkttookkoookkk',
  'kEttookkoookkAAAkkttookkoookkk',
  'kEEEEEEEEEEEEEEEEEEEEEEEEEEEEk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

const BANCADA = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kTtTtTtTtTtTtTtTtTtTtTtTtTtTtTtTTk',
  'kttttttttttttttttttttttttttttttttk',
  'kEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEk',
  'kEEk..kMMk......kddk........kEEEEk',
  'kEEk..kMMk......kddk........kEEEEk',
  'kEEkkkkkkkkkkkkkkkkkkkkkkkkkkEEEEk',
  'kEEk......................kkkEEEEk',
  'kEEk......................kkkEEEEk',
  'kkkk......................kkkkkkkk',
];

const LAMPADA = [
  '..kk..',
  '..kk..',
  '..kk..',
  '..kk..',
  '.kmmk.',
  'kmMMmk',
  'kaAAak',
  'kwaawk',
  '.kaak.',
  '..kk..',
];

const PORTAO = [
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDk',
  'kggggggggggggggggggggggggggggggggggggggk',
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
];

const TEIA = [
  'kk.........',
  'k.k........',
  'k..k.......',
  'k.k.k......',
  'k..k..k....',
  'k...k...k..',
  'k.k...k...k',
];

const FERRAMENTAS = [
  '.kMk....kMMk....kmk.',
  '.kMk....kMMk....kmk.',
  '.kMk....kMMk...kMMMk',
  'kEEEk...kEEk...kMMMk',
  '.kEk....kEEk....kEk.',
  '.kEk....kEEk....kEk.',
  '.kEk............kEk.',
  '.kkk............kkk.',
];

const PLACA_AVO = [
  'kkkkkkkkkkkkkkkkkkkkkk',
  'kEEEEEEEEEEEEEEEEEEEEk',
  'kEoooooooooooooooooEEk',
  'kEoAAoAoAAoAoAAoAooEEk',
  'kEooooooooooooooooooEk',
  'kEEEEEEEEEEEEEEEEEEEEk',
  'kkkkkkkkkkkkkkkkkkkkkk',
];

/** Parede de concreto do galpão, com manchas e tijolos aparentes. */
function paredeGalpao(w: number, h: number): Sprite {
  const p = new Pincel(w, h);
  const rng = new Rng(8080);
  p.retangulo(0, 0, w, h, '#4b4b58');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rng.chance(0.06)) p.ponto(x, y, '#43434f');
      else if (rng.chance(0.05)) p.ponto(x, y, '#585866');
    }
  }
  for (let y = 6; y < h; y += 7) {
    p.linha(0, y, w - 1, y, '#3c3c47');
    const off = ((y / 7) | 0) % 2 ? 0 : 9;
    for (let x = off; x < w; x += 18) p.linha(x, y - 6, x, y - 1, '#3c3c47');
  }
  // rodapé e manchas de umidade
  p.retangulo(0, h - 5, w, 5, '#3f3f4a');
  p.linha(0, h - 5, w - 1, h - 5, '#33333d');
  for (let i = 0; i < 8; i++) {
    const x = rng.int(0, w - 6);
    const y = rng.int(4, h - 10);
    p.disco(x, y, rng.int(1, 3), '#44444f');
  }
  return p.finalizar();
}

export interface ArteGalpao {
  maquinaCoberta: Sprite;
  maquina: Sprite;
  caixote: Sprite;
  prateleira: Sprite;
  bancada: Sprite;
  lampada: Sprite;
  portao: Sprite;
  teia: Sprite;
  ferramentas: Sprite;
  placaAvo: Sprite;
  parede: Sprite;
}

export function criarGalpao(): ArteGalpao {
  return {
    maquinaCoberta: pintar(MAQUINA_COBERTA, PAL),
    maquina: pintar(MAQUINA, PAL),
    caixote: pintar(CAIXOTE, PAL),
    prateleira: pintar(PRATELEIRA, PAL),
    bancada: pintar(BANCADA, PAL),
    lampada: pintar(LAMPADA, PAL),
    portao: pintar(PORTAO, PAL),
    teia: pintar(TEIA, PAL),
    ferramentas: pintar(FERRAMENTAS, PAL),
    placaAvo: pintar(PLACA_AVO, PAL),
    parede: paredeGalpao(240, 72),
  };
}
