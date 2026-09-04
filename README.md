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
| `Esc` | pause menu |

In the menus: arrows move, `Enter` selects, `Esc` goes back. The mouse works too —
click a row to highlight it, click again to confirm.

## The game

**Menu** — `PLAY` walks you through car → circuit → conditions → race setup;
`FREE PRACTICE` puts you alone on any circuit; `COMPETITION` runs the
three-round championship; `TOURNAMENT` runs the elimination bracket; `SETTINGS`
holds Controls, Sound, Language and How to Play.

## Free practice

The circuit to yourself: pick a car, any of the three circuits and any of the
three conditions, and go straight out — no rivals, no setup screen, no flag.

Laps are timed instead of counted down. The HUD shows the lap you are on, the
last lap and the best of the session; the timer only starts on your first
crossing of the line, so the run out of the pit box is never recorded. Every
other system behaves exactly as it does in a race — gears, brake wear, nitro,
recovery, weather and the dial — and `R` resets the session.

## Tournament

Twelve entries, four rounds, one survivor. The twelve come from the same six
cars: every model fields a second entry in its own livery, so a car never meets
itself until the field has been cut down. Every elimination race is three laps.

| Round | Field | Through | Circuit | Conditions | AI |
| --- | --- | --- | --- | --- | --- |
| Group stage | 2 × 6 | top 3 of each | Bayside Circuit | Sunny | Hard |
| Six cars | 6 | top 4 | Dustbowl Rally | Rain | Elite |
| Four cars | 4 | top 2 | Serpentine Pass | Night | Elite |
| Final | 2 | the champion | Serpentine Pass | Night storm | Impossible |

The group stage runs both groups at once: the one the player is not in is
simulated in the background, on the same physics and the same AI, a slice at a
time while the player races, and finished off before the results go up.

The elimination screen after each round shows both groups, the cut line, and
who is through or out. Finish below the line and the run ends there — there is
no continuing past it.

**The final** is the hardest race in the game: the mountain circuit, in the dark
*and* the wet (a condition kept off the weather picker), against the hidden
Impossible level. It is still the same car and the same physics — gears, brake
wear, nitro, slipstream, track limits and collisions all apply to it exactly as
they do to the player; what it has is corner confidence, reactions and a line
it never wanders off.

## Competition

Three rounds on the circuits the game already has, run back to back on one grid
of six, with points carried between them.

| Round | Circuit | Laps | Level | Conditions |
| --- | --- | --- | --- | --- |
| 1 | Bayside Circuit | 3 | Easy | Sunny |
| 2 | Dustbowl Rally | 4 | Medium | Rain |
| 3 | Serpentine Pass | 6 | Difficult | Night |

Points at every flag: **10 - 7 - 5 - 3 - 2 - 1**. They accumulate across the
three rounds and decide the title; a tie breaks on the most recent result. The
running total sits in a slim strip at the top of the screen during a race, the
table comes up between rounds, and the driver with most points after round
three takes the podium as season champion.

The championship field is a step up from a single race at the same label — and
it gets there by racing better, not by being handed speed:

- **Line** — out-in-out: set up wide, tuck to the apex, run back out on exit,
  using the full width of the road instead of a fixed offset with a wobble.
- **Braking** — proper braking distance (`v² = u² + 2as`) against every corner
  in range, then trail braking rather than stamping on the pedal.
- **Steering** — a damping term on the error, so the sharper drivers hold a
  line instead of weaving.
- **Traffic** — they look a quarter-second ahead, steer around contact rather
  than leaning on it, and commit to a side to come past.
- **Slipstream** — sitting in a car's wake cuts drag by up to 45% and lifts the
  top end 7%. It is plain physics, so you get the tow on the same terms.
- **Nitro** — spent on a move or out of the tow, not just because the road is
  straight.

The final round runs an internal level a step beyond Hard, which is never
offered on the single-race screen. On Serpentine that field laps around 8%
quicker than a Hard single-race AI, without leaving the road. A live AI race runs behind the menu,
previewing the circuit and weather you currently have selected.

**Language** — English and Português (BR). Every menu, button, setting,
instruction and in-race message switches, and the pixel font carries the
accented capitals Portuguese needs. The choice is remembered.

**Race setup** (single races) — the last screen before the lights: how many rivals line up
(1–5, so a field of 2 to 6 cars) and how hard they race.

| Level | Rivals |
| --- | --- |
| Easy | 84% pace, loose lines, nitro held back |
| Normal | full pace on their own line |
| Hard | 110% pace, tight lines, nitro spent early |

