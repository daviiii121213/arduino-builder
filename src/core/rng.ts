/**
 * Gerador pseudoaleatório determinístico (mulberry32).
 * Usado para gerar o mundo e as texturas de pixel art sempre iguais.
 */
export class Rng {
  private state: number;

  constructor(seed = 1337) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
}

/** Ruído de valor 2D suave, para relevo e manchas de terreno. */
export class ValueNoise {
  private perm: Float32Array;
  private readonly size = 256;

  constructor(seed = 7) {
    const rng = new Rng(seed);
    this.perm = new Float32Array(this.size * this.size);
    for (let i = 0; i < this.perm.length; i++) this.perm[i] = rng.next();
  }

  private at(ix: number, iy: number): number {
    const x = ((ix % this.size) + this.size) % this.size;
    const y = ((iy % this.size) + this.size) % this.size;
    return this.perm[y * this.size + x];
  }

  /** Amostra suavizada em [0,1]. */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = this.at(x0, y0);
    const b = this.at(x0 + 1, y0);
    const c = this.at(x0, y0 + 1);
    const d = this.at(x0 + 1, y0 + 1);
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  }

  /** Soma de oitavas — dá contornos mais orgânicos ao mapa. */
  fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5): number {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.sample(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}
