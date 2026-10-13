class_name TestDistrictLayout
extends RefCounted

## Dados puros do distrito de teste: nenhuma referência a nós ou materiais.
## Unidades em metros; y = 0 é a superfície do asfalto.
## Blocos com collide = false são apenas visuais (faixas, calçadas) e não geram colisão.

static func get_blocks() -> Array:
	var blocks: Array = []
	blocks.append(_block("Asfalto", Vector3(0, -0.5, 0), Vector3(120, 1, 120), "asfalto", true))

	for sx in [-1.0, 1.0]:
		blocks.append(_surface("Faixa_EO_%d" % int(sx), Vector3(sx * 22.5, 0.02, 0.0), Vector3(35, 0.02, 0.15), "faixa"))
		blocks.append(_surface("Faixa_NS_%d" % int(sx), Vector3(0.0, 0.02, sx * 22.5), Vector3(0.15, 0.02, 35), "faixa"))
		for sz in [-1.0, 1.0]:
			var suffix := "%d_%d" % [int(sx), int(sz)]
			blocks.append(_surface("Calcada_EO_" + suffix, Vector3(sx * 23.5, 0.01, sz * 6.0), Vector3(33, 0.02, 2), "calcada"))
			blocks.append(_surface("Calcada_NS_" + suffix, Vector3(sx * 6.0, 0.01, sz * 23.5), Vector3(2, 0.02, 33), "calcada"))

	# [nome, centro (x, z), tamanho, material]; a altura do centro é calculada a partir de size.y
	var buildings := [
		["Predio_Nordeste_Alto", Vector2(14, -16), Vector3(12, 14, 14), "predio_bege"],
		["Predio_Nordeste_Largo", Vector2(30, -20), Vector3(16, 20, 12), "predio_cinza"],
		["Predio_Sudeste", Vector2(14, 17), Vector3(12, 10, 14), "predio_tijolo"],
		["Predio_Sudeste_Largo", Vector2(30, 24), Vector3(16, 12, 14), "predio_verde"],
		["Predio_Noroeste", Vector2(-18, -15), Vector3(14, 12, 14), "predio_bege"],
		["Predio_Sudoeste", Vector2(-28, 20), Vector3(20, 16, 14), "predio_cinza"],
		["Quiosque", Vector2(-14, 14), Vector3(6, 4, 6), "quiosque"],
	]
	for entry in buildings:
		var size: Vector3 = entry[2]
		var xz: Vector2 = entry[1]
		blocks.append(_block(entry[0], Vector3(xz.x, size.y * 0.5, xz.y), size, entry[3], true))

	# Beco cercado a noroeste. O portão (Door) fica na abertura entre z = -36 e z = -34.
	blocks.append(_block("Cerca_Oeste_Sul", Vector3(-30, 1.1, -38), Vector3(0.4, 2.2, 4), "cerca", true))
	blocks.append(_block("Cerca_Oeste_Norte", Vector3(-30, 1.1, -32), Vector3(0.4, 2.2, 4), "cerca", true))
	blocks.append(_block("Cerca_Norte", Vector3(-35, 1.1, -40), Vector3(10, 2.2, 0.4), "cerca", true))
	blocks.append(_block("Cerca_Sul", Vector3(-35, 1.1, -30), Vector3(10, 2.2, 0.4), "cerca", true))
	blocks.append(_block("Cerca_Extremo", Vector3(-40, 1.1, -35), Vector3(0.4, 2.2, 10), "cerca", true))

	# Obstáculos: caixas empilhadas (testam pulo) e uma barreira de concreto parcial.
	blocks.append(_block("Caixa_Base", Vector3(-2, 0.4, -12), Vector3(1.2, 0.8, 1.2), "caixa", true))
	blocks.append(_block("Caixa_Topo", Vector3(-2, 1.2, -12), Vector3(1.2, 0.8, 1.2), "caixa", true))
	blocks.append(_block("Barreira_Concreto", Vector3(3.5, 0.4, 16), Vector3(2.5, 0.8, 0.6), "concreto", true))

	# Postes de iluminação nas calçadas.
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			blocks.append(_block("Poste_%d_%d" % [int(sx), int(sz)], Vector3(sx * 6.0, 2.0, sz * 20.0), Vector3(0.3, 4, 0.3), "poste", true))

	return blocks


static func _block(block_name: String, center: Vector3, size: Vector3, material: String, collide: bool) -> Dictionary:
	return {"name": block_name, "center": center, "size": size, "material": material, "collide": collide}


static func _surface(block_name: String, center: Vector3, size: Vector3, material: String) -> Dictionary:
	return _block(block_name, center, size, material, false)
