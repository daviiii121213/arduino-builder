# Pure C# FPS Movement

First-person movement prototype in C# with OpenTK (OpenGL 3.3 core) and GLSL. No game engine, no physics
engine, no external models or textures: the whole training environment is generated in code.

## Layout

```
PureCSharpFps/
  PureCSharpFps.csproj      net8.0, OpenTK 4.8.2, copies shaders to the output directory
  Program.cs                creates the window settings and runs the game
  Game.cs                   window, update/render loop, input wiring, resource cleanup
  Camera.cs                 yaw/pitch (pitch clamped), view + perspective matrices, FOV
  PlayerController.cs       walk/sprint, jump, gravity, grounded state, sub-stepped movement
  CollisionWorld.cs         static AABB list and per-axis collision resolution
  Mesh.cs                   one unit-cube VAO/VBO/EBO + instance buffer (one draw call for the world)
  Shader.cs                 compile/link GLSL, cached uniform locations
  EnvironmentBuilder.cs     procedural floor, walls, corridors, crates, stairs, platforms, landmarks
  shaders/basic.vert, basic.frag
```

## Prerequisites

* .NET SDK 8.0 or newer (`dotnet --version`).
* A GPU/driver with OpenGL 3.3 (Intel UHD / Iris with current drivers is fine).
* Windows, Linux (X11 or XWayland; needs `libgl1`) or macOS. OpenTK ships its own GLFW natives.

## Commands

From the repository root:

```bash
# (project creation, for reference - already done in this repo)
# dotnet new console -n PureCSharpFps -f net8.0
# cd PureCSharpFps && dotnet add package OpenTK --version 4.8.2

dotnet restore PureCSharpFps
dotnet build PureCSharpFps -c Release
dotnet run --project PureCSharpFps -c Release
```

Shaders are copied next to the executable (`bin/Release/net8.0/shaders`) and loaded from
`AppContext.BaseDirectory`, so the program can be started from any working directory.

## Controls

| Input | Action |
|---|---|
| W / S | forward / backward relative to camera yaw |
| A / D | strafe left / right |
| Mouse | look (pitch clamped to +-89 degrees) |
| Space | jump (only while grounded; holding it re-jumps on landing) |
| Left Shift | sprint while held (8 m/s instead of 5 m/s) |
| Mouse wheel | adjust field of view (50-110, starts at 80) |
| Esc | 1st press releases the mouse, 2nd press closes the app. Left click recaptures. |

## Physics model

* Walk 5.0, sprint 8.0, jump velocity 5.5, gravity -18, height 1.8, radius 0.35, eye height 1.65,
  mouse sensitivity 0.12 degrees/pixel (all public fields in `PlayerController`).
* Horizontal direction uses yaw only (looking at the sky never lifts you), diagonals are normalized.
* Delta time is clamped to 50 ms and each frame is split into steps of at most 0.1 m, which is far smaller
  than any wall (0.5 m), so there is no tunneling at sprint or fall speeds.
* Collision volume (simplified, documented): an upright AABB, 2*radius square footprint x height.
  World geometry is a list of AABBs kept separate from render data. X, Z and Y are resolved one axis at a
  time, which gives wall sliding and reliable landing; vertical velocity is zeroed on contact so gravity does
  not accumulate while standing.
* A jump rises about 0.84 m, so the stairs use 0.7 m steps; the jump course has gaps up to 4.2 m
  (sprint jump covers about 4.9 m).

## Rendering

Core profile OpenGL 3.3: VAO/VBO/EBO, instanced rendering (center, size, color, grid flag per box), depth test,
back-face culling, ambient + directional light, procedural tile lines in the fragment shader, light fog.
No immediate mode, one shared cube mesh for every box, shaders compiled once, no allocation in the render loop
(except the window title string twice per second). GPU buffers, VAO and the program are deleted on shutdown.

## Verification status

Done in a Linux container with .NET 8.0.131 and Mesa software rendering (llvmpipe) under Xvfb:

* `dotnet build -c Release`: 0 warnings, 0 errors.
* The app opens, renders the environment, moves with W, accepts Space, and exits after Esc, Esc.
* Headless tests of `PlayerController`/`CollisionWorld` (throwaway harness, not part of the repo): grounding at
  20/60/144 FPS, jump apex ~0.8 m, no mid-air jump, walk/sprint/diagonal speeds, wall stops and sliding at 10/60/144
  FPS, stair climbing, and a 200k-step random fuzz with no penetration of any box.

Not tested: real Intel hardware, mouse-look feel with a physical mouse (the virtual display only checked
that the loop runs), macOS and Windows, actual 60 FPS on an i3-1005G1.

## Known limitations

* The player is an AABB, not a true capsule: no rounded edges, no step-up on small ledges.
* Movement has instant acceleration, with full control in the air.
* No shadows, textures, UI or sound. Grid lines are the only surface detail.
* Mouse look uses OpenTK's grabbed cursor; raw-input behavior depends on the platform.

## Troubleshooting

* `Shader compile failed`: your driver does not offer GLSL 330 / OpenGL 3.3; update the graphics driver.
* `Failed to load GLFW` / `libGL.so.1` missing on Linux: install `libgl1` (and `libx11-6`).
* Black window under WSL/VM: use WSLg or a driver with OpenGL 3.3, or set `LIBGL_ALWAYS_SOFTWARE=1`
  (and `MESA_GL_VERSION_OVERRIDE=3.3`) to use Mesa software rendering (slow).
* Shader file not found: build first; shaders are copied to the output directory by the project file.
* Low FPS on integrated graphics: shrink the window; the scene is a single draw call, so fill rate is the limit.
