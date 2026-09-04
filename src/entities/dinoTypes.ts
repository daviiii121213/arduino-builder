/**
 * Fichas dos dez dinossauros.
 *
 * São cinco categorias com dois representantes cada:
 *   mágicos, carnívoros, herbívoros, terrestres e aquáticos.
 * Adicionar uma nova criatura é só acrescentar a arte em gfx/sprites/dinos.ts
 * e uma ficha aqui.
 */

import type { EspecieId } from '../gfx/sprites/dinos';

export type Categoria = 'magico' | 'carnivoro' | 'herbivoro' | 'terrestre' | 'aquatico';

export const NOME_CATEGORIA: Record<Categoria, string> = {
  magico: 'Mágico',
  carnivoro: 'Carnívoro',
  herbivoro: 'Herbívoro',
  terrestre: 'Terrestre',
  aquatico: 'Aquático',
};

export interface FichaDino {
  id: EspecieId;
  nome: string;
  categoria: Categoria;
  /** Vida em pontos (o golpe do jogador causa 3). */
  vidaMax: number;
  /** Dano no jogador, em metades de coração. */
  dano: number;
  velocidade: number;
  /** Velocidade ao fugir ou ao investir. */
  velocidadeCorrida: number;
  /** Distância em que percebe o jogador. */
  percepcao: number;
  /** Distância do próprio ataque. */
  alcance: number;
  /** Tempo entre ataques. */
  recarga: number;
  /** Preparação antes do golpe (telegrafado, dá tempo de reagir). */
  preparo: number;
  /** Meia largura/altura da pegada de colisão. */
  pegada: { w: number; h: number };
  /** Raio do corpo para acerto do jogador. */
  raioCorpo: number;
  /** Ataca sem provocação. */
  agressivo: boolean;
  /** Só ataca quem invade seu território (raio pequeno). */
  territorial: boolean;
  /** Foge quando é ferido. */
  medroso: boolean;
  /** Vive na água. */
  aquatico: boolean;
  /** Flutua (mágicos): ignora objetos e balança no ar. */
  flutua: boolean;
  /** Ataque à distância com orbe mágica. */
  distancia: boolean;
  /** Some e reaparece perto quando é ferido. */
  teleporta: boolean;
  /** Cor das partículas de dano. */
  corSangue: string;
  sombra: 'p' | 'm' | 'g' | 'gg';
  /** Texto do bestiário (usado na interface e no diário futuro). */
  descricao: string;
}

