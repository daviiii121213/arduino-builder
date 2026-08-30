export type ParticleKind = 'fumaca' | 'poeira' | 'faisca' | 'nitro' | 'chuva';

export interface Particle {
  kind: ParticleKind;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  color: string;
}

export class ParticleSystem {
  particles: Particle[] = [];

  spawnSmoke(x: number, y: number, intensity = 1): void {
    for (let i = 0; i < 2 * intensity; i++) {
      this.particles.push({
        kind: 'fumaca', x, y,
        vx: (Math.random() - 0.5) * 1.2, vy: (Math.random() - 0.5) * 1.2,
        life: 0.6 + Math.random() * 0.5, maxLife: 1.1,
        size: 0.5 + Math.random() * 0.6,
        color: Math.random() > 0.5 ? '#cfcfcf' : '#9a9a9a',
      });
    }
  }

  spawnDust(x: number, y: number, color = '#b79a5f'): void {
    this.particles.push({
      kind: 'poeira', x, y,
      vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
      life: 0.5, maxLife: 0.5, size: 0.4 + Math.random() * 0.4, color,
    });
  }

  spawnSparks(x: number, y: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      this.particles.push({
        kind: 'faisca', x, y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life: 0.3 + Math.random() * 0.2, maxLife: 0.5,
        size: 0.15, color: Math.random() > 0.5 ? '#ffd24a' : '#ff8a3c',
      });
    }
  }

  spawnNitro(x: number, y: number, angle: number): void {
    const back = angle + Math.PI;
    this.particles.push({
      kind: 'nitro',
      x: x + Math.cos(back) * 1.2, y: y + Math.sin(back) * 1.2,
      vx: Math.cos(back) * 6 + (Math.random() - 0.5), vy: Math.sin(back) * 6 + (Math.random() - 0.5),
      life: 0.25, maxLife: 0.25, size: 0.4, color: Math.random() > 0.5 ? '#3ce6ff' : '#9be9ff',
    });
  }

  spawnRain(worldBounds: { x0: number; y0: number; x1: number; y1: number }): void {
    const x = worldBounds.x0 + Math.random() * (worldBounds.x1 - worldBounds.x0);
    const y = worldBounds.y0 + Math.random() * (worldBounds.y1 - worldBounds.y0);
    this.particles.push({
      kind: 'chuva', x, y, vx: -4, vy: 22,
      life: 1, maxLife: 1, size: 0.15, color: '#bcd4e6',
    });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.kind === 'fumaca') p.size += dt * 0.8;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }
}
