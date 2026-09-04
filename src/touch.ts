/**
 * On-screen controls for phones and tablets: two analog sticks (left steers,
 * right is throttle and brake) plus a nitro button and a handbrake button.
 *
 * The pads are drawn into the same low-resolution buffer as the rest of the
 * game, but they are sized in CSS pixels so a thumb always has the same amount
 * of glass to land on whatever the zoom happens to be.
 */

import { clamp } from './math';

const INK = '#0d1014';
const PLATE = '#161c28';
const RIM = '#4a566e';
const BONE = '#f2f0e8';
const CYAN = '#59d8f0';
const AMBER = '#f2b33d';

/** Radius a thumb pad wants, in CSS pixels. */
const PAD_CSS = 46;
const BUTTON_CSS = 30;

/** Hand-drawn bolt for the nitro button. */
const BOLT = [
  '....XXX',
  '...XXX.',
  '..XXX..',
  '.XXX...',
  'XXXXXXX',
  '..XXXX.',
  '...XXX.',
  '..XXX..',
  '.XXX...',
  '.XX....',
  '.X.....',
];

/** Two skid streaks for the handbrake button. */
const SKID = [
  '.....XXX',
  '...XXX..',
  '.XXX....',
  'XX......',
  '....XXX.',
  '..XXX...',
  'XXX.....',
];

export interface TouchState {
  steer: number;
  throttle: number;
  nitro: boolean;
  handbrake: boolean;
}

interface Pad {
  cx: number;
  cy: number;
  r: number;
}

interface Layout {
  left: Pad;
  right: Pad;
  boost: Pad;
  drift: Pad;
  pause: { x: number; y: number; w: number; h: number };
}

interface Touching {
  zone: 'left' | 'right' | 'boost' | 'drift' | 'pause';
  /** Where the stick was grabbed — the pad floats to the thumb. */
  ox: number;
  oy: number;
  x: number;
  y: number;
}

function pixelCircle(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  fill: boolean,
): void {
  g.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const span = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)));
    if (fill) {
      g.fillRect(cx - span, cy + y, span * 2 + 1, 1);
    } else {
      g.fillRect(cx - span, cy + y, 1, 1);
      g.fillRect(cx + span, cy + y, 1, 1);
    }
  }
  if (!fill) {
    for (let x = -r; x <= r; x++) {
      const span = Math.floor(Math.sqrt(Math.max(0, r * r - x * x)));
      g.fillRect(cx + x, cy - span, 1, 1);
      g.fillRect(cx + x, cy + span, 1, 1);
    }
  }
}

function stamp(
  g: CanvasRenderingContext2D,
  map: string[],
  x: number,
  y: number,
  color: string,
  scale = 1,
): void {
  g.fillStyle = color;
  map.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (row[rx] !== '.') g.fillRect(x + rx * scale, y + ry * scale, scale, scale);
    }
  });
}

/** Past this fraction of the pad radius the stick reads as full lock. */
const FULL = 0.8;
const DEADZONE = 0.16;

function axis(delta: number, r: number): number {
  const raw = clamp(delta / (r * FULL), -1, 1);
  const mag = Math.abs(raw);
  if (mag <= DEADZONE) return 0;
  return Math.sign(raw) * ((mag - DEADZONE) / (1 - DEADZONE));
}

export class TouchControls {
  /** True once the player has actually touched the glass. */
  active = false;
  /** Set by the game: the pads only listen while a race is being driven. */
  enabled = false;

