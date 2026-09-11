// Heads-up display: vitals, money and power readouts, hotbar, minimap, notifications
// and the objective tracker.

import { drawPanel, glyph, FONT, bar as drawBar, slot, tooltipBox } from '../art/ui.js';
import { P, rgba, shade, mix } from '../art/palette.js';
import { makeCanvas, rr, engraved, plate, glow, hazard } from '../art/draw.js';
import { money, shortNum, clamp, timeStr } from '../core/utils.js';
import { itemIcon, itemChip } from '../art/icons.js';
import { TILE, T } from '../world/world.js';
import { TILE_AVG } from '../art/tiles.js';
import { BUILDABLES } from '../data/buildables.js';
import { machineSprite } from '../art/machines.js';
import { MISSIONS } from '../systems/missions.js';

export class HUD {
  constructor(ui) {
    this.ui = ui;
    this.game = ui.game;
    this.minimap = null;
    this.minimapT = 99;
  }

  draw(g, w, h) {
    const game = this.game, c = this.ui.wc;
    this.drawVitals(g, 14, 14);
    this.drawMoney(g, w - 14, 14);
    this.drawObjective(g, w - 14, 104);
    this.drawHotbar(g, w / 2, h - 14);
    this.drawMinimap(g, 14, h - 14);
    this.drawClock(g, w / 2, 16);
    this.drawNotifications(g, w, h);
    this.drawCursorInfo(g, w, h);
  }

  // ------------------------------------------------------------------ vitals
  drawVitals(g, x, y) {
    const p = this.game.player;
    const w = 246, h = 96;
    drawPanel(g, x, y, w, h);
    // portrait
    const pc = this.ui.playerPortrait;
    g.drawImage(pc, x + 12, y + 12, 58, 58);
    const bx = x + 78, bw = w - 92;

    engraved(g, `Engineer  —  Level ${p.level}`, bx, y + 26, FONT.h3, P.uiTrimHi);
    g.drawImage(glyph('heart', 11, P.uiBad), bx - 2, y + 33);
    drawBar(g, bx + 13, y + 33, bw - 13, 11, p.health / p.maxHealth, P.uiBad,
      { label: `${Math.round(p.health)}`, labelColor: '#1a0c0a' });
    g.drawImage(glyph('stamina', 11, P.uiGood), bx - 2, y + 49);
    drawBar(g, bx + 13, y + 49, bw - 13, 11, p.stamina / p.maxStamina, P.uiGood,
      { label: `${Math.round(p.stamina)}`, labelColor: '#0c1a0c' });
    g.drawImage(glyph('xp', 11, P.uiTrimHi), bx - 2, y + 65);
    drawBar(g, bx + 13, y + 65, bw - 13, 11, p.xp / p.xpNext, P.uiTrimHi,
      { label: `${Math.floor(p.xp)} / ${p.xpNext} XP`, labelColor: '#1d1608' });
    if (p.skillPoints > 0) {
      const px = x + 14, py = y + h - 18;
      g.fillStyle = P.uiTrimHi;
      g.beginPath(); g.arc(px + 4, py, 8, 0, Math.PI * 2); g.fill();
      engraved(g, String(p.skillPoints), px + 4, py + 4, FONT.tiny, '#1d1608', 'center');
    }
  }

  // ------------------------------------------------------------------ money
  drawMoney(g, right, y) {
    const game = this.game;
    const w = 260, h = 80, x = right - w;
    drawPanel(g, x, y, w, h);
    g.drawImage(glyph('money', 22, P.uiTrimHi), x + 16, y + 16);
    engraved(g, money(game.money), x + 44, y + 33, FONT.h1, game.money < 0 ? P.uiBad : P.uiText);

    const net = game.netPerMinute;
    engraved(g, `${net >= 0 ? '+' : ''}${money(net)}/min`, x + 44, y + 50, FONT.small,
      net >= 0 ? P.uiGood : P.uiBad);

    // power meter
    const gen = game.factory.stats.powerGen, use = game.factory.stats.powerUse;
    const frac = use <= 0 ? 1 : clamp(gen / use, 0, 1);
    g.drawImage(glyph('power', 14, gen >= use ? P.uiGood : P.uiBad), x + 15, y + 55);
    drawBar(g, x + 34, y + 56, w - 50, 13, frac, gen >= use ? P.uiGood : P.uiWarn,
      { label: `${gen.toFixed(0)} / ${use.toFixed(0)} kW`, labelColor: '#0d1410' });
  }

