extends Node

## Estado do jogador que sobrevive a respawns: dinheiro, inventário e coletáveis já pegos.
## Vida e posição pertencem ao personagem, não a este serviço.

signal changed
signal notice_posted(text: String)

const MAX_SLOTS := 8

var money: int = 0
var inventory: Dictionary = {}
var collected_ids: Dictionary = {}


func reset() -> void:
	money = 0
	inventory.clear()
	collected_ids.clear()
	changed.emit()


func add_money(amount: int) -> void:
	if amount <= 0:
		return
	money += amount
	changed.emit()


func can_add_item(item_id: String, quantity: int = 1) -> bool:
	if quantity <= 0 or not ItemCatalog.has_item(item_id):
		return false
	if not inventory.has(item_id) and inventory.size() >= MAX_SLOTS:
		return false
	return inventory.get(item_id, 0) + quantity <= ItemCatalog.get_max_stack(item_id)


func add_item(item_id: String, quantity: int = 1) -> bool:
	if not can_add_item(item_id, quantity):
		return false
	inventory[item_id] = inventory.get(item_id, 0) + quantity
	changed.emit()
	return true


func has_item(item_id: String, quantity: int = 1) -> bool:
	return inventory.get(item_id, 0) >= quantity


func is_collected(pickup_id: String) -> bool:
	return collected_ids.has(pickup_id)


func mark_collected(pickup_id: String) -> void:
	collected_ids[pickup_id] = true


func post_notice(text: String) -> void:
	notice_posted.emit(text)
