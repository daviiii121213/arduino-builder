/**
 * Projétil disparado por criaturas: a orbe mágica de sempre e as variações de
 * caverna (lasca de cristal e brasa) usadas pelos chefes.
 *
 * O estilo só muda a cor do rastro, do estouro e o tom do som — o voo, a
 * colisão e o dano são os mesmos.
 */

import { P } from '../gfx/palette';
import type { Mundo } from './context';
import { PROPS } from '../world/tiles';
import { dist } from '../core/math';
import { tingirCache } from '../gfx/pixel';

export type EstiloOrbe = 'magia' | 'cristal' | 'brasa';

const CORES: Record<EstiloOrbe, { rastro: string; estouro: readonly string[] }> = {
  magia: { rastro: P.magiaClara, estouro: [P.magia, P.magiaClara, P.brilho] },
  cristal: { rastro: '#bfeaf7', estouro: ['#5ad8ff', '#bfeaf7', P.brilho] },
  brasa: { rastro: '#ffb14a', estouro: ['#ff4a12', '#ffb14a', P.brilho] },
};

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
    private estilo: EstiloOrbe = 'magia',
  ) {}

  atualizar(dt: number, mundo: Mundo): void {
    if (!this.vivo) return;
    this.tempo += dt;
    this.x += Math.cos(this.angulo) * this.velocidade * dt;
    this.y += Math.sin(this.angulo) * this.velocidade * dt;

    // rastro brilhante
    mundo.particulas.pixel(this.x, this.y, CORES[this.estilo].rastro, {
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
    mundo.particulas.jato(this.x, this.y, CORES[this.estilo].estouro, 12, 80, {
      gravidade: 20,
    });
    mundo.audio.magia();
  }

  desenhar(g: CanvasRenderingContext2D, mundo: Mundo, camX: number, camY: number): void {
    const quadros = mundo.assets.efeitos.orbe;
    let s = quadros[Math.floor(this.tempo * 14) % quadros.length];
    if (this.estilo !== 'magia') s = tingirCache(s, CORES[this.estilo].rastro, 0.75);
    g.drawImage(s, Math.round(this.x - s.width / 2 - camX), Math.round(this.y - s.height / 2 - camY));
  }
}
