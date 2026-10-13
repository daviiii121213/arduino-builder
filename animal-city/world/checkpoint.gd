class_name Checkpoint
extends Area3D

## Ponto de controle: ao o jogador entrar na área, ele passa a renascer aqui.
## A origem do nó deve estar no nível do chão.

@export var checkpoint_label: String = "Ponto de controle"


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _on_body_entered(body: Node3D) -> void:
	var player := body as PlayerController
	if player == null:
		return
	var spawn := Transform3D(Basis(Vector3.UP, rotation.y), global_position)
	if player.checkpoint_transform.origin.distance_to(spawn.origin) < 0.5:
		return
	if player.set_checkpoint(spawn):
		PlayerState.post_notice("%s salvo." % checkpoint_label)