The level scales the AI only — your car is identical on every setting, so lap
times stay comparable. A lap of Bayside takes an easy rival about 28s and a
hard one about 24s.

**Starting a race** — the gantry light fills red, then red + yellow, then green.
The field is held on the grid, throttle disabled, until the lights go out.

**Pause** — `Esc` during a race opens a three-row menu: Settings, Return to Main
Menu, Continue. The race freezes until you pick.

**Race** — three laps, one of them yours. The HUD shows lap, position, the
nitro and brake gauges, and a pixel-art dial reading 0–260 km/h with the
current gear in its face.

**Gearbox** — every car shifts for itself, through five or six ratios with its
own change speeds. A change costs a moment of drive and drops the revs before
they climb again, and you hear the box work: the engine note follows the revs,
not road speed, with a mechanical clunk on each change.

**Brakes** — braking wears the brakes down from 100% in whole percent, at a
rate set by the car (Zephyr is gentlest, Boulder hardest on them) and by how
fast you were going. Driving and coasting cost nothing. What is left decides
how well the car stops: 100–76% full, 75–51% slightly down, 50–26% noticeably
down, 25–1% badly down, 0% almost nothing. From racing speed that is a 0.7s
stop with fresh brakes, 1.0s at 40%, and 2.2s at zero.

**Track recovery** — stay off the racing surface for three seconds and the
marshals step in: the car blinks, is set back down on the racing line pointing
the right way, and runs at reduced power for 1.8 seconds.

**Podium** — finish in the top three and your driver climbs out and raises the
trophy (1st), the silver medal (2nd) or the bronze (3rd), with confetti over a
grandstand. Each car has its own driver: their own build, race suit and helmet
crest.

### Cars

| Car | Top speed | Accel | Handling | Nitro tank | Gears | Brake wear |
| --- | --- | --- | --- | --- | --- | --- |
| Bolt | 300 | 250 | 2.70 | 4.0s | 6 | 1.8%/s |
| Comet | 345 | 195 | 2.20 | 3.0s | 6 | 2.2%/s |
| Pebble | 268 | 295 | 3.25 | 5.0s | 5 | 1.2%/s |
| Boulder | 292 | 215 | 2.35 | 4.5s | 5 | 2.6%/s |
| Zephyr | 275 | 310 | 3.40 | 6.0s | 6 | 1.0%/s |
| Vulcan | 318 | 230 | 2.30 | 7.5s | 5 | 2.4%/s |

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
- `src/i18n.ts` — every string in both languages, and the how-to pages.
- `src/difficulty.ts` — the three AI levels and the field-size limits.
- `src/speedo.ts` — the dial: plotted circles, ticks, needle and a 3x5 micro font.
- `src/championship.ts` — rounds, points and the standings table (no drawing in it).
- `src/tournament.ts` — the bracket: entries, groups, cuts and eliminations.
- `src/standings.ts` — the table and the between-rounds screen.
- `src/drivers.ts` — the six drivers (three builds, two poses each), trophy and medals.
- `src/victory.ts` — the podium scene.
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

`npm test` runs 457 headless checks (no canvas needed): pixel maps and font
coverage (including every accented character the translations use), track
geometry and grid placement, physics (acceleration, braking, reverse, steering,
surfaces, grip), nitro (boost, drain, lockout, refill), weather modifiers,
collisions, lap counting, menu, setup and pause navigation, both languages, the
start sequence order, grid sizing, the difficulty levels (an easy rival really
does lap slower than a hard one), track recovery (timing, blink, reposition,
power penalty), the gearbox (ratios, hysteresis, rev band, the torque cut on a
change), the dial's scale, brake wear (whole-percent steps, no wear from
driving, longer stops as it goes), podium awards, the championship (points,
accumulation, tie-breaks, the calendar, the hidden level staying hidden), the
racecraft gain over a normal race on every round, the slipstream, the
tournament (bracket shape, twelve entries in two groups, every cut, elimination
ending a run, and the hidden level and condition staying off the pickers), free
practice (its menu path, skipping the setup screen and its one-car grid), plus
full six-car AI races on all three circuits in several conditions.

There is also an end-to-end check that drives the real game in a browser —
menus, language switching, the start sequence, pause, nitro, recovery, the
podium animations and a full race on each circuit:

```bash
npm i -D playwright && npx playwright install chromium
npm run dev                 # in another shell
npm run test:browser
```
