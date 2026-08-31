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
await moveTo(2);
await press('Enter');
check('how to play opens', (await state()).screen === 'howto');
await press('Escape');
await press('Escape');
check('back reaches the main menu', (await state()).screen === 'main');

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
const racing = await state();
check('the race starts', racing.mode === 'race', JSON.stringify(racing));
check('six cars line up', (await cars()).length === 6);
check('the player drives the car they chose', (await player()).name === 'VULCAN', (await player()).name);

console.log('\ndriving');
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
await page.keyboard.down('s');
await page.waitForTimeout(1000);
await page.keyboard.up('s');
check('S brakes', (await player()).speed < turned.speed);

console.log('\nfull races, every circuit and condition');
for (const [track, weather, label] of [[0, 0, 'bayside/sunny'], [1, 1, 'dustbowl/rain'], [2, 2, 'serpentine/night']]) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await moveTo(0);
  await press('Enter'); // play
  await press('Enter'); // car
  await moveTo(track);
  await press('Enter');
  await moveTo(weather);
  await press('Enter');
  const started = await state();
  check(`${label}: race starts on the chosen circuit`, started.mode === 'race' && started.track === track && started.weather === weather, JSON.stringify(started));
  const race = await page.evaluate(() => window.__game.simulateRace(500));
  check(`${label}: the whole field finishes`, race.allFinished, JSON.stringify(race));
  check(`${label}: everyone completes 3 laps`, race.laps.every((l) => l === 3), race.laps.join(','));
  check(`${label}: positions are unique`, new Set(race.positions).size === 6, race.positions.join(','));
}

await page.keyboard.press('Escape');
await page.waitForTimeout(200);
check('escape returns to the menu', (await state()).mode === 'menu');

console.log('\nerrors');
check('no console or network errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures === 0 ? '\nbrowser smoke test passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
