/**
 * Sistema de biomas.
 *
 * Cada bioma é uma ficha de dados: o terreno que ele escreve no mapa, a
 * atmosfera (tinta, partículas, som), os recursos nativos e as criaturas que
 * moram nele. O gerador de mundo só consulta este registro — por isso um bioma
 * novo entra acrescentando uma ficha aqui, sem mexer no resto do jogo.
 */

import { Tile } from './tiles';
import type { EspecieId } from '../gfx/sprites/dinos';
import type { RecursoId } from '../gfx/sprites/tools';

export type BiomaId = 'vale' | 'magico' | 'pantano' | 'floresta' | 'vulcanico' | 'deserto';

/** Partículas que ficam no ar do bioma (poeira, brasa, vaga-lume...). */
export interface AmbienteBioma {
  cores: string[];
  /** Partículas por segundo na área visível. */
  taxa: number;
  /** Velocidade média do ar. */
  vx: number;
  vy: number;
  vida: number;
  /** Sobe (brasa) ou cai (cinza/areia). */
  gravidade: number;
}

/** Zumbido de fundo, sintetizado (sem arquivos de áudio). */
export interface SomBioma {
  /** Frequência da base, em Hz. */
  freq: number;
  tipo: OscillatorType;
  /** Volume (0..1) — sempre discreto, é só atmosfera. */
  ganho: number;
  /** Frequência do filtro passa-baixa. */
  corte: number;
}

export interface FichaBioma {
  id: BiomaId;
  nome: string;
  /** Frase curta mostrada ao entrar e no diário. */
  descricao: string;
  /** Tinta aplicada por cima da cena (atmosfera). */
  tinta: { cor: string; alpha: number } | null;
  ambiente: AmbienteBioma | null;
  som: SomBioma | null;
  /** Recursos que só aparecem aqui (para o diário e as missões). */
  recursos: RecursoId[];
  /** Criaturas nativas. */
  especies: EspecieId[];
  /** Cor no minimapa/diário. */
  cor: string;
  /**
   * Terreno do bioma a partir dos três ruídos do mundo:
   * e = relevo, m = umidade, r = rocha. Tudo em 0..1.
   */
  terreno(e: number, m: number, r: number): Tile;
}

