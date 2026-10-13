class_name HealthComponent
extends Node

## Vida reutilizável. Emite died uma única vez até que reset() seja chamado.

signal health_changed(current: float, maximum: float)
signal died

@export var max_health: float = 100.0

var current_health: float = 0.0
var is_dead: bool = false


func _ready() -> void:
	current_health = max_health


func take_damage(amount: float) -> void:
	if is_dead or amount <= 0.0:
		return
	current_health = maxf(current_health - amount, 0.0)
	health_changed.emit(current_health, max_health)
	if current_health <= 0.0:
		is_dead = true
		died.emit()


func reset() -> void:
	is_dead = false
	current_health = max_health
	health_changed.emit(current_health, max_health)
