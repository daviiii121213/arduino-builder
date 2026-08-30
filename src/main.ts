import './style.css';
import { AudioManager } from './audio/audioManager';
import { ACHIEVEMENTS } from './data/achievements';
import { CARS } from './data/cars';
import type { GameState } from './core/gameState';
import { loadGame, saveGame } from './core/saveSystem';
import { RaceCar } from './entities/car';
import { Controls } from './input/controls';
import { msToKmh, type CarInput } from './physics/carPhysics';
import { Camera } from './render/camera';
import { drawMinimap } from './render/minimap';
import { ParticleSystem } from './render/particles';
import { Renderer } from './render/renderer';
import { formatTime, RaceManager, speedKmh, type RaceConfig } from './race/raceManager';
import { rewardForPosition } from './systems/economy';
import { UIManager, formatMoney, type StartRaceRequest } from './ui/uiManager';
import { getTrack } from './data/regions';

const state: GameState = loadGame();
const controls = new Controls(state.controlBindings);
const audio = new AudioManager(state.settings);

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
const camera = new Camera();
const renderer = new Renderer(ctx, camera);
const particles = new ParticleSystem();

let race: RaceManager | null = null;
let lastRaceConfig: RaceConfig | null = null;
let paused = false;
let unlockedAudio = false;

function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function el<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const ui = new UIManager(
  state,
  controls,
  (req) => startRace(req),
  () => audio.applySettings(state.settings),
);

document.body.addEventListener('click', () => {
  if (!unlockedAudio) {
    unlockedAudio = true;
    audio.unlock();
    audio.applySettings(state.settings);
  }
}, { once: true });

// ---------------- Race lifecycle ----------------

function startRace(req: StartRaceRequest): void {
  const trackDef = getTrack(req.trackId);
  const config: RaceConfig = {
    trackId: req.trackId,
    laps: req.laps,
    difficulty: req.difficulty,
    eventDifficulty: req.eventDifficulty,
    weather: req.weather,
    time: req.time,
    terrain: trackDef.terrain,
    eventType: req.eventType,
    opponentCount: 3,
  };
  const owned = state.ownedCars.find((c) => c.carId === state.selectedCarId)!;
  race = new RaceManager(config, owned);
  (race as any)._eventId = req.eventId;
  lastRaceConfig = config;
  audio.startEngine();
  document.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
  el('hud').classList.remove('hidden');
  el('screen-pausa').classList.add('hidden');
  el('screen-resultado').classList.add('hidden');
  paused = false;
}

function endRace(): void {
  if (!race) return;
  const results = race.results();
  const playerEntry = results.find((r) => r.car.isPlayer)!;
  const owned = state.ownedCars.find((c) => c.carId === state.selectedCarId)!;
  owned.condition = playerEntry.car.condition;

  const economy = race.economy;
  const reward = rewardForPosition(economy, playerEntry.position);
  state.money += reward;

  const repGain = Math.round((playerEntry.position === 1 ? 120 : playerEntry.position === 2 ? 70 : playerEntry.position === 3 ? 40 : 15) * (economy.multiplier / 2));
  state.reputation += repGain;

  const trackId = race.track.def.id;
  const rec = state.records[trackId] ?? { bestLap: null, bestTotal: null, topSpeed: null, bestDrift: null };
  let newRecord = false;
  if (playerEntry.car.bestLapTime !== null && (rec.bestLap === null || playerEntry.car.bestLapTime < rec.bestLap)) { rec.bestLap = playerEntry.car.bestLapTime; newRecord = true; }
  if (playerEntry.totalTime !== null && (rec.bestTotal === null || playerEntry.totalTime < rec.bestTotal)) rec.bestTotal = playerEntry.totalTime;
  if (rec.bestDrift === null || playerEntry.car.driftScore > rec.bestDrift) rec.bestDrift = playerEntry.car.driftScore;
  state.records[trackId] = rec;

  const eventId = (race as any)._eventId as string | undefined;
  if (eventId) {
    const prog = state.eventProgress[eventId] ?? { stars: 0, bestTime: null, completed: false };
    prog.completed = true;
    let stars = 1;
    if (playerEntry.position <= 3) stars = 2;
    if (playerEntry.position === 1) stars = 3;
    if (newRecord) stars = 4;
    prog.stars = Math.max(prog.stars, stars);
    if (playerEntry.totalTime !== null) prog.bestTime = prog.bestTime === null ? playerEntry.totalTime : Math.min(prog.bestTime, playerEntry.totalTime);
    state.eventProgress[eventId] = prog;
  }

  unlockAchievement('primeira_vitoria', playerEntry.position === 1);
  unlockAchievement('vitoria_sem_colisao', playerEntry.position === 1 && race.collisionsThisRace === 0);
  unlockAchievement('drift_mestre', playerEntry.car.driftScore >= 1000);
  unlockAchievement('vitoria_tempestade', playerEntry.position === 1 && race.weather.weather === 'storm');
  unlockAchievement('colecionador_50k', state.money >= 50000);
  unlockAchievement('todos_carros_interior', state.ownedCars.length >= CARS.filter((c) => !c.special).length);
  unlockAchievement('recorde_volta', newRecord);

  saveGame(state);
  ui.renderMenuHeader();

  showResults(results, playerEntry.position, reward);
  audio.stopEngine();
}

