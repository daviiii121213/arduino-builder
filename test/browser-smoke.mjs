/**
 * Optional end-to-end smoke test: drives the real game in a real browser.
 *
 *   npm i -D playwright            # not a default dependency
 *   npm run dev                    # in another shell
 *   node test/browser-smoke.mjs
 *
 * Set PW_CHROMIUM to use a Chromium that is already on the machine.
 */
import { chromium } from 'playwright';

const URL = process.env.GAME_URL ?? 'http://localhost:5173/';
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else {
    failures++;
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
  }
};

const browser = await chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

const state = () => page.evaluate(() => window.__game.menuState());
const cars = () => page.evaluate(() => window.__game.carsDebug());
const player = async () => (await cars()).find((c) => c.isPlayer);
const press = async (key, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(70);
  }
};
/**
 * Leaves whatever is on screen the way a player would: skip a podium scene,
 * pause a running race, then pick RETURN TO MAIN MENU.
 */
const quitToMenu = async () => {
  for (let guard = 0; guard < 10; guard++) {
    const s = await state();
    if (s.mode === 'menu') return;
    if (s.mode === 'victory') {
      await press('Enter');
    } else if (s.mode === 'race') {
      await press('Escape');
    } else if (s.screen !== 'pause') {
      await press('Escape');
    } else {
      await moveTo(1);
      await press('Enter');
    }
  }
  throw new Error('could not get back to the main menu');
};

/** Walks a selection screen's cursor to a wanted row. */
const moveTo = async (want) => {
  for (let guard = 0; guard < 12; guard++) {
    const s = await state();
    if (s.index === want) return;
    await press('ArrowDown');
  }
  throw new Error(`could not reach row ${want}`);
};

console.log('\nboot');
check('canvas has a low-res pixel buffer', await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c.width > 200 && c.width < window.innerWidth;
}));
const boot = await state();
check('the game opens on the main menu', boot.mode === 'menu' && boot.screen === 'main', JSON.stringify(boot));
check('an attract race runs behind the menu', (await cars()).length === 6);

console.log('\nsettings');
await press('ArrowDown');
await press('Enter');
check('settings opens', (await state()).screen === 'settings');
await press('Enter');
check('controls page opens', (await state()).screen === 'controls');
await press('Escape');
await moveTo(1);
await press('Enter');
check('sound page opens', (await state()).screen === 'sound');
await press('ArrowLeft', 3);
await press('Escape');
await moveTo(3);
await press('Enter');
check('how to play opens', (await state()).screen === 'howto');
await press('Escape');
await press('Escape');
check('back reaches the main menu', (await state()).screen === 'main');

console.log('\nlanguage');
await moveTo(1);
await press('Enter');                       // settings
await moveTo(2);
await press('Enter');                       // language
check('language screen opens', (await state()).screen === 'language');
await moveTo(1);
await press('Enter');                       // Portuguese
check('portuguese is applied', (await state()).language === 'pt', JSON.stringify(await state()));
check('the menu stays usable in portuguese', (await state()).screen === 'settings');
await moveTo(0);
await press('Enter');                       // controls, now translated
check('a translated page opens', (await state()).screen === 'controls');
await press('Escape');
await moveTo(2);
await press('Enter');
await moveTo(0);
await press('Enter');                       // back to english
check('english can be restored', (await state()).language === 'en');
await press('Escape');
check('settings closes back to the main menu', (await state()).screen === 'main');

console.log('\nrace setup');
await moveTo(0);
await press('Enter');
check('play opens car select', (await state()).screen === 'car');
await moveTo(5);
check('the sixth car can be picked', (await state()).car === 5);
await press('Enter');
check('car select leads to circuit select', (await state()).screen === 'track');
await moveTo(2);
await press('Enter');
check('circuit select leads to conditions', (await state()).screen === 'weather' && (await state()).track === 2);
await moveTo(1);
await press('Enter');
check('conditions lead to the race setup screen', (await state()).screen === 'setup', (await state()).screen);

console.log('\nrace setup');
await moveTo(0);
const beforeField = (await state()).opponents;
await press('ArrowLeft');
check('the field size can be trimmed', (await state()).opponents === beforeField - 1, JSON.stringify(await state()));
await press('ArrowRight');
await moveTo(1);
await press('ArrowLeft', 3);
check('difficulty drops to easy', (await state()).difficulty === 0, JSON.stringify(await state()));
await press('ArrowRight');
check('difficulty steps back to normal', (await state()).difficulty === 1);
await moveTo(2);
await press('Enter');
const racing = await state();
check('the race starts', racing.mode === 'race', JSON.stringify(racing));
check('the chosen field size lines up', (await cars()).length === racing.opponents + 1, `${(await cars()).length} cars`);
check('the player drives the car they chose', (await player()).name === 'VULCAN', (await player()).name);

