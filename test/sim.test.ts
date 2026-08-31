/**
 * Headless checks for everything that doesn't need a canvas: track geometry,
 * car physics, lap counting, collisions and a full AI-only race.
 */
import { AIDriver, RaceCar, resolveCarCollision, resolveObstacleCollision } from '../src/car';
import { CAR_MAPS, CAR_STATS } from '../src/cars';
import { DECOR_MAPS } from '../src/decor';
import { buildTracks, type Track } from '../src/tracks';
import { wrapAngle } from '../src/math';
import { DECOR_MAPS as DECOR } from '../src/decor';
import { ICON_MAPS } from '../src/icons';
import { supports, textWidth } from '../src/font';
import { WEATHERS, weatherById, DEFAULT_WEATHER } from '../src/weather';
import { MenuModel, PAUSE_ROWS, SETTINGS_ROWS } from '../src/menu';
import { ALL_KEYS, LANGUAGES, RAW_STRINGS, getLanguage, page, setLanguage, t } from '../src/i18n';
import { supports as fontSupports } from '../src/font';
import { DRIVER_LOOKS, DRIVER_MAPS, awardForPlace } from '../src/drivers';
import { LIGHT_MAP_ROWS } from '../src/icons';
import { START_BEATS, startSignalAt } from '../src/race';
import { RECOVERY_DELAY, RECOVERY_PENALTY, RECOVERY_POWER } from '../src/car';

let failures = 0;
let checks = 0;

