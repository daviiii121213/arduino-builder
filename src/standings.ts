import { drawText, textWidth } from './font';
import { t } from './i18n';
import type { Standing } from './championship';
import type { CarSpec } from './cars';

/**
 * The championship table, drawn in the same plate-and-kerb style as the menus.
 * Used between rounds and again, in miniature, on the champion screen.
 */

const INK = '#0d1014';
const BONE = '#f2f0e8';
const DIM = '#98a0ad';
const KERB = '#c8332b';
const PLATE = '#232936';
const ROW_A = '#1b2130';
const ROW_B = '#20283a';

export interface TableOptions {
  /** Column of points scored in the round just run. */
  showRacePoints?: boolean;
  rowHeight?: number;
  /** Car tints, so a driver's row carries their colour. */
  specs?: CarSpec[];
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Draws the table and returns the height it used. */
export function drawTable(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  rows: Standing[],
  opts: TableOptions = {},
): number {
  const rowH = opts.rowHeight ?? 13;
  const showRace = opts.showRacePoints ?? true;
  const headH = 10;
  const height = headH + rows.length * rowH + 6;

  rect(g, x - 2, y - 2, w + 4, height + 4, INK);
  rect(g, x, y, w, height, PLATE);

  const posX = x + 6;
  const nameX = x + 30;
  const raceX = x + w - 44;
  const totalX = x + w - 8;

  drawText(g, t('pos'), posX, y + 3, { scale: 1, color: DIM });
  drawText(g, t('driver'), nameX, y + 3, { scale: 1, color: DIM });
  if (showRace) drawText(g, t('raceCol'), raceX, y + 3, { scale: 1, color: DIM, align: 'right' });
  drawText(g, t('pts'), totalX, y + 3, { scale: 1, color: DIM, align: 'right' });

  rows.forEach((row, i) => {
    const ry = y + headH + i * rowH;
    rect(g, x + 2, ry, w - 4, rowH - 1, i % 2 === 0 ? ROW_A : ROW_B);
    if (row.isPlayer) {
      rect(g, x + 2, ry, 2, rowH - 1, KERB);
      rect(g, x + 2, ry, w - 4, rowH - 1, '#33405a');
      rect(g, x + 2, ry, 2, rowH - 1, KERB);
    }
    const tint = opts.specs?.[row.carIndex]?.tint;
    drawText(g, String(row.place), posX, ry + 3, { scale: 1, color: row.isPlayer ? BONE : DIM });
    drawText(g, row.name, nameX, ry + 3, { scale: 1, color: row.isPlayer ? BONE : (tint ?? DIM) });
    if (showRace) {
      const gained = row.lastPosition > 0 ? `+${row.lastPoints}` : '-';
      drawText(g, gained, raceX, ry + 3, { scale: 1, color: row.lastPoints > 0 ? '#5fd06a' : DIM, align: 'right' });
    }
    drawText(g, String(row.points), totalX, ry + 3, { scale: 1, color: BONE, align: 'right' });
  });

  return height;
}

export interface StandingsView {
  rows: Standing[];
  /** 1-based round just completed. */
  round: number;
  totalRounds: number;
  /** Where the player came in the race just run. */
  playerPosition: number;
  playerPoints: number;
  /** Line describing the next round, empty when the season is over. */
  nextRound: string;
  specs: CarSpec[];
  /** Blink phase for the prompt. */
  time: number;
}

/** The between-rounds screen: race result on top, championship table below. */
export function drawStandingsScreen(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: StandingsView,
): void {
  rect(g, 0, 0, w, h, 'rgba(8,10,16,0.86)');

  // Chequered rules top and bottom, the same device the menus use.
  for (let i = 0; i * 6 < w; i++) {
    rect(g, i * 6, 0, 6, 4, i % 2 === 0 ? BONE : INK);
    rect(g, i * 6, h - 4, 6, 4, i % 2 === 0 ? INK : BONE);
  }

  drawText(g, t('standings'), w / 2, 12, { scale: 2, color: BONE, shadow: INK, align: 'center' });
  drawText(
    g,
    `${t('round')} ${view.round}/${view.totalRounds}   ${t('youFinished')} P${view.playerPosition}  +${view.playerPoints} ${t('pts')}`,
    w / 2,
    30,
    { scale: 1, color: '#f2c14e', shadow: INK, align: 'center' },
  );

  const tableW = Math.min(300, w - 60);
  const tableX = Math.round((w - tableW) / 2);
  const used = drawTable(g, tableX, 44, tableW, view.rows, { specs: view.specs });

  if (view.nextRound) {
    drawText(g, `${t('nextRound')}: ${view.nextRound}`, w / 2, 44 + used + 12, {
      scale: 1,
      color: BONE,
      shadow: INK,
      align: 'center',
    });
  }

  if (Math.floor(view.time * 2) % 2 === 0) {
    const hint = t('continueRace');
    drawText(g, hint, w / 2, h - 20, { scale: 1, color: DIM, shadow: INK, align: 'center' });
    void textWidth(hint, { scale: 1 });
  }
}
