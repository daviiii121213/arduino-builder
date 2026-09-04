/**
 * Catálogo das ferramentas.
 *
 * Cada uma serve a um tipo de nó de recurso e tem três níveis. O nível muda o
 * poder (dano por golpe no nó), o alcance e o rendimento extra — e o desenho,
 * então a melhoria comprada na cabana é visível na mão do jogador.
 */

import type { FerramentaId } from '../gfx/sprites/tools';
import type { TipoNo } from './harvest';

export interface NivelFerramenta {
  material: string;
  /** Dano por golpe no nó de recurso. */
  poder: number;
  /** Unidades extras colhidas por nó derrubado. */
  rendimentoExtra: number;
  /** Distância máxima de uso, em pixels. */
  alcance: number;
  /** Custo em moedas para chegar a este nível (0 = já vem com o jogador). */
  custo: number;
}

export interface FichaFerramenta {
  id: FerramentaId;
  nome: string;
  /** Verbo mostrado na dica de uso ("Cortar", "Minerar"...). */
  verbo: string;
  /** Que tipo de nó esta ferramenta trabalha. */
  alvo: TipoNo;
  niveis: NivelFerramenta[];
  descricao: string;
}

const NIVEIS = (custos: [number, number]): NivelFerramenta[] => [
  { material: 'Pedra', poder: 2, rendimentoExtra: 0, alcance: 34, custo: 0 },
  { material: 'Ferro', poder: 4, rendimentoExtra: 1, alcance: 40, custo: custos[0] },
  { material: 'Cristal', poder: 7, rendimentoExtra: 2, alcance: 46, custo: custos[1] },
];

export const FERRAMENTAS: Record<FerramentaId, FichaFerramenta> = {
  machado: {
    id: 'machado',
    nome: 'Machado',
    verbo: 'Cortar',
    alvo: 'arvore',
    niveis: NIVEIS([120, 420]),
    descricao: 'Derruba araucárias e cicadáceas para tirar madeira e fibra.',
  },
  picareta: {
    id: 'picareta',
    nome: 'Picareta',
    verbo: 'Minerar',
    alvo: 'rocha',
    niveis: NIVEIS([140, 460]),
    descricao: 'Quebra pedras e tira minério de ferro e cristais.',
  },
  pa: {
    id: 'pa',
    nome: 'Pá',
    verbo: 'Escavar',
    alvo: 'escavacao',
    niveis: NIVEIS([110, 400]),
    descricao: 'Cava os montinhos de terra e desenterra argila, ossos e fósseis.',
  },
  enxada: {
    id: 'enxada',
    nome: 'Enxada',
    verbo: 'Arar',
    alvo: 'solo',
    niveis: NIVEIS([100, 380]),
    descricao: 'Prepara a terra boa e recolhe fibras e sementes do capim.',
  },
};

export const TODAS_FERRAMENTAS: FichaFerramenta[] = Object.values(FERRAMENTAS);

export function nivelFerramenta(id: FerramentaId, nivel: number): NivelFerramenta {
  const f = FERRAMENTAS[id];
  return f.niveis[Math.min(f.niveis.length - 1, Math.max(0, nivel))];
}

/** Nome completo com o material: "Machado de Ferro". */
export function nomeFerramenta(id: FerramentaId, nivel: number): string {
  return `${FERRAMENTAS[id].nome} de ${nivelFerramenta(id, nivel).material}`;
}
