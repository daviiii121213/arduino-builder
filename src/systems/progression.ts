/**
 * Progresso comprado com dinheiro: ferramentas, inventário e casa.
 *
 * O catálogo é só dados — cada melhoria sabe quanto custa, quem vende e o que
 * muda no estado. Acrescentar uma melhoria nova não exige tocar na interface.
 */

import type { FerramentaId } from '../gfx/sprites/tools';
import { FERRAMENTAS, nomeFerramenta } from './tools';

/** Quem atende o jogador na cabana. */
export type Vendedor = 'ferreira' | 'marceneiro';

export interface EstadoCasa {
  /** Cama macia: dormir recupera todos os corações. */
  camaMacia: boolean;
  /** Baú reforçado: dobra os espaços do baú. */
  bauReforcado: boolean;
  /** Telhado novo: muda o visual da casa e acende um lampião no quintal. */
  telhadoNovo: boolean;
}

export class Progresso {
  /** Nível de cada ferramenta (0 = pedra, 1 = ferro, 2 = cristal). */
  ferramentas: Record<FerramentaId, number> = {
    machado: 0,
    picareta: 0,
    pa: 0,
    enxada: 0,
  };
  /** Espaços liberados no inventário (de 6 a 10). */
  slotsInventario = 6;
  /** Quanto cabe em cada espaço. */
  pilhaMax = 20;
  /** Espaços do baú de casa. */
  slotsBau = 12;
  casa: EstadoCasa = { camaMacia: false, bauReforcado: false, telhadoNovo: false };
  /** Modo de teste: tudo liberado. */
  demo = false;
  /** Melhorias já compradas, por id. */
  compradas = new Set<string>();

  nivel(id: FerramentaId): number {
    return this.ferramentas[id];
  }

  /** Libera tudo (usado pelo modo de teste). */
  liberarTudo(): void {
    for (const id of Object.keys(this.ferramentas) as FerramentaId[]) {
      this.ferramentas[id] = FERRAMENTAS[id].niveis.length - 1;
    }
    this.slotsInventario = 10;
    this.pilhaMax = 999;
    this.slotsBau = 24;
    this.casa = { camaMacia: true, bauReforcado: true, telhadoNovo: true };
    for (const m of CATALOGO) this.compradas.add(m.id);
  }
}

export interface Melhoria {
  id: string;
  vendedor: Vendedor;
  nome: string;
  descricao: string;
  custo: number;
  /** Categoria mostrada na lista. */
  grupo: 'Ferramentas' | 'Inventário' | 'Casa';
  /** Já pode ser comprada? (respeita a ordem das melhorias em cadeia) */
  disponivel: (p: Progresso) => boolean;
  /** Já foi comprada / não faz mais sentido? */
  concluida: (p: Progresso) => boolean;
  aplicar: (p: Progresso) => void;
}

function melhoriaFerramenta(id: FerramentaId, nivel: number): Melhoria {
  const custo = FERRAMENTAS[id].niveis[nivel].custo;
  return {
    id: `${id}-${nivel}`,
    vendedor: 'ferreira',
    grupo: 'Ferramentas',
    nome: nomeFerramenta(id, nivel),
    descricao: `Mais poder e alcance. ${FERRAMENTAS[id].descricao}`,
    custo,
    disponivel: (p) => p.nivel(id) === nivel - 1,
    concluida: (p) => p.nivel(id) >= nivel,
    aplicar: (p) => {
      p.ferramentas[id] = nivel;
    },
  };
}

export const CATALOGO: Melhoria[] = [
  // ---------------------------------------------------- ferreira: ferramentas
  ...(Object.keys(FERRAMENTAS) as FerramentaId[]).flatMap((id) => [
    melhoriaFerramenta(id, 1),
    melhoriaFerramenta(id, 2),
  ]),

  // -------------------------------------------- marceneiro: inventário e casa
  {
    id: 'bolsa-1',
    vendedor: 'marceneiro',
    grupo: 'Inventário',
    nome: 'Bolsa de couro',
    descricao: 'Libera dois espaços no inventário (6 → 8).',
    custo: 150,
    disponivel: (p) => p.slotsInventario === 6,
    concluida: (p) => p.slotsInventario >= 8,
    aplicar: (p) => {
      p.slotsInventario = 8;
    },
  },
  {
    id: 'bolsa-2',
    vendedor: 'marceneiro',
    grupo: 'Inventário',
    nome: 'Mochila de fibra',
    descricao: 'Libera os dois últimos espaços do inventário (8 → 10).',
    custo: 360,
    disponivel: (p) => p.slotsInventario === 8,
    concluida: (p) => p.slotsInventario >= 10,
    aplicar: (p) => {
      p.slotsInventario = 10;
    },
  },
  {
    id: 'pilha-1',
    vendedor: 'marceneiro',
    grupo: 'Inventário',
    nome: 'Compartimentos',
    descricao: 'Cada espaço passa a levar 50 unidades (era 20).',
    custo: 200,
    disponivel: (p) => p.pilhaMax === 20,
    concluida: (p) => p.pilhaMax >= 50,
    aplicar: (p) => {
      p.pilhaMax = 50;
    },
  },
  {
    id: 'pilha-2',
    vendedor: 'marceneiro',
    grupo: 'Inventário',
    nome: 'Compartimentos duplos',
    descricao: 'Cada espaço passa a levar 99 unidades.',
    custo: 480,
    disponivel: (p) => p.pilhaMax === 50,
    concluida: (p) => p.pilhaMax >= 99,
    aplicar: (p) => {
      p.pilhaMax = 99;
    },
  },
  {
    id: 'cama-macia',
    vendedor: 'marceneiro',
    grupo: 'Casa',
    nome: 'Cama macia',
    descricao: 'Dormir passa a recuperar todos os corações.',
    custo: 180,
    disponivel: () => true,
    concluida: (p) => p.casa.camaMacia,
    aplicar: (p) => {
      p.casa.camaMacia = true;
    },
  },
  {
    id: 'bau-reforcado',
    vendedor: 'marceneiro',
    grupo: 'Casa',
    nome: 'Baú reforçado',
    descricao: 'Dobra o espaço do baú de casa (12 → 24).',
    custo: 240,
    disponivel: () => true,
    concluida: (p) => p.casa.bauReforcado,
    aplicar: (p) => {
      p.casa.bauReforcado = true;
      p.slotsBau = 24;
    },
  },
  {
    id: 'telhado-novo',
    vendedor: 'marceneiro',
    grupo: 'Casa',
    nome: 'Telhado novo',
    descricao: 'Telhas novas na casa e mais um lampião aceso no quintal.',
    custo: 320,
    disponivel: () => true,
    concluida: (p) => p.casa.telhadoNovo,
    aplicar: (p) => {
      p.casa.telhadoNovo = true;
    },
  },
];

export function melhoriasDe(vendedor: Vendedor): Melhoria[] {
  return CATALOGO.filter((m) => m.vendedor === vendedor);
}
