// NPCs: hired employees who physically work the factory floor, and townsfolk who
// wander the world, trade and hand out contracts.

import { characterSheet, FW, FH } from '../art/characters.js';
import { clamp, dist, pick } from '../core/utils.js';
import { mulberry32 } from '../core/rng.js';

const FIRST = ['Mara', 'Tomas', 'Ines', 'Kwame', 'Yuki', 'Dario', 'Petra', 'Sven', 'Nadia', 'Bo',
  'Lucia', 'Otto', 'Rina', 'Ezra', 'Halle', 'Milo', 'Vera', 'Anders', 'Femi', 'Sasha',
  'Rosa', 'Hugo', 'Ilse', 'Jun', 'Karim', 'Elke', 'Nils', 'Tara', 'Ravi', 'Greta'];
const LAST = ['Vogel', 'Marek', 'Okafor', 'Lindqvist', 'Duarte', 'Novak', 'Haas', 'Bianchi',
  'Kowal', 'Rennes', 'Sato', 'Abara', 'Holt', 'Ferreira', 'Steen', 'Ivanov', 'Marchetti', 'Baptiste'];

export function randomName(rnd = Math.random) {
  return `${pick(FIRST, rnd)} ${pick(LAST, rnd)}`;
}

class Person {
  constructor(role, x, y, seed) {
    this.role = role; this.x = x; this.y = y; this.seed = seed;
    this.dir = 2; this.frame = 0; this.animT = 0;
    this.speed = 2.4 + (seed % 7) * 0.08;
    this.sheet = characterSheet(role, seed);
    this.target = null; this.path = null;
    this.state = 'idle'; this.stateT = 0;
    this.radius = 0.28;
  }

  stepToward(tx, ty, dt, game, speedMul = 1) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.12) return true;
    const sp = this.speed * speedMul * dt;
    let nx = dx / d * sp, ny = dy / d * sp;
    if (Math.abs(nx) > Math.abs(ny)) this.dir = nx > 0 ? 1 : 3; else this.dir = ny > 0 ? 2 : 0;
    if (!game.blocked(this.x + nx, this.y, this.radius)) this.x += nx;
    else if (!game.blocked(this.x + nx, this.y + (ny > 0 ? 0.4 : -0.4), this.radius)) this.y += (ny > 0 ? 0.4 : -0.4) * 0.4;
    if (!game.blocked(this.x, this.y + ny, this.radius)) this.y += ny;
    else if (!game.blocked(this.x + (nx > 0 ? 0.4 : -0.4), this.y + ny, this.radius)) this.x += (nx > 0 ? 0.4 : -0.4) * 0.4;
    this.animT += dt * 8;
    this.frame = 1 + (Math.floor(this.animT) % 5);
    return false;
  }

  idleAnim(dt) { this.frame = 0; this.animT = 0; }

  draw(g, sx, sy) {
    g.drawImage(this.sheet.canvas, this.frame * FW, this.dir * FH, FW, FH, sx - FW / 2, sy - FH + 6, FW, FH);
  }
}

export class Employee extends Person {
  constructor(role, x, y, seed, name) {
    super(role, x, y, seed);
    const rnd = mulberry32(seed);
    this.name = name || randomName(rnd);
    this.skill = 1 + Math.floor(rnd() * 3);
    this.morale = 0.8;
    this.stamina = 1;
    this.wage = ROLE_WAGE[role] * (0.85 + this.skill * 0.12);
    this.assigned = null;
    this.carry = null;
    this.state = 'seek';
  }