  private canvas: HTMLCanvasElement;
  private pointers = new Map<number, Touching>();
  private layout: Layout | null = null;
  private pauseTap = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e));
    // Stop the browser from turning a two-finger drag into a page gesture.
    canvas.addEventListener('touchmove', (e) => {
      if (this.active) e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => {
      if (this.active) e.preventDefault();
    });
  }

  /** Turns the pads on for good; called on the first touch, or by a test. */
  enableTouchUi(): void {
    this.active = true;
  }

  /** A keyboard press means there is a keyboard: put the pads away. */
  sawKeyboard(): void {
    if (!this.active) return;
    this.active = false;
    this.pointers.clear();
  }

  /** Recomputed every frame: the buffer can change size at any moment. */
  measure(w: number, h: number, cssScale: number): void {
    const r = Math.round(clamp(PAD_CSS / cssScale, 16, Math.min(w, h) * 0.22));
    const br = Math.round(clamp(BUTTON_CSS / cssScale, 11, Math.min(w, h) * 0.14));
    const m = 8 + r;
    const boostCx = w - 10 - br;
    const boostCy = h - 2 * r - 20 - br;
    this.layout = {
      left: { cx: m, cy: h - m - 4, r },
      right: { cx: w - m, cy: h - m - 4, r },
      boost: { cx: boostCx, cy: boostCy, r: br },
      drift: { cx: boostCx - br * 2 - 10, cy: boostCy, r: Math.round(br * 0.86) },
      pause: { x: w - 8 - 16, y: 5, w: 16, h: 16 },
    };
  }

  /** True when the game should keep its HUD clear of the pads. */
  get showing(): boolean {
    return this.active && this.enabled && this.layout !== null;
  }

  private toBuffer(e: PointerEvent): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  private onDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') this.active = true;
    if (!this.active || !this.enabled || !this.layout) return;
    const p = this.toBuffer(e);
    if (!p) return;
    const hit = (pad: Pad, slack = 6): boolean =>
      Math.hypot(p.x - pad.cx, p.y - pad.cy) <= pad.r + slack;

    const l = this.layout;
    let zone: Touching['zone'];
    if (
      p.x >= l.pause.x - 6 &&
      p.x <= l.pause.x + l.pause.w + 6 &&
      p.y >= l.pause.y - 6 &&
      p.y <= l.pause.y + l.pause.h + 6
    ) {
      zone = 'pause';
      this.pauseTap = true;
    } else if (hit(l.boost, 10)) zone = 'boost';
    else if (hit(l.drift, 10)) zone = 'drift';
    else if (p.x < this.canvas.width / 2) zone = 'left';
    else zone = 'right';

    // The stick springs to wherever the thumb landed, inside its own corner.
    const home = zone === 'left' ? l.left : l.right;
    const ox = zone === 'left' || zone === 'right' ? clamp(p.x, home.r + 2, this.canvas.width - home.r - 2) : p.x;
    const oy = zone === 'left' || zone === 'right' ? clamp(p.y, home.r + 2, this.canvas.height - home.r - 2) : p.y;
    this.pointers.set(e.pointerId, { zone, ox, oy, x: p.x, y: p.y });
    if (this.canvas.setPointerCapture) {
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety; losing it just means a move outside stops the stick.
      }
    }
    e.preventDefault();
  }

  private onMove(e: PointerEvent): void {
    const held = this.pointers.get(e.pointerId);
    if (!held) return;
    const p = this.toBuffer(e);
    if (!p) return;
    held.x = p.x;
    held.y = p.y;
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
  }

  /** The pad geometry, flattened for the automated browser test. */
  debugLayout(): Record<string, number> | null {
    const l = this.layout;
    if (!l) return null;
    return {
      leftX: l.left.cx,
      leftY: l.left.cy,
      rightX: l.right.cx,
      rightY: l.right.cy,
      padR: l.left.r,
      boostX: l.boost.cx,
      boostY: l.boost.cy,
      boostR: l.boost.r,
      driftX: l.drift.cx,
      driftY: l.drift.cy,
      driftR: l.drift.r,
      pauseX: l.pause.x + l.pause.w / 2,
      pauseY: l.pause.y + l.pause.h / 2,
    };
  }

  /** Consumed by the game: true once per tap on the pause square. */
  takePause(): boolean {
    const tapped = this.pauseTap;
    this.pauseTap = false;
    return tapped;
  }

  clear(): void {
    this.pointers.clear();
    this.pauseTap = false;
  }

  get state(): TouchState {
    const out: TouchState = { steer: 0, throttle: 0, nitro: false, handbrake: false };
    if (!this.active || !this.enabled || !this.layout) return out;
    for (const held of this.pointers.values()) {
      if (held.zone === 'left') {
        out.steer = axis(held.x - held.ox, this.layout.left.r);
      } else if (held.zone === 'right') {
        out.throttle = -axis(held.y - held.oy, this.layout.right.r);
      } else if (held.zone === 'boost') out.nitro = true;
      else if (held.zone === 'drift') out.handbrake = true;
    }
    return out;
  }

  private held(zone: Touching['zone']): Touching | null {
    for (const p of this.pointers.values()) if (p.zone === zone) return p;
    return null;
  }

  draw(g: CanvasRenderingContext2D, nitroRatio: number, nitroLocked: boolean): void {
    if (!this.showing || !this.layout) return;
    const l = this.layout;
    const prev = g.globalAlpha;
    g.globalAlpha = 0.78;

    this.drawStick(g, l.left, 'left', true);
    this.drawStick(g, l.right, 'right', false);

    // Nitro: lit while there is anything in the tank, dark once it is locked.
    const boostHeld = this.held('boost') !== null;
    const boostColor = nitroLocked ? '#5c2b2b' : boostHeld ? '#bff6ff' : CYAN;
    pixelCircle(g, l.boost.cx, l.boost.cy + 1, l.boost.r, INK, true);
    pixelCircle(g, l.boost.cx, l.boost.cy, l.boost.r, boostHeld ? '#1d3b47' : PLATE, true);
    pixelCircle(g, l.boost.cx, l.boost.cy, l.boost.r, boostColor, false);
    // A ring of ticks around the button doubles as a second nitro gauge.
    const ticks = 12;
    const lit = Math.round(clamp(nitroRatio, 0, 1) * ticks);
    for (let i = 0; i < ticks; i++) {
      const a = -Math.PI / 2 + (i / ticks) * Math.PI * 2;
      const rr = l.boost.r + 3;
      g.fillStyle = i < lit ? boostColor : '#26303f';
      g.fillRect(
        Math.round(l.boost.cx + Math.cos(a) * rr),
        Math.round(l.boost.cy + Math.sin(a) * rr),
        1,
        1,
      );
    }
    const bs = l.boost.r >= 16 ? 2 : 1;
    stamp(
      g,
      BOLT,
      Math.round(l.boost.cx - (BOLT[0].length * bs) / 2),
      Math.round(l.boost.cy - (BOLT.length * bs) / 2),
      boostHeld ? BONE : boostColor,
      bs,
    );

    // Handbrake, a size down and beside it.
    const driftHeld = this.held('drift') !== null;
    pixelCircle(g, l.drift.cx, l.drift.cy + 1, l.drift.r, INK, true);
    pixelCircle(g, l.drift.cx, l.drift.cy, l.drift.r, driftHeld ? '#3d3320' : PLATE, true);
    pixelCircle(g, l.drift.cx, l.drift.cy, l.drift.r, AMBER, false);
    stamp(
      g,
      SKID,
      Math.round(l.drift.cx - SKID[0].length / 2),
      Math.round(l.drift.cy - SKID.length / 2),
      driftHeld ? BONE : AMBER,
    );

    // Pause: two bars on a plate, top right.
    const p = l.pause;
    g.fillStyle = INK;
    g.fillRect(p.x, p.y, p.w, p.h);
    g.fillStyle = PLATE;
    g.fillRect(p.x + 1, p.y + 1, p.w - 2, p.h - 2);
    g.fillStyle = RIM;
    g.fillRect(p.x + 1, p.y + 1, p.w - 2, 1);
    g.fillStyle = BONE;
    g.fillRect(p.x + 5, p.y + 4, 2, p.h - 8);
    g.fillRect(p.x + 9, p.y + 4, 2, p.h - 8);

    g.globalAlpha = prev;
  }

  /** One pad: a ring on the glass with the knob wherever the thumb is. */
  private drawStick(
    g: CanvasRenderingContext2D,
    pad: Pad,
    zone: 'left' | 'right',
    steering: boolean,
  ): void {
    const held = this.held(zone);
    const cx = held ? Math.round(held.ox) : pad.cx;
    const cy = held ? Math.round(held.oy) : pad.cy;

    pixelCircle(g, cx, cy, pad.r, INK, true);
    pixelCircle(g, cx, cy, pad.r - 1, PLATE, true);
    pixelCircle(g, cx, cy, pad.r, RIM, false);
    pixelCircle(g, cx, cy, Math.round(pad.r * 0.55), '#1d2432', false);

    // Little arrows on the axis this pad actually drives, so the two pads
    // never look interchangeable.
    g.fillStyle = '#48546e';
    for (let i = -1; i <= 1; i += 2) {
      const ax = steering ? cx + i * (pad.r - 6) : cx;
      const ay = steering ? cy : cy + i * (pad.r - 6);
      for (let k = 0; k < 3; k++) {
        if (steering) g.fillRect(ax + i * k, ay - (2 - k), 1, (2 - k) * 2 + 1);
        else g.fillRect(ax - (2 - k), ay + i * k, (2 - k) * 2 + 1, 1);
      }
    }

    const knobR = Math.max(5, Math.round(pad.r * 0.42));
    let kx = 0;
    let ky = 0;
    if (held) {
      // The knob only slides along the axis its pad reads, so what you see is
      // exactly what the car is being told — and it never leaves the ring.
      const along = steering ? held.x - held.ox : held.y - held.oy;
      const cap = pad.r - knobR - 2;
      const k = clamp(along, -cap, cap);
      kx = steering ? k : 0;
      ky = steering ? 0 : k;
    }
    const knobX = Math.round(cx + kx);
    const knobY = Math.round(cy + ky);
    pixelCircle(g, knobX, knobY + 1, knobR, INK, true);
    pixelCircle(g, knobX, knobY, knobR, held ? '#33506b' : '#232c3c', true);
    pixelCircle(g, knobX, knobY, knobR, held ? CYAN : RIM, false);
    g.fillStyle = held ? BONE : '#5d6a82';
    g.fillRect(knobX - 1, knobY - 1, 3, 1);
    g.fillRect(knobX - 1, knobY + 1, 3, 1);
  }
}
