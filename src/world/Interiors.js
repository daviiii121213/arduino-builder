import * as THREE from 'three';
import { Materials, nightMaterials } from './Materials.js';
import { signTexture } from './Textures.js';
import { CITY } from './CityLayout.js';

const Y = CITY.curbHeight;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

/**
 * Enterable buildings: a convenience store, a park café and a warehouse in a
 * fenced industrial yard. Shells are real walls with door openings, so the
 * player, NPCs, bullets and the camera all treat them as solid geometry.
 */
export class Interiors {
  constructor(city, interactables) {
    this.city = city;
    this.batcher = city.batcher;
    this.physics = city.physics;
    this.props = city.props;
    this.interactables = interactables;
  }

  /** Axis-aligned box from min/max corners, optionally solid. */
  block(mat, x0, y0, z0, x1, y1, z1, color, solid = true) {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    _m.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    this.batcher.add(mat, box(w, h, d), _m, color);
    if (solid) this.physics.addStaticBox((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, w / 2, h / 2, d / 2);
  }

  /**
   * Four walls with openings. `openings[side]` = [[from, to, height], ...] along
   * the wall (x for north/south, z for east/west). Exterior and interior faces
   * get different colours; the roof is a slab over the whole footprint.
   */
  shell({ x0, x1, z0, z1, height, t = 0.25, openings = {}, outMat = Materials.painted(), outColor, inColor = '#e9e4da', roofColor = '#5d5b58', floorMat, floorTile = 2 }) {
    const y0 = Y;
    const y1 = Y + height;
    const sides = {
      north: { fixed: z1, a0: x0, a1: x1, axis: 'x' },
      south: { fixed: z0, a0: x0, a1: x1, axis: 'x' },
      east: { fixed: x1, a0: z0, a1: z1, axis: 'z' },
      west: { fixed: x0, a0: z0, a1: z1, axis: 'z' },
    };
    for (const [name, s] of Object.entries(sides)) {
      const inward = name === 'north' || name === 'east' ? -1 : 1;
      const holes = (openings[name] ?? []).slice().sort((a, b) => a[0] - b[0]);
      const pieces = [];
      let a = s.a0;
      for (const [h0, h1, hh] of holes) {
        if (h0 > a) pieces.push([a, h0, y0, y1]);
        pieces.push([h0, h1, y0 + hh, y1]); // lintel above the opening
        a = h1;
      }
      if (a < s.a1) pieces.push([a, s.a1, y0, y1]);
      for (const [p0, p1, py0, py1] of pieces) {
        const outer = [s.fixed - (inward < 0 ? t : 0), s.fixed + (inward > 0 ? t : 0)];
        const inner = inward < 0 ? [outer[0] - 0.02, outer[0]] : [outer[1], outer[1] + 0.02];
        if (s.axis === 'x') {
          this.block(outMat, p0, py0, outer[0], p1, py1, outer[1], outColor);
          this.block(Materials.interior(), p0, py0, inner[0], p1, py1, inner[1], inColor, false);
        } else {
          this.block(outMat, outer[0], py0, p0, outer[1], py1, p1, outColor);
          this.block(Materials.interior(), inner[0], py0, p0, inner[1], py1, p1, inColor, false);
        }
      }
    }
    // Floor, ceiling and roof.
    if (floorMat) this.city.quad(floorMat, x0, z0, x1, z1, Y + 0.012, floorTile);
    this.block(Materials.interior(), x0, y1 - 0.12, z0, x1, y1 - 0.02, z1, '#efeae0', false);
    this.block(Materials.painted(), x0 - 0.15, y1, z0 - 0.15, x1 + 0.15, y1 + 0.25, z1 + 0.15, roofColor);
    this.physics.addStaticBox((x0 + x1) / 2, y1 + 0.1, (z0 + z1) / 2, (x1 - x0) / 2, 0.15, (z1 - z0) / 2);
  }

  lightPanels(x0, x1, z0, z1, y, stepX = 4, stepZ = 4) {
    for (let x = x0 + stepX / 2; x < x1; x += stepX) {
      for (let z = z0 + stepZ / 2; z < z1; z += stepZ) {
        _m.makeTranslation(x, y, z);
        this.batcher.add(Materials.lightPanel(), box(1.2, 0.04, 0.6), _m);
      }
    }
  }

  sign(text, bg, x, y, z, yaw, width = 4.2) {
    const mat = new THREE.MeshStandardMaterial({ map: signTexture(text, bg, '#f4ecd8'), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: signTexture(text, bg, '#f4ecd8') });
    nightMaterials.push([mat, 0.9]);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(1, 1, 1));
    this.batcher.add(mat, new THREE.PlaneGeometry(width, width * (96 / 512)), _m);
  }