function unlockAchievement(id: string, condition: boolean): void {
  if (condition && !state.achievements[id]) state.achievements[id] = true;
}

function showResults(results: ReturnType<RaceManager['results']>, playerPos: number, reward: number): void {
  el('screen-resultado').classList.remove('hidden');
  const medal = playerPos === 1 ? '🏆 Ouro' : playerPos === 2 ? '🥈 Prata' : playerPos === 3 ? '🥉 Bronze' : 'Sem Medalha';
  el('result-medal').textContent = medal;
  const table = el<HTMLTableElement>('result-table');
  table.innerHTML = results.map((r) => `<tr><td>${r.position}º</td><td>${r.car.label}</td><td>${formatTime(r.totalTime)}</td><td>Melhor volta: ${formatTime(r.bestLap)}</td></tr>`).join('');
  el('result-rewards').textContent = `Recompensa: ${formatMoney(reward)}`;
}

el('result-continue').addEventListener('click', () => {
  el('screen-resultado').classList.add('hidden');
  el('hud').classList.add('hidden');
  race = null;
  ui.showScreen('menu');
  ui.renderMenuHeader();
});

// ---------------- Pause ----------------
el('pause-resume').addEventListener('click', () => togglePause(false));
el('pause-restart').addEventListener('click', () => {
  if (!lastRaceConfig) return;
  const owned = state.ownedCars.find((c) => c.carId === state.selectedCarId)!;
  const eventId = race ? (race as any)._eventId : undefined;
  race = new RaceManager(lastRaceConfig, owned);
  (race as any)._eventId = eventId;
  accumulator = 0;
  togglePause(false);
});
el('pause-quit').addEventListener('click', () => {
  togglePause(false);
  audio.stopEngine();
  race = null;
  el('hud').classList.add('hidden');
  ui.showScreen('menu');
});

function togglePause(force?: boolean): void {
  paused = force ?? !paused;
  el('screen-pausa').classList.toggle('hidden', !paused);
}

// ---------------- Input polling ----------------
function readPlayerInput(): CarInput {
  const steerLeft = controls.isDown('esquerda') ? -1 : 0;
  const steerRight = controls.isDown('direita') ? 1 : 0;
  let steer = steerLeft + steerRight;
  const gamepadSteer = controls.gamepadSteer();
  if (gamepadSteer !== null && gamepadSteer !== 0) steer = gamepadSteer;

  let throttle = controls.isDown('acelerar') ? 1 : 0;
  const gpThrottle = controls.gamepadThrottle();
  if (gpThrottle) throttle = Math.max(throttle, gpThrottle);

  let brake = controls.isDown('frear') ? 1 : 0;
  const gpBrake = controls.gamepadBrake();
  if (gpBrake) brake = Math.max(brake, gpBrake);

  return {
    throttle,
    brake,
    steer: Math.max(-1, Math.min(1, steer)),
    handbrake: controls.isDown('freio_mao'),
    nitro: controls.isDown('nitro'),
  };
}

// ---------------- Fixed timestep loop ----------------
const FIXED_DT = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();

