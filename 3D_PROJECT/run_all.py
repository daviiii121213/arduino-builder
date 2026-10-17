"""Run the full pipeline in one process (for the standalone `bpy` module).

With a Blender install, prefer running each script via `blender -b -P <script>`.
"""
import os
import runpy

HERE = os.path.dirname(os.path.abspath(__file__))
for script in ("generate_model.py", "setup_scene.py", "render_preview.py", "export_asset.py"):
    runpy.run_path(os.path.join(HERE, script), run_name="__main__")
