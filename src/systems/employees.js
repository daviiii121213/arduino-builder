// Hiring and payroll. Applicants rotate; hired staff physically walk the factory.

import { Employee, ROLE_WAGE, ROLE_INFO, randomName } from '../entities/npc.js';
import { mulberry32 } from '../core/rng.js';

export class Employees {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.applicants = [];
    this.rnd = mulberry32(555);
    this.refreshT = 0;
    for (let i = 0; i < 5; i++) this.addApplicant();
  }

  hireCost(role, skill) { return Math.round(ROLE_WAGE[role] * 12 * (0.8 + skill * 0.35)); }

  addApplicant() {
    const roles = Object.keys(ROLE_WAGE).filter((r) => {
      if (r === 'researcher') return this.game.research.unlocked.size > 0;
      if (r === 'engineer' || r === 'manager') return this.game.player.level >= 4;
      return true;
    });
    const role = roles[Math.floor(this.rnd() * roles.length)];
    const seed = Math.floor(this.rnd() * 1e6);
    const skill = 1 + Math.floor(this.rnd() * 3);
    this.applicants.push({
      role, seed, skill, name: randomName(() => this.rnd()),
      wage: Math.round(ROLE_WAGE[role] * (0.85 + skill * 0.12)),
      cost: this.hireCost(role, skill),
      info: ROLE_INFO[role],
    });
    if (this.applicants.length > 6) this.applicants.shift();
  }

  hire(app) {
    if (this.game.money < app.cost) { this.game.notify('Not enough money to hire', 'bad'); return false; }
    this.game.money -= app.cost;
    const p = this.game.world.plot;
    const e = new Employee(app.role, p.x + 3 + Math.random() * 4, p.y + 3 + Math.random() * 3, app.seed, app.name);
    e.skill = app.skill; e.wage = app.wage;
    this.list.push(e);
    const i = this.applicants.indexOf(app);
    if (i >= 0) this.applicants.splice(i, 1);
    this.addApplicant();
    this.game.notify(`${e.name} hired as ${ROLE_INFO[app.role].name}`, 'good');
    this.game.audio.play('cash');
    this.game.missions.onEvent('hire');
    return true;
  }

  fire(emp) {
    const i = this.list.indexOf(emp);
    if (i >= 0) {
      this.list.splice(i, 1);
      if (emp.assigned) emp.assigned.workers = Math.max(0, emp.assigned.workers - 1);
      this.game.notify(`${emp.name} has left the company`, 'warn');
    }
  }

  payroll() { return this.list.reduce((s, e) => s + e.wage, 0); }

  update(dt, game) {
    this.refreshT += dt;
    if (this.refreshT > 90) { this.refreshT = 0; this.addApplicant(); }
    for (const e of this.list) e.update(dt, game);
  }

  serialize() { return this.list.map((e) => e.serialize()); }
  deserialize(arr) {
    this.list = (arr || []).map((s) => {
      const e = new Employee(s.r, s.x, s.y, s.s, s.n);
      e.skill = s.sk; e.morale = s.m; e.stamina = s.st; e.wage = s.w;
      return e;
    });
  }
}
