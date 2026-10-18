# Prepara as armas da bancada para a primeira pessoa: Walther P38 e fuzil Mosin-Nagant M91/30 PU (Poly Haven),
# Colt M1911A1 e espingarda de bombeamento (Quaternius). Cada uma vira um .glb em peças para animar
# (body, slide, mag, trigger, bolt, pump), no espaço da arma do jogo: cm, cano em +Z, para cima +Y,
# lado esquerdo +X, origem no punho.
#
# uso: blender -b -P tools/bench-guns.py -- <pasta com os .glb originais> <pasta de saída (models/)>
#
# Alinhamento (para reaproveitar as poses dos braços feitas por IK):
# - pistolas: o topo de trás do punho (onde fica a pele entre polegar e indicador) vai para o mesmo
#   ponto da Five-seveN, (z -4,7; y 6,3);
# - armas longas: o centro do delgado da coronha (onde a mão direita segura) vai para a origem,
#   que é onde fica o punho do AK.
import bpy, bmesh, math, os, sys
from mathutils import Matrix, Vector

src, out_dir = sys.argv[sys.argv.index('--') + 1:][:2]
TEXTURE_SIZE = 512

# scale: 'real' (Poly Haven, já em metros) ou comprimento real em cm (Quaternius, sem escala).
# anchor: ponto do modelo (z, y no espaço da arma, antes do alinhamento) que vai para target.
GUNS = {
    'p38': dict(src='service_pistol', scale='real', anchor=(-3.8, 4.5), target=(-4.7, 6.3),
                parts={'service_pistol_pistol_a': 'body', 'service_pistol_hammer_a': 'body',
                       'service_pistol_trigger_a': 'trigger', 'service_pistol_slide_a': 'slide',
                       'service_pistol_magazine_loaded': 'mag'}),
    'm1911': dict(src='pistol_1', scale=21.6, anchor=(-3.6, 4.3), target=(-4.7, 6.3)),
    'mosin': dict(src='bolt_action_rifle_7_62', scale='real', anchor=(-34.0, -1.5), target=(0, 0),
                  parts={'bolt_action_rifle_7_62': 'body', 'bolt_action_rifle_7_62_scope': 'body',
                         'bolt_action_rifle_7_62_wrap': 'body', 'bolt_action_rifle_7_62_trigger': 'trigger',
                         'bolt_action_rifle_7_62_bolt_a': 'bolt', 'bolt_action_rifle_7_62_bolt_b': 'bolt'}),
    'shotgun': dict(src='shotgun_1', scale=100.0, anchor=(2.0, -1.5), target=(0, 0)),
}


def classify_m1911(c, mat):
    """Peça de cada triângulo do M1911 (malha única): ferrolho em cima, gatilho, base do carregador."""
    if mat in ('Black', 'Black2') and c.y > 5.0: return 'slide'
    if mat == 'Metal' and c.z > 10: return 'slide'          # massa de mira
    if mat == 'Black' and c.y < -4.0: return 'mag'          # base do carregador
    if mat == 'Black' and 0 < c.y < 5 and 3 < c.z < 5: return 'trigger'
    return 'body'


def classify_shotgun(c, mat):
    """A telha (guarda-mão que corre) fica embaixo do cano; o gatilho atrás do guarda-mato."""
    if mat == 'Black' and 30 < c.z < 56 and c.y < 3: return 'pump'
    if mat == 'Black' and 6 < c.z < 10 and c.y < 0: return 'trigger'
    return 'body'


def to_gun(v, s):
    """Blender (cano em +X, cima +Z, esquerda +Y) -> arma (x, y, z) = (esquerda, cima, cano), em cm."""
    return Vector((v.y, v.z, v.x)) * s


def to_blender(g):
    """Arma -> Blender de forma que o exportador (Y para cima) grave exatamente as coordenadas da arma."""
    return Vector((g.x, -g.z, g.y))


def simplify_materials():
    """O jogo só usa a cor base: tira normal/rugosidade e reduz as texturas."""
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