  update(dt, game) {
    this.stateT -= dt;
    const f = game.factory;

    // rest when tired if there is a break room
    if (this.stamina < 0.15 && game.services.breakroomEnt) {
      this.state = 'rest'; this.assigned = null;
    }

    switch (this.state) {
      case 'rest': {
        const b = game.services.breakroomEnt;
        if (!b) { this.state = 'seek'; break; }
        if (this.stepToward(b.cx, b.cy, dt, game)) {
          this.idleAnim(dt);
          this.stamina = Math.min(1, this.stamina + dt * 0.12);
          this.morale = Math.min(1, this.morale + dt * 0.05);
          if (this.stamina >= 0.95) this.state = 'seek';
        }
        break;
      }
      case 'seek': {
        this.assigned = this.pickJob(game);
        this.state = this.assigned ? 'goto' : 'wander';
        this.stateT = 3;
        break;
      }
      case 'goto': {
        const t = this.assigned;
        if (!t || !f.ents.includes(t)) { this.state = 'seek'; break; }
        if (this.stepToward(t.cx, t.cy + 0.6, dt, game)) { this.state = 'work'; this.stateT = 6 + Math.random() * 6; t.workers++; }
        break;
      }
      case 'work': {
        const t = this.assigned;
        if (!t || !f.ents.includes(t)) { this.state = 'seek'; break; }
        this.frame = 6 + (Math.floor(this.animT * 2) % 2);
        this.animT += dt * 3;
        this.stamina = Math.max(0, this.stamina - dt * 0.012);
        // mechanics repair, everybody else boosts throughput
        if (this.role === 'mechanic' && (t.broken || t.condition < 0.9)) {
          f.repair(t, dt * 0.06 * this.skill * (game.services.maintenance ? 1.6 : 1));
          if (Math.random() < dt * 0.5) game.fx.sparks(t.cx, t.cy, 2);
        }
        if (this.stateT <= 0) { t.workers = Math.max(0, t.workers - 1); this.state = 'seek'; }
        break;
      }
      default: {   // wander inside the plot
        if (!this.wanderTarget || this.stateT <= 0) {
          const p = game.world.plot;
          this.wanderTarget = { x: p.x + 2 + Math.random() * (p.w - 4), y: p.y + 2 + Math.random() * (p.h - 4) };
          this.stateT = 5 + Math.random() * 5;
        }
        if (this.stepToward(this.wanderTarget.x, this.wanderTarget.y, dt, game, 0.6)) this.idleAnim(dt);
        if (this.stateT <= 0) this.state = 'seek';
        break;
      }
    }
    this.morale = clamp(this.morale - dt * 0.002 + (game.services.breakroom ? dt * 0.004 : 0), 0.2, 1);
  }

  pickJob(game) {
    const f = game.factory;
    let best = null, bestScore = -1;
    for (const e of f.ents) {
      let score = -1;
      if (this.role === 'mechanic') {
        if (e.broken) score = 100; else if (e.condition < 0.75) score = (1 - e.condition) * 40;
      } else if (this.role === 'logistics') {
        if (e.kind === 'store' || e.kind === 'dock') score = 12;
        else if (e.kind === 'machine' && e.totalOut() > 10) score = 18;
      } else if (this.role === 'researcher') {
        if (e.kind === 'lab') score = 40;
      } else if (this.role === 'engineer' || this.role === 'technician') {
        if (e.kind === 'machine' && e.active) score = 20 - e.workers * 6;
      } else {
        if ((e.kind === 'machine' || e.kind === 'miner') && !e.broken) score = 15 - e.workers * 5;
      }
      if (score <= 0) continue;
      score -= dist(this.x, this.y, e.cx, e.cy) * 0.25;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  serialize() {
    return { r: this.role, x: this.x, y: this.y, s: this.seed, n: this.name,
      sk: this.skill, m: this.morale, st: this.stamina, w: this.wage };
  }
}

export const ROLE_WAGE = {
  worker: 22, logistics: 26, mechanic: 34, technician: 38, engineer: 52, researcher: 58, manager: 64,
};

export const ROLE_INFO = {
  worker:    { name: 'Factory Worker', desc: 'Operates machines, adding throughput wherever they stand.' },
  logistics: { name: 'Logistics Worker', desc: 'Keeps storage and shipping moving; faster dock turnaround.' },
  mechanic:  { name: 'Mechanic', desc: 'Walks the floor repairing worn and broken machines.' },
  technician:{ name: 'Technician', desc: 'Boosts machine efficiency and slows wear.' },
  engineer:  { name: 'Engineer', desc: 'Large throughput boost on complex machines.' },
  researcher:{ name: 'Researcher', desc: 'Staffs the lab, generating extra research points.' },
  manager:   { name: 'Manager', desc: 'Improves sale prices and lowers operating costs.' },
};

export class Townsfolk extends Person {
  constructor(x, y, seed, opts = {}) {
    super(opts.role || 'civilian', x, y, seed);
    const rnd = mulberry32(seed * 3 + 7);
    this.name = opts.name || randomName(rnd);
    this.home = { x, y };
    this.radiusRange = opts.range || 6;
    this.lines = opts.lines || [
      'The old foundry closed last winter. Plenty of hands looking for work.',
      'Hear the port pays well for finished goods.',
      'Careful in the mine — the deep seams flood after rain.',
      'Redhaven grows every year. Somebody has to build the machines.',
    ];
    this.vendor = !!opts.vendor;
    this.questGiver = !!opts.questGiver;
    this.title = opts.title || null;
  }

  update(dt, game) {
    this.stateT -= dt;
    if (this.stateT <= 0 || !this.wanderTarget) {
      this.wanderTarget = {
        x: this.home.x + (Math.random() - 0.5) * this.radiusRange * 2,
        y: this.home.y + (Math.random() - 0.5) * this.radiusRange * 2,
      };
      this.stateT = 4 + Math.random() * 6;
    }
    if (this.stepToward(this.wanderTarget.x, this.wanderTarget.y, dt, game, 0.55)) this.idleAnim(dt);
  }

  speak(rnd = Math.random) { return pick(this.lines, rnd); }
}
