# Pixel Racer

A top-down pixel-art racing game: TypeScript game logic, HTML5 Canvas rendering,
and no external art or audio assets — every sprite, texture, glyph and sound
effect is generated in code.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts: `npm run build` (typecheck + bundle), `npm run build:standalone`
(one self-contained `dist/pixel-racer.html`), `npm run preview`, `npm test`
(headless simulation checks), `npm run typecheck`.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | accelerate |
| `S` / `↓` | brake, then reverse |
| `A` / `←` · `D` / `→` | steer |
| `Shift` | nitro boost |
| `Space` | handbrake (drift) |
| `R` | restart the race |
| `Esc` | back to the menu |

In the menus: arrows move, `Enter` selects, `Esc` goes back. The mouse works too —
click a row to highlight it, click again to confirm.

## The game

**Menu** — `PLAY` walks you through car → circuit → conditions; `SETTINGS` holds
Controls, Sound and How to Play. A live AI race runs behind the menu, previewing
the circuit and weather you currently have selected.

**Race** — three laps, six cars, one of them yours. The HUD shows lap, position,
speed and the nitro gauge.

### Cars

| Car | Top speed | Accel | Handling | Nitro tank | Boost |
| --- | --- | --- | --- | --- | --- |
| Bolt | 300 | 250 | 2.70 | 4.0s | +28% |
| Comet | 345 | 195 | 2.20 | 3.0s | +22% |
| Pebble | 268 | 295 | 3.25 | 5.0s | +32% |
| Boulder | 292 | 215 | 2.35 | 4.5s | +25% |
| Zephyr | 275 | 310 | 3.40 | 6.0s | +30% |
| Vulcan | 318 | 230 | 2.30 | 7.5s | +38% |

### Circuits

| Circuit | Surface | Length | Corners | Difficulty |
| --- | --- | --- | --- | --- |
| Bayside Circuit | asphalt | 2140 m | 4 | ★ |
| Dustbowl Rally | dirt | 2230 m | 6 | ★★ |
| Serpentine Pass | asphalt | 3150 m | 12 | ★★★ |

Each circuit has its own art: Bayside runs on grey asphalt with red/white kerbs
and tyre stacks, Dustbowl on rutted brown dirt edged with gravel and hay bales,
Serpentine on narrow blue-grey mountain tarmac with blue kerbs, pines and
barriers.

### Conditions

- **Sunny** — full grip, clear sight.
- **Rain** — grip drops to 70%, the car steps out early, spray comes off the
  tyres and a cold veil sits over the world.
- **Night** — the world goes dark and you drive by headlight: a beam ahead of
  each car and a pool of light around it.

### Nitro

Hold `Shift` to burn nitro: top speed and acceleration rise for as long as the
tank lasts, with twin flames out of the exhausts. Tank size, boost strength and
refill rate differ per car. Run it dry and the bottle locks out until a quarter
tank is back — and it only refills once you release the key. The AI spends its
nitro on the straights.

## How it works

- `src/pixel.ts` — pixel-art plumbing: seeded RNG, character-map → sprite, tiling textures.
- `src/font.ts` — a hand-drawn 5×7 bitmap font; all menu and HUD text is pixels, not a system font.
- `src/cars.ts`, `src/decor.ts`, `src/icons.ts` — the art, hand-drawn as character maps.
- `src/tracks.ts` — layouts as control points, smoothed into a waypoint loop; each
  circuit carries its own colour theme and the facts shown on the select screen.
- `src/car.ts` — arcade physics (throttle, braking, drag, grip, slide), nitro,
  collisions, lap tracking, and the waypoint-following AI driver.
- `src/weather.ts` — condition definitions plus the rain and night renderers.
- `src/world.ts` — bakes a whole circuit into one canvas from its theme.
- `src/race.ts` — one race: field, fixed-step loop, effects, camera.
- `src/menu.ts` / `src/menuRender.ts` — the menu state machine and its artwork.
- `src/audio.ts` — WebAudio synthesis: engine note, nitro roar, impacts, menu blips.
- `src/game.ts` — app shell: menu, attract race, HUD, results.

Physics runs at a fixed 120 Hz step, independent of frame rate. Rendering targets
a small pixel buffer (~360px tall) which the browser scales up with
nearest-neighbour, so everything stays chunky.

## Tests

`npm test` runs 188 headless checks (no canvas needed): pixel maps and font
coverage, track geometry and grid placement, physics (acceleration, braking,
reverse, steering, surfaces, grip), nitro (boost, drain, lockout, refill),
weather modifiers, collisions, lap counting, menu navigation, and full six-car AI
races on all three circuits in several conditions.

There is also an end-to-end check that drives the real game in a browser —
menus, nitro, and a full race on each circuit:

```bash
npm i -D playwright && npx playwright install chromium
npm run dev                 # in another shell
npm run test:browser
```
