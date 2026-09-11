// Factory simulation: placement grid, power networks, machine processing, conveyor
// transport, wear and breakdowns. Designed so several hundred entities stay cheap:
// power is solved only when the layout changes, and belts move items with a single
// scalar per item.

import { BUILDABLES } from '../data/buildables.js';
import { RECIPES } from '../data/recipes.js';
import { ITEMS, itemValue } from '../data/items.js';
import { DIRS, clamp } from '../core/utils.js';
import { machineSprite } from '../art/machines.js';

let NEXT_ID = 1;

export class Entity {
  constructor(type, x, y, dir) {
    const def = BUILDABLES[type];
    this.id = NEXT_ID++;
    this.type = type; this.def = def; this.kind = def.kind;
    this.x = x; this.y = y; this.dir = dir | 0;
    const swap = dir % 2 === 1 && (def.w !== def.h);
    this.w = swap ? def.h : def.w;
    this.h = swap ? def.w : def.h;

    this.inBuf = {};        // input items
    this.outBuf = {};       // finished items ready to leave
    this.recipe = null;
    this.progress = 0;
    this.condition = 1;     // 1 = pristine, 0 = broken
    this.broken = false;
    this.temp = 20;         // deg C, furnaces run hot
    this.powered = false;
    this.satisfaction = 0;  // 0..1 power satisfaction last tick
    this.active = false;    // produced something this tick (drives animation/audio)
    this.net = -1;
    this.fuel = 0;          // seconds of burn left (generators)
    this.items = [];        // belts: [{ id, p }] p in 0..1
    this.lastOut = 0;
    this.totalMade = 0;
    this.anim = Math.random() * 10;
    this.workers = 0;       // employees currently boosting this machine
    this.disabled = false;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  covers(tx, ty) { return tx >= this.x && ty >= this.y && tx < this.x + this.w && ty < this.y + this.h; }

  capacityFor() { return this.def.capacity || 100; }

  countIn(id) { return this.inBuf[id] || 0; }
  countOut(id) { return this.outBuf[id] || 0; }
  totalOut() { let s = 0; for (const k in this.outBuf) s += this.outBuf[k]; return s; }
  totalIn() { let s = 0; for (const k in this.inBuf) s += this.inBuf[k]; return s; }

  /** Can this entity accept `id`? Machines only take what their recipe needs. */
  accepts(id) {
    if (this.disabled) return false;
    if (this.kind === 'store') return this.totalOut() < this.capacityFor();
    if (this.kind === 'dock') return true;
    if (this.kind === 'gen') return this.def.fuel === id && (this.inBuf[id] || 0) < 50;
    if (this.kind === 'machine' || this.kind === 'miner') {
      const r = this.recipe && RECIPES[this.recipe];
      if (!r || !r.in[id]) return false;
      return (this.inBuf[id] || 0) < Math.max(10, r.in[id] * 8);
    }
    if (this.kind === 'belt') return this.items.length < 3 && !this.items.some((it) => it.p < 0.34);
    return false;
  }

  insert(id, n = 1) {
    if (this.kind === 'belt') { this.items.push({ id, p: 0 }); return 1; }
    if (this.kind === 'store' || this.kind === 'dock') { this.outBuf[id] = (this.outBuf[id] || 0) + n; return n; }
    this.inBuf[id] = (this.inBuf[id] || 0) + n;
    return n;
  }

  /** Removes one unit of anything available to leave this entity. */
  takeAny() {
    for (const k in this.outBuf) {
      if (this.outBuf[k] > 0) {
        this.outBuf[k]--;
        if (this.outBuf[k] <= 0) delete this.outBuf[k];
        return k;
      }
    }
    return null;
  }
}

export class Factory {
  constructor(game) {
    this.game = game;
    this.ents = [];
    this.grid = new Map();      // "x,y" -> entity
    this.networks = [];
    this.dirtyPower = true;
    this.stats = { produced: 0, sold: 0, powerUse: 0, powerGen: 0 };
    this.pollution = 0;
  }

