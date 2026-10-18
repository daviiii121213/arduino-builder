// Versão web do Shooting Range: mesma mecânica da versão em C# (Player.cs, Weapon.cs, Targets.cs...).
// Unidades em centímetros.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSETS = 'assets/';
const SPAWN = new THREE.Vector3(0, 0, -680);
const MOUSE_SENSITIVITY = 0.0025;
const BULLET_RANGE = 10000;
const DEG = Math.PI / 180;
const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

// ---------------------------------------------------------------- material (mesma luz do shader em C#)

const VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <skinning_pars_vertex>
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    #include <skinbase_vertex>
    #include <beginnormal_vertex>
    #include <skinnormal_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>
    vec4 local = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      objectNormal = mat3(instanceMatrix) * objectNormal;
    #endif
    vNormal = normalize(mat3(modelMatrix) * objectNormal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * local;
  }`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform sampler2D map;
  uniform bool hasMap;
  uniform vec3 color;
  uniform float opacity;
  uniform float unlit;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vec3 n = normalize(vNormal);
    float sky = mix(0.35, 1.0, n.y * 0.5 + 0.5);
    float sun = max(dot(n, normalize(vec3(0.3, 1.0, 0.5))), 0.0);
    float light = mix(0.35 + 0.5 * sky + 0.25 * sun, 1.0, unlit);
    vec4 albedo = vec4(color, opacity);
    if (hasMap) albedo *= texture2D(map, vUv);
    gl_FragColor = vec4(albedo.rgb * light, albedo.a);
    #include <colorspace_fragment>
  }`;

function makeMaterial({ map = null, color = [1, 1, 1], opacity = 1, unlit = 0, additive = false } = {}) {
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      map: { value: map },
      hasMap: { value: !!map },
      color: { value: new THREE.Vector3(...color) },
      opacity: { value: opacity },
      unlit: { value: unlit },
    },
    transparent: opacity < 0.99 || additive,
    depthWrite: opacity >= 0.99 && !additive,
  });
  if (additive) material.blending = THREE.AdditiveBlending;
  return material;
}

// ---------------------------------------------------------------- colisão (CollisionWorld.cs)

const CELL = 100;
const cellOf = (v) => Math.floor(v / CELL);

class CollisionWorld {
  constructor(parts) {
    let total = 0;
    for (const p of parts) total += p.indices.length / 3;
    this.tris = new Float32Array(total * 9);
    this.glass = new Uint8Array(total);
    this.stamp = new Uint32Array(total);
    this.query = 0;
    this.cells = new Map();
    let t = 0;
    for (const p of parts) {
      for (let i = 0; i < p.indices.length; i += 3, t++) {
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        for (let k = 0; k < 3; k++) {
          const v = p.indices[i + k] * 3;
          for (let a = 0; a < 3; a++) this.tris[t * 9 + k * 3 + a] = p.positions[v + a];
          minX = Math.min(minX, p.positions[v]); maxX = Math.max(maxX, p.positions[v]);
          minZ = Math.min(minZ, p.positions[v + 2]); maxZ = Math.max(maxZ, p.positions[v + 2]);
        }
        this.glass[t] = p.glass ? 1 : 0;
        for (let x = cellOf(minX); x <= cellOf(maxX); x++)
          for (let z = cellOf(minZ); z <= cellOf(maxZ); z++) {
            const key = x * 100000 + z;
            let list = this.cells.get(key);
            if (!list) this.cells.set(key, (list = []));
            list.push(t);
          }
      }
    }
    this.count = total;
  }

  // Percorre as células da grade ao longo do raio (DDA) e para no primeiro acerto.
  raycast(o, d, maxDistance, ignoreGlass = false) {
    this.query++;
    let best = null;
    let cx = cellOf(o.x), cz = cellOf(o.z);
    const stepX = d.x > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
    const tDeltaX = d.x !== 0 ? Math.abs(CELL / d.x) : Infinity;
    const tDeltaZ = d.z !== 0 ? Math.abs(CELL / d.z) : Infinity;
    let tMaxX = d.x !== 0 ? ((cx + (stepX > 0 ? 1 : 0)) * CELL - o.x) / d.x : Infinity;
    let tMaxZ = d.z !== 0 ? ((cz + (stepZ > 0 ? 1 : 0)) * CELL - o.z) / d.z : Infinity;
    let tStart = 0;
    const tr = this.tris;
    while (tStart <= maxDistance) {
      const list = this.cells.get(cx * 100000 + cz);
      if (list) {
        for (const t of list) {
          if (this.stamp[t] === this.query) continue;
          this.stamp[t] = this.query;
          if (ignoreGlass && this.glass[t]) continue;
          const hit = intersect(o, d, tr, t * 9);
          if (hit && hit.t <= maxDistance && (!best || hit.t < best.distance)) {
            const n = triangleNormal(tr, t * 9, d);
            best = { distance: hit.t, normal: n, glass: !!this.glass[t] };
          }
        }
      }
      const tEnd = Math.min(tMaxX, tMaxZ);
      if (best && best.distance <= tEnd) break;
      if (tEnd === Infinity) break;
      tStart = tEnd;
      if (tMaxX < tMaxZ) { cx += stepX; tMaxX += tDeltaX; } else { cz += stepZ; tMaxZ += tDeltaZ; }
    }
    return best;
  }
}