  // ------------------------------------------------------------ convenience store

  /** Store on the parking lot's west edge, glass front facing east (+x). */
  store(x0, x1, z0, z1) {
    const doorZ = (z0 + z1) / 2;
    const h = 4.2;
    this.shell({
      x0, x1, z0, z1, height: h, outColor: '#9d988f', roofColor: '#4f4d4a',
      openings: { east: [[z0 + 0.6, doorZ - 1.2, 2.9], [doorZ - 1.1, doorZ + 1.1, 2.6], [doorZ + 1.2, z1 - 0.6, 2.9]] },
      floorMat: Materials.sidewalk(), floorTile: 1.2,
    });
    // Glass shopfront panes fill the large openings.
    for (const [a, b] of [[z0 + 0.6, doorZ - 1.2], [doorZ + 1.2, z1 - 0.6]]) {
      _m.makeTranslation(x1 - 0.12, Y + 0.3 + 1.3, (a + b) / 2);
      this.batcher.add(Materials.shopGlass(), box(0.05, 2.6, b - a), _m);
      this.block(Materials.painted(), x1 - 0.22, Y, a, x1, Y + 0.3, b, '#5a5752');
      this.physics.addStaticBox(x1 - 0.12, Y + 1.5, (a + b) / 2, 0.06, 1.5, (b - a) / 2);
    }
    // Signboard over the entrance.
    this.block(Materials.painted(), x1, Y + h - 0.9, z0 + 2, x1 + 0.2, Y + h - 0.05, z1 - 2, '#2f5e4a', false);
    this.sign('MERCADINHO BOA VISTA', '#2f5e4a', x1 + 0.21, Y + h - 0.47, doorZ, Math.PI / 2, 8);
    // Glass door hinged at the north jamb.
    this.interactables.add('door', {
      origin: new THREE.Vector3(x1 - 0.12, Y, doorZ + 1.1), yaw: Math.PI / 2, width: 2.2, height: 2.6, depth: 0.06, material: Materials.shopGlass(),
    });
    // Shelving aisles with stock.
    const rng = this.city.rng;
    const stock = ['#c94b3a', '#e0b23c', '#3e7cc0', '#4c9a5a', '#e9e4d8', '#b55d9c', '#f08a3c'];
    for (const z of [doorZ - 10, doorZ - 5.5, doorZ + 5.5, doorZ + 10]) {
      const sx0 = x0 + 2.5;
      const sx1 = x1 - 5;
      this.block(Materials.interior(), sx0, Y, z - 0.35, sx1, Y + 1.7, z + 0.35, '#d7d3cb');
      for (let level = 0; level < 3; level++) {
        for (let x = sx0 + 0.2; x < sx1 - 0.3; x += 0.42) {
          const c = rng.pick(stock);
          for (const side of [-1, 1]) {
            _m.makeTranslation(x + 0.15, Y + 0.32 + level * 0.52, z + side * 0.42);
            this.batcher.add(Materials.interior(), box(0.32, 0.36, 0.14), _m, c);
          }
        }
      }
    }
    // Fridges along the back wall.
    for (let z = z0 + 1.5; z < z1 - 1.5; z += 2.2) {
      this.block(Materials.interior(), x0 + 0.25, Y, z - 1, x0 + 1.05, Y + 2.2, z + 1, '#cfd4d8');
      _m.makeTranslation(x0 + 1.07, Y + 1.15, z);
      this.batcher.add(Materials.fridgeGlass(), box(0.02, 1.8, 1.8), _m);
    }
    // Checkout counter near the door.
    this.block(Materials.interior(), x1 - 3.4, Y, doorZ + 2.5, x1 - 1.9, Y + 1.0, doorZ + 6, '#7a5c43');
    _m.makeTranslation(x1 - 2.6, Y + 1.15, doorZ + 4.8);
    this.batcher.add(Materials.interior(), box(0.4, 0.3, 0.35), _m, '#2b2d30');
    this.lightPanels(x0 + 1, x1 - 1, z0 + 1, z1 - 1, Y + h - 0.15, 4.5, 5);
    // Shoppers browsing the central aisle.
    this.city.npcPaths.push({ loop: true, points: [{ x: x1 - 4, z: doorZ - 1.6 }, { x: x0 + 3, z: doorZ - 1.6 }, { x: x0 + 3, z: doorZ + 1.6 }, { x: x1 - 4, z: doorZ + 1.6 }], indoor: true });
  }

