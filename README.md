# Pixel Racer

A small top-down pixel-art racing game: TypeScript game logic, HTML5 Canvas rendering,
no external art assets — every sprite, texture and track surface is drawn in code.

The game boots straight into a race. There is no menu.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts: `npm run build` (typecheck + production bundle), `npm run preview`,
`npm test` (headless simulation checks), `npm run typecheck`.

## Controls

| Key | Action |
| --- | --- |
| `W` / `↑` | accelerate |
| `S` / `↓` | brake, then reverse |
| `A` / `←` | steer left |
| `D` / `→` | steer right |
| `Space` | handbrake (drift) |
| `1` / `2` | asphalt circuit / dirt circuit |
| `C` | swap the car you drive |
| `R` | restart the race |

## The race

Three laps, four cars: you plus three AI opponents, each in a different model.
The HUD shows only your lap, your position and your speed.

**Asphalt Circuit** — fast, grippy, long straights and a right-hand S, with kerbs on
the corner apexes, white edge lines, a rubbered-in racing line and tyre stacks
lining the outside of the turns.

**Dirt Circuit** — narrower, twistier and looser. Lower grip means the car rotates
into a slide much more readily, wheel ruts and gravel line the surface, and hay
bales mark the corners. Off the racing surface, grass kills your speed on both tracks.

### Cars

| Car | Top speed | Acceleration | Handling |
| --- | --- | --- | --- |
| Bolt | 300 | 250 | 2.70 — the balanced starting car |
| Comet | 345 | 195 | 2.20 — fastest, lazy off the line, poor turn-in |
| Pebble | 268 | 295 | 3.25 — slowest but the sharpest tool in the corners |
| Boulder | 292 | 215 | 2.35 — heavy; wins the contact, loses the apex |

## How it works

- `src/pixel.ts` — pixel-art plumbing: seeded RNG, character-map → sprite, tiling textures.
- `src/cars.ts`, `src/decor.ts` — the art itself, hand-drawn as character maps (one char = one pixel).
- `src/tracks.ts` — track layouts as control points, smoothed into a waypoint loop; also
  places the start/finish line on the longest straight, scatters scenery, and answers
  "am I on the road?" and "how far round am I?".
- `src/car.ts` — arcade physics (throttle, braking, drag, grip and slide), collisions,
  lap tracking, and the waypoint-following AI driver.
- `src/world.ts` — bakes a whole track into one canvas: grass, surface, kerbs, start
  line and props. The game just blits the camera window out of it.
- `src/game.ts` — fixed-step loop, camera, effects and the minimal HUD.

Physics runs at a fixed 120 Hz step, independent of the frame rate. Rendering targets a
small pixel buffer (~360px tall) which the browser scales up with nearest-neighbour, so
everything stays chunky.

## Tests

`npm test` runs a headless suite (no canvas needed) covering the pixel maps, track
geometry, the grid, physics (acceleration, braking, reverse, steering, surfaces, grip),
collisions, lap counting, and a full four-car AI race on both circuits.

There is also an optional end-to-end check that drives the real game in a browser:

```bash
npm i -D playwright && npx playwright install chromium
npm run dev                 # in another shell
npm run test:browser
```
