// Procedural overworld: a factory plot surrounded by forest, mountains, a mining valley,
// a river with a port, a highway and a small city. Tiles are 32px.

import { Noise2D, mulberry32 } from '../core/rng.js';
import { clamp } from '../core/utils.js';

export const TILE = 32;
export const T = { GRASS: 0, DIRT: 1, ROCK: 2, WATER: 3, SAND: 4, ROAD: 5, CONCRETE: 6, FOREST: 7, GRAVEL: 8, DEEP: 9 };

export const NODE_TYPES = {
  iron_ore:   { color: '#a08a76', rich: 4200 },
  copper_ore: { color: '#c47a3d', rich: 3400 },
  coal:       { color: '#3a3a42', rich: 5200 },
  stone:      { color: '#8a8886', rich: 6000 },
  sand:       { color: '#c2a973', rich: 5000 },
};

export class World {
  constructor(seed = 20260911) {
    this.seed = seed;
    this.W = 240; this.H = 240;
    this.tiles = new Uint8Array(this.W * this.H);
    this.variant = new Uint8Array(this.W * this.H);
    this.nodes = new Map();     // "x,y" -> { type, amount, max }
    this.props = [];            // trees, rocks, city buildings, street furniture
    this.regions = [];
    this.plot = { x: 100, y: 104, w: 40, h: 34 };   // starting land (expandable)
    this.generate();
  }

  idx(x, y) { return y * this.W + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  tile(x, y) { return this.inBounds(x, y) ? this.tiles[this.idx(x, y)] : T.DEEP; }
  setTile(x, y, t) { if (this.inBounds(x, y)) this.tiles[this.idx(x, y)] = t; }
  nodeAt(x, y) { return this.nodes.get(x + ',' + y); }

  isWater(x, y) { const t = this.tile(x, y); return t === T.WATER || t === T.DEEP; }

  /** Terrain that blocks walking (props and factory entities are checked elsewhere). */
  solidTile(x, y) { return this.isWater(x, y) || !this.inBounds(x, y); }

  inPlot(x, y) {
    const p = this.plot;
    return x >= p.x && y >= p.y && x < p.x + p.w && y < p.y + p.h;
  }

  generate() {
    const n1 = new Noise2D(this.seed);
    const n2 = new Noise2D(this.seed ^ 0x9e3779b9);
    const n3 = new Noise2D(this.seed + 77);
    const rnd = mulberry32(this.seed);
    const { W, H } = this;

    // --- base terrain from layered noise ---
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const e = n1.fbm(x / 46, y / 46, 5) * 0.72 + n2.fbm(x / 13, y / 13, 3) * 0.28;
        const m = n2.fbm(x / 60 + 40, y / 60 - 12, 4);
        let t;
        if (e > 0.665) t = T.ROCK;
        else if (e > 0.60) t = T.GRAVEL;
        else if (e < 0.365) t = T.WATER;
        else if (e < 0.395) t = T.SAND;
        else if (m > 0.58) t = T.FOREST;
        else if (m < 0.40) t = T.DIRT;
        else t = T.GRASS;
        this.tiles[this.idx(x, y)] = t;
        this.variant[this.idx(x, y)] = (n3.at(x * 1.7, y * 1.7) * 255) & 255;
      }
    }

    // --- a river running north-south through the east, widening into the port bay ---
    let rx = 186;
    for (let y = 0; y < H; y++) {
      rx += (n1.at(y / 18, 3.3) - 0.5) * 2.6;
      rx = clamp(rx, 168, 206);
      const wRiver = 3 + n2.at(y / 24, 9) * 4 + (y > 150 ? (y - 150) * 0.09 : 0);
      for (let d = -wRiver; d <= wRiver; d++) {
        const x = Math.round(rx + d);
        if (!this.inBounds(x, y)) continue;
        const t = Math.abs(d) > wRiver - 1.2 ? T.SAND : (Math.abs(d) < wRiver * 0.45 ? T.DEEP : T.WATER);
        this.tiles[this.idx(x, y)] = t;
      }
    }

