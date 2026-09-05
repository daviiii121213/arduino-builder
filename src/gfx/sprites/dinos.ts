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
  | 'etherodonte'
  // ---- clareira encantada
  | 'arcanoraptor'
  | 'cristalossauro'
  | 'lumidraco'
  // ---- pantano das raizes
  | 'pantanossauro'
  | 'crocossauro'
  | 'venomossauro'
  // ---- floresta fechada
  | 'silvassauro'
  | 'espinosselva'
  | 'feroxossauro'
  // ---- campo de lava
  | 'magmossauro'
  | 'ignissauro'
  | 'vulcanor'
  // ---- deserto de vidro
  | 'arenossauro'
  | 'dunassauro'
  | 'tempestossauro'
  // ---- criaturas das cavernas
  | 'pedrolito'
  | 'cavernossauro'
  | 'geodonte'
  | 'espectrossauro'
  | 'escaldossauro'
  | 'brasadonte'
  // ---- chefes do decimo andar
  | 'cristalodonte'
  | 'ignivoro';

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
      '..............kfk..',
      '...........kkkfffk.',
      '..........kbbbbffk.',
      '.........kaaoaaak..',
      '........kaaaaakttk.',
      '....kkkkaaaaakkk...',
      '.kkkbaaaaaaaak.....',
      'kkbaaaeaaaeaaadk...',
      '.kkkbaaaaaaadddk...',
      '...kaddddddddk.....',
      '....kaaaaaaak......',
    ],
    pernas: [
      ['....kaakkaak.......', '...kaak..kaak......', '...kggk..kggk......', '...kkk....kkk......'],
      ['....kaakkaak.......', '..kaak....kaak.....', '..kggk....kggk.....', '..kkk......kkk.....'],
    ],
  },

  // ------------------------------------------------- CARNÍVORO pesado
  dentesangue: {
    cores: {
      k: '#141f12', a: '#3f6b3a', b: '#5d9350', c: '#2a4a28', d: '#c9d6a0',
      e: '#23361f', f: '#b8322f', g: '#e8e0c0',
    },
    corpo: [
      '.................kkkk...',
      '................kfffbk..',
      '...............kbaaaoak.',
      '...............kaaaaaak.',
      '...............kaattttk.',
      '..........kkkkkkaakkkk..',
      '.....kkkkkbaaaaaaak.....',
      '.kkkkkaaaaaeaaaeaaak....',
      'kkbaaaaaaeaaaeaaaaadk...',
      '.kkkkbaaaaaaaaaaaddddk..',
      '.....kkaaddddddddddk....',
      '.......kaaaaaaaaaak.....',
    ],
    pernas: [
      [
        '.......kaakkkaaak.......',
        '.......kaak.kaaak.......',
        '......kgggk.kgggk.......',
        '......kkkk...kkkk.......',
      ],
      [
        '.......kaakkkaaak.......',
        '......kaak...kaaak......',
        '.....kgggk...kgggk......',
        '.....kkkk.....kkkk......',
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
      '...................kkkk.',
      '..................kbbak.',
      '..................kaoak.',
      '..................kkaak.',
      '...................kaak.',
      '...................kaak.',
      '..........kkkkkkkkkbaak.',
      '.....kkkkkbaaaaaaaaaak..',
      '.kkkkkaaaaaaeaaaeaaaak..',
      'kkbaaaaaaaaaaaaaaaaadk..',
      '.kkkkkaaaaaaaaaaaaddk...',
      '.....kaaddddddddddk.....',
      '......kaaaaaaaaaak......',
    ],
    pernas: [
      [
        '......kaaakkkaaak.......',
        '......kaaak.kaaak.......',
        '.....kcaaak.kaaack......',
        '.....kkkkk...kkkkk......',
      ],
      [
        '......kaaakkkaaak.......',
        '.....kaaak..kaaack......',
        '....kcaaak..kaaack......',
        '....kkkkk....kkkkk......',
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
      '.............kfk......',
      '............kffk......',
      '.........kkkkbffk.....',
      '........kbaaabffkk....',
      '.......kbaaaaaffk.fk..',
      '......kaaaaoaaffkfkk..',
      '.....kbaaaaaaaffk.....',
      '..kkkbaaaaaaakkk......',
      '.kkkaaaeaaaeaak.......',
      'kkbaaaaaaaaaadk.......',
      '.kkkkaaaaaaaddk.......',
      '....kaddddddk.........',
      '.....kaaaaaak.........',
    ],
    pernas: [
      ['.....kaakkaak.........', '....kcaak.kaack.......', '....kkkk...kkkk.......'],
      ['.....kaakkaak.........', '...kcaak...kaack......', '...kkkk.....kkkk......'],
    ],
  },

  // ------------------------------------------------- TERRESTRE blindado
  casconte: {
    cores: {
      k: '#2b2d38', a: '#7c7f8c', b: '#9ea1b0', c: '#565a68', d: '#c3c6d2',
      e: '#8f9270', f: '#d6d9e2', g: '#c3c6d2',
    },
    corpo: [
      '...........kkkkkk.......',
      '........kkkeeeeeek......',
      '.....kkkeeeeeeeeekkk....',
      '..kkkkeeeeeeeeeeeeeakk..',
      'kfffkeeeeeeeeeeebaoaak..',
      'kfffkbaaaaaaaaaaaaaaak..',
      'kfffkaaaaaaaaaaaakkkk...',
      '.kkk.kaddddddddddk......',
      '.....kaaaaaaaaaaak......',
    ],
    pernas: [
      ['.....kaakkkkaak.........', '....kcaak..kaack........', '....kkkk....kkkk........'],
      ['.....kaakkkkaak.........', '...kcaak....kaack.......', '...kkkk......kkkk.......'],
    ],
  },

  // ------------------------------------------------- TERRESTRE com placas
  pedrapata: {
    cores: {
      k: '#20250f', a: '#6f7f3a', b: '#90a34d', c: '#4e5a27', d: '#d0cf9a',
      e: '#3f4a1e', f: '#c46a3a', g: '#d0cf9a',
    },
    corpo: [
      '.........kfk..kfk.........',
      '....kfk.kfffkkfffk.kkk....',
      '...kfffkkfffkkfffkkbaak...',
      '..kkkkkkkkkkkkkkkkkaaoak..',
      '.kkbaaaaaaaaaaaaaaaaaaak..',
      'kkbaaaaeaaaeaaaeaaaakkk...',
      '.kkkkbaaaaaaaaaaaaaadk....',
      '....kkaaddddddddddddk.....',
      '......kaaaaaaaaaaaak......',
    ],
    pernas: [
      ['......kaakkkkaaak........', '.....kcaak..kaaack.......', '.....kkkk....kkkk.......'],
      ['......kaakkkkaaak........', '....kcaak....kaaack......', '....kkkk......kkkk......'],
    ],
  },

  // ------------------------------------------------- AQUÁTICO pescoço longo
  nadalonga: {
    cores: {
      k: '#12283d', a: '#3a6fb0', b: '#5b96d6', c: '#26497a', d: '#cfe4f2',
      e: '#24406b', f: '#bfeaf2', g: '#cfe4f2',
    },
    corpo: [
      '..................kkkk....',
      '.................kbbaak...',
      '.................kaaoak...',
      '.................kkaakk...',
      '..................kaak....',
      '.........kkkkkkkkkbaak....',
      '.kkkkkkkkbaaaaaaaaaak.....',
      'kkbaaaaaaaaeaaaeaaaadk....',
      '.kkkkkkaaaaaaaaaaaddk.....',
      '......kkaaddddddddk.......',
      '........kaaaaaaaak........',
    ],
    pernas: [
      ['.......kcaak.kaaack.......', '........kkk...kkk.........'],
      ['......kccaak.kaaacck......', '.......kkkk...kkkk........'],
    ],
  },

  // ------------------------------------------------- AQUÁTICO predador
  escamarela: {
    cores: {
      k: '#1f2a0c', a: '#7fa63a', b: '#a3c655', c: '#566f26', d: '#e2e9b0',
      e: '#47591f', f: '#c8d86a', g: '#e2e9b0',
    },
    corpo: [
      '.............kkkkk........',
      '............kbbbaak.......',
      '..kk.......kaaaoaaak......',
      '.kfk..kkkkkkaaaaaattk.....',
      'kkfkkkbaaaaaaaaaakkkk.....',
      'kkffaaaaeaaaeaaaaadk......',
      'kkfkkkaaaaaaaaaaddk.......',
      '.kfk..kkaddddddddk........',
      '..kk....kaaaaaaak.........',
    ],
    pernas: [
      ['........kccak.kaack.......', '.........kkk...kkk........'],
      ['.......kccaak.kaaack......', '........kkkk...kkkk.......'],
    ],
  },

  // ------------------------------------------------- MÁGICO de cristais
  luminassauro: {
    cores: {
      k: '#1b2340', a: '#4f6fb8', b: '#6f92d9', c: '#33487f', d: '#cfd9f2',
      e: '#7fd0ff', f: '#9fe8ff', g: '#cfd9f2', m: '#d7f2ff',
    },
    corpo: [
      '.......kmk..........',
      '......kfffk.........',
      '..kmk.kfffk..kkk....',
      '.kfffkkfffkkkbaamk..',
      'kfffffkfffkkbaoaak..',
      'kkkkkkkkkkkkaaaaak..',
      '.kkbaaaaaaaaaaakkk..',
      'kkbaaaeaaaeaaaadk...',
      '.kkkaaaaaaaaaaddk...',
      '...kaaddddddddk.....',
      '....kaaaaaaaak......',
    ],
    pernas: [
      ['....kaakkaaak.......', '....kaak.kaak.......', '...kmaak.kaamk......', '...kkkk...kkkk......'],
      ['....kaakkaaak.......', '...kaak...kaak......', '..kmaak...kaamk.....', '..kkkk.....kkkk.....'],
    ],
  },

  // ------------------------------------------------- MÁGICO flutuante
  etherodonte: {
    cores: {
      k: '#2a1846', a: '#7a4fc0', b: '#a273e0', c: '#52318a', d: '#dcc8f7',
      e: '#d7b4ff', f: '#e8d7ff', g: '#dcc8f7', m: '#e8d7ff',
    },
    corpo: [
      '........kkkk......',
      '.......kbbbamk....',
      '......kbaaoaak....',
      '.....kbaaaaaak....',
      '..kkkbaaeaaaekk...',
      'kmkaaaaaaaaaak....',
      'kkkaaaeaaaeadk....',
      '.kkkkaaaaaddk.....',
      '...kaaddddk.......',
      '....kaaaak........',
    ],
    pernas: [
      ['....kmmk.kmmk.....', '.....km...mk......'],
      ['...km.mk.km.mk....', '.....m.....m......'],
    ],
  },

  // ------------------------------------------------- MAGICO agil
  arcanoraptor: {
    cores: {
      k: '#1c1436', a: '#5b47b0', b: '#8b6fe0', c: '#3a2a78', d: '#cfc0ff', e: '#2f2160', f: '#7ff0e0',
      g: '#e6ffff', m: '#7ff0e0',
    },
    corpo: [
      '.............kfk.',
      '..........kkkfffk',
      '.........kbbbbffk',
      '........kaaoaaak.',
      '.......kaaaaakttk',
      '...kkkkaaaaakkk..',
      'kkkbaaaeaaaak....',
      'kbaaaeaaaeaaadk..',
      'kkkbaaaaaaadddk..',
      '..kaddddddddk....',
      '...kaaaaaaak.....',
    ],
    pernas: [
      ['...kaakkaak......', '..kaak..kaak.....', '..kggk..kggk.....', '..kkk....kkk.....'],
      ['...kaakkaak......', '.kaak....kaak....', '.kggk....kggk....', '.kkk......kkk....'],
    ],
  },

  // ------------------------------------------------- MAGICO couracado de cristal
  cristalossauro: {
    cores: {
      k: '#241a3f', a: '#4a6fb0', b: '#6f9ae0', c: '#2f4a80', d: '#cfe4ff', e: '#3a5590', f: '#a8f0ff',
      g: '#ffffff', m: '#a8f0ff',
    },
    corpo: [
      '.....kfk..kfk..kfk.',
      '....kfffkkfffkkfffk',
      'kkk..kfk.kaaak.kfk.',
      'kbbkaaaaaaaaaaaaaak',
      'kaoaaaaaeaaaaeaaaak',
      'kattkaaaaaaaaaaaak.',
      '.kkk.kaddddddddk...',
      '.....kaaaaaaaak....',
    ],
    pernas: [
      ['....kaak.....kaak..', '....kaak.....kaak..', '....kggk.....kggk..', '....kkk.......kkk..'],
      ['....kaak.....kaak..', '...kaak.......kaak.', '...kggk.......kggk.', '...kkk.........kkk.'],
    ],
  },

  // ------------------------------------------------- MAGICO alado, o mais perigoso
  lumidraco: {
    cores: {
      k: '#3a2a10', a: '#e0c060', b: '#fff3b0', c: '#a8842f', d: '#fffbe0', e: '#ffd680', f: '#ffffff',
      g: '#fff3b0', m: '#ffffff',
    },
    corpo: [
      '.kfk.........kfk.',
      'kffk...kkk...kffk',
      'kfffk.kbbbk.kfffk',
      '.kfffkbaoabkfffk.',
      '..kffkaaaaakffk..',
      '...kkkaaaaakkk...',
      '....kaaeaaak.....',
      '...kaaddddaak....',
      '....kddddk.......',
      '.....kddk........',
    ],
    pernas: [
      ['....kmmk.kmmk....', '.....km...mk.....'],
      ['...km.mk.km.mk...', '.....m.....m.....'],
    ],
  },

  // ------------------------------------------------- PANTANO manso e pesado
  pantanossauro: {
    cores: {
      k: '#12200f', a: '#4a6b3a', b: '#6b8f4a', c: '#2f4a24', d: '#a8b87a', e: '#35502a', f: '#7a9a4a',
      g: '#c8d89a',
    },
    corpo: [
      '..........kfffffk..',
      '.......kkfffffffffk',
      '.kkk..kbbbaaaaaaaak',
      'kboakbaaaaaeaaaaaak',
      'kaaakaaaaaaaaaaaaak',
      '.kkk.kaddddddddddk.',
      '.....kaaaaaaaaaak..',
    ],
    pernas: [
      ['.....kaak....kaak..', '.....kaak....kaak..', '.....kggk....kggk..', '.....kkk......kkk..'],
      ['.....kaak....kaak..', '....kaak......kaak.', '....kggk......kggk.', '....kkk........kkk.'],
    ],
  },

  // ------------------------------------------------- PANTANO rasteiro de agua parada
  crocossauro: {
    cores: {
      k: '#0f1a12', a: '#3f5a3a', b: '#5f7d4a', c: '#26382a', d: '#b0a878', e: '#2a3f28', f: '#6f8f52',
      g: '#e8e0c0',
    },
    corpo: [
      '.....kfk.kfk.kfk.kfk',
      'kkkkkbbbkbbbkbbbkbbk',
      'kbookaaaaaaaaaaaaaak',
      'kattaaaaaaaaaeaaaaak',
      'kkkkkaaaaaaaaaaaaaak',
      '....kadddddddddddk..',
      '....kaaaaaaaaaaak...',
    ],
    pernas: [
      ['.....kaak......kaak.', '.....kggk......kggk.', '.....kkk........kkk.'],
      ['....kaak........kaak', '....kggk........kggk', '....kkk..........kkk'],
    ],
  },

  // ------------------------------------------------- PANTANO peconhento
  venomossauro: {
    cores: {
      k: '#1a1024', a: '#4f7a3a', b: '#6f9f4a', c: '#33502a', d: '#c8e0a0', e: '#7a3ac0', f: '#b06fe8',
      g: '#e0c0ff', m: '#b06fe8',
    },
    corpo: [
      '..............kfk..',
      '...........kkkfffk.',
      '..........kbbbbffk.',
      '.........kaaoaaak..',
      '........kaaaaakttk.',
      '.....kfk.kaaaak....',
      '...kkfkkkaaaaaakk..',
      'kkkbaaaaaaaeaaaaadk',
      'kbaaaeaaaaaaaaaaddk',
      'kkkbaaaaaaaaadddk..',
      '..kadddddddddk.....',
      '...kaaaaaaaak......',
    ],
    pernas: [
      ['.....kaakkaaak.....', '.....kaak.kaak.....', '....kggak.kaggk....', '....kkkk...kkkk....'],
      ['.....kaakkaaak.....', '....kaak...kaak....', '...kggak...kaggk...', '...kkkk.....kkkk...'],
    ],
  },

  // ------------------------------------------------- FLORESTA pequeno e assustado
  silvassauro: {
    cores: {
      k: '#152a12', a: '#6f9a4a', b: '#93bf68', c: '#4a6f32', d: '#dbe8b0', e: '#3f6b28', f: '#57a544',
      g: '#c8e88a',
    },
    corpo: [
      '.........kfk.',
      '.......kffffk',
      '....kkkkbbbk.',
      '...kbaaoaak..',
      '..kbaaaaakttk',
      'kkkaaaaaaak..',
      'kbaaaeaaadk..',
      'kkkaadddddk..',
      '..kaaaaaak...',
    ],
    pernas: [
      ['..kaakkaak...', '.kaak..kaak..', '.kggk..kggk..', '.kkk....kkk..'],
      ['..kaakkaak...', 'kaak....kaak.', 'kggk....kggk.', 'kkk......kkk.'],
    ],
  },

  // ------------------------------------------------- FLORESTA de vela espinhosa
  espinosselva: {
    cores: {
      k: '#1c2412', a: '#7a6a3a', b: '#9f8a4a', c: '#54492a', d: '#d8c890', e: '#3f5a28', f: '#c0602a',
      g: '#e8d8a0',
    },
    corpo: [
      '........kfk.kfk.kfk.',
      '.......kfffkfffkfffk',
      '.....kkkbbbbbbbbbbk.',
      '....kbaoaaaaaaaaaak.',
      '...kbaattkaaaaaaaak.',
      'kkkkbaaaaaaaaaaaaak.',
      'kbaaaaaeaaaeaaaaddk.',
      'kkkbaaaaaaaaaaadddk.',
      '..kaddddddddddk.....',
      '...kaaaaaaaaak......',
    ],
    pernas: [
      ['....kaak....kaak....', '....kaak....kaak....', '....kggk....kggk....', '....kkk......kkk....'],
      ['....kaak....kaak....', '...kaak......kaak...', '...kggk......kggk...', '...kkk........kkk...'],
    ],
  },

  // ------------------------------------------------- FLORESTA cacador de emboscada
  feroxossauro: {
    cores: {
      k: '#161f10', a: '#3f5a2a', b: '#5f7f3a', c: '#2a3d1c', d: '#c9d6a0', e: '#7a3a12', f: '#b8322f',
      g: '#e8e0c0',
    },
    corpo: [
      '................kkkk..',
      '...............kfffbk.',
      '..............kbaaaoak',
      '..............kaaaaaak',
      '..............kaattttk',
      '.........kkkkkkaakkkk.',
      '....kkkkkbaaaaaaak....',
      'kkkkkaaaaaeaaaeaaak...',
      'kbaaaaaaeaaaeaaaaadk..',
      'kkkkbaaaaaaaaaaaddddk.',
      '....kkaaddddddddddk...',
      '......kaaaaaaaaaak....',
    ],
    pernas: [
      ['.......kaakkaaak......', '.......kaak.kaak......', '......kggak.kaggk.....', '......kkkk...kkkk.....'],
      ['.......kaakkaaak......', '......kaak...kaak.....', '.....kggak...kaggk....', '.....kkkk.....kkkk....'],
    ],
  },

  // ------------------------------------------------- VULCANICO couraca de pedra quente
  magmossauro: {
    cores: {
      k: '#0f0a0a', a: '#3a2f2f', b: '#5a4a46', c: '#241c1c', d: '#6b5a54', e: '#ff6a2a', f: '#ffb14a',
      g: '#ffd680', m: '#ff6a2a',
    },
    corpo: [
      '.....kek..kek..kek.',
      '....kfffkkfffkkfffk',
      'kkk.kaaaaaaaaaaaaak',
      'kbbkaaaaeaaaaeaaaak',
      'kaoaaaaaaaaaaaaaaak',
      'kattkaaaeaaaaaaaak.',
      '.kkk.kaddddddddk...',
      '.....kaaaaaaaak....',
    ],
    pernas: [
      ['....kaak.....kaak..', '....kaak.....kaak..', '....kggk.....kggk..', '....kkk.......kkk..'],
      ['....kaak.....kaak..', '...kaak.......kaak.', '...kggk.......kggk.', '...kkk.........kkk.'],
    ],
  },

  // ------------------------------------------------- VULCANICO crista em brasa
  ignissauro: {
    cores: {
      k: '#180c08', a: '#7a2f1a', b: '#a8492a', c: '#4a1c10', d: '#e8a860', e: '#ff6a2a', f: '#ffb14a',
      g: '#fff0a0', m: '#ffb14a',
    },
    corpo: [
      '............kek.kfk',
      '.........kkkefeffk.',
      '........kbbbbeffk..',
      '.......kaaoaaak....',
      '......kaaaaakttk...',
      '..kkkkaaaaakkk.....',
      'kkkbaaaaaaaak......',
      'kbaaaeaaaeaaadk....',
      'kkkbaaaaaaadddk....',
      '.kaddddddddk.......',
      '..kaaaaaaak........',
    ],
    pernas: [
      ['..kaakkaak.........', '.kaak..kaak........', '.kggk..kggk........', '.kkk....kkk........'],
      ['..kaakkaak.........', 'kaak....kaak.......', 'kggk....kggk.......', 'kkk......kkk.......'],
    ],
  },

  // ------------------------------------------------- VULCANICO o colosso do campo de lava
  vulcanor: {
    cores: {
      k: '#0d0605', a: '#4a1f14', b: '#7a3520', c: '#2a100a', d: '#c98a4a', e: '#ff4a1a', f: '#ffa030',
      g: '#ffe08a', m: '#ff4a1a',
    },
    corpo: [
      '..................kkkk..',
      '.................kfffbk.',
      '................kbaaaoak',
      '................kaaaaaak',
      '................kaattttk',
      '....kek.kek.kekkkaakkkk.',
      '...kfffkfffkfffbaaaak...',
      'kkkkkbaaaaaaaaaaaaak....',
      'kbaaaaaeaaaeaaaeaaaadk..',
      'kkkkbaaaaaaaaaaaaddddk..',
      '....kkaaddddddddddk.....',
      '......kaaaaaaaaaak......',
    ],
    pernas: [
      ['.......kaakkaaak........', '.......kaak.kaak........', '......kggak.kaggk.......', '......kkkk...kkkk.......'],
      ['.......kaakkaaak........', '......kaak...kaak.......', '.....kggak...kaggk......', '.....kkkk.....kkkk......'],
    ],
  },

  // ------------------------------------------------- DESERTO leve e arisco
  arenossauro: {
    cores: {
      k: '#3a2a14', a: '#c9a45a', b: '#e8c88a', c: '#9a7a38', d: '#f2e0b0', e: '#a8834a', f: '#d8b46a',
      g: '#fff3d0',
    },
    corpo: [
      '..........kfk..',
      '........kkfffk.',
      '.......kbbbbk..',
      '......kaaoaak..',
      '.....kaaaaakttk',
      '.kkkkkaaaaakkk.',
      'kfkbaaaaaaak...',
      'kffkbaaeaaadk..',
      'kfkkkaaaadddk..',
      '...kaddddddk...',
      '....kaaaaak....',
    ],
    pernas: [
      ['....kaakkaak...', '...kaak..kaak..', '...kggk..kggk..', '...kkk....kkk..'],
      ['....kaakkaak...', '..kaak....kaak.', '..kggk....kggk.', '..kkk......kkk.'],
    ],
  },

  // ------------------------------------------------- DESERTO corcunda das dunas
  dunassauro: {
    cores: {
      k: '#3f2f18', a: '#b08a4a', b: '#d8b06a', c: '#7a5a2a', d: '#e8d8a8', e: '#8a6a30', f: '#e8e0c0',
      g: '#fff3d0',
    },
    corpo: [
      '........kbbbbk....',
      '......kkbaaaabkk..',
      'kfk.kbaaaaaaaaabk.',
      'kfkkbaaaaaeaaaaabk',
      'kaoaaaaaaaaaaaaaak',
      'kattkaaaaaaaaaaak.',
      '.kkk..kddddddddk..',
      '......kaaaaaaak...',
    ],
    pernas: [
      ['.....kaak....kaak.', '.....kaak....kaak.', '.....kggk....kggk.', '.....kkk......kkk.'],
      ['.....kaak....kaak.', '....kaak......kaak', '....kggk......kggk', '....kkk........kkk'],
    ],
  },

  // ------------------------------------------------- DESERTO da tempestade de areia
  tempestossauro: {
    cores: {
      k: '#141826', a: '#4a5570', b: '#6f7d9f', c: '#2f3850', d: '#c0cadf', e: '#8a93b0', f: '#ffe066',
      g: '#fffbe0', m: '#ffe066',
    },
    corpo: [
      '..............kfk..',
      '............kkkfk..',
      '...........kbbbbk..',
      '..........kaaoaak..',
      '.........kaaaaakttk',
      '....kfk..kaaaaak...',
      '..kkfkkkkaaaaaakk..',
      'kkkbaaaaaaaeaaaaadk',
      'kbaaaeaaaaaaaaaaddk',
      'kkkbaaaaaaaaadddk..',
      '..kadddddddddk.....',
      '...kaaaaaaaak......',
    ],
    pernas: [
      ['.....kaakkaaak.....', '.....kaak.kaak.....', '....kggak.kaggk....', '....kkkk...kkkk....'],
      ['.....kaakkaaak.....', '....kaak...kaak....', '...kggak...kaggk...', '...kkkk.....kkkk...'],
    ],
  },

  // ------------------------------------------------- CAVERNA roedor de pedra
  pedrolito: {
    cores: {
      k: '#22201f', a: '#6b6560', b: '#8f8880', c: '#4a4540', d: '#b8b0a4', e: '#3a3632', f: '#a89a7a',
      g: '#d8d0bc',
    },
    corpo: [
      '.......kfk..',
      '.....kkfffk.',
      '...kkkbbbk..',
      '..kbaaoaak..',
      '.kbaaaaakttk',
      'kkaaaaaaaak.',
      'kbaaaeaaaadk',
      'kkkaaddddddk',
      '..kaaaaaaak.',
    ],
    pernas: [
      ['..kaakkaak..', '.kaak..kaak.', '.kggk..kggk.', '.kkk....kkk.'],
      ['..kaakkaak..', 'kaak....kaak', 'kggk....kggk', 'kkk......kkk'],
    ],
  },

  // ------------------------------------------------- CAVERNA escavador palido
  cavernossauro: {
    cores: {
      k: '#1c1a22', a: '#b8b0a0', b: '#d8d2c2', c: '#8a8272', d: '#efe8d4', e: '#9a9282', f: '#c8bfa8',
      g: '#fff6e0',
    },
    corpo: [
      '.....kfk.kfk.kfk..',
      'kkkkkbbbkbbbkbbk..',
      'kbookaaaaaaaaaaak.',
      'kattaaaaaeaaaaaak.',
      'kkkkkaaaaaaaaaaak.',
      '....kadddddddddk..',
      '....kaaaaaaaaak...',
    ],
    pernas: [
      ['....kaak.....kaak.', '....kggk.....kggk.', '....kkk.......kkk.'],
      ['...kaak.......kaak', '...kggk.......kggk', '...kkk.........kkk'],
    ],
  },

  // ------------------------------------------------- GRUTA couracado de geodo
  geodonte: {
    cores: {
      k: '#1a1428', a: '#5a5170', b: '#7d7396', c: '#3a3350', d: '#c0b8d8', e: '#463f60', f: '#c07fff',
      g: '#e6d7ff', m: '#c07fff',
    },
    corpo: [
      '.....kfk..kfk..kfk.',
      '....kfffkkfffkkfffk',
      'kkk..kfk.kaaak.kfk.',
      'kbbkaaaaaaaaaaaaaak',
      'kaoaaaaaeaaaaeaaaak',
      'kattkaaaaaaaaaaaak.',
      '.kkk.kaddddddddk...',
      '.....kaaaaaaaak....',
    ],
    pernas: [
      ['....kaak.....kaak..', '....kaak.....kaak..', '....kggk.....kggk..', '....kkk.......kkk..'],
      ['....kaak.....kaak..', '...kaak.......kaak.', '...kggk.......kggk.', '...kkk.........kkk.'],
    ],
  },

  // ------------------------------------------------- GRUTA palido que some no escuro
  espectrossauro: {
    cores: {
      k: '#252235', a: '#9aa8c0', b: '#c4d0e4', c: '#6a7590', d: '#eaf2ff', e: '#7f8ca8', f: '#dff0ff',
      g: '#ffffff', m: '#dff0ff',
    },
    corpo: [
      '........kkkk...',
      '.......kbbbamk.',
      '......kbaaoaak.',
      '.....kbaaaaaak.',
      '..kkkbaaeaaaekk',
      'kmkaaaaaaaaaak.',
      'kkkaaaeaaaeadk.',
      '.kkkkaaaaaddk..',
      '...kaaddddk....',
      '....kaaaak.....',
    ],
    pernas: [
      ['....kmmk.kmmk..', '.....km...mk...'],
      ['...km.mk.km.mk.', '.....m.....m...'],
    ],
  },

  // ------------------------------------------------- MINA crosta de magma
  escaldossauro: {
    cores: {
      k: '#150c08', a: '#4a352c', b: '#6b4c3c', c: '#2a1c16', d: '#8a6a54', e: '#ff7a2a', f: '#ffc060',
      g: '#ffe0a0', m: '#ff7a2a',
    },
    corpo: [
      '....kek.kek..kek..',
      '...kfffkfffkkfffk.',
      'kkk.kaaaaaaaaaaak.',
      'kbbkaaaaeaaaaeaaak',
      'kaoaaaaaaaaaaaaaak',
      'kattkaaaeaaaaaaak.',
      '.kkk.kaddddddddk..',
      '.....kaaaaaaaak...',
    ],
    pernas: [
      ['....kaak.....kaak.', '....kaak.....kaak.', '....kggk.....kggk.', '....kkk.......kkk.'],
      ['....kaak.....kaak.', '...kaak.......kaak', '...kggk.......kggk', '...kkk.........kkk'],
    ],
  },

  // ------------------------------------------------- MINA cuspidor de brasa
  brasadonte: {
    cores: {
      k: '#1a0a06', a: '#8a3418', b: '#b85228', c: '#521c0e', d: '#f0b070', e: '#ff7a2a', f: '#ffc060',
      g: '#fff0b0', m: '#ffc060',
    },
    corpo: [
      '..........kek.kfk',
      '.......kkkefeffk.',
      '......kbbbbeffk..',
      '.....kaaoaaak....',
      '....kaaaaakttk...',
      '..kkkaaaaakkk....',
      'kkkbaaaaaaaak....',
      'kbaaaeaaaeaaadk..',
      'kkkbaaaaaaadddk..',
      '.kaddddddddk.....',
      '..kaaaaaaak......',
    ],
    pernas: [
      ['..kaakkaak.......', '.kaak..kaak......', '.kggk..kggk......', '.kkk....kkk......'],
      ['..kaakkaak.......', 'kaak....kaak.....', 'kggk....kggk.....', 'kkk......kkk.....'],
    ],
  },

  // ------------------------------------------------- CHEFE da Gruta de Cristal
  cristalodonte: {
    cores: {
      k: '#140f26', a: '#4a5f9e', b: '#6f88cc', c: '#2f3d68', d: '#cfe0ff', e: '#3a4a80', f: '#8fe8ff',
      g: '#ffffff', C: '#dffbff', m: '#8fe8ff',
    },
    corpo: [
      '..............kfk......kfk......kfk..........',
      '.............kfffk....kfffk....kfffk.........',
      '............kfCCCfk..kfCCCfk..kfCCCfk........',
      '...kfk......kfCCCfk..kfCCCfk..kfCCCfk........',
      '..kfffk.....kkfCfkk..kkfCfkk..kkfCfkk........',
      '.kfCCCfkkkkkkkkfkkkkkkkfkkkkkkkfkkkkkkkkk....',
      'kkfCCCfkbbbbbaaaaaaaaaaaaaaaaaaaaaaaaaaabkk..',
      'kbbbkkkkbaaaaaaaaeaaaaaaaaaaeaaaaaaaaaaaaabk.',
      'kbaoabaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaab.',
      'kbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak',
      'kattttkaaaaaaaaeaaaaaaaaaaaaeaaaaaaaaaaaaaaak',
      'kkkkkkkaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak.',
      '.......kadddddddddddddddddddddddddddddddddk..',
      '........kaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak...',
    ],
    pernas: [
      ['..........kaaaak......kaaaak......kaaaak.....', '..........kaaaak......kaaaak......kaaaak.....', '.........kgaaaagk....kgaaaagk....kgaaaagk....', '.........kkkkkkkk....kkkkkkkk....kkkkkkkk....'],
      ['..........kaaaak......kaaaak......kaaaak.....', '.........kaaaak........kaaaak......kaaaak....', '........kgaaaagk......kgaaaagk....kgaaaagk...', '........kkkkkkkk......kkkkkkkk....kkkkkkkk...'],
    ],
  },

  // ------------------------------------------------- CHEFE do Abismo Igneo
  ignivoro: {
    cores: {
      k: '#0d0503', a: '#5a1c10', b: '#8a3018', c: '#2f0d06', d: '#e08a40', e: '#ff4a12', f: '#ffa030',
      g: '#ffe08a', m: '#ff4a12',
    },
    corpo: [
      '.....................................kkkkkkk.',
      '....................................kfffbbbk.',
      '...................................kbaaaaaok.',
      '...................................kbaaaaaak.',
      '...................................kbaatttttk',
      '.......kek....kek....kek....kek.kkkkkaakkkkkk',
      '......kfffk..kfffk..kfffk..kfffkbaaaaaaaak...',
      '.....kkfkkk.kkfkkk.kkfkkk.kkfkkkbaaaaaaak....',
      'kkkkkkbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak.....',
      'kbaaaaaaaeaaaaeaaaaaeaaaaeaaaaaeaaaaaaaadk...',
      'kkkkbaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaddddk..',
      '....kkaaeddddddddddddddddddddddddddddddddk...',
      '......kaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaak.....',
    ],
    pernas: [
      ['.................kaaaaakkkaaaaak.............', '.................kaaaaak.kaaaaak.............', '................kgaaaaak.kaaaaagk............', '................kkkkkkkk.kkkkkkkk............'],
      ['.................kaaaaakkkaaaaak.............', '................kaaaaak...kaaaaak............', '...............kgaaaaak...kaaaaagk...........', '...............kkkkkkkk...kkkkkkkk...........'],
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
