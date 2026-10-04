import * as THREE from 'three';
import { Materials } from './Materials.js';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

function mat(x, y, z, rotY = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, rotY, rz, 'YXZ');
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.set(sx, sy, sz));
}

/** Offsets a local point (lx, lz) by a yaw rotation around (x, z). */
function rot(x, z, rotY, lx, lz) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

const quatY = (a) => {
  _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
  return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
};

const COLORS = {
  darkMetal: '#2c3033',
  bark: '#4a3a2c',
  wood: '#8a6240',
  binGreen: '#3c5446',
  hydrant: '#a8322b',
  hydrantCap: '#d8c060',
  stone: '#a7a39a',
  soil: '#3b2e24',
};

/**
 * Static street furniture. Visual geometry goes into the batcher; simple colliders
 * are registered for anything the player can bump into.
 */
export class PropFactory {
  constructor(batcher, physics, rng) {
    this.batcher = batcher;
    this.physics = physics;
    this.rng = rng;
    this.trafficLightHeads = [];
  }

  add(material, geometry, matrix, color) {
    this.batcher.add(material, geometry, matrix, color);
  }

  streetLamp(x, y, z, rotY) {
    const m = Materials.metal();
    const H = 6.2;
    this.add(m, new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), mat(x, y + 0.25, z), COLORS.darkMetal);
    this.add(m, new THREE.CylinderGeometry(0.07, 0.1, H, 8), mat(x, y + H / 2, z), COLORS.darkMetal);
    // Curved arm approximated by two segments reaching over the road.
    const [ax, az] = rot(x, z, rotY, 0, 0.7);
    this.add(m, new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), mat(ax, y + H - 0.05, az, rotY, Math.PI / 2 - 0.25), COLORS.darkMetal);
    const [hx, hz] = rot(x, z, rotY, 0, 1.45);
    this.add(m, new THREE.BoxGeometry(0.34, 0.16, 0.7), mat(hx, y + H + 0.1, hz, rotY), COLORS.darkMetal);
    this.add(Materials.emissiveWarm(), new THREE.BoxGeometry(0.26, 0.04, 0.6), mat(hx, y + H + 0.01, hz, rotY));
    this.physics.addStaticCylinder(x, y + H / 2, z, H / 2, 0.14);
  }

  tree(x, y, z, scale = 1, withPit = true) {
    const rng = this.rng;
    const trunkH = 2.9 * scale;
    this.add(Materials.painted(), new THREE.CylinderGeometry(0.13 * scale, 0.2 * scale, trunkH, 7), mat(x, y + trunkH / 2, z), COLORS.bark);
    // Branch stubs.
    for (let i = 0; i < 3; i++) {
      const a = rng.range(0, Math.PI * 2);
      this.add(Materials.painted(), new THREE.CylinderGeometry(0.05, 0.08, 1.1 * scale, 5),
        mat(x + Math.cos(a) * 0.3, y + trunkH * 0.85, z + Math.sin(a) * 0.3, -a, 0, 0.7), COLORS.bark);
    }
    const hueBase = rng.range(0.22, 0.3);
    const crownCount = rng.int(3, 5);
    for (let i = 0; i < crownCount; i++) {
      const r = rng.range(1.1, 1.6) * scale;
      const g = new THREE.IcosahedronGeometry(r, 1);
      const pos = g.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const n = 1 + (Math.sin(pos.getX(k) * 3.1 + pos.getY(k) * 2.3 + i) * 0.5 + 0.5) * 0.22;
        pos.setXYZ(k, pos.getX(k) * n, pos.getY(k) * n * 0.85, pos.getZ(k) * n);
      }
      g.computeVertexNormals();
      const a = (i / crownCount) * Math.PI * 2 + rng.range(-0.4, 0.4);
      const off = i === 0 ? 0 : rng.range(0.6, 1.1) * scale;
      const col = new THREE.Color().setHSL(hueBase + rng.range(-0.025, 0.025), rng.range(0.42, 0.58), rng.range(0.11, 0.18), THREE.SRGBColorSpace);
      this.add(Materials.foliage(), g, mat(x + Math.cos(a) * off, y + trunkH + rng.range(0.4, 1.4) * scale, z + Math.sin(a) * off), col);
    }
    if (withPit) {
      this.add(Materials.painted(), new THREE.BoxGeometry(1.4, 0.04, 1.4), mat(x, y + 0.02, z), COLORS.soil);
      for (const [dx, dz, w, d] of [[0, 0.72, 1.6, 0.12], [0, -0.72, 1.6, 0.12], [0.72, 0, 0.12, 1.4], [-0.72, 0, 0.12, 1.4]]) {
        this.add(Materials.painted(), new THREE.BoxGeometry(w, 0.08, d), mat(x + dx, y + 0.04, z + dz), '#7d7a74');
      }
    }
    this.physics.addStaticCylinder(x, y + trunkH / 2, z, trunkH / 2, 0.22 * scale);
  }

  bench(x, y, z, rotY) {
    const m = Materials.painted();
    for (const lx of [-0.75, 0.75]) {
      const [px, pz] = rot(x, z, rotY, lx, 0);
      this.add(Materials.metal(), new THREE.BoxGeometry(0.08, 0.45, 0.5), mat(px, y + 0.225, pz, rotY), COLORS.darkMetal);
      const [bx, bz] = rot(x, z, rotY, lx, -0.24);
      this.add(Materials.metal(), new THREE.BoxGeometry(0.08, 0.5, 0.06), mat(bx, y + 0.7, bz, rotY, -0.15), COLORS.darkMetal);
    }
    for (let i = 0; i < 3; i++) {
      const [sx, sz] = rot(x, z, rotY, 0, 0.16 - i * 0.16);
      this.add(m, new THREE.BoxGeometry(1.8, 0.05, 0.13), mat(sx, y + 0.47, sz, rotY), COLORS.wood);
    }
    for (let i = 0; i < 2; i++) {
      const [sx, sz] = rot(x, z, rotY, 0, -0.27);
      this.add(m, new THREE.BoxGeometry(1.8, 0.12, 0.04), mat(sx, y + 0.65 + i * 0.2, sz, rotY, -0.15), COLORS.wood);
    }
    this.physics.addStaticBox(x, y + 0.35, z, 0.9, 0.35, 0.3).setRotation(quatY(rotY));
  }

  trashBin(x, y, z) {
    this.add(Materials.painted(), new THREE.CylinderGeometry(0.3, 0.26, 0.9, 12), mat(x, y + 0.45, z), COLORS.binGreen);
    this.add(Materials.metal(), new THREE.CylinderGeometry(0.33, 0.33, 0.08, 12), mat(x, y + 0.92, z), COLORS.darkMetal);
    this.physics.addStaticCylinder(x, y + 0.48, z, 0.48, 0.32);
  }

  hydrant(x, y, z) {
    const m = Materials.painted();
    this.add(m, new THREE.CylinderGeometry(0.14, 0.17, 0.6, 10), mat(x, y + 0.3, z), COLORS.hydrant);
    this.add(m, new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(x, y + 0.6, z), COLORS.hydrantCap);
    this.add(m, new THREE.CylinderGeometry(0.06, 0.06, 0.42, 8), mat(x, y + 0.42, z, 0, 0, Math.PI / 2), COLORS.hydrant);
    this.physics.addStaticCylinder(x, y + 0.35, z, 0.35, 0.18);
  }

  bollard(x, y, z) {
    this.add(Materials.metal(), new THREE.CylinderGeometry(0.09, 0.11, 0.9, 8), mat(x, y + 0.45, z), COLORS.darkMetal);
    this.add(Materials.painted(), new THREE.CylinderGeometry(0.095, 0.095, 0.08, 8), mat(x, y + 0.75, z), '#d6b23a');
    this.physics.addStaticCylinder(x, y + 0.45, z, 0.45, 0.12);
  }

  planter(x, y, z, w, d) {
    this.add(Materials.concrete(), new THREE.BoxGeometry(w, 0.55, d), mat(x, y + 0.275, z), '#ffffff');
    this.add(Materials.painted(), new THREE.BoxGeometry(w - 0.2, 0.05, d - 0.2), mat(x, y + 0.55, z), COLORS.soil);
    const shrubs = Math.max(1, Math.round((w * d) / 1.2));
    for (let i = 0; i < shrubs; i++) {
      const sx = x + this.rng.range(-w / 2 + 0.4, w / 2 - 0.4);
      const sz = z + this.rng.range(-d / 2 + 0.4, d / 2 - 0.4);
      const col = new THREE.Color().setHSL(this.rng.range(0.24, 0.32), 0.45, this.rng.range(0.1, 0.16), THREE.SRGBColorSpace);
      this.add(Materials.foliage(), new THREE.IcosahedronGeometry(this.rng.range(0.35, 0.5), 0), mat(sx, y + 0.8, sz, this.rng.range(0, 3)), col);
    }
    this.physics.addStaticBox(x, y + 0.3, z, w / 2, 0.3, d / 2);
  }

  /** Traffic signal with an arm hanging over the road. Heads are tracked for the light cycle. */
  trafficLight(x, y, z, rotY, axis) {
    const m = Materials.metal();
    const H = 5.4;
    this.add(m, new THREE.CylinderGeometry(0.1, 0.13, H, 8), mat(x, y + H / 2, z), COLORS.darkMetal);
    const armLen = 4.2;
    const [ax, az] = rot(x, z, rotY, 0, armLen / 2);
    this.add(m, new THREE.CylinderGeometry(0.06, 0.07, armLen, 6), mat(ax, y + H - 0.2, az, rotY, Math.PI / 2), COLORS.darkMetal);
    const [hx, hz] = rot(x, z, rotY, 0, armLen - 0.3);
    this.add(m, new THREE.BoxGeometry(0.36, 1.05, 0.3), mat(hx, y + H - 0.85, hz, rotY), '#222527');
    // Visor-backed lamps, facing oncoming traffic (local -X side of the arm).
    const [fx, fz] = rot(hx, hz, rotY, 0, 0);
    this.trafficLightHeads.push({ x: fx, y: y + H - 0.85, z: fz, rotY: rotY + Math.PI / 2, axis });
    // Pedestrian button box on the pole.
    this.add(m, new THREE.BoxGeometry(0.12, 0.2, 0.1), mat(x, y + 1.1, z, rotY), '#c9a43a');
    this.physics.addStaticCylinder(x, y + H / 2, z, H / 2, 0.15);
  }

  busShelter(x, y, z, rotY) {
    const m = Materials.metal();
    const w = 4.2;
    const d = 1.6;
    for (const lx of [-w / 2 + 0.1, w / 2 - 0.1]) for (const lz of [-d / 2 + 0.1, d / 2 - 0.1]) {
      const [px, pz] = rot(x, z, rotY, lx, lz);
      this.add(m, new THREE.BoxGeometry(0.08, 2.5, 0.08), mat(px, y + 1.25, pz, rotY), '#3b4146');
    }
    const [rx, rz] = rot(x, z, rotY, 0, 0);
    this.add(Materials.painted(), new THREE.BoxGeometry(w + 0.3, 0.12, d + 0.3), mat(rx, y + 2.56, rz, rotY), '#3b4146');
    const [bx, bz] = rot(x, z, rotY, 0, -d / 2 + 0.08);
    this.add(Materials.glass(), new THREE.BoxGeometry(w - 0.2, 1.9, 0.04), mat(bx, y + 1.3, bz, rotY));
    const [ax, az] = rot(x, z, rotY, -w / 2 + 0.6, -d / 2 + 0.6);
    this.add(Materials.painted(), new THREE.BoxGeometry(1.0, 1.8, 0.12), mat(ax, y + 1.25, az, rotY + Math.PI / 2), '#d7d2c2');
    const [sx, sz] = rot(x, z, rotY, 0.6, -0.3);
    this.add(Materials.painted(), new THREE.BoxGeometry(2.2, 0.06, 0.4), mat(sx, y + 0.48, sz, rotY), COLORS.wood);
    const [cx, cz] = rot(x, z, rotY, 0, -d / 2 + 0.08);
    this.physics.addStaticBox(cx, y + 1.3, cz, w / 2, 1.3, 0.08).setRotation(quatY(rotY));
  }

  dumpster(x, y, z, rotY, color = '#2f5a48') {
    this.add(Materials.painted(), new THREE.BoxGeometry(1.9, 1.15, 1.1), mat(x, y + 0.65, z, rotY), color);
    this.add(Materials.painted(), new THREE.BoxGeometry(2.0, 0.08, 1.2), mat(x, y + 1.26, z, rotY, 0.08), '#1f2224');
    for (const lx of [-0.8, 0.8]) for (const lz of [-0.4, 0.4]) {
      const [wx, wz] = rot(x, z, rotY, lx, lz);
      this.add(Materials.painted(), new THREE.CylinderGeometry(0.07, 0.07, 0.08, 8), mat(wx, y + 0.07, wz, rotY, 0, Math.PI / 2), '#111');
    }
    this.physics.addStaticBox(x, y + 0.65, z, 0.95, 0.65, 0.55).setRotation(quatY(rotY));
  }

  crate(x, y, z, size, rotY) {
    this.add(Materials.painted(), new THREE.BoxGeometry(size, size, size), mat(x, y + size / 2, z, rotY), '#8b6b47');
    this.add(Materials.painted(), new THREE.BoxGeometry(size + 0.02, 0.06, size + 0.02), mat(x, y + size * 0.5, z, rotY), '#6f5237');
    this.physics.addStaticBox(x, y + size / 2, z, size / 2, size / 2, size / 2).setRotation(quatY(rotY));
  }

  utilityBox(x, y, z, rotY) {
    this.add(Materials.painted(), new THREE.BoxGeometry(0.9, 1.3, 0.5), mat(x, y + 0.65, z, rotY), '#7d8579');
    this.physics.addStaticBox(x, y + 0.65, z, 0.45, 0.65, 0.25).setRotation(quatY(rotY));
  }

  railing(x0, z0, x1, z1, y, height = 1.0) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = Math.atan2(x1 - x0, z1 - z0);
    const posts = Math.max(2, Math.round(len / 1.5) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      this.add(Materials.metal(), new THREE.CylinderGeometry(0.03, 0.03, height, 6), mat(x0 + (x1 - x0) * t, y + height / 2, z0 + (z1 - z0) * t), COLORS.darkMetal);
    }
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    this.add(Materials.metal(), new THREE.CylinderGeometry(0.035, 0.035, len, 6), mat(mx, y + height, mz, a, Math.PI / 2), COLORS.darkMetal);
    this.add(Materials.metal(), new THREE.CylinderGeometry(0.02, 0.02, len, 6), mat(mx, y + height * 0.5, mz, a, Math.PI / 2), COLORS.darkMetal);
    const q = quatY(a);
    this.physics.addStaticBox(mx, y + height / 2, mz, 0.05, height / 2 + 0.1, len / 2, q);
  }

  fountain(x, y, z) {
    const segs = 32;
    const rimG = new THREE.TorusGeometry(4.2, 0.3, 8, segs);
    rimG.rotateX(Math.PI / 2);
    this.add(Materials.painted(), rimG, mat(x, y + 0.55, z), COLORS.stone);
    this.add(Materials.painted(), new THREE.CylinderGeometry(4.45, 4.55, 0.55, segs, 1, true), mat(x, y + 0.275, z), COLORS.stone);
    this.add(Materials.water(), new THREE.CircleGeometry(4.1, segs).rotateX(-Math.PI / 2), mat(x, y + 0.4, z));
    this.add(Materials.painted(), new THREE.CylinderGeometry(0.5, 0.8, 1.6, 12), mat(x, y + 0.8, z), COLORS.stone);
    this.add(Materials.painted(), new THREE.CylinderGeometry(1.5, 0.6, 0.3, 16), mat(x, y + 1.7, z), COLORS.stone);
    this.add(Materials.painted(), new THREE.CylinderGeometry(0.25, 0.35, 0.9, 10), mat(x, y + 2.2, z), COLORS.stone);
    this.add(Materials.painted(), new THREE.SphereGeometry(0.35, 12, 8), mat(x, y + 2.75, z), COLORS.stone);
    this.physics.addStaticCylinder(x, y + 0.35, z, 0.35, 4.55);
    this.physics.addStaticCylinder(x, y + 1.3, z, 1.3, 0.8);
  }

  wheelStop(x, y, z, rotY) {
    this.add(Materials.concrete(), new THREE.BoxGeometry(1.8, 0.12, 0.25), mat(x, y + 0.06, z, rotY), '#ffffff');
  }

  kiosk(x, y, z, rotY) {
    this.add(Materials.painted(), new THREE.BoxGeometry(2.6, 2.4, 2.0), mat(x, y + 1.2, z, rotY), '#2e5a6e');
    this.add(Materials.painted(), new THREE.BoxGeometry(3.2, 0.15, 2.6), mat(x, y + 2.5, z, rotY), '#e4dccb');
    const [wx, wz] = rot(x, z, rotY, 0, 1.01);
    this.add(Materials.glass(), new THREE.BoxGeometry(1.8, 1.0, 0.02), mat(wx, y + 1.5, wz, rotY));
    const [cx, cz] = rot(x, z, rotY, 0, 1.2);
    this.add(Materials.painted(), new THREE.BoxGeometry(2.2, 0.08, 0.4), mat(cx, y + 1.0, cz, rotY), '#e4dccb');
    this.physics.addStaticBox(x, y + 1.2, z, 1.3, 1.2, 1.0).setRotation(quatY(rotY));
  }
}
