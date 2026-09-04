/**
 * Caixa de diálogo com efeito de máquina de escrever.
 * Usada na cinemática de abertura e nos avisos longos.
 */

import { desenharPainel } from '../gfx/sprites/ui';
import { quebrarTexto, paragrafo, texto, ALTURA_LINHA } from '../gfx/font';
import { P } from '../gfx/palette';
import { LARGURA, ALTURA } from '../core/screen';
import type { Sprite } from '../gfx/pixel';

const LARG = 380;
const MARGEM = 10;

export class CaixaDialogo {
  private painel: Sprite | null = null;
  private linhas: string[] = [];
  private falante = '';
  private visiveis = 0;
  private tempo = 0;
  ativa = false;
  /** Caracteres por segundo. */
  velocidade = 42;

  mostrar(falante: string, txt: string): void {
    this.falante = falante;
    this.linhas = quebrarTexto(txt, LARG - MARGEM * 2 - 4);
    this.visiveis = 0;
    this.tempo = 0;
    this.ativa = true;
  }

  fechar(): void {
    this.ativa = false;
  }

  get completa(): boolean {
    return this.visiveis >= this.totalCaracteres;
  }

  private get totalCaracteres(): number {
    return this.linhas.reduce((s, l) => s + l.length, 0);
  }

  /** Revela o texto inteiro de uma vez. */
  apressar(): void {
    this.visiveis = this.totalCaracteres;
  }

  atualizar(dt: number): void {
    if (!this.ativa) return;
    this.tempo += dt;
    this.visiveis = Math.min(this.totalCaracteres, this.visiveis + this.velocidade * dt);
  }

  desenhar(g: CanvasRenderingContext2D): void {
    if (!this.ativa) return;
    const alt = MARGEM * 2 + this.linhas.length * ALTURA_LINHA + (this.falante ? ALTURA_LINHA + 2 : 0);
    if (!this.painel || this.painel.height !== alt) this.painel = desenharPainel(LARG, alt);
    const x = Math.round((LARGURA - LARG) / 2);
    const y = ALTURA - alt - 12;
    g.drawImage(this.painel, x, y);

    let cy = y + MARGEM;
    if (this.falante) {
      texto(g, this.falante, x + MARGEM, cy, { cor: P.ambar, sombra: P.contorno });
      cy += ALTURA_LINHA + 2;
    }

    // recorta o texto conforme a máquina de escrever
    let restante = Math.floor(this.visiveis);
    const parciais: string[] = [];
    for (const l of this.linhas) {
      if (restante <= 0) break;
      parciais.push(l.slice(0, restante));
      restante -= l.length;
    }
    paragrafo(g, parciais, x + MARGEM, cy, { cor: P.osso, sombra: P.contorno });

    if (this.completa) {
      const piscar = Math.floor(this.tempo * 3) % 2 === 0;
      if (piscar) {
        texto(g, '↓', x + LARG - MARGEM - 6, y + alt - MARGEM - 6, {
          cor: P.ambar,
          sombra: P.contorno,
        });
      }
    }
  }
}
