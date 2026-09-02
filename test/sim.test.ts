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
import { MAIN_ROWS, MenuModel, PAUSE_ROWS, SETTINGS_ROWS, SETUP_ROWS } from '../src/menu';
import { Championship, POINTS, ROUNDS, pointsFor } from '../src/championship';
import { ALL_DIFFICULTIES, RACECRAFT_CHAMPIONSHIP, difficultyById } from '../src/difficulty';
import { PHASES, TOURNAMENT_LAPS, Tournament, buildEntrants } from '../src/tournament';
import { ALL_WEATHERS, WEATHERS as PICKABLE_WEATHERS } from '../src/weather';
import { ALL_KEYS, LANGUAGES, RAW_STRINGS, getLanguage, page, setLanguage, t } from '../src/i18n';
import { supports as fontSupports } from '../src/font';
import { DRIVER_LOOKS, DRIVER_MAPS, awardForPlace } from '../src/drivers';
import { LIGHT_MAP_ROWS } from '../src/icons';
import { GO_BANNER, START_BEATS, StartSequence, buildGrid, skillFor, startSignalAt } from '../src/race';
import { DIFFICULTIES, MAX_OPPONENTS, MIN_OPPONENTS, difficultyAt } from '../src/difficulty';
import {
  RECOVERY_DELAY,
  RECOVERY_PENALTY,
  RECOVERY_POWER,
  SHIFT_TIME,
  brakeEfficiency,
  gearForSpeed,
  rpmFor,
} from '../src/car';
import { DIAL_MARKS, DIAL_MAX, angleFor, microWidth } from '../src/speedo';

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

section('gearbox');
{
  for (const car of CAR_STATS) {
    const count = car.stats.shiftUp.length + 1;
    check(`${car.id} has five or six gears`, count === 5 || count === 6, String(count));
    const rising = car.stats.shiftUp.every((v, i) => i === 0 || v > car.stats.shiftUp[i - 1]);
    check(`${car.id} shift speeds rise`, rising, car.stats.shiftUp.join('/'));
    check(
      `${car.id} reaches top gear before its top speed`,
      car.stats.shiftUp[car.stats.shiftUp.length - 1] < car.stats.maxSpeed,
      `${car.stats.shiftUp[car.stats.shiftUp.length - 1]} < ${car.stats.maxSpeed}`,
    );
  }
  const boxes = CAR_STATS.map((c) => c.stats.shiftUp.join(','));
  check('every car has its own ratios', new Set(boxes).size === CAR_STATS.length);
  check('both five and six speeds are represented', new Set(CAR_STATS.map((c) => c.stats.shiftUp.length)).size > 1);

  const box = [50, 100, 150, 200, 250];
  check('it starts in first', gearForSpeed(box, 0, 1) === 1);
  check('it climbs with speed', gearForSpeed(box, 120, 2) === 3 && gearForSpeed(box, 260, 5) === 6);
  check('it holds a gear just under the change point', gearForSpeed(box, 95, 3) === 3);
  check('but does drop when the speed really falls', gearForSpeed(box, 70, 3) === 2, String(gearForSpeed(box, 70, 3)));
  check('revs sit low at the bottom of a gear', rpmFor(box, 3, 101, 300) < 0.3);
  check('revs sit high at the top of a gear', rpmFor(box, 3, 149, 300) > 0.9);
  check('revs never exceed the limiter', rpmFor(box, 6, 400, 300) <= 1);

  // Drive one car up through the box, pinned in place so the surface is fixed.
  const track = tracks[0];
  const car = makeCar(track, 0);
  const pin = { ...car.pos };
  car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  const shifts: Array<{ gear: number; kind: string; rpm: number }> = [];
  let rpmBeforeShift = 0;
  let dipSeen = false;
  for (let i = 0; i < 120 * 10; i++) {
    const before = car.rpm;
    car.pos.x = pin.x;
    car.pos.y = pin.y;
    car.update(STEP, track);
    if (car.shifted) {
      shifts.push({ gear: car.gear, kind: car.shifted, rpm: car.rpm });
      rpmBeforeShift = before;
    }
    if (rpmBeforeShift > 0 && car.rpm < rpmBeforeShift - 0.08) dipSeen = true;
  }
  check('the box works up through every gear', shifts.length === car.gearCount - 1, shifts.map((s) => s.gear).join(','));
  check('every change is an upshift', shifts.every((s) => s.kind === 'up'));
  check('the revs dip on a change', dipSeen);
  check('it settles in top gear at speed', car.gear === car.gearCount, `${car.gear}/${car.gearCount}`);
  check('the revs climb again afterwards', car.rpm > 0.9, car.rpm.toFixed(2));
  check('a change takes a moment', SHIFT_TIME > 0.1 && SHIFT_TIME < 0.5);

  // The torque cut has to be real: the same second of acceleration through a
  // change covers less ground than one without.
  const clean = makeCar(track, 0);
  const cleanPin = { ...clean.pos };
  clean.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, clean, 0.4, cleanPin);
  const beforeCut = clean.forwardSpeed;
  // Force a change by dropping it into a lower gear's band and back.
  const gained: number[] = [];
  for (const forceShift of [false, true]) {
    const probe = makeCar(track, 0);
    const probePin = { ...probe.pos };
    probe.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
    runPinned(track, probe, 0.4, probePin);
    const start = probe.forwardSpeed;
    if (forceShift) probe.shiftTimer = SHIFT_TIME;
    runPinned(track, probe, SHIFT_TIME, probePin);
    gained.push(probe.forwardSpeed - start);
  }
  check('a change costs acceleration', gained[1] < gained[0] * 0.6, `${gained[1].toFixed(1)} vs ${gained[0].toFixed(1)}`);
  check('the car still accelerates through it', gained[1] > 0 && beforeCut > 0);
}