// Möller–Trumbore sem descartar a face de trás. Retorna t e as coordenadas baricêntricas u, v.
function intersect(o, d, tr, i) {
  const e1x = tr[i + 3] - tr[i], e1y = tr[i + 4] - tr[i + 1], e1z = tr[i + 5] - tr[i + 2];
  const e2x = tr[i + 6] - tr[i], e2y = tr[i + 7] - tr[i + 1], e2z = tr[i + 8] - tr[i + 2];
  const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-8) return null;
  const inv = 1 / det;
  const sx = o.x - tr[i], sy = o.y - tr[i + 1], sz = o.z - tr[i + 2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (d.x * qx + d.y * qy + d.z * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return t >= 0 ? { t, u, v } : null;
}

function triangleNormal(tr, i, d) {
  const a = new THREE.Vector3(tr[i], tr[i + 1], tr[i + 2]);
  const n = new THREE.Vector3(tr[i + 3], tr[i + 4], tr[i + 5]).sub(a)
    .cross(new THREE.Vector3(tr[i + 6], tr[i + 7], tr[i + 8]).sub(a)).normalize();
  return n.dot(d) > 0 ? n.negate() : n;
}

// ---------------------------------------------------------------- jogador (Player.cs)

class Player {
  static MAX_SPEED = 215; // velocidade máxima andando com o AK-47 no CS2
  static RUN_MULTIPLIER = 1.6;
  static CROUCH_MULTIPLIER = 0.34;

  constructor(spawn) {
    this.feet = spawn.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.crouch = 0;
  }

  get eyeHeight() { return 165 + (118 - 165) * this.crouch; }
  get eye() { return this.feet.clone().add(new THREE.Vector3(0, this.eyeHeight, 0)); }
  get horizontalSpeed() { return Math.hypot(this.velocity.x, this.velocity.z); }
  get flatForward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get flatRight() { return this.flatForward.cross(new THREE.Vector3(0, 1, 0)).normalize(); }

  update(dt, move, jump, crouch, run, world) {
    this.crouch = THREE.MathUtils.clamp(this.crouch + (crouch ? 1 : -1) * 8 * dt, 0, 1);
    const wishDir = this.flatRight.multiplyScalar(move.x).add(this.flatForward.multiplyScalar(move.y));
    let wishSpeed = 0;
    if (wishDir.lengthSq() > 0) {
      wishDir.normalize();
      wishSpeed = Player.MAX_SPEED * (crouch ? Player.CROUCH_MULTIPLIER : run ? Player.RUN_MULTIPLIER : 1);
    }
    if (this.onGround) {
      this.applyFriction(dt);
      this.accelerate(wishDir, wishSpeed, wishSpeed, 5.5, dt);
      if (jump) { this.velocity.y = 301.993; this.onGround = false; }
    } else {
      // No ar a velocidade desejada é limitada a 30, mas a aceleração usa a velocidade cheia.
      this.accelerate(wishDir, Math.min(wishSpeed, 30), wishSpeed, 12, dt);
      this.velocity.y -= 800 * dt;
    }
    if (!this.moveAxis(new THREE.Vector3(this.velocity.x * dt, 0, 0), world)) this.velocity.x = 0;
    if (!this.moveAxis(new THREE.Vector3(0, 0, this.velocity.z * dt), world)) this.velocity.z = 0;
    this.feet.y += this.velocity.y * dt;
    const ground = this.groundHeight(world);
    if (this.feet.y <= ground + (this.onGround ? 20 : 0) && this.velocity.y <= 0) {
      this.feet.y = ground; this.velocity.y = 0; this.onGround = true;
    } else {
      this.onGround = false;
    }
  }

  applyFriction(dt) {
    const speed = this.horizontalSpeed;
    if (speed < 0.1) { this.velocity.x = this.velocity.z = 0; return; }
    const drop = Math.max(speed, 80) * 5.2 * dt;
    const scale = Math.max(speed - drop, 0) / speed;
    this.velocity.x *= scale; this.velocity.z *= scale;
  }

  accelerate(wishDir, wishSpeed, accelBase, accel, dt) {
    if (accelBase <= 0) return;
    const current = this.velocity.x * wishDir.x + this.velocity.z * wishDir.z;
    const add = wishSpeed - current;
    if (add <= 0) return;
    const speed = Math.min(accel * accelBase * dt, add);
    this.velocity.addScaledVector(wishDir, speed);
  }

  moveAxis(move, world) {
    const distance = move.length();
    if (distance === 0) return true;
    const dir = move.clone().divideScalar(distance);
    for (const h of [35, 100]) {
      const origin = new THREE.Vector3(this.feet.x, this.feet.y + h, this.feet.z);
      if (world.raycast(origin, dir, distance + 30)) return false;
    }
    this.feet.add(move);
    return true;
  }

  groundHeight(world) {
    const origin = new THREE.Vector3(this.feet.x, this.feet.y + 60, this.feet.z);
    const hit = world.raycast(origin, new THREE.Vector3(0, -1, 0), 400);
    return hit ? origin.y - hit.distance : -Infinity;
  }
}

// ---------------------------------------------------------------- arma (Weapon.cs)

// AK-47 com a mecânica do CS2, um tiro por clique ou automático (valores em Weapon.cs).
class Weapon {
  static CLIP_SIZE = 30;
  // A câmera acompanha o recuo inteiro: a bala sai sempre no centro da mira (no CS2 seriam 45%).
  static VIEW_RECOIL_TRACKING = 1;
  // Recuo 5 vezes maior que o calibrado (fator 3, ajustado com a Glock).
  static RECOIL_IMPULSE_SCALE = 3 * 5;

  constructor(rig) {
    this.rig = rig;
    this.clip = Weapon.CLIP_SIZE;
    this.reserve = 90;
    this.animation = null;
    this.animationTime = 0;
    this.timeSinceShot = 10;
    this.aimPunch = new THREE.Vector2();
    this.aimPunchVelocity = new THREE.Vector2();
    this.accuracyPenalty = 0;
    this.cooldown = 0;
    this.fireQueued = false;
    this.automatic = false;   // segurando o botão, atira a 600 disparos/min
    this.triggerHeld = false;
    this.kick = 0;
    this.muzzleFlash = 0;
  }

  get reloading() { return this.animation === 'reload' || this.animation === 'reloadEmpty'; }
  get reloadProgress() { return this.reloading ? this.animationTime / this.rig.duration(this.animation) : 1; }
  get viewPunch() { return this.aimPunch.clone().multiplyScalar(2 * Weapon.VIEW_RECOIL_TRACKING); }

  play(animation) { this.animation = animation; this.animationTime = 0; }
  draw() { this.play('draw'); }
  inspect() { if (!this.animation) this.play('inspect'); }

  startReload() {
    if (this.reloading || this.animation === 'draw' || this.clip === Weapon.CLIP_SIZE || this.reserve === 0) return false;
    // Com o pente vazio o AK não trava o ferrolho aberto: depois de trocar o carregador é preciso manejar.
    this.play(this.clip === 0 ? 'reloadEmpty' : 'reload');
    return true;
  }

  // Um clique = um tiro. Retorna 'empty' quando o pente está vazio (e começa a recarregar, como no CS2).
  trigger() {
    if (this.reloading || this.animation === 'draw' || this.cooldown > 0) return null;
    if (this.clip === 0) { this.startReload(); return 'empty'; }
    this.fireQueued = true;
    return 'fire';
  }

  inaccuracy(player) {
    let base = 0.00641 + (0.00481 - 0.00641) * player.crouch;
    if (!player.onGround) base += 0.4;
    // Até 34% da velocidade máxima a arma continua precisa ("counter-strafe").
    const moveFactor = THREE.MathUtils.clamp((player.horizontalSpeed - 0.34 * Player.MAX_SPEED) / (0.61 * Player.MAX_SPEED), 0, 1);
    return base + 0.17506 * moveFactor + this.accuracyPenalty;
  }

  update(dt, player, onCue) {
    const shots = [];
    this.timeSinceShot += dt;
    if (this.animation) {
      const before = this.animationTime;
      this.animationTime += dt;
      for (const [t, cue] of SOUND_CUES[this.animation] || []) if (before < t && this.animationTime >= t) onCue(cue);
      if (this.animationTime >= this.rig.duration(this.animation)) {
        if (this.reloading) {
          const moved = Math.min(Weapon.CLIP_SIZE - this.clip, this.reserve);
          this.clip += moved;
          this.reserve -= moved;
        }
        this.animation = null;
      }
    }
    this.cooldown = Math.max(this.cooldown - dt, 0);
    if (this.automatic && this.triggerHeld && this.cooldown <= 0 && this.animation !== 'draw') this.fireQueued = true;
    if (this.fireQueued && !this.reloading && this.clip > 0) {
      // Atirar interrompe a inspeção, como no CS2.
      if (this.animation === 'inspect') this.animation = null;
      shots.push(this.fire(player));
      this.cooldown = 0.1; // 600 RPM
    }
    this.fireQueued = false;

    this.accuracyPenalty *= Math.exp(-dt * Math.log(10) / 0.368);

    // Recuo da Source: integra a velocidade e decai (exponencial 8 + linear 18 graus/s).
    this.aimPunch.addScaledVector(this.aimPunchVelocity, dt * 0.5);
    this.aimPunchVelocity.multiplyScalar(Math.exp(-dt * 4.5));
    this.aimPunch.addScaledVector(this.aimPunchVelocity, dt * 0.5);
    this.aimPunch.multiplyScalar(Math.exp(-dt * 8));
    const length = this.aimPunch.length();
    if (length > 0) this.aimPunch.multiplyScalar(Math.max(length - 18 * dt, 0) / length);

    this.kick = Math.max(this.kick - dt * 8, 0);
    this.muzzleFlash = Math.max(this.muzzleFlash - dt, 0);
    return shots;
  }

  fire(player) {
    this.clip--;
    this.timeSinceShot = 0;
    const inaccuracy = this.inaccuracy(player);
    const pitch = player.pitch + this.aimPunch.x * 2 * DEG;
    const yaw = player.yaw - this.aimPunch.y * 2 * DEG;
    const forward = new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw));
    const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    const up = right.clone().cross(forward);
    // Espalhamento do CS: um círculo da imprecisão somado a um do spread fixo.
    const a0 = Math.random() * Math.PI * 2, r0 = Math.random() * inaccuracy;
    const a1 = Math.random() * Math.PI * 2, r1 = Math.random() * 0.0006;
    const x = Math.cos(a0) * r0 + Math.cos(a1) * r1;
    const y = Math.sin(a0) * r0 + Math.sin(a1) * r1;
    const direction = forward.addScaledVector(right, x).addScaledVector(up, y).normalize();

    this.accuracyPenalty += 0.0078;
    const angle = (Math.random() * 2 - 1) * 70 * DEG;
    this.aimPunchVelocity.add(new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar(30 * Weapon.RECOIL_IMPULSE_SCALE));
    this.kick = 1;
    this.muzzleFlash = 0.06;
    return { origin: player.eye, direction };
  }
}

