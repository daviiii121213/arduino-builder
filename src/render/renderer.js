// World renderer: cached terrain chunks, depth-sorted actors, animated machinery,
// dynamic day/night lighting and build previews.

import { TILE, T } from '../world/world.js';
import { buildTileset, buildOreOverlays, TILE_AVG } from '../art/tiles.js';
import { propSprite } from '../art/props.js';
import { machineSprite, HEAD } from '../art/machines.js';
import { itemChip, itemIcon } from '../art/icons.js';
import { P, rgba, shade, mix } from '../art/palette.js';
import { makeCanvas, rr, glow, plate, hazard, engraved, vgrad } from '../art/draw.js';
import { TAU, clamp, DIRS } from '../core/utils.js';
import { BUILDABLES } from '../data/buildables.js';
import { RECIPES } from '../data/recipes.js';

const CHUNK = 8;                 // tiles per chunk side

export class Renderer {
  constructor(game) {
    this.game = game;
    this.tileset = buildTileset();
    this.ore = buildOreOverlays();
    this.chunks = new Map();
    this.lightCanvas = null;
    this.lightCtx = null;
  }

  invalidateChunkAt(tx, ty) {
    const k = Math.floor(tx / CHUNK) + ',' + Math.floor(ty / CHUNK);
    this.chunks.delete(k);
  }

  chunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) return c;
    const size = CHUNK * TILE;
    const { c: canvas, g } = makeCanvas(size, size);
    const w = this.game.world;
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const wx = cx * CHUNK + tx, wy = cy * CHUNK + ty;
        const t = w.tile(wx, wy);
        const set = this.tileset[t] || this.tileset[T.GRASS];
        const v = w.inBounds(wx, wy) ? w.variant[w.idx(wx, wy)] % set.length : 0;
        g.drawImage(set[v], tx * TILE, ty * TILE);

        // soft edge blending with differing neighbours so biomes don't hard-cut
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const nt = w.tile(wx + dx, wy + dy);
          if (nt === t) continue;
          const col = TILE_AVG[nt];
          if (!col) continue;
          const gx = tx * TILE, gy = ty * TILE;
          const grd = dx !== 0
            ? g.createLinearGradient(gx + (dx > 0 ? TILE : 0), 0, gx + (dx > 0 ? TILE - 10 : 10), 0)
            : g.createLinearGradient(0, gy + (dy > 0 ? TILE : 0), 0, gy + (dy > 0 ? TILE - 10 : 10));
          grd.addColorStop(0, rgba(col, 0.62));
          grd.addColorStop(1, rgba(col, 0));
          g.fillStyle = grd; g.fillRect(gx, gy, TILE, TILE);
        }

        const node = w.nodeAt(wx, wy);
        if (node) {
          const ov = this.ore[node.type];
          if (ov) {
            g.globalAlpha = clamp(0.35 + (node.amount / Math.max(1, node.max)) * 0.65, 0.25, 1);
            g.drawImage(ov[(wx * 7 + wy * 13) % ov.length], tx * TILE, ty * TILE);
            g.globalAlpha = 1;
          }
        }

        // player-laid concrete floor
        if (this.game.floors.has(wx + ',' + wy)) {
          const spr = machineSprite('floor', 0);
          g.drawImage(spr.canvas, 0, spr.head, TILE, TILE, tx * TILE, ty * TILE, TILE, TILE);
        }
      }
    }
    c = canvas;
    this.chunks.set(key, c);
    if (this.chunks.size > 900) {   // bound memory on very large tours of the map
      const first = this.chunks.keys().next().value;
      this.chunks.delete(first);
    }
    return c;
  }

  // -------------------------------------------------------------- main draw
  draw(g, cam, dt) {
    const game = this.game;
    const v = cam.view;
    g.save();
    cam.apply(g);

    // ---- terrain
    const c0 = Math.floor(v.x0 / (CHUNK * TILE)), c1 = Math.floor(v.x1 / (CHUNK * TILE));
    const r0 = Math.floor(v.y0 / (CHUNK * TILE)), r1 = Math.floor(v.y1 / (CHUNK * TILE));
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cy < 0 || cx * CHUNK >= game.world.W || cy * CHUNK >= game.world.H) continue;
        g.drawImage(this.chunk(cx, cy), cx * CHUNK * TILE, cy * CHUNK * TILE);
      }
    }

    // ---- plot boundary
    this.drawPlotEdge(g, game);

    // ---- flat entities (floors handled in chunks; belts, cables and pipes lie flat)
    const flat = [], tall = [];
    for (const e of game.factory.ents) {
      if (e.x * TILE > v.x1 + 200 || (e.x + e.w) * TILE < v.x0 - 200 ||
          e.y * TILE > v.y1 + 240 || (e.y + e.h) * TILE < v.y0 - 240) continue;
      (e.kind === 'belt' || e.kind === 'cable' || e.kind === 'pipe' ? flat : tall).push(e);
    }
    for (const e of flat) this.drawEntity(g, e, dt);

    // ---- depth-sorted layer: props, machines, people
    const actors = [];
    for (const p of game.world.props) {
      if (p.hidden) continue;
      if (p.x * TILE < v.x0 - 260 || p.x * TILE > v.x1 + 260 || p.y * TILE < v.y0 - 320 || p.y * TILE > v.y1 + 260) continue;
      actors.push({ y: p.y, kind: 'prop', p });
    }
    for (const e of tall) actors.push({ y: e.y + e.h, kind: 'ent', e });
    for (const n of game.npcs) {
      if (n.x * TILE < v.x0 - 120 || n.x * TILE > v.x1 + 120 || n.y * TILE < v.y0 - 160 || n.y * TILE > v.y1 + 120) continue;
      actors.push({ y: n.y, kind: 'npc', n });
    }
    for (const e of game.employees.list) actors.push({ y: e.y, kind: 'npc', n: e });
    actors.push({ y: game.player.y, kind: 'player' });
    actors.sort((a, b) => a.y - b.y);

    for (const a of actors) {
      if (a.kind === 'prop') this.drawProp(g, a.p);
      else if (a.kind === 'ent') this.drawEntity(g, a.e, dt);
      else if (a.kind === 'npc') a.n.draw(g, a.n.x * TILE, a.n.y * TILE);
      else game.player.draw(g, game.player.x * TILE, game.player.y * TILE);
    }

    // ---- particles
    game.fx.draw(g, cam);

    // ---- build preview / selection
    this.drawBuildPreview(g, game);
    this.drawSelection(g, game);

    g.restore();

    // ---- lighting pass (screen space)
    this.drawLighting(g, cam, game);
    cam.applyScreen(g);
    game.fx.drawTexts(g, cam);
    this.drawWorldLabels(g, cam, game);
  }

  drawPlotEdge(g, game) {
    const p = game.world.plot;
    g.save();
    g.strokeStyle = rgba(P.uiTrim, 0.55);
    g.lineWidth = 2.5;
    g.setLineDash([14, 9]);
    g.strokeRect(p.x * TILE, p.y * TILE, p.w * TILE, p.h * TILE);
    g.setLineDash([]);
    // corner posts
    for (const [cx, cy] of [[p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]]) {
      g.fillStyle = P.steelDark;
      g.fillRect(cx * TILE - 3, cy * TILE - 14, 6, 16);
      g.fillStyle = P.paintYellow;
      g.fillRect(cx * TILE - 3, cy * TILE - 14, 6, 4);
    }
    g.restore();
  }

  drawProp(g, p) {
    const spr = propSprite(p.type, p.seed);
    if (!spr) return;
    g.drawImage(spr.canvas, p.x * TILE - spr.ox, p.y * TILE - spr.oy);
    if (p.label && this.game.cam.zoom > 0.9) {
      g.font = 'bold 10px "Segoe UI", sans-serif'; g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,0.6)';
      const w = g.measureText(p.label).width + 10;
      rr(g, p.x * TILE - w / 2, p.y * TILE - spr.oy - 14, w, 14, 3); g.fill();
      g.fillStyle = rgba(P.uiTrimHi, 0.95);
      g.fillText(p.label, p.x * TILE, p.y * TILE - spr.oy - 4);
    }
  }

  // -------------------------------------------------------------- entities
  drawEntity(g, e, dt) {
    const spr = machineSprite(e.type, e.dir);
    if (!spr) return;
    const px = e.x * TILE, py = e.y * TILE - spr.head;

    // belts rotate their whole sprite so chevrons point the right way
    if (e.kind === 'belt' && (e.dir === 2 || e.dir === 3)) {
      g.save();
      g.translate(px + spr.w / 2, py + spr.head + (e.h * TILE) / 2);
      g.rotate(Math.PI);
      g.drawImage(spr.canvas, -spr.w / 2, -(spr.head + (e.h * TILE) / 2));
      g.restore();
    } else {
      g.drawImage(spr.canvas, px, py);
    }

    if (e.broken) {
      // damaged overlay: scorch and a warning flash
      g.save();
      g.globalAlpha = 0.5;
      g.fillStyle = '#14100c';
      g.fillRect(px, py + spr.head, e.w * TILE, e.h * TILE);
      g.restore();
      if (Math.sin(e.anim * 7) > 0) {
        glow(g, e.cx * TILE, e.cy * TILE, 26, P.uiBad, 0.4);
      }
    }

    this.animate(g, e, px, py, dt);
    this.drawEntityStatus(g, e, px, py, spr);
  }

  /** Moving parts, glows and product visuals, drawn on top of the cached body. */
  animate(g, e, px, py, dt = 0.016) {
    const t = e.anim;
    const emit = (rate) => Math.random() < dt * rate;   // frame-rate independent emission
    const cx = e.cx * TILE, cy = e.cy * TILE;
    const w = e.w * TILE, h = e.h * TILE;
    const top = py + HEAD;
    const run = e.active && !e.broken;

    switch (e.type) {
      case 'belt': case 'belt_fast': {
        // tread motion
        if (run || e.items.length) {
          const d = DIRS[e.dir];
          const off = (t * (e.def.speed || 1.6) * 9) % 8;
          g.save();
          g.beginPath(); g.rect(px + 2, top + 2, w - 4, h - 4); g.clip();
          g.fillStyle = rgba('#ffffff', 0.10);
          for (let i = -8; i < Math.max(w, h) + 8; i += 8) {
            const o = i + off;
            if (d.x !== 0) g.fillRect(px + (d.x > 0 ? o : w - o), top + 3, 2.4, h - 6);
            else g.fillRect(px + 3, top + (d.y > 0 ? o : h - o), w - 6, 2.4);
          }
          g.restore();
        }
        // items riding the belt
        const d = DIRS[e.dir];
        for (const it of e.items) {
          const ix = px + w / 2 + d.x * (it.p - 0.5) * w;
          const iy = top + h / 2 + d.y * (it.p - 0.5) * h;
          g.drawImage(itemChip(it.id, 18), ix - 9, iy - 9);
        }
        break;
      }
      case 'miner': case 'miner_adv': {
        const dcx = px + w * 0.62, dcy = top + h * 0.58;
        g.save(); g.translate(dcx, dcy); g.rotate(run ? t * 9 : 0);
        g.fillStyle = P.steelHi;
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          const a = (i / 3) * TAU;
          g.moveTo(0, 0);
          g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
          g.lineTo(Math.cos(a + 0.5) * 7, Math.sin(a + 0.5) * 7);
          g.closePath(); g.fill();
        }
        g.fillStyle = P.steelDark; g.beginPath(); g.arc(0, 0, 2.4, 0, TAU); g.fill();
        g.restore();
        if (run && emit(6)) this.game.fx.dust(e.cx, e.cy + 0.3, 1);
        break;
      }
      case 'furnace': {
        const dw = w * 0.36, dx = px + w / 2 - dw / 2, dy = top + h * 0.42;
        const heat = clamp((e.temp - 90) / 620, 0, 1);
        if (heat > 0.02) {
          const f = 0.75 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23) * 0.06;
          g.save();
          g.globalCompositeOperation = 'lighter';
          glow(g, dx + dw / 2, dy + h * 0.14, 26 * heat * f, P.glowHot, 0.55 * heat);
          g.fillStyle = rgba(mix(P.glowHot, P.glowWarm, f * 0.5), 0.75 * heat);
          rr(g, dx + 2, dy + 2, dw - 4, h * 0.3 - 4, 2); g.fill();
          g.restore();
        }
        if (run && emit(7)) this.game.fx.smoke(e.x + e.w - 0.45, e.y - 0.55, 1);
        if (run && emit(9)) this.game.fx.fire(e.cx, e.cy + 0.15, 1);
        break;
      }
      case 'press': {
        const prog = e.progress;
        const drop = run ? Math.abs(Math.sin(prog * Math.PI * 3)) : 0;
        const ry = top + h * 0.4 + drop * h * 0.2;
        g.fillStyle = rgba('#000', 0.35);
        g.fillRect(px + w * 0.3, ry + 2, w * 0.4, h * 0.14);
        plate(g, px + w * 0.3, ry, w * 0.4, h * 0.14, P.steelHi, { r: 2 });
        if (run && drop > 0.93 && emit(8)) this.game.fx.sparks(e.cx, e.cy + 0.1, 3);
        break;
      }
      case 'cutter': {
        const bx = px + w * 0.5, by = top + h * 0.42;
        g.save(); g.translate(bx, by); g.rotate(run ? t * 22 : 0);
        g.strokeStyle = P.steelHi; g.lineWidth = 1.4;
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU;
          g.beginPath(); g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
          g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); g.stroke();
        }
        g.restore();
        if (run && emit(6)) this.game.fx.sparks(e.cx, e.cy + 0.05, 2);
        break;
      }
      case 'assembler': {
        for (const s of [-1, 1]) {
          const ax = px + w * (s < 0 ? 0.28 : 0.72), ay = top + h * 0.3;
          const a = Math.sin(t * (run ? 4 : 0.6) + (s > 0 ? 1.6 : 0)) * 0.8;
          g.save(); g.translate(ax, ay); g.rotate(a * s);
          g.strokeStyle = P.paintOrange; g.lineWidth = 4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 13); g.stroke();
          g.strokeStyle = P.steelHi; g.lineWidth = 2.4;
          g.beginPath(); g.moveTo(0, 13); g.lineTo(s * 5, 19); g.stroke();
          g.lineCap = 'butt'; g.restore();
        }
        if (run && emit(3)) this.game.fx.sparks(e.cx, e.cy, 2);
        break;
      }
      case 'chemical': {
        for (let i = 0; i < 3; i++) {
          const vx = px + w * (0.22 + i * 0.28), vy = top + h * 0.42;
          const lvl = run ? 0.5 + Math.sin(t * 3 + i) * 0.2 : 0.35;
          g.save();
          g.globalAlpha = 0.75;
          g.fillStyle = '#7fd08a';
          const rH = Math.min(w, h) * 0.13 * 1.4;
          g.fillRect(vx - 2.5, vy + rH / 2 - rH * lvl, 5, rH * lvl);
          g.restore();
          if (run && emit(1.2)) this.game.fx.steam(e.x + 0.3 + i * 0.8, e.y + 0.3, 1);
        }
        break;
      }
      case 'packager': {
        if (run) {
          const p = (t * 0.5) % 1;
          g.drawImage(itemChip('tool_kit', 16), px + 6 + p * (w - 30), top + h * 0.6);
        }
        break;
      }
      case 'recycler': {
        if (run) {
          g.save();
          g.translate(Math.sin(t * 30) * 0.7, 0);
          g.globalAlpha = 0.25; g.fillStyle = '#000';
          g.fillRect(px + w * 0.34, top + h * 0.4, w * 0.32, 3);
          g.restore();
          if (emit(4)) this.game.fx.dust(e.cx, e.cy, 1);
        }
        break;
      }
      case 'robotics': {
        for (const [ax, ay, ph] of [[0.26, 0.3, 0], [0.74, 0.3, 2], [0.5, 0.7, 4]]) {
          const jx = px + w * ax, jy = top + h * ay;
          const a = Math.sin(t * (run ? 3.4 : 0.5) + ph) * 1.1;
          g.save(); g.translate(jx, jy); g.rotate(a);
          g.strokeStyle = P.paintOrange; g.lineWidth = 4.4; g.lineCap = 'round';
          g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 14); g.stroke();
          g.strokeStyle = P.steelHi; g.lineWidth = 2.6;
          g.beginPath(); g.moveTo(0, 14); g.lineTo(6, 20); g.stroke();
          g.lineCap = 'butt'; g.restore();
        }
        if (run) glow(g, cx, cy, 30 + Math.sin(t * 4) * 6, P.glowCold, 0.16);
        break;
      }
      case 'coal_gen': {
        if (run) {
          const by = top + h * 0.42;
          glow(g, px + 18, by + h * 0.22, 16, P.glowHot, 0.4 + Math.sin(t * 9) * 0.1);
          if (emit(6)) this.game.fx.smoke(e.x + e.w - 0.5, e.y - 0.5, 1);
          // flywheel
          g.save(); g.translate(px + w - 13, top + h * 0.7); g.rotate(t * 6);
          g.strokeStyle = P.copperHi; g.lineWidth = 1.6;
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); g.stroke();
          }
          g.restore();
        }
        break;
      }
      case 'turbine': {
        if (run) {
          g.save(); g.translate(px + w * 0.2, top + h * 0.44); g.rotate(t * 16);
          g.fillStyle = P.steelHi;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            g.beginPath(); g.moveTo(0, 0);
            g.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
            g.lineTo(Math.cos(a + 0.4) * 8, Math.sin(a + 0.4) * 8);
            g.closePath(); g.fill();
          }
          g.restore();
          if (emit(6)) this.game.fx.steam(e.cx + 0.6, e.y - 0.3, 1);
        }
        break;
      }
      case 'fusion': {
        const pulse = 0.6 + Math.sin(t * 2.2) * 0.25;
        g.save(); g.globalCompositeOperation = 'lighter';
        glow(g, cx, top + h * 0.46, Math.min(w, h) * 0.34 * pulse, P.glowCold, 0.55);
        g.restore();
        if (emit(3)) this.game.fx.arc(e.cx + (Math.random() - 0.5), e.cy + (Math.random() - 0.5) * 0.6);
        break;
      }
      case 'solar': {
        const dl = this.game.time.daylight;
        if (dl > 0.1) {
          g.save(); g.globalAlpha = 0.12 * dl;
          g.fillStyle = '#ffffff';
          g.beginPath(); g.moveTo(px, top + h); g.lineTo(px + w * 0.45, top);
          g.lineTo(px + w * 0.62, top); g.lineTo(px + w * 0.14, top + h); g.closePath(); g.fill();
          g.restore();
        }
        break;
      }
      case 'lamp': {
        if (e.powered) glow(g, cx, top + h * 0.2, 22, P.glowWarm, 0.35);
        break;
      }
      case 'dock': {
        if (e.active) this.drawTruck(g, px + w * 0.5, top + h + 6, t);
        break;
      }
      case 'lab': {
        if (run) {
          glow(g, cx, top + h * 0.5, 26 + Math.sin(t * 3) * 4, P.glowCold, 0.25);
          if (emit(1.2)) this.game.fx.steam(e.cx, e.cy - 0.2, 1);
        }
        break;
      }
      case 'waterpump': {
        if (run) {
          g.save(); g.translate(px + w * 0.38, top + h * 0.45); g.rotate(t * 7);
          g.strokeStyle = rgba(P.waterHi, 0.7); g.lineWidth = 2;
          for (let i = 0; i < 3; i++) {
            const a = (i / 3) * TAU;
            g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 7, Math.sin(a) * 7); g.stroke();
          }
          g.restore();
        }
        break;
      }
      default: break;
    }

    // machines that are running but starved of power flicker a warning LED
    if (!e.powered && e.def.power > 0 && !e.broken && Math.sin(t * 5) > 0.4) {
      glow(g, px + 7, top + 7, 9, P.uiWarn, 0.5);
    }
  }

  drawTruck(g, x, y, t) {
    const p = (Math.sin(t * 0.6) * 0.5 + 0.5) * 12;
    g.save(); g.translate(x - 34 + p, y);
    // trailer
    plate(g, 0, -26, 44, 24, '#c8cdd2', { r: 2 });
    hazard(g, 0, -6, 44, 5, P.paintYellow, P.steelDark, 5);
    // cab
    plate(g, 44, -22, 18, 20, P.paintRed, { r: 3 });
    g.fillStyle = rgba(P.glass, 0.6); rr(g, 47, -19, 12, 8, 2); g.fill();
    // wheels
    g.fillStyle = '#16161a';
    for (const wx of [8, 20, 34, 52]) { g.beginPath(); g.arc(wx, 0, 4.2, 0, TAU); g.fill(); }
    g.fillStyle = '#4a4a52';
    for (const wx of [8, 20, 34, 52]) { g.beginPath(); g.arc(wx, 0, 1.6, 0, TAU); g.fill(); }
    g.restore();
  }

  /** Progress, condition and buffer readouts floating above a machine. */
  drawEntityStatus(g, e, px, py, spr) {
    const zoom = this.game.cam.zoom;
    if (zoom < 0.7) return;
    const w = e.w * TILE, top = py + spr.head;
    const showBars = e.kind === 'machine' || e.kind === 'miner' || e.kind === 'gen' || e.kind === 'lab';
    if (showBars && (e.active || e.progress > 0 || e.condition < 0.999 || e.broken)) {
      const bw = Math.min(w - 8, 48), bx = px + w / 2 - bw / 2, by = top - 9;
      if (e.progress > 0 || e.active) {
        g.fillStyle = 'rgba(6,8,11,0.7)'; rr(g, bx, by, bw, 4, 2); g.fill();
        g.fillStyle = P.uiGood;
        rr(g, bx + 0.7, by + 0.7, (bw - 1.4) * clamp(e.progress, 0, 1), 2.6, 1.3); g.fill();
      }
      if (e.condition < 0.85 || e.broken) {
        g.fillStyle = 'rgba(6,8,11,0.7)'; rr(g, bx, by - 5, bw, 4, 2); g.fill();
        g.fillStyle = e.condition < 0.3 ? P.uiBad : P.uiWarn;
        rr(g, bx + 0.7, by - 4.3, (bw - 1.4) * clamp(e.condition, 0, 1), 2.6, 1.3); g.fill();
      }
    }
    // what's waiting in the output buffer
    if (zoom > 1.05 && e.totalOut() > 0 && (e.kind === 'machine' || e.kind === 'miner' || e.kind === 'store')) {
      const ids = Object.keys(e.outBuf).slice(0, 3);
      ids.forEach((id, i) => {
        const ix = px + 4 + i * 16, iy = top + e.h * TILE - 17;
        g.globalAlpha = 0.92;
        g.drawImage(itemChip(id, 15), ix, iy);
        g.globalAlpha = 1;
        g.font = 'bold 9px "Consolas", monospace'; g.textAlign = 'left';
        g.fillStyle = 'rgba(0,0,0,0.8)'; g.fillText(String(e.outBuf[id]), ix + 12, iy + 15);
        g.fillStyle = P.uiText; g.fillText(String(e.outBuf[id]), ix + 11, iy + 14);
      });
    }
  }

  // -------------------------------------------------------------- previews
  drawBuildPreview(g, game) {
    const b = game.build;
    if (!b.active || !b.type) return;
    const def = BUILDABLES[b.type];
    const { tx, ty } = game.cursorTile;
    const chk = game.factory.canPlace(b.type, tx, ty, b.dir);
    const swap = b.dir % 2 === 1 && def.w !== def.h;
    const w = (swap ? def.h : def.w) * TILE, h = (swap ? def.w : def.h) * TILE;
    const spr = machineSprite(b.type, b.dir);

    g.save();
    g.globalAlpha = 0.62;
    if (spr) g.drawImage(spr.canvas, tx * TILE, ty * TILE - spr.head);
    g.globalAlpha = 1;
    g.strokeStyle = chk.ok ? rgba(P.uiGood, 0.95) : rgba(P.uiBad, 0.95);
    g.lineWidth = 2;
    g.strokeRect(tx * TILE + 1, ty * TILE + 1, w - 2, h - 2);
    g.fillStyle = chk.ok ? rgba(P.uiGood, 0.14) : rgba(P.uiBad, 0.2);
    g.fillRect(tx * TILE, ty * TILE, w, h);

    // direction arrow for rotatable things
    if (def.kind === 'belt' || def.kind === 'machine' || def.kind === 'dock' || def.kind === 'miner') {
      const d = DIRS[b.dir];
      const cx = tx * TILE + w / 2, cy = ty * TILE + h / 2;
      g.strokeStyle = rgba(P.uiTrimHi, 0.95); g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx - d.x * w * 0.3, cy - d.y * h * 0.3);
      g.lineTo(cx + d.x * w * 0.32, cy + d.y * h * 0.32);
      g.stroke();
      g.beginPath();
      g.moveTo(cx + d.x * w * 0.4, cy + d.y * h * 0.4);
      g.lineTo(cx + d.x * w * 0.22 - d.y * 7, cy + d.y * h * 0.22 - d.x * 7);
      g.lineTo(cx + d.x * w * 0.22 + d.y * 7, cy + d.y * h * 0.22 + d.x * 7);
      g.closePath(); g.fillStyle = rgba(P.uiTrimHi, 0.95); g.fill();
      g.lineCap = 'butt';
    }
    g.restore();
  }

  drawSelection(g, game) {
    const e = game.selected;
    if (!e || !game.factory.ents.includes(e)) return;
    const x = e.x * TILE, y = e.y * TILE, w = e.w * TILE, h = e.h * TILE;
    g.save();
    g.strokeStyle = P.uiTrimHi; g.lineWidth = 2;
    g.setLineDash([6, 4]); g.lineDashOffset = -(performance.now() / 60) % 10;
    g.strokeRect(x - 2, y - 2, w + 4, h + 4);
    g.setLineDash([]);
    g.restore();
  }

  // -------------------------------------------------------------- lighting
  drawLighting(g, cam, game) {
    const night = 1 - game.time.daylight;
    const W = Math.ceil(cam.vw), H = Math.ceil(cam.vh);
    if (!this.lightCanvas || this.lightCanvas.width !== W || this.lightCanvas.height !== H) {
      const mk = makeCanvas(W, H);
      this.lightCanvas = mk.c; this.lightCtx = mk.g;
    }
    if (night < 0.04) return;
    const lg = this.lightCtx;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.clearRect(0, 0, W, H);
    // night tint: cool blue, denser at full night
    const tint = mix('#0b1020', '#141c2e', 0.4);
    lg.fillStyle = rgba(tint, 0.74 * night);
    lg.fillRect(0, 0, W, H);

    lg.globalCompositeOperation = 'destination-out';
    const punch = (wx, wy, r, strength = 1) => {
      const s = cam.worldToScreen(wx, wy);
      const rr2 = r * cam.zoom;
      if (s.x < -rr2 || s.y < -rr2 || s.x > W + rr2 || s.y > H + rr2) return;
      const grd = lg.createRadialGradient(s.x, s.y, 0, s.x, s.y, rr2);
      grd.addColorStop(0, `rgba(0,0,0,${0.95 * strength})`);
      grd.addColorStop(0.45, `rgba(0,0,0,${0.55 * strength})`);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = grd;
      lg.beginPath(); lg.arc(s.x, s.y, rr2, 0, TAU); lg.fill();
    };

    // player torch
    punch(game.player.x * TILE, game.player.y * TILE - 8, 130, 0.85);
    for (const e of game.factory.ents) {
      if (e.kind === 'lamp' && e.powered) punch(e.cx * TILE, e.cy * TILE, 150, 1);
      else if (e.type === 'furnace' && e.temp > 200) punch(e.cx * TILE, e.cy * TILE, 110, 0.8);
      else if (e.type === 'coal_gen' && e.active) punch(e.cx * TILE, e.cy * TILE, 90, 0.6);
      else if (e.type === 'fusion') punch(e.cx * TILE, e.cy * TILE, 190, 0.95);
      else if (e.kind === 'lab' && e.active) punch(e.cx * TILE, e.cy * TILE, 100, 0.65);
      else if (e.kind === 'service' || e.kind === 'store') punch(e.cx * TILE, e.cy * TILE, 70, 0.4);
    }
    for (const p of game.world.props) {
      if (p.type === 'streetlight') punch(p.x * TILE + 13, p.y * TILE - 66, 120, 0.8);
      else if (p.type === 'mine_entrance') punch(p.x * TILE, p.y * TILE - 24, 90, 0.6);
      else if (['shop', 'apartment', 'office_bldg', 'factory_bldg', 'warehouse_bldg'].includes(p.type))
        punch(p.x * TILE, p.y * TILE - 40, 110, 0.5);
    }
    lg.globalCompositeOperation = 'source-over';

    cam.applyScreen(g);
    g.drawImage(this.lightCanvas, 0, 0);

    // warm glow blobs on top for lamp bulbs
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const e of game.factory.ents) {
      if (e.kind === 'lamp' && e.powered) {
        const s = cam.worldToScreen(e.cx * TILE, e.cy * TILE - 12);
        glow(g, s.x, s.y, 42 * cam.zoom, P.glowWarm, 0.22 * night);
      }
    }
    g.restore();
  }

  /** Region names fade in when you enter a new area. */
  drawWorldLabels(g, cam, game) {
    const r = game.currentRegion;
    if (!r || game.regionFade <= 0) return;
    const a = Math.min(1, game.regionFade);
    g.save();
    g.globalAlpha = a;
    g.textAlign = 'center';
    g.font = 'bold 34px Georgia, serif';
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillText(r.name, cam.vw / 2 + 2, 118);
    g.fillStyle = P.uiTrimHi;
    g.fillText(r.name, cam.vw / 2, 116);
    g.fillStyle = rgba(P.uiTrim, 0.6);
    g.fillRect(cam.vw / 2 - 90, 126, 180, 1.6);
    g.restore();
  }
}
