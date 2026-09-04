/**
 * Motor de pixel art.
 *
 * Toda a arte do jogo é desenhada aqui: mapas de caracteres ("#", ".", etc.)
 * são convertidos em canvas offscreen pixel a pixel. Nenhum asset externo é
 * usado — cada sprite é definido no código, com paleta própria.
 */

export type Paleta = Record<string, string | null>;

/** Canvas offscreen 1:1 (1 unidade de arte = 1 pixel de tela). */
export type Sprite = HTMLCanvasElement;

export function criarCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d', { alpha: true });
  if (!g) throw new Error('Canvas 2D indisponível neste navegador.');
  g.imageSmoothingEnabled = false;
  return g;
}

function hexParaRgba(cor: string): [number, number, number, number] {
  let s = cor.trim();
  if (s.startsWith('#')) s = s.slice(1);
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (s.length === 6) s += 'ff';
  const n = parseInt(s, 16);
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
}

const cacheCor = new Map<string, [number, number, number, number]>();
export function corRgba(cor: string): [number, number, number, number] {
  let v = cacheCor.get(cor);
  if (!v) {
    v = hexParaRgba(cor);
    cacheCor.set(cor, v);
  }
  return v;
}

/**
 * Converte linhas de caracteres em um sprite.
 * Caracteres ausentes na paleta (ou mapeados para null) ficam transparentes.
 */
export function pintar(linhas: readonly string[], paleta: Paleta): Sprite {
  const h = linhas.length;
  const w = linhas.reduce((m, l) => Math.max(m, l.length), 0);
  const cv = criarCanvas(w, h);
  const g = ctx2d(cv);
  const img = g.createImageData(w, h);
  const dados = img.data;
  for (let y = 0; y < h; y++) {
    const linha = linhas[y];
    for (let x = 0; x < linha.length; x++) {
      const ch = linha[x];
      const cor = paleta[ch];
      if (!cor) continue;
      const [r, gg, b, a] = corRgba(cor);
      const i = (y * w + x) * 4;
      dados[i] = r;
      dados[i + 1] = gg;
      dados[i + 2] = b;
      dados[i + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** Pequeno "pincel" para desenhar arte procedural pixel a pixel. */
export class Pincel {
  readonly canvas: HTMLCanvasElement;
  private img: ImageData;
  private g: CanvasRenderingContext2D;

  constructor(readonly w: number, readonly h: number) {
    this.canvas = criarCanvas(w, h);
    this.g = ctx2d(this.canvas);
    this.img = this.g.createImageData(w, h);
  }

  ponto(x: number, y: number, cor: string, alpha = 1): this {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return this;
    const [r, g, b, a] = corRgba(cor);
    const i = (py * this.w + px) * 4;
    const d = this.img.data;
    const af = (a / 255) * alpha;
    if (af >= 1) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
    } else {
      const base = d[i + 3] / 255;
      const out = af + base * (1 - af);
      d[i] = (r * af + d[i] * base * (1 - af)) / (out || 1);
      d[i + 1] = (g * af + d[i + 1] * base * (1 - af)) / (out || 1);
      d[i + 2] = (b * af + d[i + 2] * base * (1 - af)) / (out || 1);
      d[i + 3] = out * 255;
    }
    return this;
  }

  retangulo(x: number, y: number, w: number, h: number, cor: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.ponto(x + i, y + j, cor);
    return this;
  }

  contorno(x: number, y: number, w: number, h: number, cor: string): this {
    for (let i = 0; i < w; i++) {
      this.ponto(x + i, y, cor);
      this.ponto(x + i, y + h - 1, cor);
    }
    for (let j = 0; j < h; j++) {
      this.ponto(x, y + j, cor);
      this.ponto(x + w - 1, y + j, cor);
    }
    return this;
  }

  linha(x0: number, y0: number, x1: number, y1: number, cor: string): this {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xf = Math.round(x1);
    const yf = Math.round(y1);
    const dx = Math.abs(xf - x);
    const dy = Math.abs(yf - y);
    const sx = x < xf ? 1 : -1;
    const sy = y < yf ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      this.ponto(x, y, cor);
      if (x === xf && y === yf) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  disco(cx: number, cy: number, raio: number, cor: string, alpha = 1): this {
    const r2 = raio * raio;
    const r = Math.ceil(raio);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= r2) this.ponto(cx + x, cy + y, cor, alpha);
      }
    }
    return this;
  }

  anel(cx: number, cy: number, raio: number, cor: string, espessura = 1, alpha = 1): this {
    const r2 = raio * raio;
    const ri2 = Math.max(0, (raio - espessura) * (raio - espessura));
    const r = Math.ceil(raio);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d = x * x + y * y;
        if (d <= r2 && d >= ri2) this.ponto(cx + x, cy + y, cor, alpha);
      }
    }
    return this;
  }

  /** Finaliza e devolve o sprite. */
  finalizar(): Sprite {
    this.g.putImageData(this.img, 0, 0);
    return this.canvas;
  }
}