// Sons das animações (instante em segundos): retém, carregador saindo/entrando, ferrolho.
const SOUND_CUES = {
  reload: [[0.42, 'click'], [0.55, 'mag'], [1.65, 'mag']],
  reloadEmpty: [[0.42, 'click'], [0.55, 'mag'], [1.65, 'mag'], [2.22, 'bolt'], [2.28, 'bolt']],
  draw: [[0.48, 'bolt'], [0.53, 'bolt']],
};

// ---------------------------------------------------------------- arma e braços em primeira pessoa (ViewmodelRig.cs)

// Lê ak_viewmodel.json (o mesmo da versão em C#) e interpola poses e trilhas das animações.
class ViewmodelRig {
  constructor(data) {
    this.data = data;
    this.armsOffset = new THREE.Vector3(...data.armsOffset);
    this.gunOffset = new THREE.Vector3(...data.gunOffset);
    this.rotation = new THREE.Vector3(...data.rotation);
    this.magPivot = new THREE.Vector3(...data.magPivot);
    this.magReleasePivot = new THREE.Vector3(...data.magReleasePivot);
    this.ejectionPort = new THREE.Vector3(...data.ejectionPort);
    this.muzzle = new THREE.Vector3(...data.muzzle);
    this.poses = {};
    for (const [name, bones] of Object.entries(data.poses))
      this.poses[name] = Object.fromEntries(Object.entries(bones).map(([b, q]) => [b, new THREE.Quaternion(...q)]));
  }

  duration(name) { return this.data.animations[name].duration; }

  evaluate(animation, time, fireTime) {
    const frame = { armPose: this.poses.hold, rootRotation: new THREE.Vector3(), rootOffset: new THREE.Vector3(),
      magRotation: 0, magOffset: new THREE.Vector3(), magRelease: 0, bolt: 0 };
    const a = animation && this.data.animations[animation];
    if (a) {
      if (a.arms) frame.armPose = this.evaluatePose(a.arms, time);
      if (a.root) {
        const r = evaluateTrack(a.root.map(([t, rot, pos]) => [t, ...rot, ...pos]), time);
        frame.rootRotation.set(r[0], r[1], r[2]);
        frame.rootOffset.set(r[3], r[4], r[5]);
      }
      if (a.mag) { const m = evaluateTrack(a.mag, time); frame.magRotation = m[0]; frame.magOffset.set(m[1], m[2], m[3]); }
      if (a.magRelease) frame.magRelease = evaluateTrack(a.magRelease, time)[0];
      if (a.bolt) frame.bolt = evaluateTrack(a.bolt, time)[0];
    }
    // O ferrolho também corre a cada tiro (o gás empurra o porta-ferrolho para trás e a mola o devolve).
    const fire = this.data.animations.fire;
    if (fireTime < fire.duration) frame.bolt = Math.min(frame.bolt, evaluateTrack(fire.bolt, fireTime)[0]);
    return frame;
  }

  evaluatePose(keys, t) {
    const [i, u] = segment(keys.map((k) => k[0]), t);
    const a = this.poses[keys[i][1]], b = this.poses[keys[Math.min(i + 1, keys.length - 1)][1]];
    const result = {};
    for (const bone of new Set([...Object.keys(a), ...Object.keys(b)]))
      result[bone] = (a[bone] || new THREE.Quaternion()).clone().slerp(b[bone] || new THREE.Quaternion(), u);
    return result;
  }
}