export const BIOMAS: Record<BiomaId, FichaBioma> = {
  // ------------------------------------------------------------------ VALE
  vale: {
    id: 'vale',
    nome: 'Vale dos Gigantes',
    descricao: 'Campo aberto, lagos rasos e araucárias. É onde fica a sua casa.',
    tinta: null,
    ambiente: null,
    som: null,
    recursos: ['madeira', 'pedra', 'fibra', 'argila'],
    especies: ['raptornoz', 'dentesangue', 'folhalonga', 'tricornis', 'casconte', 'pedrapata'],
    cor: '#5aa14a',
    terreno(e, m, r) {
      if (e < 0.3) return Tile.AguaFunda;
      if (e < 0.365) return Tile.AguaRasa;
      if (e < 0.4) return Tile.Areia;
      if (r > 0.76) return Tile.Rocha;
      if (e < 0.425 && m > 0.5) return Tile.Lama;
      if (m > 0.63) return Tile.GramaFlorida;
      if (m < 0.34) return Tile.GramaSeca;
      return Tile.Grama;
    },
  },

  // ---------------------------------------------------------------- MÁGICO
  magico: {
    id: 'magico',
    nome: 'Clareira Encantada',
    descricao: 'A grama brilha azul e o chão é veio de cristal. O ar zumbe sozinho.',
    tinta: { cor: '#4a3aa8', alpha: 0.14 },
    ambiente: {
      cores: ['#9fe8ff', '#d7b4ff', '#e8d7ff'],
      taxa: 16,
      vx: 6,
      vy: -14,
      vida: 2.2,
      gravidade: -6,
    },
    som: { freq: 196, tipo: 'sine', ganho: 0.05, corte: 900 },
    recursos: ['cristal', 'essencia'],
    especies: ['luminassauro', 'etherodonte', 'arcanoraptor', 'cristalossauro', 'lumidraco'],
    cor: '#8f6ce0',
    terreno(e, m, r) {
      if (e < 0.29) return Tile.AguaFunda;
      if (e < 0.35) return Tile.AguaRasa;
      if (r > 0.68) return Tile.SoloCristal;
      if (m > 0.58) return Tile.GramaMagica;
      if (m < 0.32) return Tile.SoloCristal;
      return Tile.GramaMagica;
    },
  },

  // --------------------------------------------------------------- PÂNTANO
  pantano: {
    id: 'pantano',
    nome: 'Pântano das Raízes',
    descricao: 'Água parada, turfa funda e mosquitos. Anda-se devagar aqui.',
    tinta: { cor: '#2a4a30', alpha: 0.18 },
    ambiente: {
      cores: ['#88a05a', '#5f7a3e', '#c8d89a'],
      taxa: 12,
      vx: 10,
      vy: -4,
      vida: 2.6,
      gravidade: 4,
    },
    som: { freq: 92, tipo: 'triangle', ganho: 0.045, corte: 500 },
    recursos: ['turfa', 'argila', 'fossil'],
    especies: ['pantanossauro', 'crocossauro', 'venomossauro', 'nadalonga', 'escamarela'],
    cor: '#4c6b3a',
    terreno(e, m, r) {
      if (e < 0.34) return Tile.AguaPantano;
      if (e < 0.42) return Tile.LamaFunda;
      if (r > 0.8) return Tile.Rocha;
      if (m > 0.55) return Tile.Turfa;
      if (m < 0.33) return Tile.Lama;
      return Tile.Turfa;
    },
  },

  // -------------------------------------------------------------- FLORESTA
  floresta: {
    id: 'floresta',
    nome: 'Floresta Fechada',
    descricao: 'Copas altas cortam o sol. O chão some debaixo da folhagem.',
    tinta: { cor: '#12301c', alpha: 0.2 },
    ambiente: {
      cores: ['#7fbf5a', '#3f7a34', '#d8e8a0'],
      taxa: 10,
      vx: -12,
      vy: 8,
      vida: 2.8,
      gravidade: 12,
    },
    som: { freq: 140, tipo: 'sine', ganho: 0.035, corte: 700 },
    recursos: ['madeira', 'resina', 'semente'],
    especies: ['silvassauro', 'espinosselva', 'feroxossauro'],
    cor: '#2f6b34',
    terreno(e, m, r) {
      if (e < 0.28) return Tile.AguaFunda;
      if (e < 0.33) return Tile.AguaRasa;
      if (r > 0.78) return Tile.Rocha;
      if (m > 0.56) return Tile.Folhagem;
      if (m < 0.3) return Tile.Terra;
      return Tile.GramaFloresta;
    },
  },

  // ------------------------------------------------------------- VULCÂNICO
  vulcanico: {
    id: 'vulcanico',
    nome: 'Campo de Lava',
    descricao: 'Cinza no ar, pedra negra no chão e rios de lava que não se atravessa.',
    tinta: { cor: '#8a2a12', alpha: 0.16 },
    ambiente: {
      cores: ['#ffb14a', '#ff6a2a', '#6b5c58'],
      taxa: 20,
      vx: 4,
      vy: -22,
      vida: 1.8,
      gravidade: -18,
    },
    som: { freq: 62, tipo: 'sawtooth', ganho: 0.04, corte: 320 },
    recursos: ['obsidiana', 'enxofre', 'ferro'],
    especies: ['magmossauro', 'ignissauro', 'vulcanor'],
    cor: '#a3402a',
    terreno(e, m, r) {
      if (e < 0.29) return Tile.Lava;
      if (e < 0.34) return Tile.RochaVulcanica;
      if (r > 0.7) return Tile.RochaVulcanica;
      if (m > 0.6) return Tile.Cinzas;
      return Tile.Cinzas;
    },
  },

  // --------------------------------------------------------------- DESERTO
  deserto: {
    id: 'deserto',
    nome: 'Deserto de Vidro',
    descricao: 'Dunas claras e solo rachado. O vento carrega areia o dia inteiro.',
    tinta: { cor: '#c9a24a', alpha: 0.12 },
    ambiente: {
      cores: ['#e8d7a0', '#c9a24a', '#fff3d0'],
      taxa: 26,
      vx: 46,
      vy: 3,
      vida: 1.4,
      gravidade: 6,
    },
    som: { freq: 120, tipo: 'sine', ganho: 0.03, corte: 1400 },
    recursos: ['vidro', 'pedra', 'fossil'],
    especies: ['arenossauro', 'dunassauro', 'tempestossauro'],
    cor: '#d8b45a',
    terreno(e, m, r) {
      if (e < 0.27) return Tile.AguaRasa; // oásis raro
      if (r > 0.8) return Tile.Rocha;
      if (m < 0.36) return Tile.SoloRachado;
      if (e > 0.58) return Tile.AreiaClara;
      return Tile.Areia;
    },
  },
};

export const TODOS_BIOMAS: FichaBioma[] = Object.values(BIOMAS);

/** Índice numérico do bioma (é assim que ele fica guardado no nível). */
export const ORDEM_BIOMAS: BiomaId[] = [
  'vale',
  'magico',
  'pantano',
  'floresta',
  'vulcanico',
  'deserto',
];

export function biomaPorIndice(i: number): BiomaId {
  return ORDEM_BIOMAS[i] ?? 'vale';
}

export function indiceDoBioma(id: BiomaId): number {
  return Math.max(0, ORDEM_BIOMAS.indexOf(id));
}

/** Centro de cada bioma no mapa, em tiles (o vale fica onde está a casa). */
export interface CentroBioma {
  id: BiomaId;
  tx: number;
  ty: number;
  /** Peso: quanto maior, maior a fatia do mapa. */
  peso: number;
}

export const CENTROS: CentroBioma[] = [
  { id: 'vale', tx: 30, ty: 28, peso: 1.35 },
  { id: 'floresta', tx: 70, ty: 20, peso: 1 },
  { id: 'deserto', tx: 105, ty: 30, peso: 1 },
  { id: 'pantano', tx: 24, ty: 70, peso: 1 },
  { id: 'vulcanico', tx: 68, ty: 74, peso: 1 },
  { id: 'magico', tx: 106, ty: 66, peso: 1 },
];