  // ------------------------------------------------------------------ clock
  drawClock(g, cx, y) {
    const t = this.game.time;
    const w = 168, h = 34, x = cx - w / 2;
    drawPanel(g, x, y, w, h, 'dark');
    const hour = Math.floor(t.hour), min = Math.floor((t.hour % 1) * 60);
    engraved(g, `Day ${t.day}   ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
      x + w / 2 + 8, y + 22, FONT.mono, P.uiText, 'center');
    // little sun/moon dial
    const dl = t.daylight;
    g.save();
    g.translate(x + 20, y + h / 2);
    g.fillStyle = dl > 0.4 ? P.glowWarm : '#cdd6e0';
    g.beginPath(); g.arc(0, 0, 6, 0, Math.PI * 2); g.fill();
    if (dl <= 0.4) { g.fillStyle = '#23282f'; g.beginPath(); g.arc(2.6, -2, 5, 0, Math.PI * 2); g.fill(); }
    else { g.strokeStyle = rgba(P.glowWarm, 0.6); g.lineWidth = 1.4;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2;
        g.beginPath(); g.moveTo(Math.cos(a) * 7.6, Math.sin(a) * 7.6); g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); g.stroke(); } }
    g.restore();
  }

  // ------------------------------------------------------------------ objective
  drawObjective(g, right, y) {
    const ms = this.game.missions;
    const m = MISSIONS.find((x) => x.id === ms.tracked);
    if (!m) return;
    const w = 250, x = right - w;
    const lines = m.goals.length;
    const h = 42 + lines * 17;
    drawPanel(g, x, y, w, h, 'dark');
    g.drawImage(glyph('mission', 14, P.uiTrimHi), x + 14, y + 13);
    engraved(g, m.name, x + 34, y + 25, FONT.h3, P.uiTrimHi);
    m.goals.forEach((goal, i) => {
      const done = ms.goalDone(m, i);
      const prog = ms.goalProgress(m, i), tgt = ms.goalTarget(goal);
      const gy = y + 44 + i * 17;
      g.fillStyle = done ? P.uiGood : rgba('#ffffff', 0.25);
      g.beginPath(); g.arc(x + 20, gy - 4, 4.2, 0, Math.PI * 2); g.fill();
      if (done) {
        g.strokeStyle = '#101418'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x + 18, gy - 4); g.lineTo(x + 19.6, gy - 2.2); g.lineTo(x + 22.4, gy - 6); g.stroke();
      }
      engraved(g, this.goalText(goal, prog, tgt), x + 30, gy, FONT.small, done ? P.uiDim : P.uiText);
    });
  }

  goalText(g, prog, tgt) {
    const nm = {
      produce: () => `Produce ${this.itemName(g.item)}`,
      build: () => `Build ${BUILDABLES[g.type]?.name || g.type}`,
      have: () => `Hold ${this.itemName(g.item)}`,
      money: () => 'Bank capital',
      sell: () => 'Earn from sales',
      tech: () => `Research ${g.id.replace(/_/g, ' ')}`,
      hire: () => 'Hire staff',
      power: () => 'Generation capacity',
      machines: () => 'Machines built',
    }[g.kind];
    const unit = g.kind === 'money' || g.kind === 'sell' ? '$' : '';
    const num = g.kind === 'tech' ? '' : `  ${unit}${shortNum(prog)}/${unit}${shortNum(tgt)}`;
    return (nm ? nm() : g.kind) + num;
  }

  itemName(id) { return (this.game.ITEMS[id] || { name: id }).name; }

  // ------------------------------------------------------------------ hotbar
  drawHotbar(g, cx, bottom) {
    const slots = this.game.hotbar;
    const n = slots.length, s = 54, pad = 5;
    const w = n * (s + pad) + pad + 8, h = s + 16;
    const x = cx - w / 2, y = bottom - h;
    drawPanel(g, x, y, w, h, 'dark');
    for (let i = 0; i < n; i++) {
      const sx = x + 8 + i * (s + pad), sy = y + 8;
      const id = slots[i];
      const sel = this.game.build.active && this.game.build.type === id;
      const r = this.ui.wc.slot(sx, sy, s, s, {
        selected: sel,
        tip: id ? BUILDABLES[id].name : 'Empty slot',
        tipBody: id ? `${BUILDABLES[id].desc}\n$${BUILDABLES[id].cost}` : 'Pick something in the build menu (B)',
      });
      if (id) {
        const spr = machineSprite(id, 0);
        const scale = Math.min((s - 14) / spr.w, (s - 22) / spr.h, 1.4);
        g.drawImage(spr.canvas, sx + s / 2 - (spr.w * scale) / 2, sy + (s - 12) / 2 - (spr.h * scale) / 2 + 2,
          spr.w * scale, spr.h * scale);
        const cost = BUILDABLES[id].cost;
        g.fillStyle = 'rgba(8,10,14,0.7)';
        g.fillRect(sx + 1, sy + s - 13, s - 2, 12);
        engraved(g, '$' + shortNum(cost), sx + s / 2, sy + s - 4, FONT.tiny,
          this.game.money >= cost ? P.uiText : P.uiBad, 'center');
      }
      engraved(g, String(i + 1), sx + 5, sy + 12, FONT.tiny, P.uiDim);
      if (r.clicked) this.game.selectHotbar(i);
    }
  }

  // ------------------------------------------------------------------ minimap
  buildMinimap() {
    const w = this.game.world;
    const size = 168;
    const { c, g } = makeCanvas(size, size);
    const step = w.W / size;
    const img = g.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const tx = Math.floor(x * step), ty = Math.floor(y * step);
        let col = TILE_AVG[w.tile(tx, ty)] || '#333';
        if (w.nodeAt(tx, ty)) col = '#d4a24a';
        const p = parseInt(col.slice(1), 16);
        const i = (y * size + x) * 4;
        img.data[i] = (p >> 16) & 255; img.data[i + 1] = (p >> 8) & 255;
        img.data[i + 2] = p & 255; img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.minimap = c;
    this.minimapSize = size;
  }

  drawMinimap(g, x, bottom) {
    if (!this.minimap) this.buildMinimap();
    const size = this.minimapSize, pad = 10;
    const y = bottom - size - pad * 2;
    drawPanel(g, x, y, size + pad * 2, size + pad * 2, 'dark');
    const mx = x + pad, my = y + pad;
    g.save();
    g.beginPath(); rr(g, mx, my, size, size, 3); g.clip();
    g.drawImage(this.minimap, mx, my);
    const w = this.game.world;
    const sc = size / w.W;
    // factory footprint
    g.fillStyle = rgba(P.uiTrimHi, 0.85);
    for (const e of this.game.factory.ents) {
      if (e.kind === 'cable' || e.kind === 'belt') continue;
      g.fillRect(mx + e.x * sc, my + e.y * sc, Math.max(1.5, e.w * sc), Math.max(1.5, e.h * sc));
    }
    // plot outline
    const p = w.plot;
    g.strokeStyle = rgba(P.uiTrim, 0.9); g.lineWidth = 1;
    g.strokeRect(mx + p.x * sc, my + p.y * sc, p.w * sc, p.h * sc);
    // player blip
    const px = mx + this.game.player.x * sc, py = my + this.game.player.y * sc;
    glow(g, px, py, 7, P.glowCold, 0.7);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, 2.4, 0, Math.PI * 2); g.fill();
    // view rectangle
    const v = this.game.cam.view;
    g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 1;
    g.strokeRect(mx + (v.x0 / TILE) * sc, my + (v.y0 / TILE) * sc,
      ((v.x1 - v.x0) / TILE) * sc, ((v.y1 - v.y0) / TILE) * sc);
    g.restore();
    g.strokeStyle = rgba('#000', 0.8); g.lineWidth = 1.4;
    rr(g, mx - 0.5, my - 0.5, size + 1, size + 1, 3); g.stroke();
    const region = this.game.currentRegion;
    if (region) engraved(g, region.name, mx + size / 2, my + size - 6, FONT.tiny, P.uiTrimHi, 'center');
  }

  // ------------------------------------------------------------------ notifications
  drawNotifications(g, w, h) {
    const list = this.ui.notifications;
    let y = 150;
    for (const n of list) {
      const a = clamp(n.life > 0.6 ? 1 : n.life / 0.6, 0, 1);
      const tw = 300;
      g.save();
      g.globalAlpha = a;
      const col = { good: P.uiGood, bad: P.uiBad, warn: P.uiWarn, info: P.glowCold }[n.kind] || P.uiText;
      const x = w / 2 - tw / 2;
      g.fillStyle = 'rgba(10,12,16,0.82)';
      rr(g, x, y, tw, 30, 5); g.fill();
      g.strokeStyle = rgba(col, 0.8); g.lineWidth = 1.4; g.stroke();
      g.fillStyle = col; g.fillRect(x + 2, y + 2, 3.5, 26);
      engraved(g, n.text, x + 16, y + 20, FONT.body, P.uiText);
      g.restore();
      y += 36;
    }
  }

  // ------------------------------------------------------------------ cursor
  drawCursorInfo(g, w, h) {
    const game = this.game;
    if (this.ui.hoveringUI || this.ui.panel) return;
    const t = game.hoverTarget;
    if (!t) return;
    const m = game.input.mouse;
    let title = '', body = '', icon = null;
    if (t.kind === 'ent') {
      const e = t.e;
      title = e.def.name;
      const bits = [];
      if (e.broken) bits.push('BROKEN — press E to repair');
      else if (e.def.power > 0 && !e.powered) bits.push('No power');
      if (e.recipe && game.RECIPES[e.recipe]) bits.push(game.RECIPES[e.recipe].name);
      bits.push(`Condition ${Math.round(e.condition * 100)}%`);
      if (e.kind === 'gen') bits.push(`${e.def.output} kW`);
      body = bits.join('\n');
    } else if (t.kind === 'node') {
      title = game.ITEMS[t.node.type].name + ' deposit';
      body = `${t.node.amount} remaining\nClick to mine by hand`;
      icon = itemIcon(t.node.type);
    } else if (t.kind === 'prop') {
      title = t.p.label || ({ tree: 'Tree', boulder: 'Boulder', bush: 'Shrub' }[t.p.type] || 'Scenery');
      if (t.p.type === 'tree') body = 'Click to chop for wood';
      if (t.p.type === 'boulder') body = 'Click to break for stone';
    } else if (t.kind === 'npc') {
      title = t.n.name;
      body = t.n.role ? (t.n.title || t.n.role) + '\nPress E to talk' : '';
    }
    if (!title) return;
    this.ui.setTooltip(title, body, icon, m.x + 18, m.y + 18);
  }
}
