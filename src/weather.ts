import { makeCanvas, ctx2d, rng } from './pixel';
import type { Vec } from './math';

export type WeatherId = 'sunny' | 'rain' | 'night';

export interface WeatherDef {
  id: WeatherId;
  name: string;
  namePt: string;
  blurb: string;
  blurbPt: string;
  /** Multiplies the surface grip: rain makes everything slide. */
  gripMul: number;
  /** Multiplies top speed. */
  speedMul: number;
  /** 1 = full daylight; lower darkens the world and shortens sight lines. */
  visibility: number;
  /** Swatch shown on the weather picker. */
  tint: string;
}

export const WEATHERS: WeatherDef[] = [
  {
    id: 'sunny',
    name: 'SUNNY',
    namePt: 'SOL',
    blurb: 'Dry line, full grip, clear sight. Racing as intended.',
    blurbPt: 'Pista seca, aderência total, tudo à vista. Corrida como deve ser.',
    gripMul: 1,
    speedMul: 1,
    visibility: 1,
    tint: '#f2c14e',
  },
  {
    id: 'rain',
    name: 'RAIN',
    namePt: 'CHUVA',
    blurb: 'Standing water. The car steps out early and the braking zones grow.',
    blurbPt: 'Água na pista. O carro escapa cedo e a frenagem fica bem mais longa.',
    gripMul: 0.7,
    speedMul: 0.94,
    visibility: 0.86,
    tint: '#5b8fc9',
  },
  {
    id: 'night',
    name: 'NIGHT',
    namePt: 'NOITE',
    blurb: 'Headlights only. You corner on what the beam shows you.',
    blurbPt: 'Só os faróis. Você faz a curva com o que o facho mostrar.',
    gripMul: 0.94,
    speedMul: 1,
    visibility: 0.32,
    tint: '#3b3f78',
  },
];

export const DEFAULT_WEATHER = WEATHERS[0];

export function weatherById(id: WeatherId): WeatherDef {
  return WEATHERS.find((w) => w.id === id) ?? DEFAULT_WEATHER;
}

interface Drop {
  x: number;
  y: number;
  len: number;
  speed: number;
}

export interface LightSource {
  pos: Vec;
  heading: number;
  /** Player headlights reach further than the AI's. */
  strength: number;
}

/**
 * Draws the weather over the finished frame: rain streaks and a cold veil, or
 * night darkness punched through by each car's headlights.
 */
export class WeatherFx {
  private drops: Drop[] = [];
  private splashes: Array<{ x: number; y: number; life: number }> = [];
  private rand = rng(90210);
  private mask: HTMLCanvasElement | null = null;
  private maskCtx: CanvasRenderingContext2D | null = null;
  private w = 0;
  private h = 0;
  private flicker = 0;

  private resize(w: number, h: number): void {
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    this.mask = makeCanvas(w, h);
    this.maskCtx = ctx2d(this.mask);
    this.drops = [];
    const count = Math.round((w * h) / 620);
    for (let i = 0; i < count; i++) {
      this.drops.push({
        x: this.rand() * w,
        y: this.rand() * h,
        len: 4 + Math.floor(this.rand() * 4),
        speed: 420 + this.rand() * 260,
      });
    }
  }

  update(dt: number, weather: WeatherDef, w: number, h: number): void {
    this.resize(w, h);
    this.flicker += dt;
    if (weather.id !== 'rain') return;
    // Rain falls at a slant; drops that leave the view come back at the top.
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.speed * 0.32 * dt;
      if (d.y > h) {
        d.y = -d.len;
        d.x = this.rand() * (w + 200);
      }
      if (d.x < -8) d.x += w + 8;
    }
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      this.splashes[i].life -= dt;
      if (this.splashes[i].life <= 0) this.splashes.splice(i, 1);
    }
    if (this.splashes.length < 40) {
      for (let i = 0; i < 3; i++) {
        this.splashes.push({ x: this.rand() * w, y: this.rand() * h, life: 0.12 + this.rand() * 0.1 });
      }
    }
  }

  /** Rain and night both paint on top of the world, after the cars. */
  draw(g: CanvasRenderingContext2D, weather: WeatherDef, lights: LightSource[]): void {
    if (weather.id === 'rain') this.drawRain(g);
    else if (weather.id === 'night') this.drawNight(g, lights);
  }

  private drawRain(g: CanvasRenderingContext2D): void {
    // Cold veil first, so the whole scene reads as wet and overcast.
    g.fillStyle = 'rgba(24,42,72,0.34)';
    g.fillRect(0, 0, this.w, this.h);

    g.fillStyle = 'rgba(196,220,246,0.6)';
    for (const d of this.drops) {
      const x = Math.round(d.x);
      const y = Math.round(d.y);
      // One-pixel-wide slanted streak: pure pixel art, no line antialiasing.
      for (let i = 0; i < d.len; i++) g.fillRect(x - Math.floor(i * 0.3), y + i, 1, 1);
    }

    g.fillStyle = 'rgba(206,228,248,0.5)';
    for (const s of this.splashes) {
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 1, y, 1, 1);
      g.fillRect(x, y - 1, 1, 1);
    }
  }

  private drawNight(g: CanvasRenderingContext2D, lights: LightSource[]): void {
    const mask = this.mask;
    const mg = this.maskCtx;
    if (!mask || !mg) return;

    mg.clearRect(0, 0, this.w, this.h);
    mg.fillStyle = 'rgba(6,8,20,0.88)';
    mg.fillRect(0, 0, this.w, this.h);

    // Punch the darkness out around each car and along its headlight beam.
    mg.globalCompositeOperation = 'destination-out';
    for (const light of lights) {
      const { pos, heading, strength } = light;
      const glow = mg.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 42 * strength);
      glow.addColorStop(0, 'rgba(0,0,0,0.95)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      mg.fillStyle = glow;
      mg.beginPath();
      mg.arc(pos.x, pos.y, 42 * strength, 0, Math.PI * 2);
      mg.fill();

      const reach = 150 * strength;
      const spread = 0.42;
      const beam = mg.createRadialGradient(pos.x, pos.y, 10, pos.x, pos.y, reach);
      beam.addColorStop(0, 'rgba(0,0,0,0.95)');
      beam.addColorStop(0.55, 'rgba(0,0,0,0.72)');
      beam.addColorStop(1, 'rgba(0,0,0,0)');
      mg.fillStyle = beam;
      mg.beginPath();
      mg.moveTo(pos.x, pos.y);
      mg.arc(pos.x, pos.y, reach, heading - spread, heading + spread);
      mg.closePath();
      mg.fill();
    }
    mg.globalCompositeOperation = 'source-over';

    g.drawImage(mask, 0, 0);

    // A warm wash inside the beams so headlights read as light, not just a hole.
    g.globalCompositeOperation = 'lighter';
    for (const light of lights) {
      const { pos, heading, strength } = light;
      const reach = 140 * strength;
      const beam = g.createRadialGradient(pos.x, pos.y, 6, pos.x, pos.y, reach);
      beam.addColorStop(0, 'rgba(255,236,170,0.30)');
      beam.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = beam;
      g.beginPath();
      g.moveTo(pos.x, pos.y);
      g.arc(pos.x, pos.y, reach, heading - 0.4, heading + 0.4);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
}
