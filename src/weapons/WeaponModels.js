import * as THREE from 'three';

const polymer = new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.7, metalness: 0.1 });
const steel = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.35, metalness: 0.85 });
const darkSteel = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, roughness: 0.45, metalness: 0.7 });
const tan = new THREE.MeshStandardMaterial({ color: 0x6f6553, roughness: 0.75, metalness: 0.05 });
const lens = new THREE.MeshStandardMaterial({ color: 0x3a6070, roughness: 0.05, metalness: 0.6 });

function part(geo, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function marker(parent, name, x, y, z) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/** Compact polymer-frame pistol. Origin at the grip, barrel along +Z. */
export function createPistolModel() {
  const g = new THREE.Group();
  g.add(part(new THREE.BoxGeometry(0.03, 0.034, 0.19), steel, 0, 0.055, 0.05));
  // Slide serrations.
  for (let i = 0; i < 5; i++) g.add(part(new THREE.BoxGeometry(0.031, 0.022, 0.004), darkSteel, 0, 0.058, -0.03 + i * 0.008));
  g.add(part(new THREE.BoxGeometry(0.027, 0.022, 0.15), polymer, 0, 0.03, 0.06));
  g.add(part(new THREE.BoxGeometry(0.027, 0.11, 0.045), polymer, 0, -0.025, -0.012, -0.2));
  g.add(part(new THREE.TorusGeometry(0.022, 0.004, 6, 12, Math.PI), polymer, 0, 0.014, 0.028, 0, Math.PI / 2, Math.PI));
  g.add(part(new THREE.CylinderGeometry(0.007, 0.007, 0.02, 8), darkSteel, 0, 0.055, 0.15, Math.PI / 2));
  g.add(part(new THREE.BoxGeometry(0.006, 0.008, 0.008), darkSteel, 0, 0.076, 0.135));
  g.add(part(new THREE.BoxGeometry(0.02, 0.008, 0.008), darkSteel, 0, 0.076, -0.035));
  const mag = part(new THREE.BoxGeometry(0.024, 0.02, 0.04), darkSteel, 0, -0.085, -0.02, -0.2);
  g.add(mag);
  const grips = {
    right: marker(g, 'gripR', 0, -0.02, -0.015),
    left: marker(g, 'gripL', 0.03, -0.035, 0.0),
  };
  const muzzle = marker(g, 'muzzle', 0, 0.055, 0.17);
  return { object: g, grips, muzzle, magazine: mag };
}

/** Original carbine design. Origin at the pistol grip, barrel along +Z. */
export function createRifleModel() {
  const g = new THREE.Group();
  // Upper/lower receiver.
  g.add(part(new THREE.BoxGeometry(0.045, 0.055, 0.26), darkSteel, 0, 0.055, 0.06));
  g.add(part(new THREE.BoxGeometry(0.04, 0.035, 0.2), polymer, 0, 0.015, 0.06));
  // Handguard with side slots.
  g.add(part(new THREE.CylinderGeometry(0.026, 0.026, 0.27, 8), tan, 0, 0.055, 0.32, Math.PI / 2, 0, Math.PI / 8));
  for (let i = 0; i < 4; i++) g.add(part(new THREE.BoxGeometry(0.054, 0.008, 0.035), polymer, 0, 0.055, 0.23 + i * 0.06));
  // Barrel and compensator.
  g.add(part(new THREE.CylinderGeometry(0.009, 0.009, 0.2, 8), steel, 0, 0.055, 0.55, Math.PI / 2));
  g.add(part(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), darkSteel, 0, 0.055, 0.66, Math.PI / 2));
  // Top rail and compact optic.
  g.add(part(new THREE.BoxGeometry(0.022, 0.01, 0.42), darkSteel, 0, 0.088, 0.18));
  g.add(part(new THREE.CylinderGeometry(0.019, 0.019, 0.11, 12), polymer, 0, 0.118, 0.06, Math.PI / 2));
  g.add(part(new THREE.CircleGeometry(0.016, 12), lens, 0, 0.118, 0.116));
  g.add(part(new THREE.BoxGeometry(0.02, 0.02, 0.03), polymer, 0, 0.1, 0.06));
  // Pistol grip and trigger guard.
  g.add(part(new THREE.BoxGeometry(0.032, 0.1, 0.042), polymer, 0, -0.035, -0.02, -0.3));
  g.add(part(new THREE.BoxGeometry(0.008, 0.006, 0.06), polymer, 0, -0.012, 0.035));
  // Stock: tube plus shaped butt.
  g.add(part(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 8), darkSteel, 0, 0.05, -0.17, Math.PI / 2));
  const stockShape = new THREE.Shape();
  stockShape.moveTo(0, 0.07);
  stockShape.lineTo(0.13, 0.075);
  stockShape.lineTo(0.15, -0.06);
  stockShape.lineTo(0.12, -0.075);
  stockShape.lineTo(0.0, 0.02);
  const stockGeo = new THREE.ExtrudeGeometry(stockShape, { depth: 0.036, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 1 });
  stockGeo.translate(0, 0, -0.018);
  g.add(part(stockGeo, tan, 0, 0.0, -0.22, 0, Math.PI / 2, 0));
  // Magazine (slightly curved look from two segments).
  const mag = new THREE.Group();
  mag.add(part(new THREE.BoxGeometry(0.026, 0.1, 0.05), polymer, 0, -0.05, 0, 0.1));
  mag.add(part(new THREE.BoxGeometry(0.026, 0.06, 0.05), polymer, 0, -0.12, 0.012, 0.3));
  mag.position.set(0, 0.0, 0.11);
  g.add(mag);
  const grips = {
    right: marker(g, 'gripR', 0, -0.03, -0.02),
    left: marker(g, 'gripL', 0.0, 0.025, 0.22),
  };
  const muzzle = marker(g, 'muzzle', 0, 0.055, 0.7);
  return { object: g, grips, muzzle, magazine: mag };
}

export const weaponModelFactories = { pistol: createPistolModel, rifle: createRifleModel };
