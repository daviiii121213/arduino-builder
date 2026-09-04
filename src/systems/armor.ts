/**
 * Catálogo de armaduras.
 *
 * São compradas com dinheiro na cabana (não existe fabricação) e mudam o
 * desenho do personagem na hora. Acrescentar um conjunto novo é uma linha aqui
 * mais a camada de arte em gfx/sprites/armor.ts.
 */

import type { ArmaduraId } from '../gfx/sprites/armor';

export interface FichaArmadura {
  id: ArmaduraId;
  nome: string;
  /** Quantas metades de coração o conjunto absorve por golpe. */
  reducao: number;
  /** Bônus de velocidade (multiplicador). Couro é leve, osso é pesado. */
  velocidade: number;
  custo: number;
  descricao: string;
}

export const ARMADURAS: Record<ArmaduraId, FichaArmadura> = {
  couro: {
    id: 'couro',
    nome: 'Armadura de couro',
    reducao: 1,
    velocidade: 1,
    custo: 260,
    descricao: 'Couro curtido e tiras de fibra. Absorve meio coração por golpe.',
  },
  osso: {
    id: 'osso',
    nome: 'Placas de osso',
    reducao: 2,
    velocidade: 0.94,
    custo: 620,
    descricao: 'Placas de ossada com chifres. Absorve um coração, mas pesa.',
  },
  cristal: {
    id: 'cristal',
    nome: 'Casca de cristal',
    reducao: 3,
    velocidade: 1.04,
    custo: 1400,
    descricao: 'Cristal do vale lapidado: absorve um coração e meio e ainda é leve.',
  },
};

export const TODAS_ARMADURAS: FichaArmadura[] = Object.values(ARMADURAS);
