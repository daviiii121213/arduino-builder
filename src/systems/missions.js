// Story-driven missions plus repeatable objectives. Missions listen to game events
// and complete themselves, so the player is always given a next step.

import { ITEMS } from '../data/items.js';
import { BUILDABLES } from '../data/buildables.js';

/**
 * goal kinds:
 *  build   { type, count }      place N of a buildable
 *  produce { item, count }      produce N of an item (anywhere)
 *  have    { item, count }      hold N in inventory or storage
 *  money   { amount }
 *  sell    { amount }           total revenue earned
 *  tech    { id }
 *  hire    { count }
 *  power   { amount }           generation capacity
 *  visit   { region }
 */
export const MISSIONS = [
  { id: 'm_intro', name: 'Fire It Up', giver: 'Halvard Ness',
    text: 'Your uncle left you this plot and a rusty furnace. Mine some iron ore by hand and smelt your first plates.',
    goals: [{ kind: 'produce', item: 'iron_plate', count: 5 }],
    reward: { money: 400, xp: 60, items: { coal: 20 } } },

  { id: 'm_power', name: 'Keep the Lights On',
    text: 'Nothing runs without electricity. Build a coal generator and run cable to your machines.',
    goals: [{ kind: 'build', type: 'coal_gen', count: 1 }, { kind: 'build', type: 'cable', count: 6 }],
    reward: { money: 500, xp: 80, items: { coal: 30 } }, req: ['m_intro'] },

  { id: 'm_belt', name: 'Stop Carrying It Yourself',
    text: 'Automate the boring part. Lay conveyor belts and a mining drill so ore walks itself to the furnace.',
    goals: [{ kind: 'build', type: 'miner', count: 1 }, { kind: 'build', type: 'belt', count: 10 }],
    reward: { money: 700, xp: 120 }, req: ['m_power'] },

  { id: 'm_sell', name: 'First Payday',
    text: 'Build a loading dock and ship product. Trucks pay on collection.',
    goals: [{ kind: 'build', type: 'dock', count: 1 }, { kind: 'sell', amount: 1200 }],
    reward: { money: 900, xp: 150 }, req: ['m_belt'] },

  { id: 'm_lab', name: 'Learn Something New',
    text: 'Knowledge compounds faster than steel. Put up a research lab and unlock Steelmaking.',
    goals: [{ kind: 'build', type: 'lab', count: 1 }, { kind: 'tech', id: 'steelmaking' }],
    reward: { money: 1200, xp: 220 }, req: ['m_sell'] },

  { id: 'm_crew', name: 'Hire a Crew',
    text: 'You cannot run a factory alone. Hire three workers and build somewhere for them to rest.',
    goals: [{ kind: 'hire', count: 3 }, { kind: 'build', type: 'breakroom', count: 1 }],
    reward: { money: 1500, xp: 260 }, req: ['m_lab'] },

  { id: 'm_steel', name: 'Steel City',
    text: 'Steel is the backbone of everything that follows. Produce 60 steel ingots.',
    goals: [{ kind: 'produce', item: 'steel', count: 60 }],
    reward: { money: 2600, xp: 400, items: { coal: 60 } }, req: ['m_lab'] },

  { id: 'm_assembly', name: 'Assembly Line',
    text: 'Stop selling raw stock. Assemble and ship 25 tool kits.',
    goals: [{ kind: 'build', type: 'assembler', count: 1 }, { kind: 'produce', item: 'tool_kit', count: 25 }],
    reward: { money: 3200, xp: 520 }, req: ['m_steel'] },

  { id: 'm_scale', name: 'Scale Up',
    text: 'A real plant needs real power and real storage. Reach 80 kW of generation and build a warehouse.',
    goals: [{ kind: 'power', amount: 80 }, { kind: 'build', type: 'warehouse', count: 1 }],
    reward: { money: 5000, xp: 700 }, req: ['m_assembly'] },

  { id: 'm_chem', name: 'Better Living Through Chemistry',
    text: 'Unlock Industrial Chemistry and get a chemical plant running.',
    goals: [{ kind: 'tech', id: 'chemistry' }, { kind: 'build', type: 'chemical', count: 1 }],
    reward: { money: 6500, xp: 900 }, req: ['m_scale'] },

  { id: 'm_electro', name: 'Silicon and Copper',
    text: 'The market wants electronics. Produce 40 advanced circuits.',
    goals: [{ kind: 'produce', item: 'adv_circuit', count: 40 }],
    reward: { money: 12000, xp: 1400 }, req: ['m_chem'] },

  { id: 'm_robot', name: 'Machines Making Machines',
    text: 'Unlock Robotics and build a robotic assembler. Let the factory build itself.',
    goals: [{ kind: 'tech', id: 'robotics' }, { kind: 'build', type: 'robotics', count: 1 }],
    reward: { money: 25000, xp: 2600 }, req: ['m_electro'] },

  { id: 'm_empire', name: 'Industrial Complex',
    text: 'One hundred machines, a quarter-million in the bank, and an autonomy core off the line.',
    goals: [{ kind: 'machines', count: 100 }, { kind: 'money', amount: 250000 }, { kind: 'produce', item: 'ai_core', count: 1 }],
    reward: { money: 100000, xp: 12000 }, req: ['m_robot'] },
];

