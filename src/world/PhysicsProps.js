import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Groups } from '../core/Physics.js';

function colored(geo, hex, m) {
  const g = (geo.index ? geo.toNonIndexed() : geo).clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (m) g.applyMatrix4(m);
  const c = new THREE.Color(hex);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) arr.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

/** Prop types: visual geometry (origin at the body centre) and a simple collider. */
const TYPES = {
  cone: {
    mass: 3,
    collider: (R) => R.ColliderDesc.cylinder(0.25, 0.17),
    geometry: () => mergeGeometries([
      colored(new THREE.BoxGeometry(0.42, 0.04, 0.42), 0x262626, T(0, -0.23, 0)),
      colored(new THREE.CylinderGeometry(0.035, 0.17, 0.42, 8), 0xe8662a, T(0, 0.0, 0)),
      colored(new THREE.CylinderGeometry(0.1, 0.125, 0.08, 8), 0xf2f0ea, T(0, 0.02, 0)),
    ]),
    capacity: 24,
  },
  bin: {
    mass: 14,
    collider: (R) => R.ColliderDesc.cylinder(0.45, 0.3),
    geometry: () => mergeGeometries([
      colored(new THREE.CylinderGeometry(0.3, 0.26, 0.86, 10), 0x3c5446, T(0, -0.02, 0)),
      colored(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 10), 0x2c3033, T(0, 0.43, 0)),
      colored(new THREE.BoxGeometry(0.62, 0.05, 0.08), 0x2c3033, T(0, 0.3, 0)),
    ]),
    capacity: 40,
  },
  crate: {
    mass: 12,
    collider: (R) => R.ColliderDesc.cuboid(0.35, 0.35, 0.35),
    geometry: () => mergeGeometries([
      colored(new THREE.BoxGeometry(0.7, 0.7, 0.7), 0x9a7650),
      colored(new THREE.BoxGeometry(0.72, 0.08, 0.72), 0x6f5237, T(0, 0.2, 0)),
      colored(new THREE.BoxGeometry(0.72, 0.08, 0.72), 0x6f5237, T(0, -0.2, 0)),
    ]),
    capacity: 30,
  },
  barrier: {
    mass: 18,
    collider: (R) => R.ColliderDesc.cuboid(0.75, 0.45, 0.2),
    geometry: () => mergeGeometries([
      colored(new THREE.BoxGeometry(1.5, 0.22, 0.05), 0xf2f0ea, T(0, 0.28, 0.12)),
      ...[-0.5, 0, 0.5].map((x) => colored(new THREE.BoxGeometry(0.22, 0.225, 0.055), 0xd93a2a, T(x, 0.28, 0.12))),
      colored(new THREE.BoxGeometry(0.06, 0.9, 0.06), 0x3a3d40, T(-0.65, 0, 0)),
      colored(new THREE.BoxGeometry(0.06, 0.9, 0.06), 0x3a3d40, T(0.65, 0, 0)),
      colored(new THREE.BoxGeometry(0.1, 0.04, 0.45), 0x3a3d40, T(-0.65, -0.43, 0)),
      colored(new THREE.BoxGeometry(0.1, 0.04, 0.45), 0x3a3d40, T(0.65, -0.43, 0)),
    ]),
    capacity: 12,
  },
};
const HALF_HEIGHT = { cone: 0.25, bin: 0.45, crate: 0.35, barrier: 0.45 };

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);

/**
 * Small dynamic objects (cones, bins, crates, barriers). One instanced mesh per
 * type; bodies sleep when still, so only disturbed objects cost simulation time.
 */
export class PhysicsProps {
  constructor(scene, physics) {
    this.physics = physics;
    this.R = physics.RAPIER;
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    this.sets = {};
    for (const [name, t] of Object.entries(TYPES)) {
      const mesh = new THREE.InstancedMesh(t.geometry(), this.material, t.capacity);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.sets[name] = { mesh, items: [] };
    }
    this.all = [];
  }

  /** Adds a prop standing on the ground at (x, groundY, z). */
  add(type, x, groundY, z, yaw = 0) {
    const set = this.sets[type];
    if (!set || set.items.length >= TYPES[type].capacity) return null;
    const R = this.R;
    _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const body = this.physics.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(x, groundY + HALF_HEIGHT[type] + 0.01, z)
        .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
        .setLinearDamping(0.4)
        .setAngularDamping(0.6)
        .setSleeping(true),
    );
    const collider = this.physics.world.createCollider(
      TYPES[type].collider(R).setMass(TYPES[type].mass).setFriction(0.7).setCollisionGroups(Groups.prop),
      body,
    );
    const item = {
      type, body, index: set.items.length, isProp: true,
      onImpulse: (point, dir, strength) => {
        body.applyImpulseAtPoint({ x: dir.x * strength * 8, y: dir.y * strength * 8 + strength * 2, z: dir.z * strength * 8 }, point, true);
      },
    };
    this.physics.setOwner(collider, item);
    set.items.push(item);
    set.mesh.count = set.items.length;
    this.writeMatrix(set, item);
    this.all.push(item);
    return item;
  }

  writeMatrix(set, item) {
    const t = item.body.translation();
    const r = item.body.rotation();
    _m.compose(_p.set(t.x, t.y, t.z), _q.set(r.x, r.y, r.z, r.w), _s);
    set.mesh.setMatrixAt(item.index, _m);
    set.dirty = true;
  }

  /** Pushes nearby props outward (used by small environmental events like a gust). */
  gust(center, radius, strength) {
    for (const item of this.all) {
      const t = item.body.translation();
      const dx = t.x - center.x;
      const dz = t.z - center.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const k = strength * (1 - d / radius) * (TYPES[item.type].mass / 4);
      item.body.applyImpulse({ x: dx / (d || 1) * k + strength * 0.6, y: k * 0.4, z: dz / (d || 1) * k }, true);
    }
  }

  /** Copies awake bodies into their instance matrices. */
  sync() {
    for (const set of Object.values(this.sets)) {
      for (const item of set.items) {
        if (item.body.isSleeping()) continue;
        this.writeMatrix(set, item);
        // Anything that falls off the world is put back on its feet nearby.
        if (item.body.translation().y < -5) item.body.setTranslation({ x: item.body.translation().x, y: 2, z: item.body.translation().z }, true);
      }
      if (set.dirty) {
        set.mesh.instanceMatrix.needsUpdate = true;
        set.dirty = false;
      }
    }
  }
}
