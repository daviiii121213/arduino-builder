import * as THREE from 'three';
import { NPC } from './NPC.js';
import { createRng } from '../core/math.js';
import { HAIR_STYLES, CharacterRig } from '../characters/CharacterRig.js';
import { CITY } from '../world/CityLayout.js';
import { GameConfig } from '../config.js';
import { WORKER_LOOK } from '../world/Construction.js';

const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xd9a57b, 0x6b4226, 0xa0663f, 0xb98563];
const SHIRT = [0x8a3b34, 0x2f5e72, 0xc9b38a, 0x4c6a46, 0xe6e1d6, 0x5b4a6e, 0xc87b3a, 0x34363a, 0x7a8c99, 0xa64d5c, 0x3e8f86, 0xe0b23c];
const PANTS = [0x2c3e5a, 0x3b4a66, 0x2a2a2c, 0x8a7a5c, 0x555b60, 0x5d4636, 0x6a3b3b];
const HAIR = [0x1c1410, 0x3b2a1e, 0x5a3e28, 0x8a6a40, 0x9a9590, 0x2a1d16, 0xb8853f];
const HATS = [0x2f4f7a, 0x8a2f2f, 0x3d6b46, 0xd9a440, 0x222222];
const SHOES = [0x222222, 0x3b2a20, 0xe0ddd6, 0x5a4636];

/** Spawns and updates the civilian population. */
export class NPCManager {
  constructor({ physics, scene, audio, paths, count = GameConfig.pedestrianCount }) {
    this.physics = physics;
    this.scene = scene;
    this.audio = audio;
    this.rng = createRng(4242);
    const cc = physics.world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.enableAutostep(0.4, 0.1, false);
    cc.enableSnapToGround(0.4);
    cc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    cc.setSlideEnabled(true);
    cc.setApplyImpulsesToDynamicBodies(true);
    cc.setCharacterMass(55);
    this.controller = cc;
    this.paths = paths;
    this.npcs = [];
    this.chatterTimer = 3;
    // Interleave paths so NPCs are spread over the whole map.
    for (let i = 0; i < count; i++) {
      const path = paths[(i * 7) % paths.length];
      const npc = new NPC({ physics, scene, audio, controller: cc, path, rng: this.rng, look: this.randomLook() });
      npc.onWaypoint = (n) => this.maybeCross(n);
      this.npcs.push(npc);
    }
    this.buildCrossings();
    this.vehicles = null; // set by the game, used to check for oncoming cars
  }

