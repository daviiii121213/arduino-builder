/**
 * Dados das cavernas: quem mora em cada andar, o que se minera nele e como o
 * andar deve parecer.
 *
 * Só dados — nada aqui desenha nem gera mapa. É por isso que uma caverna nova
 * (ou um andar novo, ou um minério novo) entra acrescentando uma ficha aqui,
 * sem tocar no gerador nem na cena de jogo.
 */

import type { EspecieId } from '../gfx/sprites/dinos';
import type { RecursoId } from '../gfx/sprites/tools';
import type { NomeNo } from './nodes';
import type { ArmaduraId } from '../gfx/sprites/armor';

export type CavernaId = 'gruta' | 'mina';

/** Toda caverna tem exatamente dez andares. */
export const ANDARES = 10;

/** Formato do andar: muda o traçado das salas e dos corredores. */
export type Tracado = 'galerias' | 'cavernoso' | 'fenda' | 'labirinto' | 'salao';

/** Uma entrada da tabela de minérios: um nó de recurso com peso de sorteio. */
export interface PesoNo {
  no: NomeNo;
  peso: number;
}

/** Uma entrada da tabela de criaturas. */
export interface PesoEspecie {
  especie: EspecieId;
  peso: number;
}

export interface RecompensaChefe {
  moedas: number;
  itens: { id: RecursoId; quantidade: number }[];
  /** Item único que fica com o jogador para sempre. */
  premio: 'lanterna' | ArmaduraId;
  nomePremio: string;
  texto: string;
}

export interface FichaCaverna {
  id: CavernaId;
  nome: string;
  /** Nome curto usado no HUD e no bestiário. */
  curto: string;
  descricao: string;
  /** Cor da caverna no bestiário, na coleção e no diário. */
  cor: string;
  /** Tinta do ar, por cima da cena. */
  tinta: { cor: string; alpha: number };
  /** Escuridão base (0 = claro, 1 = breu). Cresce com a profundidade. */
  escuridao: number;
  /** Cor da luz da lanterna do jogador. */
  corLuz: string;
  /** Partículas do ar (pó em suspensão, faísca, brasa). */
  poeira: string[];
  /** Zumbido de fundo. */
  som: { freq: number; tipo: OscillatorType; ganho: number; corte: number };
  /** Semente base — dois andares nunca saem iguais. */
  semente: number;
  chefe: EspecieId;
  recompensa: RecompensaChefe;
  /** Nome do andar, para o HUD. */
  nomeAndar(andar: number): string;
  /** Traçado do andar. */
  tracado(andar: number): Tracado;
  /** Minérios disponíveis no andar (sorteados por peso). */
  minerios(andar: number): PesoNo[];
  /** Criaturas que aparecem no andar. */
  criaturas(andar: number): PesoEspecie[];
}

/** Quantos bichos nascem num andar — cresce com a profundidade. */
export function populacaoDoAndar(andar: number): number {
  return 3 + Math.floor(andar / 2);
}

/** Quantos nós de recurso o andar recebe. */
export function riquezaDoAndar(andar: number): number {
  return 14 + andar * 2;
}

