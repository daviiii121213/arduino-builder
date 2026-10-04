import * as THREE from 'three';
import { NPC } from './NPC.js';
import { createRng } from '../core/math.js';

const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0xd9a57b, 0x6b4226, 0xa0663f, 0xb98563];
const SHIRT = [0x8a3b34, 0x2f5e72, 0xc9b38a, 0x4c6a46, 0xe6e1d6, 0x5b4a6e, 0xc87b3a, 0x34363a, 0x7a8c99, 0xa64d5c];
const PANTS = [0x2c3e5a, 0x3b4a66, 0x2a2a2c, 0x8a7a5c, 0x555b60, 0x5d4636];
const HAIR = [0x1c1410, 0x3b2a1e, 0x5a3e28, 0x8a6a40, 0x9a9590, 0x2a1d16];
const SHOES = [0x222222, 0x3b2a20, 0xe0ddd6, 0x5a4636];

/** Spawns and updates the civilian population. */
export class NPCManager {
  constructor({ physics, scene, audio, paths, count = 18 }) {
    this.physics = physics;
    this.audio = audio;
    this.rng = createRng(4242);
    const cc = physics.world.createCharacterController(0.02);
    cc.setUp({ x: 0, y: 1, z: 0 });
    cc.enableAutostep(0.4, 0.2, false);
    cc.enableSnapToGround(0.4);
    cc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    cc.setSlideEnabled(true);
    this.controller = cc;
    this.paths = paths;
    this.npcs = [];
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
      sleeves: r.chance(0.5) ? 'long' : 'short', scale: r.range(0.93, 1.06), build: r.range(0.92, 1.1),
    };
  }

  onGunshot(pos) {
    for (const npc of this.npcs) npc.onGunshot(pos);
  }

  /** Knocks down NPCs touched by a moving car. */
  checkVehicle(car) {
    const speed = Math.abs(car.speed);
    if (speed < 2.5) return;
    for (const npc of this.npcs) {
      if (!npc.canBeHit) continue;
      if (car.overlapsPoint(npc.currPos, npc.radius + 0.1, 0.0, 1.8)) {
        npc.hitByVehicle(speed, car.position);
      }
    }
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

  render(dt, alpha) {
    for (const npc of this.npcs) npc.render(dt, alpha);
  }
}
