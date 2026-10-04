import * as THREE from 'three';
import { Materials } from './Materials.js';
import { glowTexture } from './Textures.js';
import { createRng, damp, lerp } from '../core/math.js';

/** Target conditions for each weather type. */
const STATES = {
  sunny: { cloud: 0.12, rain: 0, fog: 0, label: 'Ensolarado' },
  cloudy: { cloud: 0.8, rain: 0, fog: 0.05, label: 'Nublado' },
  rain: { cloud: 1, rain: 1, fog: 0.18, label: 'Chuva' },
  fog: { cloud: 0.55, rain: 0, fog: 1, label: 'Neblina' },
};
const NEXT = {
  sunny: ['sunny', 'cloudy', 'cloudy', 'fog'],
  cloudy: ['sunny', 'rain', 'rain', 'fog'],
  rain: ['cloudy', 'cloudy', 'sunny'],
  fog: ['sunny', 'cloudy'],
};
const DROPS = 2200;
const BOX = { x: 70, y: 40, z: 70 };
const SPLASHES = 70;

/**
 * Weather cycle (sunny, cloudy, rain, fog) with smooth transitions. Drives the
 * environment lighting, rain particles and splashes, wet street materials,
 * puddles, clouds and the rain sound.
 */
export class Weather {
  constructor({ scene, environment, audio, puddleSpots }) {
    this.environment = environment;
    this.audio = audio;
    this.rng = createRng(31337);
    this.state = 'sunny';
    this.timer = 150;
    this.current = { cloud: STATES.sunny.cloud, rain: 0, fog: 0 };
    this.wetness = 0;
    this.time = 0;

    // Rain streaks around the camera.
    const pos = new Float32Array(DROPS * 6);
    this.dropBase = new Float32Array(DROPS * 3);
    for (let i = 0; i < DROPS; i++) this.dropBase.set([Math.random() * BOX.x, Math.random() * BOX.y, Math.random() * BOX.z], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xbfd0dc, transparent: true, opacity: 0, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // Splash rings on the ground near the camera.
    this.splashMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xdde8ee, transparent: true, opacity: 0, depthWrite: false });
    this.splashes = new THREE.InstancedMesh(new THREE.RingGeometry(0.3, 0.5, 10).rotateX(-Math.PI / 2), this.splashMat, SPLASHES);
    this.splashes.frustumCulled = false;
    this.splashLife = new Float32Array(SPLASHES);
    this.splashPos = new Float32Array(SPLASHES * 3);
    scene.add(this.splashes);