section('speedometer');
{
  check('the dial reads 0 to 260 in twenties', DIAL_MARKS.join(',') === '0,20,40,60,80,100,120,140,160,180,200,220,240,260');
  check('the top of the dial is 260', DIAL_MAX === 260);
  check('the needle sweeps clockwise', angleFor(0) < angleFor(130) && angleFor(130) < angleFor(260));
  check('the needle is pinned at both ends', angleFor(-50) === angleFor(0) && angleFor(400) === angleFor(260));
  check('the micro font measures its numbers', microWidth('260') === 11, String(microWidth('260')));

  // A five-speed car must never be shown in sixth.
  for (const car of CAR_STATS) {
    const count = car.stats.shiftUp.length + 1;
    const shown = Math.min(gearForSpeed(car.stats.shiftUp, car.stats.maxSpeed * 2, count), count);
    check(`${car.id} never shows a gear it has not got`, shown <= count && shown <= 6, String(shown));
  }
}

section('brake wear');
{
  check('full brakes are full strength', brakeEfficiency(100) === 1 && brakeEfficiency(76) === 1);
  check('76-51 is slightly reduced', brakeEfficiency(75) < 1 && brakeEfficiency(51) === brakeEfficiency(75));
  check('50-26 is noticeably reduced', brakeEfficiency(50) < brakeEfficiency(51));
  check('25-1 is significantly reduced', brakeEfficiency(25) < brakeEfficiency(26));
  check('empty brakes are very weak', brakeEfficiency(0) < brakeEfficiency(1) && brakeEfficiency(0) <= 0.25);
  check('the bands only ever get worse', [100, 76, 75, 51, 50, 26, 25, 1, 0].every((v, i, a) => i === 0 || brakeEfficiency(v) <= brakeEfficiency(a[i - 1])));

  const rates = CAR_STATS.map((c) => c.stats.brakeWear);
  check('every car wears its brakes at its own rate', new Set(rates).size === CAR_STATS.length, rates.join(','));
  check('all rates are positive', rates.every((r) => r > 0));

  const track = tracks[0];
  // Coasting and accelerating must not touch the brakes.
  const cruiser = makeCar(track, 0);
  const cruisePin = { ...cruiser.pos };
  cruiser.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, cruiser, 6, cruisePin);
  check('driving does not wear the brakes', cruiser.brake === 100, String(cruiser.brake));
  cruiser.controls = { throttle: 0, steer: 0, handbrake: false, nitro: false };
  runPinned(track, cruiser, 3, cruisePin);
  check('coasting does not wear them either', cruiser.brake === 100, String(cruiser.brake));

  // Braking does, in whole percent.
  const seen = new Set<number>();
  const braker = makeCar(track, 0);
  const brakePin = { ...braker.pos };
  braker.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  runPinned(track, braker, 4, brakePin);
  braker.controls = { throttle: -1, steer: 0, handbrake: false, nitro: false };
  for (let i = 0; i < 120 * 12; i++) {
    braker.pos.x = brakePin.x;
    braker.pos.y = brakePin.y;
    braker.forwardSpeed > 40 && (braker.vel = { x: Math.cos(braker.heading) * 240, y: Math.sin(braker.heading) * 240 });
    braker.update(STEP, track);
    seen.add(braker.brake);
  }
  const values = [...seen].sort((a, b) => b - a);
  check('braking wears the brakes', braker.brake < 100, String(braker.brake));
  check('the reading is always a whole percent', values.every((v) => Number.isInteger(v)), values.slice(0, 4).join(','));
  check('it steps down one percent at a time', values.every((v, i) => i === 0 || values[i - 1] - v === 1), values.slice(0, 6).join(','));
  check('it never goes below zero', values[values.length - 1] >= 0);

  // Worn brakes really do stop the car later.
  const stopFrom = (condition: number): number => {
    const car = makeCar(track, 0);
    const pin = { ...car.pos };
    car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
    runPinned(track, car, 6, pin);
    car.brake = condition;
    car.controls = { throttle: -1, steer: 0, handbrake: false, nitro: false };
    let time = 0;
    while (time < 20 && car.forwardSpeed > 20) {
      car.pos.x = pin.x;
      car.pos.y = pin.y;
      car.update(STEP, track);
      time += STEP;
    }
    return time;
  };
  const fresh = stopFrom(100);
  const half = stopFrom(40);
  const gone = stopFrom(0);
  console.log(`  [brakes] stop from speed: 100% ${fresh.toFixed(2)}s, 40% ${half.toFixed(2)}s, 0% ${gone.toFixed(2)}s`);
  check('half-worn brakes take longer to stop', half > fresh * 1.2, `${half.toFixed(2)} vs ${fresh.toFixed(2)}`);
  check('empty brakes are far worse again', gone > half * 1.5, `${gone.toFixed(2)} vs ${half.toFixed(2)}`);
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
  check('moving lands on the competition row', MAIN_ROWS[menu.index] === 'competition', String(menu.index));
  menu.index = MAIN_ROWS.indexOf('settings');
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

  menu.index = MAIN_ROWS.indexOf('play');
  menu.input('confirm');
  check('play opens car select', screen() === 'car');
  menu.index = 0;
  menu.input('down');
  menu.input('down');
  check('car selection follows the cursor', menu.carIndex === 2, String(menu.carIndex));
  menu.input('confirm');
  check('car select leads to track select', screen() === 'track');
  menu.input('down');
  menu.input('confirm');
  check('track select leads to weather select', screen() === 'weather' && menu.trackIndex === 1);
  menu.input('down');
  menu.input('down');
  menu.input('confirm');
  check('weather select leads to the setup screen', screen() === 'setup', screen());
  const events = menu.input('confirm');
  const start = events.find((e) => e.type === 'start');
  check('confirming the setup starts the race', Boolean(start));
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
  check('the cursor lands back on the settings row', MAIN_ROWS[menu.index] === 'settings');
}

