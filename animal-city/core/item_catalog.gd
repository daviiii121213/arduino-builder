class_name ItemCatalog
extends RefCounted

## Definições de itens. A interface lê apenas nomes de exibição daqui.

const ITEMS := {
	"chave_predio": {"nome": "Chave do prédio", "max_stack": 1},
	"osso": {"nome": "Osso", "max_stack": 10},
}


static func has_item(item_id: String) -> bool:
	return ITEMS.has(item_id)


static func get_display_name(item_id: String) -> String:
	if not has_item(item_id):
		return "Item desconhecido"
	return ITEMS[item_id]["nome"]


static func get_max_stack(item_id: String) -> int:
	if not has_item(item_id):
		return 0
	return ITEMS[item_id]["max_stack"]
