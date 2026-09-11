# Ironworks — pygame edition

The same factory-building RPG, rewritten from scratch in **pure Python + pygame**.
No other dependencies: no numpy, no image files, no audio files, no shaders. Every
sprite is painted with `pygame.draw` at load time and every sound is synthesised
into a raw buffer with the standard library.

```bash
pip install pygame
python3 run.py
```

Options: `--width/--height`, `--fullscreen`, `--seed N`, `--no-audio`, `--continue`
(load the last save on start). Saves live in `~/.ironworks_save.json`.

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
| Wheel | Zoom |
| `Esc` | Close window / options |

## Layout

```
run.py                  launcher
ironworks/main.py       boot: warms every sprite behind a loading bar, runs the loop
ironworks/game.py       game controller: input routing, clock, economy tick, persistence
ironworks/core/         seeded RNG + value noise, input, math helpers
ironworks/art/          palette, drawing primitives, tiles, props, machines,
                        characters, item icons, UI kit
ironworks/data/         items, recipes, buildables, tech tree
ironworks/world/        terrain generation, biomes, deposits, props
ironworks/entities/     player, employees, townsfolk
ironworks/systems/      factory simulation, economy + contracts, research, missions,
                        employees, particles, save/load
ironworks/render/       camera, chunked world renderer, lighting
ironworks/ui/           HUD, windows, immediate-mode widgets
ironworks/audio/        synthesised sound and dynamic music
```

## How the pygame version differs under the hood

Same game, same numbers, same art language — but pygame is not a canvas, so a few
things are built differently:

* **Antialiasing.** `pygame.draw` has no AA, so every sprite is painted at 2× size
  and smoothscaled down (`draw.render_sprite`). Painters receive a `k` factor and
  multiply absolute sizes by it.
* **Alpha blending.** `pygame.draw` writes colours verbatim, alpha included, instead
  of blending. `art/draw.py` wraps every primitive (`line`, `rect`, `circle`,
  `polygon`, `arc`, `ellipse`): a translucent colour is drawn on a scratch surface
  and blitted, so it composites like canvas does.
* **Gradients and glow** are built line-by-line / as cached radial surfaces rather
  than by the graphics API, and are only ever generated at bake time.
* **Zoom** is one transform per frame: the world is drawn 1:1 into a logical surface
  and smoothscaled to the window once, instead of scaling every blit.
* **Audio** is generated with `array` + `math` into 16-bit buffers handed to
  `pygame.mixer`. Notes, percussion and the ambience loops are cached, so the
  sequencer costs ~0.003 ms per beat in steady state.
* **Collision** uses a prop grid (`World.index_props`). Walking the full 6 500-prop
  list per query cost 16 ms/frame; bucketing by 4-tile cells brought it to 0.4 ms.

## Measured on this machine (headless, 1440×860)

| | |
| --- | --- |
| Art generation at boot | ~1.0 s (31 machines, 21 props, 33 item icons, 40 character sheets) |
| World generation | ~1.1 s (240×240 tiles, 1 092 ore tiles, 6 500 props) |
| Small factory | ~94 fps — render 7.5 ms, UI 2.7 ms, simulation 0.4 ms |
| 456 entities + 14 staff | ~68 fps — render 10.5 ms, UI 3.2 ms, simulation 1.0 ms |

Verified end to end: drill → belt → furnace → belt → dock sells for revenue;
water pump → pipe → chemical plant produces chemicals; placement, rotation,
hotbar, every window, hiring, research, repair, dialogue, land expansion,
hand-mining and a save/load round trip all exercised with no errors.
