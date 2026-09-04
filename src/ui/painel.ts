/**
 * Peças comuns das janelas do jogo (venda, melhorias, baú).
 * Mantém as três com a mesma moldura, o mesmo cabeçalho e a mesma navegação.
 */

import { desenharPainel } from '../gfx/sprites/ui';
import { texto, larguraTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Sprite } from '../gfx/pixel';
import type { Entrada } from '../core/input';
import type { Assets } from '../gfx/assets';
import { formatarMoedas } from '../systems/economy';
import { pointInRect, type Rect } from '../core/math';

const cache = new Map<string, Sprite>();

/** Moldura de janela, memorizada por tamanho. */
export function moldura(w: number, h: number): Sprite {
  const chave = `${w}x${h}`;
  let s = cache.get(chave);
  if (!s) {
    s = desenharPainel(w, h);
    cache.set(chave, s);
  }
  return s;
}

export function cabecalho(
  g: CanvasRenderingContext2D,
  titulo: string,
  x: number,
  y: number,
  w: number,
): void {
  texto(g, titulo, x + w / 2, y + 9, {
    cor: P.ambar,
    sombra: P.contorno,
    alinhamento: 'centro',
  });
  g.fillStyle = '#3a2f49';
  g.fillRect(x + 8, y + 19, w - 16, 1);
}

export function rodape(
  g: CanvasRenderingContext2D,
  dica: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  g.fillStyle = '#3a2f49';
  g.fillRect(x + 8, y + h - 16, w - 16, 1);
  texto(g, dica, x + w / 2, y + h - 12, {
    cor: '#8b83a3',
    sombra: P.contorno,
    alinhamento: 'centro',
  });
}

/** Faixa de destaque da linha selecionada. */
export function destaque(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ativo = true,
): void {
  g.fillStyle = ativo ? 'rgba(255,199,90,0.16)' : 'rgba(255,255,255,0.05)';
  g.fillRect(x, y, w, h);
  g.fillStyle = ativo ? P.ambar : '#3a2f49';
  g.fillRect(x, y, 1, h);
}

/** Saldo da carteira, com a moeda desenhada. */
export function saldo(
  g: CanvasRenderingContext2D,
  assets: Assets,
  moedas: number,
  x: number,
  y: number,
  alinhamento: 'esquerda' | 'direita' = 'direita',
  infinito = false,
): void {
  const txt = infinito ? '∞' : formatarMoedas(moedas);
  const larg = larguraTexto(txt) + 12;
  const px = alinhamento === 'direita' ? x - larg : x;
  g.drawImage(assets.ferramentas.moeda, Math.round(px), Math.round(y) - 1);
  texto(g, txt, Math.round(px) + 11, y, { cor: P.ambar, sombra: P.contorno });
}

/** Navegação vertical por teclado; devolve o novo índice. */
export function navegar(entrada: Entrada, indice: number, total: number): number {
  if (total <= 0) return 0;
  let i = indice;
  if (entrada.teclaAgora('KeyS', 'ArrowDown')) i++;
  if (entrada.teclaAgora('KeyW', 'ArrowUp')) i--;
  return ((i % total) + total) % total;
}

/** Índice da linha sob o mouse, ou -1. */
export function linhaDoMouse(
  entrada: Entrada,
  x: number,
  y: number,
  w: number,
  alturaLinha: number,
  total: number,
): number {
  for (let i = 0; i < total; i++) {
    const r: Rect = { x, y: y + i * alturaLinha, w, h: alturaLinha };
    if (pointInRect(entrada.mouseX, entrada.mouseY, r)) return i;
  }
  return -1;
}