// Índice da chave anterior a t e o avanço (0..1, suavizado) até a próxima.
function segment(times, t) {
  if (t <= times[0]) return [0, 0];
  for (let i = 0; i < times.length - 1; i++) {
    if (t < times[i + 1]) {
      const x = (t - times[i]) / (times[i + 1] - times[i]);
      return [i, x * x * (3 - 2 * x)];
    }
  }
  return [times.length - 1, 0];
}

function evaluateTrack(keys, t) {
  const [i, u] = segment(keys.map((k) => k[0]), t);
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  return a.slice(1).map((v, k) => v + (b[k + 1] - v) * u);
}

// ---------------------------------------------------------------- alvos (Targets.cs)

class ShootingTarget {
  static MIN_Z = -150;
  static MAX_Z = 760;

  constructor(name, parts) {
    this.name = name;
    this.parts = parts;
    this.offsetZ = 0;
    this.destinationZ = 0;
    this.wait = 0;
    let sum = 0, n = 0;
    for (const p of parts) for (let i = 2; i < p.positions.length; i += 3) { sum += p.positions[i]; n++; }
    this.baseZ = sum / n;
  }

  get currentZ() { return this.baseZ + this.offsetZ; }

  relocate() {
    let z;
    do z = ShootingTarget.MIN_Z + Math.random() * (ShootingTarget.MAX_Z - ShootingTarget.MIN_Z);
    while (Math.abs(z - this.currentZ) < 150);
    this.destinationZ = z - this.baseZ;
    this.wait = 0.35;
  }

  update(dt) {
    if (this.wait > 0) { this.wait -= dt; return; }
    const dz = this.destinationZ - this.offsetZ, step = 350 * dt;
    this.offsetZ = Math.abs(dz) <= step ? this.destinationZ : this.offsetZ + Math.sign(dz) * step;
    for (const p of this.parts) p.mesh.position.z = this.offsetZ;
  }

  raycast(origin, direction, maxDistance) {
    const local = origin.clone(); local.z -= this.offsetZ;
    let best = null;
    const tri = new Float32Array(9);
    for (const p of this.parts) {
      for (let i = 0; i < p.indices.length; i += 3) {
        const ia = p.indices[i], ib = p.indices[i + 1], ic = p.indices[i + 2];
        for (let a = 0; a < 3; a++) {
          tri[a] = p.positions[ia * 3 + a]; tri[3 + a] = p.positions[ib * 3 + a]; tri[6 + a] = p.positions[ic * 3 + a];
        }
        const hit = intersect(local, direction, tri, 0);
        if (!hit || hit.t > maxDistance || (best && hit.t >= best.distance)) continue;
        const w = 1 - hit.u - hit.v;
        best = {
          distance: hit.t,
          normal: triangleNormal(tri, 0, direction),
          localPoint: local.clone().addScaledVector(direction, hit.t),
          onPaper: p.material.includes('Paper'),
          uv: [
            p.uvs[ia * 2] * w + p.uvs[ib * 2] * hit.u + p.uvs[ic * 2] * hit.v,
            p.uvs[ia * 2 + 1] * w + p.uvs[ib * 2 + 1] * hit.u + p.uvs[ic * 2 + 1] * hit.v,
          ],
        };
      }
    }
    return best;
  }
}

// Pontuação do papel. Medidas em pixels da textura "Target Paper_C" (1000x1000, y para baixo).
class TargetScoring {
  constructor(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    this.pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  score([u0, v0]) {
    const u = u0 - Math.floor(u0), v = v0 - Math.floor(v0);
    const px = u * 1000, py = (1 - v) * 1000;
    for (const [cx, cy] of [[498, 180], [306, 236], [692, 236]]) {
      const d = Math.hypot(px - cx, py - cy);
      for (const [radius, points] of [[20, 10], [44, 9], [72, 8]]) if (d <= radius) return points;
    }
    // Anéis do tronco em formato de pílula vertical.
    for (const [hw, hh, points] of [[48.5, 75, 10], [101.5, 151.5, 9], [151.5, 226.5, 8], [202, 301.5, 7]]) {
      const dx = Math.abs(px - 498.5), dy = Math.max(Math.abs(py - 638.5) - (hh - hw), 0);
      if (dx * dx + dy * dy <= hw * hw) return points;
    }
    const { width, height, data } = this.pixels;
    const x = Math.min(Math.floor(u * width), width - 1), y = Math.min(Math.floor((1 - v) * height), height - 1);
    const o = (y * width + x) * 4;
    return Math.min(data[o], data[o + 1], data[o + 2]) < 160 ? 5 : 0;
  }
}

// ---------------------------------------------------------------- baias (Booths.cs)

// Baias numeradas como as placas: a 1 fica em x = +747 e a 10 em x = -747 (166 cm cada).
// Só as baias 1, 4, 6 e 9 têm sessão com pontuação própria e resumo na saída.
const SCORED_BOOTHS = [1, 4, 6, 9];
function scoredBoothAt(feet) {
  if (feet.z < -500 || feet.z > -353) return null; // entre o portão e o balcão
  const lane = Math.round((747 - feet.x) / 166) + 1;
  return SCORED_BOOTHS.includes(lane) ? lane : null;
}

class BoothSession {
  constructor(booth) { this.booth = booth; this.score = 0; this.shots = 0; this.hits = 0; this.pointsBeforeMiss = []; }
  // points = 0 é erro (parede, papel branco ou suporte do alvo).
  record(points) {
    this.shots++;
    if (points > 0) { this.hits++; this.score += points; } else this.pointsBeforeMiss.push(this.score);
  }
}

// ---------------------------------------------------------------- som (sintetizado, sem arquivos)

class Sound {
  constructor() { this.ctx = null; }
  unlock() {
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return; }
      const length = this.ctx.sampleRate * 0.4;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    this.ctx.resume?.();
  }
  burst(duration, frequency, gain, type = 'lowpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t); src.stop(t + duration);
  }
  shot() { this.burst(0.3, 1800, 1.0); this.burst(0.16, 140, 1.4); }
  click() { this.burst(0.03, 3000, 0.3, 'highpass'); }
  mag() { this.burst(0.05, 900, 0.45, 'bandpass'); this.burst(0.03, 2600, 0.25, 'highpass'); }
  bolt() { this.burst(0.06, 1500, 0.5, 'bandpass'); }
  cue(name) { if (this[name]) this[name](); }
  hit() { this.burst(0.08, 1200, 0.25, 'bandpass'); }
}

// ---------------------------------------------------------------- carregamento

