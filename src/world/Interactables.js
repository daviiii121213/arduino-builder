import * as THREE from 'three';
import { Groups } from '../core/Physics.js';
import { damp } from '../core/math.js';

const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/**
 * A movable panel with a kinematic collider: hinged doors, sliding gates and
 * roll-up doors. `t` animates 0 (closed) .. 1 (open).
 */
class MovingPanel {
  constructor({ scene, physics, audio, kind, origin, yaw, width, height, depth = 0.08, material, labels, sound, uvTile = null }) {
    Object.assign(this, { physics, audio, kind, width, height, labels, sound });
    this.origin = origin.clone();
    this.yaw = yaw;
    this.t = 0;
    this.open = false;
    this.group = new THREE.Group();
    const geo = new THREE.BoxGeometry(width, height, depth);
    if (uvTile) {
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / uvTile, (uv.getY(i) * height) / uvTile);
    }
    const panel = new THREE.Mesh(geo, material);
    panel.castShadow = true;
    panel.receiveShadow = true;
    // Panel geometry spans from the pivot along local +X.
    panel.position.set(width / 2, height / 2, 0);
    this.group.add(panel);
    this.panel = panel;
    if (kind === 'door') {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.2), new THREE.MeshStandardMaterial({ color: 0xc9ccd0, metalness: 0.9, roughness: 0.3 }));
      handle.position.set(width - 0.12, 1.0, 0);
      this.group.add(handle);
    }
    scene.add(this.group);
    const R = physics.RAPIER;
    this.body = physics.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased());
    physics.world.createCollider(
      R.ColliderDesc.cuboid(width / 2, height / 2, Math.max(depth / 2, 0.05)).setTranslation(width / 2, height / 2, 0).setCollisionGroups(Groups.static),
      this.body,
    );
    this.apply(true);
  }

  /** World point used for proximity checks. */
  get center() {
    return _v.set(this.width / 2, 1, 0).applyAxisAngle(Y_AXIS, this.yaw).add(this.origin);
  }

  prompt() {
    return this.open ? this.labels.close : this.labels.open;
  }

  interact() {
    this.open = !this.open;
    this.audio.play(this.sound, this.origin);
  }

  update(dt) {
    const target = this.open ? 1 : 0;
    if (Math.abs(this.t - target) < 0.001) return;
    this.t = damp(this.t, target, this.kind === 'door' ? 7 : 3, dt);
    if (Math.abs(this.t - target) < 0.002) this.t = target;
    this.apply();
  }

  apply(teleport = false) {
    const p = this.origin.clone();
    let yaw = this.yaw;
    if (this.kind === 'door') yaw += this.t * 1.6;
    else if (this.kind === 'gate') p.add(_v.set(this.width * 0.95 * this.t, 0, 0).applyAxisAngle(Y_AXIS, this.yaw));
    else if (this.kind === 'rollup') p.y += (this.height - 0.2) * this.t;
    this.group.position.copy(p);
    this.group.rotation.set(0, yaw, 0);
    // A rolled-up door also shrinks so it does not poke through the roof.
    if (this.kind === 'rollup') this.group.scale.y = 1 - this.t * 0.85;
    _q.setFromAxisAngle(Y_AXIS, yaw);
    const rot = { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
    const pos = { x: p.x, y: p.y + (this.kind === 'rollup' ? 0 : 0), z: p.z };
    if (teleport) {
      this.body.setTranslation(pos, true);
      this.body.setRotation(rot, true);
    } else {
      this.body.setNextKinematicTranslation(pos);
      this.body.setNextKinematicRotation(rot);
    }
  }
}

const LABELS = {
  door: { open: 'Pressione F para abrir a porta', close: 'Pressione F para fechar a porta' },
  gate: { open: 'Pressione F para abrir o portão', close: 'Pressione F para fechar o portão' },
  rollup: { open: 'Pressione F para abrir o portão', close: 'Pressione F para fechar o portão' },
};

/** Registry of interactive world objects (doors and gates). */
export class Interactables {
  constructor(scene, physics, audio) {
    Object.assign(this, { scene, physics, audio });
    this.items = [];
  }

  add(kind, options) {
    const item = new MovingPanel({ scene: this.scene, physics: this.physics, audio: this.audio, kind, labels: LABELS[kind], sound: kind === 'door' ? 'doorCreak' : 'gateRoll', ...options });
    this.items.push(item);
    return item;
  }

  /** Nearest item within `maxDistance` of `pos`, with its distance. */
  nearest(pos, maxDistance = 2.2) {
    let best = null;
    let bestD = maxDistance;
    for (const item of this.items) {
      const c = item.center;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < bestD && Math.abs(c.y - 1 - pos.y) < 2) {
        bestD = d;
        best = item;
      }
    }
    return best ? { item: best, distance: bestD } : null;
  }

  update(dt) {
    for (const item of this.items) item.update(dt);
  }
}
