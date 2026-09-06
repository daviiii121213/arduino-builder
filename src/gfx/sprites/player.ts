/**
 * Arte dos quatro protagonistas — 18x16 pixels, todos desenhados à mão.
 *
 * Proporções propositalmente baixas e largas: cabeça grande (quase metade do
 * corpo), ombros largos e pernas curtas. Três vistas (frente, costas, lado) com
 * três quadros de caminhada cada; a vista lateral é espelhada em tempo de
 * execução.
 *
 * O corpo é a camada de baixo: a armadura entra como sobreposição do mesmo
 * tamanho (ver `armor.ts`), então basta desenhar uma camada nova para criar um
 * conjunto novo — e ela serve em qualquer um dos quatro personagens, porque
 * todos têm o mesmo esqueleto e as mesmas colunas de ombro.
 *
 * Um personagem novo é uma entrada em DESENHOS: três vistas de tronco (frente,
 * costas e lado) mais a paleta de cabelo, roupa e detalhe.
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

export type PersonagemId = 'teo' | 'rui' | 'bia' | 'nina';

interface DesenhoPersonagem {
  cores: Record<string, string>;
  frente: string[];
  costas: string[];
  lado: string[];
}

const DESENHOS: Record<PersonagemId, DesenhoPersonagem> = {
  teo: {
    cores: { h: '#4a2f1c', H: '#6b4527', s: '#3f7fd6', S: '#2b5798', c: '#6b4a2b', C: '#4a3119', r: '#c4453f' },
    frente: [
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
    ],
    costas: [
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
    ],
    lado: [
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
    ],
  },
  rui: {
    cores: { h: '#2d2b28', H: '#5a564f', s: '#3f8f52', S: '#2a6238', c: '#4a4a58', C: '#33333f', r: '#8a5a32' },
    frente: [
      '......kHHHHk......',
      '....kkHhhhhHkk....',
      '..kkhhhhhhhhhhkk..',
      '..khhpppppppphhk..',
      '..khppkppppkpphk..',
      '..kpppppppppppppk.',
      '..kkppPPPPPPppkk..',
      '...kkrrrrrrrrkk...',
      '..ksssrrrrrrsssk..',
      '..ksSsrrrrrrsSsk..',
      '.kpsssrrrrrrsssPk.',
      '..kcccccccccccck..',
    ],
    costas: [
      '......kHHHHk......',
      '....kkHhhhhHkk....',
      '..kkhhhhhhhhhhkk..',
      '..khhhhhhhhhhhhk..',
      '..khhhhhhhhhhhhk..',
      '..khhhhhhhhhhhhk..',
      '..kkhhhhhhhhhhkk..',
      '...kkrrrrrrrrkk...',
      '..ksssrrrrrrsssk..',
      '..ksSsrrrrrrsSsk..',
      '.kpsssrrrrrrsssPk.',
      '..kcccccccccccck..',
    ],
    lado: [
      '.....kHHHHkk......',
      '..kkkHhhhhhhk.....',
      '.khhhhhhhhppppk...',
      '.khhhhhhhpkppk....',
      '.khhhhhhppppppk...',
      '..khhhpppppPk.....',
      '..kkhhpppPPPkk....',
      '...kkrrrrrrkk.....',
      '..ksrrrrrrrsk.....',
      '..ksSrrrrrrsk.....',
      '..ksrrrrrrrspk....',
      '..kcccccccccck....',
    ],
  },
  bia: {
    cores: { h: '#231a2e', H: '#3f2f52', s: '#8a5ac4', S: '#5f3a92', c: '#3a3350', C: '#26223a', r: '#f0d060' },
    frente: [
      '....kkkkkkkkkk....',
      '..kkhhhhhhhhhhkk..',
      '.khhhhhhhhhhhhhhk.',
      '.khhhpppppppphhhk.',
      '.khhppkppppkpphhk.',
      '.khhpppppppppphhk.',
      '.khhppPPPPPPpphhk.',
      '.khhkrrrrrrrrkhhk.',
      '.khsssssssssssshk.',
      '.khsSssrrrrssSshk.',
      '.khssssssssssssHk.',
      '..kcccccccccccck..',
    ],
    costas: [
      '....kkkkkkkkkk....',
      '..kkhhhhhhhhhhkk..',
      '.khhhhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhhhk.',
      '.khhHhhhhhhhhHhhk.',
      '.khhhhhhhhhhhhhhk.',
      '..kcccccccccccck..',
    ],
    lado: [
      '...kkkkkkkkk......',
      '.kkhhhhhhhhhkk....',
      'khhhhhhhhhppppk...',
      'khhhhhhhhpkppk....',
      'khhhhhhhppppppk...',
      'khhhhhhpppppPk....',
      'khhhhhpppPPPkk....',
      'khhhkrrrrrrkk.....',
      'khhsssssssssk.....',
      'khhsSsssssssk.....',
      'khhssssssssspk....',
      '.kcccccccccck.....',
    ],
  },
  nina: {
    cores: { h: '#a8441c', H: '#d4713a', s: '#e0803a', S: '#a85220', c: '#3f5a7a', C: '#2a3d54', r: '#f7d148' },
    frente: [
      '...kkHHHHHHHHkk...',
      '..kHhhhhhhhhhhHk..',
      '.kHhhhhhhhhhhhhHk.',
      '.kyyyyyyyyyyyyyyk.',
      '..khppkppppkpphk..',
      '..khpppppppppphk..',
      '..kkppPPPPPPppkk..',
      '...kkrrrrrrrrkk...',
      '..kssssssssssssk..',
      '..ksSrssssssrSsk..',
      '.kpssrssssssrsspk.',
      '..kcccccccccccck..',
    ],
    costas: [
      '...kkHHHHHHHHkk...',
      '..kHhhhhhhhhhhHk..',
      '.kHhhhhhhhhhhhhHk.',
      '.kyyyyyyyyyyyyyyk.',
      '..khhhhhhhhhhhhk..',
      '..khhhhhhhhhhhhk..',
      '..kkhhhhhhhhhhkk..',
      '...kkrrrrrrrrkk...',
      '..kssssssssssssk..',
      '..ksSssssssssSsk..',
      '.kpssssssssssspk..',
      '..kcccccccccccck..',
    ],
    lado: [
      '..kkHHHHHHHkk.....',
      '.kHhhhhhhhhhk.....',
      'kHhhhhhhhhppppk...',
      'kyyyyyyyyykppk....',
      'khhhhhhhppppppk...',
      '.khhhhpppppPk.....',
      '.kkhhpppPPPkk.....',
      '..kkrrrrrrkk......',
      '..ksssssssrk......',
      '..ksSssssssk......',
      '..ksrssssssspk....',
      '..kcccccccccck....',
    ],
  },
};

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

function montar(
  tronco: readonly string[],
  pernas: readonly string[],
  paleta: Paleta,
): Sprite {
  return pintar([...tronco, ...pernas], paleta);
}

export interface QuadrosJogador {
  baixo: Sprite[];
  cima: Sprite[];
  direita: Sprite[];
  esquerda: Sprite[];
  /** Sprite da lança, apontando para a direita. Pivô em (2, 2). */
  lanca: Sprite;
}

