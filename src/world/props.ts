/** Ajudantes para posicionar objetos de cenário com colisão e sombra. */

import type { Sprite } from '../gfx/pixel';
import type { Colisor, Nivel, ObjetoCenario } from './level';

export interface OpcoesObjeto {
  /** Caixa de colisão na base: largura e altura em pixels. */
  colisao?: { w: number; h: number };
  /** Sombra desenhada sob o objeto. */
  sombra?: Sprite;
  /** Se balança com o vento (vegetação leve). */
  balanca?: boolean;
  /** Desloca a linha de base usada na ordenação (ajuste fino). */
  ajusteBase?: number;
}

/**
 * Coloca um sprite no nível. (x, y) é o ponto de apoio no chão:
 * x no centro horizontal do sprite e y na sua base.
 */
export function colocar(
  nivel: Nivel,
  sprite: Sprite,
  x: number,
  y: number,
  opc: OpcoesObjeto = {},
): { objeto: ObjetoCenario; colisor?: Colisor } {
  const px = Math.round(x - sprite.width / 2);
  const py = Math.round(y - sprite.height);
  const objeto: ObjetoCenario = {
    sprite,
    x: px,
    y: py,
    base: y + (opc.ajusteBase ?? 0),
    balanca: opc.balanca,
    sombra: opc.sombra,
  };
  nivel.adicionarObjeto(objeto);
  let colisor: Colisor | undefined;
  if (opc.colisao) {
    colisor = nivel.adicionarColisor({
      x: Math.round(x - opc.colisao.w / 2),
      y: Math.round(y - opc.colisao.h),
      w: opc.colisao.w,
      h: opc.colisao.h,
    });
  }
  return { objeto, colisor };
}
