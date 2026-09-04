/**
 * Definições dos nós de recurso do vale: quanto aguentam, o que deixam cair e
 * quanto tempo levam para voltar.
 *
 * Um recurso novo (uma veia de obsidiana numa caverna, por exemplo) entra só
 * como uma linha aqui.
 */

import type { Assets } from '../gfx/assets';
import type { DefNo } from '../systems/harvest';

export type NomeNo =
  | 'araucaria'
  | 'cicadacea'
  | 'pedra'
  | 'rochaFerro'
  | 'rochaCristal'
  | 'montinho'
  | 'capim';

export function definicoesDeNo(assets: Assets): Record<NomeNo, DefNo> {
  const c = assets.colheita;
  return {
    araucaria: {
      tipo: 'arvore',
      nome: 'Araucária',
      vidaMax: 10,
      renascer: 50,
      corLasca: '#8d6437',
      som: 'madeira',
      spriteEsgotado: c.toco,
      quedas: [
        { id: 'madeira', min: 2, max: 4, chance: 1 },
        { id: 'fibra', min: 1, max: 1, chance: 0.35 },
        { id: 'semente', min: 1, max: 1, chance: 0.2 },
      ],
    },
    cicadacea: {
      tipo: 'arvore',
      nome: 'Cicadácea',
      vidaMax: 8,
      renascer: 42,
      corLasca: '#7a5231',
      som: 'madeira',
      spriteEsgotado: c.toco,
      quedas: [
        { id: 'madeira', min: 1, max: 3, chance: 1 },
        { id: 'fibra', min: 1, max: 2, chance: 0.7 },
      ],
    },
    pedra: {
      tipo: 'rocha',
      nome: 'Pedra',
      vidaMax: 12,
      renascer: 55,
      corLasca: '#a9aab8',
      som: 'pedra',
      spriteEsgotado: c.entulho,
      quedas: [
        { id: 'pedra', min: 2, max: 4, chance: 1 },
        { id: 'argila', min: 1, max: 1, chance: 0.25 },
      ],
    },
    rochaFerro: {
      tipo: 'rocha',
      nome: 'Veio de ferro',
      vidaMax: 16,
      renascer: 75,
      corLasca: '#e6dcc4',
      som: 'pedra',
      spriteEsgotado: c.entulho,
      quedas: [
        { id: 'ferro', min: 1, max: 2, chance: 0.9 },
        { id: 'pedra', min: 1, max: 2, chance: 1 },
      ],
    },
    rochaCristal: {
      tipo: 'rocha',
      nome: 'Rocha de cristal',
      vidaMax: 20,
      renascer: 95,
      corLasca: '#d7b4ff',
      som: 'pedra',
      spriteEsgotado: c.entulho,
      quedas: [
        { id: 'cristal', min: 1, max: 1, chance: 0.75 },
        { id: 'ferro', min: 1, max: 1, chance: 0.3 },
        { id: 'pedra', min: 1, max: 2, chance: 1 },
      ],
    },
    montinho: {
      tipo: 'escavacao',
      nome: 'Terra fofa',
      vidaMax: 4,
      renascer: 65,
      corLasca: '#7c5636',
      som: 'terra',
      spriteEsgotado: c.buraco,
      quedas: [
        { id: 'argila', min: 1, max: 2, chance: 0.7 },
        { id: 'osso', min: 1, max: 1, chance: 0.35 },
        { id: 'semente', min: 1, max: 1, chance: 0.3 },
        { id: 'fossil', min: 1, max: 1, chance: 0.12 },
      ],
    },
    capim: {
      tipo: 'solo',
      nome: 'Capim alto',
      vidaMax: 3,
      renascer: 32,
      corLasca: '#57a544',
      som: 'terra',
      spriteEsgotado: c.terraArada,
      quedas: [
        { id: 'fibra', min: 1, max: 3, chance: 1 },
        { id: 'semente', min: 1, max: 1, chance: 0.45 },
      ],
    },
  };
}