function check(name: string, cond: boolean, detail = ''): void {
  checks++;
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

const TOTAL_LAPS = 3;
const STEP = 1 / 120;

section('pixel art maps are rectangular');
for (const car of CAR_MAPS) {
  const widths = new Set(car.map.map((r) => r.length));
  check(`car ${car.id} rows all same width`, widths.size === 1, [...widths].join(','));
  check(`car ${car.id} has pixels`, car.map.join('').replace(/\./g, '').length > 100);
}
for (const [name, def] of Object.entries(DECOR_MAPS)) {
  const widths = new Set(def.map.map((r) => r.length));
  check(`decor ${name} rows all same width`, widths.size === 1, [...widths].join(','));
  const chars = new Set(def.map.join('').split(''));
  const unknown = [...chars].filter((c) => !(c in def.palette));
  check(`decor ${name} palette covers every char`, unknown.length === 0, unknown.join(''));
}

const tracks = buildTracks();
check('three tracks exist', tracks.length === 3);

for (const track of tracks) {
  section(`track: ${track.def.name}`);
  const def = track.def;

  check('has a smooth waypoint loop', track.count > 100, String(track.count));
  check('lap is a sensible length', track.totalLen > 2000 && track.totalLen < 12000, String(Math.round(track.totalLen)));

  // The loop must not fold back onto itself, or laps would short-circuit.
  let minGap = Infinity;
  for (let i = 0; i < track.count; i++) {
    for (let j = i + 1; j < track.count; j++) {
      const apart = Math.min(j - i, track.count - (j - i));
      if (apart < 14) continue;
      const a = track.wp(i);
      const b = track.wp(j);
      minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }
  check('track never overlaps itself', minGap > def.halfWidth * 2 + 12, `min gap ${minGap.toFixed(1)}`);

  let inside = true;
  for (const p of track.waypoints) {
    const m = def.halfWidth + 20;
    if (p.x < m || p.y < m || p.x > def.worldW - m || p.y > def.worldH - m) inside = false;
  }
  check('track fits inside the world bounds', inside);

  for (let slot = 0; slot < 4; slot++) {
    const g = track.startSlot(slot);
    check(`grid slot ${slot} sits on the surface`, track.onTrack(g.pos));
    const frac = track.nearest(g.pos).along / track.totalLen;
    check(`grid slot ${slot} lines up behind the start line`, frac > 0.94, frac.toFixed(3));
  }
  check(
    'start line sits on a straight',
    track.radius(0) > 300 && track.radius(-3) > 300 && track.radius(5) > 300,
    [track.radius(-3), track.radius(0), track.radius(5)].map((r) => Math.round(r)).join('/'),
  );

  const solids = track.decor.filter((d) => d.radius > 0);
  check('has roadside decoration', track.decor.length > 60, String(track.decor.length));
  check(
    'no prop blocks the racing surface',
    track.decor.every((d) => track.nearest(d.pos).dist >= def.halfWidth + 12),
  );
  check('solid props are indexed for collisions', solids.every((s) => track.nearbySolids(s.pos).includes(s)));
}

function makeCar(track: Track, statIndex: number, slot = 0): RaceCar {
  const spec = CAR_STATS[statIndex];
  const grid = track.startSlot(slot);
  const car = new RaceCar({
    pos: grid.pos,
    heading: grid.heading,
    stats: spec.stats,
    isPlayer: slot === 0,
    name: spec.name,
    carIndex: statIndex,
  });
  car.primeGrid(track);
  return car;
}

/**
 * Runs the physics with the car pinned to one spot on the map, so the surface
 * under it stays constant and only the longitudinal model is exercised.
 */
function runPinned(track: Track, car: RaceCar, seconds: number, pin: { x: number; y: number }): void {
  for (let i = 0; i < Math.round(seconds * 120); i++) {
    car.pos.x = pin.x;
    car.pos.y = pin.y;
    car.update(STEP, track);
  }
}

section('car physics');
{
  const track = tracks[0];
  const car = makeCar(track, 0);
  const pin = { ...car.pos };
  car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, car, 8, pin);
  const top = car.forwardSpeed;
  check('accelerates towards its top speed', top > car.stats.maxSpeed * 0.9, top.toFixed(1));
  check('never exceeds its top speed', top <= car.stats.maxSpeed + 0.01);

  car.controls = { throttle: -1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, car, 2, pin);
  check('braking sheds speed', car.forwardSpeed < top * 0.5, car.forwardSpeed.toFixed(1));

  runPinned(track, car, 3, pin);
  check('reverses below its reverse limit', car.forwardSpeed < 0 && car.forwardSpeed >= -car.stats.reverseMax - 0.01, car.forwardSpeed.toFixed(1));
}
{
  const track = tracks[0];
  const car = makeCar(track, 0);
  const h0 = car.heading;
  car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  for (let i = 0; i < 60; i++) car.update(STEP, track);
  const hStraight = car.heading;
  check('drives straight with no steering input', Math.abs(wrapAngle(hStraight - h0)) < 1e-6);
  car.controls = { throttle: 1, steer: 1, handbrake: false, nitro: false };
  for (let i = 0; i < 60; i++) car.update(STEP, track);
  check('steering right turns the car right', wrapAngle(car.heading - hStraight) > 0.05);
  car.controls = { throttle: 1, steer: -1, handbrake: false, nitro: false };
  const before = car.heading;
  for (let i = 0; i < 120; i++) car.update(STEP, track);
  check('steering left turns the car left', wrapAngle(car.heading - before) < -0.05);
}
{
  const track = tracks[0];
  const parked = makeCar(track, 0);
  parked.controls = { throttle: 0, steer: 1, handbrake: false, nitro: false };
  const h = parked.heading;
  for (let i = 0; i < 120; i++) parked.update(STEP, track);
  check('a stationary car cannot spin on the spot', Math.abs(parked.heading - h) < 1e-9);
}
{
  // Same throttle, on the surface vs out on the grass.
  const track = tracks[0];
  const onTrack = makeCar(track, 0);
  onTrack.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, onTrack, 6, { ...onTrack.pos });

  const offTrack = makeCar(track, 0);
  const h = offTrack.heading;
  const grass = {
    x: offTrack.pos.x - Math.sin(h) * (track.def.halfWidth + 40),
    y: offTrack.pos.y + Math.cos(h) * (track.def.halfWidth + 40),
  };
  offTrack.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, offTrack, 6, grass);

  check('grass is slower than the racing surface', offTrack.forwardSpeed < onTrack.forwardSpeed * 0.6, `${offTrack.forwardSpeed.toFixed(1)} vs ${onTrack.forwardSpeed.toFixed(1)}`);
  check('off-track flag is set on the grass', offTrack.offTrack && !onTrack.offTrack);
}
{
  const dirt = tracks[1];
  const asphalt = tracks[0];
  const a = makeCar(asphalt, 0);
  const d = makeCar(dirt, 0);
  for (const [car, track] of [[a, asphalt], [d, dirt]] as Array<[RaceCar, Track]>) {
    const pin = { ...car.pos };
    car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
    runPinned(track, car, 3, pin);
    car.controls = { throttle: 1, steer: 1, handbrake: false, nitro: false };
    runPinned(track, car, 0.5, pin);
  }
  check('dirt slides more than asphalt', d.slip > a.slip, `${d.slip.toFixed(1)} vs ${a.slip.toFixed(1)}`);
}

