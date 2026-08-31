/**
 * A hand-drawn 5x7 bitmap font. Every glyph is a pixel map, so menu text is the
 * same kind of art as the cars and the track: no system fonts anywhere on screen.
 */

/**
 * A glyph is a list of pixel rows. Accented capitals carry two extra rows on
 * top and are lifted by `dy` so the letter itself still sits on the cap line;
 * the cedilla instead hangs two rows below.
 */
interface Glyph {
  rows: string[];
  dy: number;
}

const BASE: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '..##.', '..##.'],
  ',': ['.....', '.....', '.....', '.....', '..##.', '..##.', '.#...'],
  ':': ['.....', '..##.', '..##.', '.....', '..##.', '..##.', '.....'],
  ';': ['.....', '..##.', '..##.', '.....', '..##.', '..##.', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '%': ['##..#', '##.#.', '..#..', '.#...', '#..##', '#..##', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
};

// Portuguese needs accents, so each marked capital is built from the plain
// letter plus a two-row diacritic drawn above (or below, for the cedilla).
const ACUTE = ['...#.', '..#..'];
const GRAVE = ['.#...', '..#..'];
const CIRCUMFLEX = ['..#..', '.#.#.'];
const TILDE = ['.##.#', '#..##'];
const CEDILLA = ['..#..', '.##..'];

const ACCENTED: Record<string, [string, string[]]> = {
  'Á': ['A', ACUTE],
  'À': ['A', GRAVE],
  'Â': ['A', CIRCUMFLEX],
  'Ã': ['A', TILDE],
  'É': ['E', ACUTE],
  'Ê': ['E', CIRCUMFLEX],
  'Í': ['I', ACUTE],
  'Ó': ['O', ACUTE],
  'Ô': ['O', CIRCUMFLEX],
  'Õ': ['O', TILDE],
  'Ú': ['U', ACUTE],
};

const G: Record<string, Glyph> = {};
for (const [ch, rows] of Object.entries(BASE)) G[ch] = { rows, dy: 0 };
for (const [ch, [base, accent]] of Object.entries(ACCENTED)) {
  G[ch] = { rows: [...accent, ...BASE[base]], dy: -2 };
}
G['Ç'] = { rows: [...BASE['C'], ...CEDILLA], dy: 0 };

export const GLYPH_W = 5;
export const GLYPH_H = 7;

export interface TextStyle {
  /** Pixel size of one glyph pixel. */
  scale?: number;
  color?: string;
  /** Drop shadow colour; omit for none. */
  shadow?: string;
  /** Extra pixels between glyphs (before scaling). */
  tracking?: number;
  align?: 'left' | 'center' | 'right';
}

/** Width in device pixels the string will occupy. */
export function textWidth(text: string, style: TextStyle = {}): number {
  const scale = style.scale ?? 1;
  const tracking = style.tracking ?? 1;
  if (text.length === 0) return 0;
  return (text.length * (GLYPH_W + tracking) - tracking) * scale;
}

/** Draws pixel text. Returns the width drawn. */
export function drawText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TextStyle = {},
): number {
  const scale = style.scale ?? 1;
  const tracking = style.tracking ?? 1;
  const color = style.color ?? '#f2f0e8';
  const upper = text.toUpperCase();
  const width = textWidth(upper, style);
  let originX = Math.round(x);
  if (style.align === 'center') originX = Math.round(x - width / 2);
  else if (style.align === 'right') originX = Math.round(x - width);
  const originY = Math.round(y);

  const paint = (dx: number, dy: number, fill: string): void => {
    g.fillStyle = fill;
    let cursor = originX + dx;
    for (const ch of upper) {
      const glyph = G[ch] ?? G['?'];
      for (let row = 0; row < glyph.rows.length; row++) {
        const line = glyph.rows[row];
        for (let col = 0; col < GLYPH_W; col++) {
          if (line[col] !== '#') continue;
          g.fillRect(
            cursor + col * scale,
            originY + dy + (row + glyph.dy) * scale,
            scale,
            scale,
          );
        }
      }
      cursor += (GLYPH_W + tracking) * scale;
    }
  };

  if (style.shadow) paint(scale, scale, style.shadow);
  paint(0, 0, color);
  return width;
}

/** Characters the font can draw; anything else falls back to "?". */
export function supports(ch: string): boolean {
  return ch.toUpperCase() in G;
}