def add_box(name, corners_fn, color):
    """Caixa simples (carregador gerado), já no espaço da arma."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(to_blender(p)) for p in corners_fn()]
    for q in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[i] for i in q])
    bm.normal_update(); bm.to_mesh(mesh); bm.free()
    mat = bpy.data.materials.new(name + '_mat')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*color, 1)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build(key, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, cfg['src'] + '.glb'))
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o)
    for o in meshes:
        o.data = o.data.copy()
        o.data.transform(o.matrix_world)
        o.parent = None
        o.matrix_world = Matrix.Identity(4)

    xs = [v.co.x for o in meshes for v in o.data.vertices]
    s = 100.0 if cfg['scale'] == 'real' else cfg['scale'] / (max(xs) - min(xs))
    shift = Vector((0, cfg['target'][1] - cfg['anchor'][1], cfg['target'][0] - cfg['anchor'][0]))

    def gun_of(v):
        return to_gun(v, s) + shift

    for o in meshes:
        for v in o.data.vertices:
            v.co = to_blender(gun_of(v.co))

    # Peças por objeto (Poly Haven) ou por triângulo (Quaternius, malha única).
    objects = []
    if 'parts' in cfg:
        for o in meshes:
            part = cfg['parts'].get(o.name)
            if part is None:
                bpy.data.objects.remove(o)
                continue
            o.name = part
            objects.append(o)
    else:
        classify = classify_m1911 if key == 'm1911' else classify_shotgun
        o = meshes[0]
        groups = {}
        for poly in o.data.polygons:
            c = sum((o.data.vertices[i].co for i in poly.vertices), Vector()) / len(poly.vertices)
            g = Vector((c.x, c.z, -c.y)) - shift                 # de volta ao espaço antes do alinhamento
            groups.setdefault(classify(g, o.data.materials[poly.material_index].name), []).append(poly.index)
        # Uma cópia da malha por peça, apagando os triângulos das outras.
        for part, faces in groups.items():
            keep = set(faces)
            copy = o.copy(); copy.data = o.data.copy(); copy.name = part
            bpy.context.scene.collection.objects.link(copy)
            bm = bmesh.new(); bm.from_mesh(copy.data); bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index not in keep], context='FACES')
            bm.to_mesh(copy.data); bm.free()
            objects.append(copy)
        bpy.data.objects.remove(o)

    info = {}
    if key == 'p38':
        # O carregador vem ao lado da arma: entra no punho (a base fica rente ao fundo dele).
        mag = next(o for o in objects if o.name.startswith('mag'))
        body = next(o for o in objects if o.name.startswith('body'))
        def bottom(o):
            vs = [Vector((v.co.x, v.co.z, -v.co.y)) for v in o.data.vertices]
            low = min(v.y for v in vs)
            near = [v for v in vs if v.y < low + 0.6]
            return low, sum((v.z for v in near)) / len(near)
        mag_low, mag_z = bottom(mag)
        grip_low, grip_z = bottom(body)
        d = Vector((0, grip_low - mag_low + 0.15, grip_z - mag_z))
        for v in mag.data.vertices: v.co += to_blender(d)
    if key == 'm1911':
        # A Quaternius não tem carregador: um dentro do punho, inclinado como ele, acima da base.
        base = [Vector((v.co.x, v.co.z, -v.co.y)) for o in objects if o.name.startswith('mag') for v in o.data.vertices]
        b = sum(base, Vector()) / len(base)
        axis = Vector((0, 1, 0.12)).normalized()                  # inclinação do punho do 1911 (~7 graus)
        side, fwd = Vector((1, 0, 0)), axis.cross(Vector((1, 0, 0))).normalized()
        if fwd.z < 0: fwd = -fwd
        def corners():
            c0 = b + axis * 0.3
            return [c0 + axis * h + side * sx * 1.1 + fwd * sz * 1.6 for h in (0, 11) for sx in (-1, 1) for sz in (-1, 1)]
        objects.append(add_box('mag_body', corners, (0.06, 0.06, 0.065)))

    simplify_materials()
    for i, o in enumerate(objects):
        part = o.name.split('.')[0].split('_')[0]
        o.name = f'{part}_{i}'
        if o.data: o.data.name = o.name
    vs = [Vector((v.co.x, v.co.z, -v.co.y)) for o in objects for v in o.data.vertices]
    lo = [round(min(v[i] for v in vs), 1) for i in range(3)]
    hi = [round(max(v[i] for v in vs), 1) for i in range(3)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    out = os.path.join(out_dir, key + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_image_format='JPEG', export_jpeg_quality=88, export_apply=True,
                              export_materials='EXPORT')
    print('GUN', key, sorted({o.name.split('_')[0] for o in objects}), 'min', lo, 'max', hi,
          os.path.getsize(out) // 1024, 'KB')


for key, cfg in GUNS.items():
    build(key, cfg)