section('car stats differ meaningfully');
{
  const n = CAR_STATS.length;
  const uniq = (pick: (s: (typeof CAR_STATS)[number]['stats']) => number): number =>
    new Set(CAR_STATS.map((c) => pick(c.stats))).size;
  check('six cars', n === 6, String(n));
  check('every car has a name and a blurb', CAR_STATS.every((c) => c.name.length > 2 && c.blurb.length > 20));
  check('top speeds differ', uniq((s) => s.maxSpeed) === n);
  check('acceleration differs', uniq((s) => s.accel) === n);
  check('handling differs', uniq((s) => s.turnRate) === n);
  check('nitro capacity differs', uniq((s) => s.nitroCapacity) === n);
  check('every car has a usable nitro boost', CAR_STATS.every((c) => c.stats.nitroBoost > 1 && c.stats.nitroRegen > 0));
}

section('menu artwork maps');
for (const [name, def] of Object.entries(ICON_MAPS)) {
  const widths = new Set(def.map.map((r) => r.length));
  check(`icon ${name} is rectangular`, widths.size === 1, [...widths].join(','));
  const unknown = [...new Set(def.map.join(''))].filter((c) => !(c in def.palette));
  check(`icon ${name} palette covers every char`, unknown.length === 0, unknown.join(''));
}
{
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:-_/%!?()<>+=*';
  check('font covers the alphabet used by the menus', [...alphabet].every(supports));
  check('text width scales with the string', textWidth('AAA', { scale: 2 }) === 34, String(textWidth('AAA', { scale: 2 })));
  check('decor art is still intact', Object.keys(DECOR).length >= 8);
}

section('nitro');
{
  const track = tracks[0];
  const boosted = makeCar(track, 0);
  const plain = makeCar(track, 0);
  const pin = { ...boosted.pos };
  boosted.controls = { throttle: 1, steer: 0, handbrake: false, nitro: true };
  plain.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, boosted, 2.5, pin);
  runPinned(track, plain, 2.5, pin);
  check('nitro makes the car faster', boosted.forwardSpeed > plain.forwardSpeed * 1.05, `${boosted.forwardSpeed.toFixed(1)} vs ${plain.forwardSpeed.toFixed(1)}`);
  check('nitro drains while it burns', boosted.nitro < boosted.stats.nitroCapacity - 2, boosted.nitro.toFixed(2));
  check('not using nitro leaves the tank full', Math.abs(plain.nitro - plain.stats.nitroCapacity) < 1e-6);

  // Hold it down until the tank is dry, then let it refill.
  runPinned(track, boosted, 10, pin);
  check('the tank empties and locks out', boosted.nitro === 0 && !boosted.nitroActive && boosted.nitroLocked);
  const drySpeed = boosted.forwardSpeed;
  check('an empty tank gives no boost', drySpeed <= boosted.stats.maxSpeed + 0.01, drySpeed.toFixed(1));
  boosted.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, boosted, 3, pin);
  check('nitro refills when released', boosted.nitro > 0.5, boosted.nitro.toFixed(2));
  check('the lockout clears once a quarter tank is back', !boosted.nitroLocked);
  check('nitro never exceeds the tank size', boosted.nitro <= boosted.stats.nitroCapacity + 1e-9);

  const zephyr = CAR_STATS.find((c) => c.id === 'zephyr');
  const vulcan = CAR_STATS.find((c) => c.id === 'vulcan');
  check('the two new cars exist', Boolean(zephyr && vulcan));
  check('vulcan carries the biggest tank', vulcan!.stats.nitroCapacity === Math.max(...CAR_STATS.map((c) => c.stats.nitroCapacity)));
}

