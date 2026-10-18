# Monta models/decor.glb: decorações de estande de tiro (modelos CC0 da Poly Haven e da Quaternius)
# já posicionadas no cenário, nas prateleiras e no chão.
#
# uso: blender -b -P tools/decor-build.py -- <pasta com os .glb originais> models/decor.glb
#
# Coordenadas do jogo em cm (Y para cima). O Blender usa Z para cima: jogo (x, y, z) = Blender (x, -z, y);
# o exportador de glTF desfaz essa troca, então o .glb sai direto nas coordenadas do jogo.
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

src, out = sys.argv[sys.argv.index('--') + 1:][:2]

# Modelos: arquivo -> escala para cm OU comprimento final em cm; tilt deita o objeto (graus no eixo X);
# only fica só com as peças cujo nome termina assim.
# A Poly Haven já vem em metros (escala 100); a estante de aço veio 10x maior; as armas da Quaternius
# não têm escala real, então recebem o comprimento.
MODELS = {
    'ammo_box':               dict(scale=100),
    'binoculars':             dict(scale=100),
    'bolt_action_rifle_7_62': dict(scale=100, tilt=90),
    'service_pistol':         dict(scale=100, tilt=90),
    'medical_box':            dict(scale=100),
    'signal_flashlight':      dict(scale=100),
    'stick_grenade':          dict(scale=100, tilt=90),
    'metal_toolbox':          dict(scale=100),
    'metal_tool_chest':       dict(scale=100),
    'metal_jerrycan_green':   dict(scale=100),
    'korean_fire_extinguisher_01': dict(scale=100),
    'wooden_military_crate':  dict(scale=100),
    'old_military_crate':     dict(scale=100, only='_a'),  # o arquivo tem duas caixas; usa só a primeira
    'steel_frame_shelves_01': dict(scale=10),
    'worn_metal_rack':        dict(scale=100),
    'assault_rifle_1':        dict(length=88, tilt=90),
    'pistol_1':               dict(length=21, tilt=90),
    'shotgun_1':              dict(length=100, tilt=90),
}
MAX_TRIS = 6000
TEXTURE_SIZE = 512

# Balcão da parede do fundo: tampo em y = 93, de z = -828 (parede) a -791.
SHELF_Y, SHELF_Z = 93, -809
# Estante de aço na parede da direita (x = -837), girada para acompanhar a parede; tábuas em 13, 64, 115 e 165 cm.
STEEL_X, STEEL_Z = -810, -690
# Prateleira de metal na parede da esquerda (x = 837); tábuas em 43, 92 e 141 cm.
RACK_X, RACK_Z = 805, -680

# (modelo, x, y, z, giro em graus no eixo vertical)
PLACEMENTS = [
    # Em cima do balcão do fundo
    ('ammo_box', -800, SHELF_Y, SHELF_Z, 0),
    ('ammo_box', -785, SHELF_Y, SHELF_Z, 4),
    ('ammo_box', -793, SHELF_Y + 17.7, SHELF_Z, -3),
    ('binoculars', -705, SHELF_Y, SHELF_Z, 25),
    ('service_pistol', -610, SHELF_Y, SHELF_Z, 0),
    ('medical_box', -480, SHELF_Y, SHELF_Z + 2, 0),
    ('signal_flashlight', -400, SHELF_Y, SHELF_Z - 5, 30),
    ('stick_grenade', -340, SHELF_Y, SHELF_Z - 6, 80),
    ('stick_grenade', -335, SHELF_Y, SHELF_Z + 6, 95),
    ('bolt_action_rifle_7_62', -190, SHELF_Y, SHELF_Z, 0),
    ('metal_toolbox', -20, SHELF_Y, SHELF_Z, 0),
    ('pistol_1', 80, SHELF_Y, SHELF_Z, 15),
    ('ammo_box', 160, SHELF_Y, SHELF_Z, 90),
    ('ammo_box', 160, SHELF_Y + 17.7, SHELF_Z, 85),
    ('shotgun_1', 320, SHELF_Y, SHELF_Z, 0),
    ('binoculars', 455, SHELF_Y, SHELF_Z, -20),
    ('ammo_box', 505, SHELF_Y, SHELF_Z, 0),

    # No chão, embaixo do balcão (até 87 cm de altura)
    ('wooden_military_crate', -760, 0, -800, 0),
    ('old_military_crate', -760, 46.5, -805, 0),
    ('old_military_crate', -420, 0, -805, 0),
    ('metal_tool_chest', 200, 0, -800, 0),
    ('metal_jerrycan_green', 365, 0, -805, 0),
    ('metal_jerrycan_green', 410, 0, -805, 8),
    ('korean_fire_extinguisher_01', 515, 0, -808, 0),

    # Estante de aço e o que fica nela
    ('steel_frame_shelves_01', STEEL_X, 0, STEEL_Z, 90),
    ('ammo_box', STEEL_X, 13.3, STEEL_Z - 35, 0),
    ('ammo_box', STEEL_X, 13.3, STEEL_Z - 20, 0),
    ('ammo_box', STEEL_X, 13.3, STEEL_Z - 5, 0),
    ('metal_toolbox', STEEL_X, 13.3, STEEL_Z + 30, 90),
    ('medical_box', STEEL_X, 63.9, STEEL_Z - 20, 90),
    ('ammo_box', STEEL_X, 63.9, STEEL_Z + 25, 90),
    ('ammo_box', STEEL_X, 63.9, STEEL_Z + 40, 90),
    ('assault_rifle_1', STEEL_X, 114.5, STEEL_Z, 90),
    ('signal_flashlight', STEEL_X + 5, 165.1, STEEL_Z - 35, 0),
    ('binoculars', STEEL_X, 165.1, STEEL_Z + 5, 70),

    # Prateleira de metal na parede da esquerda
    ('worn_metal_rack', RACK_X, 0, RACK_Z, -90),
    ('medical_box', RACK_X, 43, RACK_Z, 90),
    ('service_pistol', RACK_X, 92, RACK_Z - 10, -90),
    ('stick_grenade', RACK_X, 92, RACK_Z + 32, 0),
    ('ammo_box', RACK_X, 141, RACK_Z - 25, 90),
    ('ammo_box', RACK_X, 141, RACK_Z + 5, 90),
    ('signal_flashlight', RACK_X, 141, RACK_Z + 32, 0),
]

