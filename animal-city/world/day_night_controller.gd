class_name DayNightController
extends Node

## Relógio do jogo e ciclo visual dia/noite: move o sol e ajusta a luz do ambiente.

signal clock_changed(text: String)

@export var start_hour: float = 8.0
## Segundos reais para cada hora do jogo (60 = um dia dura 24 minutos).
@export var real_seconds_per_game_hour: float = 60.0

var hour: float = 8.0
var _last_minute: int = -1
var _sun: DirectionalLight3D = null
var _environment: Environment = null


func _ready() -> void:
	hour = start_hour


## Recebe as referências de luz pela cena pai, que é quem conhece a estrutura do mundo.
func setup(sun_light: DirectionalLight3D, world_environment: Environment) -> void:
	_sun = sun_light
	_environment = world_environment
	_apply_lighting()


func _process(delta: float) -> void:
	hour = fposmod(hour + delta / real_seconds_per_game_hour, 24.0)
	_apply_lighting()
	var minute := int(hour * 60.0)
	if minute != _last_minute:
		_last_minute = minute
		clock_changed.emit(get_clock_text())


func get_clock_text() -> String:
	var hours := int(hour)
	var minutes := int((hour - hours) * 60.0)
	return "%02d:%02d" % [hours, minutes]


func _apply_lighting() -> void:
	if _sun == null or _environment == null:
		return
	# O sol nasce às 06h (horizonte), está a pino às 12h e se põe às 18h.
	var sun_angle := (hour - 6.0) / 12.0 * PI
	_sun.rotation = Vector3(-sun_angle, deg_to_rad(-35.0), 0.0)
	var daylight := clampf(sin(sun_angle), 0.0, 1.0)
	_sun.light_energy = lerpf(0.05, 1.1, daylight)
	_sun.light_color = Color(1.0, 0.82, 0.65).lerp(Color.WHITE, daylight)
	_environment.ambient_light_energy = lerpf(0.2, 0.7, daylight)
