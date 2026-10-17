"""Render renders/preview.png from project.blend.

Run after setup_scene.py:  blender -b -P render_preview.py
"""
import os
import sys

import bpy

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(PROJECT_DIR, "project.blend")
OUT_PATH = os.path.join(PROJECT_DIR, "renders", "preview.png")
REQUIRED = ["PISTOL_ROOT", "Slide", "Frame_DustCover", "Grip", "Trigger_Guard", "Main_Camera", "Key_Light"]


def main():
    if not os.path.exists(BLEND_PATH):
        sys.exit(f"[render_preview] ERROR: {BLEND_PATH} missing. Run generate_model.py and setup_scene.py first.")
    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    missing = [n for n in REQUIRED if bpy.data.objects.get(n) is None]
    if missing:
        sys.exit(f"[render_preview] ERROR: missing objects: {missing}")
    if bpy.context.scene.camera is None:
        sys.exit("[render_preview] ERROR: no active camera.")
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    bpy.context.scene.render.filepath = OUT_PATH
    bpy.ops.render.render(write_still=True)
    if not os.path.exists(OUT_PATH) or os.path.getsize(OUT_PATH) == 0:
        sys.exit(f"[render_preview] ERROR: render output missing or empty: {OUT_PATH}")
    print(f"[render_preview] Wrote {OUT_PATH} ({os.path.getsize(OUT_PATH)} bytes)")


if __name__ == "__main__":
    main()