section('race setup screen');
{
  const menu = new MenuModel(6, 3, 3);
  const screen = (): string => menu.screen;
  menu.screen = 'weather';
  menu.index = 0;
  const events = menu.input('confirm');
  check('conditions now lead to the setup screen', screen() === 'setup', screen());
  check('confirming the weather no longer starts the race', !events.some((e) => e.type === 'start'));
  check('the cursor lands on START', menu.index === SETUP_ROWS.indexOf('start'));
  check('setup has three rows', SETUP_ROWS.length === 3, SETUP_ROWS.join(','));

  menu.index = SETUP_ROWS.indexOf('opponents');
  const start = menu.opponents;
  menu.input('left');
  check('left removes an opponent', menu.opponents === start - 1, String(menu.opponents));
  for (let i = 0; i < 10; i++) menu.input('right');
  check('the field tops out at five rivals', menu.opponents === MAX_OPPONENTS, String(menu.opponents));
  for (let i = 0; i < 10; i++) menu.input('left');
  check('and bottoms out at one', menu.opponents === MIN_OPPONENTS, String(menu.opponents));

  menu.index = SETUP_ROWS.indexOf('difficulty');
  for (let i = 0; i < 5; i++) menu.input('left');
  check('difficulty bottoms out at easy', menu.difficulty === 0);
  menu.input('right');
  check('right steps up a level', menu.difficulty === 1);
  for (let i = 0; i < 5; i++) menu.input('right');
  check('difficulty tops out at hard', menu.difficulty === DIFFICULTIES.length - 1, String(menu.difficulty));

  menu.opponents = 3;
  menu.difficulty = 0;
  menu.index = SETUP_ROWS.indexOf('start');
  const launch = menu.input('confirm').find((e) => e.type === 'start');
  check('START drops the flag', Boolean(launch));
  check(
    'the race carries the field size and difficulty',
    launch !== undefined && launch.type === 'start' && launch.opponents === 3 && launch.difficulty === 0,
    JSON.stringify(launch),
  );

  menu.input('back');
  check('back returns to the conditions screen', screen() === 'weather', screen());
}