console.log('\nstart sequence');
check('the field is held before the lights go out', racing.released === false, JSON.stringify(racing));
const held = await cars();
check('nobody has moved off the grid', held.every((c) => c.speed === 0), held.map((c) => c.speed).join(','));
await page.keyboard.down('w');
await page.waitForTimeout(900);
const stillHeld = await player();
check('holding the throttle does not jump the start', stillHeld.speed === 0, String(stillHeld.speed));
// Wait out the rest of the sequence.
for (let i = 0; i < 60 && !(await state()).released; i++) await page.waitForTimeout(150);
check('the race is released after the lights', (await state()).released === true);
await page.waitForTimeout(600);
check('the field moves once released', (await player()).speed > 20, String((await player()).speed));
check('the GO banner is still up right after the start', (await state()).startSignal === 'go', JSON.stringify(await state()));
// Coast while the banner runs out, so the driving checks start on the road.
await page.keyboard.up('w');
await page.waitForTimeout(1300);
check('the GO banner clears itself', (await state()).startSignal === 'none', JSON.stringify(await state()));

console.log('\ndriving');
// Fresh grid for the handling checks, so nothing that happened above (a trip
// through the grass, a marshal recovery) can skew them.
await press('r');
await page.evaluate(() => window.__game.releaseStart());
await page.waitForTimeout(200);
const before = await player();
await page.keyboard.down('w');
await page.waitForTimeout(2200);
const moving = await player();
check('W accelerates', moving.speed > 60, String(moving.speed));
check('the car moved', Math.hypot(moving.x - before.x, moving.y - before.y) > 80);

await page.keyboard.down('Shift');
await page.waitForTimeout(1200);
const boosting = await player();
check('SHIFT burns nitro', boosting.nitroActive === true && boosting.nitro < before.nitro, JSON.stringify(boosting));
await page.keyboard.up('Shift');
await page.waitForTimeout(900);
const refilling = await player();
check('nitro refills once released', refilling.nitro > boosting.nitro && !refilling.nitroActive);

await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowLeft');
const turned = await player();
check('steering changes the heading', Math.abs(turned.heading - moving.heading) > 0.1);
await page.keyboard.up('w');
const beforeBrake = await player();
await page.keyboard.down('s');
await page.waitForTimeout(1000);
await page.keyboard.up('s');
const braked = await player();
check('S brakes', braked.speed < beforeBrake.speed, `${braked.speed} < ${beforeBrake.speed}`);

console.log('\npause menu');
await press('Escape');
const paused = await state();
check('escape opens the pause menu', paused.mode === 'paused' && paused.screen === 'pause', JSON.stringify(paused));
const frozen = await player();
await page.waitForTimeout(500);
const stillFrozen = await player();
check('the race is frozen while paused', frozen.x === stillFrozen.x && frozen.y === stillFrozen.y);
await moveTo(0);
await press('Enter');                       // settings from pause
check('pause opens settings', (await state()).screen === 'settings');
await press('Escape');
check('settings returns to the pause menu', (await state()).screen === 'pause');
await moveTo(2);
await press('Enter');                       // continue
check('continue resumes the race', (await state()).mode === 'race');

console.log('\ntrack recovery');
// Put the car out on the grass and wait for the marshals.
await page.evaluate(() => window.__game.strandPlayer());
await page.keyboard.down('w');
await page.waitForTimeout(400);
let sawOffTrack = false;
let recovered = false;
for (let i = 0; i < 60; i++) {
  const p = await player();
  if (p.offTrack) sawOffTrack = true;
  if (sawOffTrack && !p.offTrack && p.recovery !== 'none') { recovered = true; break; }
  await page.waitForTimeout(150);
}
await page.keyboard.up('w');
check('the car went off the road', sawOffTrack);
check('the marshals put it back on', recovered, JSON.stringify(await player()));

console.log('\nvictory podium');
for (const place of [1, 2, 3]) {
  await page.evaluate((p) => window.__game.showVictory(p), place);
  await page.waitForTimeout(500);
  const s = await state();
  check(`P${place} plays its animation`, s.mode === 'victory' && s.place === place, JSON.stringify(s));
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check(`P${place} can be skipped`, (await state()).mode !== 'victory');
}

console.log('\nfull races, every circuit and condition');
for (const [track, weather, label] of [[0, 0, 'bayside/sunny'], [1, 1, 'dustbowl/rain'], [2, 2, 'serpentine/night']]) {
  await quitToMenu();
  await page.waitForTimeout(200);
  await moveTo(0);
  await press('Enter'); // play
  await press('Enter'); // car
  await moveTo(track);
  await press('Enter');
  await moveTo(weather);
  await press('Enter');
  await moveTo(2);      // setup: START RACE
  await press('Enter');
  const started = await state();
  check(`${label}: race starts on the chosen circuit`, started.mode === 'race' && started.track === track && started.weather === weather, JSON.stringify(started));
  await page.evaluate(() => window.__game.releaseStart());
  const race = await page.evaluate(() => window.__game.simulateRace(500));
  check(`${label}: the whole field finishes`, race.allFinished, JSON.stringify(race));
  check(`${label}: everyone completes 3 laps`, race.laps.every((l) => l === 3), race.laps.join(','));
  check(`${label}: positions are unique`, new Set(race.positions).size === 6, race.positions.join(','));
}

await quitToMenu();
await page.waitForTimeout(200);
check('quitting from the pause menu returns to the main menu', (await state()).mode === 'menu');

console.log('\nerrors');
check('no console or network errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures === 0 ? '\nbrowser smoke test passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