export class Missions {
  constructor(game) {
    this.game = game;
    this.progress = {};          // missionId -> { goals:[n], done }
    this.done = new Set();
    this.counters = { produced: {}, built: {}, revenue: 0, hired: 0 };
    this.tracked = null;
    this.refresh();
  }

  get active() {
    return MISSIONS.filter((m) => !this.done.has(m.id) && (!m.req || m.req.every((r) => this.done.has(r))));
  }

  refresh() {
    for (const m of this.active) if (!this.progress[m.id]) this.progress[m.id] = { goals: m.goals.map(() => 0) };
    if (!this.tracked || this.done.has(this.tracked)) this.tracked = this.active[0]?.id || null;
  }

  goalProgress(m, gi) {
    const g = m.goals[gi];
    const c = this.counters;
    switch (g.kind) {
      case 'produce': return Math.min(g.count, c.produced[g.item] || 0);
      case 'build': return Math.min(g.count, c.built[g.type] || 0);
      case 'have': return Math.min(g.count, this.game.totalStored(g.item));
      case 'money': return Math.min(g.amount, this.game.money);
      case 'sell': return Math.min(g.amount, c.revenue);
      case 'tech': return this.game.research.unlocked.has(g.id) ? 1 : 0;
      case 'hire': return Math.min(g.count, this.game.employees.list.length);
      case 'power': return Math.min(g.amount, this.game.factory.stats.powerGen);
      case 'machines': return Math.min(g.count, this.game.factory.ents.filter((e) => e.kind === 'machine' || e.kind === 'miner').length);
      default: return 0;
    }
  }

  goalTarget(g) { return g.count ?? g.amount ?? 1; }

  goalDone(m, gi) { return this.goalProgress(m, gi) >= this.goalTarget(m.goals[gi]); }

  onEvent() { /* progress is polled; events only trigger a check */ this.check(); }

  check() {
    for (const m of this.active) {
      if (m.goals.every((_, i) => this.goalDone(m, i))) this.complete(m);
    }
  }

  complete(m) {
    if (this.done.has(m.id)) return;
    this.done.add(m.id);
    const r = m.reward || {};
    if (r.money) this.game.money += r.money;
    if (r.xp) this.game.player.addXp(r.xp);
    if (r.items) for (const [id, n] of Object.entries(r.items)) this.game.player.give(id, n);
    this.game.notify(`Mission complete: ${m.name}`, 'good');
    this.game.audio.play('mission');
    this.game.ui.showMissionComplete(m);
    this.refresh();
  }

  update(dt) {
    this.t = (this.t || 0) + dt;
    if (this.t > 1) { this.t = 0; this.check(); }
  }

  serialize() { return { d: [...this.done], c: this.counters, t: this.tracked }; }
  deserialize(s) {
    this.done = new Set(s.d || []);
    this.counters = s.c || this.counters;
    this.tracked = s.t || null;
    this.refresh();
  }
}
