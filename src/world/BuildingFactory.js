import * as THREE from 'three';
import { Materials } from './Materials.js';
import {
  BAY_WIDTH, FLOOR_HEIGHT, GROUND_FLOOR_HEIGHT, FACADE_TILE_BAYS, FACADE_TILE_FLOORS,
  STOREFRONT_TILE_BAYS, FACADE_STYLES, STOREFRONT_STYLES, signTexture,
} from './Textures.js';

const TRIM_COLORS = {
  brick: '#cfc6b6',
  stone: '#d4c9b2',
  plaster: '#ece5d6',
  concrete: '#b5b2ab',
  curtain: '#2f3438',
};

const SHOP_NAMES = [
  ['CAFÉ ALVORADA', '#7b2f2a'], ['MERCADINHO BOA VISTA', '#2f5e4a'], ['PADARIA SOL NASCENTE', '#b07a2a'],
  ['ÓTICA CLARA', '#25364d'], ['LAVANDERIA BRISA', '#3d6f8a'], ['FARMÁCIA VIDA', '#2e6b3f'],
  ['LIVRARIA PÁGINA', '#5b3a5e'], ['BARBEARIA NORTE', '#3b3b3b'], ['FLORICULTURA IPÊ', '#7a5a2a'],
  ['CHAVEIRO RÁPIDO', '#8a6a1e'],
];

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

/** Transform from building-local space (origin at footprint centre, ground level). */
function local(base, x, y, z, rotX = 0, rotY = 0) {
  _e.set(rotX, rotY, 0);
  _q.setFromEuler(_e);
  _p.set(x, y, z);
  return new THREE.Matrix4().compose(_p, _q, _s).premultiply(base);
}

/**
 * Builds a mid-rise city building into the batcher and registers its collider.
 * The front facade faces local +Z; `rotY` rotates it to face the street.
 */
export class BuildingFactory {
  constructor(batcher, physics, rng) {
    this.batcher = batcher;
    this.physics = physics;
    this.rng = rng;
    this.signMeshes = [];
    this.shopIndex = 0;
  }

  build({ x, z, y = 0.15, w, d, rotY = 0, floors, style, storefront = null, roofDetails = true }) {
    const rng = this.rng;
    const b = this.batcher;
    const styleDef = FACADE_STYLES[style];
    const trim = TRIM_COLORS[styleDef.wall];
    const base = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);

    const groundH = storefront ? GROUND_FLOOR_HEIGHT : 0;
    const setbackFloors = floors >= 8 && rng.chance(0.6) ? rng.int(2, 3) : 0;
    const mainFloors = floors - setbackFloors;
    const bodyH = mainFloors * FLOOR_HEIGHT;
    const totalH = groundH + bodyH + setbackFloors * FLOOR_HEIGHT;
    const facadeTileW = (FACADE_TILE_BAYS * BAY_WIDTH);
    const facadeTileH = FACADE_TILE_FLOORS * FLOOR_HEIGHT;
    // Snap window bays to whole numbers so windows never get cut at corners.
    const bayScale = (len) => (Math.max(1, Math.round(len / BAY_WIDTH)) * BAY_WIDTH) / len;

    // --- ground floor
    if (storefront) {
      const shopTileW = STOREFRONT_TILE_BAYS * BAY_WIDTH;
      const front = this.faceOnly(w, groundH, d, 'pz', [shopTileW / bayScale(w), groundH]);
      b.add(Materials.storefront(storefront), front, local(base, 0, groundH / 2, 0));
      const sideMat = Materials.facade(style);
      for (const face of ['px', 'nx', 'nz']) {
        const len = face === 'nz' ? w : d;
        const g = this.faceOnly(w, groundH, d, face, [facadeTileW / bayScale(len), facadeTileH]);
        b.add(sideMat, g, local(base, 0, groundH / 2, 0));
      }
      this.addAwning(base, w, groundH, d);
      this.addShopSign(base, w, groundH, d, storefront);
      // Belt course between shop level and upper floors.
      b.add(Materials.painted(), new THREE.BoxGeometry(w + 0.3, 0.35, d + 0.3), local(base, 0, groundH, 0), trim);
    }

