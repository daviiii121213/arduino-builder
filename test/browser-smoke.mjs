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
await page.waitForTimeout(150);

const player = async () => (await page.evaluate(() => window.__game.carsDebug()))[0];
const trackName = () => page.evaluate(() => window.__game.trackName());

console.log('\nboot');
check('canvas has a low-res pixel buffer', await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c.width > 200 && c.width < window.innerWidth;
}));
check('race starts straight away on the asphalt circuit', (await trackName()) === 'ASPHALT CIRCUIT');
const atStart = await player();
check(
  'player starts on the grid with no laps banked',
  atStart.speed < 20 && atStart.lap === -1,
  JSON.stringify(atStart),
);

console.log('\ndriving');
await page.keyboard.down('w');
await page.waitForTimeout(2500);
const moving = await player();
check('W accelerates the car', moving.speed > 80, String(moving.speed));
check('the car actually moved', Math.hypot(moving.x - atStart.x, moving.y - atStart.y) > 100);

await page.keyboard.down('ArrowRight');
await page.waitForTimeout(600);
await page.keyboard.up('ArrowRight');
const turned = await player();
check('steering changes the heading', Math.abs(turned.heading - moving.heading) > 0.1);

await page.keyboard.up('w');
await page.keyboard.down('s');
await page.waitForTimeout(1200);
await page.keyboard.up('s');
const braked = await player();
check('S brakes the car', braked.speed < turned.speed, `${braked.speed} < ${turned.speed}`);

console.log('\nopponents');
const field = await page.evaluate(() => window.__game.carsDebug());
check('three AI opponents share the track', field.filter((c) => !c.isPlayer).length === 3);
check('every car drives a different model', new Set(field.map((c) => c.name)).size === 4);
check('AI cars are moving', field.filter((c) => !c.isPlayer).every((c) => c.speed > 20));

console.log('\ntracks');
await page.keyboard.press('2');
await page.waitForTimeout(400);
check('key 2 switches to the dirt circuit', (await trackName()) === 'DIRT CIRCUIT');
await page.keyboard.down('w');
await page.waitForTimeout(2000);
await page.keyboard.up('w');
check('the car drives on the dirt circuit too', (await player()).speed > 60);
await page.keyboard.press('1');
await page.waitForTimeout(300);
check('key 1 switches back to asphalt', (await trackName()) === 'ASPHALT CIRCUIT');
await page.keyboard.press('c');
await page.waitForTimeout(300);
check('key C puts the player in another car', (await player()).name !== atStart.name);

console.log('\nfull race');
for (const key of ['1', '2']) {
  await page.keyboard.press(key);
  await page.waitForTimeout(300);
  const name = await trackName();
  const race = await page.evaluate(() => window.__game.simulateRace(400));
  check(`${name}: all four cars finish`, race.allFinished, JSON.stringify(race));
  check(`${name}: everyone completes exactly ${3} laps`, race.laps.every((l) => l === 3), race.laps.join(','));
  check(`${name}: finishing positions are 1..4`, new Set(race.positions).size === 4, race.positions.join(','));
}

console.log('\nerrors');
check('no console or network errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log(failures === 0 ? '\nbrowser smoke test passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
