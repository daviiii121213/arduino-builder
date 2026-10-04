import * as THREE from 'three';

export const CAR_DIMENSIONS = {
  length: 4.24,
  width: 1.78,
  wheelRadius: 0.33,
  wheelBase: { front: 1.32, rear: -1.28 },
  track: 0.78,
};

const R = CAR_DIMENSIONS.wheelRadius;

/** Side silhouette of the lower body (z = length axis, y = height), arches cut out. */
function lowerBodyShape() {
  const s = new THREE.Shape();
  const arch = (cz, fromRight) => {
    const r = R + 0.07;
    // Arc over the wheel from one side to the other.
    if (fromRight) s.absarc(cz, 0.33, r, 0, Math.PI, false);
    else s.absarc(cz, 0.33, r, Math.PI, 0, true);
  };
  s.moveTo(2.08, 0.3);
  s.lineTo(1.32 + R + 0.07, 0.3);
  arch(1.32, true);
  s.lineTo(-1.28 + R + 0.07, 0.3);
  arch(-1.28, true);
  s.lineTo(-2.08, 0.3);
  s.quadraticCurveTo(-2.14, 0.32, -2.13, 0.5);
  s.lineTo(-2.1, 0.9);
  s.quadraticCurveTo(-2.08, 0.99, -1.98, 1.0);
  s.lineTo(1.0, 0.99);
  s.quadraticCurveTo(1.7, 0.92, 2.02, 0.82);
  s.quadraticCurveTo(2.14, 0.78, 2.14, 0.62);
  s.lineTo(2.12, 0.4);
  s.quadraticCurveTo(2.11, 0.3, 2.08, 0.3);
  return s;
}

function cabinShape(inset = 0) {
  const s = new THREE.Shape();
  s.moveTo(-1.98 + inset * 1.6, 0.99 + inset);
  s.quadraticCurveTo(-1.85 + inset, 1.3 - inset * 0.5, -1.55 + inset * 0.8, 1.42 - inset);
  s.lineTo(0.3 - inset * 0.4, 1.45 - inset);
  s.quadraticCurveTo(0.55 - inset, 1.42 - inset, 1.0 - inset * 2.2, 0.99 + inset);
  s.lineTo(-1.98 + inset * 1.6, 0.99 + inset);
  return s;
}

/** Extrudes a side profile (drawn in z/y) across the car's width (x). */
function extrudeProfile(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 10,
  });
  // Shape x -> car z, shape y -> car y, extrude z -> car x.
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent?.add(m);
  return m;
}

/**
 * Original compact hatchback built from extruded profiles.
 * Origin at ground level between the axles, facing +Z.
 */