/** Espelha um sprite horizontalmente (usado para virar dinossauros). */
export function espelharH(s: Sprite): Sprite {
  const cv = criarCanvas(s.width, s.height);
  const g = ctx2d(cv);
  g.translate(s.width, 0);
  g.scale(-1, 1);
  g.drawImage(s, 0, 0);
  return cv;
}

/** Gera uma silhueta colorida do sprite (usada no flash de dano). */
export function tingir(s: Sprite, cor: string, forca = 1): Sprite {
  const cv = criarCanvas(s.width, s.height);
  const g = ctx2d(cv);
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = forca;
  g.fillStyle = cor;
  g.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

const idsSprite = new WeakMap<Sprite, number>();
let proximoIdSprite = 1;
const cacheTingido = new Map<string, Sprite>();

/**
 * Versão tingida de um sprite, com memória.
 * Usada no flash de dano do jogador e dos dinossauros — evita recriar o
 * mesmo canvas a cada quadro.
 */
export function tingirCache(s: Sprite, cor: string, forca: number): Sprite {
  let id = idsSprite.get(s);
  if (id === undefined) {
    id = proximoIdSprite++;
    idsSprite.set(s, id);
  }
  const passo = Math.round(forca * 20) / 20;
  const chave = `${id}|${cor}|${passo}`;
  let pronto = cacheTingido.get(chave);
  if (!pronto) {
    pronto = tingir(s, cor, passo);
    cacheTingido.set(chave, pronto);
  }
  return pronto;
}

/** Contorno de 1px ao redor do sprite (destaque de interação). */
export function contornar(s: Sprite, cor: string): Sprite {
  const cv = criarCanvas(s.width + 2, s.height + 2);
  const g = ctx2d(cv);
  const silhueta = tingir(s, cor, 1);
  for (const [dx, dy] of [
    [0, 1],
    [2, 1],
    [1, 0],
    [1, 2],
  ]) {
    g.drawImage(silhueta, dx, dy);
  }
  g.drawImage(s, 1, 1);
  return cv;
}

/** Sombra elíptica achatada usada por todas as criaturas. */
export function sombra(w: number, h: number, cor = '#00000055'): Sprite {
  const p = new Pincel(w, h);
  const rx = w / 2;
  const ry = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - rx + 0.5) / rx;
      const ny = (y - ry + 0.5) / ry;
      if (nx * nx + ny * ny <= 1) p.ponto(x, y, cor);
    }
  }
  return p.finalizar();
}

/** Empilha vários sprites em um só (composição de camadas). */
export function compor(
  w: number,
  h: number,
  camadas: readonly { s: Sprite; x?: number; y?: number }[],
): Sprite {
  const cv = criarCanvas(w, h);
  const g = ctx2d(cv);
  for (const c of camadas) g.drawImage(c.s, c.x ?? 0, c.y ?? 0);
  return cv;
}