  key(x, y) { return x + ',' + y; }
  at(x, y) { return this.grid.get(this.key(x, y)) || null; }

  canPlace(type, x, y, dir) {
    const def = BUILDABLES[type];
    if (!def) return { ok: false, why: 'Unknown' };
    const swap = dir % 2 === 1 && def.w !== def.h;
    const w = swap ? def.h : def.w, h = swap ? def.w : def.h;
    const world = this.game.world;
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const tx = x + dx, ty = y + dy;
        if (!world.inBounds(tx, ty)) return { ok: false, why: 'Outside the world' };
        if (!world.inPlot(tx, ty)) return { ok: false, why: 'Outside your land — buy an expansion' };
        if (world.isWater(tx, ty) && def.kind !== 'waterpump') return { ok: false, why: 'Cannot build on water' };
        const ex = this.at(tx, ty);
        if (ex && !(def.kind === 'floor' && ex.kind === 'floor')) return { ok: false, why: 'Tile occupied' };
        if (world.propSolidAt(tx + 0.5, ty + 0.5, 0.1)) return { ok: false, why: 'Blocked by terrain' };
      }
    }
    if (def.kind === 'miner') {
      let found = false;
      for (let dy = 0; dy < h && !found; dy++)
        for (let dx = 0; dx < w && !found; dx++) if (world.nodeAt(x + dx, y + dy)) found = true;
      if (!found) return { ok: false, why: 'Must sit on a resource deposit' };
    }
    if (type === 'waterpump') {
      let near = false;
      for (let dy = -1; dy <= h && !near; dy++)
        for (let dx = -1; dx <= w && !near; dx++) if (world.isWater(x + dx, y + dy)) near = true;
      if (!near) return { ok: false, why: 'Must touch water' };
    }
    return { ok: true, w, h };
  }

  place(type, x, y, dir) {
    const chk = this.canPlace(type, x, y, dir);
    if (!chk.ok) return null;
    const e = new Entity(type, x, y, dir);
    // floors stack under other things: keep them in a separate layer
    if (e.kind === 'floor') {
      this.game.floors.set(this.key(x, y), true);
      return e;
    }
    this.ents.push(e);
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) this.grid.set(this.key(x + dx, y + dy), e);
    // sensible default recipe so a fresh machine is immediately useful
    const opts = Object.values(RECIPES).filter((r) => r.machine === type && !r.tech);
    if (opts.length && (e.kind === 'machine')) e.recipe = opts[0].id;
    if (type === 'waterpump') e.recipe = 'pump_water';
    if (e.kind === 'miner') e.recipe = 'mine_node';
    this.dirtyPower = true;
    return e;
  }

  remove(e) {
    const i = this.ents.indexOf(e);
    if (i < 0) return;
    this.ents.splice(i, 1);
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) this.grid.delete(this.key(e.x + dx, e.y + dy));
    this.dirtyPower = true;
  }

  entitiesIn(x, y, w, h) {
    const set = new Set();
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const e = this.at(x + dx, y + dy); if (e) set.add(e);
    }
    return [...set];
  }

  // ------------------------------------------------------------ power networks

  rebuildPower() {
    this.dirtyPower = false;
    for (const e of this.ents) e.net = -1;
    this.networks = [];
    const visited = new Set();

    const cables = this.ents.filter((e) => e.kind === 'cable');
    for (const start of cables) {
      if (visited.has(start.id)) continue;
      const netId = this.networks.length;
      const net = { id: netId, gen: 0, use: 0, ratio: 0, members: [], cables: [] };
      const stack = [start];
      visited.add(start.id);
      while (stack.length) {
        const c = stack.pop();
        c.net = netId; net.cables.push(c);
        for (const d of DIRS) {
          const n = this.at(c.x + d.x, c.y + d.y);
          if (n && n.kind === 'cable' && !visited.has(n.id)) { visited.add(n.id); stack.push(n); }
        }
      }
      this.networks.push(net);
    }

    // consumers/producers join a network if any of their tiles touches one of its cables
    for (const e of this.ents) {
      if (e.kind === 'cable' || e.kind === 'belt') continue;
      if (e.def.power <= 0 && e.kind !== 'gen') continue;
      let net = -1;
      outer:
      for (let dy = -1; dy <= e.h; dy++) {
        for (let dx = -1; dx <= e.w; dx++) {
          if (dx >= 0 && dx < e.w && dy >= 0 && dy < e.h) continue;
          const n = this.at(e.x + dx, e.y + dy);
          if (n && n.kind === 'cable' && n.net >= 0) { net = n.net; break outer; }
        }
      }
      e.net = net;
      if (net >= 0) this.networks[net].members.push(e);
    }

    // Belts share power along a run: hooking one belt of a line to a cable energises
    // the whole line, so the player doesn't have to cable every single tile.
    const seenBelt = new Set();
    for (const start of this.ents) {
      if (start.kind !== 'belt' || seenBelt.has(start.id)) continue;
      const group = [];
      const stack = [start];
      seenBelt.add(start.id);
      let net = -1;
      while (stack.length) {
        const b = stack.pop();
        group.push(b);
        for (const d of DIRS) {
          const n = this.at(b.x + d.x, b.y + d.y);
          if (!n) continue;
          if (n.kind === 'belt' && !seenBelt.has(n.id)) { seenBelt.add(n.id); stack.push(n); }
          else if (n.kind === 'cable' && n.net >= 0 && net < 0) net = n.net;
        }
      }
      for (const b of group) {
        b.net = net;
        if (net >= 0) this.networks[net].members.push(b);
      }
    }
  }

  // ------------------------------------------------------------ main tick

  update(dt, game) {
    if (this.dirtyPower) this.rebuildPower();
    const skills = game.player.skills;
    const engBonus = 1 - Math.min(0.4, skills.engineering.level * 0.02);      // energy use
    const prodBonus = 1 + skills.production.level * 0.035;                    // speed
    const logiBonus = 1 + skills.logistics.level * 0.04;                      // belt speed
    const wearBonus = game.services.maintenance ? 0.55 : 1;
    const dayLight = game.time.daylight;

    // ---- generators produce, consumers demand ----
    let totalGen = 0, totalUse = 0;
    for (const net of this.networks) { net.gen = 0; net.use = 0; }

    for (const e of this.ents) {
      if (e.kind === 'gen' && !e.disabled) {
        let out = 0;
        if (e.def.solar) out = e.def.output * dayLight;
        else if (e.def.fuel) {
          if (e.fuel <= 0 && (e.inBuf[e.def.fuel] || 0) > 0) {
            e.inBuf[e.def.fuel]--; e.fuel = e.def.burnTime;
            if (e.inBuf[e.def.fuel] <= 0) delete e.inBuf[e.def.fuel];
          }
          if (e.fuel > 0) { e.fuel -= dt; out = e.def.output; }
        } else out = e.def.output;                    // fusion: no fuel
        out *= 0.55 + 0.45 * e.condition;
        if (e.broken) out = 0;
        e.satisfaction = out > 0 ? 1 : 0;
        e.active = out > 0;
        if (e.net >= 0) this.networks[e.net].gen += out;
        totalGen += out;
        if (out > 0 && e.def.fuel) this.pollution += dt * 0.02;
      } else if (e.def.power > 0 && !e.disabled && !e.broken) {
        const use = e.def.power * engBonus;
        if (e.net >= 0) this.networks[e.net].use += use;
        totalUse += use;
      }
    }
    for (const net of this.networks) net.ratio = net.use <= 0 ? 1 : Math.min(1, net.gen / net.use);
    this.stats.powerGen = totalGen; this.stats.powerUse = totalUse;

    // ---- machines ----
    for (const e of this.ents) {
      e.active = e.kind === 'gen' ? e.active : false;
      e.anim += dt;
      const net = e.net >= 0 ? this.networks[e.net] : null;
      e.satisfaction = e.kind === 'gen' ? e.satisfaction : (e.def.power > 0 ? (net ? net.ratio : 0) : 1);
      e.powered = e.satisfaction > 0.02;

      switch (e.kind) {
        case 'machine': this.tickMachine(e, dt, game, prodBonus, wearBonus); break;
        case 'miner': this.tickMiner(e, dt, game, prodBonus, wearBonus); break;
        case 'belt': this.tickBelt(e, dt, logiBonus); break;
        case 'dock': this.tickDock(e, dt, game); break;
        case 'lab': this.tickLab(e, dt, game); break;
        case 'lamp': e.active = e.powered; break;
        default: break;
      }

      // cool down when idle
      if (e.temp > 20 && !e.active) e.temp -= dt * 6;
    }
  }

  machineSpeed(e, game, prodBonus) {
    const cond = 0.35 + 0.65 * e.condition;
    const workers = 1 + Math.min(0.6, e.workers * 0.22) * (game.services.breakroom ? 1.25 : 1);
    return e.satisfaction * cond * prodBonus * workers;
  }

  tickMachine(e, dt, game, prodBonus, wearBonus) {
    if (e.broken || e.disabled || !e.recipe) return;
    const r = RECIPES[e.recipe];
    if (!r) return;
    const speed = this.machineSpeed(e, game, prodBonus);
    if (speed <= 0.02) return;

    if (e.progress <= 0) {
      // need inputs and output room
      for (const [id, n] of Object.entries(r.in)) if ((e.inBuf[id] || 0) < n) return;
      if (e.totalOut() > 60) return;
      for (const [id, n] of Object.entries(r.in)) {
        e.inBuf[id] -= n;
        if (e.inBuf[id] <= 0) delete e.inBuf[id];
      }
      e.progress = 0.0001;
    }
    e.progress += (dt * speed) / r.time;
    e.active = true;
    // heat eases toward a working temperature rather than pinning at the red line
    const target = e.type === 'furnace' ? 760 + e.workers * 20 : 78;
    e.temp += (target - e.temp) * Math.min(1, dt * 0.35);

    // wear & tear
    e.condition -= dt * 0.0022 * wearBonus * (e.temp > 700 ? 1.35 : 1);
    if (e.condition < 0.18 && Math.random() < dt * 0.09) this.breakdown(e, game);
    e.condition = clamp(e.condition, 0, 1);

    if (e.progress >= 1) {
      e.progress = 0;
      const waste = Math.max(0, 0.06 - game.player.skills.production.level * 0.006);
      for (const [id, n] of Object.entries(r.out)) {
        const amt = Math.random() < waste ? Math.max(1, n - 1) : n;
        e.outBuf[id] = (e.outBuf[id] || 0) + amt;
      }
      if (r.valueBoost) e.packaged = r.valueBoost;
      e.totalMade++;
      this.stats.produced++;
      game.onProduced(e, r);
    }
  }

  tickMiner(e, dt, game, prodBonus, wearBonus) {
    if (e.broken || e.disabled) return;
    const speed = this.machineSpeed(e, game, prodBonus) * (e.def.rate || 1);
    if (speed <= 0.02) return;
    const r = RECIPES.mine_node;
    e.progress += (dt * speed) / r.time;
    e.active = true;
    e.condition -= dt * 0.0016 * wearBonus;
    if (e.condition < 0.18 && Math.random() < dt * 0.07) this.breakdown(e, game);
    if (e.progress >= 1) {
      e.progress = 0;
      if (e.totalOut() > 60) return;
      // pull from whichever deposit tile under the drill still has ore
      for (let dy = 0; dy < e.h; dy++) {
        for (let dx = 0; dx < e.w; dx++) {
          const node = game.world.nodeAt(e.x + dx, e.y + dy);
          if (node && node.amount > 0) {
            const got = game.world.mineNode(e.x + dx, e.y + dy, 1);
            if (got) {
              e.outBuf[node.type] = (e.outBuf[node.type] || 0) + got;
              e.totalMade++;
              this.stats.produced++;
              game.onProduced(e, { out: { [node.type]: got } });
            }
            return;
          }
        }
      }
      e.depleted = true;
    }
  }

  tickBelt(e, dt, logiBonus) {
    if (!e.powered && e.def.power > 0) return;
    const spd = (e.def.speed || 1.6) * logiBonus * (e.satisfaction || 1);
    const d = DIRS[e.dir];
    const target = this.at(e.x + d.x, e.y + d.y);
    e.items.sort((a, b) => b.p - a.p);
    for (let i = 0; i < e.items.length; i++) {
      const it = e.items[i];
      const ahead = i > 0 ? e.items[i - 1].p - 0.34 : 1;
      it.p = Math.min(it.p + dt * spd, ahead);
      if (it.p >= 1) {
        if (target && target !== e && target.accepts(it.id)) {
          target.insert(it.id, 1);
          e.items.splice(i, 1); i--;
          e.active = true;
        } else it.p = 1;
      }
    }
    // pull from the entity behind us
    if (e.items.length === 0 || e.items[e.items.length - 1].p > 0.34) {
      const back = this.at(e.x - d.x, e.y - d.y);
      if (back && back !== e && back.kind !== 'belt' && back.totalOut() > 0) {
        const id = back.takeAny();
        if (id) { e.items.push({ id, p: 0 }); e.active = true; }
      }
    }
  }

  tickDock(e, dt, game) {
    e.sellTimer = (e.sellTimer || 0) + dt;
    if (e.sellTimer < 1.2) return;
    e.sellTimer = 0;
    let sold = 0, revenue = 0;
    for (const [id, n] of Object.entries(e.outBuf)) {
      if (n <= 0) continue;
      const batch = Math.min(n, 25);
      revenue += game.market.sell(id, batch);
      sold += batch;
      e.outBuf[id] -= batch;
      if (e.outBuf[id] <= 0) delete e.outBuf[id];
    }
    if (sold > 0) {
      e.active = true;
      this.stats.sold += sold;
      game.onSold(revenue, sold, e);
    }
  }

  tickLab(e, dt, game) {
    if (!e.powered || e.broken || e.disabled) return;
    e.active = true;
    game.research.addPoints(dt * 1.0 * e.satisfaction * (1 + game.player.skills.technology.level * 0.06));
  }

  breakdown(e, game) {
    if (e.broken) return;
    e.broken = true; e.active = false;
    e.condition = Math.min(e.condition, 0.12);
    game.notify(`${e.def.name} has broken down!`, 'bad');
    game.audio.play('alarm');
  }

  repair(e, amount) {
    e.condition = clamp(e.condition + amount, 0, 1);
    if (e.condition > 0.35) e.broken = false;
  }

  /** Total maintenance + wage + utility cost per second. */
  operatingCost(game) {
    let cost = 0;
    for (const e of this.ents) {
      if (e.kind === 'cable' || e.kind === 'floor') continue;
      cost += e.def.cost * 0.00022;                        // upkeep
      if (e.def.power > 0 && e.powered) cost += e.def.power * 0.010;   // electricity
    }
    for (const emp of game.employees.list) cost += emp.wage / 60;
    if (game.services.office) cost *= 0.88;
    return cost;
  }

  serialize() {
    return this.ents.map((e) => ({
      t: e.type, x: e.x, y: e.y, d: e.dir, r: e.recipe, c: e.condition, b: e.broken,
      i: e.inBuf, o: e.outBuf, f: e.fuel, p: e.progress, dis: e.disabled,
      it: e.items.map((k) => [k.id, +k.p.toFixed(2)]),
    }));
  }

  deserialize(arr) {
    this.ents = []; this.grid.clear();
    for (const s of arr) {
      const e = this.place(s.t, s.x, s.y, s.d);
      if (!e) continue;
      e.recipe = s.r; e.condition = s.c ?? 1; e.broken = !!s.b;
      e.inBuf = s.i || {}; e.outBuf = s.o || {}; e.fuel = s.f || 0;
      e.progress = s.p || 0; e.disabled = !!s.dis;
      e.items = (s.it || []).map(([id, p]) => ({ id, p }));
    }
    this.dirtyPower = true;
  }
}
