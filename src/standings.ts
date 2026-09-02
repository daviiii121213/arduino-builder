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
  /** Points column; off for a knockout, where there are no points. */
  showPoints?: boolean;
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
  const showPoints = opts.showPoints ?? true;
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
  if (showPoints) drawText(g, t('pts'), totalX, y + 3, { scale: 1, color: DIM, align: 'right' });

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
    if (showPoints) {
      drawText(g, String(row.points), totalX, ry + 3, { scale: 1, color: BONE, align: 'right' });
    }
  });

  return height;
}

export interface PhaseRow {
  place: number;
  name: string;
  advanced: boolean;
  isPlayer: boolean;
  tint?: string;
}

export interface PhaseView {
  title: string;
  subtitle: string;
  groups: Array<{ label: string; rows: PhaseRow[] }>;
  /** Rows above this line go through; drawn as a cut across the table. */
  cut: number;
  nextLine: string;
  playerOut: boolean;
  outMessage: string;
  hint: string;
  time: number;
}

/**
 * The elimination screen: who went through, who is out, and what comes next.
 * Two columns for the group stage, one for every round after it.
 */
export function drawPhaseScreen(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: PhaseView,
): void {
  rect(g, 0, 0, w, h, 'rgba(8,10,16,0.88)');
  for (let i = 0; i * 6 < w; i++) {
    rect(g, i * 6, 0, 6, 4, i % 2 === 0 ? BONE : INK);
    rect(g, i * 6, h - 4, 6, 4, i % 2 === 0 ? INK : BONE);
  }

  drawText(g, view.title, w / 2, 12, { scale: 2, color: BONE, shadow: INK, align: 'center' });
  drawText(g, view.subtitle, w / 2, 30, { scale: 1, color: '#f2c14e', shadow: INK, align: 'center' });

  const columns = view.groups.length;
  const colW = Math.min(200, Math.floor((w - 40 - (columns - 1) * 12) / columns));
  const totalW = columns * colW + (columns - 1) * 12;
  const x0 = Math.round((w - totalW) / 2);
  const top = 44;
  const rowH = 13;

  view.groups.forEach((group, ci) => {
    const x = x0 + ci * (colW + 12);
    const height = group.rows.length * rowH + 16;
    rect(g, x - 2, top - 2, colW + 4, height + 4, INK);
    rect(g, x, top, colW, height, PLATE);
    drawText(g, group.label, x + 6, top + 3, { scale: 1, color: DIM });

    group.rows.forEach((row, i) => {
      const y = top + 13 + i * rowH;
      rect(g, x + 2, y, colW - 4, rowH - 1, i % 2 === 0 ? ROW_A : ROW_B);
      if (row.isPlayer) rect(g, x + 2, y, colW - 4, rowH - 1, '#33405a');
      if (row.isPlayer) rect(g, x + 2, y, 2, rowH - 1, KERB);
      drawText(g, String(row.place), x + 7, y + 3, { scale: 1, color: row.isPlayer ? BONE : DIM });
      drawText(g, row.name, x + 20, y + 3, {
        scale: 1,
        color: row.isPlayer ? BONE : (row.tint ?? DIM),
      });
      drawText(g, row.advanced ? t('through') : t('eliminated'), x + colW - 6, y + 3, {
        scale: 1,
        color: row.advanced ? '#5fd06a' : '#c8332b',
        align: 'right',
      });
    });

    // The cut: a chequered line under the last car that goes through.
    const cutY = top + 12 + view.cut * rowH;
    for (let i = 0; i * 4 < colW - 4; i++) {
      rect(g, x + 2 + i * 4, cutY, 4, 1, i % 2 === 0 ? BONE : KERB);
    }
  });

  const tableBottom = top + Math.max(...view.groups.map((gr) => gr.rows.length)) * rowH + 22;
  if (view.playerOut) {
    drawText(g, view.outMessage, w / 2, tableBottom, {
      scale: 1,
      color: KERB,
      shadow: INK,
      align: 'center',
    });
  } else if (view.nextLine) {
    drawText(g, view.nextLine, w / 2, tableBottom, {
      scale: 1,
      color: BONE,
      shadow: INK,
      align: 'center',
    });
  }

  if (Math.floor(view.time * 2) % 2 === 0) {
    drawText(g, view.hint, w / 2, h - 20, { scale: 1, color: DIM, shadow: INK, align: 'center' });
  }
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
