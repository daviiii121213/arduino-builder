import * as THREE from 'three';
import { Materials } from './Materials.js';
import { GeometryBatcher } from './GeometryBatcher.js';
import { CITY } from './CityLayout.js';

const Y = CITY.curbHeight;
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

const COL = {
  steel: '#8a9096', yellow: '#e0b21e', concrete: '#b8b3a8', wood: '#9a7650', brick: '#a4553a', dark: '#2a2c2e',
  orange: '#f08a1c', sand: '#c9a86a', blue: '#2f6aa8', dirt: '#6a5038', white: '#efede6', rebar: '#5a4a3e',
};

function m4(x, y, z, ry = 0, rx = 0, rz = 0) {
  _e.set(rx, ry, rz, 'YXZ');
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
}

/** Look of construction workers: hi-vis vest and hard hat. */
export const WORKER_LOOK = {
  skin: 0xc68642, shirt: 0xf08a1c, pants: 0x2c3e5a, shoes: 0x3b2a20, hair: 0x2a1d16,
  hairStyle: 'cap', hat: 0xf2c12e, sleeves: 'short', scale: 1.02, build: 1.1,
};

/**
 * Construction areas: a building going up (concrete frame, scaffolding, fence,
 * tower crane, materials), road works that close one lane of a street (cones,
 * barriers, signs, an excavator, a trench) and a small manhole repair. Static
 * parts go into the city batcher; a few parts are animated (crane jib,
 * excavator, mixer drum). Workers are pedestrians with their own short routes.
 */
export class Construction {
  constructor(city) {
    this.city = city;
    this.batcher = city.batcher;
    this.physics = city.physics;
    this.props = city.props;
    this.dynamicProps = city.dynamicProps;
    this.breakables = city.breakables;
    this.animated = [];
    this.workerPaths = [];
    /** Lanes closed to traffic: node coordinates of the lane's ends. */
    this.roadClosures = [];
    this.noise = []; // {x, z, sound, timer}
  }

  box(w, h, d, x, y, z, color, ry = 0, rx = 0, rz = 0, mat = Materials.painted(), batcher = this.batcher) {
    batcher.add(mat, new THREE.BoxGeometry(w, h, d), m4(x, y, z, ry, rx, rz), color);
  }

