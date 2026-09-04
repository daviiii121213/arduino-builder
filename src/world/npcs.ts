/** Quem trabalha na cabana de melhorias. */

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
