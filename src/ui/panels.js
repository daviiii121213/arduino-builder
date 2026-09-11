// Full-screen game windows: build menu, inventory, machine inspector, management hub,
// research tree, world map, missions, skills, dialogue and settings.

import { drawPanel, glyph, FONT, heading, label, wrapText, bar as drawBar, slot as drawSlot } from '../art/ui.js';
import { P, rgba, shade, mix } from '../art/palette.js';
import { rr, engraved, plate, glow, hazard, makeCanvas, vgrad } from '../art/draw.js';
import { money, shortNum, clamp, timeStr, TAU } from '../core/utils.js';
import { itemIcon, itemChip } from '../art/icons.js';
import { BUILDABLES, CATEGORIES, buildablesFor } from '../data/buildables.js';
import { RECIPES, recipesFor } from '../data/recipes.js';
import { ITEMS } from '../data/items.js';
import { TECHS } from '../data/research.js';
import { MISSIONS } from '../systems/missions.js';
import { machineSprite } from '../art/machines.js';
import { portrait } from '../art/characters.js';
import { ROLE_INFO } from '../entities/npc.js';
import { TILE } from '../world/world.js';
import { TILE_AVG } from '../art/tiles.js';

export class Panels {
  constructor(ui) {
    this.ui = ui; this.game = ui.game;
    this.mgmtTab = 'overview';
    this.buildCat = 'logistics';
    this.portraits = new Map();
  }

  portraitFor(role, seed) {
    const k = role + seed;
    if (!this.portraits.has(k)) this.portraits.set(k, portrait(role, seed, 52));
    return this.portraits.get(k);
  }

