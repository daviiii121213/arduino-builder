import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { glowTexture } from '../world/Textures.js';

/** Materials shared by every vehicle so the fleet costs few state changes. */
export const VehicleMaterials = {
  body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.2 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x18242b, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.72, depthWrite: false }),
  head: new THREE.MeshStandardMaterial({ color: 0xe8e6dc, emissive: 0xfff2cf, emissiveIntensity: 0.1, roughness: 0.15 }),
  headOn: new THREE.MeshStandardMaterial({ color: 0xf4f1e6, emissive: 0xfff2cf, emissiveIntensity: 2.5, roughness: 0.15 }),
  tail: new THREE.MeshStandardMaterial({ color: 0x8a1712, emissive: 0xff2010, emissiveIntensity: 0.15, roughness: 0.25 }),
  tailOn: new THREE.MeshStandardMaterial({ color: 0x8a1712, emissive: 0xff2010, emissiveIntensity: 1.0, roughness: 0.25 }),
  beam: new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  tailBrake: new THREE.MeshStandardMaterial({ color: 0xb01d16, emissive: 0xff2414, emissiveIntensity: 2.2, roughness: 0.25 }),
  wheel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 }),
};

VehicleMaterials.beam.map = glowTexture();

const TRIM = new THREE.Color(0x1f2124);
const INTERIOR = new THREE.Color(0x34302c);
const CHROME = new THREE.Color(0xb7bbc0);
const PLATE = new THREE.Color(0xe9e7dc);

function colored(geo, color, matrix) {
  const g = (geo.index ? geo.toNonIndexed() : geo).clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (matrix) g.applyMatrix4(matrix);
  const c = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < c.length; i += 3) c.set([color.r, color.g, color.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}

const at = (x, y, z, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

/** Extrudes a side profile (z, y points) across the width (x). */
function extrude(points, width, bevel = 0.03) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.01, width - bevel * 2);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2); // shape x -> vehicle z
  return g;
}

/** Box spanning two profile points (z, y) at lateral offset x: used for pillars. */
function strut(x, [z0, y0], [z1, y1], w, t) {
  const len = Math.hypot(z1 - z0, y1 - y0);
  return { geo: new THREE.BoxGeometry(w, t, len), m: at(x, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(-(y1 - y0), z1 - z0)) };
}

function lowerProfile(d) {
  const L2 = d.length / 2;
  const r = d.wheelRadius + 0.06;
  const pts = [[L2 - 0.08, d.bottom], [d.wheelFront + r, d.bottom]];
  const arch = (cz) => {
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI;
      pts.push([cz + Math.cos(a) * r, d.wheelRadius + Math.sin(a) * r]);
    }
  };
  arch(d.wheelFront);
  pts.push([d.wheelRear + r, d.bottom]);
  arch(d.wheelRear);
  pts.push(
    [-L2 + 0.08, d.bottom], [-L2, d.bottom + 0.14], [-L2, d.deck - 0.06], [-L2 + 0.1, d.deck],
    [d.cabin.rear, d.belt], [d.cabin.front, d.belt], [L2 - 0.18, d.hood], [L2, d.hood - 0.12], [L2, d.bottom + 0.14],
  );
  return pts;
}

/**
 * Builds a stylised low-poly vehicle. Returns the root plus local wheel anchors;
 * wheels themselves are drawn by a shared instanced mesh (see WheelInstances).
 */
