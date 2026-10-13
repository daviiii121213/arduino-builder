extends Node

## Configurações do jogador persistidas em user://settings.cfg.
## Só contém opções que alteram o comportamento em tempo de execução.

signal changed

const SAVE_PATH := "user://settings.cfg"
const SECTION := "jogo"
const MOUSE_SENSITIVITY_MIN := 0.001
const MOUSE_SENSITIVITY_MAX := 0.01
const SHADOW_SIZES := [1024, 2048, 4096]
const SHADOW_LABELS := ["Baixa", "Média", "Alta"]

var mouse_sensitivity: float = 0.003
var shadow_quality: int = 1


func _ready() -> void:
	load_settings()


func set_mouse_sensitivity(value: float) -> void:
	mouse_sensitivity = clampf(value, MOUSE_SENSITIVITY_MIN, MOUSE_SENSITIVITY_MAX)
	changed.emit()


func set_shadow_quality(level: int) -> void:
	shadow_quality = clampi(level, 0, SHADOW_SIZES.size() - 1)
	changed.emit()


func get_shadow_size() -> int:
	return SHADOW_SIZES[shadow_quality]


func save_settings() -> void:
	var config := ConfigFile.new()
	config.set_value(SECTION, "mouse_sensitivity", mouse_sensitivity)
	config.set_value(SECTION, "shadow_quality", shadow_quality)
	var error := config.save(SAVE_PATH)
	if error != OK:
		push_warning("Não foi possível salvar as configurações (código %d)." % error)


func load_settings() -> void:
	var config := ConfigFile.new()
	var error := config.load(SAVE_PATH)
	if error == ERR_FILE_NOT_FOUND:
		return
	if error != OK:
		push_warning("Configurações ilegíveis; usando valores padrão (código %d)." % error)
		return
	mouse_sensitivity = clampf(
		float(config.get_value(SECTION, "mouse_sensitivity", mouse_sensitivity)),
		MOUSE_SENSITIVITY_MIN,
		MOUSE_SENSITIVITY_MAX
	)
	shadow_quality = clampi(
		int(config.get_value(SECTION, "shadow_quality", shadow_quality)),
		0,
		SHADOW_SIZES.size() - 1
	)
	changed.emit()
