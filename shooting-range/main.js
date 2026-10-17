import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// O modelo está em centímetros, então todas as medidas abaixo também estão.
const MODEL_URL = 'models/shooting_range.fbx';
const TEXTURE_DIR = 'models/tex/';
const SPAWN = new THREE.Vector3(0, 0, -680);
const EYE_HEIGHT = 165;
const PLAYER_RADIUS = 30;
const WALK_SPEED = 250;
const RUN_SPEED = 450;
const ACCELERATION = 10;
const STEP_HEIGHTS = [40, 140]; // alturas (a partir do pé) dos raios de colisão

const overlay = document.getElementById('overlay');
const statusEl = document.getElementById('status');
const progressEl = document.getElementById('progress');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 5, 5000);
camera.position.set(SPAWN.x, SPAWN.y + EYE_HEIGHT, SPAWN.z);
camera.lookAt(SPAWN.x, SPAWN.y + EYE_HEIGHT, SPAWN.z + 100);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
for (const z of [-650, -100, 400]) {
  for (const x of [-500, 0, 500]) {
    const light = new THREE.PointLight(0xffffff, 1.2, 0, 0);
    light.position.set(x, 220, z);
    scene.add(light);
  }
}

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

overlay.addEventListener('click', () => controls.lock());
controls.addEventListener('lock', () => overlay.classList.add('hidden'));
controls.addEventListener('unlock', () => overlay.classList.remove('hidden'));

const keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Texturas que não vierem embutidas no FBX são buscadas em models/tex/ pelo nome do arquivo.
const manager = new THREE.LoadingManager();
manager.setURLModifier((url) => {
  if (url.startsWith('blob:') || url.startsWith('data:') || url === MODEL_URL) return url;
  const file = url.split(/[\\/]/).pop();
  return TEXTURE_DIR + encodeURIComponent(decodeURIComponent(file));
});

const colliders = [];

new FBXLoader(manager).load(
  MODEL_URL,
  (model) => {
    model.traverse((child) => {
      if (!child.isMesh) return;
      // O FBX não traz normais; sem elas a iluminação fica toda preta.
      if (!child.geometry.attributes.normal) child.geometry.computeVertexNormals();
      child.geometry.computeBoundsTree();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      let isGlass = false;
      for (const mat of materials) {
        if (/glass/i.test(mat.name)) {
          mat.transparent = true;
          mat.opacity = /frosted/i.test(mat.name) ? 0.6 : 0.25;
          mat.depthWrite = false;
          isGlass = true;
        }
      }
      // O teto não precisa de colisão; o resto bloqueia o jogador.
      if (!/ceiling/i.test(child.name) || isGlass) colliders.push(child);
    });
    scene.add(model);
    model.updateMatrixWorld(true);
    statusEl.textContent = 'Pronto!';
  },
  (event) => {
    if (event.lengthComputable) {
      progressEl.textContent = Math.round((event.loaded / event.total) * 100) + '%';
    }
  },
  (error) => {
    console.error(error);
    statusEl.textContent = 'Erro ao carregar o modelo (veja o console).';
  }
);

const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
const velocity = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const wish = new THREE.Vector3();
const origin = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

function blocked(feet, dir, distance) {
  for (const h of STEP_HEIGHTS) {
    origin.set(feet.x, feet.y + h, feet.z);
    raycaster.set(origin, dir);
    raycaster.far = distance + PLAYER_RADIUS;
    if (raycaster.intersectObjects(colliders, false).length) return true;
  }
  return false;
}

function groundHeight(feet) {
  origin.set(feet.x, feet.y + 60, feet.z);
  raycaster.set(origin, DOWN);
  raycaster.far = 200;
  const hit = raycaster.intersectObjects(colliders, false)[0];
  return hit ? hit.point.y : feet.y;
}

const axis = new THREE.Vector3();
function moveAxis(feet, dx, dz) {
  const distance = Math.hypot(dx, dz);
  if (distance === 0) return;
  axis.set(dx / distance, 0, dz / distance);
  if (!blocked(feet, axis, distance)) {
    feet.x += dx;
    feet.z += dz;
  }
}

const feet = new THREE.Vector3();
const clock = new THREE.Clock();

function update(dt) {
  if (!controls.isLocked) {
    velocity.set(0, 0, 0);
    return;
  }

  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  right.crossVectors(forward, camera.up).normalize();

  wish.set(0, 0, 0);
  if (keys.KeyW) wish.add(forward);
  if (keys.KeyS) wish.sub(forward);
  if (keys.KeyD) wish.add(right);
  if (keys.KeyA) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize();

  const speed = keys.ShiftLeft || keys.ShiftRight ? RUN_SPEED : WALK_SPEED;
  wish.multiplyScalar(speed);
  velocity.lerp(wish, Math.min(1, ACCELERATION * dt));

  feet.set(camera.position.x, camera.position.y - EYE_HEIGHT, camera.position.z);
  // Move em cada eixo separadamente para deslizar ao longo das paredes.
  moveAxis(feet, velocity.x * dt, 0);
  moveAxis(feet, 0, velocity.z * dt);
  feet.y = groundHeight(feet);

  camera.position.set(feet.x, feet.y + EYE_HEIGHT, feet.z);
}

renderer.setAnimationLoop(() => {
  update(Math.min(clock.getDelta(), 0.05));
  renderer.render(scene, camera);
});
