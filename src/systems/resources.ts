/**
 * Catálogo de recursos: nome, valor de venda e onde cada um aparece.
 * Acrescentar um recurso novo é só somar uma linha aqui (mais o ícone).
 */

import type { RecursoId } from '../gfx/sprites/tools';
import { TODOS_FOSSEIS, type FossilId } from './fossils';

export interface FichaRecurso {
  id: RecursoId;
  nome: string;
  /** Valor de venda por unidade, em moedas. */
  valor: number;
  descricao: string;
}

/** As peças de arqueologia entram no catálogo a partir da própria ficha. */
const RECURSOS_FOSSEIS = Object.fromEntries(
  TODOS_FOSSEIS.map((f) => [f.id, { id: f.id, nome: f.nome, valor: f.valor, descricao: f.descricao }]),
) as Record<FossilId, FichaRecurso>;

export const RECURSOS: Record<RecursoId, FichaRecurso> = {
  ...RECURSOS_FOSSEIS,
  fibra: { id: 'fibra', nome: 'Fibra', valor: 2, descricao: 'Talos trançáveis, tirados do capim alto.' },
  semente: { id: 'semente', nome: 'Semente', valor: 3, descricao: 'Guardadas para quando houver horta de verdade.' },
  pedra: { id: 'pedra', nome: 'Pedra', valor: 3, descricao: 'Lascas de rocha do vale.' },
  madeira: { id: 'madeira', nome: 'Madeira', valor: 5, descricao: 'Toras de araucária.' },
  argila: { id: 'argila', nome: 'Argila', valor: 7, descricao: 'Barro úmido das margens.' },
  osso: { id: 'osso', nome: 'Osso', valor: 10, descricao: 'Ossada antiga, dura como pedra.' },
  ferro: { id: 'ferro', nome: 'Minério de ferro', valor: 16, descricao: 'Veios metálicos dentro da rocha.' },
  fossil: { id: 'fossil', nome: 'Fragmento fóssil', valor: 30, descricao: 'Lasca de osso antigo. Peça completa é outra conversa.' },
  cristal: { id: 'cristal', nome: 'Cristal do vale', valor: 48, descricao: 'Brilha sozinho. Vale uma fortuna.' },

  // ---------------------------------------------------- nativos dos biomas
  turfa: { id: 'turfa', nome: 'Turfa', valor: 6, descricao: 'Torrão escuro do pântano. Queima devagar e por muito tempo.' },
  resina: { id: 'resina', nome: 'Resina', valor: 12, descricao: 'Seiva endurecida das árvores altas da floresta fechada.' },
  vidro: { id: 'vidro', nome: 'Vidro do deserto', valor: 22, descricao: 'A areia virou vidro onde o céu bateu no chão.' },
  enxofre: { id: 'enxofre', nome: 'Enxofre', valor: 26, descricao: 'Crosta amarela das fumarolas. Cheira a ovo velho.' },
  obsidiana: { id: 'obsidiana', nome: 'Obsidiana', valor: 38, descricao: 'Lava que esfriou de uma vez. Corta como navalha.' },
  essencia: { id: 'essencia', nome: 'Essência arcana', valor: 60, descricao: 'Luz presa numa gota. Só existe na clareira encantada.' },

  // ------------------------------------------------ minérios das cavernas
  carvao: { id: 'carvao', nome: 'Carvão', valor: 8, descricao: 'Queima quente e suja a mão. O primeiro achado de qualquer mina.' },
  cobre: { id: 'cobre', nome: 'Cobre', valor: 14, descricao: 'Veio avermelhado nas paredes rasas das grutas.' },
  prata: { id: 'prata', nome: 'Prata', valor: 34, descricao: 'Brilha branca quando a lanterna passa por perto.' },
  ouro: { id: 'ouro', nome: 'Ouro', valor: 62, descricao: 'Pesado, mole e caro. Fica fundo.' },
  ametista: { id: 'ametista', nome: 'Ametista', valor: 90, descricao: 'Geodo roxo dos salões de cristal.' },
  rubi: { id: 'rubi', nome: 'Rubi', valor: 130, descricao: 'Vermelho como brasa presa na pedra.' },
  diamante: { id: 'diamante', nome: 'Diamante', valor: 240, descricao: 'Risca tudo, inclusive a picareta de cristal.' },
  astralita: { id: 'astralita', nome: 'Astralita', valor: 340, descricao: 'Só o fundo da Gruta de Cristal tem. Fria e viva ao mesmo tempo.' },
  nucleoIgneo: { id: 'nucleoIgneo', nome: 'Núcleo ígneo', valor: 360, descricao: 'Uma gota do fogo do Abismo, esfriada por fora e acesa por dentro.' },
};

export function valorDe(id: RecursoId): number {
  return RECURSOS[id].valor;
}

export const TODOS_RECURSOS: FichaRecurso[] = Object.values(RECURSOS);
