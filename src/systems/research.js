// Research: labs (and early hand-research) generate points that unlock the tech tree.

import { TECHS, available } from '../data/research.js';

export class Research {
  constructor(game) {
    this.game = game;
    this.unlocked = new Set();
    this.points = 0;
    this.totalPoints = 0;
    this.current = null;         // tech id being researched
  }

  addPoints(n) {
    this.points += n;
    this.totalPoints += n;
    if (this.current) {
      const t = TECHS[this.current];
      if (t && this.points >= t.cost) this.finish(this.current);
    }
  }

  canStart(id) {
    const t = TECHS[id];
    return t && !this.unlocked.has(id) && t.req.every((r) => this.unlocked.has(r));
  }

  start(id) {
    if (!this.canStart(id)) return false;
    this.current = id;
    this.game.notify(`Researching ${TECHS[id].name}`, 'info');
    return true;
  }

  finish(id) {
    this.unlocked.add(id);
    this.points -= TECHS[id].cost;
    if (this.points < 0) this.points = 0;
    this.current = null;
    this.game.notify(`Technology unlocked: ${TECHS[id].name}`, 'good');
    this.game.audio.play('unlock');
    this.game.player.addXp(TECHS[id].cost * 0.35);
    this.game.player.addSkillXp('technology', TECHS[id].cost * 0.25);
    this.game.missions.onEvent('tech', { id });
  }

  progress() {
    if (!this.current) return 0;
    return Math.min(1, this.points / TECHS[this.current].cost);
  }

  available() { return available(this.unlocked); }

  serialize() { return { u: [...this.unlocked], p: this.points, c: this.current, t: this.totalPoints }; }
  deserialize(s) {
    this.unlocked = new Set(s.u || []); this.points = s.p || 0;
    this.current = s.c || null; this.totalPoints = s.t || 0;
  }
}
