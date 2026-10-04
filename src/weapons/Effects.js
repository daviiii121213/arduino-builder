import * as THREE from 'three';
import { glowTexture, flashTexture, bulletHoleTexture } from '../world/Textures.js';

const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _q = new THREE.Quaternion();
const Z = new THREE.Vector3(0, 0, 1);
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3();

/**
 * Pooled, short-lived combat visuals: muzzle flashes, tracers, impact sparks,
 * dust puffs and bullet-hole decals. Nothing here allocates per shot.
 */
export class Effects {
  constructor(scene) {
    this.scene = scene;

    // Muzzle flash: two crossed additive sprites plus one persistent light.
    this.flashMat = new THREE.SpriteMaterial({
      map: flashTexture(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.flash = new THREE.Sprite(this.flashMat);
    this.flash.visible = false;
    scene.add(this.flash);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 9, 2);
    scene.add(this.flashLight);
    this.flashTime = 0;

    // Tracers.
    this.tracers = [];
    const tracerGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(tracerGeo, mat);
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerIndex = 0;

    // Sparks as a single points cloud.
    this.sparkCount = 160;
    const sparkGeo = new THREE.BufferGeometry();
    this.sparkPos = new Float32Array(this.sparkCount * 3);
    this.sparkVel = new Float32Array(this.sparkCount * 3);
    this.sparkLife = new Float32Array(this.sparkCount);
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(this.sparkPos, 3));
    this.sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
      color: 0xffc070, size: 0.06, map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.sparks.frustumCulled = false;
    scene.add(this.sparks);
    this.sparkIndex = 0;
    for (let i = 0; i < this.sparkCount; i++) this.sparkPos[i * 3 + 1] = -1000;

    // Dust puffs (also used as the non-graphic hit feedback on characters).
    this.puffs = [];
    for (let i = 0; i < 64; i++) {
      const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xb8b0a4, transparent: true, depthWrite: false, opacity: 0 });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      scene.add(s);
      this.puffs.push({ sprite: s, life: 0, max: 1, vel: new THREE.Vector3(), size: 1 });
    }
    this.puffIndex = 0;

    // Bullet holes: one instanced mesh, recycled ring-buffer style.
    this.maxDecals = 120;
    const decalMat = new THREE.MeshStandardMaterial({
      map: bulletHoleTexture(), transparent: true, depthWrite: false, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    this.decals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.12, 0.12), decalMat, this.maxDecals);
    this.decals.count = 0;
    this.decals.frustumCulled = false;
    scene.add(this.decals);
    this.decalIndex = 0;
  }

  muzzleFlash(position, direction, scale = 1) {
    this.flash.position.copy(position).addScaledVector(direction, 0.04);
    this.flash.scale.setScalar(0.32 * scale * (0.8 + Math.random() * 0.4));
    this.flashMat.rotation = Math.random() * Math.PI;
    this.flash.visible = true;
    this.flashLight.position.copy(this.flash.position);
    this.flashLight.intensity = 6 * scale;
    this.flashTime = 0.05;
  }

  tracer(from, to) {
    const t = this.tracers[this.tracerIndex++ % this.tracers.length];
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    t.mesh.position.copy(from);
    t.mesh.quaternion.setFromUnitVectors(Z, _v.subVectors(to, from).normalize());
    t.mesh.scale.set(1, 1, len);
    t.mesh.visible = true;
    t.mesh.material.opacity = 0.7;
    t.life = 0.06;
  }

  impact(point, normal, { sparks = true, dustColor = 0xb8b0a4, decal = true } = {}) {
    _n.set(normal.x, normal.y, normal.z);
    if (sparks) {
      for (let k = 0; k < 7; k++) {
        const i = this.sparkIndex++ % this.sparkCount;
        this.sparkPos[i * 3] = point.x;
        this.sparkPos[i * 3 + 1] = point.y;
        this.sparkPos[i * 3 + 2] = point.z;
        const sp = 2 + Math.random() * 4;
        this.sparkVel[i * 3] = (_n.x + (Math.random() - 0.5) * 1.4) * sp;
        this.sparkVel[i * 3 + 1] = (_n.y + Math.random() * 0.8) * sp;
        this.sparkVel[i * 3 + 2] = (_n.z + (Math.random() - 0.5) * 1.4) * sp;
        this.sparkLife[i] = 0.18 + Math.random() * 0.15;
      }
    }
    this.puff(point, _n, dustColor, 0.35, 0.5);
    if (decal) this.bulletHole(point, _n);
  }

  /** Soft, non-graphic burst used when a character is hit. */
  characterHit(point, direction) {
    _n.set(-direction.x, -direction.y, -direction.z);
    this.puff(point, _n, 0xf2efe8, 0.25, 0.3);
    this.puff(point, _n, 0xd9d4ca, 0.18, 0.25);
  }

  puff(point, normal, color, size, life) {
    const p = this.puffs[this.puffIndex++ % this.puffs.length];
    p.sprite.position.set(point.x, point.y, point.z).addScaledVector(normal, 0.05);
    p.sprite.material.color.set(color);
    p.vel.copy(normal).multiplyScalar(0.8).add(_v.set(0, 0.4, 0));
    p.life = p.max = life;
    p.size = size;
    p.sprite.visible = true;
  }

  bulletHole(point, normal) {
    const i = this.decalIndex++ % this.maxDecals;
    _q.setFromUnitVectors(Z, normal);
    _v.set(point.x, point.y, point.z).addScaledVector(normal, 0.005);
    _m.compose(_v, _q, _s.setScalar(0.8 + Math.random() * 0.4));
    this.decals.setMatrixAt(i, _m);
    this.decals.count = Math.min(this.maxDecals, Math.max(this.decals.count, i + 1));
    this.decals.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      }
    }
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.06) * 0.7;
      if (t.life <= 0) t.mesh.visible = false;
    }
    let anySpark = false;
    for (let i = 0; i < this.sparkCount; i++) {
      if (this.sparkLife[i] <= 0) continue;
      anySpark = true;
      this.sparkLife[i] -= dt;
      this.sparkVel[i * 3 + 1] -= 9.8 * dt;
      this.sparkPos[i * 3] += this.sparkVel[i * 3] * dt;
      this.sparkPos[i * 3 + 1] += this.sparkVel[i * 3 + 1] * dt;
      this.sparkPos[i * 3 + 2] += this.sparkVel[i * 3 + 2] * dt;
      if (this.sparkLife[i] <= 0) this.sparkPos[i * 3 + 1] = -1000;
    }
    if (anySpark || this.sparksDirty) {
      this.sparks.geometry.attributes.position.needsUpdate = true;
      this.sparksDirty = anySpark;
    }
    for (const p of this.puffs) {
      if (p.life <= 0) continue;
      p.life -= dt;
      const t = 1 - p.life / p.max;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.sprite.scale.setScalar(p.size * (0.6 + t * 1.6));
      p.sprite.material.opacity = (1 - t) * 0.55;
      if (p.life <= 0) p.sprite.visible = false;
    }
  }
}
