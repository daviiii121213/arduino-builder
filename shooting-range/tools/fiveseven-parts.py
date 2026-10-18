# Exporta o Five-seveN (.blend) em peças para animar: slide, trigger, magrelease, mag e body (o resto).
# Roda dentro do Blender:  blender -b arquivo.blend --python fiveseven-parts.py -- <saida.json>
# Saída no espaço da arma: centímetros, cano em +Z, para cima +Y, lado esquerdo +X, origem no punho.
import bpy, sys, json
from mathutils import Vector

out_path = sys.argv[sys.argv.index("--") + 1]
LENGTH_CM = 20.8  # comprimento real do Five-seveN (208 mm)

PART_OF = {"Cube": "slide", "Cube.074": "slide", "Cylinder": "slide", "Cylinder.001": "slide",
           "Plane": "trigger", "Cube.073": "magrelease"}

def srgb_hex(material):
    color = material.diffuse_color[:3]
    if material.use_nodes:
        for n in material.node_tree.nodes:
            if n.type == 'BSDF_PRINCIPLED':
                color = n.inputs['Base Color'].default_value[:3]
    return '#%02x%02x%02x' % tuple(int(max(0, min(1, c)) ** (1 / 2.2) * 255) for c in color)

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
xs = [(o.matrix_world @ Vector(c)).x for o in meshes for c in o.bound_box]
scale = LENGTH_CM / (max(xs) - min(xs))
# Blender: cano em +X, para cima +Z, esquerda +Y  ->  arma: (x, y, z) = (y, z, x)
def to_gun(v): return Vector((v.y, v.z, v.x)) * scale

# Punho: vértices do corpo abaixo do guarda-mato.
frame = bpy.data.objects["Cube.001"]
grip = [frame.matrix_world @ v.co for v in frame.data.vertices if (frame.matrix_world @ v.co).z < 0.3]
grip_center = sum((to_gun(v) for v in grip), Vector()) / len(grip)

parts = {}
def add(part, color, tris):
    parts.setdefault(f"{part}|{color}", []).extend(tris)

depsgraph = bpy.context.evaluated_depsgraph_get()
for o in meshes:
    part = PART_OF.get(o.name, "body")
    mesh = o.evaluated_get(depsgraph).to_mesh()
    mesh.calc_loop_triangles()
    for tri in mesh.loop_triangles:
        mat = o.material_slots[tri.material_index].material if o.material_slots else None
        color = srgb_hex(mat) if mat else '#555555'
        pts = [to_gun(o.matrix_world @ mesh.vertices[i].co) - grip_center for i in tri.vertices]
        add(part, color, [round(c, 3) for p in pts for c in p])
    o.evaluated_get(depsgraph).to_mesh_clear()

# O modelo não tem carregador separado: cria um dentro do punho, seguindo a inclinação dele,
# com a base rente ao fundo do punho (é a parte que aparece).
# Só o que fica atrás do gatilho (x < -1,3 no Blender); o eixo sai do centro de duas fatias horizontais.
gz = [to_gun(v) - grip_center for v in grip if v.x < -1.3]
low = min(p.y for p in gz)
def slice_center(y0, y1):
    s = [p for p in gz if y0 <= p.y <= y1]
    return Vector((0, (y0 + y1) / 2, (min(p.z for p in s) + max(p.z for p in s)) / 2)), max(p.z for p in s) - min(p.z for p in s)
b, bottom_depth = slice_center(low, low + 1.0)
t, _ = slice_center(low + 5.0, low + 6.0)
axis = (t - b).normalized()

depth = 0.55 * bottom_depth
side = Vector((1, 0, 0))
fwd = axis.cross(side).normalized()
if fwd.z < 0: fwd = -fwd
def box(center_bottom, length, half_w, half_d, color):
    c = [center_bottom + axis * h + side * sx * half_w + fwd * sz * half_d
         for h in (0, length) for sx in (-1, 1) for sz in (-1, 1)]
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    tris = []
    for a, b_, c_, d in quads:
        for tri in ((a, b_, c_), (a, c_, d)):
            tris += [round(x, 3) for i in tri for x in c[i]]
    add("mag", color, tris)
mag_bottom = Vector((0, low - 0.05, b.z - (b.y - low) * axis.z / axis.y))
mag_length = 9.0
box(mag_bottom + axis * 0.35, mag_length - 0.35, 0.55, depth / 2, '#2b2b2c')   # corpo do carregador
box(mag_bottom, 0.4, 0.62, depth / 2 + 0.25, '#1f1f20')                      # base

info = {
    "scale": scale,
    "magTop": list(mag_bottom + axis * mag_length),
    "magBottom": list(mag_bottom),
    "magAxis": list(axis),
}
slide = [to_gun(bpy.data.objects["Cube"].matrix_world @ Vector(c)) - grip_center for c in bpy.data.objects["Cube"].bound_box]
info["slideMin"] = [min(p[i] for p in slide) for i in range(3)]
info["slideMax"] = [max(p[i] for p in slide) for i in range(3)]
json.dump({"parts": parts, "info": info}, open(out_path, "w"))
print("PARTS", {k: len(v) // 9 for k, v in parts.items()})
print("INFO", json.dumps(info))
