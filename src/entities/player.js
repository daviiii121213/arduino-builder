// The player: an engineer who walks the factory, gathers, builds, repairs and levels up.

import { clamp, DIRS, dist } from '../core/utils.js';
import { characterSheet, FW, FH } from '../art/characters.js';
import { ITEMS } from '../data/items.js';

const SKILL_IDS = ['engineering', 'production', 'logistics', 'management', 'technology'];

export class Player {
  constructor(game, x, y) {
    this.game = game;
    this.x = x; this.y = y;              // tile-space position (float)
    this.vx = 0; this.vy = 0;
    this.dir = 2;                        // facing (0 N,1 E,2 S,3 W)
    this.frame = 0; this.animT = 0;
    this.moving = false; this.working = 0;
    this.speed = 4.2;                    // tiles / second
    this.radius = 0.3;

    this.health = 100; this.maxHealth = 100;
    this.stamina = 100; this.maxStamina = 100;
    this.level = 1; this.xp = 0; this.xpNext = 120;
    this.skills = {};
    for (const s of SKILL_IDS) this.skills[s] = { level: 1, xp: 0, next: 100 };
    this.skillPoints = 0;

    this.inv = {};                       // itemId -> count
    this.invSlots = 24;
    this.sheet = characterSheet('player', 3);
    this.actionCooldown = 0;
    this.target = null;                  // what the cursor is over
    this.carrying = null;
  }

  // ------------------------------------------------------------- inventory
  invCount(id) { return this.inv[id] || 0; }
  invTotal() { return Object.values(this.inv).reduce((a, b) => a + b, 0); }
  invUsedSlots() { return Object.keys(this.inv).length; }
  invCapacity() { return this.invSlots + this.skills.logistics.level * 2; }

  give(id, n = 1) {
    if (n <= 0) return 0;
    if (!this.inv[id] && this.invUsedSlots() >= this.invCapacity()) {
      this.game.notify('Inventory full', 'warn');
      return 0;
    }
    this.inv[id] = (this.inv[id] || 0) + n;
    this.game.ui.flashItem(id, n);
    return n;
  }

  take(id, n = 1) {
    const have = this.inv[id] || 0;
    if (have < n) return false;
    this.inv[id] = have - n;
    if (this.inv[id] <= 0) delete this.inv[id];
    return true;
  }

  // ------------------------------------------------------------- progression
  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.skillPoints++;
      this.xpNext = Math.round(this.xpNext * 1.28 + 40);
      this.maxHealth += 6; this.health = this.maxHealth;
      this.maxStamina += 5;
      this.game.notify(`Level ${this.level}! +1 skill point`, 'good');
      this.game.audio.play('levelup');
    }
  }

  addSkillXp(skill, n) {
    const s = this.skills[skill];
    if (!s) return;
    s.xp += n;
    while (s.xp >= s.next) {
      s.xp -= s.next;
      s.level++;
      s.next = Math.round(s.next * 1.35 + 30);
      this.game.notify(`${skill[0].toUpperCase() + skill.slice(1)} skill up → ${s.level}`, 'good');
    }
    this.addXp(n * 0.5);
  }

  spendSkillPoint(skill) {
    if (this.skillPoints <= 0) return false;
    this.skillPoints--;
    this.skills[skill].level++;
    this.game.audio.play('click');
    return true;
  }

  // ------------------------------------------------------------- movement
  update(dt, input, game) {
    let mx = 0, my = 0;
    if (!game.ui.textFocus) {
      if (input.down('w') || input.down('arrowup')) my -= 1;
      if (input.down('s') || input.down('arrowdown')) my += 1;
      if (input.down('a') || input.down('arrowleft')) mx -= 1;
      if (input.down('d') || input.down('arrowright')) mx += 1;
    }
    const sprint = input.down('shift') && this.stamina > 1;
    const len = Math.hypot(mx, my);
    this.moving = len > 0;

    let speed = this.speed * (sprint && this.moving ? 1.7 : 1);
    const tx = Math.floor(this.x), ty = Math.floor(this.y);
    if (game.floors.has(tx + ',' + ty)) speed *= 1.18;         // paved floor is faster
    else if (game.world.tile(tx, ty) === 5) speed *= 1.14;      // road
    speed *= 1 + this.skills.logistics.level * 0.012;

    if (this.moving) {
      mx /= len; my /= len;
      if (Math.abs(mx) > Math.abs(my)) this.dir = mx > 0 ? 1 : 3;
      else this.dir = my > 0 ? 2 : 0;
      if (sprint) this.stamina = Math.max(0, this.stamina - dt * 14);
      this.move(mx * speed * dt, my * speed * dt, game);
      this.animT += dt * (sprint ? 12 : 8);
      this.frame = 1 + (Math.floor(this.animT) % 5);
    } else {
      this.frame = 0;
      this.animT = 0;
    }
    if (!sprint) this.stamina = Math.min(this.maxStamina, this.stamina + dt * (this.moving ? 4 : 9));
    if (this.working > 0) { this.working -= dt; this.frame = 6 + (Math.floor(this.animT * 1.6) % 2); this.animT += dt * 6; }
    this.actionCooldown = Math.max(0, this.actionCooldown - dt);
    this.health = Math.min(this.maxHealth, this.health + dt * 0.6);
  }

  move(dx, dy, game) {
    const step = (nx, ny) => {
      if (game.blocked(nx, ny, this.radius)) return false;
      return true;
    };
    if (step(this.x + dx, this.y)) this.x += dx;
    if (step(this.x, this.y + dy)) this.y += dy;
    this.x = clamp(this.x, 1, game.world.W - 1);
    this.y = clamp(this.y, 1, game.world.H - 1);
  }

  /** Draw with the walk/work sheet. */
  draw(g, sx, sy) {
    const f = this.frame, d = this.dir;
    g.drawImage(this.sheet.canvas, f * FW, d * FH, FW, FH, sx - FW / 2, sy - FH + 6, FW, FH);
  }

  serialize() {
    return {
      x: this.x, y: this.y, hp: this.health, st: this.stamina, lvl: this.level,
      xp: this.xp, xpNext: this.xpNext, sp: this.skillPoints,
      skills: this.skills, inv: this.inv,
    };
  }

  deserialize(s) {
    Object.assign(this, { x: s.x, y: s.y, health: s.hp, stamina: s.st, level: s.lvl, xp: s.xp, xpNext: s.xpNext });
    this.skillPoints = s.sp || 0;
    this.skills = s.skills || this.skills;
    this.inv = s.inv || {};
  }
}