export const FICHAS: Record<EspecieId, FichaDino> = {
  // ------------------------------------------------------------ MÁGICOS
  luminassauro: {
    id: 'luminassauro',
    nome: 'Luminassauro',
    categoria: 'magico',
    vidaMax: 18,
    dano: 2,
    velocidade: 34,
    velocidadeCorrida: 58,
    percepcao: 140,
    alcance: 110,
    recarga: 2,
    preparo: 0.55,
    pegada: { w: 9, h: 4 },
    raioCorpo: 11,
    agressivo: true,
    territorial: false,
    medroso: false,
    aquatico: false,
    flutua: true,
    distancia: true,
    teleporta: true,
    corSangue: '#9fe8ff',
    sombra: 'g',
    descricao: 'Cristais nas costas guardam a luz do sol e disparam orbes de energia.',
  },
  etherodonte: {
    id: 'etherodonte',
    nome: 'Etherodonte',
    categoria: 'magico',
    vidaMax: 14,
    dano: 2,
    velocidade: 40,
    velocidadeCorrida: 70,
    percepcao: 150,
    alcance: 120,
    recarga: 1.6,
    preparo: 0.45,
    pegada: { w: 8, h: 4 },
    raioCorpo: 10,
    agressivo: true,
    territorial: false,
    medroso: false,
    aquatico: false,
    flutua: true,
    distancia: true,
    teleporta: true,
    corSangue: '#d7b4ff',
    sombra: 'm',
    descricao: 'Vive meio no nosso mundo, meio em outro. Desaparece quando é ferido.',
  },

  // ------------------------------------------------------------ CARNÍVOROS
  raptornoz: {
    id: 'raptornoz',
    nome: 'Raptornoz',
    categoria: 'carnivoro',
    vidaMax: 12,
    dano: 2,
    velocidade: 56,
    velocidadeCorrida: 92,
    percepcao: 145,
    alcance: 20,
    recarga: 1.1,
    preparo: 0.3,
    pegada: { w: 10, h: 4 },
    raioCorpo: 11,
    agressivo: true,
    territorial: false,
    medroso: false,
    aquatico: false,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#b8322f',
    sombra: 'g',
    descricao: 'Rápido e curioso. Cerca a presa antes de dar a mordida.',
  },
  dentesangue: {
    id: 'dentesangue',
    nome: 'Dentesangue',
    categoria: 'carnivoro',
    vidaMax: 28,
    dano: 4,
    velocidade: 42,
    velocidadeCorrida: 68,
    percepcao: 165,
    alcance: 26,
    recarga: 1.7,
    preparo: 0.5,
    pegada: { w: 13, h: 5 },
    raioCorpo: 14,
    agressivo: true,
    territorial: false,
    medroso: false,
    aquatico: false,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#b8322f',
    sombra: 'gg',
    descricao: 'Cada passo faz o chão tremer. Uma mordida arranca dois corações.',
  },

  // ------------------------------------------------------------ HERBÍVOROS
  folhalonga: {
    id: 'folhalonga',
    nome: 'Folhalonga',
    categoria: 'herbivoro',
    vidaMax: 34,
    dano: 2,
    velocidade: 22,
    velocidadeCorrida: 44,
    percepcao: 95,
    alcance: 24,
    recarga: 2.4,
    preparo: 0.7,
    pegada: { w: 13, h: 5 },
    raioCorpo: 15,
    agressivo: false,
    territorial: false,
    medroso: true,
    aquatico: false,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#3f8f8a',
    sombra: 'gg',
    descricao: 'Come as folhas mais altas das araucárias. Pacífico, mas enorme.',
  },
  tricornis: {
    id: 'tricornis',
    nome: 'Tricornis',
    categoria: 'herbivoro',
    vidaMax: 24,
    dano: 3,
    velocidade: 30,
    velocidadeCorrida: 76,
    percepcao: 110,
    alcance: 22,
    recarga: 1.9,
    preparo: 0.55,
    pegada: { w: 12, h: 5 },
    raioCorpo: 13,
    agressivo: false,
    territorial: false,
    medroso: true,
    aquatico: false,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#8a6238',
    sombra: 'g',
    descricao: 'Pasta em paz — até você insistir. Aí os três chifres vêm na frente.',
  },

  // ------------------------------------------------------------ TERRESTRES
  casconte: {
    id: 'casconte',
    nome: 'Casconte',
    categoria: 'terrestre',
    vidaMax: 36,
    dano: 3,
    velocidade: 18,
    velocidadeCorrida: 40,
    percepcao: 78,
    alcance: 22,
    recarga: 1.6,
    preparo: 0.6,
    pegada: { w: 13, h: 5 },
    raioCorpo: 13,
    agressivo: false,
    territorial: true,
    medroso: false,
    aquatico: false,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#8a8f9c',
    sombra: 'g',
    descricao: 'Uma fortaleza de couro e osso. Gira a cauda-martelo em quem chega perto.',
  },
  pedrapata: {
    id: 'pedrapata',
    nome: 'Pedrapata',
    categoria: 'terrestre',
    vidaMax: 32,
    dano: 3,
    velocidade: 20,
    velocidadeCorrida: 42,
    percepcao: 82,
    alcance: 24,
    recarga: 1.7,
    preparo: 0.6,
    pegada: { w: 14, h: 5 },
    raioCorpo: 14,
    agressivo: false,
    territorial: true,
    medroso: false,
    aquatico: false,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#6f7f3a',
    sombra: 'gg',
    descricao: 'As placas nas costas esquentam ao sol. Defende o seu pedaço de vale.',
  },

  // ------------------------------------------------------------ AQUÁTICOS
  nadalonga: {
    id: 'nadalonga',
    nome: 'Nadalonga',
    categoria: 'aquatico',
    vidaMax: 22,
    dano: 3,
    velocidade: 40,
    velocidadeCorrida: 66,
    percepcao: 125,
    alcance: 24,
    recarga: 1.5,
    preparo: 0.45,
    pegada: { w: 12, h: 4 },
    raioCorpo: 13,
    agressivo: false,
    territorial: true,
    medroso: false,
    aquatico: true,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#3a6fb0',
    sombra: 'g',
    descricao: 'Desliza pelos lagos do vale. O pescoço aparece antes do resto.',
  },
  escamarela: {
    id: 'escamarela',
    nome: 'Escamarela',
    categoria: 'aquatico',
    vidaMax: 18,
    dano: 3,
    velocidade: 48,
    velocidadeCorrida: 84,
    percepcao: 140,
    alcance: 22,
    recarga: 1.2,
    preparo: 0.35,
    pegada: { w: 12, h: 4 },
    raioCorpo: 12,
    agressivo: true,
    territorial: false,
    medroso: false,
    aquatico: true,
    flutua: false,
    distancia: false,
    teleporta: false,
    corSangue: '#7fa63a',
    sombra: 'g',
    descricao: 'Caçadora das águas fundas. Não entre no lago sem olhar duas vezes.',
  },
};

export const TODAS_FICHAS: FichaDino[] = Object.values(FICHAS);