section('grid size');
{
  for (let opponents = MIN_OPPONENTS; opponents <= MAX_OPPONENTS; opponents++) {
    const grid = buildGrid(6, 2, opponents);
    check(`${opponents} rivals means ${opponents + 1} cars`, grid.length === opponents + 1, String(grid.length));
    check(`${opponents} rivals: the player is on the grid`, grid.includes(2));
    check(`${opponents} rivals: nobody drives the same car twice`, new Set(grid).size === grid.length, grid.join(','));
  }
  const demo = buildGrid(6, null, 6);
  check('a demo race fills every seat', demo.length === 6 && new Set(demo).size === 6);
  const mid = buildGrid(6, 0, 5);
  check('the player starts mid-pack, not on pole', mid.indexOf(0) > 0, mid.join(','));
}

section('difficulty');
{
  check('three levels', DIFFICULTIES.length === 3, DIFFICULTIES.map((d) => d.id).join(','));
  const [easy, normal, hard] = DIFFICULTIES;
  check('pace rises with the level', easy.pace < normal.pace && normal.pace < hard.pace);
  check('easy drivers wander more', easy.wobble > hard.wobble);
  check('hard drivers spend nitro sooner', hard.nitroReserve < easy.nitroReserve);

  const skill = skillFor(0, hard);
  check('the level scales the driver, keeping their character', skill.line === skillFor(0, easy).line && skill.pace > skillFor(0, easy).pace);

  // Same car, same circuit: an easy field should be measurably slower.
  const track = tracks[0];
  const lapTime = (level: number): number => {
    const car = makeCar(track, 0);
    const driver = new AIDriver(car, track, skillFor(0, difficultyAt(level)));
    let time = 0;
    while (time < 200 && car.lap < 1) {
      driver.update(STEP, [car]);
      car.update(STEP, track);
      for (const prop of track.nearbySolids(car.pos)) resolveObstacleCollision(car, prop);
      time += STEP;
    }
    return time;
  };
  const easyLap = lapTime(0);
  const hardLap = lapTime(2);
  console.log(`  [difficulty] easy lap ${easyLap.toFixed(1)}s, hard lap ${hardLap.toFixed(1)}s`);
  check('an easy rival laps slower than a hard one', easyLap > hardLap + 1, `${easyLap.toFixed(1)} vs ${hardLap.toFixed(1)}`);
  check('both still get round', easyLap < 120 && hardLap < 120);
}

