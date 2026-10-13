class_name TestCity
extends Node3D

## Cena do distrito de teste. Gera a geometria a partir do layout e aplica as opções gráficas.

@onready var player: PlayerController = $Player
@onready var day_night: DayNightController = $DayNight
@onready var sun: DirectionalLight3D = $Sun
@onready var world_environment: WorldEnvironment = $WorldEnvironment
@onready var geometry: Node3D = $Geometry

## Último tamanho de atlas de sombras aplicado (0 antes da primeira aplicação).
var applied_shadow_size: int = 0


func _ready() -> void:
	TestDistrictBuilder.build(geometry)
	day_night.setup(sun, world_environment.environment)
	Settings.changed.connect(_apply_graphics)
	_apply_graphics()


func _apply_graphics() -> void:
	sun.shadow_enabled = true
	applied_shadow_size = Settings.get_shadow_size()
	RenderingServer.directional_shadow_atlas_set_size(applied_shadow_size, true)
