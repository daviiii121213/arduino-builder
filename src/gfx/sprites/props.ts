/**
 * Vegetação, pedras, ossos e outros objetos do cenário pré-histórico.
 * Todos desenhados à mão, com contorno escuro e sombreamento em duas luzes.
 */

import { pintar, Pincel, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';
import { Rng } from '../../core/rng';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  t: P.tronco,
  T: P.troncoLuz,
  f: P.folha,
  F: P.folhaClara,
  d: P.folhaEscura,
  s: P.samambaia,
  p: P.pedra,
  P: P.pedraClara,
  S: P.pedraEscura,
  o: P.osso,
  O: P.ossoEscuro,
  m: P.magia,
  M: P.magiaClara,
  r: P.flor,
  R: '#ff9fbf',
  y: P.florAmarela,
  w: '#fff6e0',
  C: '#c94a4a',
  a: P.aguaEspuma,
};

const ARAUCARIA = [
  '..........kk..........',
  '.........kFfk.........',
  '........kFffdk........',
  '.......kFfffddk.......',
  '......kkFfffddkk......',
  '........kFffdk........',
  '.......kFffffdk.......',
  '......kFfffffddk......',
  '.....kkFfffffddkk.....',
  '.......kFffffdk.......',
  '......kFfffffddk......',
  '.....kFfffffffddk.....',
  '....kkFfffffffddkk....',
  '......kFfffffddk......',
  '.....kFfffffffddk.....',
  '...kFfffffffffdddk....',
  '..kkFfffffffffdddkk...',
  '.....kFfffffffdk......',
  '...kFfffffffffdddk....',
  '.kkFfffffffffffdddkk..',
  '......kkkkTtkkkk......',
  '..........kTtk........',
  '..........kTtk........',
  '.........kkTttk.......',
  '........kTtttttk......',
  '.......kkttkkkttk.....',
];

/**
 * Cicadácea (samambaia-arbórea): tronco escamoso e uma coroa de folhas
 * compostas. Desenhada com traços radiais — cada folha tem nervura e folíolos.
 */
function desenharCicadacea(): Sprite {
  const W = 28;
  const H = 28;
  const p = new Pincel(W, H);
  const rng = new Rng(4711);
  const cx = W / 2;
  const baseTronco = H - 1;
  const topo = 15;

  // tronco escamoso
  for (let y = topo; y <= baseTronco; y++) {
    const larg = 2 + Math.floor((y - topo) / 7);
    for (let x = -larg; x <= larg; x++) {
      const cor = x < -larg + 1 ? P.tronco : x > larg - 1 ? '#4a2f1c' : P.troncoLuz;
      p.ponto(cx + x, y, cor);
    }
    // marcas em "V" das folhas antigas
    if ((y - topo) % 3 === 0) {
      p.ponto(cx - larg + 1, y, '#4a2f1c');
      p.ponto(cx + larg - 1, y, '#4a2f1c');
      p.ponto(cx, y, '#4a2f1c');
    }
    p.ponto(cx - larg, y, P.contorno);
    p.ponto(cx + larg, y, P.contorno);
  }
  p.linha(cx - 4, baseTronco, cx + 4, baseTronco, P.contorno);

  // coroa de folhas
  const angulos = [-3.0, -2.7, -2.4, -2.1, -1.8, -1.5, -1.2, -0.9, -0.6, -0.3, -0.05];
  for (const ang of angulos) {
    const comp = 12 + rng.int(0, 2);
    const claro = Math.cos(ang) < 0;
    for (let t = 0; t < comp; t++) {
      // a folha arqueia para baixo nas pontas
      const queda = (t / comp) * (t / comp) * 5;
      const x = cx + Math.cos(ang) * t;
      const y = topo + Math.sin(ang) * t * 0.75 + queda + 1;
      p.ponto(x, y, P.folhaEscura);
      p.ponto(x, y - 1, claro ? P.folhaClara : P.folha);
      // folíolos
      if (t > 2 && t % 2 === 0) {
        const nx = -Math.sin(ang);
        const ny = Math.cos(ang);
        const tam = 1 + Math.round((1 - t / comp) * 3);
        for (let k = 1; k <= tam; k++) {
          p.ponto(x + nx * k, y + ny * k, claro ? P.folha : P.folhaEscura);
          p.ponto(x - nx * k, y - ny * k, claro ? P.folhaClara : P.folha);
        }
      }
    }
  }
  return p.finalizar();
}

const ARBUSTO = [
  '.....kkkkk....',
  '...kkfFFfdkk..',
  '..kfFFffffdk..',
  '.kfFffffffddk.',
  'kfFfffffffdddk',
  'kffffffffdddrk',
  'kfffffffddddkk',
  '.kffffffdddk..',
  '..kkffdddkk...',
  '....kkkkk.....',
];