export function buildVehicleModel(d, colorHex) {
  const paint = new THREE.Color(colorHex);
  const paintDark = paint.clone().multiplyScalar(0.6);
  const parts = [];
  const add = (geo, color, m) => parts.push(colored(geo, color, m));
  const L2 = d.length / 2;
  const W = d.width;
  const c = d.cabin;

  add(extrude(lowerProfile(d), W, 0.04), paint);
  // Cabin frame: roof slab, pillars, sills; glass fills the rest.
  const roofT = 0.06;
  add(extrude([[c.roofRear, d.roof - roofT], [c.roofFront, d.roof - roofT], [c.roofFront, d.roof], [c.roofRear, d.roof]], d.cabinWidth + 0.02, 0.02), paint);
  const px = d.cabinWidth / 2 - 0.035;
  for (const sx of [-1, 1]) {
    const a = strut(sx * px, [c.front, d.belt], [c.roofFront, d.roof - roofT / 2], 0.07, 0.06);
    add(a.geo, paint, a.m);
    const cp = strut(sx * px, [c.rear, d.belt], [c.roofRear, d.roof - roofT / 2], 0.07, 0.16);
    add(cp.geo, paint, cp.m);
    const bz = (c.roofRear + c.roofFront) / 2 + (d.bed ? 0.15 : 0);
    add(new THREE.BoxGeometry(0.06, d.roof - d.belt, 0.08), paint, at(sx * px, (d.roof + d.belt) / 2, bz));
    // Mirror.
    add(new THREE.BoxGeometry(0.14, 0.09, 0.08), paint, at(sx * (W / 2 + 0.05), d.belt + 0.05, c.front - 0.05));
    // Door seam and handle.
    add(new THREE.BoxGeometry(0.01, d.belt - d.bottom - 0.12, 0.02), TRIM, at(sx * (W / 2 + 0.002), (d.belt + d.bottom) / 2, c.front - 0.05));
    add(new THREE.BoxGeometry(0.02, 0.025, 0.12), CHROME, at(sx * (W / 2 + 0.01), d.belt - 0.12, d.seat.z - 0.15));
    // Side skirt.
    add(new THREE.BoxGeometry(0.05, 0.08, (d.wheelFront - d.wheelRear) - (d.wheelRadius + 0.08) * 2), TRIM, at(sx * (W / 2 - 0.01), d.bottom + 0.04, (d.wheelFront + d.wheelRear) / 2));
  }
  // Bumpers, grille, plates.
  add(new THREE.BoxGeometry(W - 0.04, 0.17, 0.14), TRIM, at(0, d.bottom + 0.1, L2 + 0.02));
  add(new THREE.BoxGeometry(W - 0.04, 0.17, 0.14), TRIM, at(0, d.bottom + 0.1, -L2 - 0.02));
  add(new THREE.BoxGeometry(W * 0.42, 0.1, 0.04), TRIM, at(0, d.hood - 0.2, L2 + 0.005));
  add(new THREE.BoxGeometry(0.34, 0.1, 0.02), PLATE, at(0, d.bottom + 0.1, L2 + 0.1));
  add(new THREE.BoxGeometry(0.34, 0.1, 0.02), PLATE, at(0, d.deck - 0.25, -L2 - 0.01));
  // Interior visible through the glass.
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.42, 0.1, 0.42), INTERIOR, at(sx * d.seat.x, d.bottom + 0.22, d.seat.z));
    add(new THREE.BoxGeometry(0.42, 0.48, 0.09), INTERIOR, at(sx * d.seat.x, d.bottom + 0.5, d.seat.z - 0.24, -0.15));
  }
  add(new THREE.BoxGeometry(d.cabinWidth - 0.1, 0.16, 0.28), INTERIOR, at(0, d.belt - 0.02, c.front - 0.2));
  add(new THREE.TorusGeometry(0.13, 0.02, 4, 10), TRIM, at(d.seat.x, d.belt + 0.04, c.front - 0.42, -1.0));

  // Type-specific details.
  if (d.bed) {
    const bedLen = c.rear - (-L2) - 0.12;
    const bz = -L2 + 0.06 + bedLen / 2;
    add(new THREE.BoxGeometry(W - 0.16, 0.02, bedLen), paintDark.clone().multiplyScalar(0.5), at(0, d.belt + 0.005, bz));
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.07, 0.22, bedLen + 0.06), paint, at(sx * (W / 2 - 0.04), d.belt + 0.1, bz));
    add(new THREE.BoxGeometry(W - 0.02, 0.22, 0.07), paint, at(0, d.belt + 0.1, -L2 + 0.04));
    add(new THREE.BoxGeometry(W - 0.02, 0.06, 0.06), TRIM, at(0, d.roof + 0.04, c.roofRear + 0.2));
  }
  if (d.roof > 1.5 && !d.bed) {
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.05, (c.roofFront - c.roofRear) * 0.85), TRIM, at(sx * (d.cabinWidth / 2 - 0.1), d.roof + 0.04, (c.roofFront + c.roofRear) / 2));
    add(new THREE.BoxGeometry(W - 0.1, 0.12, 0.06), TRIM, at(0, d.bottom + 0.22, -L2 - 0.08)); // tow bar
  }
  if (d.roof < 1.2) {
    // Low rear spoiler.
    add(new THREE.BoxGeometry(W - 0.25, 0.04, 0.24), TRIM, at(0, d.deck + 0.17, -L2 + 0.18));
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.16, 0.08), TRIM, at(sx * 0.55, d.deck + 0.08, -L2 + 0.2));
    add(new THREE.BoxGeometry(0.25, 0.03, 0.9), paintDark, at(0, d.hood + 0.015, L2 - 0.75)); // hood scoop stripe
  }

  const root = new THREE.Group();
  const body = new THREE.Mesh(mergeGeometries(parts), VehicleMaterials.body);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);
  parts.forEach((p) => p.dispose());

  const glass = new THREE.Mesh(
    extrude([[c.rear + 0.04, d.belt], [c.roofRear + 0.02, d.roof - roofT], [c.roofFront - 0.02, d.roof - roofT], [c.front - 0.04, d.belt]], d.cabinWidth - 0.02, 0),
    VehicleMaterials.glass,
  );
  glass.renderOrder = 2;
  root.add(glass);

  const lights = (z, y, w, h, inset) => mergeGeometries([-1, 1].map((sx) => new THREE.BoxGeometry(w, h, 0.05).translate(sx * (W / 2 - inset), y, z)));
  const head = new THREE.Mesh(lights(L2 - 0.005, d.hood - 0.13, 0.3, 0.1, 0.24), VehicleMaterials.head);
  const tail = new THREE.Mesh(lights(-L2 + 0.005, d.deck - 0.12, 0.26, 0.1, 0.2), VehicleMaterials.tail);
  root.add(head, tail);
  // Soft pool of headlight on the road, shown at night.
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6).rotateX(-Math.PI / 2), VehicleMaterials.beam);
  beam.position.set(0, 0.04, L2 + 3.4);
  beam.visible = false;
  beam.renderOrder = 1;
  root.add(beam);

  const wheelAnchors = [
    [d.track, d.wheelFront], [-d.track, d.wheelFront], [d.track, d.wheelRear], [-d.track, d.wheelRear],
  ].map(([x, z]) => new THREE.Vector3(x, d.wheelRadius, z));
  return { root, body, glass, head, tail, beam, wheelAnchors };
}

