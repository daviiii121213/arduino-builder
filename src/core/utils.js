// Small math / helper toolbox shared by every system.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const mod = (a, n) => ((a % n) + n) % n;

export function approach(cur, target, step) {
  if (cur < target) return Math.min(cur + step, target);
  if (cur > target) return Math.max(cur - step, target);
  return target;
}

/** Shortens 128000 -> "128k" for money/stat readouts. */
export function shortNum(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return Math.round(n).toString();
}

export function money(n) {
  const neg = n < 0;
  const s = shortNum(Math.abs(n));
  return (neg ? '-$' : '$') + s;
}

export function timeStr(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}

export function pick(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length) % arr.length]; }

export function rectHit(x, y, r) {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
}

/** Directions: 0=N 1=E 2=S 3=W */
export const DIRS = [
  { x: 0, y: -1, name: 'N' },
  { x: 1, y: 0, name: 'E' },
  { x: 0, y: 1, name: 'S' },
  { x: -1, y: 0, name: 'W' },
];

export function rotateFootprint(w, h, dir) {
  return dir % 2 === 0 ? { w, h } : { w: h, h: w };
}

export class EventBus {
  constructor() { this.map = new Map(); }
  on(k, fn) { (this.map.get(k) || this.map.set(k, []).get(k)).push(fn); return fn; }
  off(k, fn) { const a = this.map.get(k); if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } }
  emit(k, payload) { const a = this.map.get(k); if (a) for (const fn of a.slice()) fn(payload); }
}
