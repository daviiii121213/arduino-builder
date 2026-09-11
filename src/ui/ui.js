// UI manager: owns the HUD, the windows, notifications and tooltips, and routes
// keyboard shortcuts. Everything is immediate-mode over the game canvas.

import { HUD } from './hud.js';
import { Panels } from './panels.js';
import { WidgetCtx } from './widgets.js';
import { tooltipBox, FONT, glyph } from '../art/ui.js';
import { P, rgba } from '../art/palette.js';
import { engraved, rr } from '../art/draw.js';
import { portrait } from '../art/characters.js';
import { itemIcon } from '../art/icons.js';
import { clamp } from '../core/utils.js';
import { ITEMS } from '../data/items.js';

const PANEL_KEYS = {
  i: 'inventory', tab: 'management', b: 'build', t: 'research',
  j: 'missions', k: 'skills', m: 'map', f1: 'settings',
};

export class UI {
  constructor(game) {
    this.game = game;
    this.panel = null;
    this.notifications = [];
    this.pickups = [];
    this.tooltip = null;
    this.dialog = null;
    this.missionToast = null;
    this.selectedItem = null;
    this.scrolls = {};
    this.hoveringUI = false;
    this.textFocus = false;
    this.wc = new WidgetCtx(this);
    this.hud = new HUD(this);
    this.panels = new Panels(this);
    this.playerPortrait = portrait('player', 3, 58);
    this.w = 0; this.h = 0;
  }

  notify(text, kind = 'info') {
    this.notifications.unshift({ text, kind, life: 4 });
    if (this.notifications.length > 5) this.notifications.pop();
  }

  flashItem(id, n) {
    const ex = this.pickups.find((p) => p.id === id && p.life > 1.4);
    if (ex) { ex.n += n; ex.life = 2.4; return; }
    this.pickups.unshift({ id, n, life: 2.4 });
    if (this.pickups.length > 6) this.pickups.pop();
  }

  showMissionComplete(m) { this.missionToast = { mission: m, t: 0, life: 5 }; }

  setTooltip(title, body, icon, x, y) { this.tooltip = { title, body, icon, x, y }; }

  open(name) {
    if (this.panel === name) return this.close();
    this.panel = name;
    this.game.audio.play('open');
    if (name !== 'machine') this.game.selected = null;
  }

  close() {
    if (this.panel) this.game.audio.play('close');
    this.panel = null;
    this.game.selected = null;
  }

  update(dt, input) {
    for (const n of this.notifications) n.life -= dt;
    this.notifications = this.notifications.filter((n) => n.life > 0);
    for (const p of this.pickups) p.life -= dt;
    this.pickups = this.pickups.filter((p) => p.life > 0);
    if (this.missionToast) {
      this.missionToast.t += dt; this.missionToast.life -= dt;
      if (this.missionToast.life <= 0) this.missionToast = null;
    }

    // keyboard shortcuts
    for (const [key, name] of Object.entries(PANEL_KEYS)) {
      if (input.hit(key)) {
        if (name === 'build' && this.game.build.active && !this.panel) this.game.cancelBuild();
        this.open(name);
      }
    }
    if (input.hit('escape')) {
      if (this.dialog) this.dialog = null;
      else if (this.panel) this.close();
      else if (this.game.build.active) this.game.cancelBuild();
      else this.open('settings');
    }
  }

  draw(g, w, h) {
    this.g = g; this.w = w; this.h = h;
    this.hoveringUI = false;
    this.tooltip = null;

    this.hud.draw(g, w, h);
    this.drawPickups(g, w, h);

    const p = this.panel;
    if (p === 'build') this.panels.build(g);
    else if (p === 'inventory') this.panels.inventory(g);
    else if (p === 'machine') this.panels.machine(g);
    else if (p === 'management') this.panels.management(g);
    else if (p === 'research') this.panels.research(g);
    else if (p === 'map') this.panels.map(g);
    else if (p === 'missions') this.panels.missions(g);
    else if (p === 'skills') this.panels.skills(g);
    else if (p === 'settings') this.panels.settings(g);

    if (this.dialog) this.panels.dialogue(g);
    this.panels.missionComplete(g);
    this.drawBuildBanner(g, w, h);
    this.drawTooltip(g, w, h);
  }

  drawPickups(g, w, h) {
    let y = h - 260;
    for (const p of this.pickups) {
      const a = clamp(p.life / 0.8, 0, 1);
      g.save(); g.globalAlpha = a;
      g.drawImage(itemIcon(p.id), 20, y, 30, 30);
      engraved(g, `+${p.n}  ${ITEMS[p.id]?.name || p.id}`, 56, y + 21, FONT.body, P.uiTrimHi);
      g.restore();
      y -= 32;
    }
  }

  drawBuildBanner(g, w, h) {
    const b = this.game.build;
    if (!b.active && !b.demolish) return;
    const text = b.demolish ? 'DEMOLISH MODE — click a machine to remove it'
      : `Placing ${this.game.BUILDABLES[b.type].name}  —  R rotate  •  right click / Esc cancel`;
    const tw = 520, x = w / 2 - tw / 2, y = 62;
    g.fillStyle = 'rgba(10,12,16,0.82)';
    rr(g, x, y, tw, 30, 5); g.fill();
    g.strokeStyle = rgba(b.demolish ? P.uiBad : P.uiTrim, 0.8); g.lineWidth = 1.4; g.stroke();
    engraved(g, text, w / 2, y + 20, FONT.body, b.demolish ? P.uiBad : P.uiTrimHi, 'center');
  }

  drawTooltip(g, w, h) {
    const t = this.tooltip;
    if (!t) return;
    const pad = 10;
    g.font = FONT.h3;
    let tw = g.measureText(t.title).width;
    const lines = (t.body || '').split('\n').filter(Boolean);
    g.font = FONT.small;
    for (const l of lines) tw = Math.max(tw, g.measureText(l).width);
    const iconW = t.icon ? 44 : 0;
    const bw = tw + pad * 2 + iconW, bh = 26 + lines.length * 15 + pad;
    let x = (t.x ?? this.game.input.mouse.x + 16), y = (t.y ?? this.game.input.mouse.y + 16);
    x = clamp(x, 4, w - bw - 4); y = clamp(y, 4, h - bh - 4);
    tooltipBox(g, x, y, bw, bh);
    if (t.icon) g.drawImage(t.icon, x + pad, y + pad, 36, 36);
    engraved(g, t.title, x + pad + iconW, y + 24, FONT.h3, P.uiTrimHi);
    lines.forEach((l, i) => engraved(g, l, x + pad + iconW, y + 42 + i * 15, FONT.small, P.uiText));
  }
}