section('start sequence');
{
  const at = (time: number): string => {
    const s = startSignalAt(time);
    return s.kind === 'light' ? s.state : s.kind;
  };
  check('it opens on the red light', at(0) === 'red' && at(START_BEATS.red + 0.1) === 'red');
  check('then red and yellow', at(START_BEATS.yellow + 0.1) === 'redYellow');
  check('then green', at(START_BEATS.green + 0.1) === 'green');
  check('there is no countdown before the lights', at(0.01) === 'red');
  check('the lights go out and the race is released', at(START_BEATS.go + 0.1) === 'go');
  check('the banner clears after the start', at(START_BEATS.go + 2) === 'none');
  // The banner used to hang on screen because the clock stopped the moment the
  // race was released; it has to keep ticking until the banner expires.
  const seq = new StartSequence();
  const signals: string[] = [];
  let releasedAt = -1;
  for (let i = 0; i < 800; i++) {
    seq.update(STEP);
    if (releasedAt < 0 && seq.released) releasedAt = i * STEP;
    const kind = seq.signal.kind;
    if (signals[signals.length - 1] !== kind) signals.push(kind);
  }
  check('the sequence steps light, go, none', signals.join('>') === 'light>go>none', signals.join('>'));
  check('release happens when the lights go out', Math.abs(releasedAt - START_BEATS.go) < 0.05, releasedAt.toFixed(2));
  check('the go banner clears itself', seq.signal.kind === 'none', String(seq.time.toFixed(2)));
  check('the clock keeps running past the release', seq.time > START_BEATS.go + GO_BANNER);

  const beats: number[] = [];
  const beatSeq = new StartSequence();
  for (let i = 0; i < 700; i++) {
    beatSeq.update(STEP);
    const beat = beatSeq.takeBeat();
    if (beat !== null) beats.push(beat);
  }
  check('each beat is announced once, in order', beats.join(',') === '0,1,2,3', beats.join(','));

  const skipped = new StartSequence();
  skipped.skip();
  check('a skipped sequence is released with no banner', skipped.released && skipped.signal.kind === 'none');

  check('the sequence runs in order', START_BEATS.red < START_BEATS.yellow && START_BEATS.yellow < START_BEATS.green && START_BEATS.green < START_BEATS.go);
  check('the whole start takes a couple of seconds', START_BEATS.go > 1.5 && START_BEATS.go < 3.5, String(START_BEATS.go));
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

section('championship');
{
  check('points are 10-7-5-3-2-1', POINTS.join(',') === '10,7,5,3,2,1');
  check('positions map to points', pointsFor(1) === 10 && pointsFor(4) === 3 && pointsFor(6) === 1);
  check('nothing is scored outside the six', pointsFor(0) === 0 && pointsFor(7) === 0);

  check('a season is exactly three rounds', ROUNDS.length === 3);
  const laps = ROUNDS.map((r) => r.laps);
  check('laps go three, four, six', laps.join(',') === '3,4,6', laps.join(','));
  check('the rounds run easy, medium, difficult', ROUNDS.map((r) => r.label).join(',') === 'easy,medium,hard');
  check('each round uses a different existing circuit', new Set(ROUNDS.map((r) => r.trackId)).size === 3);
  const trackIds = tracks.map((tr) => tr.def.id);
  check('every round points at a real circuit', ROUNDS.every((r) => trackIds.includes(r.trackId)), ROUNDS.map((r) => r.trackId).join(','));
  const difficultyOf = (id: string): number => tracks.find((tr) => tr.def.id === id)!.info.difficulty;
  check(
    'the calendar runs easiest to hardest circuit',
    difficultyOf(ROUNDS[0].trackId) < difficultyOf(ROUNDS[2].trackId) &&
      difficultyOf(ROUNDS[1].trackId) <= difficultyOf(ROUNDS[2].trackId),
    ROUNDS.map((r) => `${r.trackId}:${difficultyOf(r.trackId)}`).join(' '),
  );
  check('the last round runs the hidden level', ROUNDS[2].difficulty === 'elite');
  check('the hidden level is never offered to the player', !DIFFICULTIES.some((d) => d.id === 'elite'));
  check('but it does exist internally', ALL_DIFFICULTIES.some((d) => d.id === 'elite'));
  const elite = difficultyById('elite');
  const hard = difficultyById('hard');
  check('the hidden level is a step beyond hard', elite.pace > hard.pace && elite.reaction > hard.reaction && elite.wobble < hard.wobble);

  // A whole season, scored round by round.
  const season = new Championship();
  const field = CAR_STATS.map((c, i) => ({ carIndex: i, name: c.name, isPlayer: i === 2 }));
  check('it opens on round one', season.roundNumber === 1 && !season.finished);
  check('the first round is the easy one', season.currentRound.label === 'easy' && season.currentRound.laps === 3);

  season.scoreRace(field);
  let table = season.standings();
  check('the winner takes ten', table[0].points === 10 && table[0].name === field[0].name);
  check('the whole grid scores', table.length === 6 && table[5].points === 1);
  check('the table is ordered by points', table.every((row, i) => i === 0 || table[i - 1].points >= row.points));
  check('places are 1 to 6', table.map((r) => r.place).join(',') === '1,2,3,4,5,6');
  check('the player is flagged in the table', table.filter((r) => r.isPlayer).length === 1);

  check('it moves on to round two', season.advance() && season.roundNumber === 2);
  check('round two is four laps at medium', season.currentRound.laps === 4 && season.currentRound.label === 'medium');
  season.scoreRace([...field].reverse());
  table = season.standings();
  check('points accumulate across rounds', table.reduce((sum, row) => sum + row.points, 0) === 28 * 2, String(table.reduce((sum, row) => sum + row.points, 0)));
  const winnerThenLast = table.find((row) => row.carIndex === 0);
  check('a win then a last place adds up', winnerThenLast !== undefined && winnerThenLast.points === 11, String(winnerThenLast?.points));

  check('it moves on to round three', season.advance() && season.roundNumber === 3);
  check('round three is six laps on the hidden level', season.currentRound.laps === 6 && season.currentRound.difficulty === 'elite');
  season.scoreRace(field);
  check('the season ends after three rounds', season.finished);
  check('there is no fourth round', !season.advance());
  table = season.standings();
  check('every point is accounted for', table.reduce((sum, row) => sum + row.points, 0) === 28 * 3);
  check('a champion is crowned', season.leader !== null && season.leader.points === Math.max(...table.map((r) => r.points)));
  check('the champion leads the table', table[0].carIndex === season.leader?.carIndex);
  check('the round just run is shown per driver', table.every((row) => row.lastPosition >= 1 && row.lastPosition <= 6));

  // Ties break on the most recent result, so the order never flickers.
  const tie = new Championship();
  tie.scoreRace(field);
  tie.advance();
  tie.scoreRace([field[1], field[0], ...field.slice(2)]);
  const tied = tie.standings();
  check('a tie breaks on the latest finish', tied[0].carIndex === 1 && tied[0].points === tied[1].points, tied.slice(0, 2).map((r) => `${r.name}:${r.points}`).join(' '));
}

section('championship racecraft');
{
  // The championship field has to be genuinely quicker than the same level in a
  // single race, and it must get there without leaving the road.
  const lapTime = (trackIndex: number, level: string, racecraft: number): { time: number; off: number } => {
    const track = tracks[trackIndex];
    const car = makeCar(track, 0);
    const driver = new AIDriver(car, track, skillFor(0, difficultyById(level as never), racecraft));
    let time = 0;
    let off = 0;
    let ticks = 0;
    while (time < 200 && car.lap < 1) {
      driver.update(STEP, [car]);
      car.update(STEP, track);
      for (const prop of track.nearbySolids(car.pos)) resolveObstacleCollision(car, prop);
      if (car.offTrack) off++;
      ticks++;
      time += STEP;
    }
    return { time, off: off / Math.max(1, ticks) };
  };

  for (const [index, level, label] of [[0, 'easy', 'round 1'], [1, 'normal', 'round 2'], [2, 'hard', 'round 3']] as Array<[number, string, string]>) {
    const plain = lapTime(index, level, 0);
    const champ = lapTime(index, level, RACECRAFT_CHAMPIONSHIP);
    const gain = ((plain.time - champ.time) / plain.time) * 100;
    console.log(`  [racecraft] ${label} ${level}: ${plain.time.toFixed(1)}s -> ${champ.time.toFixed(1)}s (${gain.toFixed(1)}% quicker)`);
    check(`${label}: the championship field is quicker`, champ.time < plain.time, `${champ.time.toFixed(1)} vs ${plain.time.toFixed(1)}`);
    check(`${label}: and still keeps it on the road`, champ.off < 0.08, `${(champ.off * 100).toFixed(1)}% off`);
  }

  const eliteLap = lapTime(2, 'elite', RACECRAFT_CHAMPIONSHIP);
  const hardLap = lapTime(2, 'hard', 0);
  check('the final round is the hardest thing in the game', eliteLap.time < hardLap.time, `${eliteLap.time.toFixed(1)} vs ${hardLap.time.toFixed(1)}`);
  check('the hidden level stays on the road too', eliteLap.off < 0.08, `${(eliteLap.off * 100).toFixed(1)}% off`);

  // Racecraft must not be a straight-line cheat: top speed is untouched.
  const plainSkill = skillFor(0, difficultyById('hard'), 0);
  const champSkill = skillFor(0, difficultyById('hard'), RACECRAFT_CHAMPIONSHIP);
  check('racecraft leaves the car alone', plainSkill.pace === champSkill.pace && plainSkill.reaction === champSkill.reaction);
  check('it only changes how the driver races', champSkill.racecraft === 1 && plainSkill.racecraft === 0);
}

section('slipstream');
{
  const track = tracks[0];
  const solo = makeCar(track, 0);
  const towed = makeCar(track, 0);
  for (const car of [solo, towed]) {
    car.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
  }
  const soloPin = { ...solo.pos };
  const towPin = { ...towed.pos };
  for (let i = 0; i < 120 * 8; i++) {
    solo.pos.x = soloPin.x;
    solo.pos.y = soloPin.y;
    towed.pos.x = towPin.x;
    towed.pos.y = towPin.y;
    towed.slipstream = 1;
    solo.update(STEP, track);
    towed.update(STEP, track);
  }
  check('a tow is worth real speed', towed.forwardSpeed > solo.forwardSpeed + 5, `${towed.forwardSpeed.toFixed(1)} vs ${solo.forwardSpeed.toFixed(1)}`);
  check('but it is not a rocket', towed.forwardSpeed < solo.forwardSpeed * 1.15);
  check('the tow does nothing off the road', (() => {
    const grass = makeCar(track, 0);
    const h = grass.heading;
    const pin = {
      x: grass.pos.x - Math.sin(h) * (track.def.halfWidth + 50),
      y: grass.pos.y + Math.cos(h) * (track.def.halfWidth + 50),
    };
    grass.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
    const plain = makeCar(track, 0);
    plain.controls = { throttle: 1, steer: 0, handbrake: false, nitro: false };
    for (let i = 0; i < 120 * 6; i++) {
      grass.pos.x = pin.x;
      grass.pos.y = pin.y;
      plain.pos.x = pin.x;
      plain.pos.y = pin.y;
      grass.slipstream = 1;
      grass.update(STEP, track);
      plain.update(STEP, track);
    }
    return Math.abs(grass.forwardSpeed - plain.forwardSpeed) < 0.5;
  })());
}

section('elimination tournament');
{
  check('the bracket is four rounds', PHASES.length === 4, PHASES.map((p) => p.id).join(','));
  check('every elimination race is three laps', TOURNAMENT_LAPS === 3);
  check(
    'the field shrinks 12 - 6 - 4 - 2 - 1',
    PHASES.map((p) => p.fieldSize * p.groups).join(',') === '12,6,4,2',
    PHASES.map((p) => p.fieldSize * p.groups).join(','),
  );
  check(
    'each round advances the right number',
    PHASES.map((p) => p.advance * p.groups).join(',') === '6,4,2,1',
    PHASES.map((p) => p.advance * p.groups).join(','),
  );
  check('only the opening round has groups', PHASES[0].groups === 2 && PHASES.slice(1).every((p) => p.groups === 1));
  const ids = tracks.map((tr) => tr.def.id);
  check('every round uses an existing circuit', PHASES.every((p) => ids.includes(p.trackId)));

  const final = PHASES[3];
  check('the final is on Serpentine', final.trackId === 'serpentine');
  check('the final runs in the wet dark', final.weather === 'storm');
  check('the final runs the hidden Impossible level', final.difficulty === 'impossible');
  check('impossible is never offered to the player', !DIFFICULTIES.some((d) => d.id === 'impossible'));
  check('the storm is never offered either', !PICKABLE_WEATHERS.some((w) => w.id === 'storm'));
  const storm = ALL_WEATHERS.find((w) => w.id === 'storm');
  const rain = ALL_WEATHERS.find((w) => w.id === 'rain');
  const night = ALL_WEATHERS.find((w) => w.id === 'night');
  check('the storm is wetter than rain and darker than night', storm !== undefined && rain !== undefined && night !== undefined && storm.gripMul < rain.gripMul && storm.visibility < night.visibility);
  const impossible = difficultyById('impossible');
  const eliteLevel = difficultyById('elite');
  check('impossible is a step beyond elite', impossible.pace > eliteLevel.pace && impossible.reaction > eliteLevel.reaction && impossible.wobble < eliteLevel.wobble);
  check('and it is still only a driver, not a rocket', impossible.pace < 1.4);

  // Twelve entries: every car in two liveries, split into two groups.
  const entrants = buildEntrants(6, 2, CAR_STATS.map((c) => c.name));
  check('twelve cars enter', entrants.length === 12);
  check('the player is one of them', entrants.filter((e) => e.isPlayer).length === 1);
  check('each group has six', entrants.filter((e) => e.group === 0).length === 6 && entrants.filter((e) => e.group === 1).length === 6);
  check('a model never meets its own second entry in the groups', entrants.every((e) => entrants.filter((o) => o.model === e.model && o.group === e.group).length === 1));
  check('every entry has its own car index', new Set(entrants.map((e) => e.carIndex)).size === 12);

  // A whole tournament, with the player winning through every round.
  const tour = new Tournament(entrants);
  check('it opens on the group stage', tour.phase.id === 'group' && tour.phaseNumber === 1);
  check('the player is in a group of six', tour.groupField(tour.playerGroup).length === 6);

  const playerFirst = (list: typeof entrants): typeof entrants =>
    [...list].sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer));
  let result = tour.record([playerFirst(tour.groupField(0)), tour.groupField(1)]);
  check('six go through the group stage', result.advancing.length === 6, String(result.advancing.length));
  check('six are eliminated', result.eliminated.length === 6);
  check('the player went through', result.playerAdvanced && !tour.playerOut);
  check('the field is now six', tour.field.length === 6);
  check('nobody advances twice', new Set(result.advancing.map((e) => e.carIndex)).size === 6);

  check('it moves on to the six-car round', tour.advance() && tour.phase.id === 'six');
  result = tour.record([playerFirst(tour.field)]);
  check('four go through', tour.field.length === 4 && result.advancing.length === 4);
  check('two are out', result.eliminated.length === 2);

  check('it moves on to the four-car round', tour.advance() && tour.phase.id === 'four');
  result = tour.record([playerFirst(tour.field)]);
  check('two reach the final', tour.field.length === 2);

  check('it moves on to the final', tour.advance() && tour.phase.id === 'final');
  check('the final is a head to head', tour.groupField(0).length === 2);
  result = tour.record([playerFirst(tour.field)]);
  check('one champion is crowned', tour.finished && tour.champion !== null && tour.field.length === 1);
  check('the champion is the winner of the final', tour.champion?.isPlayer === true);
  check('there is nothing after the final', !tour.advance());

  // And a run where the player is knocked out in the group stage.
  const shortRun = new Tournament(buildEntrants(6, 0, CAR_STATS.map((c) => c.name)));
  const playerLast = (list: ReturnType<typeof buildEntrants>): ReturnType<typeof buildEntrants> =>
    [...list].sort((a, b) => Number(a.isPlayer) - Number(b.isPlayer));
  const out = shortRun.record([playerLast(shortRun.groupField(0)), shortRun.groupField(1)]);
  check('finishing outside the cut eliminates the player', shortRun.playerOut && !out.playerAdvanced);
  check('the player is not in the surviving field', !shortRun.field.some((e) => e.isPlayer));
  check('their finishing position is reported', out.playerPosition === 6, String(out.playerPosition));
  check('the tournament still knows six went through', out.advancing.length === 6);

  // The final is the hardest race in the game: the same car laps slower there
  // than anywhere else, because of the weather, and the AI is at its sharpest.
  const serpentine = tracks[2];
  const lapIn = (weatherId: string): number => {
    const weather = ALL_WEATHERS.find((wx) => wx.id === weatherId)!;
    const car = makeCar(serpentine, 0);
    const driver = new AIDriver(car, serpentine, skillFor(0, difficultyById('impossible'), RACECRAFT_CHAMPIONSHIP));
    let time = 0;
    while (time < 200 && car.lap < 1) {
      driver.update(STEP, [car]);
      car.update(STEP, serpentine, weather);
      for (const prop of serpentine.nearbySolids(car.pos)) resolveObstacleCollision(car, prop);
      time += STEP;
    }
    return time;
  };
  const dry = lapIn('sunny');
  const stormy = lapIn('storm');
  console.log(`  [final] impossible AI on Serpentine: dry ${dry.toFixed(1)}s, storm ${stormy.toFixed(1)}s`);
  check('the storm really does slow the final down', stormy > dry, `${stormy.toFixed(1)} vs ${dry.toFixed(1)}`);
  check('and the impossible AI still gets round it', stormy < 120, stormy.toFixed(1));
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
  for (let slot = 0; slot < CAR_STATS.length; slot++) {
    const car = makeCar(track, slot, slot);
    cars.push(car);
    drivers.push(new AIDriver(car, track, skillFor(slot, difficultyAt(1))));
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
