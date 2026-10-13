class_name Door
extends Interactable

## Porta ou portão articulado. Pode exigir um item do inventário para destravar.
## O eixo de rotação é a origem do nó (dobradiça); o painel fica dentro de Pivot.

@export var required_item_id: String = ""
@export var open_angle_degrees: float = -90.0
@export var move_duration: float = 0.5

var is_open: bool = false
var _tween: Tween = null

@onready var _pivot: Node3D = $Pivot


func get_prompt(_actor: Node3D) -> String:
	if is_open:
		return "Fechar porta"
	if _is_locked():
		return "Porta trancada"
	return prompt_text


## Centro do painel, não a dobradiça: a dobradiça encosta em paredes e bloquearia a visão.
func get_interaction_point() -> Vector3:
	return _pivot.to_global(Vector3(0.0, 1.1, 1.0))


func interact(_actor: Node3D) -> void:
	if _is_locked():
		PlayerState.post_notice("A porta está trancada. Procure: %s." % ItemCatalog.get_display_name(required_item_id))
		return
	_set_open(not is_open)


func _is_locked() -> bool:
	return not required_item_id.is_empty() and not PlayerState.has_item(required_item_id)


func _set_open(open: bool) -> void:
	is_open = open
	if _tween != null and _tween.is_valid():
		_tween.kill()
	var target_rotation := deg_to_rad(open_angle_degrees) if open else 0.0
	_tween = create_tween()
	_tween.tween_property(_pivot, "rotation:y", target_rotation, move_duration)
