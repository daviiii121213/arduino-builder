/**
 * Arte das cavernas: formações de rocha, veios de minério, sítios de escavação,
 * escadas, guincho e as duas bocas de caverna que aparecem no vale.
 *
 * As formações são reaproveitadas entre os dez andares (é o que dá unidade
 * visual às galerias); o que muda de andar para andar é a mistura, a densidade
 * e os veios de minério. Um minério novo é uma linha em VEIOS.
 */

import { pintar, Pincel, type Paleta, type Sprite } from '../pixel';
import { P } from '../palette';

const PAL: Paleta = {
  '.': null,
  k: P.contorno,
  p: '#6f6e80',
  P: '#8f8ea2',
  S: '#4a495c',
  x: '#0f0d18',
  C: '#8fe8ff',
  c: '#4aa8d0',
  G: '#7fd0a0',
  g: '#4a9a6f',
  o: P.osso,
  O: P.ossoEscuro,
  K: P.ossoEscuro,
  d: '#6b5436',
  D: '#4a3a24',
  t: P.madeira,
  T: P.madeiraClara,
  M: P.metal,
  m: P.metalEscuro,
  f: P.fogo,
  F: P.fogoClaro,
  w: P.brilho,
};

const ESTALAGMITE = [
  '..kk...',
  '.kpPk..',
  '.kpPk..',
  'kppPSk.',
  'kppPSk.',
  'kpppSSk',
  'kkkkkk.',
];

const ESTALAGMITE_G = [
  '...kk....',
  '..kpPk...',
  '..kpPk...',
  '.kppPSk..',
  '.kppPSk..',
  'kpppPSSk.',
  'kpppPSSk.',
  'kppppSSSk',
  'kkkkkkkk.',
];

const ESTALACTITE = [
  'kkkkkkkk.',
  'kpPppppSk',
  'kppPppSSk',
  '.kppPpSk.',
  '.kppPSk..',
  '..kpSk...',
  '..kpSk...',
  '...kk....',
];

const PILAR = [
  'kkkkkk.',
  'kpPppSk',
  'kpPppSk',
  '.kpPpSk',
  '.kpPpSk',
  '.kpPpSk',
  'kpPppSk',
  'kpPppSk',
  'kkkkkk.',
];

const PEDREGULHO = [
  '...kkkkk...',
  '..kpPPppk..',
  '.kpPPpppSk.',
  'kpPPppppSSk',
  'kppppppSSSk',
  'kpppppSSSSk',
  '.kppSSSSSk.',
  '..kkSSSkk..',
  '....kkk....',
];

const CRISTAIS = [
  '...kk.....',
  '..kCCk.kk.',
  '..kCck.kCk',
  '.kCcck.kCk',
  '.kCcckkCck',
  'kCccccCcck',
  'kcccccccck',
  '.kkkkkkkk.',
];

const COGUMELO_CAVERNA = [
  '..kkkk..',
  '.kGgGgk.',
  'kGggggGk',
  'kgggggGk',
  '.kkooKk.',
  '..kook..',
  '..kook..',
  '..kkkk..',
];

const OSSADA = [
  '.kk......kk.',
  'kook....kook',
  'kooook..kook',
  '.kooooooook.',
  '.kOooooooOk.',
  'kOook..kOook',
  '.kk......kk.',
];

const SITIO_FOSSIL = [
  '....kk...kk....',
  '...kook.kook...',
  '..kdookdkookd..',
  '.kdddookoodddk.',
  'kddddddddddddSk',
  'kdDddddddddDdSk',
  '.kddDdddddDddk.',
  '..kkddddddkk...',
  '....kkkkkk.....',
];

const SITIO_CAVADO = [
  '...kkkkkkk...',
  '..kSSSSSSSk..',
  '.kSxxxxxxxSk.',
  'kSxxxxxxxxxSk',
  '.kSxxxxxxxSk.',
  '..kSSSSSSSk..',
  '...kkkkkkk...',
];

const ENTULHO_CAVERNA = [
  '..kk...kk..',
  '.kpPk.kpSk.',
  'kpPppkppSSk',
  'kppppppSSSk',
  '.kkppSSSkk.',
  '...kkkkk...',
];




const TOCHA_A = [
  '..ff..',
  '.fFFf.',
  'ffFwFf',
  '.fFFf.',
  '..kk..',
  '..ktk.',
  '..ktk.',
  '..kkk.',
];

const TOCHA_B = [
  '..ff..',
  '.ffFf.',
  'fFwFFf',
  '.fFff.',
  '..kk..',
  '..ktk.',
  '..ktk.',
  '..kkk.',
];

const BOCA_GRUTA = [
  '.....kkkkkkkkkkkkkk.....',
  '...kkpPPppppppppPPpkk...',
  '..kpPPppppppppppppPPpk..',
  '.kpPPppCCppppppppCCpPpk.',
  'kpPppppCcppkkkkppCcppSSk',
  'kpPpppppppkxxxxkppppSSSk',
  'kpppppppkxxxxxxxxkppSSSk',
  'kppppppkxxxxxxxxxxkpSSSk',
  'kpppCcpkxxxxxxxxxxkpCcSk',
  'kppppppkxxxxxxxxxxkpSSSk',
  'kppppppkxxxxxxxxxxkpSSSk',
  'kSppppSkxxxxxxxxxxkSSSSk',
  'kSSSSSSkxxxxxxxxxxkSSSSk',
  'kSSSSSSkxxxxxxxxxxkSSSSk',
  'kkkkkkkkxxxxxxxxxxkkkkkk',
];