function frame(now: number): void {
  let frameDt = (now - lastTime) / 1000;
  lastTime = now;
  frameDt = Math.min(frameDt, 0.25);

  if (race) {
    if (controls.wasJustPressed('pausar') && race.phase !== 'finished') togglePause();
    if (controls.wasJustPressed('buzina')) audio.playHorn();

    if (!paused && race.phase !== 'finished') {
      accumulator += frameDt;
      while (accumulator >= FIXED_DT) {
        stepRace(FIXED_DT);
        accumulator -= FIXED_DT;
      }
    }
    renderRace(frameDt);
    if (race.phase === 'finished') {
      endRace();
    }
  }
  controls.clearFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let prevPhase = '';
function stepRace(dt: number): void {
  if (!race) return;
  const input = readPlayerInput();
  race.update(dt, input);
  particles.update(dt);

  if (race.phase === 'countdown' && race.phase !== prevPhase) {
    // phase just entered
  }
  if (race.phase !== prevPhase) {
    prevPhase = race.phase;
  }

  for (const car of race.cars) {
    if (car.isDrifting) particles.spawnDust(car.body.x - Math.cos(car.body.angle) * 2, car.body.y - Math.sin(car.body.angle) * 2, race.track.sampleAt(0).surface === 'terra' ? '#8a6a3e' : '#cfcfcf');
    if ((car as any)._nitroActive) particles.spawnNitro(car.body.x, car.body.y, car.body.angle);
  }

  if (race.weather.weather === 'rain' || race.weather.weather === 'storm') {
    const count = race.weather.weather === 'storm' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      particles.spawnRain({ x0: camera.x - 60, y0: camera.y - 40, x1: camera.x + 60, y1: camera.y - 40 });
    }
  }

  const events = race.drainEvents();
  for (const e of events) {
    if (e.type === 'colisao') {
      audio.playCollision(e.data?.impactSpeed ?? 4);
      camera.addShake(0.5);
      particles.spawnSparks(e.car.body.x, e.car.body.y);
    } else if (e.type === 'fora_de_pista_reset' && e.car.isPlayer) {
      camera.addShake(0.15);
    } else if (e.type === 'nitro' && e.car.isPlayer) {
      audio.playNitro();
    }
  }

  camera.follow(race.player.body.x, race.player.body.y, dt);
  camera.update(dt);
  audio.updateEngine(Math.min(1, msToKmh(Math.abs(race.player.body.forwardSpeed)) / race.player.effectiveStats.topSpeed), readPlayerInput().throttle, (race.player as any)._nitroActive);
}

function renderRace(frameDt: number): void {
  if (!race) return;
  const w = canvas.width, h = canvas.height;
  renderer.clear(race.weather.time, w, h);
  renderer.drawTrack(race.track, w, h);
  renderer.drawPuddles(race.weather, w, h);
  renderer.drawDecorations(race.track, w, h);
  renderer.drawCars(race.cars, w, h, race.weather.time);
  renderer.drawParticles(particles, w, h);
  renderer.drawWeatherOverlay(race.weather, w, h);
  updateHud(race, frameDt);
}

// ---------------- HUD ----------------
let countdownAudioStep = 3;
function updateHud(race: RaceManager, _dt: number): void {
  const player = race.player;
  const pos = race.playerPosition();
  el('hud-position').textContent = `${pos}º/${race.cars.length}`;
  el('hud-lap').textContent = `Volta ${Math.min(player.lap + 1, race.track.def.laps)}/${race.track.def.laps}`;
  el('hud-timer').textContent = formatTime(race.raceClock);

  el('speed-value').textContent = String(Math.round(speedKmh(player)));
  setBar('bar-nitro', (player.nitro / player.baseStats.nitroCapacity) * 100);
  setBar('bar-condition', player.condition);
  setBar('bar-fuel', (player.fuel / player.baseStats.fuelCapacity) * 100);

  const offEl = el('hud-offtrack');
  if (player.offTrackTimer > 0.15) {
    offEl.classList.remove('hidden');
    el('hud-offtrack-timer').textContent = Math.max(0, 3 - player.offTrackTimer).toFixed(1);
  } else {
    offEl.classList.add('hidden');
  }

  renderControlsHud();

  if (state.settings.showMinimap) {
    el('minimap').classList.remove('hidden');
    drawMinimap(el<HTMLCanvasElement>('minimap'), race.track, race.cars);
  } else {
    el('minimap').classList.add('hidden');
  }

  const countdownEl = el('countdown');
  if (race.phase === 'countdown') {
    countdownEl.classList.remove('hidden');
    if (race.countdownValue > 0) {
      countdownEl.textContent = String(race.countdownValue);
      if (race.countdownValue !== countdownAudioStep) {
        countdownAudioStep = race.countdownValue;
        audio.playCountdownBeep(false);
      }
    } else {
      countdownEl.textContent = 'VAI!';
      if (countdownAudioStep !== 0) {
        countdownAudioStep = 0;
        audio.playCountdownBeep(true);
      }
    }
  } else {
    countdownEl.classList.add('hidden');
    countdownAudioStep = 3;
  }
}

function setBar(id: string, pct: number): void {
  const bar = el(id);
  bar.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

function renderControlsHud(): void {
  const c = el('hud-controls');
  const b = controls.bindings;
  const k = (code: string) => controls.keyLabel(code);
  c.innerHTML = `
    <div class="ctrl-row"><b>${k(b.acelerar)}</b> Acelerar <b>${k(b.frear)}</b> Frear</div>
    <div class="ctrl-row"><b>${k(b.esquerda)}</b>/<b>${k(b.direita)}</b> Direção <b>${k(b.freio_mao)}</b> Freio de Mão</div>
    <div class="ctrl-row"><b>${k(b.nitro)}</b> Nitro <b>${k(b.mapa)}</b> Mapa <b>${k(b.pausar)}</b> Pausa</div>
  `;
}
