import { QueryGroups } from '../core/Physics.js';

/** Crimes: the minimum level they cause when seen by police, and what a civilian report causes. */
const CRIMES = {
  gunshot: { seen: 1, reported: 1, heat: 1 },
  assault: { seen: 2, reported: 1, heat: 4 },
  murder: { seen: 3, reported: 2, heat: 10, bump: true },
  theft: { seen: 1, reported: 0, heat: 2 },
  carjack: { seen: 2, reported: 1, heat: 4 },
  reckless: { seen: 1, reported: 1, heat: 3 },
  damagePolice: { seen: 2, reported: 2, heat: 5, policeKnows: true },
  assaultPolice: { seen: 3, reported: 3, heat: 10, policeKnows: true },
  killPolice: { seen: 4, reported: 4, heat: 20, bump: true, policeKnows: true },
};
const HEAT_PER_LEVEL = 25;
const HEARING = 70;
const WITNESS_RANGE = 30;

/**
 * Wanted level (0-5) and what the police know: crimes raise it when an
 * officer sees them or a civilian witness reports them; police track the
 * player by line of sight; the level decays only after contact is lost.
 */
export class WantedSystem {
  constructor({ physics, npcs, audio }) {
    this.physics = physics;
    this.npcs = npcs;
    this.audio = audio;
    this.level = 0;
    this.heat = 0;
    this.lastKnown = null; // {x, y, z}
    this.timeSinceSeen = 999;
    this.seenNow = false;
    this.identifiedVehicle = null; // vehicle the police saw the player in ('foot' when on foot)
    this.hostileTimer = 0; // > 0 while the player is shooting at / attacking people
    this.reports = [];
    this.hotspots = []; // recent places of suspicious activity: {x, z, t}
    this.officers = () => [];
    this.cars = () => [];
    this.onAlert = null; // (pos) police hear something and investigate
    this.hiddenTest = () => false; // is the player inside an interior?
    this.visibility = () => 1; // weather factor
  }

  get searching() {
    return this.level > 0 && this.timeSinceSeen > 3;
  }

  setLevel(level) {
    const prev = this.level;
    this.level = Math.max(0, Math.min(5, level));
    if (this.level > prev) this.heat = Math.max(this.heat, this.level * HEAT_PER_LEVEL * 0.5);
    if (this.level === 0) {
      this.heat = 0;
      this.lastKnown = null;
      this.identifiedVehicle = null;
    }
  }

  clear() {
    this.setLevel(0);
    this.hotspots.length = 0;
    this.reports.length = 0;
    this.hostileTimer = 0;
  }

  /**
   * Reports a crime by the player at `pos`. Police who see it react at once;
   * otherwise a civilian witness may phone it in a few seconds later.
   */
  crime(type, pos, player) {
    const c = CRIMES[type];
    if (!c) return;
    if (type === 'gunshot' || type === 'assault' || type === 'murder' || type.endsWith('Police')) this.hostileTimer = 6;
    // Officers within earshot of gunfire come to look.
    if ((type === 'gunshot' || type === 'murder') && this.onAlert?.(pos, HEARING)) this.addHotspot(pos);
    const seen = c.policeKnows || this.policeCanSee(pos, player);
    if (seen) {
      this.addHotspot(pos);
      this.raise(c.seen, c.heat, c.bump);
      this.spotted(player);
      return;
    }
    if (c.reported <= 0) return;
    const witness = this.npcs.npcs.find((n) => n.state !== 'dead' && !n.inactive && !n.isOfficer && n.currPos.distanceTo(pos) < WITNESS_RANGE);
    if (!witness) return;
    witness.onWitness?.(pos);
    this.reports.push({ t: 3 + Math.random() * 2, witness, level: c.reported, heat: c.heat * 0.5, pos: { x: pos.x, y: pos.y, z: pos.z } });
  }

  addHotspot(pos) {
    const last = this.hotspots[this.hotspots.length - 1];
    if (last && Math.hypot(last.x - pos.x, last.z - pos.z) < 12) {
      last.t = 0;
      return;
    }
    this.hotspots.push({ x: pos.x, z: pos.z, t: 0 });
    if (this.hotspots.length > 6) this.hotspots.shift();
  }

  /** Radius of the area police comb once they have lost the suspect, by wanted level. */
  get searchRadius() {
    return [0, 30, 45, 60, 75, 90][this.level];
  }

