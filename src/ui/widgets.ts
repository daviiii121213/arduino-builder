/** Componentes reutilizáveis de interface: texto ampliado e botões. */

import { criarCanvas, ctx2d, tingirCache, type Sprite } from '../gfx/pixel';
import { texto, larguraTexto, type OpcoesTexto } from '../gfx/font';
import { desenharBotao } from '../gfx/sprites/ui';
import { P } from '../gfx/palette';
import { pointInRect, type Rect } from '../core/math';
import type { Entrada } from '../core/input';

const cacheGrande = new Map<string, Sprite>();

/**
 * Texto em escala inteira (mantém os pixels quadrados).
 *
 * A sombra é aplicada depois da ampliação, com o mesmo deslocamento da escala:
 * é o que dá aquele contorno grosso e limpo dos títulos de RPG em pixel art
 * (um contorno de 1px ampliado 5x grudaria as letras).
 */
export function textoGrande(
  g: CanvasRenderingContext2D,
  txt: string,
  x: number,
  y: number,
  escala: number,
  opc: OpcoesTexto = {},
): number {
  const espaco = opc.espaco ?? 2;
  const chave = `${txt}|${escala}|${espaco}|${opc.cor ?? ''}`;
  let s = cacheGrande.get(chave);
  if (!s) {
    const larg = larguraTexto(txt, espaco) + 2;
    const alt = 12;
    const cv = criarCanvas(larg, alt);
    const gg = ctx2d(cv);
    texto(gg, txt, 1, 2, { cor: opc.cor, espaco });
    const dest = criarCanvas(larg * escala, alt * escala);
    const gd = ctx2d(dest);
    gd.imageSmoothingEnabled = false;
    gd.drawImage(cv, 0, 0, larg * escala, alt * escala);
    s = dest;
    cacheGrande.set(chave, s);
  }
  let px = x;
  if (opc.alinhamento === 'centro') px = x - s.width / 2;
  else if (opc.alinhamento === 'direita') px = x - s.width;
  px = Math.round(px);
  const py = Math.round(y);
  if (opc.sombra) {
    const sombra = tingirCache(s, opc.sombra, 1);
    const d = Math.max(1, Math.round(escala / 2));
    if (opc.contorno) {
      for (const [dx, dy] of [
        [-d, 0],
        [d, 0],
        [0, -d],
        [0, d],
      ]) {
        g.drawImage(sombra, px + dx, py + dy);
      }
    } else {
      g.drawImage(sombra, px + d, py + d);
    }
  }
  g.drawImage(s, px, py);
  return s.width;
}

export class Botao {
  readonly area: Rect;
  aceso = false;
  private artes: [Sprite, Sprite];

  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    public rotulo: string,
    public acao: () => void,
    public dica = '',
  ) {
    this.area = { x, y, w, h };
    this.artes = [desenharBotao(w, h, false), desenharBotao(w, h, true)];
  }

  contem(mx: number, my: number): boolean {
    return pointInRect(mx, my, this.area);
  }

  desenhar(g: CanvasRenderingContext2D): void {
    g.drawImage(this.artes[this.aceso ? 1 : 0], this.area.x, this.area.y);
    const cy = this.area.y + Math.floor((this.area.h - 7) / 2);
    texto(g, this.rotulo, this.area.x + this.area.w / 2, cy, {
      cor: this.aceso ? P.contorno : P.osso,
      sombra: this.aceso ? '#e0b070' : P.contorno,
      alinhamento: 'centro',
    });
  }
}

/** Navegação por teclado + mouse numa lista vertical de botões. */
export class ListaBotoes {
  indice = 0;

  constructor(public botoes: Botao[]) {}

  atualizar(entrada: Entrada, aoMover?: () => void, aoConfirmar?: () => void): void {
    const antes = this.indice;
    if (entrada.teclaAgora('KeyS', 'ArrowDown')) this.indice = (this.indice + 1) % this.botoes.length;
    if (entrada.teclaAgora('KeyW', 'ArrowUp'))
      this.indice = (this.indice - 1 + this.botoes.length) % this.botoes.length;

    // o mouse manda quando está sobre um botão
    this.botoes.forEach((b, i) => {
      if (b.contem(entrada.mouseX, entrada.mouseY)) this.indice = i;
    });
    if (this.indice !== antes) aoMover?.();

    this.botoes.forEach((b, i) => (b.aceso = i === this.indice));

    const clicou =
      entrada.botaoAgora(0) && this.botoes[this.indice].contem(entrada.mouseX, entrada.mouseY);
    if (clicou || entrada.teclaAgora('Enter', 'Space', 'NumpadEnter')) {
      aoConfirmar?.();
      this.botoes[this.indice].acao();
    }
  }

  desenhar(g: CanvasRenderingContext2D): void {
    for (const b of this.botoes) b.desenhar(g);
  }
}