section('weather');
{
  check('three conditions', WEATHERS.length === 3, WEATHERS.map((w) => w.id).join(','));
  check('sunny is the neutral baseline', DEFAULT_WEATHER.gripMul === 1 && DEFAULT_WEATHER.speedMul === 1 && DEFAULT_WEATHER.visibility === 1);
  check('rain cuts grip', weatherById('rain').gripMul < 0.8);
  check('night cuts visibility', weatherById('night').visibility < 0.5);
  check('every condition has a name and a blurb', WEATHERS.every((w) => w.name.length > 2 && w.blurb.length > 20));

  // Same car, same corner, dry versus wet: the wet one slides more and ends up
  // further from the racing line.
  const track = tracks[0];
  const dry = makeCar(track, 0);
  const wet = makeCar(track, 0);
  for (const [car, weather] of [[dry, weatherById('sunny')], [wet, weatherById('rain')]] as const) {
    const pin = { ...car.pos };
    car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
    for (let i = 0; i < 120 * 3; i++) {
      car.pos.x = pin.x;
      car.pos.y = pin.y;
      car.update(STEP, track, weather);
    }
    car.controls = { throttle: 1, steer: 1, handbrake: false, nitro: false };
    for (let i = 0; i < 60; i++) {
      car.pos.x = pin.x;
      car.pos.y = pin.y;
      car.update(STEP, track, weather);
    }
  }
  check('rain slides more than a dry track', wet.slip > dry.slip, `${wet.slip.toFixed(1)} vs ${dry.slip.toFixed(1)}`);
  check('rain is slower in a straight line', wet.forwardSpeed < dry.forwardSpeed, `${wet.forwardSpeed.toFixed(1)} vs ${dry.forwardSpeed.toFixed(1)}`);
}

section('menu navigation');
{
  const menu = new MenuModel(6, 3, 3);
  const screen = (): string => menu.screen;
  check('starts on the main screen', screen() === 'main' && menu.index === 0);
  menu.input('down');
  check('moving lands on settings', menu.index === 1);
  menu.input('confirm');
  check('settings opens', screen() === 'settings');
  menu.input('confirm');
  check('controls page opens', screen() === 'controls');
  menu.input('back');
  check('back returns to settings', screen() === 'settings' && menu.index === 0);
  menu.input('down');
  menu.input('confirm');
  check('sound page opens', screen() === 'sound');
  const before = menu.sound.master;
  menu.input('left');
  check('left lowers the volume', menu.sound.master < before, `${before} -> ${menu.sound.master}`);
  menu.input('right');
  menu.input('right');
  check('volume is clamped to 1', menu.sound.master <= 1);
  menu.index = 3;
  menu.input('confirm');
  check('mute toggles', menu.sound.muted === true);
  menu.input('back');
  menu.input('back');
  check('back reaches the main screen', screen() === 'main');

  menu.index = 0;
  menu.input('confirm');
  check('play opens car select', screen() === 'car');
  menu.input('down');
  menu.input('down');
  check('car selection follows the cursor', menu.carIndex === 2);
  menu.input('confirm');
  check('car select leads to track select', screen() === 'track');
  menu.input('down');
  menu.input('confirm');
  check('track select leads to weather select', screen() === 'weather' && menu.trackIndex === 1);
  menu.input('down');
  menu.input('down');
  const events = menu.input('confirm');
  const start = events.find((e) => e.type === 'start');
  check('confirming the weather starts the race', Boolean(start));
  check(
    'the race carries the picked car, track and weather',
    start !== undefined && start.type === 'start' && start.car === 2 && start.track === 1 && start.weather === 2,
    JSON.stringify(start),
  );
  check('every screen index stays in range', menu.index < menu.count);
}

