"""Add studio environment, lights, camera and render settings to project.blend.

Run after generate_model.py:  blender -b -P setup_scene.py
"""
import math
import os
import sys

import bpy
from mathutils import Vector

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(PROJECT_DIR, "project.blend")
TARGET = Vector((-0.004, 0.0, -0.045))


def clear_collection(name):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(col)
    for obj in list(col.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    return col


def add_light(col, name, kind, loc, energy, size, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if kind == "AREA":
        data.shape = "RECTANGLE"
        data.size, data.size_y = size, size * 0.6
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    col.objects.link(obj)
    look_at(obj, TARGET)
    return obj


def look_at(obj, target):
    direction = target - Vector(obj.location)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup():
    scene = bpy.context.scene
    if bpy.data.objects.get("PISTOL_ROOT") is None:
        raise RuntimeError("Model not found. Run generate_model.py first.")

    env = clear_collection("ENVIRONMENT")
    bpy.ops.mesh.primitive_plane_add(size=60.0, location=(0, 0, -0.1265))
    floor = bpy.context.active_object
    floor.name = "Studio_Floor"
    for c in list(floor.users_collection):
        c.objects.unlink(floor)
    env.objects.link(floor)
    fmat = bpy.data.materials.get("Studio_Floor") or bpy.data.materials.new("Studio_Floor")
    fmat.use_nodes = True
    bsdf = fmat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.55, 0.55, 0.56, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    floor.data.materials.clear()
    floor.data.materials.append(fmat)

    world = bpy.data.worlds.get("Studio_World") or bpy.data.worlds.new("Studio_World")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.6, 0.6, 0.62, 1)
    bg.inputs["Strength"].default_value = 0.35
    scene.world = world

    lights = clear_collection("LIGHTING")
    add_light(lights, "Key_Light", "AREA", (0.35, -0.45, 0.45), 9, 0.5)
    add_light(lights, "Fill_Light", "AREA", (-0.5, -0.35, 0.1), 2.5, 0.7, (0.92, 0.95, 1.0))
    add_light(lights, "Rim_Light", "AREA", (-0.25, 0.45, 0.35), 12, 0.35)
    add_light(lights, "Top_Light", "AREA", (0.0, 0.0, 0.6), 2, 0.8)

    cams = clear_collection("CAMERAS")
    cam_data = bpy.data.cameras.new("Main_Camera")
    cam_data.lens = 85
    cam_data.dof.use_dof = True
    cam_data.dof.aperture_fstop = 5.6
    cam = bpy.data.objects.new("Main_Camera", cam_data)
    cam.location = TARGET + Vector((0.34, -0.7, 0.16))
    look_at(cam, TARGET)
    cams.objects.link(cam)
    cam_data.dof.focus_distance = (TARGET - cam.location).length
    scene.camera = cam

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.film_transparent = False


def main():
    if os.path.exists(BLEND_PATH) and bpy.data.filepath != BLEND_PATH:
        bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    try:
        setup()
    except Exception as exc:  # noqa: BLE001
        print(f"[setup_scene] ERROR: {exc}", file=sys.stderr)
        raise
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"[setup_scene] Scene configured, saved {BLEND_PATH}")


if __name__ == "__main__":
    main()
