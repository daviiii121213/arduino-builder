class_name TestDistrictBuilder
extends RefCounted

## Converte o layout de TestDistrictLayout em malhas e colisões.
## Materiais são compartilhados por chave para evitar um StandardMaterial3D por bloco.

const COLORS := {
	"asfalto": Color(0.17, 0.17, 0.19),
	"calcada": Color(0.56, 0.55, 0.52),
	"faixa": Color(0.92, 0.88, 0.45),
	"predio_bege": Color(0.72, 0.66, 0.55),
	"predio_cinza": Color(0.45, 0.47, 0.5),
	"predio_tijolo": Color(0.52, 0.28, 0.2),
	"predio_verde": Color(0.35, 0.45, 0.38),
	"quiosque": Color(0.7, 0.2, 0.18),
	"concreto": Color(0.62, 0.62, 0.6),
	"caixa": Color(0.5, 0.35, 0.2),
	"poste": Color(0.2, 0.22, 0.25),
	"cerca": Color(0.3, 0.32, 0.35),
}


static func build(parent: Node3D) -> void:
	var materials: Dictionary = {}
	for block in TestDistrictLayout.get_blocks():
		parent.add_child(_create_block(block, materials))


static func _create_block(block: Dictionary, materials: Dictionary) -> Node3D:
	var size: Vector3 = block["size"]
	var mesh := BoxMesh.new()
	mesh.size = size
	var mesh_instance := MeshInstance3D.new()
	mesh_instance.mesh = mesh
	mesh_instance.material_override = _get_material(block["material"], materials)

	if not block["collide"]:
		mesh_instance.name = block["name"]
		mesh_instance.position = block["center"]
		mesh_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		return mesh_instance

	var shape := BoxShape3D.new()
	shape.size = size
	var collision := CollisionShape3D.new()
	collision.shape = shape
	var body := StaticBody3D.new()
	body.name = block["name"]
	body.position = block["center"]
	body.add_child(mesh_instance)
	body.add_child(collision)
	return body


static func _get_material(key: String, materials: Dictionary) -> StandardMaterial3D:
	if not materials.has(key):
		var material := StandardMaterial3D.new()
		material.albedo_color = COLORS.get(key, Color.MAGENTA)
		material.roughness = 0.85
		materials[key] = material
	return materials[key]
