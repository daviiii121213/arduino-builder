"""Procedurally generate a black polymer pistol-style visual prop (exterior only).

Resets the scene, builds the geometry + materials, and saves project.blend.
Run:  blender -b -P generate_model.py
"""
import math
import os
import sys

import bpy

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
BLEND_PATH = os.path.join(PROJECT_DIR, "project.blend")

# Material parameters, kept in one place for easy tweaking.
MATERIALS = {
    "Matte_Black_Polymer": dict(color=(0.018, 0.018, 0.019), roughness=0.62, specular=0.35, bump=0.0),
    "Grip_Texture_Polymer": dict(color=(0.016, 0.016, 0.017), roughness=0.78, specular=0.3, bump=0.35),
    "Dark_Graphite_Surface": dict(color=(0.035, 0.036, 0.04), roughness=0.38, specular=0.5, metallic=0.55, bump=0.0),
    "Black_Accent_Material": dict(color=(0.008, 0.008, 0.009), roughness=0.5, specular=0.4, bump=0.0),
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def get_collection(name):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def make_material(name, color, roughness, specular, bump, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (400, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (100, 0)
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Specular IOR Level"].default_value = specular
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    # Subtle roughness variation so large flat faces don't look synthetic.
    rnoise = nt.nodes.new("ShaderNodeTexNoise"); rnoise.location = (-500, 300)
    rnoise.inputs["Scale"].default_value = 60.0
    rnoise.inputs["Detail"].default_value = 6.0
    rmap = nt.nodes.new("ShaderNodeMapRange"); rmap.location = (-250, 300)
    rmap.inputs["To Min"].default_value = max(roughness - 0.08, 0.0)
    rmap.inputs["To Max"].default_value = min(roughness + 0.08, 1.0)
    nt.links.new(rnoise.outputs["Fac"], rmap.inputs["Value"])
    nt.links.new(rmap.outputs["Result"], bsdf.inputs["Roughness"])
    if bump > 0:
        # Fine stippling for the grip: noise-driven bump.
        coord = nt.nodes.new("ShaderNodeTexCoord"); coord.location = (-700, 0)
        noise = nt.nodes.new("ShaderNodeTexNoise"); noise.location = (-500, 0)
        noise.inputs["Scale"].default_value = 900.0
        noise.inputs["Detail"].default_value = 2.0
        bmp = nt.nodes.new("ShaderNodeBump"); bmp.location = (-200, -150)
        bmp.inputs["Strength"].default_value = bump
        bmp.inputs["Distance"].default_value = 0.0004
        nt.links.new(coord.outputs["Object"], noise.inputs["Vector"])
        nt.links.new(noise.outputs["Fac"], bmp.inputs["Height"])
        nt.links.new(bmp.outputs["Normal"], bsdf.inputs["Normal"])
    mat.diffuse_color = (*color, 1.0)
    return mat


def link_only(obj, col):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def box(name, col, mat, loc, dims, rot=(0, 0, 0), bevel=0.0012, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = obj.data.name = name
    obj.scale = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    for p in obj.data.polygons:
        p.use_smooth = True
    link_only(obj, col)
    return obj


def cylinder(name, col, mat, loc, radius, depth, rot=(0, math.radians(90), 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = obj.data.name = name
    obj.data.materials.append(mat)
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = min(radius, depth) * 0.12
    mod.segments = 2
    mod.limit_method = "ANGLE"
    mod.harden_normals = True
    for p in obj.data.polygons:
        p.use_smooth = True
    link_only(obj, col)
    return obj


def boolean_cut(target, cutters):
    """Subtract cutter objects from target, apply, then delete cutters."""
    for i, c in enumerate(cutters):
        mod = target.modifiers.new(f"Cut_{i:02d}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.object = c
        mod.solver = "EXACT"
        # Booleans must run before the bevel.
        target.modifiers.move(len(target.modifiers) - 1, 0 + i)
    bpy.context.view_layer.objects.active = target
    for mod in [m for m in target.modifiers if m.type == "BOOLEAN"]:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in cutters:
        bpy.data.objects.remove(c, do_unlink=True)


def build():
    reset_scene()
    model = get_collection("MODEL")
    details = get_collection("MATERIALS_AND_DETAILS")
    for name in ("LIGHTING", "CAMERAS", "ENVIRONMENT"):
        get_collection(name)

    mats = {n: make_material(n, **p) for n, p in MATERIALS.items()}
    poly, grip_mat = mats["Matte_Black_Polymer"], mats["Grip_Texture_Polymer"]
    graphite, accent = mats["Dark_Graphite_Surface"], mats["Black_Accent_Material"]

    # Root empty so the whole asset moves as one unit.
    root = bpy.data.objects.new("PISTOL_ROOT", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.05
    model.objects.link(root)

    grip_angle = math.radians(18)
    parts = []

    # Slide (upper body) with rear cosmetic grooves and an inset port.
    slide = box("Slide", model, graphite, (-0.0025, 0, 0.0155), (0.186, 0.0255, 0.03), bevel=0.0018)
    cutters = []
    for i in range(8):
        x = -0.088 + i * 0.0036
        cutters.append(box(f"_cut_serr_L{i}", model, accent, (x, 0.0135, 0.0145), (0.0013, 0.004, 0.022), bevel=0))
        cutters.append(box(f"_cut_serr_R{i}", model, accent, (x, -0.0135, 0.0145), (0.0013, 0.004, 0.022), bevel=0))
    for side in (1, -1):
        cutters.append(box(f"_cut_chamfer_{side}", model, accent, (-0.0025, side * 0.0155, 0.0335), (0.2, 0.008, 0.008),
                           rot=(math.radians(45), 0, 0), bevel=0))
    cutters.append(box("_cut_muzzle_bevel", model, accent, (0.0935, 0, 0.034), (0.012, 0.04, 0.03),
                       rot=(0, math.radians(35), 0), bevel=0))
    cutters.append(box("_cut_port", model, accent, (0.012, 0.004, 0.031), (0.034, 0.016, 0.006), bevel=0))
    boolean_cut(slide, cutters)
    parts.append(slide)

    # Visible barrel hood inside the port and muzzle at the front.
    parts.append(box("Barrel_Hood", details, graphite, (0.012, 0.004, 0.0275), (0.033, 0.0125, 0.004), bevel=0.0006))
    parts.append(cylinder("Barrel_Muzzle", details, graphite, (0.0862, 0, 0.0165), 0.0068, 0.004))
    parts.append(cylinder("Muzzle_Bore", details, accent, (0.0875, 0, 0.0165), 0.0045, 0.004))

    # Sights.
    parts.append(box("Sight_Front", details, accent, (0.080, 0, 0.0325), (0.004, 0.0035, 0.005), bevel=0.0006))
    parts.append(box("Sight_Rear_L", details, accent, (-0.087, 0.005, 0.0328), (0.008, 0.0055, 0.0058), bevel=0.0006))
    parts.append(box("Sight_Rear_R", details, accent, (-0.087, -0.005, 0.0328), (0.008, 0.0055, 0.0058), bevel=0.0006))

    # Frame: dust cover + accessory-rail style slots (cosmetic).
    frame = box("Frame_DustCover", model, poly, (0.0055, 0, -0.0085), (0.158, 0.027, 0.019), bevel=0.002)
    rail_cuts = [box(f"_cut_rail{i}", model, accent, (0.045 + i * 0.01, 0, -0.018), (0.004, 0.04, 0.004), bevel=0)
                 for i in range(4)]
    boolean_cut(frame, rail_cuts)
    parts.append(frame)
    parts.append(box("Frame_ParkingLine", details, accent, (0.0, 0, 0.0002), (0.17, 0.0262, 0.0012), bevel=0))

    # Grip, beavertail, magazine base.
    grip = box("Grip", model, grip_mat, (-0.064, 0, -0.064), (0.044, 0.0285, 0.108), rot=(0, grip_angle, 0), bevel=0.0075, segments=5)
    parts.append(grip)
    parts.append(box("Grip_Beavertail", model, poly, (-0.083, 0, -0.012), (0.024, 0.026, 0.012),
                     rot=(0, math.radians(-8), 0), bevel=0.003))
    off = 0.058
    parts.append(box("Magazine_Baseplate", details, accent,
                     (-0.064 - off * math.sin(grip_angle), 0, -0.064 - off * math.cos(grip_angle)),
                     (0.05, 0.031, 0.008), rot=(0, grip_angle, 0), bevel=0.0015))

    # Trigger guard: a stretched torus, top half buried inside the frame.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.018, minor_radius=0.0032, major_segments=48, minor_segments=12,
                                     location=(0.001, 0, -0.021), rotation=(math.radians(90), 0, 0))
    guard = bpy.context.active_object
    guard.name = guard.data.name = "Trigger_Guard"
    guard.scale = (1.45, 1.0, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    guard.data.materials.append(poly)
    bpy.ops.object.shade_smooth()
    link_only(guard, model)
    parts.append(guard)

    parts.append(box("Trigger", details, accent, (-0.002, 0, -0.026), (0.0055, 0.006, 0.019),
                     rot=(0, math.radians(12), 0), bevel=0.0015))
    parts.append(box("Slide_Stop_Lever", details, accent, (-0.03, 0.014, -0.004), (0.016, 0.0015, 0.0035), bevel=0.0005))
    parts.append(box("Takedown_Tab", details, accent, (0.012, 0.0138, -0.006), (0.006, 0.0012, 0.004), bevel=0.0004))

    for p in parts:
        p.parent = root
    bpy.context.view_layer.update()
    return parts


def main():
    try:
        parts = build()
    except Exception as exc:  # noqa: BLE001
        print(f"[generate_model] ERROR: {exc}", file=sys.stderr)
        raise
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    print(f"[generate_model] Built {len(parts)} parts, saved {BLEND_PATH}")


if __name__ == "__main__":
    main()
