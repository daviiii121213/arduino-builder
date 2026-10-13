class_name PauseMenu
extends CanvasLayer

## Menu de pausa exibido sobre o jogo. Funciona enquanto a árvore está pausada.

signal resume_requested
signal menu_requested
signal quit_requested


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	visible = false

	var dim := ColorRect.new()
	dim.color = Color(0.0, 0.0, 0.0, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(280, 0)
	column.add_theme_constant_override("separation", 12)
	center.add_child(column)

	var title := Label.new()
	title.text = "Pausado"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 36)
	column.add_child(title)
	column.add_child(_make_button("Continuar", func(): resume_requested.emit()))
	column.add_child(_make_button("Voltar ao menu", func(): menu_requested.emit()))
	column.add_child(_make_button("Sair do jogo", func(): quit_requested.emit()))


func _make_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(280, 44)
	button.pressed.connect(callback)
	return button