/**
 * Lança de pedra: cabo com contorno (para não desaparecer no chão de terra),
 * amarração vermelha e ponta larga. Pivô em (2, 3), na mão do jogador. É a
 * mesma para os quatro personagens.
 */
function criarLanca(): Sprite {
  return pintar(
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
}

/** Monta os quadros de um personagem a partir do desenho e da paleta dele. */
function criarPersonagem(id: PersonagemId, lanca: Sprite): QuadrosJogador {
  const d = DESENHOS[id];
  const pal: Paleta = { ...PAL, ...d.cores };
  const baixo = PERNAS_FRENTE.map((p) => montar(d.frente, p, pal));
  const cima = PERNAS_FRENTE.map((p) => montar(d.costas, p, pal));
  const direita = PERNAS_LADO.map((p) => montar(d.lado, p, pal));
  const esquerda = direita.map((s) => espelharH(s));
  return { baixo, cima, direita, esquerda, lanca };
}

/** Os quatro personagens jogáveis, prontos para a tela de escolha. */
export function criarPersonagens(): Record<PersonagemId, QuadrosJogador> {
  const lanca = criarLanca();
  const saida = {} as Record<PersonagemId, QuadrosJogador>;
  for (const id of Object.keys(DESENHOS) as PersonagemId[]) {
    saida[id] = criarPersonagem(id, lanca);
  }
  return saida;
}

/** Quadros do personagem padrão (usado antes da escolha). */
export function criarJogador(): QuadrosJogador {
  return criarPersonagem('teo', criarLanca());
}
