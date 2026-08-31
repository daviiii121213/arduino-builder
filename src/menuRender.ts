import { clamp } from './math';
import { drawText, textWidth } from './font';
import { makeCanvas, ctx2d, rng } from './pixel';
import { getWeatherIcons } from './icons';
import type { CarSpec } from './cars';
import type { Track } from './tracks';
import type { WeatherDef } from './weather';
import type { MenuModel, Screen } from './menu';

/**
 * Draws the menus: chequered header, beveled plates, pixel type and live
 * previews of the car, the circuit and the weather. Every element is filled
 * rectangles at 1:1 buffer pixels, so it stays crisp when the buffer is scaled.
 */

const INK = '#0d1014';
const BONE = '#f2f0e8';
const DIM = '#98a0ad';
const PLATE = '#232936';
const PLATE_LIT = '#33405a';
const EDGE = '#4a566e';
const KERB = '#c8332b';
const GO = '#5fd06a';

export interface MenuContext {
  specs: CarSpec[];
  tracks: Track[];
  weathers: WeatherDef[];
}

export interface HitBox {
  x: number;
  y: number;
  w: number;
  h: number;
  index: number;
}

const SCREEN_TITLE: Record<Screen, string> = {
  main: '',
  car: 'SELECT CAR',
  track: 'SELECT CIRCUIT',
  weather: 'SELECT CONDITIONS',
  settings: 'SETTINGS',
  controls: 'CONTROLS',
  sound: 'SOUND',
  howto: 'HOW TO PLAY',
};

const FOOTER: Record<Screen, string> = {
  main: 'ARROWS MOVE   ENTER SELECT',
  car: 'ARROWS MOVE   ENTER NEXT   ESC BACK',
  track: 'ARROWS MOVE   ENTER NEXT   ESC BACK',
  weather: 'ARROWS MOVE   ENTER START RACE   ESC BACK',
  settings: 'ARROWS MOVE   ENTER SELECT   ESC BACK',
  controls: 'ESC BACK',
  sound: 'UP DOWN PICK   LEFT RIGHT ADJUST   ESC BACK',
  howto: 'ESC BACK',
};

/** Filled rect on whole pixels: every panel and bar is built from these. */
function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A plate with a hard outline, a lit top edge and a shadowed bottom edge. */
function plate(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fill?: string; edge?: string; lit?: boolean } = {},
): void {
  const fill = opts.fill ?? PLATE;
  rect(g, x, y, w, h, INK);
  rect(g, x + 1, y + 1, w - 2, h - 2, opts.edge ?? EDGE);
  rect(g, x + 2, y + 2, w - 4, h - 4, fill);
  rect(g, x + 2, y + 2, w - 4, 1, opts.lit ? '#6d7f9e' : '#39445a');
  rect(g, x + 2, y + h - 3, w - 4, 1, '#161b26');
}

/** The start/finish chequer, used as the menu's header and footer rules. */
function chequer(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, phase = 0): void {
  const size = Math.max(2, Math.round(h / 2));
  for (let cx = 0; cx * size < w; cx++) {
    for (let cy = 0; cy * size < h; cy++) {
      const light = (cx + cy + phase) % 2 === 0;
      rect(g, x + cx * size, y + cy * size, Math.min(size, w - cx * size), Math.min(size, h - cy * size), light ? BONE : INK);
    }
  }
}

