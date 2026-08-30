import type { RaceCar } from '../entities/car';
import type { Track } from '../track/track';

export function drawMinimap(canvas: HTMLCanvasElement, track: Track, cars: RaceCar[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of track.samples) {
    if (s.x < minX) minX = s.x;
    if (s.x > maxX) maxX = s.x;
    if (s.y < minY) minY = s.y;
    if (s.y > maxY) maxY = s.y;
  }
  const pad = 10;
  const scaleX = (w - pad * 2) / (maxX - minX);
  const scaleY = (h - pad * 2) / (maxY - minY);
  const scale = Math.min(scaleX, scaleY);
  const ox = pad + (w - pad * 2 - (maxX - minX) * scale) / 2;
  const oy = pad + (h - pad * 2 - (maxY - minY) * scale) / 2;
  const map = (x: number, y: number) => ({ x: ox + (x - minX) * scale, y: oy + (y - minY) * scale });

  ctx.strokeStyle = '#e9eef3';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  track.samples.forEach((s, i) => {
    const p = map(s.x, s.y);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.stroke();

  const startP = map(track.samples[0].x, track.samples[0].y);
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(startP.x - 2, startP.y - 2, 4, 4);

  for (const car of cars) {
    const p = map(car.body.x, car.body.y);
    ctx.fillStyle = car.isPlayer ? '#3ce6ff' : '#ffcc4d';
    ctx.beginPath();
    ctx.arc(p.x, p.y, car.isPlayer ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