  collider(w, h, d, x, y, z, ry = 0) {
    const c = this.physics.addStaticBox(x, y, z, w / 2, h / 2, d / 2);
    if (ry) c.setRotation(_q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry));
    return c;
  }

  /** Chain-link fence panel run from (x0,z0) to (x1,z1) with posts and a collider. */
  fence(x0, z0, x1, z1, h = 2.2) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const a = Math.atan2(x1 - x0, z1 - z0);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    const g = new THREE.PlaneGeometry(len, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 2, uv.getY(i) * h / 2);
    this.batcher.add(Materials.fence(), g, m4(mx, Y + h / 2, mz, a - Math.PI / 2));
    const posts = Math.max(2, Math.round(len / 2.5) + 1);
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      this.box(0.07, h, 0.07, x0 + (x1 - x0) * t, Y + h / 2, z0 + (z1 - z0) * t, COL.steel, 0, 0, 0, Materials.metal());
    }
    // Orange privacy band along the bottom.
    this.box(len, 0.6, 0.02, mx, Y + 0.45, mz, COL.orange, a - Math.PI / 2);
    this.collider(len, h, 0.12, mx, Y + h / 2, mz, a - Math.PI / 2);
  }

  // ------------------------------------------------------------ building site

  /** Unfinished building on a lot x0..x1, z0..z1 whose street front is at z1 (facing +z). */
  buildingSite({ x0, x1, z0, z1 }) {
    const levels = 4;
    const H = 3.2;
    const fx0 = x0 + 2;
    const fx1 = x1 - 6.5;
    const fz0 = z0 + 1;
    const fz1 = z1 - 4;
    const cols = [];
    const nx = Math.max(2, Math.round((fx1 - fx0) / 6.5));
    const nz = Math.max(2, Math.round((fz1 - fz0) / 5.5));
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) cols.push([fx0 + ((fx1 - fx0) * i) / nx, fz0 + ((fz1 - fz0) * k) / nz]);
    const cw = fx1 - fx0;
    const cd = fz1 - fz0;
    const cx = (fx0 + fx1) / 2;
    const cz = (fz0 + fz1) / 2;
    // Concrete columns: the top storey is only half done.
    cols.forEach(([x, z], n) => {
      const top = n % 3 === 0 ? levels * H : (levels - 1) * H + (n % 2 ? 1.4 : 0.2);
      this.box(0.42, top, 0.42, x, Y + top / 2, z, COL.concrete, 0, 0, 0, Materials.concrete());
      this.collider(0.42, top, 0.42, x, Y + top / 2, z);
      // Rebar sticking out of the unfinished tops.
      for (const [dx, dz] of [[-0.12, -0.12], [0.12, 0.12], [0.12, -0.12]]) this.box(0.03, 0.9, 0.03, x + dx, Y + top + 0.45, z + dz, COL.rebar);
    });
    // Floor slabs (the top one only partly cast).
    for (let k = 1; k < levels; k++) {
      const partial = k === levels - 1;
      const w = partial ? cw * 0.55 : cw + 0.6;
      const x = partial ? fx0 + w / 2 - 0.3 : cx;
      this.box(w, 0.26, cd + 0.6, x, Y + k * H, cz, COL.concrete, 0, 0, 0, Materials.concrete());
      this.collider(w, 0.26, cd + 0.6, x, Y + k * H, cz);
      // Formwork props under the newest slab.
      if (partial) for (let i = 0; i < 6; i++) this.box(0.08, H - 0.2, 0.08, fx0 + 1 + (i % 3) * (w - 2) / 2, Y + (k - 1) * H + H / 2, fz0 + 1.5 + Math.floor(i / 3) * (cd - 3), COL.wood);
    }
    // Scaffolding along the street face.
    const sz = fz1 + 0.9;
    const sx0 = fx0 - 0.4;
    const sx1 = fx1 + 0.4;
    const bays = Math.round((sx1 - sx0) / 2.4);
    for (let i = 0; i <= bays; i++) {
      const x = sx0 + ((sx1 - sx0) * i) / bays;
      for (const dz of [-0.4, 0.4]) this.box(0.05, levels * H - 0.6, 0.05, x, Y + (levels * H - 0.6) / 2, sz + dz, COL.steel, 0, 0, 0, Materials.metal());
      if (i < bays) this.box(0.035, 0.035, 2.9, (x + (sx1 - sx0) / bays / 2), Y + 3.5, sz + 0.4, COL.steel, Math.atan2(2.4, 3.2), 0, 0, Materials.metal());
    }
    for (let k = 1; k < levels; k++) {
      const y = Y + k * H - 0.1;
      for (const dz of [-0.4, 0.4]) this.box(sx1 - sx0, 0.05, 0.05, (sx0 + sx1) / 2, y + 1, sz + dz, COL.steel, 0, 0, 0, Materials.metal());
      this.box(sx1 - sx0, 0.05, 0.8, (sx0 + sx1) / 2, y, sz, COL.wood);
      // Safety netting on the outside.
      this.box(sx1 - sx0, 0.12, 0.02, (sx0 + sx1) / 2, y + 0.5, sz + 0.45, COL.orange);
    }
    this.collider(sx1 - sx0, levels * H, 1, (sx0 + sx1) / 2, Y + (levels * H) / 2, sz);
    // Site fence with a gate gap, and the hoarding sign.
    this.fence(x0 + 0.2, z1 - 0.3, x1 - 5.2, z1 - 0.3);
    this.fence(x1 - 1.2, z1 - 0.3, x1 - 0.2, z1 - 0.3);
    this.fence(x0 + 0.2, z0 + 0.3, x0 + 0.2, z1 - 0.3);
    this.box(3.2, 1.1, 0.06, x0 + 6, Y + 2.6, z1 - 0.25, COL.white);
    this.box(3.0, 0.32, 0.07, x0 + 6, Y + 2.85, z1 - 0.24, COL.orange);
    this.box(2.2, 0.12, 0.07, x0 + 6, Y + 2.45, z1 - 0.24, COL.dark);
    // Materials on site.
    const mx = x1 - 3.4;
    for (let i = 0; i < 2; i++) {
      this.box(1.1, 0.12, 1.1, mx, Y + 0.06, z0 + 3 + i * 1.6, COL.wood);
      this.box(1.0, 0.8, 1.0, mx, Y + 0.52, z0 + 3 + i * 1.6, COL.brick);
      this.collider(1.1, 0.95, 1.1, mx, Y + 0.48, z0 + 3 + i * 1.6);
    }
    for (let i = 0; i < 6; i++) this.box(0.04, 0.04, 5.5, mx - 0.4 + i * 0.09, Y + 0.12 + (i % 2) * 0.05, z0 + 8.5, COL.rebar);
    const sand = new THREE.ConeGeometry(1.4, 1.0, 9);
    this.batcher.add(Materials.painted(), sand, m4(mx, Y + 0.5, z1 - 6.5), COL.sand);
    // Portable toilet.
    this.box(1.1, 2.2, 1.1, x0 + 1.2, Y + 1.1, z0 + 1.6, COL.blue);
    this.collider(1.1, 2.2, 1.1, x0 + 1.2, Y + 1.1, z0 + 1.6);
    // Cement mixer with a turning drum.
    const mixX = x1 - 3.2;
    const mixZ = z1 - 3.2;
    this.box(1.4, 0.5, 0.9, mixX, Y + 0.45, mixZ, COL.orange);
    this.collider(1.6, 1.4, 1.0, mixX, Y + 0.7, mixZ);
    const drum = this.animatedGroup(mixX, Y + 1.15, mixZ, (g, dt) => (g.children[0].rotation.y += dt * 1.6));
    const drumInner = new THREE.Group();
    drum.add(drumInner);
    drumInner.rotation.z = 0.6;
    const db = new GeometryBatcher();
    db.add(Materials.painted(), new THREE.CylinderGeometry(0.35, 0.55, 0.9, 10), m4(0, 0, 0), COL.orange);
    db.add(Materials.painted(), new THREE.CylinderGeometry(0.2, 0.35, 0.3, 10), m4(0, 0.6, 0), COL.orange);
    db.add(Materials.painted(), new THREE.BoxGeometry(0.08, 0.95, 0.12), m4(0.45, 0, 0, 0, 0, 0.2), COL.dark);
    db.build(drumInner);
    // Tower crane.
    this.crane(x1 - 2.8, z0 + 3.2, 27);
    // Signs on the sidewalk and a worker route along the fence.
    this.breakables?.add('workSign', x0 + 10, Y, z1 + 1.2, 0);
    this.breakables?.add('workSign', x0 - 1.2, Y, z1 - 6, -Math.PI / 2);
    this.workerPaths.push({ loop: false, work: true, points: [{ x: fx0 + 1, z: z1 - 1.6 }, { x: fx1 - 1, z: z1 - 1.6 }] });
    this.workerPaths.push({ loop: false, work: true, points: [{ x: fx0 + 2.5, z: cz }, { x: fx1 - 2.5, z: cz }] });
    this.noise.push({ x: cx, z: cz, sound: 'jackhammer', timer: 3 });
    this.city.noParking.push({ x: (x0 + x1) / 2, z: z1 + 6, r: 9 });
  }

  /** Tower crane: static lattice mast; the jib slowly slews back and forth. */
  crane(x, z, height) {
    const s = 1.5;
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      this.box(0.14, height, 0.14, x + dx * s / 2, Y + height / 2, z + dz * s / 2, COL.yellow, 0, 0, 0, Materials.metal());
    }
    for (let y = 1.5; y < height - 1; y += 1.8) {
      for (const [ry, ox, oz] of [[0, 0, -s / 2], [0, 0, s / 2], [Math.PI / 2, -s / 2, 0], [Math.PI / 2, s / 2, 0]]) {
        this.box(s, 0.07, 0.07, x + ox, Y + y, z + oz, COL.yellow, ry, 0, 0, Materials.metal());
        this.box(Math.hypot(s, 1.8), 0.05, 0.05, x + ox, Y + y + 0.9, z + oz, COL.yellow, ry, 0, Math.atan2(1.8, s), Materials.metal());
      }
    }
    this.box(3, 0.8, 3, x, Y + 0.4, z, COL.concrete, 0, 0, 0, Materials.concrete());
    this.collider(s + 0.3, height, s + 0.3, x, Y + height / 2, z);
    let dir = 1;
    let hold = 0;
    const jib = this.animatedGroup(x, Y + height, z, (g, dt) => {
      if (hold > 0) {
        hold -= dt;
        return;
      }
      g.rotation.y += dir * dt * 0.06;
      if (Math.abs(g.rotation.y - 0.4) > 1.1) {
        dir = -Math.sign(g.rotation.y - 0.4);
        hold = 6 + Math.random() * 8;
      }
    });
    jib.rotation.y = 0.4;
    const b = new GeometryBatcher();
    const M = Materials.metal();
    b.add(Materials.painted(), new THREE.BoxGeometry(2.0, 2.2, 2.0), m4(0, 1.1, 0), COL.yellow);
    b.add(Materials.glass(), new THREE.BoxGeometry(1.2, 1.0, 0.05), m4(0.2, 1.4, 1.01));
    // Jib and counter-jib trusses.
    for (const [len, sign] of [[22, 1], [8, -1]]) {
      for (const dx of [-0.5, 0.5]) b.add(M, new THREE.BoxGeometry(0.1, 0.1, len), m4(dx, 2.4, sign * len / 2), COL.yellow);
      b.add(M, new THREE.BoxGeometry(0.1, 0.1, len), m4(0, 3.3, sign * len / 2), COL.yellow);
      for (let k = 1; k < len; k += 1.6) b.add(M, new THREE.BoxGeometry(1.0, 0.06, 0.06), m4(0, 2.4, sign * k), COL.yellow);
    }
    b.add(M, new THREE.BoxGeometry(0.12, 4.2, 0.12), m4(0, 4.4, 0), COL.yellow);
    b.add(M, new THREE.BoxGeometry(0.04, 0.04, 22), m4(0, 4.0, 10.5, 0, -0.1), COL.steel);
    for (let k = 0; k < 3; k++) b.add(Materials.concrete(), new THREE.BoxGeometry(1.6, 1.2, 0.9), m4(0, 1.8, -6.2 - k * 0.6), COL.concrete);
    // Trolley, cable and hook with a load of bricks.
    b.add(M, new THREE.BoxGeometry(0.9, 0.3, 0.9), m4(0, 2.2, 14), COL.dark);
    b.add(M, new THREE.BoxGeometry(0.03, 9, 0.03), m4(0, -2.4, 14), COL.dark);
    b.add(Materials.painted(), new THREE.BoxGeometry(1.0, 0.7, 1.0), m4(0, -7.2, 14), COL.brick);
    b.add(Materials.painted(), new THREE.BoxGeometry(1.1, 0.1, 1.1), m4(0, -7.6, 14), COL.wood);
    b.build(jib);
  }

  animatedGroup(x, y, z, update) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    this.city.group.add(g);
    this.animated.push({ group: g, update });
    return g;
  }

  // ------------------------------------------------------------ road works

  /**
   * Works on the westbound lane of the street along z = roadZ between x0 and
   * x1 (x0 < x1): the lane is closed, traffic is routed around.
   */
  roadWorks(roadZ, x0, x1, closure) {
    const coneZ = roadZ - 0.6;
    const curbZ = roadZ - CITY.roadHalf + 0.5;
    const dyn = this.dynamicProps;
    for (let x = x0 + 2; x <= x1 - 2; x += 2.6) dyn?.add('cone', x, 0, coneZ, 0);
    // Tapers guiding drivers back from the closed lane.
    for (let k = 1; k <= 4; k++) {
      dyn?.add('cone', x1 - 2 + k * 1.6, 0, coneZ - (k / 4) * (coneZ - curbZ - 0.3), 0);
      dyn?.add('cone', x0 + 2 - k * 1.4, 0, coneZ - (k / 4) * (coneZ - curbZ - 0.3), 0);
    }
    dyn?.add('barrier', x1 - 1, 0, roadZ - 2.0, Math.PI / 2);
    dyn?.add('barrier', x1 - 1, 0, roadZ - 3.8, Math.PI / 2);
    dyn?.add('barrier', x1 - 1, 0, roadZ - 5.6, Math.PI / 2);
    this.breakables?.add('workSign', x1 + 9, 0, curbZ + 0.4, Math.PI / 2);
    this.breakables?.add('workSign', x0 + 6, 0, curbZ + 0.4, Math.PI / 2);
    // Trench with a dirt pile and steel plates.
    const tx = (x0 + x1) / 2 + 5;
    const tz = roadZ - 3.6;
    this.box(6, 0.02, 1.6, tx, 0.012, tz, '#2a2724');
    this.box(6.4, 0.06, 0.15, tx, 0.03, tz - 0.85, COL.dirt);
    this.box(6.4, 0.06, 0.15, tx, 0.03, tz + 0.85, COL.dirt);
    const pile = new THREE.IcosahedronGeometry(1.2, 0);
    pile.scale(1.3, 0.55, 1);
    this.batcher.add(Materials.foliage(), pile, m4(tx + 5, 0.4, tz - 0.6), COL.dirt);
    this.collider(2.8, 0.9, 1.8, tx + 5, 0.4, tz - 0.6);
    this.box(1.6, 0.03, 1.2, tx - 4.5, 0.02, tz, '#5c6166', 0.1, 0, 0, Materials.metal());
    // Compressor on wheels.
    const cx = x0 + 9;
    this.box(1.6, 0.9, 1.0, cx, 0.75, tz - 1.2, COL.yellow);
    this.box(0.1, 0.5, 0.1, cx - 0.5, 1.4, tz - 1.2, COL.dark);
    for (const dz of [-0.55, 0.55]) this.box(0.5, 0.5, 0.15, cx, 0.25, tz - 1.2 + dz, COL.dark, 0, 0, Math.PI / 4);
    this.collider(1.7, 1.3, 1.2, cx, 0.65, tz - 1.2);
    // Small excavator: tracks fixed, upper body and arm turning.
    this.excavator(tx - 9, tz);
    this.workerPaths.push({ loop: false, work: true, points: [{ x: x0 + 5, z: roadZ - 2.2 }, { x: tx - 3, z: roadZ - 2.2 }] });
    this.workerPaths.push({ loop: false, work: true, points: [{ x: tx - 2.5, z: tz - 1.4 }, { x: tx + 2.5, z: tz - 1.4 }] });
    this.noise.push({ x: tx, z: tz, sound: 'jackhammer', timer: 1 });
    this.roadClosures.push(closure);
  }

  excavator(x, z) {
    this.box(2.6, 0.45, 0.5, x, 0.25, z - 0.75, COL.dark);
    this.box(2.6, 0.45, 0.5, x, 0.25, z + 0.75, COL.dark);
    this.collider(2.8, 1.8, 2.1, x, 0.9, z);
    let t = Math.random() * 10;
    const upper = this.animatedGroup(x, 0.5, z, (g, dt) => {
      t += dt;
      g.rotation.y = Math.PI / 2 + Math.sin(t * 0.35) * 0.7;
      g.children[1].rotation.x = -0.5 + Math.sin(t * 0.7) * 0.25;
    });
    const body = new GeometryBatcher();
    body.add(Materials.painted(), new THREE.BoxGeometry(1.7, 0.6, 1.9), m4(0, 0.35, -0.1), COL.yellow);
    body.add(Materials.painted(), new THREE.BoxGeometry(0.95, 1.0, 0.95), m4(-0.35, 1.15, 0.2), COL.yellow);
    body.add(Materials.glass(), new THREE.BoxGeometry(0.85, 0.6, 0.05), m4(-0.35, 1.3, 0.68));
    body.add(Materials.painted(), new THREE.BoxGeometry(1.6, 0.5, 0.5), m4(0, 0.6, -1.0), COL.dark);
    const bodyGroup = new THREE.Group();
    body.build(bodyGroup);
    upper.add(bodyGroup);
    const arm = new THREE.Group();
    arm.position.set(0.4, 0.7, 0.8);
    upper.add(arm);
    const a = new GeometryBatcher();
    a.add(Materials.painted(), new THREE.BoxGeometry(0.22, 0.25, 2.6), m4(0, 0.6, 1.1, 0, -0.5), COL.yellow);
    a.add(Materials.painted(), new THREE.BoxGeometry(0.18, 0.2, 1.8), m4(0, 0.6, 2.9, 0, 0.7), COL.yellow);
    a.add(Materials.painted(), new THREE.BoxGeometry(0.5, 0.35, 0.4), m4(0, -0.2, 3.5, 0, 0.4), COL.dark);
    a.build(arm);
  }

  /** Repair of a manhole in the parking strip: a ring of barriers, a sign and one worker. */
  manholeRepair(x, z, rotY) {
    const dyn = this.dynamicProps;
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    for (const [lx, lz, r] of [[0, 1.3, 0], [0, -1.3, 0], [1.6, 0, Math.PI / 2], [-1.6, 0, Math.PI / 2]]) {
      const [px, pz] = at(lx, lz);
      dyn?.add('barrier', px, 0, pz, rotY + r);
    }
    this.batcher.add(Materials.metal(), new THREE.CylinderGeometry(0.4, 0.4, 0.03, 14), m4(x, 0.015, z), '#3a3d40');
    const [sx, sz] = at(4, 0);
    this.breakables?.add('workSign', sx, 0, sz, rotY + Math.PI / 2);
    const [ax, az] = at(-1.0, 0.6);
    const [bx, bz] = at(1.0, 0.6);
    this.workerPaths.push({ loop: false, work: true, points: [{ x: ax, z: az }, { x: bx, z: bz }] });
    this.city.noParking.push({ x, z, r: 8 });
  }

  update(dt, listener, audio) {
    for (const a of this.animated) a.update(a.group, dt);
    for (const n of this.noise) {
      n.timer -= dt;
      if (n.timer > 0) continue;
      n.timer = 4 + Math.random() * 6;
      if (Math.hypot(n.x - listener.x, n.z - listener.z) < 60) audio.play(n.sound, { x: n.x, y: 1, z: n.z }, 0.8);
    }
  }
}