/** Segmented pixel bar: the shape used for car stats, sliders and the nitro gauge. */
export function segmentBar(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  color: string,
  segments = 10,
): void {
  rect(g, x, y, w, h, INK);
  rect(g, x + 1, y + 1, w - 2, h - 2, '#1c222e');
  const inner = w - 4;
  const segW = inner / segments;
  const filled = Math.round(Math.max(0, Math.min(1, ratio)) * segments);
  for (let i = 0; i < filled; i++) {
    rect(g, x + 2 + i * segW, y + 2, Math.max(1, segW - 1), h - 4, color);
    rect(g, x + 2 + i * segW, y + 2, Math.max(1, segW - 1), 1, '#ffffff33');
  }
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.toUpperCase().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export class MenuRenderer {
  private minimaps = new Map<string, HTMLCanvasElement>();
  private hits: HitBox[] = [];
  private time = 0;

  update(dt: number): void {
    this.time += dt;
  }

  /** Rows the mouse can click, in buffer pixels, from the last frame drawn. */
  get hitBoxes(): HitBox[] {
    return this.hits;
  }

  draw(g: CanvasRenderingContext2D, w: number, h: number, model: MenuModel, ctx: MenuContext): void {
    this.hits = [];
    // Scrim over the attract race so the type always reads.
    rect(g, 0, 0, w, h, 'rgba(8,10,16,0.72)');
    chequer(g, 0, 0, w, 6);
    chequer(g, 0, h - 6, w, 6, 1);

    const title = SCREEN_TITLE[model.screen];
    if (title) drawText(g, title, 14, 16, { scale: 2, color: BONE, shadow: INK });

    switch (model.screen) {
      case 'main':
        this.drawMain(g, w, h, model);
        break;
      case 'car':
        this.drawCar(g, w, model, ctx);
        break;
      case 'track':
        this.drawTrack(g, w, h, model, ctx);
        break;
      case 'weather':
        this.drawWeather(g, w, h, model, ctx);
        break;
      case 'settings':
        this.drawList(g, w, h, model, ['CONTROLS', 'SOUND', 'HOW TO PLAY', 'BACK']);
        break;
      case 'sound':
        this.drawSound(g, w, h, model);
        break;
      case 'controls':
        this.drawControls(g, w);
        break;
      case 'howto':
        this.drawHowTo(g, w);
        break;
    }

    drawText(g, FOOTER[model.screen], w / 2, h - 16, {
      scale: 1,
      color: DIM,
      shadow: INK,
      align: 'center',
    });
  }

  // ---- screens -------------------------------------------------------------

  private drawMain(g: CanvasRenderingContext2D, w: number, h: number, model: MenuModel): void {
    const cx = Math.round(w / 2);
    const titleScale = w >= 560 ? 5 : 4;
    const top = Math.round(h * 0.16);

    // Logo: bone type over a red offset, the same pairing as the kerbs.
    drawText(g, 'PIXEL', cx, top, { scale: titleScale, color: KERB, align: 'center', tracking: 2 });
    drawText(g, 'PIXEL', cx - titleScale, top - titleScale, {
      scale: titleScale,
      color: BONE,
      align: 'center',
      tracking: 2,
    });
    const second = top + titleScale * 9;
    drawText(g, 'RACER', cx, second, { scale: titleScale, color: KERB, align: 'center', tracking: 2 });
    drawText(g, 'RACER', cx - titleScale, second - titleScale, {
      scale: titleScale,
      color: BONE,
      align: 'center',
      tracking: 2,
    });
    drawText(g, '6 CARS   3 CIRCUITS   3 LAPS', cx, second + titleScale * 9 + 6, {
      scale: 1,
      color: DIM,
      shadow: INK,
      align: 'center',
    });

    const labels = ['PLAY', 'SETTINGS'];
    const bw = 150;
    const bh = 28;
    const gap = 12;
    const startY = Math.round(h * 0.62);
    labels.forEach((label, i) => {
      const x = cx - bw / 2;
      const y = startY + i * (bh + gap);
      this.button(g, x, y, bw, bh, label, model.index === i, i);
    });
  }

  private drawCar(
    g: CanvasRenderingContext2D,
    w: number,
    model: MenuModel,
    ctx: MenuContext,
  ): void {
    const listW = 116;
    const top = 42;
    this.list(g, 14, top, listW, ctx.specs.map((s) => s.name), model.index);

    const spec = ctx.specs[model.carIndex];
    const stats = spec.stats;
    const all = ctx.specs.map((s) => s.stats);
    const norm = (value: number, pick: (s: typeof stats) => number): number => {
      const values = all.map(pick);
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      return hi === lo ? 1 : 0.12 + 0.88 * ((value - lo) / (hi - lo));
    };

    const px = 14 + listW + 10;
    const pw = w - px - 14;
    const ph = 132;
    plate(g, px, top, pw, ph);

    // The car on a dark stage, scaled so every model fills the same space.
    const sprite = spec.sprite;
    const scale = clamp(Math.round(96 / sprite.height), 3, 5);
    const stageW = Math.max(sprite.width * scale + 20, 74);
    const stageH = ph - 16;
    const stageX = px + 10;
    const stageY = top + 8;
    plate(g, stageX, stageY, stageW, stageH, { fill: '#151b26' });
    const bob = Math.round(Math.sin(this.time * 2) * 2);
    const carX = Math.round(stageX + stageW / 2 - (sprite.width * scale) / 2);
    const carY = Math.round(stageY + stageH / 2 - (sprite.height * scale) / 2) + bob;
    rect(g, carX + 4, carY + sprite.height * scale - 3, sprite.width * scale - 8, 3, '#0b0e14');
    g.imageSmoothingEnabled = false;
    g.drawImage(sprite, carX, carY, sprite.width * scale, sprite.height * scale);

    const ix = stageX + stageW + 12;
    const iw = px + pw - ix - 12;
    drawText(g, spec.name, ix, stageY + 2, { scale: 2, color: spec.tint, shadow: INK });
    wrap(spec.blurb, Math.max(12, Math.floor(iw / 6))).forEach((line, i) => {
      drawText(g, line, ix, stageY + 20 + i * 9, { scale: 1, color: DIM });
    });

    const rows: Array<[string, number, string]> = [
      ['SPEED', norm(stats.maxSpeed, (s) => s.maxSpeed), '#e0553f'],
      ['ACCEL', norm(stats.accel, (s) => s.accel), '#f2b33d'],
      ['GRIP', norm(stats.grip, (s) => s.grip), '#5fd06a'],
      ['NITRO', norm(stats.nitroCapacity, (s) => s.nitroCapacity), '#59d8f0'],
    ];
    const barW = Math.min(120, iw - 44);
    const barY = stageY + 46;
    rows.forEach(([label, value, color], i) => {
      const y = barY + i * 13;
      drawText(g, label, ix, y + 1, { scale: 1, color: BONE });
      segmentBar(g, ix + 40, y - 1, barW, 9, value, color);
    });
    drawText(
      g,
      `TANK ${stats.nitroCapacity.toFixed(1)}S   BOOST +${Math.round((stats.nitroBoost - 1) * 100)}%`,
      ix,
      barY + rows.length * 13 + 3,
      { scale: 1, color: '#59d8f0' },
    );

    // The whole grid of cars along the bottom, so the field is visible at once.
    const chipH = 70;
    const chipY = top + ph + 10;
    const chipW = Math.floor((w - 28 - (ctx.specs.length - 1) * 6) / ctx.specs.length);
    ctx.specs.forEach((entry, i) => {
      const x = 14 + i * (chipW + 6);
      const active = i === model.carIndex;
      plate(g, x, chipY, chipW, chipH, { fill: active ? PLATE_LIT : '#1b2130', lit: active });
      // Scale each chip so even the longest car fits inside its plate.
      const cs = clamp(Math.floor((chipH - 12) / entry.sprite.height), 1, 2);
      const cw = entry.sprite.width * cs;
      const ch = entry.sprite.height * cs;
      g.drawImage(
        entry.sprite,
        Math.round(x + chipW / 2 - cw / 2),
        Math.round(chipY + chipH / 2 - ch / 2) - 2,
        cw,
        ch,
      );
      if (active) rect(g, x + 2, chipY + chipH - 5, chipW - 4, 2, entry.tint);
      this.hits.push({ x, y: chipY, w: chipW, h: chipH, index: i });
    });
  }

  private drawTrack(
    g: CanvasRenderingContext2D,
    w: number,
    h: number,
    model: MenuModel,
    ctx: MenuContext,
  ): void {
    const listW = 140;
    const top = 42;
    this.list(g, 14, top, listW, ctx.tracks.map((t) => t.def.name), model.index);

    const px = 14 + listW + 10;
    const pw = w - px - 14;
    const ph = Math.min(h - top - 26, 168);
    plate(g, px, top, pw, ph);

    const track = ctx.tracks[model.trackIndex];
    const info = track.info;
    const mapW = Math.min(Math.round(pw * 0.46), ph - 24);
    const mapH = ph - 24;
    const map = this.minimap(track, mapW, mapH);
    g.drawImage(map, px + 12, top + 12);

    const ix = px + 12 + mapW + 12;
    const iw = px + pw - ix - 12;
    drawText(g, track.def.name, ix, top + 14, { scale: 2, color: BONE, shadow: INK });
    wrap(track.def.tagline, Math.max(12, Math.floor(iw / 6))).forEach((line, i) => {
      drawText(g, line, ix, top + 34 + i * 9, { scale: 1, color: DIM });
    });

    const facts: Array<[string, string]> = [
      ['SURFACE', info.surfaceLabel],
      ['LENGTH', `${info.lengthM} M`],
      ['CORNERS', String(info.corners)],
      ['WIDTH', `${track.def.halfWidth * 2} PX`],
      ['GRIP', `${Math.round(track.def.gripScale * 100)}%`],
    ];
    const fy = top + 62;
    facts.forEach(([label, value], i) => {
      const y = fy + i * 11;
      drawText(g, label, ix, y, { scale: 1, color: DIM });
      drawText(g, value, ix + iw, y, { scale: 1, color: BONE, align: 'right' });
    });
    const dy = fy + facts.length * 11 + 4;
    drawText(g, 'DIFFICULTY', ix, dy, { scale: 1, color: DIM });
    drawText(g, '***'.slice(0, info.difficulty), ix + iw, dy, {
      scale: 1,
      color: KERB,
      align: 'right',
    });
  }

  private drawWeather(
    g: CanvasRenderingContext2D,
    w: number,
    h: number,
    model: MenuModel,
    ctx: MenuContext,
  ): void {
    const icons = getWeatherIcons();
    const count = ctx.weathers.length;
    const tileW = Math.min(140, Math.round((w - 40) / count) - 10);
    const tileH = 116;
    const totalW = count * tileW + (count - 1) * 12;
    const x0 = Math.round((w - totalW) / 2);
    const y = Math.round(h * 0.28);

    ctx.weathers.forEach((weather, i) => {
      const x = x0 + i * (tileW + 12);
      const selected = model.index === i;
      plate(g, x, y, tileW, tileH, { fill: selected ? PLATE_LIT : PLATE, lit: selected });
      this.hits.push({ x, y, w: tileW, h: tileH, index: i });

      const icon = icons[weather.id];
      const scale = 3;
      g.imageSmoothingEnabled = false;
      g.drawImage(
        icon,
        Math.round(x + tileW / 2 - (icon.width * scale) / 2),
        y + 14,
        icon.width * scale,
        icon.height * scale,
      );
      drawText(g, weather.name, x + tileW / 2, y + 14 + icon.height * scale + 8, {
        scale: 2,
        color: selected ? BONE : DIM,
        shadow: INK,
        align: 'center',
      });
      if (selected) {
        rect(g, x + 2, y + tileH - 5, tileW - 4, 2, weather.tint);
      }
    });

    const chosen = ctx.weathers[model.weatherIndex];
    wrap(chosen.blurb, Math.max(20, Math.floor((w - 60) / 6))).forEach((line, i) => {
      drawText(g, line, w / 2, y + tileH + 18 + i * 10, {
        scale: 1,
        color: BONE,
        shadow: INK,
        align: 'center',
      });
    });

    const grip = Math.round(chosen.gripMul * 100);
    const vis = Math.round(chosen.visibility * 100);
    drawText(g, `GRIP ${grip}%    VISIBILITY ${vis}%`, w / 2, y + tileH + 46, {
      scale: 1,
      color: chosen.tint,
      shadow: INK,
      align: 'center',
    });
  }

  private drawSound(g: CanvasRenderingContext2D, w: number, h: number, model: MenuModel): void {
    const pw = Math.min(300, w - 40);
    const px = Math.round((w - pw) / 2);
    const py = Math.round(h * 0.28);
    const rows: Array<[string, number | boolean]> = [
      ['MASTER', model.sound.master],
      ['EFFECTS', model.sound.sfx],
      ['ENGINE', model.sound.engine],
      ['MUTE', model.sound.muted],
    ];
    plate(g, px, py, pw, rows.length * 22 + 44);

    rows.forEach(([label, value], i) => {
      const y = py + 12 + i * 22;
      const selected = model.index === i;
      if (selected) rect(g, px + 4, y - 2, pw - 8, 18, PLATE_LIT);
      drawText(g, selected ? `>${label}` : ` ${label}`, px + 10, y + 4, {
        scale: 1,
        color: selected ? BONE : DIM,
      });
      this.hits.push({ x: px + 4, y: y - 2, w: pw - 8, h: 18, index: i });
      if (typeof value === 'number') {
        segmentBar(g, px + 90, y + 1, pw - 130, 10, value, '#59d8f0');
        drawText(g, `${Math.round(value * 100)}%`, px + pw - 12, y + 4, {
          scale: 1,
          color: BONE,
          align: 'right',
        });
      } else {
        drawText(g, value ? 'ON' : 'OFF', px + pw - 12, y + 4, {
          scale: 1,
          color: value ? KERB : GO,
          align: 'right',
        });
      }
    });

    const backY = py + 12 + rows.length * 22;
    const selected = model.index === 4;
    if (selected) rect(g, px + 4, backY - 2, pw - 8, 18, PLATE_LIT);
    drawText(g, selected ? '>BACK' : ' BACK', px + 10, backY + 4, {
      scale: 1,
      color: selected ? BONE : DIM,
    });
    this.hits.push({ x: px + 4, y: backY - 2, w: pw - 8, h: 18, index: 4 });
  }

  private drawControls(g: CanvasRenderingContext2D, w: number): void {
    const rows: Array<[string[], string]> = [
      [['W', 'UP'], 'ACCELERATE'],
      [['S', 'DOWN'], 'BRAKE / REVERSE'],
      [['A', 'LEFT'], 'STEER LEFT'],
      [['D', 'RIGHT'], 'STEER RIGHT'],
      [['SHIFT'], 'NITRO BOOST'],
      [['SPACE'], 'HANDBRAKE DRIFT'],
      [['R'], 'RESTART RACE'],
      [['ESC'], 'BACK TO MENU'],
    ];
    const pw = Math.min(330, w - 36);
    const px = Math.round((w - pw) / 2);
    const py = 44;
    plate(g, px, py, pw, rows.length * 17 + 16);
    rows.forEach(([keys, action], i) => {
      const y = py + 10 + i * 17;
      let x = px + 10;
      for (const key of keys) {
        x += this.keycap(g, x, y, key) + 4;
      }
      drawText(g, action, px + pw - 10, y + 4, { scale: 1, color: BONE, align: 'right' });
    });
  }

  private drawHowTo(g: CanvasRenderingContext2D, w: number): void {
    const lines = [
      'THREE LAPS AGAINST FIVE RIVALS. FIRST TO THE',
      'CHEQUERED LINE WINS.',
      '',
      'GRASS IS SLOW: KEEP TWO WHEELS ON THE ROAD.',
      'DIRT AND RAIN CUT YOUR GRIP, SO BRAKE EARLIER',
      'AND LET THE CAR ROTATE BEFORE YOU FEED THE',
      'THROTTLE BACK IN.',
      '',
      'HOLD SHIFT TO BURN NITRO. THE BAR BOTTOM LEFT',
      'IS YOUR TANK; IT REFILLS WHEN YOU LET GO.',
      'SPEND IT ON THE STRAIGHTS, NOT THE CORNERS.',
      '',
      'TAP SPACE MID-CORNER TO SWING THE BACK OUT.',
      'AT NIGHT YOU ONLY SEE WHAT THE HEADLIGHTS DO.',
    ];
    const pw = Math.min(320, w - 36);
    const px = Math.round((w - pw) / 2);
    const py = 44;
    plate(g, px, py, pw, lines.length * 10 + 16);
    lines.forEach((line, i) => {
      drawText(g, line, px + 10, py + 10 + i * 10, {
        scale: 1,
        color: line.startsWith('HOLD') || line.startsWith('TAP') ? BONE : DIM,
      });
    });
  }

  // ---- pieces --------------------------------------------------------------

  private button(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    selected: boolean,
    index: number,
  ): void {
    const nudge = selected ? Math.round(Math.sin(this.time * 6) * 1) : 0;
    plate(g, x, y + nudge, w, h, { fill: selected ? PLATE_LIT : PLATE, lit: selected });
    if (selected) {
      // Kerb slabs down both edges mark the active button.
      for (let i = 0; i < Math.floor((h - 8) / 6); i++) {
        const c = i % 2 === 0 ? KERB : BONE;
        rect(g, x + 3, y + nudge + 4 + i * 6, 3, 5, c);
        rect(g, x + w - 6, y + nudge + 4 + i * 6, 3, 5, c);
      }
    }
    drawText(g, label, x + w / 2, y + nudge + Math.round(h / 2) - 7, {
      scale: 2,
      color: selected ? BONE : DIM,
      shadow: INK,
      align: 'center',
    });
    this.hits.push({ x, y, w, h, index });
  }

  private list(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    labels: string[],
    selected: number,
  ): void {
    const rowH = 20;
    plate(g, x, y, w, labels.length * rowH + 8);
    labels.forEach((label, i) => {
      const ry = y + 4 + i * rowH;
      const active = i === selected;
      if (active) {
        rect(g, x + 3, ry, w - 6, rowH - 2, PLATE_LIT);
        rect(g, x + 3, ry, 2, rowH - 2, KERB);
      }
      drawText(g, active ? `>${label}` : ` ${label}`, x + 8, ry + 6, {
        scale: 1,
        color: active ? BONE : DIM,
      });
      this.hits.push({ x: x + 3, y: ry, w: w - 6, h: rowH - 2, index: i });
    });
  }

  private drawList(
    g: CanvasRenderingContext2D,
    w: number,
    h: number,
    model: MenuModel,
    labels: string[],
  ): void {
    const bw = 190;
    const bh = 24;
    const gap = 8;
    const x = Math.round((w - bw) / 2);
    const y0 = Math.round(h * 0.3);
    labels.forEach((label, i) => {
      this.button(g, x, y0 + i * (bh + gap), bw, bh, label, model.index === i, i);
    });
  }

  /** A drawn key cap; returns its width so rows can lay several out. */
  private keycap(g: CanvasRenderingContext2D, x: number, y: number, label: string): number {
    const w = textWidth(label, { scale: 1 }) + 10;
    const h = 13;
    rect(g, x, y, w, h, INK);
    rect(g, x + 1, y + 1, w - 2, h - 2, '#39445a');
    rect(g, x + 1, y + 1, w - 2, 1, '#6d7f9e');
    drawText(g, label, x + w / 2, y + 4, { scale: 1, color: BONE, align: 'center' });
    return w;
  }

  /** Track map drawn from the real centre line, cached per track and size. */
  private minimap(track: Track, w: number, h: number): HTMLCanvasElement {
    const key = `${track.def.id}:${w}x${h}`;
    const cached = this.minimaps.get(key);
    if (cached) return cached;

    const cv = makeCanvas(w, h);
    const g = ctx2d(cv);
    const theme = track.def.theme;
    rect(g, 0, 0, w, h, INK);
    rect(g, 1, 1, w - 2, h - 2, theme.grass.dark);

    // Stipple the grass so the map is pixel art, not a flat swatch. Seeded,
    // so a given circuit always draws the same map.
    const rand = rng(track.def.decorSeed);
    for (let i = 0; i < (w * h) / 26; i++) {
      const px = 1 + Math.floor(rand() * (w - 2));
      const py = 1 + Math.floor(rand() * (h - 2));
      rect(g, px, py, 1, 1, rand() < 0.5 ? theme.grass.base : theme.grass.deep);
    }

    const pad = 10;
    const scale = Math.min((w - pad * 2) / track.def.worldW, (h - pad * 2) / track.def.worldH);
    const ox = (w - track.def.worldW * scale) / 2;
    const oy = (h - track.def.worldH * scale) / 2;
    const at = (i: number): { x: number; y: number } => {
      const p = track.wp(i);
      return { x: ox + p.x * scale, y: oy + p.y * scale };
    };

    g.lineJoin = 'round';
    g.lineCap = 'round';
    const trace = (width: number, color: string): void => {
      g.strokeStyle = color;
      g.lineWidth = width;
      g.beginPath();
      for (let i = 0; i <= track.count; i++) {
        const p = at(i);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.closePath();
      g.stroke();
    };
    trace(8, theme.shoulder);
    trace(5, theme.surface.base);

    // Start/finish marker on the line itself.
    const start = at(0);
    const nx = Math.round(start.x);
    const ny = Math.round(start.y);
    for (let i = 0; i < 4; i++) {
      rect(g, nx - 4 + i * 2, ny - 3, 2, 3, i % 2 === 0 ? BONE : INK);
      rect(g, nx - 4 + i * 2, ny, 2, 3, i % 2 === 0 ? INK : BONE);
    }

    this.minimaps.set(key, cv);
    return cv;
  }
}