# Uma caixa de munição em cima do balcão de cada baia, do lado oposto ao controle.
for lane in range(10):
    x = 747 - lane * 166 - 60
    PLACEMENTS.append(('ammo_box', x, 110, -378, 0))


def prototype(name, cfg):
    """Importa o modelo, junta tudo numa malha só, ajusta escala e deixa a base no chão, centrada na origem."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, name + '.glb'))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    if 'only' in cfg:
        for o in [o for o in meshes if not o.name.endswith(cfg['only'])]:
            meshes.remove(o)
            bpy.data.objects.remove(o)
    # Aplica as transformações e junta.
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
    for o in [o for o in bpy.data.objects if o not in before and o.type != 'MESH']:
        bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes: o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1: bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    mesh = obj.data

    if cfg.get('tilt'): mesh.transform(Matrix.Rotation(math.radians(cfg['tilt']), 4, 'X'))
    lo = Vector([min(v.co[i] for v in mesh.vertices) for i in range(3)])
    hi = Vector([max(v.co[i] for v in mesh.vertices) for i in range(3)])
    s = cfg['length'] / max(hi - lo) if 'length' in cfg else cfg['scale']
    mesh.transform(Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
    mesh.transform(Matrix.Scale(s, 4))

    tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
    if tris > MAX_TRIS:
        mod = obj.modifiers.new('decimate', 'DECIMATE')
        mod.ratio = MAX_TRIS / tris
        bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.name = mesh.name = name
    size = [max(v.co[i] for v in mesh.vertices) - min(v.co[i] for v in mesh.vertices) for i in range(3)]
    print(f'DECOR {name}: {tris} -> {sum(len(p.vertices) - 2 for p in mesh.polygons)} triângulos, '
          f'{[round(v, 1) for v in size]} cm')
    return obj


def simplify_materials():
    """O jogo só usa a cor base: tira normal/rugosidade e reduz as texturas para 512 px."""
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        bsdf = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf is None: continue
        for socket in bsdf.inputs:
            if socket.name != 'Base Color':
                for link in list(socket.links): links.remove(link)
        for n in list(nodes):
            if n.type == 'TEX_IMAGE' and not any(l.to_node == bsdf and l.to_socket.name == 'Base Color'
                                                 for l in n.outputs[0].links):
                nodes.remove(n)
        bsdf.inputs['Metallic'].default_value = 0
    for img in bpy.data.images:
        if img.users and max(img.size) > TEXTURE_SIZE:
            w, h = img.size
            f = TEXTURE_SIZE / max(w, h)
            img.scale(max(1, int(w * f)), max(1, int(h * f)))


bpy.ops.wm.read_factory_settings(use_empty=True)
protos = {name: prototype(name, cfg) for name, cfg in MODELS.items()}
simplify_materials()

placed = []
for i, (name, x, y, z, yaw) in enumerate(PLACEMENTS):
    proto = protos[name]
    o = bpy.data.objects.new(f'Decor_{name}_{i}', proto.data)  # malha compartilhada
    bpy.context.scene.collection.objects.link(o)
    o.location = (x, -z, y)
    o.rotation_euler = (0, 0, math.radians(yaw))
    placed.append(o)
for p in protos.values(): bpy.data.objects.remove(p)

bpy.ops.object.select_all(action='DESELECT')
for o in placed: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                          export_image_format='JPEG', export_jpeg_quality=85, export_apply=True,
                          export_texcoords=True, export_normals=True, export_materials='EXPORT')
print('DECOR exportado', out, os.path.getsize(out) // 1024, 'KB')
