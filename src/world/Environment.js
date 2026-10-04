import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { clamp, lerp } from '../core/math.js';

const DAY = {
  hemiSky: new THREE.Color(0xa9c1db), hemiGround: new THREE.Color(0x4a3d32), hemi: 0.55,
  fog: new THREE.Color(0xc2c0b8), exposure: 0.8, env: 0.4,
};
const DUSK = { fog: new THREE.Color(0xc99a7a), sun: new THREE.Color(0xff9a55) };
const NIGHT = {
  hemiSky: new THREE.Color(0x5268a0), hemiGround: new THREE.Color(0x24222c), hemi: 0.7,
  fog: new THREE.Color(0x1f2a42), exposure: 1.15, env: 0.12, moon: new THREE.Color(0xa8bcff),
};
const NOON_SUN = new THREE.Color(0xfff0d8);

const _c = new THREE.Color();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _focus = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

/**
 * Sky, sun/moon light, ambient fill and fog driven by the time of day.
 * `night` (0 day .. 1 night) is exposed for lamps, windows and car lights.
 */
export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.night = 0;

    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.86;
    scene.add(this.sky);
    this.buildNightSky(scene);

    // Image-based lighting is rendered from a copy of the sky, refreshed as the sun moves.
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envSky = new Sky();
    this.envSky.scale.setScalar(1000);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) this.envSky.material.uniforms[k].value = u[k].value;
    this.envScene.add(this.envSky);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3a3632 }));
    ground.position.y = -5;
    this.envScene.add(ground);
    this.envRT = null;
    this.lastEnvElevation = 999;

    scene.fog = new THREE.Fog(DAY.fog.getHex(), 110, 480);
    this.hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffd2a0, 3.4);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    const extent = 55;
    Object.assign(s.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 400 });
    s.bias = -0.0004;
    s.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.shadowTexel = (extent * 2) / s.mapSize.x;
  }

  /** Deep-blue gradient dome and stars that fade in over the physical sky at night. */
  buildNightSky(scene) {
    const dome = new THREE.SphereGeometry(1200, 24, 12);
    const pos = dome.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const horizon = new THREE.Color(0x2c3a5e);
    const zenith = new THREE.Color(0x070c1c);
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / 1200);
      _c.copy(horizon).lerp(zenith, Math.pow(t, 0.6));
      colors.set([_c.r, _c.g, _c.b], i * 3);
    }
    dome.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.nightDome = new THREE.Mesh(dome, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    this.nightDome.renderOrder = -1;
    scene.add(this.nightDome);
    const stars = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.asin(0.08 + Math.random() * 0.92);
      stars.set([Math.cos(a) * Math.cos(e) * 1150, Math.sin(e) * 1150, Math.sin(a) * Math.cos(e) * 1150], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({
      color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false,
    }));
    this.stars.renderOrder = -1;
    scene.add(this.stars);
  }

  /** Applies lighting for `hour` (0-24). */
  setTime(hour) {
    const dayT = (hour - 6) / 12; // 0 at sunrise, 1 at sunset
    const elevation = Math.sin(dayT * Math.PI) * 62; // degrees, negative at night
    const azimuth = 90 + dayT * 180;
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elevation), THREE.MathUtils.degToRad(azimuth));
    this.elevation = elevation;
    const night = clamp((6 - elevation) / 14, 0, 1);
    this.night = night;
    const dusk = clamp(1 - Math.abs(elevation - 2) / 14, 0, 1) * (1 - night * 0.6);

    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    this.nightDome.material.opacity = night * 0.97;
    this.stars.material.opacity = Math.max(0, night - 0.4) * 1.6;
    this.nightDome.visible = night > 0.01;
    this.stars.visible = night > 0.4;

    // Key light: the sun by day, a cool moon (opposite side, fixed height) by night.
    const sunUp = clamp(elevation / 10, 0, 1);
    if (elevation > -2) {
      this.lightDir.copy(this.sunDir);
      if (this.lightDir.y < 0.08) this.lightDir.y = 0.08;
      _c.copy(NOON_SUN).lerp(DUSK.sun, clamp(1 - elevation / 30, 0, 1));
      this.sun.color.copy(_c);
      this.sun.intensity = 3.4 * sunUp;
    } else {
      this.lightDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(55), THREE.MathUtils.degToRad(azimuth + 180));
      this.sun.color.copy(NIGHT.moon);
      this.sun.intensity = 0.7 * clamp((-elevation - 2) / 8, 0, 1);
    }

    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, night);
    this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, night);
    this.hemi.intensity = lerp(DAY.hemi, NIGHT.hemi, night);
    this.scene.fog.color.copy(DAY.fog).lerp(DUSK.fog, dusk).lerp(NIGHT.fog, night);
    this.renderer.toneMappingExposure = lerp(DAY.exposure, NIGHT.exposure, night);
    this.scene.environmentIntensity = lerp(DAY.env, NIGHT.env, night);

    if (Math.abs(elevation - this.lastEnvElevation) > 3) this.refreshEnvironment();
  }

  refreshEnvironment() {
    this.lastEnvElevation = this.elevation;
    this.envSky.material.uniforms.sunPosition.value.copy(this.sunDir);
    const rt = this.pmrem.fromScene(this.envScene, 0.02);
    this.scene.environment = rt.texture;
    this.envRT?.dispose();
    this.envRT = rt;
  }

  /** Keeps the shadow frustum centred on the focus point, snapped to shadow texels in light space. */
  update(focus) {
    const snap = this.shadowTexel;
    const dir = this.lightDir;
    const right = _right.crossVectors(dir, _worldUp).normalize();
    const up = _up.crossVectors(right, dir).normalize();
    _focus.set(focus.x, 0, focus.z);
    const r = Math.round(_focus.dot(right) / snap) * snap;
    const u = Math.round(_focus.dot(up) / snap) * snap;
    const d = _focus.dot(dir);
    _focus.copy(right).multiplyScalar(r).addScaledVector(up, u).addScaledVector(dir, d);
    this.sun.target.position.copy(_focus);
    this.sun.position.copy(_focus).addScaledVector(dir, 150);
  }
}
