class_name PickupItem
extends Interactable

## Objeto coletável. Itens, dinheiro e segredos são registrados em PlayerState
## para que não reapareçam depois de um respawn.

@export var pickup_id: String = ""
@export var item_id: String = ""
@export var money_reward: int = 0
@export var is_secret: bool = false

var _used: bool = false


func _ready() -> void:
	super._ready()
	if pickup_id.is_empty():
		push_error("PickupItem '%s' sem pickup_id: a coleta não será lembrada." % name)
	elif PlayerState.is_collected(pickup_id):
		_used = true
		queue_free()


func can_interact(_actor: Node3D) -> bool:
	return not _used


func interact(_actor: Node3D) -> void:
	if not can_interact(_actor):
		return
	if not item_id.is_empty() and not PlayerState.add_item(item_id):
		PlayerState.post_notice("Não foi possível pegar %s: inventário cheio." % ItemCatalog.get_display_name(item_id))
		return
	PlayerState.add_money(money_reward)
	if not pickup_id.is_empty():
		PlayerState.mark_collected(pickup_id)
	_used = true
	PlayerState.post_notice(_describe_reward())
	queue_free()


func _describe_reward() -> String:
	var parts: PackedStringArray = []
	if is_secret:
		parts.append("Segredo encontrado!")
	if not item_id.is_empty():
		parts.append("Você pegou: %s." % ItemCatalog.get_display_name(item_id))
	if money_reward > 0:
		parts.append("+R$ %d" % money_reward)
	return " ".join(parts)
