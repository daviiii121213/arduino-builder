/**
 * Armaduras: camadas desenhadas por cima do corpo do jogador.
 *
 * Cada conjunto é um capacete + peitoral por vista (frente, costas e lado),
 * do mesmo tamanho do sprite do corpo, com o rosto e as pernas transparentes.
 * Para acrescentar um conjunto novo basta uma paleta e — se quiser um recorte
 * diferente — um novo mapa de caracteres.
 */

import { pintar, espelharH, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

export type ArmaduraId = 'couro' | 'osso' | 'cristal';

/** Recorte comum: capacete cobre o cabelo, peitoral cobre o tronco. */
const FRENTE = [
  '.....kkkkkkkk.....',
  '...kkaaaaaaaakk...',
  '..kaabbbbbbbbaak..',
  '..kaaaaaaaaaaaak..',
  '..ka..........ak..',
  '..................',
  '..................',
  '...kkddddddddkk...',
  '..kaaaaaaaaaaaak..',
  '..kabbbbddbbbbak..',
  '..kaaaaaaaaaaaak..',
  '..................',
];

const COSTAS = [
  '.....kkkkkkkk.....',
  '...kkaaaaaaaakk...',
  '..kaabbbbbbbbaak..',
  '..kaaaaaaaaaaaak..',
  '..kaaaaaaaaaaaak..',
  '...ka........ak...',
  '..................',
  '...kkddddddddkk...',
  '..kaaaaaaaaaaaak..',
  '..kabbbbbbbbbbak..',
  '..kaaaaaaaaaaaak..',
  '..................',
];

const LADO = [
  '....kkkkkkkk......',
  '..kkaaaaaaaakk....',
  '.kaabbbbbbaakk....',
  '.kaaaaaaaaak......',
  '.ka........k......',
  '..................',
  '..................',
  '...kkdddddddk.....',
  '..kaaaaaaaaak.....',
  '..kabbbbbbbak.....',
  '..kaaaaaaaaak.....',
  '..................',
];

/** Capacetes com detalhe próprio de cada conjunto (chifres, cristas). */
const EXTRA_FRENTE: Record<ArmaduraId, string[]> = {
  couro: [],
  osso: [
    '..kd..........dk..',
    '.kdd..........ddk.',
    '..dk..........kd..',
  ],
  cristal: [
    '........kddk......',
    '.......kdddk......',
    '........kdk.......',
  ],
};

const PALETAS: Record<ArmaduraId, Paleta> = {
  couro: {
    '.': null,
    k: P.contorno,
    a: '#8a5a32',
    b: '#a97a4a',
    d: '#c9a05a',
    p: P.pele,
  },
  osso: {
    '.': null,
    k: P.contorno,
    a: '#cfc29e',
    b: '#eadfbf',
    d: '#a89a78',
    p: P.pele,
  },
  cristal: {
    '.': null,
    k: P.contorno,
    a: '#4a90ad',
    b: '#8fd0e2',
    d: '#cfeff8',
    p: P.pele,
  },
};

/** Ícone da armadura para a loja e o inventário. */
const ICONE = [
  '..kkkkkkkk..',
  '.kaabbbbaak.',
  'kaabbbbbbaak',
  'kabbbddbbbak',
  'kabbbddbbbak',
  'kaabbbbbbaak',
  'kaaabbbbaaak',
  '.kaaaaaaaak.',
  '.kaakkkkaak.',
  '..kk....kk..',
];

export interface ArteArmadura {
  baixo: Sprite;
  cima: Sprite;
  direita: Sprite;
  esquerda: Sprite;
  icone: Sprite;
}

function comExtra(base: readonly string[], extra: readonly string[]): string[] {
  if (extra.length === 0) return [...base];
  // o detalhe do capacete entra nas três primeiras linhas, sem apagar o resto
  const saida = [...base];
  for (let i = 0; i < extra.length; i++) {
    const linha = saida[i] ?? '';
    let nova = '';
    for (let x = 0; x < Math.max(linha.length, extra[i].length); x++) {
      const e = extra[i][x] ?? '.';
      const b = linha[x] ?? '.';
      nova += e !== '.' ? e : b;
    }
    saida[i] = nova;
  }
  return saida;
}

export function criarArmaduras(): Record<ArmaduraId, ArteArmadura> {
  const saida = {} as Record<ArmaduraId, ArteArmadura>;
  for (const id of Object.keys(PALETAS) as ArmaduraId[]) {
    const pal = PALETAS[id];
    const direita = pintar(LADO, pal);
    saida[id] = {
      baixo: pintar(comExtra(FRENTE, EXTRA_FRENTE[id]), pal),
      cima: pintar(comExtra(COSTAS, EXTRA_FRENTE[id]), pal),
      direita,
      esquerda: espelharH(direita),
      icone: pintar(ICONE, pal),
    };
  }
  return saida;
}
