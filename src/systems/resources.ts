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
};

export function valorDe(id: RecursoId): number {
  return RECURSOS[id].valor;
}

export const TODOS_RECURSOS: FichaRecurso[] = Object.values(RECURSOS);
