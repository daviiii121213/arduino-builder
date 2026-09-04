/**
 * Ponte entre os dados de um item e a arte que o representa.
 * Fica separado para que uma ferramenta melhorada apareça com o desenho novo
 * em todo lugar (inventário, baú, mão do jogador) sem duplicar regra.
 */

import type { Assets } from '../gfx/assets';
import type { Sprite } from '../gfx/pixel';
import type { Item } from '../systems/items';
import type { Progresso } from '../systems/progression';
import type { FerramentaId, RecursoId } from '../gfx/sprites/tools';
import { nomeFerramenta } from '../systems/tools';
import { RECURSOS } from '../systems/resources';

export function iconeDoItem(assets: Assets, progresso: Progresso, item: Item): Sprite {
  if (item.tipo === 'ferramenta') {
    const id = item.id as FerramentaId;
    return assets.ferramentas.ferramentas[id][progresso.nivel(id)];
  }
  return assets.ferramentas.recursos[item.id as RecursoId];
}

export function nomeDoItem(progresso: Progresso, item: Item): string {
  if (item.tipo === 'ferramenta') {
    const id = item.id as FerramentaId;
    return nomeFerramenta(id, progresso.nivel(id));
  }
  return RECURSOS[item.id as RecursoId].nome;
}

export function descricaoDoItem(progresso: Progresso, item: Item): string {
  if (item.tipo === 'ferramenta') {
    const id = item.id as FerramentaId;
    void progresso;
    return {
      machado: 'Corta árvores.',
      picareta: 'Quebra pedras.',
      pa: 'Cava montinhos de terra.',
      enxada: 'Ara a terra e colhe capim.',
    }[id];
  }
  const r = RECURSOS[item.id as RecursoId];
  return `${r.descricao} Vale ${r.valor} por unidade.`;
}