const BOCA_MINA = [
  '.....kkkkkkkkkkkkkk.....',
  '...kkpPPppppppppPPpkk...',
  '..kpPPppppppppppppPPpk..',
  '.kpPPpptTttttttttTpPpk..',
  'kpPppptTttttttttttTpSSk.',
  'kpPpppTtkkkkkkkkkkTpSSSk',
  'kppppptTkxxxxxxxxkTpSSSk',
  'kpppppTtkxxxxxxxxkTpSSSk',
  'kppfFppkxxxxxxxxxxkpSSSk',
  'kppppppkxxxxxxxxxxkpffSk',
  'kppppppkxxxxxxxxxxkpSSSk',
  'kSppppSkxxxxxxxxxxkSSSSk',
  'kSSSSSSkxxxxxxxxxxkSSSSk',
  'kSSSSSSkxxxxxxxxxxkSSSSk',
  'kkkkkkkkxxxxxxxxxxkkkkkk',
];

const PLACA_CAVERNA = [
  'kkkkkkkkkkk',
  'kTttttttttk',
  'ktDDttDDttk',
  'kttDttDtttk',
  'kTttttttttk',
  'kkkkDDkkkkk',
  '...kDDk....',
  '...kkkk....',
];

const MOLDE_VEIO = [
  '.....kkkkkk.....',
  '...kkpPppppkk...',
  '..kpPpp11pppSk..',
  '.kpPpp1221ppSSk.',
  'kpPppp1221pSSSSk',
  'kppp11ppppSSSSSk',
  'kpp1221pp11pSSSk',
  'kpp1221p1221SSSk',
  '.kpp11pp1221SSk.',
  '..kkppp11pSSkk..',
  '....kkkkkkkk....',
];

const MOLDE_GEODO = [
  '....kkkkkk....',
  '..kkpPPppSkk..',
  '.kpPpkkkkpSSk.',
  'kpPpk1221kSSSk',
  'kppk122221kSSk',
  'kppk122221kSSk',
  'kpPpk1221kpSSk',
  '.kppkkkkkppSk.',
  '..kkppppSSkk..',
  '....kkkkkk....',
];

/** Um veio de minério: o mesmo bloco de rocha com a gema em outra cor. */
export type VeioId =
  | 'pedra'
  | 'carvao'
  | 'cobre'
  | 'prata'
  | 'ouro'
  | 'obsidiana'
  | 'ametista'
  | 'rubi'
  | 'diamante'
  | 'astralita'
  | 'nucleo';

export interface ArteCaverna {
  estalagmite: Sprite;
  estalagmiteG: Sprite;
  estalactite: Sprite;
  pilar: Sprite;
  pedregulho: Sprite;
  cristais: Sprite;
  cogumeloCaverna: Sprite;
  ossada: Sprite;
  sitioFossil: Sprite;
  sitioCavado: Sprite;
  entulhoCaverna: Sprite;
  escadaBaixo: Sprite;
  escadaCima: Sprite;
  elevador: Sprite;
  bocaGruta: Sprite;
  bocaMina: Sprite;
  placaCaverna: Sprite;
  /** Tocha da parede, dois quadros. */
  tocha: Sprite[];
  /** Bloco de minério, um por tipo. */
  veios: Record<VeioId, Sprite>;
  /** Halo de luz das tochas e do guincho. */
  halo: Sprite;
}

/** Halo redondo e suave, usado como fonte de luz dentro da caverna. */
function halo(raio: number, cor: string): Sprite {
  const d = raio * 2 + 1;
  const p = new Pincel(d, d);
  for (let y = 0; y < d; y++) {
    for (let x = 0; x < d; x++) {
      const dd = Math.hypot(x - raio, y - raio) / raio;
      if (dd <= 1) p.ponto(x, y, cor, 0.5 * (1 - dd) * (1 - dd));
    }
  }
  return p.finalizar();
}


/**
 * Escada da galeria. Para baixo ela afunda no escuro em degraus cada vez mais
 * fundos; para cima ela sobe em degraus claros. A seta no topo é o que faz o
 * jogador entender o que é aquilo sem precisar de texto na tela.
 */