const SAMAMBAIA = [
  '...k......k...',
  '..ksk....ksk..',
  '.kssk.k..kssk.',
  '.kffkksk.kffk.',
  '..kfkkfkkkfk..',
  '...kkfffkkk...',
  '....kdffdk....',
  '.....kddk.....',
  '......kk......',
];

const PEDRA_GRANDE = [
  '.....kkkkkk.....',
  '...kkPPPPPpkk...',
  '..kPPPfPppppfk..',
  '.kPPPpppppppSSk.',
  'kPPppppppppSSSSk',
  'kPpppkppSSSSSSSk',
  'kppppppSkSSSSSSk',
  '.kpppSSSSkSSSSk.',
  '..kkpSSSSSSSkk..',
  '....kkkkkkkk....',
];

const PEDRA_PEQUENA = [
  '..kkkk..',
  '.kPPppk.',
  'kPppppSk',
  'kpppSSSk',
  '.kkSSkk.',
];

const CAVEIRA = [
  '.....kkkkkkkkkk...',
  '...kkooooooooooOk.',
  '..kooooooooooooOOk',
  '.kooookkkooooooooOk',
  '.koookkkkkoooooooOk',
  '.kooookkkoooooooOOk',
  '.kooooooooooooooOk.',
  '..koooOkOkOkOkkkk..',
  '...kkkkkkkkkkk.....',
];

const COSTELAS = [
  '...kk....kk....kk....kk...',
  '..kOok..kOok..kOok..kOok..',
  '.kOookkkOookkkOookkkOook..',
  'kOooOkkkOooOkkOooOkkOooOk.',
  'kooooooooooooooooooooooook',
  'kOOOOOOOOOOOOOOOOOOOOOOOOk',
  '.kkkkkkkkkkkkkkkkkkkkkkkk.',
];

const TRONCO_CAIDO = [
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kTtttttttttttttttttTk..',
  'kTttTtttttTttttttTttttk.',
  'kttttttttttttttttttttk..',
  'kTttttTttttttttTtttttk..',
  '.kkkkkkkkkkkkkkkkkkkk...',
];

const TRONCO_MUSGO = [
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kFffkTttttFfffttttTk...',
  'kTttTtttttTttttttTttttk.',
  'kttttttttttttttttttttk..',
  'kTttttTttttttttTtttttk..',
  '.kkkkkkkkkkkkkkkkkkkk...',
];

const COGUMELO = [
  '..kkkk..',
  '.kCCCCk.',
  'kCCwCCCk',
  'kCCCCCCk',
  '.kkookk.',
  '...kok..',
  '...kok..',
  '...kkk..',
];

const JUNCO = [
  '..k...k...',
  '.kFk.kFk..',
  '.kFk.kFk..',
  '.kFk.kFk..',
  '.kfk.kfk..',
  '.kfkkkfk..',
  '..kfffk...',
  '...kkk....',
];

const CRISTAL = [
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

const FLOR = [
  '..kk..',
  '.krrk.',
  'krrRrk',
  '.krrk.',
  '..kfk.',
  '..kfk.',
  '.kffk.',
  '..kk..',
];

const FLOR_AMARELA = [
  '..kk..',
  '.kyyk.',
  'kyywyk',
  '.kyyk.',
  '..kfk.',
  '..kfk.',
  '.kffk.',
  '..kk..',
];

const NENUFAR = [
  '..kkkk..',
  '.kfffFk.',
  'kfFfffFk',
  'kffffffk',
  '.kfkkffk',
  '..kkkkk.',
];

export interface ArteCenario {
  araucaria: Sprite;
  cicadacea: Sprite;
  arbusto: Sprite;
  samambaia: Sprite;
  pedraGrande: Sprite;
  pedraPequena: Sprite;
  caveira: Sprite;
  costelas: Sprite;
  troncoCaido: Sprite;
  troncoMusgo: Sprite;
  cogumelo: Sprite;
  junco: Sprite;
  cristal: Sprite;
  flor: Sprite;
  florAmarela: Sprite;
  nenufar: Sprite;
}

export function criarCenario(): ArteCenario {
  return {
    araucaria: pintar(ARAUCARIA, PAL),
    cicadacea: desenharCicadacea(),
    arbusto: pintar(ARBUSTO, PAL),
    samambaia: pintar(SAMAMBAIA, PAL),
    pedraGrande: pintar(PEDRA_GRANDE, PAL),
    pedraPequena: pintar(PEDRA_PEQUENA, PAL),
    caveira: pintar(CAVEIRA, PAL),
    costelas: pintar(COSTELAS, PAL),
    troncoCaido: pintar(TRONCO_CAIDO, PAL),
    troncoMusgo: pintar(TRONCO_MUSGO, PAL),
    cogumelo: pintar(COGUMELO, PAL),
    junco: pintar(JUNCO, PAL),
    cristal: pintar(CRISTAL, PAL),
    flor: pintar(FLOR, PAL),
    florAmarela: pintar(FLOR_AMARELA, PAL),
    nenufar: pintar(NENUFAR, PAL),
  };
}
