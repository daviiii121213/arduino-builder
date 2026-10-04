import * as THREE from 'three';
import { GeometryBatcher } from './GeometryBatcher.js';

const LENS_COLORS = { red: 0xff2a1a, yellow: 0xffb21a, green: 0x2aff6a };
const CYCLE = { green: 9, yellow: 2.5, allRed: 1 };

/** Cosmetic signal cycle: the two road axes alternate green/yellow/red. */
export class TrafficLights {
  constructor(parent, heads) {
    this.time = 0;
    this.materials = {};
    const batcher = new GeometryBatcher();
    for (const axis of ['x', 'z']) {
      this.materials[axis] = {};
      for (const [name, color] of Object.entries(LENS_COLORS)) {
        this.materials[axis][name] = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color).multiplyScalar(0.25), emissive: color, emissiveIntensity: 0, roughness: 0.3,
        });
        this.materials[axis][name].userData.castShadow = false;
      }
    }
    const lens = new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12).rotateZ(Math.PI / 2);
    const order = ['red', 'yellow', 'green'];
    for (const head of heads) {
      for (const side of [-1, 1]) {
        order.forEach((name, i) => {
          const m = new THREE.Matrix4()
            .makeRotationY(head.rotY - Math.PI / 2)
            .setPosition(0, 0, 0);
          const offset = new THREE.Vector3(side * 0.19, 0.32 - i * 0.32, 0).applyMatrix4(m);
          m.setPosition(head.x + offset.x, head.y + offset.y, head.z + offset.z);
          batcher.add(this.materials[head.axis][name], lens, m);
        });
      }
    }
    batcher.build(parent, { castShadow: false, receiveShadow: false });
    this.apply();
  }

  stateFor(axis) {
    const half = CYCLE.green + CYCLE.yellow + CYCLE.allRed;
    let t = this.time % (half * 2);
    if (axis === 'z') t = (t + half) % (half * 2);
    if (t < CYCLE.green) return 'green';
    if (t < CYCLE.green + CYCLE.yellow) return 'yellow';
    return 'red';
  }

  apply() {
    for (const axis of ['x', 'z']) {
      const state = this.stateFor(axis);
      for (const name of Object.keys(LENS_COLORS)) {
        this.materials[axis][name].emissiveIntensity = name === state ? 2.2 : 0.02;
      }
    }
  }

  update(dt) {
    const before = this.stateFor('x') + this.stateFor('z');
    this.time += dt;
    if (this.stateFor('x') + this.stateFor('z') !== before) this.apply();
  }
}
