import * as THREE from 'three';
import { Materials } from './Materials.js';
import { CITY, RING_OUTER } from './CityLayout.js';
import { boxParts, translation } from './GeometryBatcher.js';

const Y = CITY.curbHeight;
const SW = CITY.sidewalk;
const RESIDENTIAL = ['brickRed', 'brickBrown', 'plasterCream', 'plasterSage', 'plasterTerracotta', 'stoneBeige'];
const COMMERCIAL = ['concreteGray', 'stoneBeige', 'brickBrown', 'plasterCream'];
const SHOPS = ['cafe', 'market', 'boutique', 'bakery', 'service'];

/** Splits `length` into widths between min and max (optionally leaving one alley gap). */
function splitRow(rng, length, min, max, alley = 0) {
  const parts = [];
  let remaining = length - alley;
  while (remaining > max) {
    const w = rng.range(min, Math.min(max, remaining - min));
    parts.push(w);
    remaining -= w;
  }
  parts.push(remaining);
  if (alley) parts.splice(rng.int(1, Math.max(1, parts.length - 1)), 0, -alley);
  return parts;
}

/** Content builders for each kind of city block. */
export class BlockBuilders {
  constructor(city) {
    this.city = city;
    this.rng = city.rng;
    this.props = city.props;
    this.factory = city.buildings;
    this.batcher = city.batcher;
    this.physics = city.physics;
  }

  /** Perimeter of mid-rise buildings with an inner service courtyard. */
  buildings(b, ix, iz) {
    const rng = this.rng;
    const x0 = b.x0 + SW;
    const x1 = b.x1 - SW;
    const z0 = b.z0 + SW;
    const z1 = b.z1 - SW;
    const tall = (ix + iz) % 2 === 0;
    const floorsFor = () => (tall ? rng.int(5, 11) : rng.int(3, 7));
    const dN = rng.range(13, 17);
    const dS = rng.range(13, 17);

    const row = (axis, from, to, frontEdge, depth, rotY, alley, shopChance) => {
      let a = from;
      for (const seg of splitRow(rng, to - from, 9, 17, alley)) {
        if (seg < 0) {
          a += -seg;
          continue;
        }
        const dd = depth - rng.range(0, 1.5);
        const center = a + seg / 2;
        const depthCenter = frontEdge - Math.sign(frontEdge - (axis === 'x' ? (z0 + z1) / 2 : (x0 + x1) / 2)) * (dd / 2);
        const [x, z] = axis === 'x' ? [center, depthCenter] : [depthCenter, center];
        this.factory.build({
          x, z, w: seg - 0.02, d: dd, rotY,
          floors: floorsFor(),
          style: rng.pick(tall ? COMMERCIAL.concat(['glassOffice']) : RESIDENTIAL),
          storefront: rng.chance(shopChance) ? rng.pick(SHOPS) : null,
        });
        a += seg;
      }
    };
    row('x', x0, x1, z1, dN, 0, rng.chance(0.5) ? 4 : 0, 0.75);
    row('x', x0, x1, z0, dS, Math.PI, rng.chance(0.5) ? 4 : 0, 0.75);
    row('z', z0 + dS, z1 - dN, x1, 13, Math.PI / 2, 0, 0.5);
    row('z', z0 + dS, z1 - dN, x0, 13, -Math.PI / 2, 0, 0.5);

    // Service courtyard clutter.
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    this.props.dumpster(cx - 4, Y, cz + 2, rng.range(-0.3, 0.3));
    this.props.dumpster(cx + 3, Y, cz - 3, Math.PI / 2, '#4f5a63');
    this.props.crate(cx + 5, Y, cz + 4, 0.9, 0.3);
    this.props.crate(cx + 5.2, Y + 0.9, cz + 4.1, 0.7, 0.9);
    this.props.utilityBox(cx - 6, Y, cz - 4, 0);
    this.props.tree(cx, Y, cz + 6, 0.9, true);
  }

