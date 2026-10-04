import * as THREE from 'three';
import { flameTexture } from '../world/Textures.js';

const MAX_FIRES = 4;
const FLAMES = 7;
const _p = new THREE.Vector3();
const UP = { x: 0, y: 1, z: 0 };

/**
 * Non-graphic vehicle fires: a small fixed pool of flickering flame sprites
 * (no lights, no particles beyond a few smoke puffs). At most MAX_FIRES burn
 * at once; extra wrecks just smoke.
 */
export class VehicleFire {
  constructor(scene, effects, audio) {
    this.effects = effects;
    this.audio = audio;
    this.slots = [];
    const tex = flameTexture();
    for (let i = 0; i < MAX_FIRES; i++) {
      const sprites = [];
      for (let k = 0; k < FLAMES; k++) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex, color: 0xffffff, depthWrite: false, transparent: true,
        }));
        s.visible = false;
        s.center.set(0.5, 0.1);
        scene.add(s);
        sprites.push({ sprite: s, phase: Math.random() * 10, x: (Math.random() - 0.5), z: (Math.random() - 0.5) });
      }
      this.slots.push({ vehicle: null, sprites, smoke: 0, intensity: 0 });
    }
  }

  /** Starts a fire on a vehicle; returns false when the pool is full. */
  ignite(vehicle) {
    const slot = this.slots.find((s) => !s.vehicle);
    if (!slot) return false;
    slot.vehicle = vehicle;
    slot.intensity = 0;
    for (const f of slot.sprites) f.sprite.visible = true;
    this.audio.play('ignite', vehicle.currPos);
    return true;
  }

  extinguish(vehicle) {
    const slot = this.slots.find((s) => s.vehicle === vehicle);
    if (!slot) return;
    slot.vehicle = null;
    for (const f of slot.sprites) f.sprite.visible = false;
  }

  get burning() {
    return this.slots.filter((s) => s.vehicle).map((s) => s.vehicle);
  }

  update(dt, listener) {
    const t = performance.now() / 1000;
    let loudness = 0;
    for (const slot of this.slots) {
      const v = slot.vehicle;
      if (!v) continue;
      if (v.disposed) {
        this.extinguish(v);
        continue;
      }
      const burn = v.damage.burnTime ?? 0;
      // Grows quickly, dies down over the last seconds.
      slot.intensity = Math.min(1, slot.intensity + dt * 0.8) * Math.min(1, burn / 4 + 0.15);
      const d = v.def;
      const m = v.model.root.matrixWorld;
      for (const f of slot.sprites) {
        // Flames over the engine bay and cabin.
        _p.set(f.x * d.width * 0.7, d.belt + 0.05, d.length * (0.18 + f.z * 0.55)).applyMatrix4(m);
        f.sprite.position.copy(_p);
        const flick = 0.75 + Math.sin(t * 11 + f.phase) * 0.15 + Math.sin(t * 23 + f.phase * 2) * 0.1;
        const h = (0.9 + Math.sin(f.phase) * 0.3) * slot.intensity * flick;
        f.sprite.scale.set(h * 0.75, h * 1.6, 1);
        f.sprite.material.opacity = 0.85 * slot.intensity;
      }
      slot.smoke -= dt;
      if (slot.smoke <= 0) {
        slot.smoke = 0.22;
        _p.set((Math.random() - 0.5) * d.width * 0.6, d.roof + 0.4, (Math.random() - 0.2) * d.length * 0.5).applyMatrix4(m);
        this.effects.puff(_p, UP, 0x2a2826, 0.9 + slot.intensity * 0.6, 2.2);
      }
      if (listener) loudness = Math.max(loudness, slot.intensity * (1 - Math.min(1, v.currPos.distanceTo(listener) / 35)));
    }
    this.audio.setFire?.(loudness);
  }
}
