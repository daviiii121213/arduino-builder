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
import { Weather } from '../world/Weather.js';
import { VehicleUse } from '../npc/VehicleUse.js';
import { EventDirector } from '../events/EventDirector.js';
import { WantedSystem } from '../police/WantedSystem.js';
import { PoliceManager } from '../police/PoliceManager.js';
import { Breakables } from '../world/Breakables.js';
import { Accidents } from '../events/Accidents.js';
import { TrafficDriver } from '../traffic/TrafficDriver.js';
import { PopulationCycle } from '../world/PopulationCycle.js';

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
    this.breakables = new Breakables(this.scene, physics, this.audio);
    this.city.breakables = this.breakables;
    this.city.build();
    // Register the static world with the query pipeline before anything raycasts against it.
    physics.step();
    this.dayNight = new DayNight({ scene: this.scene, environment: this.environment, lampHeads: this.city.props.lampHeads });
    this.breakables.onLampChange = (i, broken) => this.dayNight.setLampBroken(i, broken);

    this.input = new Input(renderer.domElement);
    this.effects = new Effects(this.scene);
    const rng = createRng(777);

    const spawn = this.city.spawn;
    this.player = new Player({ physics, scene: this.scene, audio: this.audio, spawn: spawn.player });
    this.cameraRig = new ThirdPersonCamera(this.camera, physics);
    this.cameraRig.yaw = spawn.player.yaw;

    const game = this;
    this.npcs = new NPCManager({ physics, scene: this.scene, audio: this.audio, paths: this.city.npcPaths });
    this.network = new RoadNetwork();
    this.network.close(this.city.construction.roadClosures);
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
    for (const path of this.city.construction.workerPaths) this.npcs.addWorker(path);
    this.population = new PopulationCycle({ npcs: this.npcs, traffic: this.traffic, dayNight: this.dayNight, player: this.player });
    this.npcs.vehicles = this.vehicles;
    this.vehicleUse = new VehicleUse({
      scene: this.scene, physics, npcs: this.npcs, traffic: this.traffic, playerPosition: () => this.player.currPos,
    });
    this.accidents = new Accidents({
      npcs: this.npcs, vehicleUse: this.vehicleUse, audio: this.audio, police: null, player: { get position() { return game.player.currPos; } },
    });
    this.traffic.onCollision = (e) => this.accidents.onCollision(e);
    this.vehicles.listener = this.camera.position;
    this.vehicles.onDamageEvent = (v, ev) => this.onVehicleDamage(v, ev);
    this.eventRng = createRng(9001);
    this.events = new EventDirector(this);

    this.weather = new Weather({
      scene: this.scene, environment: this.environment, audio: this.audio, puddleSpots: this.puddleSpots(rng),
    });
    // Footsteps kick up a little spray on wet ground.
    const footstep = this.player.rig.onFootstep;
    this.player.rig.onFootstep = (run) => {
      footstep(run);
      if (this.weather.wetness > 0.3) this.effects.puff(this.player.position, { x: 0, y: 0.6, z: 0 }, 0xdfe7ec, 0.16 + run * 0.08, 0.35);
    };

    this.hud = new HUD(hudRoot);
    this.weapons = new WeaponSystem({
      player: this.player,
      physics,
      effects: this.effects,
      audio: this.audio,
      camera: this.cameraRig,
      onShot: (pos) => {
        this.npcs.onGunshot(pos);
        this.wanted.crime('gunshot', pos, this.playerInfo);
      },
      onHit: (target, region) => {
        this.hud.showHit(!target.alive, region === 'head');
        this.audio.play('hitMarker');
        if (target.isOfficer) this.wanted.crime(target.alive ? 'assaultPolice' : 'killPolice', target.currPos, this.playerInfo);
        else this.wanted.crime(target.alive ? 'assault' : 'murder', target.currPos ?? this.player.currPos, this.playerInfo);
      },
      onVehicleHit: (vehicle, shot) => {
        vehicle.damage.applyBullet(shot.point);
        if (vehicle.def.police) this.wanted.crime('damagePolice', vehicle.currPos, this.playerInfo);
        return this.traffic.hitOccupant(vehicle, shot);
      },
    });
    this.vehicle = new VehicleInteraction({
      scene: this.scene, player: this.player, vehicles: this.vehicles, traffic: this.traffic, npcs: this.npcs,
      camera: this.cameraRig, weapons: this.weapons, physics, audio: this.audio,
    });

    // Police and the wanted level.
    this.playerInfo = {
      get position() { return game.player.currPos; },
      get vehicle() { return game.vehicles.playerVehicle ?? null; },
      get speed() { return game.vehicles.playerVehicle ? Math.abs(game.vehicles.playerVehicle.speed) : game.player.speed(); },
      get alive() { return game.player.alive && !game.defeated; },
      get armed() { return !!game.weapons.active; },
      hurt: (amount) => game.player.applyDamage(amount),
    };
    this.wanted = new WantedSystem({ physics, npcs: this.npcs, audio: this.audio });
    this.wanted.hiddenTest = (p) => this.city.interiors.isInside(p);
    this.wanted.visibility = () => 1 - this.weather.current.fog * 0.6 - this.weather.current.rain * 0.3;
    this.police = new PoliceManager({
      scene: this.scene, physics, audio: this.audio, effects: this.effects, npcs: this.npcs, traffic: this.traffic,
      vehicles: this.vehicles, network: this.network, wanted: this.wanted, player: this.playerInfo,
      rng: createRng(5150), vehicleUse: this.vehicleUse,
    });
    this.police.populate();
    this.accidents.police = this.police;
    this.police.onArrest = () => this.defeat('VOCÊ FOI DETIDO', true);
    this.player.onDefeated = () => this.defeat('VOCÊ FOI DERROTADO', false);
    this.defeated = false;
    this.vehicle.onEnter = (v) => {
      if (v.def.police) {
        this.police.onPoliceCarTaken(v);
        this.wanted.crime('damagePolice', v.currPos, this.playerInfo);
      } else if (!v.stolen) this.wanted.crime(v.driver ? 'carjack' : 'theft', v.currPos, this.playerInfo);
      v.stolen = true;
    };

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

    if (this.defeated) {
      this.aiming = false;
      return;
    }
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

  /** Random spots on the roads where rain water collects. */
  puddleSpots(rng) {
    const spots = [];
    for (let i = 0; i < 90; i++) {
      const lane = this.network.lanes[Math.floor(rng.next() * this.network.lanes.length)];
      const s = rng.next() * lane.length;
      const lateral = (rng.next() - 0.5) * 7;
      spots.push({
        x: lane.start.x + lane.dir.x * s - lane.dir.z * lateral,
        y: 0,
        z: lane.start.z + lane.dir.z * s + lane.dir.x * lateral,
        yaw: rng.next() * Math.PI,
        sx: 0.8 + rng.next() * 2.2,
        sz: 0.6 + rng.next() * 1.4,
      });
    }
    return spots;
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
    if (!this.vehicle.busy) {
      this.player.fixedUpdate(dt, this.defeated ? { dirX: 0, dirZ: 0, run: false, aimingSlow: false, faceAim: false, aimYaw: 0 } : this.footIntent());
    }

    // Things traffic must yield to: pedestrians and the player on foot.
    this.obstacles.length = 0;
    this.npcs.obstacles(this.obstacles);
    this.police.obstacles(this.obstacles);
    this.breakables.obstacles(this.obstacles);
    if (!this.vehicle.busy) this.obstacles.push({ x: this.player.currPos.x, z: this.player.currPos.z, r: 0.4, player: true });
    const hazards = this.accidents.hazards.slice();
    for (const v of this.vehicles.fire.burning) hazards.push({ x: v.currPos.x, z: v.currPos.z, r: 22 });
    const trafficCtx = { obstacles: this.obstacles, playerPos: this.player.currPos, sirens: this.police.sirens(), hazards };
    this.traffic.fixedUpdate(dt, trafficCtx);
    this.police.fixedUpdate(dt, trafficCtx);
    this.wanted.update(dt, this.playerInfo);

    this.vehicles.fixedUpdate(dt, driving ? this.carInput() : null);
    this.npcs.fixedUpdate(dt, this.player.currPos);
    this.breakables.checkVehicles(this.vehicles.list, dt);
    this.physics.step();
    this.vehicles.postStep();
    this.vehicles.checkPlayerContacts((v) => {
      // A hard crash can incapacitate the other driver; otherwise they get out and run.
      const impact = Math.abs(this.vehicles.playerVehicle.speed);
      if (v.def.police) {
        // Ramming a police car: the crew bails out and the wanted level rises.
        this.wanted.crime('damagePolice', v.currPos, this.playerInfo);
        if (v.policeUnit?.driver) this.police.deploy(v.policeUnit);
        v.setMode('physics');
        return;
      }
      if (impact > 11 && this.traffic.injureDriver(v, impact * 5)) return;
      const rig = this.traffic.release(v);
      if (rig) {
        const spot = this.vehicle.findExitSpot(v, true) ?? v.doorPosition(new THREE.Vector3());
        v.model.root.remove(rig.root);
        this.npcs.adoptDriver(rig, spot, v.currPos);
      }
    });
    const pv = this.vehicles.playerVehicle;
    this.npcs.checkVehicles(this.vehicles.list, this.npcs.npcs, (car, npc) => {
      if (car === pv) this.wanted.crime(npc.alive ? 'assault' : 'murder', npc.currPos, this.playerInfo);
    });
    this.npcs.checkVehicles(this.vehicles.list, this.police.officers, (car, o) => {
      if (car === pv) this.wanted.crime(o.alive ? 'assaultPolice' : 'killPolice', o.currPos, this.playerInfo);
    });
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
    this.player.render(dt, alpha, this.defeated && !this.arrested ? { dead: true } : this.weapons.animState(this.aiming));
    this.player.regenerate(dt);
    this.police.render(dt, alpha, this.camera.position);
    this.updateDefeat(dt);
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
    const onFoot = !this.vehicle.busy && !this.defeated;
    this.weapons.update(dt, {
      fireHeld: onFoot && this.input.isMouseDown(0) && this.input.active,
      firePressed: onFoot && this.input.wasMousePressed(0) && this.input.active,
      aiming: this.aiming,
      moving: Math.min(1, this.player.speed() / 6),
      airborne: !this.player.grounded,
      cameraYaw: cam.yaw,
    });

    this.vehicleUse.update(dt);
    this.events.update(dt);
    this.accidents.update(dt);
    this.population.update(dt);
    this.breakables.update(dt, this.player.currPos);
    this.fireHarm(dt);
    this.physicsProps.sync();
    this.interactables.update(dt);
    this.effects.update(dt);
    this.city.update(dt, this.camera.position, this.audio);
    this.weather.groundY = focus.y;
    this.weather.update(dt, this.camera.position, this.dayNight.night);
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

  /** Sitting in (or standing against) a burning car hurts. */
  fireHarm(dt) {
    this.fireHurtTimer = (this.fireHurtTimer ?? 0) - dt;
    if (this.fireHurtTimer > 0 || this.defeated) return;
    const pv = this.vehicles.playerVehicle;
    let amount = 0;
    if (pv?.damage.state === 'burning') amount = 4;
    else if (!pv) {
      for (const v of this.vehicles.fire.burning) if (v.currPos.distanceTo(this.player.currPos) < v.def.length / 2 + 0.6) amount = 2;
    }
    if (amount) {
      this.fireHurtTimer = 0.5;
      this.player.applyDamage(amount);
    }
  }

  /** A car was disabled, caught fire or burnt out. */
  onVehicleDamage(v, ev) {
    const unit = v.policeUnit;
    if (ev === 'disabled' || ev === 'fire') {
      // Whoever drives an AI car gets out; police crews bail out and continue on foot.
      if (unit?.driver) this.police.deploy(unit);
      else if (v.driver instanceof TrafficDriver && !unit) {
        const rig = this.traffic.release(v);
        if (rig) this.vehicleUse.driverExits(v, rig, { flee: ev === 'fire', threat: v.currPos });
      }
      v.persistent = false;
    }
    if (ev === 'fire') {
      for (const n of this.npcs.npcs) {
        if (n.currPos.distanceTo(v.currPos) < 16) n.onDanger(v.currPos, 16, 6);
        else if (n.currPos.distanceTo(v.currPos) < 30) n.lookAt(v.currPos, 4 + Math.random() * 4);
      }
    }
    if (ev === 'destroyed' && unit) {
      // A burnt-out police car is no longer part of any unit.
      this.police.onPoliceCarTaken(v);
    }
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

  /** Player taken down or arrested: short pause, then back to the start with a clean slate. */
  defeat(text, arrested) {
    if (this.defeated) return;
    this.defeated = true;
    this.arrested = arrested;
    this.defeatTimer = 4;
    this.banner = text;
    if (this.vehicle.driving) this.vehicle.forceExit();
    this.weapons.holster();
    this.audio.play('radio', null, 0.8);
  }

  updateDefeat(dt) {
    if (!this.defeated) return;
    this.defeatTimer -= dt;
    if (this.defeatTimer > 0) return;
    const s = this.city.spawn.player;
    this.player.teleport(s.x, s.y, s.z);
    this.player.health.reset();
    this.player.rig.fallBlend = 0;
    this.wanted.clear();
    this.police.standDown();
    this.cameraRig.yaw = s.yaw;
    this.defeated = false;
    this.banner = '';
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
      wanted: this.wanted.level,
      searching: this.wanted.searching,
      health: this.player.health.value,
      banner: this.banner,
      weather: this.weather?.label ?? null,
    });
  }
}
