/** Câmera com seguimento suave, limites de mapa e tremor de impacto. */

import { clamp, damp } from './math';
import { LARGURA, ALTURA } from './screen';
import { Rng } from './rng';

export class Camera {
  x = 0;
  y = 0;
  private tremorForca = 0;
  private tremorTempo = 0;
  private offX = 0;
  private offY = 0;
  private rng = new Rng(99);

  limiteW = LARGURA;
  limiteH = ALTURA;

  definirLimites(w: number, h: number): void {
    this.limiteW = w;
    this.limiteH = h;
  }

  /** Centraliza imediatamente (troca de mapa, início de cena). */
  focar(cx: number, cy: number): void {
    this.x = cx - LARGURA / 2;
    this.y = cy - ALTURA / 2;
    this.aplicarLimites();
  }

  seguir(cx: number, cy: number, dt: number, velocidade = 8): void {
    const alvoX = cx - LARGURA / 2;
    const alvoY = cy - ALTURA / 2;
    this.x = damp(this.x, alvoX, velocidade, dt);
    this.y = damp(this.y, alvoY, velocidade, dt);
    this.aplicarLimites();
  }

  private aplicarLimites(): void {
    if (this.limiteW <= LARGURA) this.x = (this.limiteW - LARGURA) / 2;
    else this.x = clamp(this.x, 0, this.limiteW - LARGURA);
    if (this.limiteH <= ALTURA) this.y = (this.limiteH - ALTURA) / 2;
    else this.y = clamp(this.y, 0, this.limiteH - ALTURA);
  }

  tremer(forca: number, duracao = 0.22): void {
    this.tremorForca = Math.max(this.tremorForca, forca);
    this.tremorTempo = Math.max(this.tremorTempo, duracao);
  }

  atualizar(dt: number): void {
    if (this.tremorTempo > 0) {
      this.tremorTempo -= dt;
      const f = this.tremorForca * Math.max(0, this.tremorTempo / 0.22);
      this.offX = Math.round(this.rng.range(-f, f));
      this.offY = Math.round(this.rng.range(-f, f));
      if (this.tremorTempo <= 0) {
        this.tremorForca = 0;
        this.offX = 0;
        this.offY = 0;
      }
    }
  }

  /** Deslocamento final usado no desenho (inteiro, para não borrar pixels). */
  get desenhoX(): number {
    return Math.round(this.x) + this.offX;
  }

  get desenhoY(): number {
    return Math.round(this.y) + this.offY;
  }

  telaParaMundo(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.desenhoX, y: sy + this.desenhoY };
  }
}
