import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _color = new THREE.Color();

/**
 * Collects static geometry per material and merges it into a few large meshes,
 * which keeps the draw-call count of the city low.
 */
export class GeometryBatcher {
  constructor() {
    this.batches = new Map();
  }

  /**
   * @param {THREE.Material} material
   * @param {THREE.BufferGeometry} geometry - consumed (may be mutated)
   * @param {THREE.Matrix4} [matrix]
   * @param {THREE.ColorRepresentation} [color] - only used when material.vertexColors is true
   */
  add(material, geometry, matrix, color) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    }
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    if (material.vertexColors) {
      _color.set(color ?? 0xffffff);
      const count = g.attributes.position.count;
      const arr = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        arr[i * 3] = _color.r;
        arr[i * 3 + 1] = _color.g;
        arr[i * 3 + 2] = _color.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    }
    if (matrix) g.applyMatrix4(matrix);
    if (!this.batches.has(material)) this.batches.set(material, []);
    this.batches.get(material).push(g);
  }

  /** Builds one mesh per material and adds them to `parent`. */
  build(parent, { castShadow = true, receiveShadow = true } = {}) {
    const meshes = [];
    for (const [material, geometries] of this.batches) {
      if (!geometries.length) continue;
      const merged = mergeGeometries(geometries, false);
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow && material.userData.castShadow !== false;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      parent.add(mesh);
      meshes.push(mesh);
      geometries.forEach((g) => g.dispose());
    }
    this.batches.clear();
    return meshes;
  }
}

const FACE_DIMS = [
  // [u extent axis, v extent axis] per BoxGeometry face: px, nx, py, ny, pz, nz
  ['d', 'h'], ['d', 'h'], ['w', 'd'], ['w', 'd'], ['w', 'h'], ['w', 'h'],
];

/**
 * Box geometry split into side faces and top/bottom faces, with UVs in world
 * units divided by the tile size, so textures keep a constant scale.
 */
export function boxParts(w, h, d, { sideTile = [1, 1], topTile = [1, 1], top = true, bottom = false } = {}) {
  const box = new THREE.BoxGeometry(w, h, d);
  const dims = { w, h, d };
  const uv = box.attributes.uv;
  for (let face = 0; face < 6; face++) {
    const isSide = face !== 2 && face !== 3;
    const tile = isSide ? sideTile : topTile;
    const [ua, va] = FACE_DIMS[face];
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, (uv.getX(i) * dims[ua]) / tile[0], (uv.getY(i) * dims[va]) / tile[1]);
    }
  }
  const pick = (faces) => {
    const g = new THREE.BufferGeometry();
    const index = [];
    for (const f of faces) index.push(...box.index.array.slice(f * 6, f * 6 + 6));
    g.setAttribute('position', box.attributes.position);
    g.setAttribute('normal', box.attributes.normal);
    g.setAttribute('uv', box.attributes.uv);
    g.setIndex(index);
    return g;
  };
  const topFaces = [];
  if (top) topFaces.push(2);
  if (bottom) topFaces.push(3);
  return { sides: pick([0, 1, 4, 5]), top: topFaces.length ? pick(topFaces) : null };
}

/** Box with world-scaled UVs on every face. */
export function tiledBox(w, h, d, tile = [1, 1]) {
  const { sides, top } = boxParts(w, h, d, { sideTile: tile, topTile: tile, top: true, bottom: true });
  return mergeGeometries([sides.toNonIndexed(), top.toNonIndexed()]);
}

export const translation = (x, y, z, rotY = 0) =>
  new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
