// Game controller: owns the world and every system, routes player input into actions,
// advances the clock and economy, and keeps the save file honest.

import { World, TILE, T } from './world/world.js';
import { Player } from './entities/player.js';
import { Townsfolk } from './entities/npc.js';
import { Factory } from './systems/factory.js';
import { Market, Contracts } from './systems/economy.js';
import { Research } from './systems/research.js';
import { Missions } from './systems/missions.js';
import { Employees } from './systems/employees.js';
import { FX } from './systems/fx.js';
import { Audio } from './audio/audio.js';
import { Camera } from './render/camera.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { ITEMS } from './data/items.js';
import { RECIPES } from './data/recipes.js';
import { BUILDABLES } from './data/buildables.js';
import { saveGame, loadGame, hasSave, clearSave } from './systems/save.js';
import { clamp, dist, money as fmtMoney } from './core/utils.js';

const DAY_LENGTH = 600;            // seconds of real time per in-game day
const REACH = 2.6;                 // tiles the player can reach with a tool

export class Game {
  constructor(canvas, input) {
    this.canvas = canvas;
    this.input = input;
    this.g = canvas.getContext('2d');

    this.ITEMS = ITEMS; this.RECIPES = RECIPES; this.BUILDABLES = BUILDABLES;

    this.world = new World();
    this.floors = new Map();
    this.money = 2500;
    this.time = { t: 8 * DAY_LENGTH / 24, day: 1, hour: 8, daylight: 1 };
    this.stats = { revenue: 0, spent: 0, built: 0, handMined: 0, repairs: 0, walked: 0 };

    this.audio = new Audio();
    this.fx = new FX(this);
    this.player = new Player(this, this.world.plot.x + 8, this.world.plot.y + 8);
    this.factory = new Factory(this);
    this.market = new Market(this);
    this.research = new Research(this);
    this.employees = new Employees(this);
    this.contracts = new Contracts(this);
    this.missions = new Missions(this);
    this.cam = new Camera();
    this.ui = new UI(this);
    this.renderer = new Renderer(this);

    this.npcs = [];
    this.services = { office: false, breakroom: false, maintenance: false, breakroomEnt: null };
    this.build = { active: false, type: null, dir: 0, demolish: false };
    this.hotbar = ['belt', 'cable', 'miner', 'furnace', 'chest', 'coal_gen', 'dock', 'floor'];
    this.selected = null;
    this.hoverTarget = null;
    this.cursorTile = { tx: 0, ty: 0 };
    this.currentRegion = null;
    this.regionFade = 0;
    this.netPerMinute = 0;
    this.dayUpkeep = 0;
    this.paused = false;
    this.expansions = 0;
    this.upkeepAccum = 0;
    this.moneyHistory = [];

    this.spawnTownsfolk();
    this.setupStartingFactory();
    this.cam.x = this.player.x * TILE; this.cam.y = this.player.y * TILE;
  }

  // --------------------------------------------------------------- setup
  setupStartingFactory() {
    const p = this.world.plot;
    const put = (type, x, y, dir = 0) => this.factory.place(type, p.x + x, p.y + y, dir);
    for (let y = 2; y < 12; y++) for (let x = 2; x < 16; x++) this.floors.set((p.x + x) + ',' + (p.y + y), true);
    put('furnace', 6, 5);
    put('chest', 9, 6);
    put('coal_gen', 11, 8);
    for (let i = 0; i < 5; i++) put('cable', 8 + i, 7);
    put('cable', 8, 6); put('cable', 8, 5);
    put('lamp', 5, 9); put('lamp', 13, 4);
    this.player.give('iron_ore', 24);
    this.player.give('coal', 40);
    this.player.give('wood', 12);
    this.player.give('stone', 10);
    const gen = this.factory.ents.find((e) => e.type === 'coal_gen');
    if (gen) gen.inBuf.coal = 20;
  }