  // ------------------------------------------------------------ café

  /** Small café pavilion with a glass front facing east (+x). */
  cafe(x0, x1, z0, z1) {
    const doorZ = (z0 + z1) / 2;
    const h = 3.4;
    this.shell({
      x0, x1, z0, z1, height: h, outColor: '#c9b08a', roofColor: '#6b4a3a', inColor: '#f1e6d2',
      openings: { east: [[z0 + 0.5, doorZ - 0.9, 2.5], [doorZ - 0.8, doorZ + 0.8, 2.4], [doorZ + 0.9, z1 - 0.5, 2.5]], south: [[x0 + 1.5, x1 - 1.5, 2.5]] },
      floorMat: Materials.plaza(), floorTile: 1.5,
    });
    for (const [a, b] of [[z0 + 0.5, doorZ - 0.9], [doorZ + 0.9, z1 - 0.5]]) {
      this.block(Materials.painted(), x1 - 0.25, Y, a, x1, Y + 0.5, b, '#6b4a3a');
      _m.makeTranslation(x1 - 0.12, Y + 1.5, (a + b) / 2);
      this.batcher.add(Materials.shopGlass(), box(0.04, 2.0, b - a), _m);
      this.physics.addStaticBox(x1 - 0.12, Y + 1.3, (a + b) / 2, 0.06, 1.3, (b - a) / 2);
    }
    this.block(Materials.painted(), x0 + 1.5, Y, z0, x1 - 1.5, Y + 0.5, z0 + 0.25, '#6b4a3a');
    _m.makeTranslation((x0 + x1) / 2, Y + 1.5, z0 + 0.12);
    this.batcher.add(Materials.shopGlass(), box(x1 - x0 - 3, 2.0, 0.04), _m);
    this.physics.addStaticBox((x0 + x1) / 2, Y + 1.3, z0 + 0.12, (x1 - x0 - 3) / 2, 1.3, 0.06);
    // Awning and sign.
    _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.35);
    _m.compose(new THREE.Vector3(x1 + 0.6, Y + h - 0.45, doorZ), _q, new THREE.Vector3(1, 1, 1));
    this.batcher.add(Materials.painted(), box(1.4, 0.06, z1 - z0 - 0.6), _m, '#7c2f2a');
    this.sign('CAFÉ DA PRAÇA', '#7c2f2a', x1 + 0.03, Y + h - 0.2, doorZ, Math.PI / 2, 3.2);
    this.interactables.add('door', {
      origin: new THREE.Vector3(x1 - 0.12, Y, doorZ + 0.8), yaw: Math.PI / 2, width: 1.6, height: 2.4, depth: 0.06, material: Materials.shopGlass(),
    });
    // Counter with espresso machine along the back wall.
    this.block(Materials.interior(), x0 + 0.3, Y, z0 + 1, x0 + 1.2, Y + 1.05, z1 - 1, '#5b3d2a');
    _m.makeTranslation(x0 + 0.75, Y + 1.25, z0 + 2.2);
    this.batcher.add(Materials.interior(), box(0.5, 0.4, 0.5), _m, '#b8bcc0');
    // Tables with chairs.
    for (const [tx, tz] of [[x0 + 3.6, z0 + 2], [x0 + 3.6, z1 - 2], [x0 + 6.2, z0 + 2], [x0 + 6.2, z1 - 2]]) {
      this.block(Materials.interior(), tx - 0.05, Y, tz - 0.05, tx + 0.05, Y + 0.72, tz + 0.05, '#2f2f2f', false);
      this.block(Materials.interior(), tx - 0.45, Y + 0.72, tz - 0.45, tx + 0.45, Y + 0.78, tz + 0.45, '#8a6240');
      this.physics.addStaticBox(tx, Y + 0.4, tz, 0.45, 0.4, 0.45);
      for (const s of [-1, 1]) {
        this.block(Materials.interior(), tx - 0.2, Y, tz + s * 0.75 - 0.2, tx + 0.2, Y + 0.45, tz + s * 0.75 + 0.2, '#3e6b5a', false);
        this.block(Materials.interior(), tx - 0.2, Y + 0.45, tz + s * 0.95 - 0.03, tx + 0.2, Y + 0.95, tz + s * 0.95 + 0.03, '#3e6b5a', false);
      }
    }
    this.lightPanels(x0 + 1, x1 - 1, z0 + 1, z1 - 1, Y + h - 0.15, 3, 3);
    this.city.npcPaths.push({ loop: false, points: [{ x: x1 - 1.5, z: doorZ }, { x: x0 + 2, z: doorZ }], indoor: true });
  }

  // ------------------------------------------------------------ industrial yard

  industrial(b) {
    const p = this.props;
    const x0 = b.x0 + CITY.sidewalk;
    const x1 = b.x1 - CITY.sidewalk;
    const z0 = b.z0 + CITY.sidewalk;
    const z1 = b.z1 - CITY.sidewalk;
    const gate0 = x0 + 11;
    const gateW = 8;

    // Perimeter fence with a sliding gate on the street side (north).
    this.fence(x0, z1, gate0, z1);
    this.fence(gate0 + gateW, z1, x1, z1);
    this.fence(x0, z0, x1, z0);
    this.fence(x0, z0, x0, z1);
    this.fence(x1, z0, x1, z1);
    this.interactables.add('gate', {
      origin: new THREE.Vector3(gate0, Y, z1 - 0.15), yaw: 0, width: gateW, height: 2.2, depth: 0.06, material: Materials.fence(), uvTile: 2.2,
    });

    // Warehouse with a roll-up door facing the gate.
    const w = { x0: x0 + 5, x1: x0 + 33, z0: z0 + 5, z1: z0 + 27 };
    const doorX = gate0 + 1;
    this.shell({
      ...w, height: 7, t: 0.3, outMat: Materials.corrugated(), outColor: '#7f97a8', inColor: '#cfd2cf', roofColor: '#545a5f',
      openings: { north: [[doorX, doorX + 6, 4.6]] }, floorMat: Materials.concrete(), floorTile: 3,
    });
    this.interactables.add('rollup', {
      origin: new THREE.Vector3(doorX, Y, w.z1 - 0.15), yaw: 0, width: 6, height: 4.6, depth: 0.1, material: Materials.rollupDoor(), uvTile: 2,
    });
    this.block(Materials.painted(), doorX - 0.3, Y + 4.6, w.z1, doorX + 6.3, Y + 5.2, w.z1 + 0.4, '#d9a52b', false);
    // Pallet racks with stored goods.
    for (const rz of [w.z0 + 2, w.z0 + 6.5]) {
      for (let rx = w.x0 + 2; rx < w.x1 - 6; rx += 2.7) {
        for (const ox of [0, 2.6]) this.block(Materials.interior(), rx + ox, Y, rz - 0.6, rx + ox + 0.1, Y + 4.4, rz + 0.6, '#d9692a', false);
        for (const ly of [0.1, 1.6, 3.1]) {
          this.block(Materials.interior(), rx, Y + ly, rz - 0.6, rx + 2.7, Y + ly + 0.12, rz + 0.6, '#2f5d9a', false);
          if (this.city.rng.chance(0.75)) this.block(Materials.interior(), rx + 0.25, Y + ly + 0.12, rz - 0.5, rx + 2.4, Y + ly + 1.0, rz + 0.5, this.city.rng.pick(['#9a7650', '#b89a6a', '#5e7d4a', '#a24a3a']), false);
        }
        this.physics.addStaticBox(rx + 1.35, Y + 2.2, rz, 1.35, 2.2, 0.6);
      }
    }
    // Small site office in a corner and a forklift.
    this.block(Materials.painted(), w.x1 - 7, Y, w.z1 - 7, w.x1 - 0.3, Y + 2.8, w.z1 - 0.3, '#e0dccf');
    _m.makeTranslation(w.x1 - 7.02, Y + 1.7, w.z1 - 3.6);
    this.batcher.add(Materials.shopGlass(), box(0.04, 1.0, 3), _m);
    this.forklift(w.x0 + 9, w.z0 + 13);
    this.lightPanels(w.x0 + 1, w.x1 - 1, w.z0 + 1, w.z1 - 1, Y + 6.8, 6, 6);
    for (let i = 0; i < 6; i++) this.props.dynamicProps?.add('crate', doorX + 1 + (i % 3) * 0.9, Y + Math.floor(i / 3) * 0.71, w.z1 - 4 - (i % 2) * 0.2, 0);

    // Second warehouse (closed) and stacked shipping containers.
    const w2 = { x0: x1 - 15, x1: x1 - 3, z0: z0 + 3, z1: z0 + 23 };
    this.block(Materials.corrugated(), w2.x0, Y, w2.z0, w2.x1, Y + 8, w2.z1, '#b08a5a');
    this.block(Materials.painted(), w2.x0 - 0.2, Y + 8, w2.z0 - 0.2, w2.x1 + 0.2, Y + 8.3, w2.z1 + 0.2, '#4c4f52');
    const colors = ['#b5432f', '#2f6a8a', '#3d7a4a', '#c99a2e'];
    for (let i = 0; i < 4; i++) {
      const cz = z1 - 16 + i * 2.6;
      this.block(Materials.corrugated(), x1 - 9, Y, cz, x1 - 2.9, Y + 2.6, cz + 2.45, colors[i]);
      if (i % 2 === 0) this.block(Materials.corrugated(), x1 - 9, Y + 2.6, cz, x1 - 2.9, Y + 5.2, cz + 2.45, colors[(i + 1) % 4]);
    }
    // Loading area: cones and barriers, yard lighting.
    const dp = this.props.dynamicProps;
    if (dp) {
      for (let i = 0; i < 6; i++) dp.add('cone', doorX - 2 + i * 2, Y, w.z1 + 5);
      dp.add('barrier', doorX + 9, Y, w.z1 + 7, 0);
      dp.add('barrier', doorX + 11, Y, w.z1 + 7, 0);
    }
    p.streetLamp(x0 + 2, Y, z1 - 6, -Math.PI / 2);
    p.streetLamp(x1 - 12, Y, z1 - 3, Math.PI);
    p.utilityBox(x0 + 2, Y, z0 + 2, 0);
    // A worker walks the yard.
    this.city.npcPaths.push({ loop: true, points: [{ x: x0 + 8, z: z1 - 6 }, { x: x1 - 12, z: z1 - 6 }, { x: x1 - 12, z: z1 - 14 }, { x: x0 + 8, z: z1 - 14 }] });
  }

  fence(xa, za, xb, zb) {
    const len = Math.hypot(xb - xa, zb - za);
    if (len < 0.1) return;
    const h = 2.2;
    const along = xb - xa !== 0 ? 'x' : 'z';
    const g = new THREE.PlaneGeometry(len, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 2.2, (uv.getY(i) * h) / 2.2);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), along === 'x' ? 0 : Math.PI / 2);
    _m.compose(new THREE.Vector3((xa + xb) / 2, Y + h / 2, (za + zb) / 2), _q, new THREE.Vector3(1, 1, 1));
    this.batcher.add(Materials.fence(), g, _m);
    for (let t = 0; t <= len + 0.01; t += 3) {
      const x = along === 'x' ? xa + Math.sign(xb - xa) * t : xa;
      const z = along === 'z' ? za + Math.sign(zb - za) * t : za;
      _m.makeTranslation(x, Y + h / 2, z);
      this.batcher.add(Materials.metal(), box(0.08, h, 0.08), _m, '#3c4045');
    }
    if (along === 'x') this.physics.addStaticBox((xa + xb) / 2, Y + h / 2, za, len / 2, h / 2, 0.06);
    else this.physics.addStaticBox(xa, Y + h / 2, (za + zb) / 2, 0.06, h / 2, len / 2);
  }

  forklift(x, z) {
    this.block(Materials.interior(), x - 0.6, Y + 0.2, z - 1, x + 0.6, Y + 1.1, z + 0.6, '#e0b23c');
    this.block(Materials.interior(), x - 0.55, Y + 1.1, z - 0.6, x - 0.45, Y + 2.2, z + 0.3, '#2b2d30', false);
    this.block(Materials.interior(), x + 0.45, Y + 1.1, z - 0.6, x + 0.55, Y + 2.2, z + 0.3, '#2b2d30', false);
    this.block(Materials.interior(), x - 0.55, Y + 2.2, z - 0.6, x + 0.55, Y + 2.28, z + 0.3, '#2b2d30', false);
    this.block(Materials.interior(), x - 0.5, Y + 0.2, z + 0.6, x + 0.5, Y + 2.4, z + 0.75, '#3a3d40', false);
    this.block(Materials.interior(), x - 0.45, Y + 0.05, z + 0.75, x - 0.3, Y + 0.12, z + 1.9, '#3a3d40', false);
    this.block(Materials.interior(), x + 0.3, Y + 0.05, z + 0.75, x + 0.45, Y + 0.12, z + 1.9, '#3a3d40', false);
  }
}