export const CAVERNAS: Record<CavernaId, FichaCaverna> = {
  // ================================================== GRUTA DE CRISTAL
  gruta: {
    id: 'gruta',
    nome: 'Gruta de Cristal',
    curto: 'Gruta',
    descricao: 'Fria, silenciosa e cheia de veios que brilham sozinhos.',
    cor: '#6f9ae0',
    tinta: { cor: '#1a2a5a', alpha: 0.2 },
    escuridao: 0.62,
    corLuz: '#cfe4ff',
    poeira: ['#8fd8e8', '#bfeaf7', '#6f88cc'],
    som: { freq: 74, tipo: 'sine', ganho: 0.04, corte: 420 },
    semente: 90210,
    chefe: 'cristalodonte',
    recompensa: {
      moedas: 900,
      itens: [
        { id: 'astralita', quantidade: 3 },
        { id: 'diamante', quantidade: 2 },
        { id: 'fossilEsqueleto', quantidade: 1 },
      ],
      premio: 'lanterna',
      nomePremio: 'Lanterna de Cristal',
      texto: 'A lanterna ilumina bem mais fundo em qualquer caverna.',
    },
    nomeAndar(andar) {
      if (andar <= 3) return `Gruta de Cristal · Galeria ${andar}`;
      if (andar <= 6) return `Gruta de Cristal · Veios ${andar}`;
      if (andar <= 9) return `Gruta de Cristal · Catedral ${andar}`;
      return 'Gruta de Cristal · Coração da Gruta';
    },
    tracado(andar) {
      if (andar === ANDARES) return 'salao';
      return (['galerias', 'cavernoso', 'fenda', 'galerias', 'labirinto', 'cavernoso'] as const)[
        (andar - 1) % 6
      ];
    },
    minerios(andar) {
      const t: PesoNo[] = [{ no: 'rochaCaverna', peso: 40 }];
      if (andar <= 4) t.push({ no: 'veioCarvao', peso: 34 });
      if (andar <= 6) t.push({ no: 'veioCobre', peso: 26 });
      if (andar >= 2) t.push({ no: 'sitioFossil', peso: 16 });
      if (andar >= 3) t.push({ no: 'veioPrata', peso: 22 });
      if (andar >= 5) t.push({ no: 'geodoAmetista', peso: 18 });
      if (andar >= 7) t.push({ no: 'veioDiamante', peso: 12 });
      if (andar >= 9) t.push({ no: 'veioAstralita', peso: 8 });
      return t;
    },
    criaturas(andar) {
      const t: PesoEspecie[] = [];
      if (andar <= 4) t.push({ especie: 'pedrolito', peso: 30 });
      if (andar <= 6) t.push({ especie: 'cavernossauro', peso: 26 });
      if (andar >= 3) t.push({ especie: 'geodonte', peso: 24 });
      if (andar >= 5) t.push({ especie: 'espectrossauro', peso: 18 });
      if (andar >= 6) t.push({ especie: 'cristalossauro', peso: 12 });
      if (andar >= 8) t.push({ especie: 'lumidraco', peso: 8 });
      return t;
    },
  },

  // ================================================== ABISMO ÍGNEO
  mina: {
    id: 'mina',
    nome: 'Abismo Ígneo',
    curto: 'Abismo',
    descricao: 'Quente, barulhento e rachado. A pedra range enquanto você anda.',
    cor: '#e0672a',
    tinta: { cor: '#5a1a08', alpha: 0.22 },
    escuridao: 0.56,
    corLuz: '#ffd9a0',
    poeira: ['#ff8a3c', '#ffd76b', '#6b5c58'],
    som: { freq: 52, tipo: 'sawtooth', ganho: 0.042, corte: 280 },
    semente: 66013,
    chefe: 'ignivoro',
    recompensa: {
      moedas: 900,
      itens: [
        { id: 'nucleoIgneo', quantidade: 3 },
        { id: 'rubi', quantidade: 3 },
        { id: 'fossilEsqueleto', quantidade: 1 },
      ],
      premio: 'ignea',
      nomePremio: 'Armadura de Escamas Ígneas',
      texto: 'A melhor armadura do jogo, batida no calor do próprio Abismo.',
    },
    nomeAndar(andar) {
      if (andar <= 3) return `Abismo Ígneo · Boca ${andar}`;
      if (andar <= 6) return `Abismo Ígneo · Fornalha ${andar}`;
      if (andar <= 9) return `Abismo Ígneo · Fenda ${andar}`;
      return 'Abismo Ígneo · Forja do Abismo';
    },
    tracado(andar) {
      if (andar === ANDARES) return 'salao';
      return (['cavernoso', 'fenda', 'galerias', 'labirinto', 'fenda', 'cavernoso'] as const)[
        (andar - 1) % 6
      ];
    },
    minerios(andar) {
      const t: PesoNo[] = [{ no: 'rochaCaverna', peso: 36 }];
      if (andar <= 5) t.push({ no: 'veioCarvao', peso: 38 });
      if (andar <= 6) t.push({ no: 'veioCobre', peso: 22 });
      if (andar >= 2) t.push({ no: 'sitioFossil', peso: 16 });
      if (andar >= 3) t.push({ no: 'veioObsidiana', peso: 24 });
      if (andar >= 4) t.push({ no: 'veioOuro', peso: 20 });
      if (andar >= 6) t.push({ no: 'veioRubi', peso: 16 });
      if (andar >= 9) t.push({ no: 'veioNucleo', peso: 8 });
      return t;
    },
    criaturas(andar) {
      const t: PesoEspecie[] = [];
      if (andar <= 3) t.push({ especie: 'pedrolito', peso: 26 });
      if (andar <= 5) t.push({ especie: 'cavernossauro', peso: 24 });
      if (andar >= 2) t.push({ especie: 'escaldossauro', peso: 26 });
      if (andar >= 4) t.push({ especie: 'brasadonte', peso: 22 });
      if (andar >= 6) t.push({ especie: 'magmossauro', peso: 14 });
      if (andar >= 8) t.push({ especie: 'ignissauro', peso: 10 });
      return t;
    },
  },
};

export const TODAS_CAVERNAS: FichaCaverna[] = Object.values(CAVERNAS);

/** Ordem em que as cavernas aparecem no bestiário e no diário. */
export const ORDEM_CAVERNAS: CavernaId[] = ['gruta', 'mina'];

/** Id do nível de um andar: `caverna:gruta:3`. */
export function idDoAndar(caverna: CavernaId, andar: number): string {
  return `caverna:${caverna}:${andar}`;
}

/** Lê o id de um nível de caverna. Devolve null para níveis de superfície. */
export function lerIdDoAndar(id: string): { caverna: CavernaId; andar: number } | null {
  const partes = id.split(':');
  if (partes.length !== 3 || partes[0] !== 'caverna') return null;
  return { caverna: partes[1] as CavernaId, andar: Number(partes[2]) };
}