export function createCarModel(color = 0x2e6f78) {
  const root = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x1d1f21, roughness: 0.7 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.2, metalness: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x26343b, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.55, depthWrite: false });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xf2f0e6, emissive: 0xfff4d8, emissiveIntensity: 0.35, roughness: 0.1 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x8a1712, emissive: 0xff2010, emissiveIntensity: 0.25, roughness: 0.2 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x2b2826, roughness: 0.9 });

  // Body.
  const body = mesh(extrudeProfile(lowerBodyShape(), 1.78, 0.06), paint, 0, 0, 0, root);
  body.name = 'body';
  // Cabin: one tinted-glass volume framed by painted roof and pillars.
  const cabinGlass = mesh(extrudeProfile(cabinShape(0), 1.5, 0.03), glass, 0, 0, 0, root);
  cabinGlass.castShadow = false;
  mesh(new THREE.BoxGeometry(1.5, 0.06, 1.88), paint, 0, 1.435, -0.6, root);
  for (const sx of [-1, 1]) {
    const aPillar = mesh(new THREE.BoxGeometry(0.08, 0.05, 0.86), paint, sx * 0.72, 1.22, 0.66, root);
    aPillar.rotation.x = Math.atan2(1.45 - 0.99, 1.0 - 0.3);
    const cPillar = mesh(new THREE.BoxGeometry(0.16, 0.05, 0.62), paint, sx * 0.7, 1.2, -1.77, root);
    cPillar.rotation.x = -0.82;
    mesh(new THREE.BoxGeometry(0.05, 0.44, 0.09), paint, sx * 0.745, 1.2, -0.42, root);
    // Window sill trim.
    mesh(new THREE.BoxGeometry(0.03, 0.03, 2.6), trim, sx * 0.77, 1.0, -0.45, root);
  }

  // Bumpers, grille, sills.
  mesh(new THREE.BoxGeometry(1.74, 0.2, 0.18), trim, 0, 0.42, 2.07, root);
  mesh(new THREE.BoxGeometry(1.74, 0.22, 0.18), trim, 0, 0.44, -2.07, root);
  mesh(new THREE.BoxGeometry(0.9, 0.12, 0.05), trim, 0, 0.66, 2.13, root);
  for (const sx of [-1, 1]) mesh(new THREE.BoxGeometry(0.04, 0.08, 1.5), trim, sx * 0.9, 0.36, 0.02, root);

  // Lights.
  for (const sx of [-1, 1]) {
    const hl = mesh(new THREE.BoxGeometry(0.36, 0.11, 0.06), headMat, sx * 0.6, 0.73, 2.1, root);
    hl.rotation.y = sx * 0.12;
    mesh(new THREE.BoxGeometry(0.06, 0.2, 0.3), tailMat, sx * 0.86, 0.82, -2.0, root).rotation.y = sx * -0.1;
    mesh(new THREE.BoxGeometry(0.28, 0.08, 0.04), tailMat, sx * 0.68, 0.84, -2.11, root);
    // Mirrors.
    const mirror = mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), paint, sx * 0.95, 1.02, 0.75, root);
    mirror.rotation.y = sx * 0.2;
    // Door seams and handles.
    mesh(new THREE.BoxGeometry(0.005, 0.5, 0.012), trim, sx * 0.895, 0.72, 0.62, root);
    mesh(new THREE.BoxGeometry(0.005, 0.5, 0.012), trim, sx * 0.895, 0.72, -0.42, root);
    mesh(new THREE.BoxGeometry(0.02, 0.03, 0.14), chrome, sx * 0.9, 0.9, 0.38, root);
  }
  // Plates (blank, original).
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.4 });
  mesh(new THREE.BoxGeometry(0.42, 0.12, 0.01), plateMat, 0, 0.45, 2.17, root);
  mesh(new THREE.BoxGeometry(0.42, 0.12, 0.01), plateMat, 0, 0.62, -2.15, root);

  // Interior: seats, dashboard and steering wheel (visible through the glass).
  for (const sx of [-1, 1]) {
    mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), interior, sx * 0.38, 0.62, -0.25, root);
    const back = mesh(new THREE.BoxGeometry(0.48, 0.6, 0.1), interior, sx * 0.38, 0.95, -0.52, root);
    back.rotation.x = -0.18;
  }
  mesh(new THREE.BoxGeometry(1.5, 0.22, 0.4), interior, 0, 0.92, 0.72, root);
  const steering = new THREE.Group();
  steering.position.set(0.38, 0.98, 0.42);
  steering.rotation.x = -1.1;
  mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 20), trim, 0, 0, 0, steering);
  mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), trim, 0, 0, 0, steering);
  root.add(steering);

  // Wheels.
  const tireGeo = new THREE.CylinderGeometry(R, R, 0.22, 24).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(R * 0.62, R * 0.62, 0.23, 16).rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.3, metalness: 0.9 });
  const wheels = [];
  const { track, wheelBase } = CAR_DIMENSIONS;
  for (const [x, z] of [[track, wheelBase.front], [-track, wheelBase.front], [track, wheelBase.rear], [-track, wheelBase.rear]]) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(x, R, z);
    const spin = new THREE.Group();
    steerPivot.add(spin);
    mesh(tireGeo, tireMat, 0, 0, 0, spin);
    mesh(rimGeo, rimMat, 0, 0, 0, spin);
    for (let k = 0; k < 5; k++) {
      const spoke = mesh(new THREE.BoxGeometry(0.02, R * 1.15, 0.05), rimMat, Math.sign(x) * 0.115, 0, 0, spin);
      spoke.rotation.x = (k / 5) * Math.PI;
    }
    root.add(steerPivot);
    wheels.push({ steerPivot, spin });
  }

  return { root, wheels, steering, materials: { paint, headMat, tailMat } };
}
