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
  | 'capim'
  // ---- clareira encantada
  | 'arvoreCristal'
  | 'veioEssencia'
  // ---- pântano das raízes
  | 'cipreste'
  | 'turfeira'
  | 'moitaPantano'
  // ---- floresta fechada
  | 'arvoreAlta'
  | 'arbustoBaga'
  // ---- campo de lava
  | 'arvoreCarbonizada'
  | 'veioObsidiana'
  | 'fumarola'
  // ---- deserto de vidro
  | 'arenito'
  | 'areiaVitrea'
  | 'cacto';

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

    // ------------------------------------------------ clareira encantada
    arvoreCristal: {
      tipo: 'arvore',
      nome: 'Árvore de cristal',
      vidaMax: 14,
      renascer: 70,
      corLasca: '#b8fff2',
      som: 'madeira',
      spriteEsgotado: c.toco,
      quedas: [
        { id: 'madeira', min: 2, max: 3, chance: 1 },
        { id: 'cristal', min: 1, max: 1, chance: 0.4 },
        { id: 'essencia', min: 1, max: 1, chance: 0.25 },
      ],
    },
    veioEssencia: {
      tipo: 'rocha',
      nome: 'Veio de essência',
      vidaMax: 22,
      renascer: 110,
      corLasca: '#b8fff2',
      som: 'pedra',
      spriteEsgotado: c.entulho,
      quedas: [
        { id: 'essencia', min: 1, max: 2, chance: 0.85 },
        { id: 'cristal', min: 1, max: 1, chance: 0.5 },
        { id: 'pedra', min: 1, max: 2, chance: 1 },
      ],
    },

    // -------------------------------------------------- pântano das raízes
    cipreste: {
      tipo: 'arvore',
      nome: 'Cipreste do pântano',
      vidaMax: 11,
      renascer: 55,
      corLasca: '#6b5436',
      som: 'madeira',
      spriteEsgotado: c.toco,
      quedas: [
        { id: 'madeira', min: 2, max: 3, chance: 1 },
        { id: 'turfa', min: 1, max: 2, chance: 0.5 },
      ],
    },
    turfeira: {
      tipo: 'escavacao',
      nome: 'Turfeira',
      vidaMax: 5,
      renascer: 60,
      corLasca: '#4a3a24',
      som: 'terra',
      spriteEsgotado: c.buraco,
      quedas: [
        { id: 'turfa', min: 2, max: 3, chance: 1 },
        { id: 'argila', min: 1, max: 2, chance: 0.5 },
        { id: 'fossil', min: 1, max: 1, chance: 0.18 },
      ],
    },
    moitaPantano: {
      tipo: 'solo',
      nome: 'Moita de junco',
      vidaMax: 3,
      renascer: 30,
      corLasca: '#5f7d4a',
      som: 'terra',
      spriteEsgotado: c.terraArada,
      quedas: [
        { id: 'fibra', min: 2, max: 3, chance: 1 },
        { id: 'turfa', min: 1, max: 1, chance: 0.3 },
      ],
    },

    // ---------------------------------------------------- floresta fechada
    arvoreAlta: {
      tipo: 'arvore',
      nome: 'Árvore alta',
      vidaMax: 13,
      renascer: 58,
      corLasca: '#8d6437',
      som: 'madeira',
      spriteEsgotado: c.toco,
      quedas: [
        { id: 'madeira', min: 3, max: 5, chance: 1 },
        { id: 'resina', min: 1, max: 2, chance: 0.55 },
        { id: 'semente', min: 1, max: 1, chance: 0.3 },
      ],
    },
    arbustoBaga: {
      tipo: 'solo',
      nome: 'Arbusto de bagas',
      vidaMax: 3,
      renascer: 34,
      corLasca: '#c94a4a',
      som: 'terra',
      spriteEsgotado: c.terraArada,
      quedas: [
        { id: 'semente', min: 1, max: 3, chance: 1 },
        { id: 'fibra', min: 1, max: 2, chance: 0.6 },
        { id: 'resina', min: 1, max: 1, chance: 0.15 },
      ],
    },

    // ------------------------------------------------------- campo de lava
    arvoreCarbonizada: {
      tipo: 'arvore',
      nome: 'Tronco carbonizado',
      vidaMax: 9,
      renascer: 64,
      corLasca: '#4a3f3c',
      som: 'madeira',
      spriteEsgotado: c.toco,
      quedas: [
        { id: 'madeira', min: 1, max: 2, chance: 1 },
        { id: 'enxofre', min: 1, max: 1, chance: 0.35 },
      ],
    },
    veioObsidiana: {
      tipo: 'rocha',
      nome: 'Veio de obsidiana',
      vidaMax: 24,
      renascer: 100,
      corLasca: '#4a3c62',
      som: 'pedra',
      spriteEsgotado: c.entulho,
      quedas: [
        { id: 'obsidiana', min: 1, max: 2, chance: 0.9 },
        { id: 'ferro', min: 1, max: 1, chance: 0.4 },
        { id: 'pedra', min: 1, max: 2, chance: 1 },
      ],
    },
    fumarola: {
      tipo: 'escavacao',
      nome: 'Fumarola',
      vidaMax: 6,
      renascer: 80,
      corLasca: '#d8c23a',
      som: 'terra',
      spriteEsgotado: c.buraco,
      quedas: [
        { id: 'enxofre', min: 1, max: 3, chance: 1 },
        { id: 'obsidiana', min: 1, max: 1, chance: 0.2 },
      ],
    },

    // ---------------------------------------------------- deserto de vidro
    arenito: {
      tipo: 'rocha',
      nome: 'Bloco de arenito',
      vidaMax: 14,
      renascer: 60,
      corLasca: '#e8c88a',
      som: 'pedra',
      spriteEsgotado: c.entulho,
      quedas: [
        { id: 'pedra', min: 2, max: 4, chance: 1 },
        { id: 'vidro', min: 1, max: 1, chance: 0.3 },
      ],
    },
    areiaVitrea: {
      tipo: 'escavacao',
      nome: 'Areia vitrificada',
      vidaMax: 5,
      renascer: 72,
      corLasca: '#e6fbff',
      som: 'terra',
      spriteEsgotado: c.buraco,
      quedas: [
        { id: 'vidro', min: 1, max: 3, chance: 1 },
        { id: 'fossil', min: 1, max: 1, chance: 0.2 },
        { id: 'osso', min: 1, max: 1, chance: 0.3 },
      ],
    },
    cacto: {
      tipo: 'solo',
      nome: 'Cacto',
      vidaMax: 4,
      renascer: 40,
      corLasca: '#5f9a44',
      som: 'terra',
      spriteEsgotado: c.terraArada,
      quedas: [
        { id: 'fibra', min: 2, max: 4, chance: 1 },
        { id: 'semente', min: 1, max: 1, chance: 0.35 },
      ],
    },
  };
}
