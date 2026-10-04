import * as THREE from 'three';
import { Physics, FIXED_DT } from './Physics.js';
import { Input } from './Input.js';
import { AudioSystem } from './AudioSystem.js';
import { setMaxAnisotropy } from '../world/Textures.js';
import { Environment } from '../world/Environment.js';
import { City } from '../world/City.js';
import { Player } from '../player/Player.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { Effects } from '../weapons/Effects.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import { NPCManager } from '../npc/NPCManager.js';
import { Car } from '../vehicle/Car.js';
import { VehicleInteraction } from '../vehicle/VehicleInteraction.js';
import { HUD } from '../ui/HUD.js';

const MAX_STEPS_PER_FRAME = 5;

/** Owns every system and runs the fixed-step simulation + per-frame presentation loop. */
export class Game {
  static async create({ canvasParent, hudRoot }) {
    const physics = await Physics.init();
    return new Game(physics, canvasParent, hudRoot);
  }

  constructor(physics, canvasParent, hudRoot) {
    this.physics = physics;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    canvasParent.appendChild(renderer.domElement);
    this.renderer = renderer;
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.environment = new Environment(this.scene, renderer);

    this.city = new City(this.scene, physics);
    this.city.build();

    this.audio = new AudioSystem();
    this.input = new Input(renderer.domElement);
    this.effects = new Effects(this.scene);

    const spawn = this.city.spawn;
    this.player = new Player({ physics, scene: this.scene, audio: this.audio, spawn: spawn.player });
    this.car = new Car({ physics, scene: this.scene, audio: this.audio, spawn: spawn.car });
    this.cameraRig = new ThirdPersonCamera(this.camera, physics);
    this.cameraRig.yaw = spawn.player.yaw;

    this.npcs = new NPCManager({ physics, scene: this.scene, audio: this.audio, paths: this.city.npcPaths });
    this.hud = new HUD(hudRoot);
    this.weapons = new WeaponSystem({
      player: this.player,
      physics,
      effects: this.effects,
      audio: this.audio,
      camera: this.cameraRig,
      onShot: (pos) => this.npcs.onGunshot(pos),
      onHit: (npc) => {
        this.hud.showHit(!npc.alive);
        this.audio.play('hitMarker');
      },
    });
    this.vehicle = new VehicleInteraction({
      scene: this.scene, player: this.player, car: this.car, camera: this.cameraRig,
      weapons: this.weapons, physics, audio: this.audio,
    });

    this.accumulator = 0;
    this.lastTime = performance.now();
    this.aiming = false;

    // The physics world needs one step so colliders are queryable before the first frame.
    physics.step();
    window.addEventListener('resize', () => this.onResize());
  }

  start() {
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ------------------------------------------------------------ input

  handleFrameInput() {
    const input = this.input;
    const mouse = input.consumeMouseDelta();
    this.cameraRig.handleMouse(mouse.x, mouse.y);

    if (input.wasPressed('KeyF')) this.vehicle.toggle();
    if (input.wasPressed('KeyH')) this.hud.el.help.classList.toggle('faded');
    const onFoot = !this.vehicle.driving;
    if (onFoot) {
      if (input.wasPressed('Digit1')) this.weapons.equip('pistol');
      if (input.wasPressed('Digit2')) this.weapons.equip('rifle');
      if (input.wasPressed('KeyR')) this.weapons.reload();
      if (input.wasPressed('Space')) this.player.queueJump();
    }
    this.aiming = onFoot && !!this.weapons.active && input.isMouseDown(2) && !this.weapons.isReloading;
  }

  footIntent() {
    const input = this.input;
    let f = 0;
    let r = 0;
    if (input.isDown('KeyW')) f += 1;
    if (input.isDown('KeyS')) f -= 1;
    if (input.isDown('KeyD')) r += 1;
    if (input.isDown('KeyA')) r -= 1;
    const yaw = this.cameraRig.yaw;
    // Camera-relative: forward (sin, cos), right (-cos, sin).
    const dirX = Math.sin(yaw) * f - Math.cos(yaw) * r;
    const dirZ = Math.cos(yaw) * f + Math.sin(yaw) * r;
    const faceAim = this.aiming || this.weapons.aimHold > 0;
    return {
      dirX, dirZ,
      run: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      aimingSlow: this.aiming,
      faceAim,
      aimYaw: yaw,
    };
  }

  carInput() {
    const input = this.input;
    return {
      throttle: input.isDown('KeyW') ? 1 : 0,
      brake: input.isDown('KeyS') ? 1 : 0,
      steer: (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0),
      handbrake: input.isDown('Space'),
    };
  }

  // ------------------------------------------------------------ loop

  fixedStep(dt) {
    const driving = this.vehicle.driving;
    if (!driving) this.player.fixedUpdate(dt, this.footIntent());
    this.car.fixedUpdate(dt, driving ? this.carInput() : null);
    this.npcs.fixedUpdate(dt, this.player.currPos);
    this.physics.step();
    this.car.postStep();
    this.npcs.checkVehicle(this.car);
    if (driving) {
      // Keep the hidden on-foot body with the car so exit checks start nearby.
      this.player.currPos.copy(this.car.currPos);
      this.player.prevPos.copy(this.car.currPos);
    }
  }

  frame(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.handleFrameInput();
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
      this.fixedStep(FIXED_DT);
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    const alpha = this.accumulator / FIXED_DT;

    const driving = this.vehicle.driving;
    this.car.render(dt, alpha);
    this.player.render(dt, alpha, this.weapons.animState(this.aiming));
    if (driving) this.player.rig.update(dt, { seated: true });
    this.npcs.render(dt, alpha);

    // Camera.
    const cam = this.cameraRig;
    if (driving) cam.setMode('vehicle');
    else if (this.aiming) cam.setMode('aiming');
    else cam.setMode(this.weapons.active ? 'armed' : 'onFoot');
    const focus = driving ? this.car.position : this.player.position;
    cam.update(dt, focus, { vehicleYaw: this.car.renderYaw, vehicleSpeed: this.car.speed });

    // Weapons fire after the camera so the aim ray matches what is on screen.
    this.weapons.update(dt, {
      fireHeld: !driving && this.input.isMouseDown(0) && this.input.active,
      firePressed: !driving && this.input.wasMousePressed(0) && this.input.active,
      aiming: this.aiming,
      moving: Math.min(1, this.player.speed() / 6),
      airborne: !this.player.grounded,
      cameraYaw: cam.yaw,
    });

    this.effects.update(dt);
    this.city.update(dt);
    this.environment.update(focus);
    this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, cam.yaw);
    this.audio.updateAmbience(dt);
    if (!driving) this.audio.setEngine(false);

    this.updateHud(dt, driving);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  updateHud(dt, driving) {
    const w = this.weapons.active;
    this.hud.update(dt, {
      armed: !!w,
      driving,
      aiming: this.aiming,
      spread: this.weapons.spread,
      weaponId: w?.def.id,
      weaponName: w?.def.name,
      ammo: w?.ammo,
      reserve: w?.reserve,
      magazineSize: w?.def.magazineSize,
      reloading: this.weapons.isReloading,
      prompt: this.vehicle.prompt(),
      speed: this.car.speed,
    });
  }
}