  /** Standard window chrome; returns the inner content rect. */
  window(g, title, w, h, iconName) {
    const c = this.ui.wc;
    const W = this.ui.w, H = this.ui.h;
    const x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2);
    g.fillStyle = 'rgba(6,8,11,0.55)';
    g.fillRect(0, 0, W, H);
    drawPanel(g, x, y, w, h);
    if (iconName) g.drawImage(glyph(iconName, 20, P.uiTrimHi), x + 16, y + 12);
    engraved(g, title, x + (iconName ? 44 : 18), y + 29, FONT.h2, P.uiTrimHi);
    if (c.button(x + w - 40, y + 10, 26, 24, '', { tip: 'Close (Esc)' })) this.ui.close();
    g.drawImage(glyph('close', 13, P.uiText), x + w - 33, y + 16);
    // any click inside the window should not fall through to the world
    if (c.hover(x, y, w, h)) this.ui.hoveringUI = true;
    return { x: x + 18, y: y + 46, w: w - 36, h: h - 64, ox: x, oy: y, ow: w, oh: h };
  }

  // ============================================================ BUILD MENU
  build(g) {
    const c = this.ui.wc, game = this.game;
    const r = this.window(g, 'Construction', 760, 520, 'gearIcon');
    let tx = r.x;
    for (const cat of CATEGORIES) {
      const w = 128;
      if (c.tab(tx, r.y, w, 30, cat.name, this.buildCat === cat.id)) this.buildCat = cat.id;
      tx += w + 6;
    }
    const list = buildablesFor(this.buildCat, game.research.unlocked);
    const gx = r.x, gy = r.y + 42, cw = 152, ch = 126, cols = 4;
    const rows = Math.ceil(list.length / cols);
    const off = c.scroll('build', gx, gy, r.w, r.h - 52, rows * (ch + 10));

    g.save();
    g.beginPath(); g.rect(gx, gy, r.w, r.h - 52); g.clip();
    list.forEach((b, i) => {
      const col = i % cols, row = (i / cols) | 0;
      const x = gx + col * (cw + 8), y = gy + row * (ch + 10) - off;
      if (y > gy + r.h || y + ch < gy) return;
      const afford = game.money >= b.cost;
      const sel = game.build.type === b.id;
      const s = c.slot(x, y, cw, ch, { selected: sel,
        tip: b.name, tipBody: `${b.desc}\n\nCost $${b.cost}${b.power ? `  •  ${b.power} kW` : ''}${b.output ? `  •  +${b.output} kW` : ''}` });
      const spr = machineSprite(b.id, 0);
      const scale = Math.min((cw - 28) / spr.w, (ch - 52) / spr.h, 1.6);
      g.drawImage(spr.canvas, x + cw / 2 - (spr.w * scale) / 2, y + 12 + (ch - 52) / 2 - (spr.h * scale) / 2,
        spr.w * scale, spr.h * scale);
      engraved(g, b.name, x + cw / 2, y + ch - 22, FONT.small, P.uiText, 'center');
      engraved(g, '$' + shortNum(b.cost), x + cw / 2, y + ch - 8, FONT.tiny, afford ? P.uiGood : P.uiBad, 'center');
      if (s.clicked) { game.pickBuild(b.id); }
    });
    g.restore();

    engraved(g, 'Left click to place  •  R rotate  •  Right click cancel  •  X demolish',
      r.x, r.oy + r.oh - 18, FONT.small, P.uiDim);
  }

  // ============================================================ INVENTORY
  inventory(g) {
    const c = this.ui.wc, game = this.game, p = game.player;
    const r = this.window(g, 'Inventory', 700, 500, 'box');
    const ids = Object.keys(p.inv).sort((a, b) => (ITEMS[b]?.value || 0) - (ITEMS[a]?.value || 0));
    const cols = 8, cell = 64;
    engraved(g, `${p.invUsedSlots()} / ${p.invCapacity()} slots`, r.x + r.w, r.y + 12, FONT.small, P.uiDim, 'right');

    const gy = r.y + 24;
    const rows = Math.max(4, Math.ceil(ids.length / cols));
    const off = c.scroll('inv', r.x, gy, r.w, 270, rows * (cell + 6));
    g.save(); g.beginPath(); g.rect(r.x, gy, r.w, 270); g.clip();
    for (let i = 0; i < rows * cols; i++) {
      const col = i % cols, row = (i / cols) | 0;
      const x = r.x + col * (cell + 6), y = gy + row * (cell + 6) - off;
      if (y > gy + 280 || y + cell < gy) continue;
      const id = ids[i];
      const it = id ? ITEMS[id] : null;
      const sel = this.ui.selectedItem === id;
      const s = c.slot(x, y, cell, cell, { selected: sel, tip: it ? it.name : null,
        tipBody: it ? `Value $${Math.round(game.market.sellPrice(id))} each\nHeld ${p.inv[id]}` : null,
        tipIcon: it ? itemIcon(id) : null });
      if (it) {
        g.drawImage(itemIcon(id), x + 8, y + 5, 48, 48);
        engraved(g, String(p.inv[id]), x + cell - 5, y + cell - 5, FONT.mono, P.uiText, 'right');
        if (s.clicked) this.ui.selectedItem = sel ? null : id;
      }
    }
    g.restore();

    // detail + actions
    const dy = gy + 284;
    g.fillStyle = 'rgba(0,0,0,0.25)'; rr(g, r.x, dy, r.w, 96, 4); g.fill();
    const sel = this.ui.selectedItem;
    if (sel && p.inv[sel]) {
      const it = ITEMS[sel];
      g.drawImage(itemIcon(sel), r.x + 14, dy + 16, 56, 56);
      engraved(g, it.name, r.x + 84, dy + 30, FONT.h2, P.uiTrimHi);
      engraved(g, `Tier ${it.tier}  •  ${it.cat}  •  base $${it.value}`, r.x + 84, dy + 48, FONT.small, P.uiDim);
      const unit = game.market.sellPrice(sel);
      engraved(g, `Market price $${unit.toFixed(1)} each  (you hold ${p.inv[sel]})`, r.x + 84, dy + 66, FONT.small, P.uiText);
      const bx = r.x + r.w - 330;
      if (c.button(bx, dy + 26, 100, 30, 'Sell 1')) game.sellFromInventory(sel, 1);
      if (c.button(bx + 106, dy + 26, 100, 30, 'Sell 10')) game.sellFromInventory(sel, 10);
      if (c.button(bx + 212, dy + 26, 110, 30, 'Sell all', { primary: true })) game.sellFromInventory(sel, p.inv[sel]);
      if (c.button(bx + 212, dy + 60, 110, 26, 'Drop stack', { danger: true })) { delete p.inv[sel]; this.ui.selectedItem = null; }
    } else {
      engraved(g, 'Select an item to sell it at the current market price.', r.x + 16, dy + 30, FONT.body, P.uiDim);
      engraved(g, 'Tip: a Loading Dock sells automatically, and pays the same rate.', r.x + 16, dy + 52, FONT.small, P.uiDim);
    }
  }

  // ============================================================ MACHINE PANEL
  machine(g) {
    const c = this.ui.wc, game = this.game;
    const e = game.selected;
    if (!e || !game.factory.ents.includes(e)) { this.ui.close(); return; }
    const r = this.window(g, e.def.name, 620, 470, 'gearIcon');

    // portrait of the machine
    const spr = machineSprite(e.type, e.dir);
    const scale = Math.min(150 / spr.w, 130 / spr.h, 2.2);
    g.fillStyle = 'rgba(0,0,0,0.3)'; rr(g, r.x, r.y, 170, 150, 4); g.fill();
    g.drawImage(spr.canvas, r.x + 85 - (spr.w * scale) / 2, r.y + 78 - (spr.h * scale) / 2, spr.w * scale, spr.h * scale);

    const ix = r.x + 186;
    let y = r.y + 18;
    engraved(g, e.broken ? 'BROKEN DOWN' : e.disabled ? 'SWITCHED OFF' : e.active ? 'RUNNING' : 'IDLE',
      ix, y, FONT.h3, e.broken ? P.uiBad : e.active ? P.uiGood : P.uiWarn);
    y += 22;
    engraved(g, 'Condition', ix, y, FONT.small, P.uiDim);
    drawBar(g, ix + 74, y - 9, 200, 11, e.condition, e.condition > 0.5 ? P.uiGood : e.condition > 0.25 ? P.uiWarn : P.uiBad,
      { label: Math.round(e.condition * 100) + '%' });
    y += 22;
    if (e.def.power > 0) {
      engraved(g, 'Power', ix, y, FONT.small, P.uiDim);
      drawBar(g, ix + 74, y - 9, 200, 11, e.satisfaction, e.satisfaction > 0.95 ? P.uiGood : P.uiWarn,
        { label: `${e.def.power} kW` });
      y += 22;
    }
    if (e.kind === 'gen') {
      engraved(g, 'Output', ix, y, FONT.small, P.uiDim);
      engraved(g, `${(e.def.output * (0.55 + 0.45 * e.condition)).toFixed(0)} kW`, ix + 74, y, FONT.mono, P.uiTrimHi);
      y += 20;
      if (e.def.fuel) {
        engraved(g, 'Fuel', ix, y, FONT.small, P.uiDim);
        drawBar(g, ix + 74, y - 9, 200, 11, clamp(e.fuel / (e.def.burnTime || 1), 0, 1), P.glowHot,
          { label: `${e.inBuf[e.def.fuel] || 0} ${ITEMS[e.def.fuel].name}` });
        y += 22;
      }
    }
    if (e.type === 'furnace') {
      engraved(g, 'Temperature', ix, y, FONT.small, P.uiDim);
      drawBar(g, ix + 90, y - 9, 184, 11, clamp(e.temp / 900, 0, 1), e.temp > 820 ? P.uiBad : P.glowHot,
        { label: `${Math.round(e.temp)} C` });
      y += 22;
    }
    engraved(g, `Produced ${e.totalMade} cycles  •  ${e.workers} worker(s) on station`, ix, y, FONT.small, P.uiDim);

    // ---- recipe selector
    let ry = r.y + 168;
    if (e.kind === 'machine' && e.type !== 'waterpump') {
      heading(g, 'Recipe', r.x, ry, r.w);
      ry += 14;
      const list = recipesFor(e.type, game.research.unlocked);
      const cellW = (r.w - 12) / 3;
      list.forEach((rec, i) => {
        const x = r.x + (i % 3) * (cellW + 6), yy = ry + ((i / 3) | 0) * 52;
        const sel = e.recipe === rec.id;
        const s = c.slot(x, yy, cellW, 46, { selected: sel, tip: rec.name,
          tipBody: this.recipeText(rec) });
        const outId = Object.keys(rec.out)[0];
        if (outId) g.drawImage(itemChip(outId, 30), x + 7, yy + 8);
        engraved(g, rec.name, x + 44, yy + 20, FONT.small, P.uiText);
        engraved(g, `${rec.time.toFixed(1)}s`, x + 44, yy + 35, FONT.tiny, P.uiDim);
        if (s.clicked) { e.recipe = rec.id; e.progress = 0; game.notify(`${e.def.name}: ${rec.name}`, 'info'); }
      });
      ry += Math.ceil(list.length / 3) * 52 + 10;
    }

    // ---- buffers
    heading(g, 'Buffers', r.x, ry, r.w); ry += 16;
    const drawBuf = (title, buf, bx) => {
      engraved(g, title, bx, ry + 10, FONT.small, P.uiDim);
      const ids = Object.keys(buf).filter((k) => buf[k] > 0).slice(0, 6);
      if (!ids.length) engraved(g, 'empty', bx + 62, ry + 10, FONT.small, rgba(P.uiDim, 0.6));
      ids.forEach((id, i) => {
        const x = bx + 62 + i * 40;
        c.slot(x, ry - 6, 36, 36, { tip: ITEMS[id].name, tipIcon: itemIcon(id) });
        g.drawImage(itemChip(id, 26), x + 5, ry - 1);
        engraved(g, String(buf[id]), x + 33, ry + 27, FONT.tiny, P.uiText, 'right');
      });
    };
    drawBuf('Input', e.inBuf, r.x); ry += 44;
    drawBuf('Output', e.outBuf, r.x); ry += 46;

    // ---- actions
    const by = r.oy + r.oh - 52;
    const repairCost = Math.round(e.def.cost * 0.22 * (1 - e.condition));
    if (c.button(r.x, by, 130, 34, e.broken ? 'Repair' : 'Service',
      { disabled: e.condition > 0.995, primary: e.broken, tip: `Costs $${repairCost}` }))
      game.repairMachine(e);
    if (c.button(r.x + 138, by, 120, 34, e.disabled ? 'Switch on' : 'Switch off')) e.disabled = !e.disabled;
    if (c.button(r.x + 266, by, 120, 34, 'Take output', { disabled: e.totalOut() === 0 })) game.takeOutput(e);
    if (c.button(r.x + r.w - 130, by, 130, 34, 'Demolish', { danger: true,
      tip: `Refunds $${Math.round(e.def.cost * 0.6)}` })) { game.demolish(e); this.ui.close(); }
  }

  recipeText(rec) {
    const ins = Object.entries(rec.in).map(([k, n]) => `${n}x ${ITEMS[k].name}`).join(', ') || 'nothing';
    const outs = Object.entries(rec.out).map(([k, n]) => `${n}x ${ITEMS[k].name}`).join(', ');
    return `${ins}\n  ->  ${outs}\n${rec.time}s per cycle`;
  }

  // ============================================================ MANAGEMENT HUB
  management(g) {
    const c = this.ui.wc, game = this.game;
    const r = this.window(g, 'Factory Management', 880, 580, 'chart');
    const tabs = [['overview', 'Overview'], ['market', 'Market'], ['contracts', 'Contracts'],
      ['staff', 'Employees'], ['stats', 'Statistics']];
    let tx = r.x;
    for (const [id, name] of tabs) {
      if (c.tab(tx, r.y, 140, 30, name, this.mgmtTab === id)) this.mgmtTab = id;
      tx += 146;
    }
    const body = { x: r.x, y: r.y + 44, w: r.w, h: r.h - 54, ox: r.ox, oy: r.oy, ow: r.ow, oh: r.oh };
    ({ overview: () => this.mgOverview(g, body),
       market: () => this.mgMarket(g, body),
       contracts: () => this.mgContracts(g, body),
       staff: () => this.mgStaff(g, body),
       stats: () => this.mgStats(g, body) })[this.mgmtTab]();
  }

  mgOverview(g, r) {
    const game = this.game, c = this.ui.wc;
    const f = game.factory;
    const card = (x, y, w, h, title) => {
      g.fillStyle = 'rgba(0,0,0,0.28)'; rr(g, x, y, w, h, 5); g.fill();
      g.strokeStyle = rgba('#fff', 0.06); g.lineWidth = 1; g.stroke();
      engraved(g, title, x + 12, y + 20, FONT.h3, P.uiTrimHi);
    };
    const cw = (r.w - 14) / 2;

    // --- power
    card(r.x, r.y, cw, 150, 'Power Grid');
    const gen = f.stats.powerGen, use = f.stats.powerUse;
    engraved(g, `${gen.toFixed(1)} kW generated`, r.x + 14, r.y + 46, FONT.body, P.uiGood);
    engraved(g, `${use.toFixed(1)} kW demanded`, r.x + 14, r.y + 66, FONT.body, use > gen ? P.uiBad : P.uiText);
    drawBar(g, r.x + 14, r.y + 76, cw - 28, 14, use <= 0 ? 1 : clamp(gen / use, 0, 1),
      gen >= use ? P.uiGood : P.uiBad, { label: use <= 0 ? 'idle' : `${Math.round(clamp(gen / use, 0, 1) * 100)}% satisfied` });
    engraved(g, `${f.networks.length} network(s)  •  ${f.ents.filter((e) => e.net < 0 && e.def.power > 0).length} unconnected machine(s)`,
      r.x + 14, r.y + 110, FONT.small, P.uiDim);
    engraved(g, 'Machines must touch a cable that reaches a generator.', r.x + 14, r.y + 128, FONT.tiny, P.uiDim);

    // --- finances
    card(r.x + cw + 14, r.y, cw, 150, 'Finances');
    const income = game.market.dayRevenue, costs = game.market.dayCosts + game.dayUpkeep;
    engraved(g, `Balance  ${money(game.money)}`, r.x + cw + 28, r.y + 46, FONT.h2, P.uiTrimHi);
    engraved(g, `Today's revenue  ${money(income)}`, r.x + cw + 28, r.y + 70, FONT.body, P.uiGood);
    engraved(g, `Today's costs  ${money(costs)}`, r.x + cw + 28, r.y + 90, FONT.body, P.uiBad);
    engraved(g, `Payroll  ${money(game.employees.payroll())}/day  •  ${game.employees.list.length} staff`,
      r.x + cw + 28, r.y + 112, FONT.small, P.uiDim);
    engraved(g, `Upkeep + power  ${money(f.operatingCost(game) * 60)}/min`, r.x + cw + 28, r.y + 130, FONT.small, P.uiDim);
    const plot = game.world.plot;
    if (c.button(r.x + cw + 14 + cw - 168, r.y + 100, 154, 34, 'Buy more land',
      { primary: true, disabled: game.money < game.expansionCost(),
        tip: `Expand the plot by 8 tiles on every side`,
        tipBody: `Costs ${money(game.expansionCost())}\nCurrent plot: ${plot.w} x ${plot.h} tiles` }))
      game.expandLand();

    // --- machine roster
    card(r.x, r.y + 162, r.w, r.h - 172, 'Installed Machinery');
    const groups = {};
    for (const e of f.ents) {
      if (e.kind === 'cable') continue;
      (groups[e.type] = groups[e.type] || []).push(e);
    }
    const keys = Object.keys(groups);
    const rowH = 40;
    const off = c.scroll('mgm', r.x + 8, r.y + 190, r.w - 16, r.h - 204, keys.length * rowH);
    g.save(); g.beginPath(); g.rect(r.x + 8, r.y + 190, r.w - 16, r.h - 204); g.clip();
    keys.forEach((k, i) => {
      const y = r.y + 192 + i * rowH - off;
      const list = groups[k], def = BUILDABLES[k];
      const broken = list.filter((e) => e.broken).length;
      const avgCond = list.reduce((s, e) => s + e.condition, 0) / list.length;
      const running = list.filter((e) => e.active).length;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent';
      g.fillRect(r.x + 8, y, r.w - 16, rowH - 2);
      const spr = machineSprite(k, 0);
      const sc = Math.min(32 / spr.w, 30 / spr.h);
      g.drawImage(spr.canvas, r.x + 16, y + 4, spr.w * sc, spr.h * sc);
      engraved(g, `${list.length}x ${def.name}`, r.x + 58, y + 22, FONT.body, P.uiText);
      engraved(g, `${running} running`, r.x + 300, y + 22, FONT.small, running ? P.uiGood : P.uiDim);
      drawBar(g, r.x + 400, y + 13, 140, 10, avgCond, avgCond > 0.5 ? P.uiGood : P.uiWarn,
        { label: Math.round(avgCond * 100) + '%' });
      if (broken) engraved(g, `${broken} BROKEN`, r.x + 556, y + 22, FONT.small, P.uiBad);
      if (this.ui.wc.button(r.x + r.w - 116, y + 6, 100, 26, 'Repair all',
        { disabled: avgCond > 0.995, font: FONT.small })) {
        for (const e of list) this.game.repairMachine(e);
      }
    });
    g.restore();
  }

  mgMarket(g, r) {
    const game = this.game, c = this.ui.wc;
    const ids = Object.keys(ITEMS).filter((id) => ITEMS[id].cat !== 'fluid');
    const rowH = 44;
    engraved(g, 'Prices drift with supply and demand. Flooding the market lowers your take.',
      r.x, r.y - 6, FONT.small, P.uiDim);
    const off = c.scroll('mkt', r.x, r.y + 6, r.w, r.h - 10, ids.length * rowH);
    g.save(); g.beginPath(); g.rect(r.x, r.y + 6, r.w, r.h - 10); g.clip();
    ids.forEach((id, i) => {
      const y = r.y + 10 + i * rowH - off;
      if (y > r.y + r.h || y + rowH < r.y) return;
      const it = ITEMS[id];
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'transparent';
      g.fillRect(r.x, y, r.w, rowH - 3);
      g.drawImage(itemChip(id, 32), r.x + 6, y + 4);
      engraved(g, it.name, r.x + 46, y + 18, FONT.body, P.uiText);
      engraved(g, `tier ${it.tier}`, r.x + 46, y + 32, FONT.tiny, P.uiDim);
      const price = game.market.sellPrice(id), trend = game.market.trend[id];
      engraved(g, '$' + price.toFixed(1), r.x + 250, y + 25, FONT.mono, P.uiText, 'right');
      // sparkline
      const h = game.market.history[id];
      if (h && h.length > 2) {
        g.strokeStyle = rgba(trend >= 0 ? P.uiGood : P.uiBad, 0.9); g.lineWidth = 1.4;
        g.beginPath();
        const lo = Math.min(...h), hi = Math.max(...h), span = Math.max(0.05, hi - lo);
        h.forEach((v, k) => {
          const px = r.x + 266 + (k / (h.length - 1)) * 110;
          const py = y + 30 - ((v - lo) / span) * 20;
          k ? g.lineTo(px, py) : g.moveTo(px, py);
        });
        g.stroke();
      }
      const have = game.player.invCount(id) + game.totalStored(id);
      engraved(g, `held ${shortNum(have)}`, r.x + 400, y + 25, FONT.small, P.uiDim);
      if (c.button(r.x + 470, y + 6, 74, 28, 'Buy 10', { font: FONT.small,
        disabled: game.money < game.market.buyPrice(id) * 10,
        tip: `$${(game.market.buyPrice(id) * 10).toFixed(0)}` })) game.buyToInventory(id, 10);
      if (c.button(r.x + 550, y + 6, 74, 28, 'Buy 100', { font: FONT.small,
        disabled: game.money < game.market.buyPrice(id) * 100 })) game.buyToInventory(id, 100);
      if (c.button(r.x + 630, y + 6, 84, 28, 'Sell all', { font: FONT.small,
        disabled: game.player.invCount(id) === 0 })) game.sellFromInventory(id, game.player.invCount(id));
    });
    g.restore();
  }

  mgContracts(g, r) {
    const game = this.game, c = this.ui.wc, ct = game.contracts;
    const half = r.w / 2 - 10;
    heading(g, 'Offers', r.x, r.y + 10, half);
    ct.offers.forEach((o, i) => {
      const y = r.y + 24 + i * 98;
      g.fillStyle = 'rgba(0,0,0,0.28)'; rr(g, r.x, y, half, 88, 5); g.fill();
      g.strokeStyle = rgba('#fff', 0.06); g.stroke();
      engraved(g, o.client, r.x + 12, y + 22, FONT.h3, P.uiTrimHi);
      g.drawImage(itemChip(o.item, 30), r.x + 12, y + 30);
      engraved(g, `${o.qty}x ${ITEMS[o.item].name}`, r.x + 50, y + 48, FONT.body, P.uiText);
      engraved(g, `Pays ${money(o.pay)}  •  ${Math.round(o.time / 60)} min limit  •  +${o.xp} XP`,
        r.x + 50, y + 66, FONT.small, P.uiDim);
      if (c.button(r.x + half - 96, y + 50, 86, 28, 'Accept', { primary: true, font: FONT.small })) ct.accept(o);
    });
    if (!ct.offers.length) engraved(g, 'No offers right now — check back shortly.', r.x + 6, r.y + 48, FONT.small, P.uiDim);

    const rx = r.x + half + 20;
    heading(g, 'Active', rx, r.y + 10, half);
    ct.active.forEach((o, i) => {
      const y = r.y + 24 + i * 98;
      g.fillStyle = 'rgba(0,0,0,0.28)'; rr(g, rx, y, half, 88, 5); g.fill();
      g.strokeStyle = rgba(P.uiTrim, 0.25); g.stroke();
      engraved(g, o.client, rx + 12, y + 22, FONT.h3, P.uiTrimHi);
      g.drawImage(itemChip(o.item, 30), rx + 12, y + 30);
      engraved(g, `${o.delivered} / ${o.qty}  ${ITEMS[o.item].name}`, rx + 50, y + 46, FONT.body, P.uiText);
      drawBar(g, rx + 50, y + 52, half - 150, 10, o.delivered / o.qty, P.uiGood);
      const urgent = o.deadline < 60;
      engraved(g, `${timeStr(Math.max(0, o.deadline))} left  •  ${money(o.pay)}`,
        rx + 50, y + 78, FONT.small, urgent ? P.uiBad : P.uiDim);
      const canDeliver = game.player.invCount(o.item) > 0;
      if (c.button(rx + half - 96, y + 50, 86, 28, 'Deliver', { font: FONT.small, disabled: !canDeliver,
        tip: 'Hand over from your inventory' })) {
        const n = Math.min(game.player.invCount(o.item), o.qty - o.delivered);
        game.player.take(o.item, n); ct.deliver(o, n);
      }
    });
    if (!ct.active.length) engraved(g, 'Accept an offer to start a contract.', rx + 6, r.y + 48, FONT.small, P.uiDim);
    engraved(g, 'Anything sitting in a Loading Dock is delivered against active contracts automatically.',
      r.x, r.oy + r.oh - 24, FONT.small, P.uiDim);
  }

  mgStaff(g, r) {
    const game = this.game, c = this.ui.wc, emp = game.employees;
    const half = r.w / 2 - 10;
    heading(g, `Roster (${emp.list.length})`, r.x, r.y + 10, half);
    const rowH = 70;
    const off = c.scroll('staff', r.x, r.y + 20, half, r.h - 30, emp.list.length * rowH);
    g.save(); g.beginPath(); g.rect(r.x, r.y + 20, half, r.h - 30); g.clip();
    emp.list.forEach((e, i) => {
      const y = r.y + 24 + i * rowH - off;
      g.fillStyle = 'rgba(0,0,0,0.25)'; rr(g, r.x, y, half, rowH - 6, 4); g.fill();
      g.drawImage(this.portraitFor(e.role, e.seed), r.x + 6, y + 6, 52, 52);
      engraved(g, e.name, r.x + 66, y + 22, FONT.h3, P.uiText);
      engraved(g, `${ROLE_INFO[e.role].name}  •  skill ${e.skill}  •  $${Math.round(e.wage)}/day`,
        r.x + 66, y + 38, FONT.small, P.uiDim);
      engraved(g, e.state === 'work' ? 'working' : e.state === 'rest' ? 'on break' : 'moving',
        r.x + 66, y + 54, FONT.tiny, e.state === 'work' ? P.uiGood : P.uiWarn);
      drawBar(g, r.x + 150, y + 46, 100, 8, e.stamina, P.glowCold);
      drawBar(g, r.x + 150, y + 57, 100, 8, e.morale, P.uiTrimHi);
      if (c.button(r.x + half - 78, y + 18, 68, 26, 'Dismiss', { danger: true, font: FONT.small })) emp.fire(e);
    });
    g.restore();
    if (!emp.list.length) engraved(g, 'Nobody on the books yet.', r.x + 6, r.y + 48, FONT.small, P.uiDim);

    const rx = r.x + half + 20;
    heading(g, 'Applicants', rx, r.y + 10, half);
    emp.applicants.forEach((a, i) => {
      const y = r.y + 24 + i * 78;
      g.fillStyle = 'rgba(0,0,0,0.25)'; rr(g, rx, y, half, 72, 4); g.fill();
      g.drawImage(this.portraitFor(a.role, a.seed), rx + 6, y + 8, 52, 52);
      engraved(g, a.name, rx + 66, y + 22, FONT.h3, P.uiText);
      engraved(g, `${a.info.name}  •  skill ${a.skill}`, rx + 66, y + 38, FONT.small, P.uiTrimHi);
      engraved(g, `$${a.wage}/day wage  •  $${a.cost} signing fee`, rx + 66, y + 54, FONT.tiny, P.uiDim);
      if (c.button(rx + half - 84, y + 20, 74, 30, 'Hire', { primary: true,
        disabled: game.money < a.cost, tip: a.info.desc })) emp.hire(a);
    });
  }

  mgStats(g, r) {
    const game = this.game, f = game.factory;
    const s = game.stats;
    const rows = [
      ['Days in business', game.time.day],
      ['Total revenue', money(s.revenue)],
      ['Total spent', money(s.spent)],
      ['Items produced', shortNum(f.stats.produced)],
      ['Items shipped', shortNum(f.stats.sold)],
      ['Machines placed', shortNum(s.built)],
      ['Contracts completed', game.contracts.completed],
      ['Technologies unlocked', `${game.research.unlocked.size} / ${Object.keys(TECHS).length}`],
      ['Research points earned', shortNum(game.research.totalPoints)],
      ['Employees hired', game.employees.list.length],
      ['Ore mined by hand', shortNum(s.handMined)],
      ['Machines repaired', shortNum(s.repairs)],
      ['Distance walked', `${shortNum(s.walked)} m`],
      ['Factory footprint', `${f.ents.length} entities`],
    ];
    rows.forEach(([k, v], i) => {
      const y = r.y + 30 + i * 30;
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.025)' : 'transparent';
      g.fillRect(r.x, y - 18, r.w, 26);
      engraved(g, k, r.x + 12, y, FONT.body, P.uiDim);
      engraved(g, String(v), r.x + r.w - 12, y, FONT.mono, P.uiTrimHi, 'right');
    });
  }

  // ============================================================ RESEARCH
  research(g) {
    const c = this.ui.wc, game = this.game, R = game.research;
    const r = this.window(g, 'Technology', 1010, 560, 'flask');
    // current research
    g.fillStyle = 'rgba(0,0,0,0.3)'; rr(g, r.x, r.y, r.w, 54, 5); g.fill();
    if (R.current) {
      const t = TECHS[R.current];
      engraved(g, `Researching: ${t.name}`, r.x + 14, r.y + 24, FONT.h3, P.uiTrimHi);
      drawBar(g, r.x + 14, r.y + 32, r.w - 28, 12, R.progress(), P.glowCold,
        { label: `${Math.floor(R.points)} / ${t.cost} points` });
    } else {
      engraved(g, 'No active research — pick a technology below.', r.x + 14, r.y + 24, FONT.h3, P.uiDim);
      engraved(g, `${Math.floor(R.points)} points banked  •  labs generate points continuously`,
        r.x + 14, r.y + 44, FONT.small, P.uiDim);
    }

    // tree
    const gx = r.x, gy = r.y + 66, gw = r.w, gh = r.h - 76;
    const colW = 130, rowH = 88;
    g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip();
    const pos = (t) => ({ x: gx + 6 + t.col * colW, y: gy + 10 + t.row * rowH * 0.62 });

    // links first
    g.lineWidth = 2;
    for (const t of Object.values(TECHS)) {
      const p2 = pos(t);
      for (const req of t.req) {
        const p1 = pos(TECHS[req]);
        const done = R.unlocked.has(req);
        g.strokeStyle = done ? rgba(P.uiTrim, 0.75) : rgba('#ffffff', 0.12);
        g.beginPath();
        g.moveTo(p1.x + 112, p1.y + 26);
        g.bezierCurveTo(p1.x + 124, p1.y + 26, p2.x - 14, p2.y + 26, p2.x, p2.y + 26);
        g.stroke();
      }
    }
    for (const t of Object.values(TECHS)) {
      const p = pos(t);
      const done = R.unlocked.has(t.id);
      const can = R.canStart(t.id);
      const cur = R.current === t.id;
      const s = c.slot(p.x, p.y, 112, 52, { selected: cur,
        tip: t.name, tipBody: `${t.desc}\n\n${t.cost} research points` });
      if (done) {
        g.fillStyle = rgba(P.uiGood, 0.16); rr(g, p.x + 1, p.y + 1, 110, 50, 3); g.fill();
      } else if (!can) {
        g.fillStyle = rgba('#000', 0.35); rr(g, p.x + 1, p.y + 1, 110, 50, 3); g.fill();
      }
      g.drawImage(glyph('flask', 16, done ? P.uiGood : can ? P.uiTrimHi : P.uiDim), p.x + 8, p.y + 8);
      engraved(g, t.name, p.x + 30, p.y + 20, FONT.small, done ? P.uiGood : can ? P.uiText : P.uiDim);
      engraved(g, done ? 'unlocked' : `${t.cost} pts`, p.x + 30, p.y + 36, FONT.tiny, P.uiDim);
      if (s.clicked && can) { R.start(t.id); }
    }
    g.restore();
  }

  // ============================================================ MAP
  map(g) {
    const c = this.ui.wc, game = this.game;
    const r = this.window(g, 'Regional Map', 760, 700, 'map');
    const size = Math.min(r.w, r.h - 20);
    const mx = r.x + (r.w - size) / 2, my = r.y + 10;
    if (!this.ui.hud.minimap) this.ui.hud.buildMinimap();
    g.save();
    g.beginPath(); rr(g, mx, my, size, size, 4); g.clip();
    g.imageSmoothingEnabled = false;
    g.drawImage(this.ui.hud.minimap, mx, my, size, size);
    g.imageSmoothingEnabled = true;
    const w = game.world, sc = size / w.W;
    // regions
    for (const reg of w.regions) {
      g.strokeStyle = rgba(P.uiTrimHi, 0.35); g.lineWidth = 1;
      g.strokeRect(mx + reg.x * sc, my + reg.y * sc, reg.w * sc, reg.h * sc);
      engraved(g, reg.name, mx + (reg.x + reg.w / 2) * sc, my + (reg.y + reg.h / 2) * sc,
        FONT.small, rgba(P.uiText, 0.9), 'center');
    }
    // factory
    g.fillStyle = rgba(P.uiTrimHi, 0.9);
    for (const e of game.factory.ents) {
      if (e.kind === 'cable') continue;
      g.fillRect(mx + e.x * sc, my + e.y * sc, Math.max(2, e.w * sc), Math.max(2, e.h * sc));
    }
    const px = mx + game.player.x * sc, py = my + game.player.y * sc;
    glow(g, px, py, 12, P.glowCold, 0.8);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 3.4, 0, TAU); g.fill();
    g.restore();
    g.strokeStyle = rgba('#000', 0.8); rr(g, mx, my, size, size, 4); g.stroke();
    engraved(g, 'Your plot is outlined in brass. Ore deposits show as gold speckles.',
      r.x, r.oy + r.oh - 22, FONT.small, P.uiDim);
  }

  // ============================================================ MISSIONS
  missions(g) {
    const c = this.ui.wc, game = this.game, ms = game.missions;
    const r = this.window(g, 'Missions', 780, 560, 'mission');
    const list = [...ms.active, ...MISSIONS.filter((m) => ms.done.has(m.id))];
    const rowH = 86;
    const off = c.scroll('miss', r.x, r.y, r.w, r.h, list.length * rowH);
    g.save(); g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    list.forEach((m, i) => {
      const y = r.y + 6 + i * rowH - off;
      if (y > r.y + r.h || y + rowH < r.y) return;
      const done = ms.done.has(m.id);
      const tracked = ms.tracked === m.id;
      g.fillStyle = done ? 'rgba(90,140,90,0.10)' : tracked ? 'rgba(200,160,70,0.10)' : 'rgba(0,0,0,0.25)';
      rr(g, r.x, y, r.w, rowH - 8, 5); g.fill();
      g.strokeStyle = tracked ? rgba(P.uiTrim, 0.6) : rgba('#fff', 0.05); g.lineWidth = 1.2; g.stroke();
      engraved(g, m.name, r.x + 14, y + 22, FONT.h3, done ? P.uiGood : P.uiTrimHi);
      wrapText(g, m.text, r.x + 14, y + 40, r.w - 220, 14, FONT.small, P.uiDim);
      // goals
      m.goals.forEach((goal, gi) => {
        const gy2 = y + 20 + gi * 15;
        const gdone = ms.goalDone(m, gi);
        engraved(g, (gdone ? '✔ ' : '• ') + this.ui.hud.goalText(goal, ms.goalProgress(m, gi), ms.goalTarget(goal)),
          r.x + r.w - 200, gy2, FONT.small, gdone ? P.uiGood : P.uiText);
      });
      const rw = m.reward || {};
      engraved(g, `Reward: ${rw.money ? money(rw.money) : ''} ${rw.xp ? `+${rw.xp} XP` : ''}`,
        r.x + 14, y + rowH - 18, FONT.tiny, P.uiTrimHi);
      if (!done && c.button(r.x + r.w - 96, y + rowH - 34, 84, 24, tracked ? 'Tracking' : 'Track',
        { font: FONT.small, primary: tracked })) ms.tracked = m.id;
    });
    g.restore();
  }

  // ============================================================ SKILLS
  skills(g) {
    const c = this.ui.wc, game = this.game, p = game.player;
    const r = this.window(g, 'Skills & Progression', 720, 540, 'xp');
    engraved(g, `Level ${p.level}`, r.x, r.y + 20, FONT.h1, P.uiTrimHi);
    drawBar(g, r.x + 110, r.y + 6, r.w - 260, 16, p.xp / p.xpNext, P.uiTrimHi,
      { label: `${Math.floor(p.xp)} / ${p.xpNext} XP` });
    engraved(g, `${p.skillPoints} point(s) to spend`, r.x + r.w, r.y + 20, FONT.h3,
      p.skillPoints ? P.uiGood : P.uiDim, 'right');

    const info = {
      engineering: ['Engineering', 'Machines draw less power and repairs go faster.',
        (l) => [`${(l * 2).toFixed(0)}% less power draw`, `${(l * 8).toFixed(0)}% faster repairs`]],
      production: ['Production', 'The whole floor runs faster and wastes less material.',
        (l) => [`${(l * 3.5).toFixed(0)}% machine speed`, `${(l * 0.6).toFixed(1)}% less waste`]],
      logistics: ['Logistics', 'Belts move quicker and you carry more.',
        (l) => [`${(l * 4).toFixed(0)}% belt speed`, `${l * 2} extra slots`]],
      management: ['Management', 'Better prices from buyers, cheaper and happier staff.',
        (l) => [`${(l * 1.8).toFixed(1)}% sale price`, 'Staff work harder']],
      technology: ['Technology', 'Research accumulates faster.',
        (l) => [`${(l * 6).toFixed(0)}% research rate`]],
    };
    let y = r.y + 50;
    for (const [id, [name, desc, effects]] of Object.entries(info)) {
      const s = p.skills[id];
      g.fillStyle = 'rgba(0,0,0,0.26)'; rr(g, r.x, y, r.w, 84, 5); g.fill();
      g.strokeStyle = rgba('#fff', 0.05); g.stroke();
      // level dial
      g.save(); g.translate(r.x + 40, y + 42);
      g.strokeStyle = rgba('#000', 0.6); g.lineWidth = 6;
      g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.stroke();
      g.strokeStyle = P.uiTrimHi; g.lineWidth = 5;
      g.beginPath(); g.arc(0, 0, 22, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.xp / s.next, 0, 1)); g.stroke();
      engraved(g, String(s.level), 0, 7, FONT.h1, P.uiText, 'center');
      g.restore();
      engraved(g, name, r.x + 76, y + 24, FONT.h2, P.uiTrimHi);
      wrapText(g, desc, r.x + 76, y + 44, r.w - 420, 14, FONT.small, P.uiDim);
      effects(s.level).forEach((e, i) =>
        engraved(g, '+ ' + e, r.x + r.w - 300, y + 30 + i * 18, FONT.small, P.uiGood));
      if (c.button(r.x + r.w - 96, y + 26, 84, 32, 'Train', { primary: p.skillPoints > 0,
        disabled: p.skillPoints <= 0, tip: 'Spend a skill point' })) p.spendSkillPoint(id);
      y += 92;
    }
  }

  // ============================================================ DIALOGUE
  dialogue(g) {
    const c = this.ui.wc, d = this.ui.dialog;
    if (!d) return;
    const W = this.ui.w, H = this.ui.h;
    const w = 620, h = 172, x = W / 2 - w / 2, y = H - h - 40;
    drawPanel(g, x, y, w, h);
    g.drawImage(this.portraitFor(d.role, d.seed), x + 16, y + 20, 72, 72);
    engraved(g, d.name, x + 100, y + 34, FONT.h2, P.uiTrimHi);
    if (d.title) engraved(g, d.title, x + 100, y + 50, FONT.small, P.uiDim);
    wrapText(g, d.text, x + 100, y + 74, w - 130, 18, FONT.body, P.uiText);
    if (c.button(x + w - 120, y + h - 44, 100, 30, 'Goodbye')) this.ui.dialog = null;
    if (d.options) {
      d.options.forEach((o, i) => {
        if (c.button(x + 100 + i * 150, y + h - 44, 140, 30, o.label, { primary: true })) { o.act(); }
      });
    }
  }

  // ============================================================ SETTINGS / HELP
  settings(g) {
    const c = this.ui.wc, game = this.game;
    const r = this.window(g, 'Options & Controls', 700, 560, 'gearIcon');
    heading(g, 'Controls', r.x, r.y + 16, r.w / 2 - 20);
    const keys = [
      ['WASD / Arrows', 'Move'], ['Shift', 'Sprint'], ['Mouse', 'Use tool / place'],
      ['E', 'Interact, repair, talk'], ['B', 'Build menu'], ['R', 'Rotate while building'],
      ['X', 'Demolish mode'], ['1–8', 'Hotbar'], ['I', 'Inventory'], ['Tab', 'Factory management'],
      ['T', 'Technology'], ['J', 'Missions'], ['K', 'Skills'], ['M', 'Map'],
      ['F5 / F9', 'Save / load'], ['Esc', 'Close window'],
    ];
    keys.forEach(([k, v], i) => {
      const y = r.y + 42 + i * 24;
      engraved(g, k, r.x + 8, y, FONT.mono, P.uiTrimHi);
      engraved(g, v, r.x + 130, y, FONT.small, P.uiText);
    });

    const rx = r.x + r.w / 2 + 10;
    heading(g, 'Audio', rx, r.y + 16, r.w / 2 - 20);
    const vols = [['master', 'Master'], ['music', 'Music'], ['sfx', 'Effects'], ['amb', 'Ambience']];
    vols.forEach(([id, name], i) => {
      const y = r.y + 40 + i * 40;
      engraved(g, name, rx, y + 12, FONT.small, P.uiText);
      const bx = rx + 80, bw = 180;
      drawBar(g, bx, y, bw, 14, game.audio.volume[id], P.uiTrimHi);
      if (c.consumeClick(bx, y - 4, bw, 22) || (c.hover(bx, y - 4, bw, 22) && this.ui.game.input.mouse.down)) {
        const v = clamp((this.ui.game.input.mouse.x - bx) / bw, 0, 1);
        game.audio.setVolume(id, v);
      }
    });

    let y = r.y + 220;
    heading(g, 'Game', rx, y, r.w / 2 - 20); y += 20;
    if (c.button(rx, y, 180, 34, 'Save game', { primary: true })) game.save();
    if (c.button(rx, y + 42, 180, 34, 'Load last save')) game.load();
    if (c.button(rx, y + 84, 180, 34, 'Restart (wipe save)', { danger: true })) game.restart();

    y = r.y + 380;
    heading(g, 'How the factory works', r.x, y, r.w); y += 18;
    wrapText(g,
      'Generators make power. Cables carry it: every machine must touch a cable that leads back to a generator. ' +
      'Mining drills sit on ore patches and fill their output buffer. Conveyor belts pull from a machine behind them ' +
      'and push into whatever is in front — chain them to feed furnaces, presses and assemblers. Finished goods ' +
      'dropped on a Loading Dock are sold automatically, and count toward contracts.',
      r.x, y, r.w, 17, FONT.body, P.uiText);
  }

  // ============================================================ MISSION TOAST
  missionComplete(g) {
    const m = this.ui.missionToast;
    if (!m) return;
    const W = this.ui.w;
    const a = clamp(m.t < 0.4 ? m.t / 0.4 : m.life > 0.6 ? 1 : m.life / 0.6, 0, 1);
    const w = 420, h = 96, x = W / 2 - w / 2, y = 96 - (1 - a) * 20;
    g.save(); g.globalAlpha = a;
    drawPanel(g, x, y, w, h);
    g.drawImage(glyph('mission', 26, P.uiGood), x + 20, y + 34);
    engraved(g, 'MISSION COMPLETE', x + 62, y + 36, FONT.h3, P.uiGood);
    engraved(g, m.mission.name, x + 62, y + 58, FONT.h2, P.uiTrimHi);
    const rw = m.mission.reward || {};
    engraved(g, `${rw.money ? money(rw.money) + '  ' : ''}${rw.xp ? '+' + rw.xp + ' XP' : ''}`,
      x + 62, y + 78, FONT.small, P.uiText);
    g.restore();
  }
}
