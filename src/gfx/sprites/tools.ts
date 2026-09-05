/**
 * Ferramentas, recursos e moedas — arte desenhada à mão.
 *
 * Cada ferramenta tem três níveis (pedra, ferro e cristal). O desenho é o
 * mesmo, mas a paleta da cabeça muda e o nível de cristal ganha faíscas: a
 * melhoria comprada na cabana aparece na hora, na mão do jogador e no
 * inventário.
 */

import { pintar, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

export type FerramentaId = 'machado' | 'picareta' | 'pa' | 'enxada';
export type RecursoId =
  | 'madeira'
  | 'pedra'
  | 'ferro'
  | 'cristal'
  | 'argila'
  | 'fibra'
  | 'osso'
  | 'fossil'
  | 'semente'
  // ---- recursos nativos dos biomas
  | 'essencia'
  | 'turfa'
  | 'resina'
  | 'obsidiana'
  | 'enxofre'
  | 'vidro';

/** Paletas das cabeças, por nível de melhoria. */
const MATERIAIS = [
  { H: '#9a9382', h: '#c2bba6', D: '#6b6555', m: null }, // pedra lascada
  { H: '#b9c0cc', h: '#e9eef5', D: '#79828f', m: null }, // ferro forjado
  { H: '#8fd8e8', h: '#dff7ff', D: '#4a9ec0', m: '#bff2ff' }, // cristal do vale
] as const;

export const NOME_MATERIAL = ['Pedra', 'Ferro', 'Cristal'] as const;

function paletaFerramenta(nivel: number): Paleta {
  const mat = MATERIAIS[Math.min(MATERIAIS.length - 1, Math.max(0, nivel))];
  return {
    '.': null,
    k: P.contorno,
    t: P.madeira,
    T: P.madeiraClara,
    d: P.madeiraEscura,
    H: mat.H,
    h: mat.h,
    D: mat.D,
    m: mat.m,
  };
}

/** Machado: cabeça larga de um lado só. */
const MACHADO = [
  '.........kkkk...',
  '........kHHHHk.m',
  '.......kHhHHHDk.',
  '......kHhHHHHDk.',
  '.....kkHHHHHDk..',
  '....kTtkHHHDkm..',
  '...kTtkkkkkk....',
  '..kTtk..........',
  '..kttk..........',
  '.kTtk...........',
  '.kttk...........',
  'kTtk............',
  'kttk............',
  'kkk.............',
];

/** Picareta: duas pontas simétricas. */
const PICARETA = [
  '..kk........kk..',
  '.kHDk......kDHk.',
  'kHhHDk....kDHhHk',
  'kHhHHDkkkkDHHhHk',
  '.kHHHHTttTHHHHk.',
  'm.kkkkkTtkkkkk.m',
  '.......kTtk.....',
  '.......kttk.....',
  '.......kTtk.....',
  '......kkttk.....',
  '......kTttk.....',
  '......kkkkk.....',
];

/** Pá: cabo comprido e lâmina redonda. */
const PA = [
  '.......kk.......',
  '......kTtk......',
  '......kTtk......',
  '......kttk......',
  '......kTtk......',
  '.....kkttkk.....',
  'm...kHHHHHHk...m',
  '...kHhHHHHHDk...',
  '...kHhHHHHHDk...',
  '...kHHHHHHHDk...',
  '....kHHHHHDk....',
  '.....kHHHDk.....',
  '......kkkk......',
];

/** Enxada: lâmina virada para o chão. */
const ENXADA = [
  '..........kk....',
  '.........kTtk..m',
  '.........kttk...',
  '........kTtk....',
  '.......kttk.....',
  '......kTtk......',
  '.....kttk.......',
  '....kTtk........',
  'kkkkkHtk........',
  'kHHHHHHk........',
  'kHhHHHDk........',
  'kHHHHDk.....m...',
  'kkkkkk..........',
];

const DESENHOS: Record<FerramentaId, string[]> = {
  machado: MACHADO,
  picareta: PICARETA,
  pa: PA,
  enxada: ENXADA,
};

// ------------------------------------------------------------------ recursos

const PAL_RECURSO: Paleta = {
  '.': null,
  k: P.contorno,
  t: P.tronco,
  T: P.troncoLuz,
  O: '#3f2a17',
  p: P.pedra,
  P: P.pedraClara,
  S: P.pedraEscura,
  F: '#e6dcc4',
  f: P.folha,
  G: P.folhaClara,
  N: '#a8552f',
  n: '#7d3c1f',
  o: P.osso,
  W: P.brilho,
  A: P.ambar,
  a: P.ambarEscuro,
  m: P.magia,
  M: P.magiaClara,
  y: P.florAmarela,
  // ---- tons dos recursos de bioma
  e: '#5ad8c8',
  E: '#b8fff2',
  u: '#4a3a24',
  U: '#6b5436',
  r: '#d89a3a',
  R: '#ffd680',
  b: '#241c2e',
  B: '#4a3c62',
  x: '#d8c23a',
  X: '#fff08a',
  v: '#8fd8e8',
  V: '#e6fbff',
};

const R_MADEIRA = [
  '...kkkkkkkk...',
  '..kTttttttTk..',
  '.kTtOtttOttTk.',
  'kTttttttttttTk',
  '.kTttttttttTk.',
  '..kkkkkkkkkk..',
  '...kkkkkkkk...',
  '..kTttttttTk..',
  '.kTtOtttOttTk.',
  'kTttttttttttTk',
  '.kTttttttttTk.',
  '..kkkkkkkkkk..',
];

const R_PEDRA = [
  '....kkkkk.....',
  '..kkPPPppkk...',
  '.kPPPpppppSk..',
  'kPPpppppppSSk.',
  'kPppppppSSSSk.',
  '.kppppSSSSSk..',
  '..kkpSSSSkk...',
  '....kkkkk.....',
];

const R_FERRO = [
  '....kkkkk.....',
  '..kkPPPppkk...',
  '.kPPFppFpSk...',
  'kPPpFFpppSSk..',
  'kPppppFFSSSk..',
  '.kpFFpSSSSk...',
  '..kkpSSSSkk...',
  '....kkkkk.....',
];

const R_CRISTAL = [
  '....kk....',
  '...kMMk...',
  '..kMMmmk..',
  '..kMmmmk..',
  '.kMmmmmmk.',
  '.kmmmmmmk.',
  '.kmmmmmmk.',
  '..kmmmmk..',
  '..kmmmk...',
  '...kkk....',
];

const R_ARGILA = [
  '....kkkkk...',
  '..kkNNNNNkk.',
  '.kNNnNNNNNk.',
  'kNNNNNNnNNNk',
  'kNnNNNNNNNNk',
  '.kNNNNnNNNk.',
  '..kkNNNNkk..',
  '....kkkkk...',
];

const R_FIBRA = [
  '..k...k..k..',
  '.kGk.kGk.kGk',
  '.kGkkkGkkkGk',
  '..kGfGfGfGk.',
  '...kfffffk..',
  '....kfffk...',
  '.....kkk....',
];

const R_OSSO = [
  '.kk......kk.',
  'kook....kook',
  'kooook..kook',
  '.kooooooook.',
  '.kooooooook.',
  'kooook..kook',
  'kook....kook',
  '.kk......kk.',
];

const R_FOSSIL = [
  '..kkkkkkkk..',
  '.kPPppppppk.',
  'kPpooppoopk.',
  'kPpoooooopk.',
  'kppooppooppk',
  'kpppoooopppk',
  '.kppppppppk.',
  '..kkkkkkkk..',
];

const R_SEMENTE = [
  '...kk..kk...',
  '..kyGkkyGk..',
  '..kGfkkGfk..',
  '...kk..kk...',
  '.kk..kk..kk.',
  'kyGkkyGkkyGk',
  'kGfkkGfkkGfk',
  '.kk..kk..kk.',
];

const MOEDA = [
  '..kkkk..',
  '.kAAAAk.',
  'kAaWWaAk',
  'kAWaaWAk',
  'kAWaaWAk',
  'kAaWWaAk',
  '.kAAAAk.',
  '..kkkk..',
];

const SACO_MOEDAS = [
  '....kkk....',
  '...kdtdk...',
  '..kkkkkkk..',
  '.kAAAAAAAk.',
  'kAWAAAAAWAk',
  'kAAAaaaAAAk',
  'kAWAaAaAWAk',
  'kAAAAAAAAAk',
  '.kAAAAAAAk.',
  '..kkkkkkk..',
];


// ---- recursos nativos dos biomas

const R_ESSENCIA = [
  '...kkk....',
  '..kEEEk...',
  '.kEeeeEk..',
  'kEeeeeeEk.',
  'kEeeeeeEk.',
  'kEeeeeeEk.',
  '.kEeeeEk..',
  '..kEeEk...',
  '...kkk....',
];

const R_TURFA = [
  '..kkkkkk..',
  '.kUUuuUUk.',
  'kUuuUuuuUk',
  'kUuufuuUUk',
  'kUUuuuUuuk',
  '.kUuuUUuk.',
  '..kkkkkk..',
];

const R_RESINA = [
  '....kk....',
  '...kRRk...',
  '..kRrrRk..',
  '.kRrrrrRk.',
  '.kRrrrrrk.',
  '.kRrrrrrk.',
  '..kRrrrk..',
  '...kkkk...',
];

const R_OBSIDIANA = [
  '...kkk....',
  '..kBBBk...',
  '.kBbbbBk..',
  'kBbbbbbBk.',
  'kBbbbbbbk.',
  '.kbbBbbbk.',
  '..kbbbbk..',
  '...kkkk...',
];

const R_ENXOFRE = [
  '..kkk.kk..',
  '.kXxk.kXk.',
  'kXxxxkxxk.',
  'kxxxxXxxxk',
  '.kxxxxxxk.',
  '..kxxxxk..',
  '...kkkk...',
];

const R_VIDRO = [
  '....kk....',
  '...kVVk...',
  '..kVvvVk..',
  '.kVvvvvVk.',
  'kVvvvvvvVk',
  '.kvvvvvvk.',
  '..kvvvvk..',
  '...kkkk...',
];

const DESENHOS_RECURSO: Record<RecursoId, string[]> = {
  madeira: R_MADEIRA,
  pedra: R_PEDRA,
  ferro: R_FERRO,
  cristal: R_CRISTAL,
  argila: R_ARGILA,
  fibra: R_FIBRA,
  osso: R_OSSO,
  fossil: R_FOSSIL,
  semente: R_SEMENTE,
  essencia: R_ESSENCIA,
  turfa: R_TURFA,
  resina: R_RESINA,
  obsidiana: R_OBSIDIANA,
  enxofre: R_ENXOFRE,
  vidro: R_VIDRO,
};

export interface ArteFerramentas {
  /** Uma entrada por nível (0 = pedra, 1 = ferro, 2 = cristal). */
  ferramentas: Record<FerramentaId, Sprite[]>;
  recursos: Record<RecursoId, Sprite>;
  moeda: Sprite;
  sacoMoedas: Sprite;
}

export function criarFerramentas(): ArteFerramentas {
  const ferramentas = {} as Record<FerramentaId, Sprite[]>;
  for (const id of Object.keys(DESENHOS) as FerramentaId[]) {
    ferramentas[id] = MATERIAIS.map((_, nivel) => pintar(DESENHOS[id], paletaFerramenta(nivel)));
  }
  const recursos = {} as Record<RecursoId, Sprite>;
  for (const id of Object.keys(DESENHOS_RECURSO) as RecursoId[]) {
    recursos[id] = pintar(DESENHOS_RECURSO[id], PAL_RECURSO);
  }
  return {
    ferramentas,
    recursos,
    moeda: pintar(MOEDA, PAL_RECURSO),
    sacoMoedas: pintar(SACO_MOEDAS, { ...PAL_RECURSO, d: P.madeiraEscura, t: P.madeira }),
  };
}
