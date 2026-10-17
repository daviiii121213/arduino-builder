"""Export the MODEL + MATERIALS_AND_DETAILS objects to GLB and FBX.

Run after generate_model.py:  blender -b -P export_asset.py
"""
import os
import sys

import bpy

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(PROJECT_DIR, "project.blend")
EXPORT_DIR = os.path.join(PROJECT_DIR, "exports")
ASSET_COLLECTIONS = ("MODEL", "MATERIALS_AND_DETAILS")


def select_asset():
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for n in ASSET_COLLECTIONS if bpy.data.collections.get(n) for o in bpy.data.collections[n].objects]
    if not any(o.type == "MESH" for o in objs):
        sys.exit("[export_asset] ERROR: no mesh objects in MODEL collections. Run generate_model.py first.")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    return objs


def check(path, result, label):
    ok = "FINISHED" in result and os.path.exists(path) and os.path.getsize(path) > 0
    size = os.path.getsize(path) if os.path.exists(path) else 0
    print(f"[export_asset] {label}: {'OK' if ok else 'FAILED'} result={result} size={size} path={path}")
    return ok


def main():
    if not os.path.exists(BLEND_PATH):
        sys.exit(f"[export_asset] ERROR: {BLEND_PATH} missing.")
    bpy.ops.wm.open_mainfile(filepath=BLEND_PATH)
    os.makedirs(EXPORT_DIR, exist_ok=True)
    objs = select_asset()
    print(f"[export_asset] Exporting {len(objs)} objects")
    results = {}

    glb = os.path.join(EXPORT_DIR, "model.glb")
    try:
        r = bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True,
                                      export_apply=True, export_yup=True)
        results["GLB"] = check(glb, r, "GLB")
    except Exception as exc:  # noqa: BLE001
        print(f"[export_asset] GLB export failed: {exc}", file=sys.stderr)
        results["GLB"] = False

    fbx = os.path.join(EXPORT_DIR, "model.fbx")
    try:
        r = bpy.ops.export_scene.fbx(filepath=fbx, use_selection=True, use_mesh_modifiers=True,
                                     apply_unit_scale=True, apply_scale_options="FBX_SCALE_ALL",
                                     axis_forward="-Z", axis_up="Y", path_mode="AUTO")
        results["FBX"] = check(fbx, r, "FBX")
    except Exception as exc:  # noqa: BLE001
        print(f"[export_asset] FBX export failed: {exc}", file=sys.stderr)
        results["FBX"] = False

    if not all(results.values()):
        sys.exit(f"[export_asset] Some exports failed: {results}")


if __name__ == "__main__":
    main()
