class_name CameraController
extends Node3D

## Câmera do jogador com dois modos explícitos.
## Terceira pessoa usa SpringArm3D para não atravessar paredes; primeira pessoa fica na altura dos olhos.
## Fica fora da hierarquia do corpo (top_level) para que girar o modelo não gire a câmera.

signal mode_changed(new_mode: Mode)

enum Mode { THIRD_PERSON, FIRST_PERSON }

const PITCH_MIN := -1.1
const PITCH_MAX := 0.9

@export var pivot_height: float = 0.9

@onready var _third_person_camera: Camera3D = $SpringArm3D/ThirdPersonCamera
@onready var _first_person_camera: Camera3D = $FirstPersonCamera

var mode: Mode = Mode.THIRD_PERSON
var yaw: float = 0.0
var pitch: float = -0.2
var _target: Node3D = null


func _ready() -> void:
	top_level = true
	_apply_mode()


func follow(target: Node3D) -> void:
	_target = target


func _process(_delta: float) -> void:
	if _target == null:
		return
	global_position = _target.get_global_transform_interpolated().origin + Vector3.UP * pivot_height
	rotation = Vector3(pitch, yaw, 0.0)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var motion := event as InputEventMouseMotion
		yaw -= motion.relative.x * Settings.mouse_sensitivity
		pitch = clampf(pitch - motion.relative.y * Settings.mouse_sensitivity, PITCH_MIN, PITCH_MAX)
	elif event.is_action_pressed("toggle_camera"):
		toggle_mode()


func get_planar_basis() -> Basis:
	return Basis(Vector3.UP, yaw)


func get_aim_direction() -> Vector3:
	return -_first_person_camera.global_basis.z


func toggle_mode() -> void:
	set_mode(Mode.FIRST_PERSON if mode == Mode.THIRD_PERSON else Mode.THIRD_PERSON)


func set_mode(new_mode: Mode) -> void:
	if new_mode == mode:
		return
	mode = new_mode
	_apply_mode()
	mode_changed.emit(mode)


func _apply_mode() -> void:
	var third := mode == Mode.THIRD_PERSON
	_third_person_camera.current = third
	_first_person_camera.current = not third
