class_name GameHud
extends CanvasLayer

## HUD minimalista: vida, dinheiro, relógio, inventário, prompt de interação e avisos.
## Só mostra informações ligadas a sistemas que existem no jogo.

const NOTICE_DURATION := 3.0

var _health_bar: ProgressBar
var _health_label: Label
var _money_label: Label
var _clock_label: Label
var _inventory_label: Label
var _prompt_label: Label
var _notice_label: Label
var _defeat_label: Label
var _controls_label: Label
var _notice_time_left: float = 0.0
var _player: PlayerController = null


func _ready() -> void:
	_build_ui()
	PlayerState.changed.connect(_refresh_wallet_and_inventory)
	PlayerState.notice_posted.connect(_show_notice)
	_refresh_wallet_and_inventory()
	_controls_label.text = _build_controls_text()


func bind(player: PlayerController, clock: DayNightController) -> void:
	_player = player
	player.health.health_changed.connect(_on_health_changed)
	player.defeated.connect(_on_defeated)
	player.respawned.connect(_on_respawned)
	clock.clock_changed.connect(_on_clock_changed)
	_on_health_changed(player.health.current_health, player.health.max_health)
	_on_clock_changed(clock.get_clock_text())


static func key_label(action: StringName) -> String:
	var events := InputMap.action_get_events(action)
	if events.is_empty():
		return "?"
	return events[0].as_text().trim_suffix(" (Physical)")


func _process(delta: float) -> void:
	_update_prompt()
	if _notice_time_left > 0.0:
		_notice_time_left -= delta
		if _notice_time_left <= 0.0:
			_notice_label.visible = false


func _update_prompt() -> void:
	var target: Interactable = null
	if _player != null and not _player.health.is_dead:
		target = _player.interaction.current_target
	if is_instance_valid(target):
		_prompt_label.text = "[%s] %s" % [key_label(&"interact"), target.get_prompt(_player)]
		_prompt_label.visible = true
	else:
		_prompt_label.visible = false


func _build_ui() -> void:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)

	var status := VBoxContainer.new()
	status.position = Vector2(16, 16)
	status.add_theme_constant_override("separation", 6)
	status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(status)

	_health_label = _make_label(16)
	status.add_child(_health_label)
	_health_bar = ProgressBar.new()
	_health_bar.custom_minimum_size = Vector2(240, 18)
	_health_bar.show_percentage = false
	status.add_child(_health_bar)
	_money_label = _make_label(18)
	status.add_child(_money_label)
	_clock_label = _make_label(18)
	status.add_child(_clock_label)
	_inventory_label = _make_label(16)
	status.add_child(_inventory_label)

	_notice_label = _make_label(20)
	_notice_label.set_anchors_preset(Control.PRESET_TOP_WIDE)
	_notice_label.offset_top = 90.0
	_notice_label.offset_bottom = 130.0
	_notice_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_notice_label.visible = false
	root.add_child(_notice_label)

	_prompt_label = _make_label(22)
	_prompt_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_prompt_label.offset_top = -120.0
	_prompt_label.offset_bottom = -80.0
	_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_prompt_label.visible = false
	root.add_child(_prompt_label)

	_defeat_label = _make_label(30)
	_defeat_label.set_anchors_preset(Control.PRESET_FULL_RECT)
	_defeat_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_defeat_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_defeat_label.text = "Você foi derrotado.\nVoltando ao ponto de controle…"
	_defeat_label.visible = false
	root.add_child(_defeat_label)

	_controls_label = _make_label(13)
	_controls_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_controls_label.offset_left = 16.0
	_controls_label.offset_top = -40.0
	_controls_label.offset_right = 1000.0
	_controls_label.offset_bottom = -16.0
	root.add_child(_controls_label)


func _make_label(font_size: int) -> Label:
	var label := Label.new()
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_outline_color", Color.BLACK)
	label.add_theme_constant_override("outline_size", 6)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return label


func _build_controls_text() -> String:
	return "Mover: %s%s%s%s · Correr: %s · Pular: %s · Interagir: %s · Câmera: %s · Pausar: %s · Mouse: olhar" % [
		key_label(&"move_forward"), key_label(&"move_left"), key_label(&"move_backward"), key_label(&"move_right"),
		key_label(&"run"), key_label(&"jump"), key_label(&"interact"), key_label(&"toggle_camera"), key_label(&"pause"),
	]


func _on_health_changed(current: float, maximum: float) -> void:
	_health_bar.max_value = maximum
	_health_bar.value = current
	_health_label.text = "Vida %d / %d" % [roundi(current), roundi(maximum)]


func _on_clock_changed(text: String) -> void:
	_clock_label.text = "Relógio: %s" % text


func _on_defeated() -> void:
	_defeat_label.visible = true


func _on_respawned() -> void:
	_defeat_label.visible = false


func _show_notice(text: String) -> void:
	_notice_label.text = text
	_notice_label.visible = true
	_notice_time_left = NOTICE_DURATION


func _refresh_wallet_and_inventory() -> void:
	_money_label.text = "Dinheiro: R$ %d" % PlayerState.money
	if PlayerState.inventory.is_empty():
		_inventory_label.text = "Inventário: vazio"
		return
	var parts: PackedStringArray = []
	for item_id: String in PlayerState.inventory.keys():
		parts.append("%s x%d" % [ItemCatalog.get_display_name(item_id), PlayerState.inventory[item_id]])
	_inventory_label.text = "Inventário: " + ", ".join(parts)
