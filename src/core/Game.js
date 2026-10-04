import * as THREE from 'three';
import { Physics, FIXED_DT } from './Physics.js';
import { Input } from './Input.js';
import { AudioSystem } from './AudioSystem.js';
import { createRng } from './math.js';
import { setMaxAnisotropy } from '../world/Textures.js';
import { Environment } from '../world/Environment.js';
import { DayNight } from '../world/DayNight.js';
import { City } from '../world/City.js';
import { Player } from '../player/Player.js';
import { ThirdPersonCamera } from '../camera/ThirdPersonCamera.js';
import { Effects } from '../weapons/Effects.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import { NPCManager } from '../npc/NPCManager.js';
import { VehicleManager } from '../vehicle/VehicleManager.js';
import { VehicleInteraction } from '../vehicle/VehicleInteraction.js';
import { RoadNetwork } from '../traffic/RoadNetwork.js';
import { TrafficManager } from '../traffic/TrafficManager.js';
import { HUD } from '../ui/HUD.js';
import { PhysicsProps } from '../world/PhysicsProps.js';
import { Interactables } from '../world/Interactables.js';

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
    this.camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.environment = new Environment(this.scene, renderer);

    this.physicsProps = new PhysicsProps(this.scene, physics);
    this.city = new City(this.scene, physics);
    this.city.dynamicProps = this.physicsProps;
    this.audio = new AudioSystem();
    this.interactables = new Interactables(this.scene, physics, this.audio);
    this.city.interactables = this.interactables;
    this.city.build();
    this.dayNight = new DayNight({ scene: this.scene, environment: this.environment, lampHeads: this.city.props.lampHeads });

    this.input = new Input(renderer.domElement);
    this.effects = new Effects(this.scene);
    const rng = createRng(777);

    const spawn = this.city.spawn;
    this.player = new Player({ physics, scene: this.scene, audio: this.audio, spawn: spawn.player });
    this.cameraRig = new ThirdPersonCamera(this.camera, physics);
    this.cameraRig.yaw = spawn.player.yaw;

    this.npcs = new NPCManager({ physics, scene: this.scene, audio: this.audio, paths: this.city.npcPaths });
    this.network = new RoadNetwork();
    this.vehicles = new VehicleManager({ physics, scene: this.scene, audio: this.audio, rng, effects: this.effects });
    this.vehicles.spawnParked(this.city.lotSpots, this.network.curbsideSpots(), [
      ...this.city.noParking, { x: spawn.player.x, z: spawn.player.z, r: 4 },
    ]);
    for (const v of this.vehicles.list) v.persistent = true;
    this.traffic = new TrafficManager({
      physics, scene: this.scene, audio: this.audio, network: this.network, vehicles: this.vehicles,
      lights: this.city.trafficLights, randomLook: () => this.npcs.randomLook(), rng,
    });
    this.traffic.populate(this.player.currPos);

    this.hud = new HUD(hudRoot);
    this.weapons = new WeaponSystem({
      player: this.player,
      physics,
      effects: this.effects,
      audio: this.audio,
      camera: this.cameraRig,
      onShot: (pos) => this.npcs.onGunshot(pos),
      onHit: (target, region) => {
        this.hud.showHit(!target.alive, region === 'head');
        this.audio.play('hitMarker');
      },
      onVehicleHit: (vehicle, shot) => {
        vehicle.damage.applyBullet(shot.point);
        return this.traffic.hitOccupant(vehicle, shot);
      },
    });
    this.vehicle = new VehicleInteraction({
      scene: this.scene, player: this.player, vehicles: this.vehicles, traffic: this.traffic, npcs: this.npcs,
      camera: this.cameraRig, weapons: this.weapons, physics, audio: this.audio,
    });

    this.accumulator = 0;
    this.lastTime = performance.now();
    this.aiming = false;
    this.obstacles = [];

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

    if (input.wasPressed('KeyF')) this.interact();
    const onFoot = !this.vehicle.busy;
    if (input.wasPressed('KeyL') && this.vehicle.driving) {
      const pv = this.vehicles.playerVehicle;
      pv.headlightOverride = !pv.lightsOn;
      this.audio.play('switchClick');
    }
    if (input.wasPressed('KeyH')) {
      if (this.vehicle.driving) this.audio.play('horn', this.vehicles.playerVehicle?.currPos);
      else this.hud.el.help.classList.toggle('faded');
    }
    if (onFoot) {
      if (input.wasPressed('Digit1')) this.weapons.equip('pistol');
      if (input.wasPressed('Digit2')) this.weapons.equip('rifle');
      if (input.wasPressed('KeyR')) this.weapons.reload();
      if (input.wasPressed('Space')) this.player.queueJump();
    }
    this.aiming = onFoot && !!this.weapons.active && input.isMouseDown(2) && !this.weapons.isReloading;
  }

  /** What F would act on right now: the nearest door/gate or vehicle. */
  interactionTarget() {
    if (this.vehicle.busy) return { kind: 'vehicle' };
    const pos = this.player.position;
    const door = this.interactables.nearest(pos);
    const car = this.vehicles.nearestEnterable(pos);
    const carDistance = car ? car.doorPosition().distanceTo(pos) : Infinity;
    if (door && door.distance < carDistance) return { kind: 'door', item: door.item };
    return car ? { kind: 'vehicle' } : null;
  }

  interact() {
    const target = this.interactionTarget();
    if (!target) return;
    if (target.kind === 'door') target.item.interact();
    else this.vehicle.toggle();
  }

  interactionPrompt() {
    const target = this.interactionTarget();
    if (target?.kind === 'door') return target.item.prompt();
    return this.vehicle.prompt();
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
    return {
      dirX: Math.sin(yaw) * f - Math.cos(yaw) * r,
      dirZ: Math.cos(yaw) * f + Math.sin(yaw) * r,
      run: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
      aimingSlow: this.aiming,
      faceAim: this.aiming || this.weapons.aimHold > 0,
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
    if (!this.vehicle.busy) this.player.fixedUpdate(dt, this.footIntent());

    // Things traffic must yield to: pedestrians and the player on foot.
    this.obstacles.length = 0;
    this.npcs.obstacles(this.obstacles);
    if (!this.vehicle.busy) this.obstacles.push({ x: this.player.currPos.x, z: this.player.currPos.z, r: 0.4, player: true });
    this.traffic.fixedUpdate(dt, { obstacles: this.obstacles, playerPos: this.player.currPos });

    this.vehicles.fixedUpdate(dt, driving ? this.carInput() : null);
    this.npcs.fixedUpdate(dt, this.player.currPos);
    this.physics.step();
    this.vehicles.postStep();
    this.vehicles.checkPlayerContacts((v) => {
      // A hard crash can incapacitate the other driver; otherwise they get out and run.
      const impact = Math.abs(this.vehicles.playerVehicle.speed);
      if (impact > 11 && this.traffic.injureDriver(v, impact * 5)) return;
      const rig = this.traffic.release(v);
      if (rig) {
        const spot = this.vehicle.findExitSpot(v, true) ?? v.doorPosition(new THREE.Vector3());
        v.model.root.remove(rig.root);
        this.npcs.adoptDriver(rig, spot, v.currPos);
      }
    });
    this.npcs.checkVehicles(this.vehicles.list);
    if (driving) {
      // Keep the hidden on-foot body with the car so exit checks start nearby.
      const p = this.vehicles.playerVehicle.currPos;
      this.player.currPos.copy(p);
      this.player.prevPos.copy(p);
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

    const night = this.dayNight.night;
    this.vehicles.render(dt, alpha, night);
    this.player.render(dt, alpha, this.weapons.animState(this.aiming));
    this.vehicle.update(dt);
    this.npcs.render(dt, alpha, this.camera.position);

    // Camera.
    const cam = this.cameraRig;
    const pv = this.vehicles.playerVehicle ?? (this.vehicle.state === 'entering' ? this.vehicle.vehicle : null);
    if (pv) cam.setMode('vehicle');
    else if (this.aiming) cam.setMode('aiming');
    else cam.setMode(this.weapons.active ? 'armed' : 'onFoot');
    const focus = this.vehicle.focus();
    const rig = this.player.rig;
    cam.update(dt, focus, pv
      ? { vehicleYaw: pv.renderYaw, vehicleSpeed: pv.speed, vehicleLength: pv.def.length }
      : { bob: this.vehicle.busy ? 0 : rig.runBlend * rig.moveBlend, bobPhase: rig.phase });

    // Weapons fire after the camera so the aim ray matches what is on screen.
    const onFoot = !this.vehicle.busy;
    this.weapons.update(dt, {
      fireHeld: onFoot && this.input.isMouseDown(0) && this.input.active,
      firePressed: onFoot && this.input.wasMousePressed(0) && this.input.active,
      aiming: this.aiming,
      moving: Math.min(1, this.player.speed() / 6),
      airborne: !this.player.grounded,
      cameraYaw: cam.yaw,
    });

    this.physicsProps.sync();
    this.interactables.update(dt);
    this.effects.update(dt);
    this.city.update(dt);
    this.dayNight.update(dt, this.camera.position, this.vehicles.playerVehicle);
    this.environment.update(focus);
    this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, cam.yaw);
    this.audio.updateAmbience(dt);
    if (!this.vehicles.playerVehicle) this.audio.setEngine(false);
    this.updateTrafficHum();
    this.vehicles.cleanup(this.player.currPos);

    this.updateHud(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  updateTrafficHum() {
    let best = 0;
    let speed = 0;
    for (const v of this.vehicles.list) {
      if (v.mode !== 'traffic') continue;
      const d = v.currPos.distanceTo(this.camera.position);
      const p = Math.max(0, 1 - d / 28);
      if (p > best) {
        best = p;
        speed = Math.min(1, Math.abs(v.speed) / 12);
      }
    }
    this.audio.setTrafficHum(best * best, speed);
  }

  updateHud(dt) {
    const w = this.weapons.active;
    const pv = this.vehicles.playerVehicle;
    this.hud.update(dt, {
      armed: !!w,
      driving: !!pv,
      aiming: this.aiming,
      spread: this.weapons.spread,
      weaponId: w?.def.id,
      weaponName: w?.def.name,
      ammo: w?.ammo,
      reserve: w?.reserve,
      magazineSize: w?.def.magazineSize,
      reloading: this.weapons.isReloading,
      prompt: this.interactionPrompt(),
      speed: pv?.speed ?? 0,
      clock: this.dayNight.clock(),
      weather: this.weather?.label ?? null,
    });
  }
}
