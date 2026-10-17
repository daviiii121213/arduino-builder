# Monta o akm.glb a partir das peças exportadas por akm-parts.mjs, com as cores de um AKM real.
# Uso: python3 akm-glb.py <pecas.json> <akm.glb>
import json, sys
import numpy as np
import trimesh

# Cor sRGB de cada material do modelo original (identificados pintando cada um de uma cor).
COLORS = {
    "Material.005": ("steel", "#1d1e20"),    # tampa, massa de mira, bloco de gás
    "Material.010": ("rivets", "#3a3b3d"),
    "Material.006": ("barrel", "#26272a"),
    "Material": ("receiver", "#212226"),
    "Material.012": ("carrier", "#86888b"),  # porta-ferrolho em aço nu
    "Material.001": ("trigger", "#36373a"),  # gatilho e vareta
    "Material.004": ("magazine", "#3a3b3e"),
    "Material.003": ("brass", "#b58b3c"),    # estojos
    "Material.002": ("copper", "#a0603a"),   # projéteis
    "Material.009": ("magribs", "#2b2c2f"),
    "Material.007": ("bakelite", "#4b2418"), # punho
    "Material.008": ("wood", "#7a3a1c"),     # coronha e guarda-mão de madeira laminada
}

parts = json.load(open(sys.argv[1]))
scene = trimesh.Scene()
for key, flat in parts.items():
    part, material = key.split("|")
    label, hex_color = COLORS[material]
    vertices = np.array(flat, dtype=np.float64).reshape(-1, 3)
    faces = np.arange(len(vertices)).reshape(-1, 3)
    mesh = trimesh.Trimesh(vertices, faces, process=False)
    # O glTF guarda a cor base em espaço linear.
    linear = [(int(hex_color[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5)]
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name=label, baseColorFactor=linear + [1.0], metallicFactor=0.0, roughnessFactor=0.8))
    # O nome do nó diz a peça animada (body, mag, bolt, magrelease, selector).
    scene.add_geometry(mesh, node_name=f"{part}_{label}", geom_name=f"{part}_{label}")
scene.export(sys.argv[2])
print("ok", len(parts), "partes")
