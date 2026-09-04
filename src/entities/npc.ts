/**
 * Pessoas da cabana de melhorias.
 *
 * Ficam nas suas estações de trabalho, com animação de trabalho contínua e um
 * balão avisando que dá para conversar. Cada uma atende uma categoria de
 * melhoria — acrescentar um NPC novo é só somar uma entrada em npcs.ts.
 */

import type { Sprite } from '../gfx/pixel';
import { texto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Vendedor } from '../systems/progression';

export class Npc {
  private tempo = 0;
  private balaoSalto = 0;

  constructor(
    readonly nome: string,
    readonly oficio: string,
    readonly vendedor: Vendedor,
    readonly x: number,
    readonly y: number,
    private quadros: Sprite[],
    /** Frases ditas ao abrir a conversa. */
    readonly falas: string[],
  ) {}

  get baseY(): number {
    return this.y;
  }

  atualizar(dt: number): void {
    this.tempo += dt;
    this.balaoSalto = Math.abs(Math.sin(this.tempo * 2)) * 2;
  }

  desenhar(
    g: CanvasRenderingContext2D,
    assets: Assets,
    camX: number,
    camY: number,
    perto: boolean,
  ): void {
    const q = this.quadros[Math.floor(this.tempo * 2.4) % this.quadros.length];
    const px = Math.round(this.x - q.width / 2 - camX);
    const py = Math.round(this.y - q.height - camY);

    const sombra = assets.sombras.m;
    g.globalAlpha = 0.45;
    g.drawImage(sombra, Math.round(this.x - sombra.width / 2 - camX), Math.round(this.y - camY) - 3);
    g.globalAlpha = 1;
    g.drawImage(q, px, py);

    // balão de conversa
    const balao = assets.cabana.balao;
    g.drawImage(
      balao,
      Math.round(this.x + 6 - camX),
      Math.round(py - balao.height - 1 - (perto ? this.balaoSalto : 0)),
    );

    if (perto) {
      texto(g, this.nome, Math.round(this.x - camX), py - balao.height - 11, {
        cor: P.osso,
        sombra: P.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
    }
  }
}
