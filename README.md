# Ironworks — a Factory RPG

A 2D top-down RPG about turning one rusty furnace on a patch of gravel into a sprawling,
automated industrial complex. You walk the floor yourself: mine by hand, lay belts, wire
power, hire a crew, take contracts, research technology and watch the plant come alive.

**Play it:** serve the folder and open it — there is no build step.

```bash
npm start          # python3 -m http.server 8080
# or: npx http-server -p 8080 -c-1 .
```

Then open <http://localhost:8080>. Any static file server works; ES modules mean it must be
served over HTTP rather than opened as a `file://` URL.

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | Move |
| `Shift` | Sprint |
| Mouse | Use tool, place buildings, select machines |
| `E` | Interact — talk, repair, load fuel, collect output |
| `B` | Build menu |
| `R` | Rotate the ghost while building |
| `X` | Demolish mode |
| `1`–`8` | Hotbar |
| `I` | Inventory |
| `Tab` | Factory management (power, market, contracts, staff, stats) |
| `T` | Technology tree |
| `J` | Missions |
| `K` | Skills |
| `M` | Regional map |
| `P` | Pause |
| `F5` / `F9` | Save / load |
| `Esc` | Close window / options |

## How the factory works

* **Power.** Generators make it, cables carry it. A machine must touch a cable that leads
  back to a generator. Belts are forgiving — energising any belt in a connected run powers
  the whole line. Each power network is solved separately, so brownouts are local: an
  under-supplied network slows every machine on it proportionally.
* **Extraction.** Mining drills sit on an ore deposit and fill their own output buffer.
  Deposits deplete, so the map matters.
* **Transport.** A conveyor pulls from whatever sits behind it and pushes into whatever is
  in front — machine, crate, dock or another belt.
* **Processing.** Each machine family has its own recipes: furnaces smelt, presses stamp,
  cutters cut, chemical plants react, assemblers combine, robotics cells build the endgame.
  Machines heat up, wear down and eventually break; a mechanic on staff or a maintenance
  bay keeps them alive.
* **Fluids.** Water pumps draw from a shoreline and pipes form fluid networks — any
  machine touching a pipe run can push fluid in or draw it out, feeding chemical plants
  without occupying a belt.
* **Selling.** Anything dropped on a Loading Dock is collected by truck and paid for at the
  live market rate, and is automatically counted against active contracts.
* **Money.** Prices drift with supply and demand, flooding the market lowers your take, and
  upkeep, electricity and wages tick against you the whole time.

## Progression

Five skills (engineering, production, logistics, management, technology) level from doing
the matching work, and skill points buy permanent bonuses. Labs generate research points
that walk a twelve-node technology tree from Steelmaking to Autonomous Systems, unlocking
machines, recipes and buildings as they go. Fourteen story missions carry the opening hours;
contracts and the market carry the rest. Land is bought in rings as you outgrow the plot.

## Art

There are no image files in this repository. Every visible element — terrain, ore, trees,
city buildings, cranes, ships, every machine, every item icon, every character, and the UI
chrome itself — is painted with Canvas2D at load time from the drawing toolkit in
`src/art/draw.js`: bevelled plate, brushed metal, rivets, grime, hazard stripes, glass,
glow. Seeded RNG means the same machine always looks the same, and a shared palette
(`src/art/palette.js`) keeps rusted industrial orange against cold steel across the whole
game. Audio is synthesised the same way with the WebAudio API — a reactive ambience bed
plus a sequencer whose arrangement grows as the factory does.

## Layout

```
index.html            shell + loading screen
src/main.js           boot: warms every art cache, then runs the loop
src/game.js           game controller: input routing, clock, economy tick, persistence
src/core/             rng + value noise, input, math helpers
src/art/              palette, drawing primitives, tiles, props, machines, characters,
                      item icons, UI kit
src/data/             items, recipes, buildables, tech tree
src/world/            terrain generation, biomes, deposits, props
src/entities/         player, employees, townsfolk
src/systems/          factory simulation, economy + contracts, research, missions,
                      employees, particles, save/load
src/render/           camera, chunked world renderer, lighting
src/ui/               HUD, windows, immediate-mode widgets
src/audio/            synthesised sound and dynamic music
```

Performance notes: terrain is cached into 8×8-tile chunk canvases, sprites are generated
once and reused, power is only re-solved when the layout changes, particles are pooled,
view-culled and emitted frame-rate independently, and the backing-store scale is capped on
large displays. Several hundred machines run comfortably.
