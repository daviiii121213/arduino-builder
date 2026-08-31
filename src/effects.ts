import { rng } from './pixel';
import type { Vec } from './math';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

const rand = rng(4242);

/** Chunky pixel dust/smoke puffs kicked up by the cars. */
export class Particles {
  private items: Particle[] = [];

  spawn(pos: Vec, dir: Vec, color: string, count = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.items.length > 400) return;
      const life = 0.35 + rand() * 0.5;
      this.items.push({
        x: pos.x,
        y: pos.y,
        vx: -dir.x * (0.1 + rand() * 0.2) + (rand() - 0.5) * 40,
        vy: -dir.y * (0.1 + rand() * 0.2) + (rand() - 0.5) * 40,
        life,
        maxLife: life,
        color,
        size: rand() < 0.5 ? 2 : 3,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }

  draw(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    for (const p of this.items) {
      g.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife)) * 0.7;
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x - camX), Math.round(p.y - camY), p.size, p.size);
    }
    g.globalAlpha = 1;
  }

  clear(): void {
    this.items.length = 0;
  }
}
