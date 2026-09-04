/** Orbe mágica disparada pelos dinossauros mágicos. */

import { P } from '../gfx/palette';
import type { Mundo } from './context';
import { PROPS } from '../world/tiles';
import { dist } from '../core/math';

export class Orbe {
  vivo = true;
  private tempo = 0;
  private vidaMax = 3.2;

  constructor(
    public x: number,
    public y: number,
    private angulo: number,
    private dano: number,
    private velocidade: number,
  ) {}

  atualizar(dt: number, mundo: Mundo): void {
    if (!this.vivo) return;
    this.tempo += dt;
    this.x += Math.cos(this.angulo) * this.velocidade * dt;
    this.y += Math.sin(this.angulo) * this.velocidade * dt;

    // rastro brilhante
    mundo.particulas.pixel(this.x, this.y, P.magiaClara, {
      vida: 0.3,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
    });

    const j = mundo.jogador;
    if (j.vivo && dist(this.x, this.y, j.centroX, j.centroY) < 9) {
      j.receberDano(this.dano, this.x, this.y, mundo);
      this.explodir(mundo);
      return;
    }
    // paredes e rochas param a orbe
    if (PROPS[mundo.nivel.tileEm(this.x, this.y)].solido || this.tempo > this.vidaMax) {
      this.explodir(mundo);
    }
  }

  private explodir(mundo: Mundo): void {
    this.vivo = false;
    mundo.particulas.animacao(mundo.assets.efeitos.explosaoMagica, this.x, this.y, 0.35);
    mundo.particulas.jato(this.x, this.y, [P.magia, P.magiaClara, P.brilho], 12, 80, {
      gravidade: 20,
    });
    mundo.audio.magia();
  }

  desenhar(g: CanvasRenderingContext2D, mundo: Mundo, camX: number, camY: number): void {
    const quadros = mundo.assets.efeitos.orbe;
    const s = quadros[Math.floor(this.tempo * 14) % quadros.length];
    g.drawImage(s, Math.round(this.x - s.width / 2 - camX), Math.round(this.y - s.height / 2 - camY));
  }
}