  /**
   * Links between sidewalk loops across each road at the crosswalks: a block
   * corner and the facing corner of the neighbouring block.
   */
  buildCrossings() {
    const span = 2 * 2 + 2 * CITY.roadHalf;
    this.crossings = new Map();
    const loops = this.paths.filter((p) => p.loop && p.points.length === 4 && !p.indoor);
    for (const path of loops) {
      const links = path.points.map(() => []);
      path.points.forEach((pt, i) => {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tx = pt.x + dx * span;
          const tz = pt.z + dz * span;
          for (const other of loops) {
            if (other === path) continue;
            const j = other.points.findIndex((q) => Math.hypot(q.x - tx, q.z - tz) < 1);
            if (j >= 0) links[i].push({ path: other, index: j, to: other.points[j] });
          }
        }
      });
      this.crossings.set(path, links);
    }
  }

  /** A construction worker pacing a short route on a site. */
  addWorker(path) {
    const npc = new NPC({ physics: this.physics, scene: this.scene, audio: this.audio, controller: this.controller, path, rng: this.rng, look: WORKER_LOOK });
    npc.worker = true;
    npc.walkSpeed = 0.9;
    this.npcs.push(npc);
    return npc;
  }

  /** Civilians (not workers) currently in the world. */
  get activeCount() {
    let n = 0;
    for (const npc of this.npcs) if (!npc.worker && !npc.inactive) n++;
    return n;
  }

  /**
   * Population cycle: brings the number of civilians toward `fraction` of the
   * full population, one at a time and only out of the player's surroundings.
   */
  setDensity(fraction, playerPos) {
    const civilians = this.npcs.filter((n) => !n.worker);
    const desired = Math.max(3, Math.round(civilians.length * fraction));
    const active = this.activeCount;
    if (active > desired) {
      const npc = civilians.find((n) => !n.inactive && n.state === 'walk' && n.currPos.distanceTo(playerPos) > 50);
      npc?.deactivate();
    } else if (active < desired) {
      const npc = civilians.find((n) => n.inactive);
      if (npc) {
        npc.activate();
        this.respawn(npc, playerPos);
      }
    }
  }

  /** At a block corner, sometimes cross to the next block over the crosswalk. */
  maybeCross(npc) {
    if (npc.state !== 'walk' || npc.legInjury > 0 || !this.rng.chance(0.35)) return false;
    const links = this.crossings.get(npc.path)?.[npc.target];
    if (!links?.length) return false;
    const link = this.rng.pick(links);
    // Wait for a gap: skip the crossing if a moving car is close to the crosswalk.
    const mx = (npc.currPos.x + link.to.x) / 2;
    const mz = (npc.currPos.z + link.to.z) / 2;
    for (const v of this.vehicles?.list ?? []) {
      if (Math.abs(v.speed) > 3 && Math.hypot(v.currPos.x - mx, v.currPos.z - mz) < 9) return false;
    }
    npc.goTo(link.to, (n) => {
      n.path = link.path;
      n.target = link.index;
      n.direction = this.rng.chance(0.5) ? 1 : -1;
      n.advanceTarget();
    });
    return true;
  }

  /** Gives an NPC a fresh look and sends it back into the city far from the player. */
  recycle(npc, playerPos) {
    npc.setRig(new CharacterRig(this.randomLook()), false);
    this.respawn(npc, playerPos);
  }

  randomLook() {
    const r = this.rng;
    return {
      skin: r.pick(SKIN), shirt: r.pick(SHIRT), pants: r.pick(PANTS), hair: r.pick(HAIR), shoes: r.pick(SHOES),
      hairStyle: r.pick(HAIR_STYLES), hat: r.pick(HATS),
      sleeves: r.chance(0.5) ? 'long' : 'short', scale: r.range(0.9, 1.08), build: r.range(0.88, 1.15),
    };
  }

  onGunshot(pos) {
    for (const npc of this.npcs) npc.onGunshot(pos);
  }

  /** Bystanders near a carjacking run off; one of them shouts. */
  onTheft(pos) {
    let shouted = false;
    for (const npc of this.npcs) {
      if (npc.onDanger(pos, 20, 6) && !shouted) {
        this.audio.play('yelp', npc.currPos, 0.7);
        shouted = true;
      }
    }
  }

  /**
   * An evicted driver becomes a fleeing pedestrian. To keep the population
   * constant, the pedestrian farthest from the player hands over its slot.
   */
  adoptDriver(rig, pos, threatPos, { dead = false, calm = false } = {}) {
    let slot = this.npcs.find((n) => n.inactive && !n.worker) ?? null;
    let far = slot ? Infinity : -1;
    if (slot) slot.activate();
    const ref = threatPos ?? pos;
    for (const npc of this.npcs) {
      if (npc.worker || npc.inactive) continue;
      const d = npc.currPos.distanceTo(ref);
      if (d > far) {
        far = d;
        slot = npc;
      }
    }
    if (!slot) return null;
    slot.setRig(rig);
    // Join the nearest walking route.
    let best = null;
    let bestD = Infinity;
    for (const path of this.paths) {
      path.points.forEach((p, i) => {
        const d = Math.hypot(p.x - pos.x, p.z - pos.z);
        if (d < bestD) {
          bestD = d;
          best = { path, i };
        }
      });
    }
    slot.path = best.path;
    slot.placeOnPath(best.i, 1);
    slot.teleport(pos.x, pos.y, pos.z);
    slot.state = 'walk';
    rig.slumped = false;
    if (dead) {
      slot.die(true);
      rig.fallBlend = 1;
      return slot;
    }
    if (calm || !threatPos) return slot;
    slot.onDanger(threatPos, 1e6, 8);
    this.audio.play('yelp', pos, 1);
    return slot;
  }

  /** Pedestrians get out of the way of cars heading at them; contact knocks them down. */
  checkVehicles(vehicles, people = this.npcs, onHit = null) {
    for (const car of vehicles) {
      const speed = Math.abs(car.speed);
      if (speed < 2.5 || car.disposed) continue;
      for (const npc of people) {
        if (!npc.canBeHit) continue;
        const p = npc.currPos;
        if (Math.abs(p.x - car.currPos.x) > 14 || Math.abs(p.z - car.currPos.z) > 14) continue;
        if (car.overlapsPoint(p, npc.radius + 0.05, 1.8)) {
          npc.hitByVehicle(speed, car.currPos);
          onHit?.(car, npc);
          continue;
        }
        // Danger zone ahead of (or behind, when reversing) the car.
        const local = car.toLocal(p);
        const ahead = Math.sign(car.speed) * local.z;
        if (ahead > 0 && ahead < car.halfExtents.z + speed * 0.9 && Math.abs(local.x) < car.halfExtents.x + 1.2) {
          if (npc.onDanger(car.currPos, 30, 2.5) && Math.random() < 0.3) this.audio.play('yelp', p, 0.5);
        }
      }
    }
  }

  /** Obstacles traffic must stop for. */
  obstacles(out) {
    for (const npc of this.npcs) {
      if (npc.state === 'dead' || npc.inactive) continue;
      out.push({ x: npc.currPos.x, z: npc.currPos.z, r: npc.radius });
    }
    return out;
  }

  fixedUpdate(dt, playerPos) {
    for (const npc of this.npcs) {
      npc.fixedUpdate(dt);
      if (npc.respawnRequested) this.respawn(npc, playerPos);
    }
  }

  respawn(npc, playerPos) {
    npc.respawnRequested = false;
    if (npc.worker) {
      npc.placeOnPath(0, 1);
      return;
    }
    // Reappear somewhere out of the player's immediate surroundings.
    for (let attempt = 0; attempt < 12; attempt++) {
      const path = this.rng.pick(this.paths);
      const idx = this.rng.int(0, path.points.length - 1);
      const p = path.points[idx];
      if (Math.hypot(p.x - playerPos.x, p.z - playerPos.z) > 45 || attempt === 11) {
        npc.path = path;
        npc.placeOnPath(idx, this.rng.chance(0.5) ? 1 : -1);
        return;
      }
    }
  }

  render(dt, alpha, cameraPos) {
    let nearest = null;
    let nearestD = Infinity;
    for (const npc of this.npcs) {
      const d = npc.currPos.distanceTo(cameraPos);
      npc.render(dt, alpha, d > 55);
      if (npc.state === 'walk' && d < nearestD) {
        nearestD = d;
        nearest = npc;
      }
    }
    // Occasional murmur from someone nearby.
    this.chatterTimer -= dt;
    if (this.chatterTimer <= 0) {
      this.chatterTimer = 4 + Math.random() * 7;
      if (nearest && nearestD < 14) this.audio.play('chatter', nearest.currPos);
    }
  }
}