section('collisions');
{
  const track = tracks[0];
  const a = makeCar(track, 0, 0);
  const b = makeCar(track, 1, 1);
  b.pos = { x: a.pos.x + 4, y: a.pos.y };
  const hit = resolveCarCollision(a, b);
  const apart = Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y);
  check('overlapping cars are detected', hit);
  check('overlapping cars are pushed apart', apart >= a.stats.radius + b.stats.radius - 0.001, apart.toFixed(2));

  const far = makeCar(track, 2, 2);
  far.pos = { x: a.pos.x + 500, y: a.pos.y };
  check('distant cars do not collide', !resolveCarCollision(a, far));

  const c = makeCar(track, 0, 0);
  c.vel = { x: 200, y: 0 };
  const prop = { pos: { x: c.pos.x + 8, y: c.pos.y }, radius: 7 };
  check('hitting a prop registers', resolveObstacleCollision(c, prop));
  check('car ends outside the prop', Math.hypot(c.pos.x - prop.pos.x, c.pos.y - prop.pos.y) >= c.stats.radius + prop.radius - 0.001);
  check('impact kills forward speed', c.vel.x < 200);
  check('scenery you drive over is not solid', !resolveObstacleCollision(c, { pos: { ...c.pos }, radius: 0 }));
}

section('lap counting');
{
  const track = tracks[0];
  const car = makeCar(track, 0);
  check('starts on lap 1 with zero laps banked', car.lap === -1 && car.displayLap(TOTAL_LAPS) === 1);

  // Teleport the car forward around the lap and let progress tracking follow.
  const laps = 3;
  for (let l = 0; l < laps; l++) {
    for (let d = 0; d < track.totalLen; d += 20) {
      const at = track.pointAt(d);
      car.pos = { ...at.pos };
      car.heading = at.heading;
      car.controls = { throttle: 0, steer: 0, handbrake: false, nitro: false };
      car.update(STEP, track);
    }
  }
  check('three laps counted after three laps driven', car.lap === laps - 1 || car.lap === laps, String(car.lap));

  const back = makeCar(track, 0);
  for (let d = 0; d > -track.totalLen * 0.6; d -= 20) {
    const at = track.pointAt(d);
    back.pos = { ...at.pos };
    back.update(STEP, track);
  }
  check('driving backwards over the line does not gain a lap', back.lap <= -1, String(back.lap));
}

section('languages');
{
  check('two languages offered', LANGUAGES.length === 2, LANGUAGES.map((l) => l.id).join(','));
  const missing = ALL_KEYS.filter((key) => {
    const pair = RAW_STRINGS[key];
    return !pair[0] || !pair[1];
  });
  check('every string exists in both languages', missing.length === 0, missing.join(','));

  // The pixel font has to be able to draw everything, accents included.
  const unsupported = new Set<string>();
  for (const key of ALL_KEYS) {
    for (const text of RAW_STRINGS[key]) {
      for (const ch of text) if (!fontSupports(ch)) unsupported.add(ch);
    }
  }
  for (const lang of ['en', 'pt'] as const) {
    setLanguage(lang);
    for (const line of page('howTo')) {
      for (const ch of line) if (!fontSupports(ch)) unsupported.add(ch);
    }
  }
  check('the font can draw every character used', unsupported.size === 0, [...unsupported].join(''));
  check('accented capitals exist', [...'ÁÀÂÃÉÊÍÓÔÕÚÇ'].every(fontSupports));

  setLanguage('en');
  const en = t('play');
  setLanguage('pt');
  const pt = t('play');
  check('switching language changes the strings', en === 'PLAY' && pt === 'JOGAR', `${en}/${pt}`);
  check('the active language is reported back', getLanguage() === 'pt');
  check('the how-to page is translated', page('howTo').join(' ') !== '' && page('howTo').length > 5);
  setLanguage('en');
}

