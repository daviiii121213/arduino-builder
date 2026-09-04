/**
 * Arte dos dez dinossauros — todos desenhados à mão, vista lateral,
 * virados para a direita (a versão esquerda é espelhada em tempo de execução).
 *
 * Legenda dos caracteres:
 *   k contorno   a corpo   b luz do corpo   c sombra do corpo   d barriga
 *   e detalhe (listras/manchas)   f detalhe 2 (placas, cristas, cristais)
 *   o olho       t dentes   g garra   m brilho mágico
 */

import { pintar, espelharH, type Paleta, type Sprite } from '../pixel';

export type EspecieId =
  | 'raptornoz'
  | 'dentesangue'
  | 'folhalonga'
  | 'tricornis'
  | 'casconte'
  | 'pedrapata'
  | 'nadalonga'
  | 'escamarela'
  | 'luminassauro'
  | 'etherodonte';

interface Desenho {
  corpo: string[];
  /** Quadros de pernas/nadadeiras, anexados abaixo do corpo. */
  pernas: string[][];
  cores: Record<string, string>;
}

const OLHO = '#12101a';
const DENTE = '#fff6e0';

const DESENHOS: Record<EspecieId, Desenho> = {
  // ------------------------------------------------- CARNÍVORO ágil
  raptornoz: {
    cores: {
      k: '#3a1c08', a: '#d2762c', b: '#f2a04a', c: '#a1521c', d: '#f2d9a8',
      e: '#7a3a12', f: '#e04a3a', g: '#f2e3c2',
    },
    corpo: [
      '.....................kfk..',
      '..................kkkfffk.',
      '.................kbbbbffk.',
      '................kaaoaaak..',
      '...............kaaaaakttk.',
      '..........kkkkkaaaaakkk...',
      '.......kkkbaaaaaaaaak.....',
      '.kkkkkkaaaaeaaaeaaaak.....',
      'kkbaaaaaaaeaaaeaaaadk.....',
      '.kkkkkkaaaaaaaaaadddk.....',
      '.......kaddddddddddk......',
      '........kaaaaaaaaak.......',
    ],
    pernas: [
      [
        '........kaakkaak..........',
        '.......kaak..kaak.........',
        '.......kggk..kggk.........',
        '.......kkk....kkk.........',
      ],
      [
        '........kaakkaak..........',
        '.......kaak...kaak........',
        '......kggk.....kggk.......',
        '......kkk.......kkk.......',
      ],
    ],
  },

  // ------------------------------------------------- CARNÍVORO pesado
  dentesangue: {
    cores: {
      k: '#141f12', a: '#3f6b3a', b: '#5d9350', c: '#2a4a28', d: '#c9d6a0',
      e: '#23361f', f: '#b8322f', g: '#e8e0c0',
    },
    corpo: [
      '......................kkkkk...',
      '.....................kfffbbk..',
      '....................kbaaaoak..',
      '....................kaaaaaak..',
      '....................kaattttk..',
      '.....................kaakkkk..',
      '..............kkkkkkkbaak.....',
      '..........kkkkbaaaaaaaak......',
      '.....kkkkkkaaaaaaeaaaak.......',
      '.kkkkkaaaaaaeaaaeaaaaak.......',
      'kkbaaaaaaaaeaaaeaaaaadk.......',
      '.kkkkkkaaaaaaaaaaaadddk.......',
      '........kkaaddddddddddk.......',
      '..........kaaaaaaaaaak........',
    ],
    pernas: [
      [
        '..........kaakkkaaak..........',
        '..........kaak.kaaak..........',
        '.........kaak...kaak..........',
        '.........kaak...kaak..........',
        '........kgggk..kgggk..........',
        '........kkkk....kkkk..........',
      ],
      [
        '..........kaakkkaaak..........',
        '.........kaak...kaaak.........',
        '........kaak.....kaak.........',
        '.......kaak......kaak.........',
        '......kgggk.....kgggk.........',
        '......kkkk.......kkkk.........',
      ],
    ],
  },

  // ------------------------------------------------- HERBÍVORO pescoço longo
  folhalonga: {
    cores: {
      k: '#123330', a: '#3f8f8a', b: '#58b3ab', c: '#2a6664', d: '#cfe9c8',
      e: '#2d6f6c', f: '#8fd8c0', g: '#cfe9c8',
    },
    corpo: [
      '........................kkkk....',
      '.......................kbbbak...',
      '.......................kaaoak...',
      '.......................kaaaak...',
      '.......................kkaakk...',
      '........................kaak....',
      '........................kaak....',
      '........................kaak....',
      '.......................kbaak....',
      '.......................kbaak....',
      '..............kkkkkkkkkbaak.....',
      '.........kkkkkbaaaaaaaaak.......',
      '....kkkkkaaaaaaaaaaaaaaak.......',
      'kkkkkaaaaaaeaaaeaaaeaaaak.......',
      'kkbaaaaaaaaaaaaaaaaaaaadk.......',
      '.kkkkkkkaaaaaaaaaaaaaddk........',
      '.........kaaddddddddddk.........',
      '..........kaaaaaaaaaak..........',
    ],
    pernas: [
      [
        '..........kaaakkkaaak...........',
        '..........kaaak.kaaak...........',
        '..........kaaak.kaaak...........',
        '..........kaaak.kaaak...........',
        '.........kcaaak.kaaack..........',
        '.........kkkkk...kkkkk..........',
      ],
      [
        '..........kaaakkkaaak...........',
        '.........kaaak..kaaak...........',
        '.........kaaak..kaaack..........',
        '.........kaaak..kaaack..........',
        '........kcaaak...kaaack.........',
        '........kkkkk....kkkkk..........',
      ],
    ],
  },

  // ------------------------------------------------- HERBÍVORO com chifres
  tricornis: {
    cores: {
      k: '#3d2a12', a: '#b58a5a', b: '#d3ab77', c: '#8a6238', d: '#efdcae',
      e: '#8a6238', f: '#e2c98f', g: '#efdcae',
    },
    corpo: [
      '..................kfk.......',
      '.................kffk.......',
      '..............kkkkbffk......',
      '.............kbaaabffkkk....',
      '............kbaaaaaffk.fk...',
      '...........kaaaaoaaffkfkk...',
      '..........kbaaaaaaaffk......',
      '.........kbaaaaaaaakkk......',
      '....kkkkkaaaaaaaaaak........',
      '.kkkkaaaaaaeaaaeaaak........',
      'kkbaaaaaaaaaaaaaaadk........',
      '.kkkkkkaaaaaaaaaaddk........',
      '.......kaddddddddddk........',
      '........kaaaaaaaaak.........',
    ],
    pernas: [
      [
        '........kaakkaak............',
        '........kaak.kaak...........',
        '.......kcaak.kaack..........',
        '.......kkkk...kkkk..........',
      ],
      [
        '........kaakkaak............',
        '.......kaak...kaak..........',
        '......kcaak...kaack.........',
        '......kkkk.....kkkk.........',
      ],
    ],
  },

  // ------------------------------------------------- TERRESTRE blindado
  casconte: {
    cores: {
      k: '#2b2d38', a: '#7c7f8c', b: '#9ea1b0', c: '#565a68', d: '#c3c6d2',
      e: '#8f9270', f: '#d6d9e2', g: '#c3c6d2',
    },
    corpo: [
      '...............kkkkkk.......',
      '............kkkeeeeeek......',
      '........kkkkeeeeeeeeekkk....',
      '.....kkkkeeeeeeeeeeeeeeakk..',
      '.kkkkkeeeeeeeeeeeeeebaoaak..',
      'kfffkkbaaaaaaaaaaaaaaaaaak..',
      'kfffkkaaaaaaaaaaaaaaakkkk...',
      'kfffk.kaddddddddddddk.......',
      '.kkk..kaaaaaaaaaaaaak.......',
    ],
    pernas: [
      [
        '.......kaakkkkkaak..........',
        '.......kaak...kaak..........',
        '......kcaak...kaack.........',
        '......kkkk.....kkkk.........',
      ],
      [
        '.......kaakkkkkaak..........',
        '......kaak.....kaak.........',
        '.....kcaak.....kaack........',
        '.....kkkk.......kkkk........',
      ],
    ],
  },

  // ------------------------------------------------- TERRESTRE com placas
  pedrapata: {
    cores: {
      k: '#20250f', a: '#6f7f3a', b: '#90a34d', c: '#4e5a27', d: '#d0cf9a',
      e: '#3f4a1e', f: '#c46a3a', g: '#d0cf9a',
    },
    corpo: [
      '..............kfk..kfk........',
      '.........kfk.kfffkkfffk.......',
      '....kfk.kfffkkfffkkfffk.kkk...',
      '...kfffkkfffkkfffkkfffkkbaak..',
      '..kkkkkkkkkkkkkkkkkkkkkaaoak..',
      '.kkbaaaaaaaaaaaaaaaaaaaaaaak..',
      'kkbaaaaaaaeaaaeaaaeaaaakkkk...',
      '.kkkkkaaaaaaaaaaaaaaaadk......',
      '......kkaaddddddddddddk.......',
      '........kaaaaaaaaaaaak........',
    ],
    pernas: [
      [
        '.........kaakkkkaaak..........',
        '.........kaak..kaaak..........',
        '........kcaak..kaaack.........',
        '........kkkk....kkkk..........',
      ],
      [
        '.........kaakkkkaaak..........',
        '........kaak....kaaak.........',
        '.......kcaak....kaaack........',
        '.......kkkk......kkkk.........',
      ],
    ],
  },

  // ------------------------------------------------- AQUÁTICO pescoço longo
  nadalonga: {
    cores: {
      k: '#12283d', a: '#3a6fb0', b: '#5b96d6', c: '#26497a', d: '#cfe4f2',
      e: '#24406b', f: '#bfeaf2', g: '#cfe4f2',
    },
    corpo: [
      '.....................kkkk......',
      '....................kbbaak.....',
      '....................kaaoak.....',
      '....................kkaakk.....',
      '.....................kaak......',
      '.....................kaak......',
      '....................kbaak......',
      '..........kkkkkkkkkkbaak.......',
      '.kkkkkkkkkbaaaaaaaaaaak........',
      'kkbaaaaaaaaaaeaaaeaaaadk.......',
      '.kkkkkkkaaaaaaaaaaaaddk........',
      '.......kkkaaddddddddk..........',
      '.........kkaaaaaaaak...........',
    ],
    pernas: [
      [
        '.........kcaak.kaaack..........',
        '........kccak...kacck..........',
        '.........kkk.....kkk...........',
      ],
      [
        '........kccaak.kaaacck.........',
        '........kkkkk...kkkkk..........',
        '...............................',
      ],
    ],
  },

  // ------------------------------------------------- AQUÁTICO predador
  escamarela: {
    cores: {
      k: '#1f2a0c', a: '#7fa63a', b: '#a3c655', c: '#566f26', d: '#e2e9b0',
      e: '#47591f', f: '#c8d86a', g: '#e2e9b0',
    },
    corpo: [
      '.................kkkkk.........',
      '................kbbbaak........',
      '...............kaaaoaaak.......',
      '..kk...........kaaaaaattk......',
      '.kfk..kkkkkkkkkbaaaaakkkk......',
      'kkfkkkbaaaaaaaaaaaaaakk........',
      'kkffaaaaeaaaeaaaaaaaadk........',
      'kkfkkkaaaaaaaaaaaaaaddk........',
      '.kfk..kkaddddddddddddk.........',
      '..kk....kaaaaaaaaaaak..........',
    ],
    pernas: [
      [
        '.........kccak..kaack..........',
        '..........kkk....kkk...........',
      ],
      [
        '........kccaak..kaacck.........',
        '.........kkkk....kkkk..........',
      ],
    ],
  },

  // ------------------------------------------------- MÁGICO de cristais
  luminassauro: {
    cores: {
      k: '#1b2340', a: '#4f6fb8', b: '#6f92d9', c: '#33487f', d: '#cfd9f2',
      e: '#7fd0ff', f: '#9fe8ff', g: '#cfd9f2', m: '#d7f2ff',
    },
    corpo: [
      '...........kmk............',
      '..........kfffk...........',
      '.....kmk..kfffk..kkkk.....',
      '....kfffk.kfffkkkbaamk....',
      '...kfffffkkfffkkbaoaak....',
      '...kkkkkkkkkkkkkaaaaak....',
      '.kkkbaaaaaaaaaaaaaakkk....',
      'kkbaaaaeaaaeaaaaaaadk.....',
      '.kkkkaaaaaaaaaaaaaddk.....',
      '.....kaaddddddddddk.......',
      '......kaaaaaaaaaak........',
    ],
    pernas: [
      [
        '......kaakkkaaak..........',
        '......kaak.kaaak..........',
        '.....kmaak.kaamk..........',
        '.....kkkk...kkkk..........',
      ],
      [
        '......kaakkkaaak..........',
        '.....kaak...kaaak.........',
        '....kmaak...kaamk.........',
        '....kkkk.....kkkk.........',
      ],
    ],
  },

  // ------------------------------------------------- MÁGICO flutuante
  etherodonte: {
    cores: {
      k: '#2a1846', a: '#7a4fc0', b: '#a273e0', c: '#52318a', d: '#dcc8f7',
      e: '#d7b4ff', f: '#e8d7ff', g: '#dcc8f7', m: '#e8d7ff',
    },
    corpo: [
      '..........kkkk..........',
      '.........kbbbamk........',
      '........kbaaoaak........',
      '.......kbaaaaaak........',
      '....kkkbaaeaaaekk.......',
      '.kkkkaaaaaaaaaak........',
      'kmkaaaeaaaeaaadk........',
      '.kkkkaaaaaaaddk.........',
      '....kaaddddddk..........',
      '.....kaaaaaak...........',
    ],
    pernas: [
      [
        '.....kmmk.kmmk..........',
        '......km...mk...........',
      ],
      [
        '.....km.mk.km.mk........',
        '......m.....m...........',
      ],
    ],
  },
};

export interface ArteDino {
  direita: Sprite[];
  esquerda: Sprite[];
  w: number;
  h: number;
}

function paletaDe(cores: Record<string, string>): Paleta {
  return { '.': null, ' ': null, o: OLHO, t: DENTE, ...cores };
}

export function criarDinos(): Record<EspecieId, ArteDino> {
  const saida = {} as Record<EspecieId, ArteDino>;
  for (const id of Object.keys(DESENHOS) as EspecieId[]) {
    const d = DESENHOS[id];
    const pal = paletaDe(d.cores);
    const direita = d.pernas.map((pernas) => pintar([...d.corpo, ...pernas], pal));
    const esquerda = direita.map((s) => espelharH(s));
    saida[id] = {
      direita,
      esquerda,
      w: direita[0].width,
      h: direita[0].height,
    };
  }
  return saida;
}
