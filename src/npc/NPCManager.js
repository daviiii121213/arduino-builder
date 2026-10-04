import * as THREE from 'three';
import { NPC } from './NPC.js';
import { createRng } from '../core/math.js';
import { HAIR_STYLES } from '../characters/CharacterRig.js';
import { GameConfig } from '../config.js';

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
    this.audio = audio;
    this.rng = createRng(4242);
    const cc = physics.world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.enableAutostep(0.4, 0.2, false);
    cc.enableSnapToGround(0.4);
    cc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    cc.setSlideEnabled(true);
    cc.setApplyImpulsesToDynamicBodies(false);
    this.controller = cc;
    this.paths = paths;
    this.npcs = [];
    this.chatterTimer = 3;
    // Interleave paths so NPCs are spread over the whole map.
    for (let i = 0; i < count; i++) {
      const path = paths[(i * 7) % paths.length];
      this.npcs.push(new NPC({ physics, scene, audio, controller: cc, path, rng: this.rng, look: this.randomLook() }));
    }
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
  adoptDriver(rig, pos, threatPos) {
    let slot = null;
    let far = -1;
    for (const npc of this.npcs) {
      const d = npc.currPos.distanceTo(threatPos);
      if (d > far) {
        far = d;
        slot = npc;
      }
    }
    if (!slot) return;
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
    slot.onDanger(threatPos, 1e6, 8);
    this.audio.play('yelp', pos, 1);
  }

  /** Pedestrians get out of the way of cars heading at them; contact knocks them down. */
  checkVehicles(vehicles) {
    for (const car of vehicles) {
      const speed = Math.abs(car.speed);
      if (speed < 2.5 || car.disposed) continue;
      for (const npc of this.npcs) {
        if (!npc.canBeHit) continue;
        const p = npc.currPos;
        if (Math.abs(p.x - car.currPos.x) > 14 || Math.abs(p.z - car.currPos.z) > 14) continue;
        if (car.overlapsPoint(p, npc.radius + 0.05, 1.8)) {
          npc.hitByVehicle(speed, car.currPos);
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
      if (npc.state === 'dead') continue;
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
