class_name InteractionComponent
extends Node

## Escolhe o Interactable mais próximo dentro do alcance, na frente do personagem e com linha de visão livre.

signal target_changed(target: Interactable)

@export var max_distance: float = 2.2
## Produto escalar mínimo entre a direção de olhar e o objeto (0.4 ≈ cone de ±66°).
@export var min_facing_dot: float = 0.4

var current_target: Interactable = null

@onready var _actor: PlayerController = get_parent() as PlayerController


func _physics_process(_delta: float) -> void:
	if current_target != null and not is_instance_valid(current_target):
		current_target = null
	var next := _find_target()
	if next != current_target:
		current_target = next
		target_changed.emit(next)


func try_interact() -> bool:
	if not is_instance_valid(current_target) or not current_target.can_interact(_actor):
		return false
	current_target.interact(_actor)
	current_target = null
	return true


func _find_target() -> Interactable:
	if _actor == null or _actor.health.is_dead:
		return null
	var origin := _actor.global_position
	var facing := _actor.get_facing_direction()
	var best: Interactable = null
	var best_distance := max_distance
	for node in get_tree().get_nodes_in_group(Interactable.GROUP):
		var candidate := node as Interactable
		if candidate == null or not candidate.can_interact(_actor):
			continue
		var offset := candidate.global_position - origin
		offset.y = 0.0
		var distance := offset.length()
		if distance > best_distance:
			continue
		if distance > 0.001 and facing.dot(offset / distance) < min_facing_dot:
			continue
		if not _has_line_of_sight(candidate):
			continue
		best = candidate
		best_distance = distance
	return best


func _has_line_of_sight(candidate: Interactable) -> bool:
	var query := PhysicsRayQueryParameters3D.create(
		_actor.global_position + Vector3.UP * 0.8,
		candidate.get_interaction_point()
	)
	query.exclude = [_actor.get_rid()]
	var hit := _actor.get_world_3d().direct_space_state.intersect_ray(query)
	return hit.is_empty() or hit.collider == candidate