/** All vehicle wheels in a single instanced draw call. */
export class WheelInstances {
  constructor(scene, capacity) {
    const tire = colored(new THREE.CylinderGeometry(1, 1, 0.22, 12).rotateZ(Math.PI / 2), new THREE.Color(0x1a1a1a));
    const rim = colored(new THREE.CylinderGeometry(0.6, 0.6, 0.23, 8).rotateZ(Math.PI / 2), new THREE.Color(0xa9adb2));
    const hub = colored(new THREE.BoxGeometry(0.24, 0.3, 0.3), new THREE.Color(0x5a5e63));
    const spoke = colored(new THREE.BoxGeometry(0.235, 1.05, 0.12), new THREE.Color(0x8d9196));
    this.mesh = new THREE.InstancedMesh(mergeGeometries([tire, rim, hub, spoke]), VehicleMaterials.wheel, capacity);
    this.mesh.castShadow = true;
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.next = 0;
  }

  /** Reserves four instance slots. */
  allocate() {
    if (this.free?.length) return this.free.pop();
    const base = this.next;
    this.next += 4;
    this.mesh.count = this.next;
    return base;
  }

  release(base) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < 4; i++) this.mesh.setMatrixAt(base + i, zero);
    (this.free ??= []).push(base);
  }

  set(index, matrix) {
    this.mesh.setMatrixAt(index, matrix);
  }

  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
