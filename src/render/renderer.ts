import type { RaceCar } from '../entities/car';
import type { TimeOfDay } from '../data/types';
import type { Track } from '../track/track';
import type { WeatherState } from '../systems/weather';
import { Camera } from './camera';
import { carSprite, decorationSprite } from './pixelArt';
import type { ParticleSystem } from './particles';

const CAR_LENGTH_M = 4.4;
const CAR_WIDTH_M = 1.9;

const DECOR_SIZE_M: Record<string, { w: number; h: number }> = {
  arvore: { w: 3.2, h: 3.6 },
  casa: { w: 8, h: 6.4 },
  fazenda_casa: { w: 8, h: 6.4 },
  fazenda_celeiro: { w: 9, h: 7.4 },
  silo: { w: 4, h: 8 },
  cerca: { w: 8, h: 2.4 },
  arquibancada: { w: 16, h: 6.8 },
  boxes: { w: 13, h: 7.6 },
  ponte: { w: 18, h: 10.6 },
  barreira: { w: 3.4, h: 1.7 },
  posto: { w: 11, h: 6.8 },
};
function decorSize(type: string): { w: number; h: number } {
  if (DECOR_SIZE_M[type]) return DECOR_SIZE_M[type];
  if (type.startsWith('placa_')) return { w: 2, h: 2.8 };
  return { w: 3, h: 3 };
}

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D, private camera: Camera) {}

  clear(time: TimeOfDay, w: number, h: number): void {
    const ctx = this.ctx;
    const sky = time === 'night' ? ['#0c1420', '#0c1420'] : time === 'evening' ? ['#3a5b3f', '#3a5b3f'] : ['#3f7a44', '#3f7a44'];
    ctx.fillStyle = sky[0];
    ctx.fillRect(0, 0, w, h);
  }

  private w2s(x: number, y: number, w: number, h: number) {
    return this.camera.worldToScreen(x, y, w, h);
  }

  drawTrack(track: Track, w: number, h: number): void {
    const ctx = this.ctx;
    const n = track.samples.length;
    for (let i = 0; i < n; i++) {
      const a = track.samples[i];
      const b = track.samples[(i + 1) % n];
      const pa = perp(a.angle);
      const pb = perp(b.angle);
      const a0 = this.w2s(a.x + pa.x * a.halfWidth, a.y + pa.y * a.halfWidth, w, h);
      const a1 = this.w2s(a.x - pa.x * a.halfWidth, a.y - pa.y * a.halfWidth, w, h);
      const b0 = this.w2s(b.x + pb.x * b.halfWidth, b.y + pb.y * b.halfWidth, w, h);
      const b1 = this.w2s(b.x - pb.x * b.halfWidth, b.y - pb.y * b.halfWidth, w, h);

      ctx.fillStyle = a.surface === 'terra' ? '#8a6a3e' : '#4b4f57';
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y);
      ctx.lineTo(b0.x, b0.y);
      ctx.lineTo(b1.x, b1.y);
      ctx.lineTo(a1.x, a1.y);
      ctx.closePath();
      ctx.fill();

      // subtle centerline texture speckle
      if (i % 2 === 0) {
        ctx.fillStyle = a.surface === 'terra' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.04)';
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(b0.x, b0.y);
        ctx.lineTo(b1.x, b1.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // white-and-red boundary curb (the official track limit)
    const dashLen = 4; // meters
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const a = track.samples[i];
      const b = track.samples[(i + 1) % n];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      const dashIdx = Math.floor(acc / dashLen);
      const color = dashIdx % 2 === 0 ? '#e9eef3' : '#d1332b';
      for (const side of [1, -1]) {
        const pa = perp(a.angle);
        const pb = perp(b.angle);
        const outerA = this.w2s(a.x + pa.x * a.halfWidth * side, a.y + pa.y * a.halfWidth * side, w, h);
        const outerB = this.w2s(b.x + pb.x * b.halfWidth * side, b.y + pb.y * b.halfWidth * side, w, h);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, this.camera.zoom * 0.35);
        ctx.beginPath();
        ctx.moveTo(outerA.x, outerA.y);
        ctx.lineTo(outerB.x, outerB.y);
        ctx.stroke();
      }
      acc += seg;
    }

    // start/finish checkered line
    const start = track.samples[0];
    const perpS = perp(start.angle);
    ctx.save();
    const p0 = this.w2s(start.x + perpS.x * start.halfWidth, start.y + perpS.y * start.halfWidth, w, h);
    const p1 = this.w2s(start.x - perpS.x * start.halfWidth, start.y - perpS.y * start.halfWidth, w, h);
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#111' : '#eee';
      const t0 = i / segs, t1 = (i + 1) / segs;
      ctx.beginPath();
      ctx.moveTo(lerp(p0.x, p1.x, t0), lerp(p0.y, p1.y, t0));
      ctx.lineTo(lerp(p0.x, p1.x, t1), lerp(p0.y, p1.y, t1));
      ctx.lineTo(lerp(p0.x, p1.x, t1) + Math.cos(start.angle) * this.camera.zoom * 1.2, lerp(p0.y, p1.y, t1) + Math.sin(start.angle) * this.camera.zoom * 1.2);
      ctx.lineTo(lerp(p0.x, p1.x, t0) + Math.cos(start.angle) * this.camera.zoom * 1.2, lerp(p0.y, p1.y, t0) + Math.sin(start.angle) * this.camera.zoom * 1.2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawDecorations(track: Track, w: number, h: number): void {
    const ctx = this.ctx;
    const sorted = [...track.decorations].sort((a, b) => a.y - b.y);
    for (const d of sorted) {
      const sprite = decorationSprite(d.type);
      const size = decorSize(d.type);
      const pos = this.w2s(d.x, d.y, w, h);
      const dw = size.w * d.scale * this.camera.zoom;
      const dh = size.h * d.scale * this.camera.zoom;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      if (d.type === 'ponte' || d.type === 'barreira') ctx.rotate(d.angle);
      ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  drawPuddles(weather: WeatherState, w: number, h: number): void {
    if (!weather.puddles.length) return;
    const ctx = this.ctx;
    for (const p of weather.puddles) {
      const pos = this.w2s(p.x, p.y, w, h);
      ctx.fillStyle = 'rgba(120,170,210,0.45)';
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y, p.radius * this.camera.zoom, p.radius * this.camera.zoom * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCars(cars: RaceCar[], w: number, h: number, time: TimeOfDay): void {
    const ctx = this.ctx;
    for (const car of cars) {
      const pos = this.w2s(car.body.x, car.body.y, w, h);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(pos.x + 2, pos.y + 3, CAR_LENGTH_M * this.camera.zoom * 0.42, CAR_WIDTH_M * this.camera.zoom * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();

      if (time === 'night') {
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(car.body.angle);
        const grad = ctx.createRadialGradient(CAR_LENGTH_M * this.camera.zoom * 0.5, 0, 2, CAR_LENGTH_M * this.camera.zoom * 0.5, 0, CAR_LENGTH_M * this.camera.zoom * 3.2);
        grad.addColorStop(0, 'rgba(255,244,200,0.35)');
        grad.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(CAR_LENGTH_M * this.camera.zoom * 1.8, 0, CAR_LENGTH_M * this.camera.zoom * 3, CAR_WIDTH_M * this.camera.zoom * 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const sprite = carSprite(car.def);
      const dw = CAR_LENGTH_M * this.camera.zoom;
      const dh = CAR_WIDTH_M * this.camera.zoom;
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(car.body.angle);
      ctx.drawImage(sprite, -dw / 2, -dh / 2, dw, dh);
      if (car.nitro > 0 && (car as any)._nitroActive) {
        ctx.fillStyle = 'rgba(60,230,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(-dw / 2 - 4, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (car.isPlayer) {
        ctx.strokeStyle = '#3ce6ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, Math.max(dw, dh) * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawParticles(particles: ParticleSystem, w: number, h: number): void {
    const ctx = this.ctx;
    for (const p of particles.particles) {
      const pos = this.w2s(p.x, p.y, w, h);
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const size = p.size * this.camera.zoom;
      if (p.kind === 'chuva') {
        ctx.fillRect(pos.x, pos.y, 1.5, 10);
      } else {
        ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  drawWeatherOverlay(weather: WeatherState, w: number, h: number): void {
    const ctx = this.ctx;
    if (weather.weather === 'storm') {
      ctx.fillStyle = 'rgba(10,14,20,0.28)';
      ctx.fillRect(0, 0, w, h);
    } else if (weather.weather === 'rain') {
      ctx.fillStyle = 'rgba(10,20,30,0.12)';
      ctx.fillRect(0, 0, w, h);
    }
    if (weather.time === 'night') {
      ctx.fillStyle = 'rgba(4,8,16,0.55)';
      ctx.fillRect(0, 0, w, h);
    } else if (weather.time === 'evening') {
      ctx.fillStyle = 'rgba(60,30,20,0.18)';
      ctx.fillRect(0, 0, w, h);
    }
  }
}

function perp(angle: number): { x: number; y: number } {
  return { x: Math.cos(angle + Math.PI / 2), y: Math.sin(angle + Math.PI / 2) };
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
