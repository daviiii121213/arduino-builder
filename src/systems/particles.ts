/**
 * Partículas e efeitos animados.
 *
 * Três listas: pixels soltos (poeira, sangue, folhas, brilhos), animações de
 * sprite (golpe, faíscas, respingos) e textos flutuantes (números de dano).
 */

import { texto as desenharTexto } from '../gfx/font';
import type { Sprite } from '../gfx/pixel';
import { Rng } from '../core/rng';
import { TAU } from '../core/math';

interface Pixel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  vidaMax: number;
  cor: string;
  gravidade: number;
  tam: number;
  /** Altura simulada, para partículas que "pulam" no chão. */
  z: number;
  vz: number;
}

interface Animacao {
  quadros: Sprite[];
  x: number;
  y: number;
  t: number;
  duracao: number;
  rotacao: number;
  /** Segue uma entidade enquanto ela existe. */
  seguir?: { x: number; y: number };
  alphaFinal: number;
}

interface TextoFlutuante {
  txt: string;
  x: number;
  y: number;
  vy: number;
  vida: number;
  vidaMax: number;
  cor: string;
  contorno: string;
}

export class Particulas {
  private pixels: Pixel[] = [];
  private animacoes: Animacao[] = [];
  private textos: TextoFlutuante[] = [];
  private rng = new Rng(31337);

  limpar(): void {
    this.pixels.length = 0;
    this.animacoes.length = 0;
    this.textos.length = 0;
  }

  pixel(
    x: number,
    y: number,
    cor: string,
    opc: {
      vx?: number;
      vy?: number;
      vida?: number;
      gravidade?: number;
      tam?: number;
      z?: number;
      vz?: number;
    } = {},
  ): void {
    const vida = opc.vida ?? 0.5;
    this.pixels.push({
      x,
      y,
      vx: opc.vx ?? 0,
      vy: opc.vy ?? 0,
      vida,
      vidaMax: vida,
      cor,
      gravidade: opc.gravidade ?? 0,
      tam: opc.tam ?? 1,
      z: opc.z ?? 0,
      vz: opc.vz ?? 0,
    });
  }

  /** Explosão de pixels em todas as direções. */
  jato(
    x: number,
    y: number,
    cores: readonly string[],
    quantidade: number,
    forca: number,
    opc: { vida?: number; gravidade?: number; tam?: number } = {},
  ): void {
    for (let i = 0; i < quantidade; i++) {
      const a = this.rng.range(0, TAU);
      const v = this.rng.range(forca * 0.35, forca);
      this.pixel(x, y, this.rng.pick(cores), {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v * 0.7,
        vida: (opc.vida ?? 0.45) * this.rng.range(0.7, 1.3),
        gravidade: opc.gravidade ?? 90,
        tam: opc.tam ?? 1,
        vz: this.rng.range(10, 45),
        z: 1,
      });
    }
  }

  /** Cone de pixels numa direção (respingos de golpe). */
  leque(
    x: number,
    y: number,
    angulo: number,
    abertura: number,
    cores: readonly string[],
    quantidade: number,
    forca: number,
  ): void {
    for (let i = 0; i < quantidade; i++) {
      const a = angulo + this.rng.range(-abertura, abertura);
      const v = this.rng.range(forca * 0.4, forca);
      this.pixel(x, y, this.rng.pick(cores), {
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        vida: this.rng.range(0.2, 0.5),
        gravidade: 40,
        tam: this.rng.chance(0.25) ? 2 : 1,
      });
    }
  }

  animacao(
    quadros: Sprite[],
    x: number,
    y: number,
    duracao: number,
    rotacao = 0,
    alphaFinal = 1,
  ): void {
    this.animacoes.push({ quadros, x, y, t: 0, duracao, rotacao, alphaFinal });
  }

  texto(
    txt: string,
    x: number,
    y: number,
    cor = '#f2e3c2',
    contorno = '#161320',
    vida = 0.8,
  ): void {
    this.textos.push({ txt, x, y, vy: -26, vida, vidaMax: vida, cor, contorno });
  }

  atualizar(dt: number): void {
    for (let i = this.pixels.length - 1; i >= 0; i--) {
      const p = this.pixels[i];
      p.vida -= dt;
      if (p.vida <= 0) {
        this.pixels.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravidade * dt;
      if (p.vz !== 0 || p.z > 0) {
        p.z += p.vz * dt;
        p.vz -= 160 * dt;
        if (p.z < 0) {
          p.z = 0;
          p.vz *= -0.35;
          p.vx *= 0.6;
          p.vy *= 0.6;
        }
      }
    }
    for (let i = this.animacoes.length - 1; i >= 0; i--) {
      const a = this.animacoes[i];
      a.t += dt;
      if (a.t >= a.duracao) this.animacoes.splice(i, 1);
    }
    for (let i = this.textos.length - 1; i >= 0; i--) {
      const t = this.textos[i];
      t.vida -= dt;
      if (t.vida <= 0) {
        this.textos.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy += 42 * dt;
    }
  }

  desenhar(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.pixels) {
      const alpha = Math.min(1, p.vida / p.vidaMax + 0.2);
      g.globalAlpha = alpha;
      g.fillStyle = p.cor;
      g.fillRect(
        Math.round(p.x - camX),
        Math.round(p.y - camY - p.z),
        p.tam,
        p.tam,
      );
    }
    g.globalAlpha = 1;

    for (const a of this.animacoes) {
      const t = Math.min(0.999, a.t / a.duracao);
      const q = a.quadros[Math.floor(t * a.quadros.length)];
      const alpha = 1 + (a.alphaFinal - 1) * t;
      g.globalAlpha = alpha;
      const x = Math.round(a.x - camX);
      const y = Math.round(a.y - camY);
      if (a.rotacao !== 0) {
        g.save();
        g.translate(x, y);
        g.rotate(a.rotacao);
        g.drawImage(q, -q.width / 2, -q.height / 2);
        g.restore();
      } else {
        g.drawImage(q, x - (q.width >> 1), y - (q.height >> 1));
      }
    }
    g.globalAlpha = 1;

    for (const t of this.textos) {
      const f = t.vida / t.vidaMax;
      g.globalAlpha = f > 0.35 ? 1 : f / 0.35;
      desenharTexto(g, t.txt, Math.round(t.x - camX), Math.round(t.y - camY), {
        cor: t.cor,
        sombra: t.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
    }
    g.globalAlpha = 1;
  }
}