    // --- upper body
    const bodyMat = Materials.facade(style);
    for (const face of ['px', 'nx', 'pz', 'nz']) {
      const len = face === 'px' || face === 'nx' ? d : w;
      const g = this.faceOnly(w, bodyH, d, face, [facadeTileW / bayScale(len), facadeTileH]);
      b.add(bodyMat, g, local(base, 0, groundH + bodyH / 2, 0));
    }
    // Plinth so the building does not look pasted onto the ground.
    if (!storefront) {
      b.add(Materials.painted(), new THREE.BoxGeometry(w + 0.12, 0.6, d + 0.12), local(base, 0, 0.3, 0), '#5d5852');
    }
    if (styleDef.wall === 'plaster' || styleDef.wall === 'stone') {
      // Thin ledges every other floor add relief.
      for (let f = 2; f < mainFloors; f += 2) {
        b.add(Materials.painted(), new THREE.BoxGeometry(w + 0.16, 0.14, d + 0.16), local(base, 0, groundH + f * FLOOR_HEIGHT, 0), trim);
      }
    }

    let roofY = groundH + bodyH;
    let roofW = w;
    let roofD = d;
    this.addRoofEdge(base, w, d, roofY, trim, styleDef.wall !== 'curtain');

    if (setbackFloors) {
      const inset = 2.2;
      const sw = w - inset * 2;
      const sd = d - inset * 2;
      const sh = setbackFloors * FLOOR_HEIGHT;
      for (const face of ['px', 'nx', 'pz', 'nz']) {
        const len = face === 'px' || face === 'nx' ? sd : sw;
        const g = this.faceOnly(sw, sh, sd, face, [facadeTileW / bayScale(len), facadeTileH]);
        b.add(bodyMat, g, local(base, 0, roofY + sh / 2, 0));
      }
      b.add(Materials.roof(), this.roofQuad(w, d, 8), local(base, 0, roofY + 0.02, 0));
      roofY += sh;
      roofW = sw;
      roofD = sd;
      this.addRoofEdge(base, sw, sd, roofY, trim, true);
    }
    b.add(Materials.roof(), this.roofQuad(roofW, roofD, 8), local(base, 0, roofY + 0.02, 0));
    if (roofDetails) this.addRooftop(base, roofW, roofD, roofY);

    // Collider (full footprint, full height).
    const center = new THREE.Vector3(0, totalH / 2, 0).applyMatrix4(base);
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    this.physics.addStaticBox(center.x, center.y, center.z, w / 2, totalH / 2, d / 2, { x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    return { height: totalH };
  }

  /** A single face of a box, with world-scale UVs. */
  faceOnly(w, h, d, face, tile) {
    const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];
    const idx = order.indexOf(face);
    const box = new THREE.BoxGeometry(w, h, d);
    const dims = { px: d, nx: d, pz: w, nz: w };
    const uv = box.attributes.uv;
    for (let k = 0; k < 4; k++) {
      const i = idx * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[face]) / tile[0], (uv.getY(i) * h) / tile[1]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', box.attributes.position);
    g.setAttribute('normal', box.attributes.normal);
    g.setAttribute('uv', uv);
    g.setIndex(Array.from(box.index.array.slice(idx * 6, idx * 6 + 6)));
    return g;
  }

