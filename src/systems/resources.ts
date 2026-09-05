/**
 * Catálogo de recursos: nome, valor de venda e onde cada um aparece.
 * Acrescentar um recurso novo é só somar uma linha aqui (mais o ícone).
 */

import type { RecursoId } from '../gfx/sprites/tools';

export interface FichaRecurso {
  id: RecursoId;
  nome: string;
  /** Valor de venda por unidade, em moedas. */
  valor: number;
  descricao: string;
}

export const RECURSOS: Record<RecursoId, FichaRecurso> = {
  fibra: { id: 'fibra', nome: 'Fibra', valor: 2, descricao: 'Talos trançáveis, tirados do capim alto.' },
  semente: { id: 'semente', nome: 'Semente', valor: 3, descricao: 'Guardadas para quando houver horta de verdade.' },
  pedra: { id: 'pedra', nome: 'Pedra', valor: 3, descricao: 'Lascas de rocha do vale.' },
  madeira: { id: 'madeira', nome: 'Madeira', valor: 5, descricao: 'Toras de araucária.' },
  argila: { id: 'argila', nome: 'Argila', valor: 7, descricao: 'Barro úmido das margens.' },
  osso: { id: 'osso', nome: 'Osso', valor: 10, descricao: 'Ossada antiga, dura como pedra.' },
  ferro: { id: 'ferro', nome: 'Minério de ferro', valor: 16, descricao: 'Veios metálicos dentro da rocha.' },
  fossil: { id: 'fossil', nome: 'Fóssil', valor: 30, descricao: 'Uma peça que ninguém mais vai encontrar.' },
  cristal: { id: 'cristal', nome: 'Cristal do vale', valor: 48, descricao: 'Brilha sozinho. Vale uma fortuna.' },

  // ---------------------------------------------------- nativos dos biomas
  turfa: { id: 'turfa', nome: 'Turfa', valor: 6, descricao: 'Torrão escuro do pântano. Queima devagar e por muito tempo.' },
  resina: { id: 'resina', nome: 'Resina', valor: 12, descricao: 'Seiva endurecida das árvores altas da floresta fechada.' },
  vidro: { id: 'vidro', nome: 'Vidro do deserto', valor: 22, descricao: 'A areia virou vidro onde o céu bateu no chão.' },
  enxofre: { id: 'enxofre', nome: 'Enxofre', valor: 26, descricao: 'Crosta amarela das fumarolas. Cheira a ovo velho.' },
  obsidiana: { id: 'obsidiana', nome: 'Obsidiana', valor: 38, descricao: 'Lava que esfriou de uma vez. Corta como navalha.' },
  essencia: { id: 'essencia', nome: 'Essência arcana', valor: 60, descricao: 'Luz presa numa gota. Só existe na clareira encantada.' },
};

export function valorDe(id: RecursoId): number {
  return RECURSOS[id].valor;
}

export const TODOS_RECURSOS: FichaRecurso[] = Object.values(RECURSOS);
