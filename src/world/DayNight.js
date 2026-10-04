import * as THREE from 'three';
import { GameConfig } from '../config.js';
import { Materials, nightMaterials } from './Materials.js';
import { glowTexture } from './Textures.js';
import { VehicleMaterials } from '../vehicle/VehicleModels.js';

/**
 * Advances the clock and drives everything that depends on it: environment
 * lighting, lit windows, street lamps (glow, light pools, a few real lights)
 * and vehicle lamp brightness.
 */
export class DayNight {
  constructor({ scene, environment, lampHeads }) {
    this.environment = environment;
    this.hour = GameConfig.startHour;
    this.lampHeads = lampHeads;

    // Light pools on the ground under every lamp: one instanced draw call.
    const poolMat = new THREE.MeshBasicMaterial({
      map: glowTexture(), color: 0xffc98a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.poolMat = poolMat;
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2), poolMat, lampHeads.length);
    const m = new THREE.Matrix4();
    lampHeads.forEach((p, i) => this.pools.setMatrixAt(i, m.makeTranslation(p.x, 0.2, p.z)));
    this.pools.frustumCulled = false;
    this.pools.renderOrder = 1;
    scene.add(this.pools);

    // A handful of real point lights follow the lamps nearest the camera.
    this.lights = [];
    for (let i = 0; i < GameConfig.lampLightCount; i++) {
      const l = new THREE.PointLight(0xffc98a, 0, 18, 1.6);
      scene.add(l);
      this.lights.push(l);
    }
    this.assignTimer = 0;
    // Headlight for whichever car the player drives.
    this.headlight = new THREE.SpotLight(0xfff1d6, 0, 45, 0.55, 0.5, 1.2);
    // Always in the scene (a constant light count avoids shader recompiles); moved onto the car.
    scene.add(this.headlight, this.headlight.target);
    this.environment.setTime(this.hour);
  }

  get night() {
    return this.environment.night;
  }

  update(dt, cameraPos, playerVehicle) {
    this.hour = (this.hour + (dt * 24) / (GameConfig.dayLengthMinutes * 60)) % 24;
    this.environment.setTime(this.hour);
    const n = this.night;

    for (const [material, max] of nightMaterials) material.emissiveIntensity = n * max;
    Materials.emissiveWarm().emissiveIntensity = 0.3 + n * 3;
    this.poolMat.opacity = n * 0.55;
    this.pools.visible = n > 0.02;
    VehicleMaterials.headOn.emissiveIntensity = 0.6 + n * 2.4;
    VehicleMaterials.beam.opacity = n * 0.35;

    this.assignTimer -= dt;
    if (this.assignTimer <= 0) {
      this.assignTimer = 0.3;
      const sorted = this.lampHeads
        .map((p) => ({ p, d: p.distanceToSquared(cameraPos) }))
        .sort((a, b) => a.d - b.d);
      this.lights.forEach((l, i) => sorted[i] && l.position.copy(sorted[i].p).add({ x: 0, y: -0.3, z: 0 }));
    }
    for (const l of this.lights) l.intensity = n * 14;

    if (playerVehicle) {
      const L = playerVehicle.def.length / 2;
      const m = playerVehicle.model.root.matrixWorld;
      this.headlight.position.set(0, 0.8, L).applyMatrix4(m);
      this.headlight.target.position.set(0, 0, L + 12).applyMatrix4(m);
      this.headlight.target.updateMatrixWorld();
    }
    this.headlight.intensity = playerVehicle?.lightsOn ? Math.max(n, 0.35) * 60 : 0;
  }

  /** "HH:MM" for display/debugging. */
  clock() {
    const h = Math.floor(this.hour);
    const m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
