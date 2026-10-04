import * as THREE from 'three';
import { GeometryBatcher, boxParts, translation } from './GeometryBatcher.js';
import { Materials } from './Materials.js';
import { BuildingFactory } from './BuildingFactory.js';
import { PropFactory } from './PropFactory.js';
import { TrafficLights } from './TrafficLights.js';
import { CITY, forEachBlock, blockBounds } from './CityLayout.js';
import { createRng } from '../core/math.js';
import { BlockBuilders } from './BlockBuilders.js';
import { Interiors } from './Interiors.js';
import { STREET_NAMES } from './CityLayout.js';
import { signTexture } from './Textures.js';
import { Construction } from './Construction.js';

const Y = CITY.curbHeight;

/**
 * Builds the whole static city: ground, roads, blocks, buildings and props.
 * Exposes NPC walking paths and spawn points for gameplay systems.
 */
export class City {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    this.group = new THREE.Group();
    this.group.name = 'City';
    scene.add(this.group);
    this.npcPaths = [];
    /** Parking-lot stalls: {x, y, z, yaw}. */
    this.lotSpots = [];
    /** Places where no car may be parked (driveways, bus stops, spawn): {x, z, r}. */
    this.noParking = [];
    this.spawn = {
      player: { x: -44.5, y: 0.4, z: -66, yaw: -Math.PI / 2 },
    };
  }

  build() {
    this.rng = createRng(20240917);
    this.batcher = new GeometryBatcher();
    this.buildings = new BuildingFactory(this.batcher, this.physics, this.rng);
    this.props = new PropFactory(this.batcher, this.physics, this.rng);
    this.props.dynamicProps = this.dynamicProps ?? null;
    this.props.breakables = this.breakables ?? null;
    this.construction = new Construction(this);
    const blocks = new BlockBuilders(this);
    this.interiors = new Interiors(this, this.interactables);

    this.buildGround();
    this.buildRoadMarkings();
    forEachBlock((ix, iz, type, b) => {
      this.slab(b.x0, b.z0, b.x1, b.z1, type);
      blocks[type](b, ix, iz);
      this.addSidewalkLoop(b);
    });
    blocks.outerStrips();
    this.buildSidewalkFurniture();
    // Road works closing the westbound lane of the street south of the commercial block,
    // and a small repair in a parking strip.
    this.construction.roadWorks(-36, 52, 92, { from: [108, -36], to: [36, -36] });
    this.construction.manholeRepair(0, -41.6, 0);
    this.buildTrafficLights();
    this.buildStreetSigns();
    this.buildBoundary();

    this.batcher.build(this.group);
    this.breakables?.build();
    this.trafficLights = new TrafficLights(this.group, this.props.trafficLightHeads);
    this.buildSkyline();
  }

  update(dt, listener, audio) {
    this.trafficLights.update(dt);
    if (listener) this.construction.update(dt, listener, audio);
  }

  // ------------------------------------------------------------ helpers

  /** Horizontal quad with UVs derived from world position (seamless across pieces). */
  quad(material, x0, z0, x1, z1, y, tile = 2) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, -pos.getZ(i) / tile);
    this.batcher.add(material, g);
  }

  /** Raised block slab: curb sides, sidewalk ring and an inner lot surface. */
  slab(x0, z0, x1, z1, type, ring = CITY.sidewalk) {
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    this.physics.addStaticBox(cx, Y / 2, cz, w / 2, Y / 2, d / 2);
    const { sides } = boxParts(w, Y, d, { sideTile: [1, 1], top: false });
    this.batcher.add(Materials.curb(), sides, translation(cx, Y / 2, cz));
    const sw = Materials.sidewalk();
    if (ring > 0) {
      this.quad(sw, x0, z0, x1, z0 + ring, Y);
      this.quad(sw, x0, z1 - ring, x1, z1, Y);
      this.quad(sw, x0, z0 + ring, x0 + ring, z1 - ring, Y);
      this.quad(sw, x1 - ring, z0 + ring, x1, z1 - ring, Y);
      // Curb stone line along the edge.
      this.quad(Materials.curb(), x0, z0, x1, z0 + 0.3, Y + 0.004, 1);
      this.quad(Materials.curb(), x0, z1 - 0.3, x1, z1, Y + 0.004, 1);
      this.quad(Materials.curb(), x0, z0 + 0.3, x0 + 0.3, z1 - 0.3, Y + 0.004, 1);
      this.quad(Materials.curb(), x1 - 0.3, z0 + 0.3, x1, z1 - 0.3, Y + 0.004, 1);
    }
    const lotMat = {
      parking: Materials.asphalt(),
      park: Materials.grass(),
      civic: Materials.plaza(),
      buildings: Materials.concrete(),
      industrial: Materials.concrete(),
      outer: Materials.sidewalk(),
    }[type];
    if (type !== 'park') this.quad(lotMat, x0 + ring, z0 + ring, x1 - ring, z1 - ring, Y, type === 'parking' ? 8 : 2);
  }

  addSidewalkLoop(b, inset = 2.0) {
    this.npcPaths.push({
      loop: true,
      points: [
        { x: b.x0 + inset, z: b.z0 + inset }, { x: b.x1 - inset, z: b.z0 + inset },
        { x: b.x1 - inset, z: b.z1 - inset }, { x: b.x0 + inset, z: b.z1 - inset },
      ],
    });
  }

  // ------------------------------------------------------------ ground & roads

  buildGround() {
    const E = 600;
    this.physics.addStaticBox(0, -1, 0, E, 1, E);
    this.quad(Materials.asphalt(), -E, -E, E, E, 0, 8);
  }

  buildRoadMarkings() {
    const paint = Materials.roadPaint();
    const C = CITY.roadCenters;
    const half = CITY.roadHalf;
    const y = 0.006;
    const along = (axis, c, a0, a1, off, width) => {
      // Rectangle along a road: `a` is the coordinate along the road, `off` across it.
      if (axis === 'z') this.quad(paint, c + off - width / 2, a0, c + off + width / 2, a1, y, 1);
      else this.quad(paint, a0, c + off - width / 2, a1, c + off + width / 2, y, 1);
    };
    for (const axis of ['x', 'z']) {
      for (const c of C) {
        for (let i = 0; i < C.length - 1; i++) {
          const s0 = C[i] + half;
          const s1 = C[i + 1] - half;
          // Zebra crossings at both ends.
          for (const [start, dir] of [[s0 + 0.6, 1], [s1 - 0.6, -1]]) {
            for (let k = -half + 0.8; k < half - 0.5; k += 1.1) {
              const a0 = dir > 0 ? start : start - 3;
              along(axis, c, a0, a0 + 3, k + 0.3, 0.55);
            }
            const stop = dir > 0 ? start + 3.6 : start - 3.6;
            // Stop line on the incoming lane only (right-hand traffic).
            const laneSign = dir > 0 ? 1 : -1;
            const lineOff = axis === 'z' ? laneSign : -laneSign;
            along(axis, c, stop - 0.2, stop + 0.2, (lineOff * half) / 2, half - 0.4);
          }
          // Dashed centre line.
          for (let a = s0 + 6; a < s1 - 6; a += 6) along(axis, c, a, Math.min(a + 3, s1 - 6), 0, 0.15);
          // Edge lines.
          // Lane edge lines separate the travel lanes from the curbside parking strip.
          const edge = CITY.laneOffset + 1.6;
          for (const off of [-edge, edge]) along(axis, c, s0 + 4.2, s1 - 4.2, off, 0.12);
        }
      }
    }
  }

  // ------------------------------------------------------------ furniture

  buildSidewalkFurniture() {
    const p = this.props;
    const rng = this.rng;
    const sides = (b) => [
      // [start, end, fixed coordinate, axis along, rotY toward road, outward normal]
      { a0: b.x0, a1: b.x1, fixed: b.z1, along: 'x', rot: 0, n: 1 },
      { a0: b.x0, a1: b.x1, fixed: b.z0, along: 'x', rot: Math.PI, n: -1 },
      { a0: b.z0, a1: b.z1, fixed: b.x1, along: 'z', rot: Math.PI / 2, n: 1 },
      { a0: b.z0, a1: b.z1, fixed: b.x0, along: 'z', rot: -Math.PI / 2, n: -1 },
    ];
    const at = (s, a, inset) => {
      const f = s.fixed - s.n * inset;
      return s.along === 'x' ? [a, f] : [f, a];
    };
    const inParkingDriveway = (x, z) => x < -40 && x > -50 && z > -84 && z < -72;

    let blockIndex = 0;
    forEachBlock((ix, iz, type, b) => {
      blockIndex++;
      sides(b).forEach((s, si) => {
        const len = s.a1 - s.a0;
        const lamps = Math.max(1, Math.round((len - 16) / 22));
        const step = (len - 16) / lamps;
        const withTrees = type === 'buildings' ? (blockIndex + si) % 3 !== 0 : type !== 'parking';
        for (let i = 0; i <= lamps; i++) {
          const a = s.a0 + 8 + i * step;
          const [lx, lz] = at(s, a, 0.6);
          if (!inParkingDriveway(lx, lz)) p.streetLamp(lx, Y, lz, s.rot);
          if (withTrees && i < lamps) {
            const [tx, tz] = at(s, a + step / 2, 1.1);
            if (!inParkingDriveway(tx, tz)) p.tree(tx, Y, tz, rng.range(0.85, 1.1));
          }
        }
        if (si === blockIndex % 4) {
          const [hx, hz] = at(s, s.a0 + 11, 0.6);
          p.hydrant(hx, Y, hz);
        }
        if ((si + blockIndex) % 2 === 0) {
          const [bx, bz] = at(s, s.a1 - 9.5, 0.8);
          p.trashBin(bx, Y, bz);
        }
        // A small traffic sign near one end of some sides.
        if ((si + blockIndex) % 3 === 1 && type !== 'park') {
          const [sx, sz] = at(s, s.a0 + 5, 0.5);
          if (!inParkingDriveway(sx, sz)) p.sign(sx, Y, sz, s.rot);
        }
      });
      // Corner bollards.
      for (const [cx, cz] of [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]]) {
        const sx = Math.sign((b.x0 + b.x1) / 2 - cx);
        const sz = Math.sign((b.z0 + b.z1) / 2 - cz);
        p.bollard(cx + sx * 0.7, Y, cz + sz * 2.6);
        p.bollard(cx + sx * 2.6, Y, cz + sz * 0.7);
      }
    });

    // Bus shelters on two busy streets.
    const b1 = blockBounds(0, 1);
    p.busShelter(b1.x1 - 3.1, Y, (b1.z0 + b1.z1) / 2 + 8, Math.PI / 2);
    const b2 = blockBounds(2, 1);
    p.busShelter(b2.x0 + 3.1, Y, (b2.z0 + b2.z1) / 2 - 8, -Math.PI / 2);
    this.noParking.push({ x: b1.x1 + 5, z: (b1.z0 + b1.z1) / 2 + 8, r: 8 }, { x: b2.x0 - 5, z: (b2.z0 + b2.z1) / 2 - 8, r: 8 });
  }

  buildTrafficLights() {
    const half = CITY.roadHalf;
    for (const cx of [-36, 36]) for (const cz of [-36, 36]) {
      // NE corner arm over the north-south road, SW corner arm over the east-west road.
      this.props.trafficLight(cx + half + 0.8, Y, cz + half + 0.8, -Math.PI / 2, 'z');
      this.props.trafficLight(cx - half - 0.8, Y, cz - half - 0.8, Math.PI / 2, 'z');
      this.props.trafficLight(cx + half + 0.8, Y, cz - half - 0.8, 0, 'x');
      this.props.trafficLight(cx - half - 0.8, Y, cz + half + 0.8, Math.PI, 'x');
    }
  }

  /** Street name blades on a pole at one corner of every intersection. */
  buildStreetSigns() {
    const C = CITY.roadCenters;
    const off = CITY.roadHalf + 1.4;
    const mats = new Map();
    const blade = (text) => {
      if (!mats.has(text)) mats.set(text, new THREE.MeshStandardMaterial({ map: signTexture(text, '#2d5f3f', '#f2efe6'), roughness: 0.5 }));
      return mats.get(text);
    };
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    C.forEach((cx, i) => C.forEach((cz, j) => {
      const x = cx - off;
      const z = cz - off;
      if (Math.abs(x) > 115 || Math.abs(z) > 115) return;
      m.makeTranslation(x, Y + 1.5, z);
      this.batcher.add(Materials.metal(), new THREE.CylinderGeometry(0.05, 0.05, 3, 6), m, '#3b4146');
      this.physics.addStaticCylinder(x, Y + 1.5, z, 1.5, 0.08);
      // Blade facing traffic on the road along z (named by x), and one for the road along x.
      for (const [text, yaw, y] of [[STREET_NAMES.x[i], 0, 2.85], [STREET_NAMES.z[j], Math.PI / 2, 2.6]]) {
        for (const flip of [0, Math.PI]) {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + flip);
          const dir = new THREE.Vector3(0, 0, 0.012).applyQuaternion(q);
          const along = new THREE.Vector3(0.55, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
          m.compose(new THREE.Vector3(x + along.x + dir.x, Y + y, z + along.z + dir.z), q, new THREE.Vector3(1, 1, 1));
          this.batcher.add(blade(text), new THREE.PlaneGeometry(1.1, 0.21), m);
        }
      }
    }));
  }

  buildBoundary() {
    const e = CITY.outerEdge - 3;
    const h = 60;
    this.physics.addStaticBox(0, h / 2, e, e, h / 2, 1);
    this.physics.addStaticBox(0, h / 2, -e, e, h / 2, 1);
    this.physics.addStaticBox(e, h / 2, 0, 1, h / 2, e);
    this.physics.addStaticBox(-e, h / 2, 0, 1, h / 2, e);
  }

  /** Distant, collision-free silhouettes that suggest the city continues past the map edge. */
  buildSkyline() {
    const batcher = new GeometryBatcher();
    const rng = createRng(77);
    const styles = ['concreteGray', 'glassOffice', 'brickBrown', 'stoneBeige', 'plasterCream'];
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rng.range(-0.03, 0.03);
      const r = rng.range(185, 320);
      const w = rng.range(18, 34);
      const d = rng.range(18, 34);
      const h = rng.range(18, 75) * (r > 250 ? 1.3 : 1);
      const { sides, top } = boxParts(w, h, d, { sideTile: [12, 6.4], topTile: [8, 8] });
      const m = translation(Math.cos(a) * r, h / 2, Math.sin(a) * r, -a);
      batcher.add(Materials.facade(rng.pick(styles)), sides, m);
      batcher.add(Materials.roof(), top, m);
    }
    batcher.build(this.group, { castShadow: false, receiveShadow: false });
  }
}
