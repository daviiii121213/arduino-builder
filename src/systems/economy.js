// Dynamic market: prices drift, respond to how much you flood the market with, and
// slowly recover. Contracts are fixed-price bulk orders with deadlines.

import { ITEMS, itemValue } from '../data/items.js';
import { RECIPES } from '../data/recipes.js';
import { clamp, pick } from '../core/utils.js';
import { mulberry32 } from '../core/rng.js';

export class Market {
  constructor(game) {
    this.game = game;
    this.price = {};       // multiplier around the base value
    this.trend = {};
    this.history = {};
    for (const id of Object.keys(ITEMS)) {
      this.price[id] = 0.9 + Math.random() * 0.25;
      this.trend[id] = (Math.random() - 0.5) * 0.02;
      this.history[id] = [];
    }
    this.t = 0;
    this.dayRevenue = 0; this.dayCosts = 0;
  }

  unit(id) { return itemValue(id) * this.price[id]; }
  buyPrice(id) { return this.unit(id) * 1.35; }          // buying costs a premium
  sellPrice(id) {
    const mgr = this.game.services.office ? 1.06 : 1;
    const skill = 1 + this.game.player.skills.management.level * 0.018;
    return this.unit(id) * mgr * skill;
  }

  sell(id, n) {
    const revenue = this.sellPrice(id) * n;
    this.game.money += revenue;
    this.dayRevenue += revenue;
    // flooding the market pushes the price down
    this.price[id] = clamp(this.price[id] - n * 0.0016, 0.35, 2.6);
    return revenue;
  }

  buy(id, n) {
    const cost = this.buyPrice(id) * n;
    if (this.game.money < cost) return 0;
    this.game.money -= cost;
    this.dayCosts += cost;
    this.price[id] = clamp(this.price[id] + n * 0.0009, 0.35, 2.6);
    return cost;
  }

  update(dt) {
    this.t += dt;
    if (this.t < 1) return;
    this.t = 0;
    for (const id of Object.keys(this.price)) {
      this.trend[id] += (Math.random() - 0.5) * 0.006;
      this.trend[id] = clamp(this.trend[id], -0.02, 0.02);
      // mean reversion toward 1.0
      this.price[id] += this.trend[id] + (1 - this.price[id]) * 0.012;
      this.price[id] = clamp(this.price[id], 0.35, 2.6);
      const h = this.history[id];
      h.push(this.price[id]);
      if (h.length > 60) h.shift();
    }
  }
}

const CLIENTS = ['Meridian Freight', 'Kessler Works', 'Redhaven Rail', 'Saltwater Port Authority',
  'Northridge Quarry Co.', 'Union Foundry', 'Pinehollow Timber', 'City of Redhaven',
  'Blackvein Mining', 'Halden Motors'];

export class Contracts {
  constructor(game) {
    this.game = game;
    this.offers = [];
    this.active = [];
    this.completed = 0;
    this.refreshT = 0;
    this.rnd = mulberry32(99);
    for (let i = 0; i < 3; i++) this.generate();
  }

  /** Contracts scale with what the player can actually make. */
  candidateItems() {
    const known = new Set(['iron_plate', 'copper_plate', 'gear', 'wire', 'stone', 'wood', 'coal', 'iron_ore']);
    for (const r of Object.values(RECIPES)) {
      if (r.tech && !this.game.research.unlocked.has(r.tech)) continue;
      for (const k of Object.keys(r.out)) known.add(k);
    }
    return [...known].filter((k) => ITEMS[k]);
  }

  generate() {
    const pool = this.candidateItems();
    const id = pick(pool, () => this.rnd());
    const base = itemValue(id);
    const qty = Math.max(5, Math.round((260 + this.rnd() * 900) / Math.max(3, base) * (1 + this.game.player.level * 0.09)));
    const pay = Math.round(base * qty * (1.45 + this.rnd() * 0.5));
    const time = Math.round(180 + qty * 2.2 + this.rnd() * 240);
    this.offers.push({
      id: 'c' + Math.floor(this.rnd() * 1e9),
      client: pick(CLIENTS, () => this.rnd()),
      item: id, qty, pay, time, delivered: 0,
      xp: Math.round(pay * 0.05),
    });
    if (this.offers.length > 4) this.offers.shift();
  }

  accept(offer) {
    const i = this.offers.indexOf(offer);
    if (i < 0) return;
    this.offers.splice(i, 1);
    offer.deadline = offer.time;
    this.active.push(offer);
    this.game.notify(`Contract accepted: ${offer.qty}x ${ITEMS[offer.item].name}`, 'good');
  }

  /** Deliver from the player's inventory or from a dock/storage. */
  deliver(contract, amount) {
    const got = Math.min(amount, contract.qty - contract.delivered);
    contract.delivered += got;
    if (contract.delivered >= contract.qty) this.complete(contract);
    return got;
  }

  complete(c) {
    const i = this.active.indexOf(c);
    if (i >= 0) this.active.splice(i, 1);
    this.game.money += c.pay;
    this.game.player.addXp(c.xp);
    this.game.player.addSkillXp('management', c.xp * 0.4);
    this.completed++;
    this.game.notify(`Contract complete — ${c.client} paid $${Math.round(c.pay)}`, 'good');
    this.game.audio.play('cash');
  }

  fail(c) {
    const i = this.active.indexOf(c);
    if (i >= 0) this.active.splice(i, 1);
    const penalty = Math.round(c.pay * 0.15);
    this.game.money -= penalty;
    this.game.notify(`Contract failed — ${c.client} charged $${penalty}`, 'bad');
  }

  update(dt) {
    this.refreshT += dt;
    if (this.refreshT > 75) { this.refreshT = 0; this.generate(); }
    for (const c of this.active.slice()) {
      c.deadline -= dt;
      if (c.deadline <= 0) this.fail(c);
    }
    // auto-deliver from shipping docks
    for (const c of this.active.slice()) {
      for (const e of this.game.factory.ents) {
        if (e.kind !== 'dock') continue;
        const have = e.outBuf[c.item] || 0;
        if (have > 0) {
          const n = this.deliver(c, have);
          e.outBuf[c.item] -= n;
          if (e.outBuf[c.item] <= 0) delete e.outBuf[c.item];
        }
      }
    }
  }
}
