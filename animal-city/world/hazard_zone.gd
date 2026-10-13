class_name HazardZone
extends Area3D

## Área que causa dano contínuo ao jogador enquanto ele estiver dentro dela.

@export var damage_per_second: float = 15.0
@export var hazard_label: String = "Cuidado: vidro quebrado"


func _ready() -> void:
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	for body in get_overlapping_bodies():
		var player := body as PlayerController
		if player != null:
			player.receive_damage(damage_per_second * delta)


func _on_body_entered(body: Node3D) -> void:
	if body is PlayerController:
		PlayerState.post_notice(hazard_label)
