/**
 * Colisão top-down: cada criatura tem uma "pegada" retangular nos pés.
 * O movimento é resolvido eixo por eixo, o que dá aquele deslize suave ao
 * andar encostado numa parede.
 */

import { TAM_TILE } from '../gfx/sprites/terrain';
import type { Nivel } from '../world/level';
import { rectsOverlap, type Rect } from '../core/math';

export interface Pegada {
  /** Centro da pegada (ponto de contato com o chão). */
  x: number;
  y: number;
  /** Meia largura e meia altura da pegada. */
  metadeW: number;
  metadeH: number;
  /** Criaturas aquáticas só se movem dentro da água. */
  podeNadar?: boolean;
  /** Ignora os colisores de objetos (usado por criaturas voadoras/mágicas). */
  ignoraObjetos?: boolean;
}

function retangulo(p: Pegada, x: number, y: number): Rect {
  return { x: x - p.metadeW, y: y - p.metadeH, w: p.metadeW * 2, h: p.metadeH * 2 };
}

/** Verifica se a pegada cabe livremente na posição pedida. */
export function livre(nivel: Nivel, p: Pegada, x: number, y: number): boolean {
  const r = retangulo(p, x, y);
  const tx0 = Math.floor(r.x / TAM_TILE);
  const tx1 = Math.floor((r.x + r.w - 0.001) / TAM_TILE);
  const ty0 = Math.floor(r.y / TAM_TILE);
  const ty1 = Math.floor((r.y + r.h - 0.001) / TAM_TILE);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const cx = tx * TAM_TILE + TAM_TILE / 2;
      const cy = ty * TAM_TILE + TAM_TILE / 2;
      if (nivel.bloqueadoEm(cx, cy, p.podeNadar)) return false;
    }
  }

  if (!p.ignoraObjetos) {
    for (const c of nivel.colisores) {
      if (c.ativo === false) continue;
      if (rectsOverlap(r, c)) return false;
    }
  }
  return true;
}

export interface ResultadoMovimento {
  x: number;
  y: number;
  bateuX: boolean;
  bateuY: boolean;
}

/** Move a pegada em (dx, dy), resolvendo cada eixo separadamente. */
export function mover(nivel: Nivel, p: Pegada, dx: number, dy: number): ResultadoMovimento {
  let x = p.x;
  let y = p.y;
  let bateuX = false;
  let bateuY = false;

  if (dx !== 0) {
    // passos pequenos evitam atravessar paredes em velocidade alta
    const passos = Math.max(1, Math.ceil(Math.abs(dx) / 4));
    const inc = dx / passos;
    for (let i = 0; i < passos; i++) {
      if (livre(nivel, p, x + inc, y)) x += inc;
      else {
        bateuX = true;
        break;
      }
    }
  }
  if (dy !== 0) {
    const passos = Math.max(1, Math.ceil(Math.abs(dy) / 4));
    const inc = dy / passos;
    for (let i = 0; i < passos; i++) {
      if (livre(nivel, p, x, y + inc)) y += inc;
      else {
        bateuY = true;
        break;
      }
    }
  }
  return { x, y, bateuX, bateuY };
}

/** Empurra a pegada para fora de um ponto (separação entre criaturas). */
export function separar(
  nivel: Nivel,
  p: Pegada,
  outroX: number,
  outroY: number,
  distanciaMin: number,
  forca: number,
): { x: number; y: number } {
  const dx = p.x - outroX;
  const dy = p.y - outroY;
  const d = Math.hypot(dx, dy);
  if (d >= distanciaMin || d === 0) return { x: p.x, y: p.y };
  const empurra = (distanciaMin - d) * forca;
  const nx = (dx / d) * empurra;
  const ny = (dy / d) * empurra;
  const r = mover(nivel, p, nx, ny);
  return { x: r.x, y: r.y };
}