  spawnTownsfolk() {
    const add = (x, y, opts) => this.npcs.push(new Townsfolk(x, y, Math.floor(Math.random() * 1e6), opts));
    const p = this.world.plot;
    add(p.x + 21, p.y - 4, {
      role: 'manager', name: 'Halvard Ness', title: 'Redhaven Trade Guild', range: 3, questGiver: true,
      lines: [
        'Your uncle built half this district with that old furnace. Put it to work.',
        'Ship anything you can make — the guild pays on collection, no haggling.',
        'Power first, then belts. A factory without cable is a very expensive shed.',
        'Contracts are where the real money is. Check the management board.',
      ],
    });
    add(34, 27, { role: 'vendor', name: 'Bera Olsen', title: 'Redhaven Supplies', range: 3, vendor: true,
      lines: ['Ore, coal, timber — if it comes out of the ground I can get it.',
              'Buy through the market board. I take a small cut, everyone does.'] });
    add(40, 178, { role: 'mechanic', title: 'Blackvein Foreman', range: 5,
      lines: ['Seams down here run deep. Bring a proper drill and you will not regret it.',
              'Watch your machines. Heat and dust eat bearings alive.'] });
    add(174, 136, { role: 'logistics', title: 'Port Authority', range: 5,
      lines: ['Ships leave twice a day. Anything on your dock goes out with them.',
              'The high-value crates are what pay for a berth here.'] });
    for (let i = 0; i < 14; i++) add(26 + Math.random() * 64, 22 + Math.random() * 46, { range: 5 });
    for (let i = 0; i < 5; i++) add(160 + Math.random() * 20, 126 + Math.random() * 34, { role: 'worker', range: 4 });
    for (let i = 0; i < 4; i++) add(28 + Math.random() * 28, 170 + Math.random() * 26, { role: 'worker', range: 4 });
  }

