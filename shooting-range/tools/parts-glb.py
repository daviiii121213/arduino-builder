# Monta um .glb a partir de peças {"peça|#cor": [triângulos...]}; o nome do nó é a peça (para animar).
# Uso: python3 parts-glb.py <pecas.json> <saida.glb>
import json, sys
import numpy as np
import trimesh

data = json.load(open(sys.argv[1]))
parts = data.get("parts", data)
scene = trimesh.Scene()
for i, (key, flat) in enumerate(parts.items()):
    part, hex_color = key.split("|")
    vertices = np.array(flat, dtype=np.float64).reshape(-1, 3)
    mesh = trimesh.Trimesh(vertices, np.arange(len(vertices)).reshape(-1, 3), process=False)
    linear = [(int(hex_color[j:j + 2], 16) / 255) ** 2.2 for j in (1, 3, 5)]  # glTF usa cor linear
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(
        name=f"c{hex_color[1:]}", baseColorFactor=linear + [1.0], metallicFactor=0.0, roughnessFactor=0.8))
    scene.add_geometry(mesh, node_name=f"{part}_{i}", geom_name=f"{part}_{i}")
scene.export(sys.argv[2])
print("ok", len(parts), "partes")