const ui = {
  overlay: document.getElementById('overlay'),
  status: document.getElementById('status'),
  start: document.getElementById('start'),
  score: document.getElementById('score'),
  popup: document.getElementById('popup'),
  stats: document.getElementById('stats'),
  ammo: document.getElementById('ammo'),
  reserve: document.getElementById('reserve'),
  mode: document.getElementById('mode'),
  reload: document.getElementById('reload'),
  reloadBar: document.getElementById('reload-bar'),
  notice: document.getElementById('notice'),
  crosshair: document.getElementById('crosshair'),
  scoreLabel: document.getElementById('score-label'),
  summary: document.getElementById('summary'),
  sumTitle: document.getElementById('sum-title'),
  sumTotal: document.getElementById('sum-total'),
  sumStats: document.getElementById('sum-stats'),
  sumTable: document.getElementById('sum-table'),
  sumRows: document.getElementById('sum-rows'),
  sumNone: document.getElementById('sum-none'),
  sumClose: document.getElementById('sum-close'),
  auto: document.getElementById('auto'),
  autoState: document.getElementById('auto-state'),
};

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;
renderer.setClearColor(0x121212);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 5, 5000);
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 1, 500);

window.addEventListener('resize', () => {
  camera.aspect = vmCamera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  vmCamera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Os arquivos de textura ficam sem espaços no nome ("Floor 01_C.jpg" vira "Floor_01_C.jpg").
const assetUrl = (name) => ASSETS + name.replace(/ /g, '_');
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();
function loadTexture(file) {
  if (!textureCache.has(file)) {
    const texture = textureLoader.load(assetUrl(file));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    textureCache.set(file, texture);
  }
  return textureCache.get(file);
}

// Os arquivos binários (cenário, FBX dos braços, GLB da arma) são publicados em base64 dentro de .txt,
// porque o servidor do Artifact só entrega tipos conhecidos.
async function fetchBinary(name, onProgress = () => {}) {
  const text = new TextDecoder().decode(await fetchWithProgress(ASSETS + name + '.txt', onProgress));
  const raw = atob(text.trim());
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function fetchWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const total = +response.headers.get('content-length') || 0;
  if (!total || !response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded / total);
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out.buffer;
}

async function loadScene() {
  const manifest = await (await fetch(ASSETS + 'scene.json')).json();
  const bin = await fetchBinary('scene.bin', (f) => (ui.status.textContent = `Carregando cenário… ${Math.round(f * 100)}%`));
  const parts = [];
  for (const p of manifest.parts) {
    const qp = new Uint16Array(bin, p.positionOffset, p.vertexCount * 3);
    const qt = new Uint16Array(bin, p.uvOffset, p.vertexCount * 2);
    const indices = p.index32 ? new Uint32Array(bin, p.indexOffset, p.indexCount) : new Uint16Array(bin, p.indexOffset, p.indexCount);
    const positions = new Float32Array(p.vertexCount * 3);
    const uvs = new Float32Array(p.vertexCount * 2);
    for (let i = 0; i < p.vertexCount; i++) {
      for (let a = 0; a < 3; a++) positions[i * 3 + a] = p.positionMin[a] + (qp[i * 3 + a] / 65535) * (p.positionMax[a] - p.positionMin[a]);
      for (let a = 0; a < 2; a++) uvs[i * 2 + a] = p.uvMin[a] + (qt[i * 2 + a] / 65535) * (p.uvMax[a] - p.uvMin[a]);
    }
    // Normais por face (sem suavizar), como o Assimp gera na versão em C#.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const flat = geometry.toNonIndexed();
    flat.computeVertexNormals();

    const glass = p.material.includes('Glass');
    // As cores do FBX são usadas como estão (igual à versão em C#).
    const color = new THREE.Color(...p.color).convertLinearToSRGB().toArray();
    const material = makeMaterial({
      map: p.texture ? loadTexture(p.texture) : null,
      color: p.texture ? [1, 1, 1] : color,
      opacity: glass ? (p.material.includes('Frosted') ? 0.6 : 0.25) : 1,
    });
    const mesh = new THREE.Mesh(flat, material);
    mesh.matrixAutoUpdate = true;
    scene.add(mesh);
    parts.push({ name: p.name, material: p.material, positions, uvs, indices, glass, mesh });
  }
  return parts;
}

// ---------------------------------------------------------------- jogo

const player = new Player(SPAWN);
let weapon, rig;
const sound = new Sound();
const keys = {};
let world, targets, scoring, armsRoot, gunRoot, viewmodel, flashOuter, flashInner, casingMesh;
let armBones = {}, armRest = {}, armsAnimated = true, drawn = false;
const gunParts = {};
const casings = [];
const holes = { rim: null, core: null, dust: null, wall: null, list: [] };
let session = null, summaryOpen = false;
const state = { score: 0, hits: 0, shots: 0, popupTime: 0, bobTime: 0, sway: new THREE.Vector2(), jump: false };
let playing = false, ready = false;

const KICK_BACK = 3;   // cm que a arma recua no tiro
const KICK_PITCH = 4;  // graus que o cano sobe no tiro
const MAX_HOLES = 300;

async function boot(saved) {
  try {
    const parts = await loadScene();
    const targetParts = parts.filter((p) => p.name.includes('Target'));
    const groups = new Map();
    for (const p of targetParts) {
      if (!groups.has(p.name)) groups.set(p.name, []);
      groups.get(p.name).push(p);
    }
    targets = [...groups].map(([name, ps]) => new ShootingTarget(name, ps));
    world = new CollisionWorld(parts.filter((p) => !targetParts.includes(p)));

    ui.status.textContent = 'Carregando braços e arma…';
    const paperImage = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = reject;
      img.src = assetUrl('Target Paper_C.jpg');
    });
    scoring = new TargetScoring(paperImage);
    rig = new ViewmodelRig(await (await fetch(ASSETS + 'ak_viewmodel.json')).json());
    weapon = new Weapon(rig);
    let savedAuto = false;
    try { savedAuto = localStorage.getItem('automatic') === '1'; } catch { /* sem armazenamento */ }
    setAutomatic(savedAuto);
    await loadViewmodel();
    setupHoles();

    if (saved) restore(saved);
    ready = true;
    ui.status.textContent = 'Pronto';
    ui.start.disabled = false;
    ui.start.textContent = 'Clique para jogar';
  } catch (error) {
    console.error(error);
    ui.status.textContent = 'Não foi possível carregar o jogo. Recarregue a página.';
  }
}