  // --------------------------------------------------------------- helpers
  blocked(x, y, r = 0.3) {
    const w = this.world;
    for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      const tx = Math.floor(x + dx), ty = Math.floor(y + dy);
      if (w.solidTile(tx, ty)) return true;
      const e = this.factory.at(tx, ty);
      if (e && this.entSolid(e)) return true;
    }
    return !!w.propSolidAt(x, y, r * 0.8);
  }

  entSolid(e) {
    if (e.kind === 'belt' || e.kind === 'cable' || e.kind === 'floor' || e.kind === 'pipe') return false;
    if (e.type === 'door') return false;
    return true;
  }

  totalStored(id) {
    let n = this.player.invCount(id);
    for (const e of this.factory.ents) {
      n += e.outBuf[id] || 0;
      n += e.inBuf[id] || 0;
    }
    return n;
  }

  notify(text, kind) { this.ui.notify(text, kind); }

  // --------------------------------------------------------------- events
  onProduced(ent, recipe) {
    for (const [id, n] of Object.entries(recipe.out || {})) {
      this.missions.counters.produced[id] = (this.missions.counters.produced[id] || 0) + n;
    }
    this.player.addSkillXp('production', 0.4);
    if (Math.random() < 0.25) this.audio.play('hammer');
  }

  onSold(revenue, count, ent) {
    this.stats.revenue += revenue;
    this.missions.counters.revenue += revenue;
    this.fx.text(ent.cx, ent.cy - 0.6, '+' + fmtMoney(revenue), '#8fe08a', 15);
    this.player.addSkillXp('management', revenue * 0.002);
    this.audio.play('cash');
  }

  sellFromInventory(id, n) {
    n = Math.min(n, this.player.invCount(id));
    if (n <= 0) return;
    this.player.take(id, n);
    const rev = this.market.sell(id, n);
    this.stats.revenue += rev;
    this.missions.counters.revenue += rev;
    this.notify(`Sold ${n}x ${ITEMS[id].name} for ${fmtMoney(rev)}`, 'good');
    this.audio.play('cash');
  }

  buyToInventory(id, n) {
    const cost = this.market.buy(id, n);
    if (!cost) { this.notify('Not enough money', 'bad'); this.audio.play('error'); return; }
    this.stats.spent += cost;
    this.player.give(id, n);
    this.notify(`Bought ${n}x ${ITEMS[id].name} for ${fmtMoney(cost)}`, 'info');
  }

  // --------------------------------------------------------------- building
  pickBuild(type) {
    const def = BUILDABLES[type];
    if (!def) return;
    this.build.active = true; this.build.type = type; this.build.demolish = false;
    this.notify(`${def.name} selected — click to place`, 'info');
  }

  cancelBuild() { this.build.active = false; this.build.type = null; this.build.demolish = false; }

  selectHotbar(i) {
    const id = this.hotbar[i];
    if (!id) return;
    if (this.build.active && this.build.type === id) this.cancelBuild();
    else this.pickBuild(id);
  }

  tryPlace(tx, ty) {
    const type = this.build.type, def = BUILDABLES[type];
    const chk = this.factory.canPlace(type, tx, ty, this.build.dir);
    if (!chk.ok) { this.notify(chk.why, 'bad'); this.audio.play('error'); return false; }
    if (this.money < def.cost) { this.notify('Not enough money', 'bad'); this.audio.play('error'); return false; }
    const e = this.factory.place(type, tx, ty, this.build.dir);
    if (!e) return false;
    this.money -= def.cost;
    this.stats.spent += def.cost;
    this.stats.built++;
    this.missions.counters.built[type] = (this.missions.counters.built[type] || 0) + 1;
    this.audio.play('place');
    this.fx.dust(tx + (e.w || 1) / 2, ty + (e.h || 1) / 2, 6);
    this.player.addSkillXp('engineering', 1.2);
    if (def.kind === 'floor') this.renderer.invalidateChunkAt(tx, ty);
    this.refreshServices();
    return true;
  }

  demolish(e) {
    if (!e) return;
    const refund = Math.round(e.def.cost * 0.6);
    this.money += refund;
    this.factory.remove(e);
    this.fx.dust(e.cx, e.cy, 10);
    this.audio.play('demolish');
    this.notify(`${e.def.name} removed (+${fmtMoney(refund)})`, 'info');
    if (this.selected === e) this.selected = null;
    this.refreshServices();
  }

  demolishFloorAt(tx, ty) {
    const k = tx + ',' + ty;
    if (!this.floors.has(k)) return false;
    this.floors.delete(k);
    this.money += 4;
    this.renderer.invalidateChunkAt(tx, ty);
    this.audio.play('demolish');
    return true;
  }

  repairMachine(e) {
    const need = 1 - e.condition;
    if (need < 0.005) return;
    const cost = Math.round(e.def.cost * 0.22 * need);
    if (this.money < cost) { this.notify('Not enough money to repair', 'bad'); return; }
    this.money -= cost;
    this.stats.spent += cost;
    this.stats.repairs++;
    this.factory.repair(e, 1);
    this.fx.sparks(e.cx, e.cy, 10);
    this.audio.play('repair');
    this.player.addSkillXp('engineering', 3);
    this.notify(`${e.def.name} serviced for ${fmtMoney(cost)}`, 'good');
  }

  takeOutput(e) {
    let n = 0;
    for (const [id, count] of Object.entries({ ...e.outBuf })) {
      const got = this.player.give(id, count);
      if (got > 0) {
        e.outBuf[id] -= got; n += got;
        if (e.outBuf[id] <= 0) delete e.outBuf[id];
      }
    }
    if (n) this.audio.play('clickSoft');
  }

  expansionCost() { return Math.round(4000 * Math.pow(1.75, this.expansions)); }

  /** Buys another ring of land so the plant can keep growing. */
  expandLand() {
    const cost = this.expansionCost();
    if (this.money < cost) { this.notify('Not enough money to buy land', 'bad'); this.audio.play('error'); return false; }
    const p = this.world.plot, W = this.world;
    const grow = 8;
    const nx = Math.max(2, p.x - grow), ny = Math.max(2, p.y - grow);
    const nx2 = Math.min(W.W - 2, p.x + p.w + grow), ny2 = Math.min(W.H - 2, p.y + p.h + grow);
    if (nx === p.x && ny === p.y && nx2 === p.x + p.w && ny2 === p.y + p.h) {
      this.notify('You already own everything within reach', 'warn');
      return false;
    }
    p.x = nx; p.y = ny; p.w = nx2 - nx; p.h = ny2 - ny;
    this.money -= cost;
    this.stats.spent += cost;
    this.expansions++;
    // level the new ground so it is buildable straight away
    for (let y = p.y - 1; y < p.y + p.h + 1; y++)
      for (let x = p.x - 1; x < p.x + p.w + 1; x++)
        if (W.inBounds(x, y) && !W.isWater(x, y) && W.tile(x, y) !== 5 && !W.nodeAt(x, y)) {
          if (W.tile(x, y) !== 6) W.setTile(x, y, 8);
        }
    this.renderer.chunks.clear();
    this.ui.hud.minimap = null;
    this.audio.play('cash');
    this.notify(`Land expanded — plot is now ${p.w} x ${p.h} tiles`, 'good');
    this.missions.onEvent('land');
    return true;
  }

  refreshServices() {
    const has = (kind) => this.factory.ents.find((e) => e.def.service === kind && !e.disabled);
    const br = has('breakroom');
    this.services.office = !!has('office');
    this.services.breakroom = !!br;
    this.services.breakroomEnt = br || null;
    this.services.maintenance = !!has('maintenance');
  }

  // --------------------------------------------------------------- interaction
  updateCursor() {
    const m = this.input.mouse;
    const wp = this.cam.screenToWorld(m.x, m.y);
    const tx = Math.floor(wp.x / TILE), ty = Math.floor(wp.y / TILE);
    this.cursorTile = { tx, ty, wx: wp.x / TILE, wy: wp.y / TILE };
    this.hoverTarget = null;
    if (this.ui.hoveringUI || this.ui.panel) return;

    const ent = this.factory.at(tx, ty);
    if (ent) { this.hoverTarget = { kind: 'ent', e: ent }; return; }
    const node = this.world.nodeAt(tx, ty);
    if (node) { this.hoverTarget = { kind: 'node', node }; return; }
    const prop = this.world.propSolidAt(wp.x / TILE, wp.y / TILE, 0.45);
    if (prop) { this.hoverTarget = { kind: 'prop', p: prop }; return; }
    for (const n of [...this.npcs, ...this.employees.list]) {
      if (dist(n.x, n.y, wp.x / TILE, wp.y / TILE) < 0.6) { this.hoverTarget = { kind: 'npc', n }; return; }
    }
  }

  handleWorldInput(dt) {
    const input = this.input, m = input.mouse;
    if (this.ui.hoveringUI || this.ui.panel || this.ui.dialog) return;
    const { tx, ty, wx, wy } = this.cursorTile;

    for (let i = 0; i < this.hotbar.length; i++) {
      if (input.hit(String(i + 1))) this.selectHotbar(i);
    }
    if (input.hit('r') && this.build.active) {
      this.build.dir = (this.build.dir + 1) % 4;
      this.audio.play('clickSoft');
    }
    if (input.hit('x')) {
      this.build.demolish = !this.build.demolish;
      this.build.active = false; this.build.type = null;
    }
    if (m.rclicked) { this.cancelBuild(); this.selected = null; }

    // --- building / demolishing
    // (a very fast click can land its press and release inside one frame, so treat the
    //  edge-triggered flag as "held" too)
    if (this.build.active && (m.down || m.clicked)) {
      const k = tx + ',' + ty;
      if (!this._lastPlaced || this._lastPlaced !== k) {
        if (this.tryPlace(tx, ty)) this._lastPlaced = k;
        else if (m.clicked) this._lastPlaced = k;
      }
      return;
    }
    this._lastPlaced = null;

    if (this.build.demolish && m.clicked) {
      const e = this.factory.at(tx, ty);
      if (e) this.demolish(e);
      else this.demolishFloorAt(tx, ty);
      return;
    }

    // --- tool use / selection
    if ((m.down || m.clicked) && this.player.actionCooldown <= 0) {
      const t = this.hoverTarget;
      const reachable = dist(this.player.x, this.player.y, wx, wy) < REACH + 1;
      if (t && t.kind === 'ent' && m.clicked) {
        this.selected = t.e;
        this.ui.panel = 'machine';
        this.audio.play('open');
      } else if (t && t.kind === 'node' && reachable) {
        this.handMine(t.node);
      } else if (t && t.kind === 'prop' && reachable) {
        this.harvestProp(t.p);
      }
    }

    // --- E interact
    if (input.hit('e')) this.interact();
  }

  handMine(node) {
    const p = this.player;
    p.actionCooldown = 0.42 - Math.min(0.18, p.skills.engineering.level * 0.012);
    p.working = 0.4;
    const yield_ = 1 + (Math.random() < p.skills.production.level * 0.05 ? 1 : 0);
    const got = this.world.mineNode(node.x, node.y, yield_);
    if (got > 0) {
      p.give(node.type, got);
      this.stats.handMined += got;
      this.missions.counters.produced[node.type] = (this.missions.counters.produced[node.type] || 0) + got;
      this.fx.dust(node.x + 0.5, node.y + 0.5, 4);
      this.fx.item(node.x + 0.5, node.y + 0.3, node.type);
      this.audio.play('mine');
      p.addSkillXp('production', 0.8);
      p.stamina = Math.max(0, p.stamina - 1.2);
      if (!this.world.nodeAt(node.x, node.y)) this.renderer.invalidateChunkAt(node.x, node.y);
    }
  }

  harvestProp(prop) {
    const p = this.player;
    if (prop.type !== 'tree' && prop.type !== 'boulder' && prop.type !== 'bush') return;
    p.actionCooldown = 0.5;
    p.working = 0.45;
    prop.hp = (prop.hp || 3) - 1;
    this.fx.dust(prop.x, prop.y, 3);
    this.audio.play(prop.type === 'boulder' ? 'mine' : 'chop');
    if (prop.hp <= 0) {
      const id = prop.type === 'boulder' ? 'stone' : 'wood';
      const n = prop.type === 'boulder' ? 3 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3);
      p.give(id, n);
      this.missions.counters.produced[id] = (this.missions.counters.produced[id] || 0) + n;
      this.fx.item(prop.x, prop.y - 0.4, id);
      const i = this.world.props.indexOf(prop);
      if (i >= 0) this.world.props.splice(i, 1);
      p.addSkillXp('production', 1.5);
    }
  }

  interact() {
    const p = this.player;
    // nearest interactable within reach
    let best = null, bestD = REACH;
    for (const n of [...this.npcs, ...this.employees.list]) {
      const d = dist(p.x, p.y, n.x, n.y);
      if (d < bestD) { bestD = d; best = { kind: 'npc', n }; }
    }
    for (const e of this.factory.ents) {
      const d = dist(p.x, p.y, e.cx, e.cy) - Math.max(e.w, e.h) * 0.4;
      if (d < bestD) { bestD = d; best = { kind: 'ent', e }; }
    }
    if (!best) { this.notify('Nothing within reach', 'info'); return; }

    if (best.kind === 'npc') {
      const n = best.n;
      this.ui.dialog = {
        name: n.name, role: n.role, seed: n.seed, title: n.title || (n.wage ? 'Employee' : null),
        text: n.speak ? n.speak() : `Morale ${Math.round(n.morale * 100)}%, stamina ${Math.round(n.stamina * 100)}%. ${n.state === 'work' ? 'Working now.' : 'Heading to a job.'}`,
      };
      this.audio.play('open');
      return;
    }
    const e = best.e;
    if (e.broken || e.condition < 0.99) {
      // hand repair: free but slow and costs stamina
      this.player.working = 0.6;
      this.factory.repair(e, 0.08 + this.player.skills.engineering.level * 0.012);
      this.player.stamina = Math.max(0, this.player.stamina - 4);
      this.player.addSkillXp('engineering', 1.5);
      this.fx.sparks(e.cx, e.cy, 5);
      this.audio.play('repair');
      if (!e.broken && e.condition >= 0.999) this.notify(`${e.def.name} fully serviced`, 'good');
      this.stats.repairs += 0.1;
    } else if (e.totalOut() > 0) {
      this.takeOutput(e);
      this.notify(`Collected output from ${e.def.name}`, 'info');
    } else if (e.kind === 'gen' && e.def.fuel && this.player.invCount(e.def.fuel) > 0) {
      const n = Math.min(20, this.player.invCount(e.def.fuel));
      this.player.take(e.def.fuel, n);
      e.inBuf[e.def.fuel] = (e.inBuf[e.def.fuel] || 0) + n;
      this.notify(`Loaded ${n} ${ITEMS[e.def.fuel].name}`, 'info');
      this.audio.play('clickSoft');
    } else if (e.kind === 'machine' || e.kind === 'miner') {
      // hand-feed the machine from inventory
      const r = RECIPES[e.recipe];
      let fed = 0;
      if (r) for (const [id, n] of Object.entries(r.in)) {
        const have = this.player.invCount(id);
        if (have > 0) {
          const give = Math.min(have, n * 10);
          this.player.take(id, give);
          e.inBuf[id] = (e.inBuf[id] || 0) + give;
          fed += give;
        }
      }
      if (fed) { this.notify(`Loaded ${fed} items into ${e.def.name}`, 'info'); this.audio.play('clickSoft'); }
      else { this.selected = e; this.ui.panel = 'machine'; }
    } else {
      this.selected = e; this.ui.panel = 'machine';
    }
  }

  // --------------------------------------------------------------- loop
  update(dt) {
    const input = this.input;
    dt = Math.min(dt, 0.05);

    this.ui.update(dt, input);
    if (input.hit('f5')) this.save();
    if (input.hit('f9')) this.load();
    if (input.hit('p')) { this.paused = !this.paused; this.notify(this.paused ? 'Paused' : 'Resumed', 'info'); }

    // camera zoom
    if (!this.ui.hoveringUI && input.mouse.wheel) {
      this.cam.targetZoom = clamp(this.cam.targetZoom * (input.mouse.wheel > 0 ? 0.88 : 1.14), 0.45, 2.6);
    }

    this.updateCursor();
    if (!this.paused) {
      const px = this.player.x, py = this.player.y;
      this.player.update(dt, input, this);
      this.stats.walked += dist(px, py, this.player.x, this.player.y) * 2;
      if (this.player.moving && Math.random() < dt * 5) this.audio.play('step');
      this.handleWorldInput(dt);

      this.factory.update(dt, this);
      this.employees.update(dt, this);
      for (const n of this.npcs) n.update(dt, this);
      this.market.update(dt);
      this.contracts.update(dt);
      this.missions.update(dt);
      this.fx.update(dt);
      this.advanceTime(dt);
      this.applyUpkeep(dt);
    }

    this.cam.follow(this.player.x * TILE, this.player.y * TILE, dt);
    this.cam.update(dt);

    // region discovery banner
    const reg = this.world.regionAt(Math.floor(this.player.x), Math.floor(this.player.y));
    if (reg !== this.currentRegion) { this.currentRegion = reg; this.regionFade = reg ? 3.5 : 0; }
    this.regionFade = Math.max(0, this.regionFade - dt);

    // audio bed
    const activeMachines = this.factory.ents.filter((e) => e.active && e.kind !== 'belt').length;
    const activeBelts = this.factory.ents.filter((e) => e.kind === 'belt' && e.items.length).length;
    this.audio.setAmbience(activeMachines, activeBelts, !this.world.inPlot(this.player.x, this.player.y), dt);
    this.audio.updateMusic(dt, this.musicTier());
  }

  /** Called after draw(): UI widgets are hit-tested while drawing, so edge-triggered
   *  input has to survive until the frame is fully rendered. */
  endFrame() { this.input.endFrame(); }

  musicTier() {
    const n = this.factory.ents.length;
    if (this.research.unlocked.has('robotics')) return 4;
    if (n > 90 || this.research.unlocked.has('electronics')) return 3;
    if (n > 45 || this.research.unlocked.has('chemistry')) return 2;
    if (n > 18) return 1;
    return 0;
  }

  advanceTime(dt) {
    const t = this.time;
    t.t += dt;
    if (t.t >= DAY_LENGTH) { t.t -= DAY_LENGTH; t.day++; this.endOfDay(); }
    t.hour = (t.t / DAY_LENGTH) * 24;
    // daylight curve: dawn 5-7, dusk 18-20
    const h = t.hour;
    // never fully dark: the factory has to stay readable at 3am
    t.daylight = h < 5 || h > 20 ? 0.2
      : h < 7 ? clamp((h - 5) / 2, 0, 1) * 0.8 + 0.2
      : h < 18 ? 1
      : clamp(1 - (h - 18) / 2, 0, 1) * 0.8 + 0.2;
  }

  endOfDay() {
    const wages = this.employees.payroll();
    this.money -= wages;
    this.stats.spent += wages;
    this.notify(`Day ${this.time.day}: payroll ${fmtMoney(wages)} paid`, wages > 0 ? 'warn' : 'info');
    this.market.dayRevenue = 0; this.market.dayCosts = 0; this.dayUpkeep = 0;
    this.contracts.generate();
    if (this.money < 0) this.notify('You are in debt — sell stock or take a contract', 'bad');
    this.save();
  }

  applyUpkeep(dt) {
    const rate = this.factory.operatingCost(this);
    this.money -= rate * dt;
    this.dayUpkeep += rate * dt;
    this.stats.spent += rate * dt;
    this.upkeepAccum += dt;
    if (this.upkeepAccum > 1) {
      this.upkeepAccum = 0;
      this.moneyHistory.push(this.money);
      if (this.moneyHistory.length > 90) this.moneyHistory.shift();
      if (this.moneyHistory.length > 6) {
        const d = this.money - this.moneyHistory[this.moneyHistory.length - 6];
        this.netPerMinute = d * 10;
      }
    }
  }

  draw(dt) {
    const g = this.g;
    const dpr = this.canvas.width / (this.canvas.clientWidth || window.innerWidth);
    const w = this.canvas.width / dpr, h = this.canvas.height / dpr;
    this.cam.dpr = dpr;
    this.cam.resize(w, h);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0d10';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.renderer.draw(g, this.cam, dt);
    this.cam.applyScreen(g);
    this.ui.draw(g, w, h);
    if (this.paused) {
      g.fillStyle = 'rgba(6,8,11,0.5)'; g.fillRect(0, 0, w, h);
      g.font = 'bold 42px Georgia, serif'; g.textAlign = 'center';
      g.fillStyle = '#e8e2d4'; g.fillText('PAUSED', w / 2, h / 2);
      g.font = '15px "Segoe UI", sans-serif';
      g.fillText('press P to resume', w / 2, h / 2 + 30);
    }
  }

  // --------------------------------------------------------------- persistence
  save() {
    if (saveGame(this)) this.notify('Game saved', 'info');
    else this.notify('Save failed', 'bad');
  }

  load() {
    if (!hasSave()) { this.notify('No save found', 'warn'); return; }
    if (loadGame(this)) {
      this.renderer.chunks.clear();
      this.ui.hud.minimap = null;
      this.refreshServices();
      this.notify('Game loaded', 'good');
    } else this.notify('Load failed', 'bad');
  }

  restart() {
    clearSave();
    location.reload();
  }
}
