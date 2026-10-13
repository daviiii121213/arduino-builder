class_name MainMenu
extends Control

## Menu principal: Jogar, Configurações e Sair.

signal play_requested
signal quit_requested

var _main_panel: VBoxContainer
var _settings_panel: VBoxContainer
var _error_label: Label
var _sensitivity_value: Label
var _sensitivity_slider: HSlider


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var background := ColorRect.new()
	background.color = Color(0.09, 0.1, 0.13)
	background.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(background)

	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)

	var column := VBoxContainer.new()
	column.custom_minimum_size = Vector2(360, 0)
	column.add_theme_constant_override("separation", 14)
	center.add_child(column)

	_main_panel = _build_main_panel()
	column.add_child(_main_panel)
	_settings_panel = _build_settings_panel()
	_settings_panel.visible = false
	column.add_child(_settings_panel)


func show_error(message: String) -> void:
	_error_label.text = message
	_error_label.visible = true


func _build_main_panel() -> VBoxContainer:
	var panel := VBoxContainer.new()
	panel.add_theme_constant_override("separation", 14)
	panel.add_child(_make_title("Animal City", 48))
	panel.add_child(_make_label("Protótipo · título provisório"))
	panel.add_child(_make_button("Jogar", func(): play_requested.emit()))
	panel.add_child(_make_button("Configurações", _open_settings))
	panel.add_child(_make_button("Sair", func(): quit_requested.emit()))
	_error_label = _make_label("")
	_error_label.add_theme_color_override("font_color", Color(1.0, 0.45, 0.4))
	_error_label.visible = false
	panel.add_child(_error_label)
	return panel


func _build_settings_panel() -> VBoxContainer:
	var panel := VBoxContainer.new()
	panel.add_theme_constant_override("separation", 12)
	panel.add_child(_make_title("Configurações", 32))

	panel.add_child(_make_label("Sensibilidade do mouse"))
	_sensitivity_slider = HSlider.new()
	_sensitivity_slider.min_value = Settings.MOUSE_SENSITIVITY_MIN
	_sensitivity_slider.max_value = Settings.MOUSE_SENSITIVITY_MAX
	_sensitivity_slider.step = 0.0005
	_sensitivity_slider.value = Settings.mouse_sensitivity
	_sensitivity_slider.value_changed.connect(_on_sensitivity_changed)
	panel.add_child(_sensitivity_slider)
	_sensitivity_value = _make_label("")
	panel.add_child(_sensitivity_value)
	_on_sensitivity_changed(_sensitivity_slider.value)

	panel.add_child(_make_label("Qualidade das sombras"))
	var shadows := OptionButton.new()
	for shadow_label in Settings.SHADOW_LABELS:
		shadows.add_item(shadow_label)
	shadows.select(Settings.shadow_quality)
	shadows.item_selected.connect(func(index: int): Settings.set_shadow_quality(index))
	panel.add_child(shadows)

	panel.add_child(_make_button("Voltar", _close_settings))
	return panel


func _open_settings() -> void:
	_main_panel.visible = false
	_settings_panel.visible = true


func _close_settings() -> void:
	Settings.save_settings()
	_settings_panel.visible = false
	_main_panel.visible = true


func _on_sensitivity_changed(value: float) -> void:
	Settings.set_mouse_sensitivity(value)
	_sensitivity_value.text = "Valor atual: %.4f" % Settings.mouse_sensitivity


func _make_title(text: String, font_size: int) -> Label:
	var label := _make_label(text)
	label.add_theme_font_size_override("font_size", font_size)
	return label


func _make_label(text: String) -> Label:
	var label := Label.new()
	label.text = text
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return label


func _make_button(text: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = Vector2(280, 44)
	button.pressed.connect(callback)
	return button