  roofQuad(w, d, tile) {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile, (uv.getY(i) * d) / tile);
    return g;
  }

  addRoofEdge(base, w, d, y, trim, withCornice) {
    const b = this.batcher;
    if (withCornice) {
      b.add(Materials.painted(), new THREE.BoxGeometry(w + 0.5, 0.3, d + 0.5), local(base, 0, y + 0.15, 0), trim);
      b.add(Materials.painted(), new THREE.BoxGeometry(w + 0.3, 0.2, d + 0.3), local(base, 0, y - 0.1, 0), trim);
    }
    // Parapet walls.
    const ph = 0.9;
    const t = 0.25;
    const col = withCornice ? trim : '#2f3438';
    b.add(Materials.painted(), new THREE.BoxGeometry(w, ph, t), local(base, 0, y + ph / 2, d / 2 - t / 2), col);
    b.add(Materials.painted(), new THREE.BoxGeometry(w, ph, t), local(base, 0, y + ph / 2, -d / 2 + t / 2), col);
    b.add(Materials.painted(), new THREE.BoxGeometry(t, ph, d - t * 2), local(base, w / 2 - t / 2, y + ph / 2, 0), col);
    b.add(Materials.painted(), new THREE.BoxGeometry(t, ph, d - t * 2), local(base, -w / 2 + t / 2, y + ph / 2, 0), col);
  }

  addRooftop(base, w, d, y) {
    const rng = this.rng;
    const b = this.batcher;
    const units = rng.int(1, 3);
    for (let i = 0; i < units; i++) {
      const ux = rng.range(-w / 2 + 2, w / 2 - 2);
      const uz = rng.range(-d / 2 + 2, d / 2 - 2);
      b.add(Materials.metal(), new THREE.BoxGeometry(1.6, 1.0, 1.2), local(base, ux, y + 0.5, uz), '#8d9094');
      b.add(Materials.painted(), new THREE.CylinderGeometry(0.4, 0.4, 0.08, 12), local(base, ux, y + 1.04, uz), '#3a3c3e');
    }
    if (w > 10 && d > 10 && rng.chance(0.45)) {
      // Water tank on legs.
      const tx = rng.range(-w / 2 + 3, w / 2 - 3);
      const tz = rng.range(-d / 2 + 3, d / 2 - 3);
      for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
        b.add(Materials.metal(), new THREE.BoxGeometry(0.15, 2, 0.15), local(base, tx + lx, y + 1, tz + lz), '#4a4038');
      }
      b.add(Materials.painted(), new THREE.CylinderGeometry(1.4, 1.4, 2.4, 16), local(base, tx, y + 3.2, tz), '#7a5b45');
      b.add(Materials.painted(), new THREE.ConeGeometry(1.5, 0.8, 16), local(base, tx, y + 4.8, tz), '#5b4436');
    } else if (rng.chance(0.6)) {
      // Stair/elevator housing.
      const hx = rng.range(-w / 2 + 2.5, w / 2 - 2.5);
      const hz = rng.range(-d / 2 + 2.5, d / 2 - 2.5);
      b.add(Materials.painted(), new THREE.BoxGeometry(3, 2.6, 3), local(base, hx, y + 1.3, hz), '#9b968d');
    }
    if (rng.chance(0.35)) {
      b.add(Materials.metal(), new THREE.CylinderGeometry(0.04, 0.06, 4, 6), local(base, w / 2 - 1.5, y + 2, -d / 2 + 1.5), '#666');
    }
  }

  addAwning(base, w, groundH, d) {
    const rng = this.rng;
    const colors = ['#7c2f2a', '#2f5446', '#33435f', '#b2873b', '#5b5f63', '#6a3b55'];
    const color = rng.pick(colors);
    const aw = Math.min(w - 1, rng.range(6, 12));
    const depth = 1.5;
    const angle = 0.32;
    const yTop = groundH - 0.8;
    const z = d / 2 + (Math.cos(angle) * depth) / 2;
    this.batcher.add(
      Materials.painted(), new THREE.BoxGeometry(aw, 0.06, depth),
      local(base, 0, yTop - (Math.sin(angle) * depth) / 2, z, angle, 0), color,
    );
    // Valance.
    this.batcher.add(
      Materials.painted(), new THREE.BoxGeometry(aw, 0.3, 0.04),
      local(base, 0, yTop - Math.sin(angle) * depth - 0.12, d / 2 + Math.cos(angle) * depth), color,
    );
  }

  addShopSign(base, w, groundH, d, storefront) {
    const [text] = SHOP_NAMES[this.shopIndex++ % SHOP_NAMES.length];
    const bg = STOREFRONT_STYLES[storefront].sign;
    const mat = new THREE.MeshStandardMaterial({ map: signTexture(text, bg, '#f4ecd8'), roughness: 0.6 });
    const signH = 0.62;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(signH * (512 / 96), signH), mat);
    mesh.matrixAutoUpdate = false;
    mesh.matrix.copy(local(base, 0, groundH - 0.36, d / 2 + 0.03));
    mesh.receiveShadow = true;
    this.signMeshes.push(mesh);
  }
}