section('menu: language and pause');
{
  const menu = new MenuModel(6, 3, 3);
  // Read through a widening helper: TypeScript otherwise narrows `screen` to
  // whatever literal was last assigned in this block.
  const screen = (): string => menu.screen;
  check('settings has a language row', SETTINGS_ROWS.includes('language'));
  menu.screen = 'settings';
  menu.index = SETTINGS_ROWS.indexOf('language');
  menu.input('confirm');
  check('language screen opens', screen() === 'language');
  const other = LANGUAGES.findIndex((l) => l.id !== menu.language);
  menu.index = other;
  menu.input('confirm');
  check('picking a language applies it', menu.language === LANGUAGES[other].id, menu.language);
  check('confirming a language returns to settings', screen() === 'settings');
  check('the game strings followed', getLanguage() === menu.language);
  menu.language = 'en';
  setLanguage('en');

  // Pause menu: exactly three rows, in the order asked for.
  check('pause has exactly three rows', PAUSE_ROWS.length === 3, PAUSE_ROWS.join(','));
  check('pause rows are settings, quit, continue', PAUSE_ROWS.join(',') === 'settings,quit,resume');
  menu.openPause();
  check('pause opens with the cursor on continue', screen() === 'pause' && menu.index === 2);
  const resumeEvents = menu.input('confirm');
  check('continue resumes the race', resumeEvents.some((e) => e.type === 'resume'), JSON.stringify(resumeEvents));

  menu.openPause();
  menu.index = PAUSE_ROWS.indexOf('quit');
  const quitEvents = menu.input('confirm');
  check('return to main menu quits', quitEvents.some((e) => e.type === 'quit'));

  menu.openPause();
  const escEvents = menu.input('back');
  check('escape from pause resumes', escEvents.some((e) => e.type === 'resume'));

  menu.openPause();
  menu.index = PAUSE_ROWS.indexOf('settings');
  menu.input('confirm');
  check('pause can open settings', screen() === 'settings');
  menu.input('confirm');
  check('a settings page opens from pause', screen() === 'controls');
  menu.input('back');
  menu.input('back');
  check('settings returns to the pause menu, not the main menu', screen() === 'pause', screen());

  menu.reset();
  menu.screen = 'settings';
  menu.index = SETTINGS_ROWS.length - 1;
  menu.input('confirm');
  check('settings from the main menu still returns there', screen() === 'main');
}

section('start sequence');
{
  const at = (time: number): string => {
    const s = startSignalAt(time);
    return s.kind === 'count' ? s.label : s.kind === 'light' ? s.state : s.kind;
  };
  check('counts down three, two, one', at(0.1) === '3' && at(1) === '2' && at(1.8) === '1', [at(0.1), at(1), at(1.8)].join(','));
  check('then the red light', at(START_BEATS.red + 0.1) === 'red');
  check('then red and yellow', at(START_BEATS.yellow + 0.1) === 'redYellow');
  check('then green', at(START_BEATS.green + 0.1) === 'green');
  check('the lights go out and the race is released', at(START_BEATS.go + 0.1) === 'go');
  check('the banner clears after the start', at(START_BEATS.go + 2) === 'none');
  check('the sequence runs in order', START_BEATS.three < START_BEATS.two && START_BEATS.two < START_BEATS.one && START_BEATS.one < START_BEATS.red && START_BEATS.red < START_BEATS.yellow && START_BEATS.yellow < START_BEATS.green && START_BEATS.green < START_BEATS.go);
}