async function loadViewmodel() {
  // O FBX dos braços aponta para texturas que não usamos (a textura é aplicada abaixo); evita buscá-las.
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (url.endsWith('.fbx') ? url : EMPTY_IMAGE));
  const arms = new FBXLoader(manager).parse(await fetchBinary('arms.fbx'), ASSETS);
  const armTexture = loadTexture('armColor.jpg');
  arms.traverse((o) => {
    if (o.isMesh) { o.material = makeMaterial({ map: armTexture }); o.frustumCulled = false; }
    if (o.isBone) { armBones[o.name] = o; armRest[o.name] = o.quaternion.clone(); }
  });

  // AKM em peças (body, mag, bolt, magrelease, selector), já em cm com o cano em +Z e origem no punho.
  const gltf = await new GLTFLoader().parseAsync(await fetchBinary('akm.glb'), ASSETS);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    o.material = makeMaterial({ color: o.material.color.toArray() });
    o.frustumCulled = false;
    const part = o.name.split('_')[0];
    (gunParts[part] ||= []).push(o);
    o.matrixAutoUpdate = false;
  });

  // Os modelos apontam para +Z; a câmera olha para -Z, então giram 180° em Y.
  armsRoot = new THREE.Group(); armsRoot.add(arms); armsRoot.rotation.y = Math.PI; armsRoot.position.copy(rig.armsOffset);
  gunRoot = new THREE.Group(); gunRoot.add(gltf.scene); gunRoot.rotation.y = Math.PI; gunRoot.position.copy(rig.gunOffset);
  viewmodel = new THREE.Group();
  viewmodel.matrixAutoUpdate = false;
  viewmodel.add(armsRoot, gunRoot);
  vmScene.add(viewmodel);

  flashOuter = new THREE.Mesh(new THREE.BufferGeometry(), makeMaterial({ color: [1, 0.55, 0.15], opacity: 0.8, unlit: 1, additive: true }));
  flashInner = new THREE.Mesh(new THREE.BufferGeometry(), makeMaterial({ color: [1, 0.9, 0.6], unlit: 1, additive: true }));
  for (const f of [flashOuter, flashInner]) {
    f.material.depthTest = false; f.renderOrder = 10; f.frustumCulled = false; f.visible = false; vmScene.add(f);
  }

  // Estojos de 7,62x39 mm (~1,1 x 3,9 cm), cor de latão.
  casingMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 1.1, 3.9), makeMaterial({ color: [0.47, 0.26, 0.04] }), 32);
  casingMesh.count = 0; casingMesh.frustumCulled = false;
  vmScene.add(casingMesh);
}

// Peças móveis do AKM, no espaço da arma: carregador (balança em volta da frente e desce),
// retém do carregador e porta-ferrolho (corre para trás).
function setPartTransforms(frame) {
  const around = (pivot, rotation, extra = new THREE.Vector3()) => new THREE.Matrix4()
    .makeTranslation(pivot.clone().add(extra))
    .multiply(new THREE.Matrix4().makeRotationX(rotation * DEG))
    .multiply(new THREE.Matrix4().makeTranslation(pivot.clone().negate()));
  const transforms = {
    mag: around(rig.magPivot, frame.magRotation, frame.magOffset),
    magrelease: around(rig.magReleasePivot, frame.magRelease),
    bolt: new THREE.Matrix4().makeTranslation(0, 0, frame.bolt),
  };
  for (const [part, meshes] of Object.entries(gunParts))
    for (const mesh of meshes) { mesh.matrix.copy(transforms[part] || new THREE.Matrix4()); mesh.matrixWorldNeedsUpdate = true; }
}

// Pose dos braços: rotação extra sobre a pose original de cada osso.
function setArmPose(pose) {
  for (const [name, bone] of Object.entries(armBones)) {
    bone.quaternion.copy(armRest[name]);
    if (pose[name]) bone.quaternion.multiply(pose[name]);
  }
}

function ejectCasing() {
  viewmodel.updateMatrixWorld(true);
  const position = rig.ejectionPort.clone().applyMatrix4(gunRoot.matrixWorld);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate();
  casings.push({
    position,
    velocity: right.multiplyScalar(180 + Math.random() * 60).addScaledVector(up, 120 + Math.random() * 60).addScaledVector(forward, -(20 + Math.random() * 30)),
    quaternion: camera.quaternion.clone(),
    spinAxis: new THREE.Vector3(Math.random(), 1, Math.random()).normalize(),
    age: 0,
  });
  if (casings.length > 32) casings.shift();
}

function updateCasings(dt) {
  for (const c of casings) {
    c.age += dt;
    c.velocity.y -= 800 * dt;
    c.position.addScaledVector(c.velocity, dt);
    c.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(c.spinAxis, 25 * dt));
  }
  while (casings.length && casings[0].age > 0.9) casings.shift();
  casings.forEach((c, i) => casingMesh.setMatrixAt(i, tmpMatrix.compose(c.position, c.quaternion, new THREE.Vector3(1, 1, 1))));
  casingMesh.count = casings.length;
  casingMesh.instanceMatrix.needsUpdate = true;
}

// Furos de bala: discos instanciados que acompanham o alvo quando ele anda.
function setupHoles() {
  const disc = new THREE.CircleGeometry(1, 10);
  const make = (color, opacity) => {
    const material = makeMaterial({ color, opacity });
    material.transparent = true; material.depthWrite = false;
    material.polygonOffset = true; material.polygonOffsetFactor = -2; material.polygonOffsetUnits = -2;
    const mesh = new THREE.InstancedMesh(disc, material, MAX_HOLES);
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 5;
    scene.add(mesh);
    return mesh;
  };
  holes.rim = make([0.85, 0.83, 0.78], 1);
  holes.core = make([0.03, 0.03, 0.03], 1);
  // Na parede: halo claro de reboco lascado (aparece até nas paredes escuras) e o furo escuro por cima.
  holes.dust = make([0.55, 0.53, 0.5], 0.7);
  holes.wall = make([0.03, 0.03, 0.03], 0.95);
}

function addHole(target, point, normal, onPaper) {
  holes.list.push({ target, point, normal, onPaper });
  if (holes.list.length > MAX_HOLES) holes.list.shift();
}

const tmpMatrix = new THREE.Matrix4(), tmpQuat = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
function updateHoles() {
  const counts = { rim: 0, core: 0, dust: 0, wall: 0 };
  const put = (mesh, key, position, quaternion, radius) => {
    tmpMatrix.compose(position, quaternion, new THREE.Vector3(radius, radius, radius));
    mesh.setMatrixAt(counts[key]++, tmpMatrix);
  };
  for (const h of holes.list) {
    const position = h.point.clone().addScaledVector(h.normal, 0.05);
    if (h.target) position.z += h.target.offsetZ;
    tmpQuat.setFromUnitVectors(zAxis, h.normal);
    if (h.onPaper) { put(holes.rim, 'rim', position, tmpQuat, 1.4); put(holes.core, 'core', position, tmpQuat, 0.8); }
    else { put(holes.dust, 'dust', position, tmpQuat, 2.4); put(holes.wall, 'wall', position.addScaledVector(h.normal, 0.02), tmpQuat, 1.0); }
  }
  for (const key of ['rim', 'core', 'dust', 'wall']) {
    holes[key].count = counts[key];
    holes[key].instanceMatrix.needsUpdate = true;
  }
}

