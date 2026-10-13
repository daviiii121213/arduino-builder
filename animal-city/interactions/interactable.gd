class_name Interactable
extends StaticBody3D

## Base de qualquer objeto que o jogador pode ativar com a tecla de interação.
## Subclasses sobrescrevem interact(); o componente de interação só usa esta interface.

const GROUP := "interactable"

@export var prompt_text: String = "Interagir"


func _ready() -> void:
	add_to_group(GROUP)


func get_prompt(_actor: Node3D) -> String:
	return prompt_text


func can_interact(_actor: Node3D) -> bool:
	return true


## Ponto usado no teste de linha de visão. Subclasses ajustam para o centro real do objeto.
func get_interaction_point() -> Vector3:
	return global_position + Vector3.UP * 0.5


func interact(_actor: Node3D) -> void:
	push_error("%s precisa sobrescrever interact()." % name)
