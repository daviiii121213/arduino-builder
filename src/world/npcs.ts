/** Quem trabalha na cabana de melhorias — e o Ancião, lá no leste do mapa. */

import { Npc } from '../entities/npc';
import type { Assets } from '../gfx/assets';

export function criarNpcsDaCabana(assets: Assets): Npc[] {
  return [
    new Npc(
      'Bruna',
      'Ferreira',
      'ferreira',
      272,
      128,
      assets.cabana.ferreira,
      [
        'Traga dinheiro e eu deixo essas suas ferramentas de pedra irreconhecíveis.',
        'Ferro primeiro. Cristal depois — aquilo corta o vale inteiro.',
      ],
    ),
    new Npc(
      'Nilo',
      'Marceneiro',
      'marceneiro',
      170,
      164,
      assets.cabana.marceneiro,
      [
        'Bolsa apertada? Baú pequeno? Telhado furado? Isso eu resolvo.',
        'Cama boa é metade do dia de trabalho, moço.',
      ],
    ),
  ];
}

/** O Ancião Belmiro, na frente da cabana dele, ao lado da Gruta de Cristal. */
export function criarAnciao(assets: Assets, x: number, y: number): Npc {
  return new Npc('Ancião Belmiro', 'Guardião da Cronolita', 'anciao', x, y, assets.historia.anciao, [
    'Eu moro aqui desde antes da sua avó nascer, menino.',
    'Essa gruta guarda coisa que é melhor não acordar.',
    'Você tem cara de quem está atrás de uma pedra específica.',
  ]);
}