// Entrar numa baia com pontuação zera os pontos; sair dela mostra o resumo numa tela separada.
function updateBooth() {
  const booth = scoredBoothAt(player.feet);
  if (booth === (session ? session.booth : null)) return;
  if (session && session.shots > 0) showSummary(session);
  session = booth ? new BoothSession(booth) : null;
  state.score = state.shots = state.hits = 0;
}

function showSummary(s) {
  summaryOpen = true;
  ui.sumTitle.textContent = `Baia ${s.booth}`;
  ui.sumTotal.textContent = s.score;
  ui.sumStats.textContent = `${s.shots} tiros · ${s.hits} acertos · ${s.pointsBeforeMiss.length} erros · ${Math.round((100 * s.hits) / s.shots)}%`;
  ui.sumRows.replaceChildren(...s.pointsBeforeMiss.map((before, i) => {
    const streak = before - (i > 0 ? s.pointsBeforeMiss[i - 1] : 0);
    const tr = document.createElement('tr');
    for (const [text, cls] of [[`${i + 1}º erro`, ''], [before, 'num'], [`+${streak}`, streak > 0 ? 'num up' : 'num']]) {
      const td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.append(td);
    }
    return tr;
  }));
  ui.sumTable.hidden = s.pointsBeforeMiss.length === 0;
  ui.sumNone.hidden = s.pointsBeforeMiss.length > 0;
  ui.summary.hidden = false;
  stopPlaying();
  try { document.exitPointerLock?.(); } catch { /* sem pointer lock */ }
}

function processShot(shot) {
  const points = shotPoints(shot);
  if (session) session.record(points);
}

// Pontos do tiro (0 = errou).
function shotPoints(shot) {
  state.shots++;
  // As balas atravessam vidro, como no CS.
  const wall = world.raycast(shot.origin, shot.direction, BULLET_RANGE, true);
  const wallDistance = wall ? wall.distance : BULLET_RANGE;
  let hitTarget = null, best = null;
  for (const target of targets) {
    const hit = target.raycast(shot.origin, shot.direction, wallDistance);
    if (hit && (!best || hit.distance < best.distance)) { hitTarget = target; best = hit; }
  }
  if (hitTarget) {
    addHole(hitTarget, best.localPoint, best.normal, best.onPaper);
    const points = best.onPaper ? scoring.score(best.uv) : 0;
    showPopup(points);
    if (points > 0) {
      state.hits++;
      state.score += points;
      hitTarget.relocate();
      sound.hit();
    }
    return points;
  }
  if (wall) addHole(null, shot.origin.clone().addScaledVector(shot.direction, wall.distance), wall.normal, false);
  return 0;
}

function showPopup(points) {
  state.popupTime = 1.2;
  ui.popup.textContent = points > 0 ? `+${points}` : 'Errou';
  ui.popup.dataset.tier = points === 10 ? 'x' : points >= 7 ? 'ring' : points > 0 ? 'body' : 'miss';
  ui.popup.classList.remove('show');
  void ui.popup.offsetWidth; // reinicia a animação
  ui.popup.classList.add('show');
}

function update(dt) {
  const move = new THREE.Vector2();
  let crouch = false, run = false;
  if (playing) {
    if (keys.KeyW) move.y += 1;
    if (keys.KeyS) move.y -= 1;
    if (keys.KeyD) move.x += 1;
    if (keys.KeyA) move.x -= 1;
    crouch = !!(keys.ControlLeft || keys.ControlRight || keys.KeyC);
    run = !!(keys.ShiftLeft || keys.ShiftRight);
  }
  player.update(dt, move, state.jump, crouch, run, world);
  updateBooth();
  state.jump = false;

  const shots = weapon.update(dt, player, (cue) => sound.cue(cue));
  for (const shot of shots) { sound.shot(); processShot(shot); state.pendingCasings = (state.pendingCasings || 0) + 1; }
  updateCasings(dt);
  for (const target of targets) target.update(dt);
  state.popupTime = Math.max(state.popupTime - dt, 0);

  const speedFactor = player.onGround ? player.horizontalSpeed / Player.MAX_SPEED : 0;
  state.bobTime += dt * 11 * speedFactor;
  state.sway.clampScalar(-2.5, 2.5).lerp(new THREE.Vector2(), Math.min(1, 8 * dt));
}

// Balanço ao andar, atraso do mouse, coice do tiro e a animação atual (em coordenadas da câmera).
function viewmodelMatrix(frame) {
  const offset = new THREE.Vector3(
    Math.sin(state.bobTime * 0.5) * 0.8 + state.sway.x,
    -Math.abs(Math.sin(state.bobTime)) * 0.8 - state.sway.y,
    0).add(frame.rootOffset);
  const kick = weapon.kick * weapon.kick;
  offset.z += kick * KICK_BACK;
  // Rotações em volta do punho: giro, inclinação (com o coice) e rolagem.
  const angles = rig.rotation.clone().add(frame.rootRotation);
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    angles.x * DEG + kick * KICK_PITCH * DEG, angles.y * DEG, angles.z * DEG, 'YXZ'));
  return new THREE.Matrix4().makeTranslation(offset)
    .multiply(new THREE.Matrix4().makeTranslation(rig.gunOffset))
    .multiply(rotation)
    .multiply(new THREE.Matrix4().makeTranslation(rig.gunOffset.clone().negate()));
}

function render() {
  const punch = weapon.viewPunch.multiplyScalar(DEG);
  const pitch = player.pitch + punch.x, yaw = player.yaw - punch.y;
  const eye = player.eye;
  camera.position.copy(eye);
  camera.lookAt(eye.clone().add(new THREE.Vector3(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw))));
  camera.updateMatrixWorld();
  vmCamera.position.copy(camera.position);
  vmCamera.quaternion.copy(camera.quaternion);
  vmCamera.updateMatrixWorld();

  updateHoles();
  renderer.clear();
  renderer.render(scene, camera);

  // Arma e braços por cima de tudo: limpa a profundidade para não atravessarem paredes.
  const frame = rig.evaluate(weapon.animation, weapon.animationTime, weapon.timeSinceShot);
  if (weapon.animation || armsAnimated) { setArmPose(frame.armPose); armsAnimated = !!weapon.animation; }
  setPartTransforms(frame);
  viewmodel.matrix.copy(camera.matrixWorld).multiply(viewmodelMatrix(frame));
  viewmodel.matrixWorldNeedsUpdate = true;
  for (; state.pendingCasings > 0; state.pendingCasings--) ejectCasing();
  updateMuzzleFlash();
  renderer.clearDepth();
  renderer.render(vmScene, vmCamera);
}

