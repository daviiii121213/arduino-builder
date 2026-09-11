// Immediate-mode widget helpers. Each returns whether it was activated this frame.

import { button as drawButton, tab as drawTab, slot as drawSlot, bar as drawBar,
         tooltipBox, glyph, FONT, label, heading, wrapText } from '../art/ui.js';
import { P, rgba } from '../art/palette.js';
import { rectHit } from '../core/utils.js';

export class WidgetCtx {
  constructor(ui) { this.ui = ui; }
  get g() { return this.ui.g; }
  get m() { return this.ui.game.input.mouse; }

  hover(x, y, w, h) { return rectHit(this.m.x, this.m.y, { x, y, w, h }); }

  consumeClick(x, y, w, h) {
    if (!this.hover(x, y, w, h)) return false;
    this.ui.hoveringUI = true;
    if (this.m.clicked) { this.m.clicked = false; this.ui.game.audio.play('click'); return true; }
    return false;
  }

  button(x, y, w, h, text, opts = {}) {
    const hov = this.hover(x, y, w, h) && !opts.disabled;
    if (hov) this.ui.hoveringUI = true;
    drawButton(this.g, x, y, w, h, text, { ...opts, hover: hov, pressed: hov && this.m.down });
    if (opts.tip && hov) this.ui.setTooltip(opts.tip, opts.tipBody);
    if (opts.disabled) return false;
    return this.consumeClick(x, y, w, h);
  }

  tab(x, y, w, h, text, active) {
    const hov = this.hover(x, y, w, h);
    if (hov) this.ui.hoveringUI = true;
    drawTab(this.g, x, y, w, h, text, active, hov);
    return this.consumeClick(x, y, w, h);
  }

  slot(x, y, w, h, opts = {}) {
    const hov = this.hover(x, y, w, h);
    if (hov) this.ui.hoveringUI = true;
    drawSlot(this.g, x, y, w, h, { ...opts, hover: hov });
    if (opts.tip && hov) this.ui.setTooltip(opts.tip, opts.tipBody, opts.tipIcon);
    return { hover: hov, clicked: this.consumeClick(x, y, w, h) };
  }

  bar(x, y, w, h, frac, color, opts) { drawBar(this.g, x, y, w, h, frac, color, opts); }
  text(t, x, y, color, font, align) { label(this.g, t, x, y, color, font, align); }
  heading(t, x, y, w) { heading(this.g, t, x, y, w); }
  wrap(t, x, y, w, lh, font, color) { return wrapText(this.g, t, x, y, w, lh, font, color); }
  icon(name, x, y, size, color) { this.g.drawImage(glyph(name, size, color), x, y); }

  /** Scrollable region helper — returns the scroll offset for a list. */
  scroll(key, x, y, w, h, contentH) {
    const s = this.ui.scrolls;
    if (!s[key]) s[key] = 0;
    if (this.hover(x, y, w, h) && this.m.wheel) {
      s[key] += this.m.wheel * 42;
      this.ui.hoveringUI = true;
    }
    s[key] = Math.max(0, Math.min(Math.max(0, contentH - h), s[key]));
    if (contentH > h) {
      const g = this.g;
      const th = Math.max(24, (h / contentH) * h);
      const ty = y + (s[key] / (contentH - h)) * (h - th);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(x + w - 7, y, 6, h);
      g.fillStyle = rgba(P.uiTrim, 0.7);
      g.fillRect(x + w - 7, ty, 6, th);
    }
    return s[key];
  }
}