section('track recovery');
{
  const track = tracks[0];
  const car = makeCar(track, 0);
  car.autoRecover = true;
  const h = car.heading;
  // Park the car well out on the grass and hold the throttle down.
  car.pos.x -= Math.sin(h) * (track.def.halfWidth + 60);
  car.pos.y += Math.cos(h) * (track.def.halfWidth + 60);
  car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };

  let elapsed = 0;
  let blinkStart = -1;
  let respawnAt = -1;
  while (elapsed < 6 && respawnAt < 0) {
    car.update(STEP, track);
    elapsed += STEP;
    if (blinkStart < 0 && car.recovery === 'blink') blinkStart = elapsed;
    if (car.respawned) respawnAt = elapsed;
  }
  check('nothing happens before three seconds off track', blinkStart >= RECOVERY_DELAY - 0.05, blinkStart.toFixed(2));
  check('the car blinks before it is moved', blinkStart > 0 && respawnAt > blinkStart, `${blinkStart.toFixed(2)} -> ${respawnAt.toFixed(2)}`);
  check('the car is put back on the racing surface', track.onTrack(car.pos), JSON.stringify(car.pos));
  check('it rejoins pointing down the road', Math.abs(wrapAngle(car.heading - track.heading(car.wpHint))) < 0.4);
  check('it rejoins slowly', car.speed <= 60, car.speed.toFixed(1));
  check('the power penalty starts', car.recovery === 'penalty');

  // Same throttle, penalised car versus a healthy one on the same piece of road.
  const healthy = makeCar(track, 0);
  healthy.pos = { ...car.pos };
  healthy.heading = car.heading;
  healthy.vel = { ...car.vel };
  healthy.primeGrid(track);
  healthy.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  for (let i = 0; i < 60; i++) {
    car.update(STEP, track);
    healthy.update(STEP, track);
  }
  check('recovery costs you acceleration', car.forwardSpeed < healthy.forwardSpeed, `${car.forwardSpeed.toFixed(1)} vs ${healthy.forwardSpeed.toFixed(1)}`);
  check('the penalty is a real cut, not a rounding error', RECOVERY_POWER < 0.6);

  let left = RECOVERY_PENALTY;
  while (left > 0) {
    car.update(STEP, track);
    left -= STEP;
  }
  check('full power comes back', car.recovery === 'none');

  const ai = makeCar(track, 1);
  const ah = ai.heading;
  ai.pos.x -= Math.sin(ah) * (track.def.halfWidth + 60);
  ai.pos.y += Math.cos(ah) * (track.def.halfWidth + 60);
  ai.controls = { throttle: 0, steer: 0, handbrake: false, nitro: false };
  for (let i = 0; i < 120 * 5; i++) ai.update(STEP, track);
  check('cars without marshal cover are left alone', ai.recovery === 'none' && !track.onTrack(ai.pos));
}

section('victory podium');
{
  check('first place takes the trophy', awardForPlace(1) === 'trophy');
  check('second place takes silver', awardForPlace(2) === 'silver');
  check('third place takes bronze', awardForPlace(3) === 'bronze');
  check('fourth place gets no animation', awardForPlace(4) === null);
  check('every car has its own driver', CAR_STATS.every((c) => c.id in DRIVER_LOOKS));
  const looks = CAR_STATS.map((c) => DRIVER_LOOKS[c.id]);
  check('no two drivers share a suit colour', new Set(looks.map((l) => l.suit)).size === CAR_STATS.length);
  check('drivers come in different builds', new Set(looks.map((l) => l.build)).size >= 2);
  for (const [name, poses] of Object.entries(DRIVER_MAPS)) {
    for (const [pose, map] of Object.entries(poses)) {
      const widths = new Set((map as string[]).map((r) => r.length));
      check(`${name} ${pose} artwork is rectangular`, widths.size === 1, [...widths].join(','));
    }
  }
  const lightWidths = new Set(LIGHT_MAP_ROWS.map((r) => r.length));
  check('the start light artwork is rectangular', lightWidths.size === 1, [...lightWidths].join(','));
}

