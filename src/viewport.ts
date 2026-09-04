/**
 * How the window is turned into a render buffer. Kept apart from the game so
 * the rule can be checked without a canvas.
 */

import { clamp } from './math';

/** Roughly how many world pixels tall the view should be; sets the zoom. */
export const TARGET_VIEW_HEIGHT = 360;
/** The buffer never goes below this, so menus laid out for a desktop window
 * still fit on a phone: on a short screen the zoom drops instead. */
export const MIN_BUFFER_W = 340;
export const MIN_BUFFER_H = 280;

/**
 * How many screen pixels one game pixel takes. The zoom follows the height so
 * the view always frames about the same amount of track, then backs off until
 * the buffer is big enough for the menus — which is what keeps a phone, in
 * either orientation, from cropping them.
 */
export function pickZoom(cssW: number, cssH: number): number {
  let zoom = clamp(Math.round(cssH / TARGET_VIEW_HEIGHT), 1, 5);
  while (zoom > 1 && (cssW / zoom < MIN_BUFFER_W || cssH / zoom < MIN_BUFFER_H)) zoom--;
  return zoom;
}