  park(b) {
    const p = this.props;
    const rng = this.rng;
    const c = this.city;
    const grass = Materials.grass();
    const plaza = Materials.plaza();
    const x0 = b.x0 + SW;
    const x1 = b.x1 - SW;
    const z0 = b.z0 + SW;
    const z1 = b.z1 - SW;
    const pw = 2;
    // Grass quadrants and cross-shaped paths.
    c.quad(grass, x0, z0, -pw, -pw, Y, 4);
    c.quad(grass, pw, z0, x1, -pw, Y, 4);
    c.quad(grass, x0, pw, -pw, z1, Y, 4);
    c.quad(grass, pw, pw, x1, z1, Y, 4);
    c.quad(plaza, -pw, z0, pw, z1, Y, 2);
    c.quad(plaza, x0, -pw, -pw, pw, Y, 2);
    c.quad(plaza, pw, -pw, x1, pw, Y, 2);
    const ring = new THREE.RingGeometry(0, 7.6, 40).rotateX(-Math.PI / 2);
    const uv = ring.attributes.uv;
    const pos = ring.attributes.position;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, -pos.getZ(i) / 2);
    this.batcher.add(plaza, ring, translation(0, Y + 0.012, 0));
    p.fountain(0, Y, 0);

    this.terrace(9, 9, 23, 23, 1.5);

    // Kiosk with a small paved pad.
    c.quad(plaza, -19, -19, -9, -11, Y + 0.008, 2);
    p.kiosk(-14, Y, -15.5, 0);
    p.trashBin(-10, Y, -12);

    // Benches facing the paths, lamps along them.
    for (const s of [-1, 1]) {
      p.bench(s * 3.2, Y, -14, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      p.bench(-14 * s, Y, 3.2 * (s > 0 ? 1 : -1), s > 0 ? Math.PI : 0);
      p.bench(s * 3.2, Y, 14, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      for (const t of [-20, -10.5, 10.5, 20]) {
        p.streetLamp(s * 2.6, Y, t, s > 0 ? -Math.PI / 2 : Math.PI / 2);
      }
    }
    // Trees scattered over the lawns, keeping clear of paths and the terrace.
    const spots = [];
    for (let i = 0; i < 60 && spots.length < 18; i++) {
      const x = rng.range(x0 + 2.5, x1 - 2.5);
      const z = rng.range(z0 + 2.5, z1 - 2.5);
      if (Math.abs(x) < 5 || Math.abs(z) < 5) continue;
      if (Math.hypot(x, z) < 11) continue;
      if (x > 3 && z > 3 && x < 26 && z < 26) continue;
      if (x < -7 && x > -21 && z < -9 && z > -21) continue;
      if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 5.5)) continue;
      spots.push({ x, z });
      p.tree(x, Y, z, rng.range(1.0, 1.35), false);
    }
    p.planter(-6.5, Y, 6.5, 2.4, 2.4);
    p.planter(6.5, Y, -6.5, 2.4, 2.4);
    p.planter(-6.5, Y, -6.5, 2.4, 2.4);