    // --- mountains ridge to the south-west (the mine) ---
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - 44) / 38, (y - 186) / 30);
        if (d < 1 && !this.isWater(x, y)) this.tiles[this.idx(x, y)] = d < 0.62 ? T.ROCK : T.GRAVEL;
      }
    }
    // --- northern quarry hills ---
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.hypot((x - 150) / 30, (y - 34) / 22);
        if (d < 1 && !this.isWater(x, y)) this.tiles[this.idx(x, y)] = d < 0.55 ? T.ROCK : T.GRAVEL;
      }
    }

    // --- the player's plot: flattened gravel yard ---
    const p = this.plot;
    for (let y = p.y - 2; y < p.y + p.h + 2; y++)
      for (let x = p.x - 2; x < p.x + p.w + 2; x++)
        if (this.inBounds(x, y) && !this.isWater(x, y)) this.tiles[this.idx(x, y)] = T.GRAVEL;
    for (let y = p.y + 2; y < p.y + 14; y++)
      for (let x = p.x + 2; x < p.x + 18; x++) this.tiles[this.idx(x, y)] = T.CONCRETE;

    // --- roads: a highway plus connections to city, port, mine ---
    this.road(p.x + 20, p.y - 2, p.x + 20, 6);          // north spur to city
    this.road(p.x + 20, 14, 60, 14);                     // highway west
    this.road(60, 14, 60, 60);
    this.road(p.x - 2, p.y + 16, 62, p.y + 16);          // west access
    this.road(p.x + 20, p.y + p.h + 2, p.x + 20, 196);   // south to the mine road
    this.road(p.x + 20, 196, 62, 196);
    this.road(p.x + p.w + 2, p.y + 10, 176, p.y + 10);   // east to the port
    this.road(30, 30, 30, 90); this.road(30, 30, 92, 30); // city streets
    this.road(46, 30, 46, 72); this.road(30, 56, 92, 56);

    this.regions = [
      { name: 'Ironworks Plot', x: p.x, y: p.y, w: p.w, h: p.h, kind: 'home' },
      { name: 'Redhaven City', x: 18, y: 18, w: 78, h: 52, kind: 'city' },
      { name: 'Blackvein Mine', x: 16, y: 160, w: 66, h: 56, kind: 'mine' },
      { name: 'Pinehollow Forest', x: 96, y: 168, w: 62, h: 60, kind: 'forest' },
      { name: 'Northridge Quarry', x: 124, y: 12, w: 56, h: 46, kind: 'quarry' },
      { name: 'Saltwater Port', x: 172, y: 120, w: 56, h: 60, kind: 'port' },
      { name: 'Eastfield Highway', x: 150, y: 96, w: 40, h: 18, kind: 'road' },
    ];

    this.placeDeposits(rnd, n1);
    this.placeProps(rnd, n2);
  }

  road(x1, y1, x2, y2) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x1 + ((x2 - x1) * i) / steps);
      const y = Math.round(y1 + ((y2 - y1) * i) / steps);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!this.inBounds(x + dx, y + dy)) continue;
          if (this.isWater(x + dx, y + dy)) continue;   // bridges are drawn as road over water separately
          this.tiles[this.idx(x + dx, y + dy)] = T.ROAD;
        }
    }
  }

  addDeposit(type, cx, cy, radius, richness, rnd) {
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) {
      for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
        if (!this.inBounds(x, y) || this.isWater(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d > 1) continue;
        if (rnd() < 0.22 + d * 0.5) continue;
        const amount = Math.round(richness * (1 - d * 0.65) * (0.7 + rnd() * 0.6));
        if (amount < 40) continue;
        this.nodes.set(x + ',' + y, { type, amount, max: amount, x, y });
      }
    }
  }

  placeDeposits(rnd) {
    const p = this.plot;
    // starter patches close to the plot so the first hour is playable on foot
    this.addDeposit('iron_ore', p.x - 9, p.y + 8, 4.5, 2600, rnd);
    this.addDeposit('coal', p.x + 14, p.y + p.h + 7, 4.5, 3200, rnd);
    this.addDeposit('stone', p.x + p.w + 6, p.y + 22, 4, 3600, rnd);
    this.addDeposit('copper_ore', p.x - 12, p.y + 26, 4, 2200, rnd);
    // rich fields in the mining valley
    const fields = [
      ['iron_ore', 40, 176, 9], ['iron_ore', 62, 198, 8], ['coal', 28, 196, 9],
      ['coal', 56, 170, 7], ['copper_ore', 46, 206, 8], ['copper_ore', 22, 172, 7],
      ['stone', 70, 184, 8], ['iron_ore', 146, 30, 9], ['stone', 162, 44, 8],
      ['copper_ore', 132, 22, 7], ['coal', 168, 26, 7], ['sand', 196, 150, 7],
      ['sand', 182, 96, 6],
    ];
    for (const [type, x, y, r] of fields) this.addDeposit(type, x, y, r, NODE_TYPES[type].rich, rnd);
  }

  placeProps(rnd) {
    const { W, H } = this;
    const add = (type, x, y, extra = {}) => this.props.push({ type, x, y, seed: (rnd() * 1e9) | 0, ...extra });

    for (let y = 2; y < H - 2; y++) {
      for (let x = 2; x < W - 2; x++) {
        const t = this.tile(x, y);
        if (this.inPlot(x, y)) continue;
        if (t === T.FOREST && rnd() < 0.34) add('tree', x + rnd() * 0.6 - 0.3, y + rnd() * 0.6 - 0.3, { solid: true, r: 0.38 });
        else if (t === T.GRASS && rnd() < 0.045) add(rnd() < 0.6 ? 'bush' : 'tree', x + rnd() * 0.5, y + rnd() * 0.5, { solid: rnd() < 0.5, r: 0.32 });
        else if (t === T.ROCK && rnd() < 0.14) add('boulder', x + rnd() * 0.4, y + rnd() * 0.4, { solid: true, r: 0.42 });
        else if (t === T.GRAVEL && rnd() < 0.05) add('rubble', x + rnd() * 0.5, y + rnd() * 0.5);
        else if (t === T.SAND && rnd() < 0.03) add('reed', x + rnd() * 0.5, y + rnd() * 0.5);
        else if (t === T.DIRT && rnd() < 0.02) add('grasstuft', x + rnd() * 0.5, y + rnd() * 0.5);
      }
    }

    // ---- city block: shops, apartments, a market, street furniture ----
    const cityBuildings = [
      ['shop', 34, 26, 'Redhaven Supplies'], ['apartment', 40, 24], ['apartment', 52, 24],
      ['office_bldg', 58, 32, 'Meridian Freight'], ['shop', 34, 44, 'Tool Exchange'],
      ['apartment', 52, 44], ['factory_bldg', 70, 34, 'Kessler Works'],
      ['office_bldg', 36, 62, 'City Hall'], ['shop', 60, 62, 'Market Hall'],
      ['apartment', 74, 60], ['factory_bldg', 80, 22, 'Union Foundry'],
    ];
    for (const [type, x, y, label] of cityBuildings) add(type, x, y, { solid: true, r: 2.2, label });
    for (let i = 0; i < 46; i++) {
      const x = 24 + rnd() * 66, y = 22 + rnd() * 46;
      if (this.tile(Math.round(x), Math.round(y)) === T.ROAD) add('streetlight', x, y);
    }

    // ---- port ----
    add('crane', 176, 138, { solid: true, r: 1.6 });
    add('crane', 176, 152, { solid: true, r: 1.6 });
    add('warehouse_bldg', 168, 130, { solid: true, r: 2.4, label: 'Port Authority' });
    for (let i = 0; i < 22; i++) add('container', 160 + rnd() * 12, 126 + rnd() * 36, { solid: true, r: 0.7 });
    add('ship', 196, 146, { solid: true, r: 3 });

    // ---- mine camp ----
    add('mine_entrance', 40, 178, { solid: true, r: 1.4, label: 'Blackvein Adit' });
    add('minecart', 44, 182); add('minecart', 37, 186);
    for (let i = 0; i < 16; i++) add('rubble', 30 + rnd() * 30, 170 + rnd() * 30);

    // ---- highway furniture ----
    for (let i = 0; i < 30; i++) {
      const x = 20 + rnd() * 200, y = 14;
      if (this.tile(Math.round(x), Math.round(y)) === T.ROAD) add('roadsign', x, y + 2.2);
    }

    // ---- starting plot dressing ----
    const p = this.plot;
    add('signboard', p.x + 3, p.y + 1);
    add('barrel', p.x + 20, p.y + 5); add('barrel', p.x + 21.2, p.y + 5.4);
    add('pallet', p.x + 24, p.y + 8); add('pallet', p.x + 25.5, p.y + 9);
    add('fence', 0, 0, { hidden: true });

    this.props.sort((a, b) => a.y - b.y);
  }

  /** Prop collision test in tile space. */
  propSolidAt(wx, wy, radius = 0.28) {
    for (const p of this.props) {
      if (!p.solid) continue;
      if (Math.abs(p.x - wx) > 4 || Math.abs(p.y - wy) > 4) continue;
      const rr = (p.r || 0.35) + radius;
      if ((p.x - wx) ** 2 + (p.y + 0.25 - wy) ** 2 < rr * rr) return p;
    }
    return null;
  }

  regionAt(x, y) {
    for (const r of this.regions)
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
    return null;
  }

  mineNode(x, y, amount) {
    const key = x + ',' + y;
    const n = this.nodes.get(key);
    if (!n || n.amount <= 0) return 0;
    const got = Math.min(amount, n.amount);
    n.amount -= got;
    if (n.amount <= 0) this.nodes.delete(key);
    return got;
  }
}