  /** Is the suspect currently lost (police working from the last known position)? */
  get lost() {
    return this.level > 0 && !!this.lastKnown && this.timeSinceSeen > 8;
  }

  /** A place to check: around the last known position, sometimes a recent hotspot. */
  searchPoint(rng = Math.random, radius = this.searchRadius) {
    let c = this.lastKnown;
    const recent = this.hotspots.filter((h) => h.t < 120);
    if (recent.length && rng() < 0.3) c = recent[Math.floor(rng() * recent.length)];
    if (!c) return null;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * radius;
    return { x: c.x + Math.cos(a) * r, y: 0, z: c.z + Math.sin(a) * r };
  }

  raise(minLevel, heat, bump = false) {
    const wasWanted = this.level > 0;
    this.heat += heat;
    let level = Math.max(this.level, minLevel, Math.floor(this.heat / HEAT_PER_LEVEL));
    if (bump && wasWanted) level = Math.max(level, this.level + 1);
    this.setLevel(level);
  }

  /** The player is seen by police right now. */
  spotted(player) {
    const p = player.position;
    this.lastKnown = { x: p.x, y: p.y, z: p.z };
    this.timeSinceSeen = 0;
    this.identifiedVehicle = player.vehicle ?? 'foot';
  }

  /** Can any officer or police car see `pos` (eye-level line of sight within range)? */
  policeCanSee(pos, player) {
    for (const o of this.officers()) if (o.alive && this.lineOfSight(o.eye(), pos, this.sightRange(o, player))) return true;
    for (const car of this.cars()) if (this.lineOfSight(car.eye(), pos, this.sightRange(null, player))) return true;
    return false;
  }

  sightRange(officer, player) {
    let range = 45 * this.visibility();
    if (this.hiddenTest(player.position)) range = 5;
    // A fresh car that the police have not seen the player in is harder to recognise.
    const vehicle = player.vehicle ?? 'foot';
    if (this.level > 0 && this.identifiedVehicle && vehicle !== this.identifiedVehicle && this.timeSinceSeen > 3) range = Math.min(range, 12);
    return range;
  }

  lineOfSight(from, to, range) {
    const dx = to.x - from.x;
    const dy = (to.y + 1.0) - from.y;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > range) return false;
    if (dist < 1) return true;
    const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
    const hit = this.physics.raycast(from, dir, dist - 0.4, QueryGroups.ground);
    return !hit;
  }

  /** Periodic detection pass (a few times per second, not every frame). */
  detect(player, officerFacingCheck) {
    if (!player.alive) return;
    const pos = player.position;
    let seen = false;
    for (const o of this.officers()) {
      o.canSeePlayer = o.alive && officerFacingCheck(o, pos) && this.lineOfSight(o.eye(), pos, this.sightRange(o, player));
      if (o.canSeePlayer) seen = true;
    }
    for (const car of this.cars()) if (this.lineOfSight(car.eye(), pos, this.sightRange(null, player) * 0.9)) seen = true;
    this.seenNow = seen;
    if (seen && this.level > 0) this.spotted(player);
  }

  update(dt, player) {
    this.hostileTimer = Math.max(0, this.hostileTimer - dt);
    for (const h of this.hotspots) h.t += dt;
    for (let i = this.reports.length - 1; i >= 0; i--) {
      const r = this.reports[i];
      r.t -= dt;
      if (r.t > 0) continue;
      this.reports.splice(i, 1);
      if (r.witness.state === 'dead') continue;
      // A phoned-in report gives the police an approximate location only.
      this.raise(r.level, r.heat);
      if (!this.lastKnown || this.timeSinceSeen > 5) {
        this.lastKnown = { x: r.pos.x + (Math.random() - 0.5) * 12, y: r.pos.y, z: r.pos.z + (Math.random() - 0.5) * 12 };
        this.timeSinceSeen = 4;
      }
      this.addHotspot(this.lastKnown ?? r.pos);
      this.audio.play('radio', null, 0.5);
    }
    if (this.level === 0) return;
    this.timeSinceSeen += dt * (this.hiddenTest(player.position) ? 1.6 : 1);
    // Lose one star at a time once the police have lost contact long enough.
    const threshold = 10 + this.level * 4;
    if (this.timeSinceSeen > threshold) {
      this.setLevel(this.level - 1);
      this.heat = Math.min(this.heat, this.level * HEAT_PER_LEVEL);
      this.timeSinceSeen = 4;
    }
  }
}