// Clarão em estrela, de frente para a câmera.
function updateMuzzleFlash() {
  const visible = weapon.muzzleFlash > 0;
  flashOuter.visible = flashInner.visible = visible;
  if (!visible) return;
  viewmodel.updateMatrixWorld(true);
  const position = rig.muzzle.clone().applyMatrix4(gunRoot.matrixWorld);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const spin = Math.random() * Math.PI;
  const spikes = (mesh, length, width, count) => {
    const v = [];
    for (let i = 0; i < count; i++) {
      const a = spin + (Math.PI * 2 * i) / count;
      const dir = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
      const side = right.clone().multiplyScalar(-Math.sin(a)).addScaledVector(up, Math.cos(a));
      v.push(...position.clone().addScaledVector(side, width).toArray(),
        ...position.clone().addScaledVector(side, -width).toArray(),
        ...position.clone().addScaledVector(dir, length).toArray());
    }
    mesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    mesh.geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(v.length).fill(0), 3));
    mesh.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((v.length / 3) * 2).fill(0), 2));
  };
  spikes(flashOuter, 4.5 + Math.random() * 2, 1.1, 6);
  spikes(flashInner, 2.2, 1.2, 8);
}

// Mira do CS (verde, quatro traços): a abertura acompanha a imprecisão atual da arma.
function updateCrosshair() {
  const spread = Math.tan(weapon.inaccuracy(player)) / Math.tan((75 * DEG) / 2) * (window.innerHeight / 2);
  ui.crosshair.style.setProperty('--gap', `${Math.min(4 + spread, window.innerHeight * 0.3).toFixed(1)}px`);
}

function updateHud() {
  ui.score.textContent = state.score;
  ui.scoreLabel.textContent = session ? `Baia ${session.booth} · Pontos` : 'Treino · Pontos';
  const accuracy = state.shots ? Math.round((100 * state.hits) / state.shots) : 0;
  ui.stats.textContent = `Acertos ${state.hits}/${state.shots} · ${accuracy}%`;
  ui.ammo.textContent = weapon.clip;
  ui.reserve.textContent = `/ ${weapon.reserve}`;
  updateCrosshair();
  ui.mode.textContent = weapon.automatic ? 'AK-47 · Auto' : 'AK-47 · Semi';
  ui.reload.hidden = !weapon.reloading;
  ui.reloadBar.style.transform = `scaleX(${weapon.reloadProgress})`;
  ui.notice.hidden = !(weapon.clip === 0 && weapon.reserve === 0);
  ui.crosshair.hidden = !playing;
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!ready) return;
  update(dt);
  render();
  updateHud();
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- entrada

function startPlaying() {
  if (!ready) return;
  sound.unlock();
  playing = true;
  ui.overlay.hidden = true;
  // Na primeira vez a arma é sacada (animação de "deploy").
  if (!drawn) { weapon.draw(); drawn = true; }
  // Pointer lock pode não existir (alguns apps/celulares): sem ele, o movimento do mouse ainda gira a câmera.
  try { const p = renderer.domElement.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* segue sem travar o mouse */ }
}

function stopPlaying() {
  playing = false;
  weapon.triggerHeld = false;
  ui.overlay.hidden = summaryOpen; // com o resumo aberto, o menu só aparece depois de fechá-lo
  for (const k in keys) keys[k] = false;
}

ui.start.addEventListener('click', (e) => { e.stopPropagation(); startPlaying(); });
ui.sumClose.addEventListener('click', (e) => {
  e.stopPropagation();
  summaryOpen = false;
  ui.summary.hidden = true;
  startPlaying();
});
// Esc solta o mouse travado; isso pausa o jogo (só se o mouse chegou a ser travado).
let locked = false;
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) locked = true;
  else if (locked) { locked = false; if (playing) stopPlaying(); }
});

renderer.domElement.addEventListener('mousedown', (e) => {
  if (!playing) return;
  if (e.button !== 0) return;
  weapon.triggerHeld = true;
  if (weapon.trigger() === 'empty') sound.click();
});
window.addEventListener('mouseup', (e) => { if (e.button === 0 && weapon) weapon.triggerHeld = false; });
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('mousemove', (e) => {
  if (!playing) return;
  player.yaw -= e.movementX * MOUSE_SENSITIVITY;
  player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * MOUSE_SENSITIVITY, -1.5, 1.5);
  state.sway.x -= e.movementX * 0.04;
  state.sway.y -= e.movementY * 0.04;
});

window.addEventListener('keydown', (e) => {
  if (!playing) return;
  keys[e.code] = true;
  if (e.code === 'KeyR') weapon.startReload();
  if (e.code === 'KeyF') weapon.inspect();
  if (e.code === 'Space') state.jump = true;
  if (e.code === 'Escape') stopPlaying();
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ControlLeft'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (weapon) weapon.triggerHeld = false; });

// Opção do menu: arma automática. A escolha fica salva neste navegador.
function setAutomatic(on) {
  if (weapon) weapon.automatic = on;
  ui.auto.setAttribute('aria-pressed', String(on));
  ui.autoState.textContent = on ? 'Ativado' : 'Desativado';
  try { localStorage.setItem('automatic', on ? '1' : '0'); } catch { /* sem armazenamento: só não lembra */ }
}
ui.auto.addEventListener('click', (e) => { e.stopPropagation(); setAutomatic(!(weapon && weapon.automatic)); });

// ---------------------------------------------------------------- estado entre atualizações da página

function snapshot() {
  return {
    score: state.score, hits: state.hits, shots: state.shots,
    clip: weapon.clip, reserve: weapon.reserve,
    feet: player.feet.toArray(), yaw: player.yaw, pitch: player.pitch,
  };
}

function restore(s) {
  if (typeof s.score !== 'number') return;
  Object.assign(state, { score: s.score, hits: s.hits, shots: s.shots });
  Object.assign(weapon, { clip: s.clip, reserve: s.reserve });
  player.feet.fromArray(s.feet);
  player.yaw = s.yaw;
  player.pitch = s.pitch;
}

window.claude?.hot?.snapshot?.(snapshot);
if (window.claude?.hot?.ready) window.claude.hot.ready(boot);
else boot(window.claude?.hot?.data ?? null);