function escada(descendo: boolean): Sprite {
  const W = 26;
  const H = 20;
  const p = new Pincel(W, H);
  // moldura de pedra
  p.retangulo(0, 2, W, H - 2, '#4a495c');
  p.contorno(0, 2, W, H - 2, P.contorno);
  const degraus = 5;
  for (let i = 0; i < degraus; i++) {
    const margem = 2 + i * 2;
    const topo = 4 + i * 3;
    const alt = 3;
    // descendo: escurece até o breu; subindo: clareia até quase branco
    const claro = descendo
      ? [ '#6f6e80', '#57566a', '#3f3e50', '#28283a', '#11101c' ][i]
      : [ '#4a495c', '#63627a', '#7c7b94', '#9695ae', '#b0afc8' ][i];
    p.retangulo(margem, topo, W - margem * 2, alt, claro);
    p.linha(margem, topo, W - margem - 1, topo, P.contorno);
  }
  // seta indicando o sentido
  const cor = descendo ? '#ffc75a' : '#cfe4ff';
  const cy = descendo ? 4 : H - 6;
  for (let i = 0; i < 4; i++) {
    const d = descendo ? i : -i;
    p.linha(W / 2 - 3 + i, cy + d, W / 2 + 3 - i, cy + d, cor);
  }
  return p.finalizar();
}

/** Guincho: plataforma de madeira pendurada em duas correntes. */
function guincho(): Sprite {
  const W = 26;
  const H = 26;
  const p = new Pincel(W, H);
  // correntes
  for (const x of [6, W - 7]) {
    for (let y = 0; y < H - 8; y++) {
      p.ponto(x, y, y % 2 === 0 ? P.metal : P.metalEscuro);
    }
  }
  // travessa de cima
  p.retangulo(4, 0, W - 8, 3, P.metalEscuro);
  p.retangulo(5, 1, W - 10, 1, P.metal);
  p.contorno(4, 0, W - 8, 3, P.contorno);
  // plataforma
  p.retangulo(1, H - 8, W - 2, 6, P.madeira);
  for (let x = 2; x < W - 2; x += 4) p.linha(x, H - 8, x, H - 3, P.madeiraEscura);
  p.linha(1, H - 8, W - 2, H - 8, P.madeiraClara);
  p.contorno(1, H - 8, W - 2, 6, P.contorno);
  // lampião preso na travessa
  p.retangulo(W / 2 - 2, 3, 4, 5, P.metalEscuro);
  p.retangulo(W / 2 - 1, 4, 2, 3, P.ambar);
  p.ponto(W / 2 - 1, 4, P.brilho);
  return p.finalizar();
}

export function criarCaverna(): ArteCaverna {
  return {
    estalagmite: pintar(ESTALAGMITE, PAL),
    estalagmiteG: pintar(ESTALAGMITE_G, PAL),
    estalactite: pintar(ESTALACTITE, PAL),
    pilar: pintar(PILAR, PAL),
    pedregulho: pintar(PEDREGULHO, PAL),
    cristais: pintar(CRISTAIS, PAL),
    cogumeloCaverna: pintar(COGUMELO_CAVERNA, PAL),
    ossada: pintar(OSSADA, PAL),
    sitioFossil: pintar(SITIO_FOSSIL, PAL),
    sitioCavado: pintar(SITIO_CAVADO, PAL),
    entulhoCaverna: pintar(ENTULHO_CAVERNA, PAL),
          bocaGruta: pintar(BOCA_GRUTA, PAL),
    bocaMina: pintar(BOCA_MINA, PAL),
    placaCaverna: pintar(PLACA_CAVERNA, PAL),
    escadaBaixo: escada(true),
    escadaCima: escada(false),
    elevador: guincho(),
    tocha: [pintar(TOCHA_A, PAL), pintar(TOCHA_B, PAL)],
    veios: {
    pedra: pintar(MOLDE_VEIO, { ...PAL, '1': '#c2c4d2', '2': '#9092a2', '3': '#5f6070' }),
    carvao: pintar(MOLDE_VEIO, { ...PAL, '1': '#5a5560', '2': '#2a262e', '3': '#141218' }),
    cobre: pintar(MOLDE_VEIO, { ...PAL, '1': '#e08a4a', '2': '#b4602a', '3': '#6f3616' }),
    prata: pintar(MOLDE_VEIO, { ...PAL, '1': '#eef2f7', '2': '#b8c0cc', '3': '#79828f' }),
    ouro: pintar(MOLDE_VEIO, { ...PAL, '1': '#fff0a0', '2': '#f0c040', '3': '#a87a18' }),
    obsidiana: pintar(MOLDE_VEIO, { ...PAL, '1': '#6a5c8a', '2': '#2f2740', '3': '#171320' }),
    ametista: pintar(MOLDE_GEODO, { ...PAL, '1': '#e0b4ff', '2': '#a56bff', '3': '#5a2f9e' }),
    rubi: pintar(MOLDE_GEODO, { ...PAL, '1': '#ffb0a8', '2': '#e0403f', '3': '#7a1a1c' }),
    diamante: pintar(MOLDE_GEODO, { ...PAL, '1': '#ffffff', '2': '#bfeaf7', '3': '#5f9ec0' }),
    astralita: pintar(MOLDE_GEODO, { ...PAL, '1': '#e6fbff', '2': '#5ad8ff', '3': '#1f6fb0' }),
    nucleo: pintar(MOLDE_GEODO, { ...PAL, '1': '#ffe08a', '2': '#ff6a2a', '3': '#8a2410' }),
    },
    halo: halo(22, P.fogoClaro),
  };
}