    // NPC routes: around the fountain and over the terrace (ramp up, stairs down).
    const ringPts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ringPts.push({ x: Math.cos(a) * 6.2, z: Math.sin(a) * 6.2 });
    }
    c.npcPaths.push({ loop: true, points: ringPts });
    c.npcPaths.push({
      loop: true,
      points: [{ x: 16, z: 1 }, { x: 16, z: 12 }, { x: 15, z: 17 }, { x: 5.5, z: 17 }, { x: 3.5, z: 10 }, { x: 6, z: 1.5 }],
    });
    c.npcPaths.push({ loop: false, points: [{ x: 0, z: -24 }, { x: 0, z: -9 }, { x: -9, z: 0 }, { x: -24, z: 0 }] });
  }

  /** Raised terrace with a ramp (south) and stairs (west) to exercise slope/step handling. */
  terrace(x0, z0, x1, z1, h) {
    const p = this.props;
    const top = Y + h;
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const { sides } = boxParts(w, h, d, { sideTile: [2, 2], top: false });
    this.batcher.add(Materials.concrete(), sides, translation(cx, Y + h / 2, cz));
    this.city.quad(Materials.plaza(), x0, z0, x1, z1, top, 2);
    this.physics.addStaticBox(cx, Y + h / 2, cz, w / 2, h / 2, d / 2);

    // Ramp from z0 down to z0 - runLen.
    const runLen = 6;
    const rx0 = 14;
    const rx1 = 18;
    const angle = Math.atan2(h, runLen);
    const len = Math.hypot(h, runLen);
    const thick = 0.12;
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -angle);
    const midY = Y + h / 2;
    const midZ = z0 - runLen / 2;
    const center = new THREE.Vector3(0, -thick, 0).applyQuaternion(rot).add(new THREE.Vector3((rx0 + rx1) / 2, midY, midZ));
    this.physics.addStaticBox(center.x, center.y, center.z, (rx1 - rx0) / 2, thick, len / 2 + 0.05, rot);
    const rampG = new THREE.BoxGeometry(rx1 - rx0, thick * 2, len + 0.1);
    this.batcher.add(Materials.plaza(), rampG, new THREE.Matrix4().compose(center, rot, new THREE.Vector3(1, 1, 1)));
    // Ramp side walls (visual wedge sides).
    for (const sx of [rx0 - 0.15, rx1 + 0.15]) {
      const wall = new THREE.BoxGeometry(0.3, thick * 2 + 0.25, len + 0.1);
      const wc = new THREE.Vector3(0, 0.08, 0).applyQuaternion(rot).add(new THREE.Vector3(sx, midY, midZ));
      this.batcher.add(Materials.concrete(), wall, new THREE.Matrix4().compose(wc, rot, new THREE.Vector3(1, 1, 1)));
    }

    // Stairs on the west face, between sz0..sz1.
    const steps = 7;
    const rise = h / steps;
    const run = 0.36;
    const sz0 = 15;
    const sz1 = 19;
    for (let i = 0; i < steps - 1; i++) {
      const stepTop = Y + rise * (i + 1);
      const sx1 = x0 - (steps - 2 - i) * run;
      const sx0 = sx1 - run;
      const sh = stepTop - Y;
      const g = new THREE.BoxGeometry(run, sh, sz1 - sz0);
      this.batcher.add(Materials.concrete(), g, translation((sx0 + sx1) / 2, Y + sh / 2, (sz0 + sz1) / 2));
      this.physics.addStaticBox((sx0 + sx1) / 2, Y + sh / 2, (sz0 + sz1) / 2, run / 2, sh / 2, (sz1 - sz0) / 2);
    }

    // Railings with openings for the ramp and stairs.
    p.railing(x0 + 0.1, z1 - 0.1, x1 - 0.1, z1 - 0.1, top);
    p.railing(x1 - 0.1, z0 + 0.1, x1 - 0.1, z1 - 0.1, top);
    p.railing(x0 + 0.1, z0 + 0.1, rx0, z0 + 0.1, top);
    p.railing(rx1, z0 + 0.1, x1 - 0.1, z0 + 0.1, top);
    p.railing(x0 + 0.1, z0 + 0.1, x0 + 0.1, sz0, top);
    p.railing(x0 + 0.1, sz1, x0 + 0.1, z1 - 0.1, top);

    // Pergola.
    const pc = { x: cx + 1, z: cz + 1 };
    for (const dx of [-3, 3]) for (const dz of [-3, 3]) {
      this.batcher.add(Materials.painted(), new THREE.BoxGeometry(0.25, 2.8, 0.25), translation(pc.x + dx, top + 1.4, pc.z + dz), '#6d5440');
      this.physics.addStaticBox(pc.x + dx, top + 1.4, pc.z + dz, 0.13, 1.4, 0.13);
    }
    for (let k = -3; k <= 3; k += 0.75) {
      this.batcher.add(Materials.painted(), new THREE.BoxGeometry(6.8, 0.12, 0.12), translation(pc.x, top + 2.9, pc.z + k), '#7b5f48');
    }
    for (const dx of [-3, 3]) {
      this.batcher.add(Materials.painted(), new THREE.BoxGeometry(0.2, 0.2, 7), translation(pc.x + dx, top + 2.75, pc.z), '#6d5440');
    }
    p.bench(pc.x, top, pc.z + 2, Math.PI);
    p.bench(pc.x, top, pc.z - 2, 0);
  }

  parking(b) {
    const p = this.props;
    const c = this.city;
    const paint = Materials.roadPaint();
    const x0 = b.x0 + SW;
    const x1 = b.x1 - SW;
    const z0 = b.z0 + SW;
    const z1 = b.z1 - SW;

    // Convenience store on the west edge, facing the lot.
    this.factory.build({ x: x0 + 7, z: -75, w: 30, d: 14, rotY: Math.PI / 2, floors: 1, style: 'concreteGray', storefront: 'market' });
    // Three-storey building on the north edge facing the street.
    this.factory.build({ x: x0 + 14, z: z1 - 6, w: 28, d: 12, rotY: 0, floors: 3, style: 'plasterTerracotta', storefront: 'cafe' });

    // Stall rows: along the south edge (nose south) and in front of the store (nose west).
    for (let i = 0; i <= 13; i++) {
      const x = x0 + 16 + i * 2.7;
      if (x > x1 - 1) break;
      c.quad(paint, x - 0.06, z0 + 0.3, x + 0.06, z0 + 5.4, 0.16, 1);
      if (i < 13 && x + 2.7 < x1 - 1) p.wheelStop(x + 1.35, Y, z0 + 1.0, 0);
    }
    for (let i = 0; i <= 10; i++) {
      const z = -90 + i * 2.7;
      c.quad(paint, x0 + 14.3, z - 0.06, x0 + 19.4, z + 0.06, 0.16, 1);
    }
    // Direction arrows painted in the aisle.
    for (const ax of [-70, -58]) {
      c.quad(paint, ax - 1.5, -76.1, ax + 1.0, -75.9, 0.16, 1);
      c.quad(paint, ax + 0.6, -76.6, ax + 1.0, -75.4, 0.16, 1);
    }
    // Lot lighting and bollards protecting the store front.
    p.streetLamp(-60.4, Y, -97.4, 0);
    p.streetLamp(-74, Y, -60, Math.PI);
    for (let z = -88; z <= -62; z += 4) p.bollard(x0 + 14.6, Y, z);
    p.planter(x1 - 2, Y, z1 - 8, 1.6, 6);

    // Driveway ramp from the street (x = b.x1) down onto the asphalt.
    const zc = -78;
    const run = 1.2;
    const angle = Math.atan2(Y, run);
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle);
    const center = new THREE.Vector3(Math.sin(angle) * -0.05, -Math.cos(angle) * 0.05, 0).add(new THREE.Vector3(b.x1 + run / 2, Y / 2, zc));
    this.physics.addStaticBox(center.x, center.y, center.z, run / 2 + 0.05, 0.05, 4, rot);
    this.batcher.add(Materials.concrete(), new THREE.BoxGeometry(run + 0.1, 0.1, 8), new THREE.Matrix4().compose(center, rot, new THREE.Vector3(1, 1, 1)));
    // Concrete apron across the sidewalk marks the driveway.
    c.quad(Materials.concrete(), b.x1 - SW, zc - 4, b.x1, zc + 4, Y + 0.006, 2);
  }

  civic(b) {
    const p = this.props;
    const rng = this.rng;
    const x0 = b.x0 + SW;
    const x1 = b.x1 - SW;
    const z0 = b.z0 + SW;
    const z1 = b.z1 - SW;
    // Office tower facing the plaza, with mid-rises either side.
    this.factory.build({ x: 0, z: z1 - 9, w: 22, d: 18, rotY: Math.PI, floors: 14, style: 'glassOffice', storefront: 'service' });
    this.factory.build({ x: x0 + 7.4, z: z1 - 8, w: 14.8, d: 16, rotY: 0, floors: 6, style: 'stoneBeige', storefront: 'boutique' });
    this.factory.build({ x: x1 - 7.4, z: z1 - 8, w: 14.8, d: 16, rotY: 0, floors: 7, style: 'brickRed', storefront: 'bakery' });
    const sideLen = (z1 - 18) - z0;
    for (const [x, rotY] of [[x1 - 5, Math.PI / 2], [x0 + 5, -Math.PI / 2]]) {
      this.factory.build({ x, z: z0 + sideLen * 0.25, w: sideLen / 2 - 0.1, d: 10, rotY, floors: rng.int(4, 6), style: rng.pick(RESIDENTIAL), storefront: 'cafe' });
      this.factory.build({ x, z: z0 + sideLen * 0.75, w: sideLen / 2 - 0.1, d: 10, rotY, floors: rng.int(4, 6), style: rng.pick(RESIDENTIAL), storefront: null });
    }
    // Plaza furniture.
    const pz = (z0 + z1 - 18) / 2;
    for (const sx of [-8, 8]) {
      p.planter(sx, Y, pz - 6, 4, 1.4);
      p.planter(sx, Y, pz + 6, 4, 1.4);
      p.bench(sx, Y, pz - 4.6, Math.PI);
      p.bench(sx, Y, pz + 4.6, 0);
      p.tree(sx * 1.25, Y, pz, 1.1, true);
    }
    // Abstract sculpture: stacked offset rings on a plinth.
    this.batcher.add(Materials.concrete(), new THREE.BoxGeometry(2.4, 0.8, 2.4), translation(0, Y + 0.4, pz), '#ffffff');
    this.physics.addStaticBox(0, Y + 0.4, pz, 1.2, 0.4, 1.2);
    for (let i = 0; i < 3; i++) {
      const g = new THREE.TorusGeometry(0.9 - i * 0.15, 0.12, 8, 24);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(0, Y + 1.6 + i * 0.75, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 * i, i * 0.9, 0.5)),
        new THREE.Vector3(1, 1, 1),
      );
      this.batcher.add(Materials.metal(), g, m, '#b07a3a');
    }
    this.physics.addStaticCylinder(0, Y + 2.5, pz, 1.7, 0.6);
    // Flag poles.
    for (const fx of [-3, 0, 3]) {
      this.batcher.add(Materials.metal(), new THREE.CylinderGeometry(0.05, 0.07, 9, 8), translation(fx, Y + 4.5, z1 - 19.5), '#c8c8c8');
      this.batcher.add(Materials.painted(), new THREE.BoxGeometry(0.02, 1.0, 1.6), translation(fx, Y + 8.3, z1 - 19.5 - 0.85), ['#2f6a8a', '#d9a52b', '#3d7a4a'][fx / 3 + 1]);
      this.physics.addStaticCylinder(fx, Y + 4.5, z1 - 19.5, 4.5, 0.08);
    }
    this.city.npcPaths.push({
      loop: true,
      points: [{ x: -12, z: pz - 10 }, { x: 12, z: pz - 10 }, { x: 12, z: pz + 9 }, { x: -12, z: pz + 9 }],
    });
  }

  /** Continuous wall of buildings around the ring road, closing the map visually. */
  outerStrips() {
    const rng = this.rng;
    const R = RING_OUTER;
    const E = CITY.outerEdge;
    const c = this.city;
    c.slab(-E, R, E, E, 'outer', 0);
    c.slab(-E, -E, E, -R, 'outer', 0);
    c.slab(R, -R, E, R, 'outer', 0);
    c.slab(-E, -R, -R, R, 'outer', 0);
    const front = R + SW;
    const span = front;
    const styles = RESIDENTIAL.concat(COMMERCIAL);
    const sides = [
      { axis: 'x', rotY: Math.PI, sign: 1 },
      { axis: 'x', rotY: 0, sign: -1 },
      { axis: 'z', rotY: -Math.PI / 2, sign: 1 },
      { axis: 'z', rotY: Math.PI / 2, sign: -1 },
    ];
    for (const s of sides) {
      let a = -span;
      for (const seg of splitRow(rng, span * 2, 12, 22)) {
        const d = rng.range(16, 22);
        const depthCenter = s.sign * (front + d / 2);
        const center = a + seg / 2;
        const [x, z] = s.axis === 'x' ? [center, depthCenter] : [depthCenter, center];
        this.factory.build({
          x, z, w: seg - 0.02, d, rotY: s.rotY,
          floors: rng.int(4, 12),
          style: rng.pick(styles),
          storefront: rng.chance(0.55) ? rng.pick(SHOPS) : null,
        });
        a += seg;
      }
      // Street lamps along the outer sidewalk.
      for (let t = -R + 10; t < R - 8; t += 24) {
        const inset = R + 0.6;
        const [x, z] = s.axis === 'x' ? [t, s.sign * inset] : [s.sign * inset, t];
        const rotY = s.axis === 'x' ? (s.sign > 0 ? Math.PI : 0) : (s.sign > 0 ? -Math.PI / 2 : Math.PI / 2);
        c.props.streetLamp(x, Y, z, rotY);
        if (rng.chance(0.6)) {
          const [tx, tz] = s.axis === 'x' ? [t + 12, s.sign * (R + 1.1)] : [s.sign * (R + 1.1), t + 12];
          c.props.tree(tx, Y, tz, rng.range(0.85, 1.05));
        }
      }
      const inset = R + 2;
      const pts = s.axis === 'x'
        ? [{ x: -R + 6, z: s.sign * inset }, { x: R - 6, z: s.sign * inset }]
        : [{ x: s.sign * inset, z: -R + 6 }, { x: s.sign * inset, z: R - 6 }];
      c.npcPaths.push({ loop: false, points: pts });
    }
    // Corner blocks.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      this.factory.build({
        x: sx * (front + 13), z: sz * (front + 13), w: 26, d: 26,
        rotY: sz > 0 ? Math.PI : 0, floors: rng.int(8, 13), style: rng.pick(COMMERCIAL), storefront: null,
      });
    }
  }
}
