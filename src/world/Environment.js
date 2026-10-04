import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

/**
 * Late-afternoon lighting: physical sky, warm low sun with a shadow frustum that
 * follows the player, cool sky fill and matching distance fog.
 */
export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    const sunElevation = 24;
    const sunAzimuth = 215;
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(
      1, THREE.MathUtils.degToRad(90 - sunElevation), THREE.MathUtils.degToRad(sunAzimuth),
    );

    const sky = new Sky();
    sky.scale.setScalar(4000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.86;
    u.sunPosition.value.copy(this.sunDir);
    scene.add(sky);

    // Image-based lighting from the same sky so glass and metal reflect it.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new Sky();
    envSky.scale.setScalar(1000);
    Object.assign(envSky.material.uniforms.sunPosition.value, this.sunDir);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) {
      envSky.material.uniforms[k].value = u[k].value;
    }
    envScene.add(envSky);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(900, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x3a3632 }),
    );
    ground.position.y = -5;
    envScene.add(ground);
    this.envMap = pmrem.fromScene(envScene, 0.02).texture;
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.4;
    pmrem.dispose();

    scene.fog = new THREE.Fog(0xc2c0b8, 110, 480);

    this.hemi = new THREE.HemisphereLight(0xa9c1db, 0x4a3d32, 0.55);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffd2a0, 3.4);
    this.sun.castShadow = true;
    const s = this.sun.shadow;
    s.mapSize.set(2048, 2048);
    const extent = 55;
    s.camera.left = -extent;
    s.camera.right = extent;
    s.camera.top = extent;
    s.camera.bottom = -extent;
    s.camera.near = 1;
    s.camera.far = 400;
    s.bias = -0.0004;
    s.normalBias = 0.04;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.shadowTexel = (extent * 2) / s.mapSize.x;
  }

  /** Keeps the shadow frustum centred on the focus point, snapped to texels to avoid shimmering. */
  update(focus) {
    const snap = this.shadowTexel;
    const fx = Math.round(focus.x / snap) * snap;
    const fz = Math.round(focus.z / snap) * snap;
    this.sun.target.position.set(fx, 0, fz);
    this.sun.position.set(fx + this.sunDir.x * 150, this.sunDir.y * 150, fz + this.sunDir.z * 150);
  }
}