    // Puddles: dark mirror-like patches that appear as the streets get wet.
    this.puddleMat = new THREE.MeshStandardMaterial({
      color: 0x1e2428, roughness: 0.03, metalness: 0.7, transparent: true, opacity: 0, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    });
    this.puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 14).rotateX(-Math.PI / 2), this.puddleMat, puddleSpots.length);
    const m = new THREE.Matrix4();
    puddleSpots.forEach((p, i) => {
      m.compose(new THREE.Vector3(p.x, p.y + 0.012, p.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw),
        new THREE.Vector3(p.sx, 1, p.sz));
      this.puddles.setMatrixAt(i, m);
    });
    this.puddles.visible = false;
    scene.add(this.puddles);

    // Low-poly cloud layer.
    this.clouds = this.buildClouds(scene);

    // Street materials that darken and turn glossy when wet.
    this.wetMaterials = ['asphalt', 'sidewalk', 'plaza', 'concrete', 'curb', 'roof'].map((k) => {
      const mat = Materials[k]();
      return { mat, roughness: mat.roughness, color: mat.color.clone() };
    });
  }

  get label() {
    return STATES[this.state].label;
  }

  /** Forces a weather type (used for testing and events). */
  set(state) {
    this.state = state;
    this.timer = 150 + this.rng.next() * 120;
  }

  buildClouds(scene) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, flatShading: true, fog: false });
    const parts = [];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + this.rng.range(-0.2, 0.2);
      const r = this.rng.range(80, 420);
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r;
      const y = this.rng.range(140, 190);
      const puffs = this.rng.int(3, 6);
      for (let k = 0; k < puffs; k++) {
        const g = new THREE.IcosahedronGeometry(this.rng.range(12, 22), 0);
        g.scale(1.4, 0.5, 1);
        g.translate(cx + this.rng.range(-25, 25), y + this.rng.range(-3, 3), cz + this.rng.range(-15, 15));
        parts.push(g);
      }
    }
    const geo = new THREE.BufferGeometry();
    const merged = parts.map((g) => g.toNonIndexed());
    const count = merged.reduce((n, g) => n + g.attributes.position.count, 0);
    const pos = new Float32Array(count * 3);
    let o = 0;
    for (const g of merged) {
      pos.set(g.attributes.position.array, o);
      o += g.attributes.position.array.length;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = -1;
    group.add(mesh);
    scene.add(group);
    this.cloudMat = mat;
    return group;
  }

  update(dt, cameraPos, night) {
    this.time += dt;
    this.timer -= dt;
    if (this.timer <= 0) this.set(this.rng.pick(NEXT[this.state]));

    const target = STATES[this.state];
    for (const k of ['cloud', 'rain', 'fog']) this.current[k] = damp(this.current[k], target[k], 0.12, dt);
    const { cloud, rain } = this.current;
    Object.assign(this.environment.weather, this.current);

    // Streets soak up quickly in rain and dry out slowly afterwards.
    const wetTarget = rain > 0.3 ? 1 : 0;
    this.wetness += (wetTarget - this.wetness) * Math.min(1, dt / (wetTarget ? 25 : 90));
    const w = this.wetness;
    for (const e of this.wetMaterials) {
      e.mat.roughness = lerp(e.roughness, 0.28, w);
      e.mat.color.copy(e.color).multiplyScalar(1 - 0.32 * w);
    }
    this.puddleMat.opacity = w * 0.8;
    this.puddles.visible = w > 0.02;

    // Clouds drift and thicken.
    this.clouds.rotation.y += dt * 0.004;
    this.cloudMat.opacity = 0.35 + cloud * 0.6;
    this.cloudMat.color.setScalar(lerp(1, 0.55, Math.max(rain, cloud * 0.4)) * lerp(1, 0.25, night));

    this.updateRain(dt, cameraPos, rain);
    this.audio.setRain(rain);
  }

  updateRain(dt, cam, amount) {
    const visible = amount > 0.02;
    this.rain.visible = visible;
    this.splashes.visible = visible;
    if (!visible) return;
    this.rain.material.opacity = amount * 0.5;
    this.splashMat.opacity = amount * 0.6;
    const pos = this.rain.geometry.attributes.position.array;
    const fall = 22 * dt;
    const windX = 1.5;
    const ox = cam.x - BOX.x / 2;
    const oz = cam.z - BOX.z / 2;
    const oy = cam.y - 12;
    const active = Math.floor(DROPS * Math.min(1, amount * 1.1));
    for (let i = 0; i < DROPS; i++) {
      const b = i * 3;
      let y = this.dropBase[b + 1] - fall;
      if (y < 0) y += BOX.y;
      this.dropBase[b + 1] = y;
      // Wrap drops into a box that follows the camera.
      const x = ox + ((this.dropBase[b] - ox) % BOX.x + BOX.x) % BOX.x;
      const z = oz + ((this.dropBase[b + 2] - oz) % BOX.z + BOX.z) % BOX.z;
      const p = i * 6;
      if (i >= active) {
        pos[p + 1] = pos[p + 4] = -500;
        continue;
      }
      pos[p] = x;
      pos[p + 1] = oy + y;
      pos[p + 2] = z;
      pos[p + 3] = x + windX * 0.04;
      pos[p + 4] = oy + y - 0.55;
      pos[p + 5] = z;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;

    // Splash rings appear and fade around the viewer.
    const m = new THREE.Matrix4();
    for (let i = 0; i < SPLASHES; i++) {
      this.splashLife[i] -= dt;
      if (this.splashLife[i] <= 0) {
        this.splashLife[i] = 0.25 + Math.random() * 0.3;
        const a = Math.random() * Math.PI * 2;
        const r = 1 + Math.random() * 16;
        this.splashPos.set([cam.x + Math.cos(a) * r, this.groundY ?? 0.02, cam.z + Math.sin(a) * r], i * 3);
      }
      const t = 1 - this.splashLife[i] / 0.55;
      const s = 0.15 + t * 0.6;
      m.makeScale(s, 1, s).setPosition(this.splashPos[i * 3], this.splashPos[i * 3 + 1] + 0.02, this.splashPos[i * 3 + 2]);
      this.splashes.setMatrixAt(i, m);
    }
    this.splashes.instanceMatrix.needsUpdate = true;
  }
}