section('full AI race');
interface RaceCase {
  track: Track;
  weather: ReturnType<typeof weatherById>;
}
const cases: RaceCase[] = [
  ...tracks.map((track) => ({ track, weather: weatherById('sunny') })),
  { track: tracks[0], weather: weatherById('rain') },
  { track: tracks[0], weather: weatherById('night') },
];

for (const { track, weather } of cases) {
  const label = `${track.def.id}/${weather.id}`;
  const cars: RaceCar[] = [];
  const drivers: AIDriver[] = [];
  const skills = [
    { pace: 0.94, line: -0.35, reaction: 2.4 },
    { pace: 0.9, line: 0.3, reaction: 2.2 },
    { pace: 0.97, line: 0, reaction: 2.6 },
    { pace: 0.88, line: -0.15, reaction: 2.1 },
    { pace: 0.92, line: 0.18, reaction: 2.5 },
    { pace: 0.95, line: -0.22, reaction: 2.3 },
  ];
  for (let slot = 0; slot < CAR_STATS.length; slot++) {
    const car = makeCar(track, slot, slot);
    cars.push(car);
    drivers.push(new AIDriver(car, track, skills[slot]));
  }

  let time = 0;
  let offTrackTicks = 0;
  let ticks = 0;
  let nitroTicks = 0;
  const limit = 420; // simulated seconds
  while (time < limit && cars.some((c) => !c.finished)) {
    for (const d of drivers) d.update(STEP, cars);
    for (const car of cars) {
      car.update(STEP, track, weather);
      for (const prop of track.nearbySolids(car.pos)) resolveObstacleCollision(car, prop);
      if (car.offTrack) offTrackTicks++;
      if (car.nitroActive) nitroTicks++;
      ticks++;
    }
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) resolveCarCollision(cars[i], cars[j]);
    }
    for (const car of cars) {
      if (!car.finished && car.lap >= TOTAL_LAPS) {
        car.finished = true;
        car.finishTime = time;
      }
    }
    time += STEP;
  }

  const times = cars.map((c) => (c.finished ? c.finishTime.toFixed(1) : 'DNF')).join(', ');
  console.log(`  [${label}] ${times}`);
  check(`${label}: the whole field finishes 3 laps`, cars.every((c) => c.finished), times);
  check(`${label}: nobody skips a lap`, cars.every((c) => c.lap === TOTAL_LAPS), cars.map((c) => c.lap).join(','));
  check(`${label}: lap times are plausible`, cars.every((c) => c.finishTime > 20 && c.finishTime < limit), times);
  check(`${label}: AI stays on the road most of the time`, offTrackTicks / ticks < 0.25, `${((offTrackTicks / ticks) * 100).toFixed(1)}% off track`);
  check(`${label}: AI actually uses its nitro`, nitroTicks > 0, String(nitroTicks));
  check(`${label}: nitro never goes negative or overfills`, cars.every((c) => c.nitro >= 0 && c.nitro <= c.stats.nitroCapacity + 1e-9));
  check(`${label}: no NaN in car state`, cars.every((c) => Number.isFinite(c.pos.x) && Number.isFinite(c.pos.y) && Number.isFinite(c.heading) && Number.isFinite(c.speed)));

  const sorted = [...cars].sort((a, b) => a.finishTime - b.finishTime);
  sorted.forEach((c, i) => (c.position = i + 1));
  check(`${label}: positions are unique`, new Set(cars.map((c) => c.position)).size === cars.length);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures > 0) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
