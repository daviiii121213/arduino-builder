class_name PlayerController
extends CharacterBody3D

## Controlador do animal jogável: movimento, pulo, estados, morte e respawn.
## Câmera, vida e interação ficam em componentes separados.

signal state_changed(new_state: State)
signal defeated
signal respawned

enum State { IDLE, WALKING, RUNNING, JUMPING, FALLING, INTERACTING, DEFEATED }

## Permite apertar pulo um pouco antes de tocar o chão sem perder o pulo.
const JUMP_BUFFER_TIME := 0.12

@export_group("Movimento")
@export var walk_speed: float = 4.0
@export var run_speed: float = 7.0
@export var jump_velocity: float = 4.8
@export var ground_acceleration: float = 30.0
@export var air_acceleration: float = 8.0
@export var turn_speed: float = 10.0
@export_group("Fluxo")
@export var interaction_lock_time: float = 0.25
@export var respawn_delay: float = 2.0

@onready var health: HealthComponent = $HealthComponent
@onready var camera_rig: CameraController = $CameraRig
@onready var visual: Node3D = $Visual
@onready var interaction: InteractionComponent = $InteractionComponent

var state: State = State.IDLE
var checkpoint_transform: Transform3D
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")
var _jump_buffer: float = 0.0
var _interaction_lock: float = 0.0
var _respawn_timer: float = -1.0


func _ready() -> void:
	checkpoint_transform = global_transform
	camera_rig.follow(self)
	health.died.connect(_on_died)
	camera_rig.mode_changed.connect(_on_camera_mode_changed)
	_on_camera_mode_changed(camera_rig.mode)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("jump"):
		_jump_buffer = JUMP_BUFFER_TIME
	elif event.is_action_pressed("interact"):
		_try_interact()


func _physics_process(delta: float) -> void:
	if _respawn_timer >= 0.0:
		_respawn_timer -= delta
		if _respawn_timer < 0.0:
			_respawn()
	_interaction_lock = maxf(_interaction_lock - delta, 0.0)
	_jump_buffer = maxf(_jump_buffer - delta, 0.0)

	var on_floor := is_on_floor()
	var can_act := not health.is_dead and _interaction_lock <= 0.0
	if not on_floor:
		velocity.y -= _gravity * delta
	_apply_horizontal_movement(delta, on_floor, can_act)
	if can_act and on_floor and _jump_buffer > 0.0:
		velocity.y = jump_velocity
		_jump_buffer = 0.0
	move_and_slide()
	_update_state(on_floor)


func get_facing_direction() -> Vector3:
	var forward: Vector3
	if camera_rig.mode == CameraController.Mode.FIRST_PERSON:
		forward = camera_rig.get_aim_direction()
	else:
		forward = -visual.global_basis.z
	forward.y = 0.0
	return forward.normalized()


func receive_damage(amount: float) -> void:
	health.take_damage(amount)


func set_checkpoint(new_transform: Transform3D) -> bool:
	var origin := new_transform.origin
	var finite := is_finite(origin.x) and is_finite(origin.y) and is_finite(origin.z)
	if not finite or absf(origin.y) > 500.0:
		push_warning("Ponto de controle inválido ignorado: %s" % origin)
		return false
	checkpoint_transform = new_transform
	return true


func _try_interact() -> void:
	if health.is_dead or _interaction_lock > 0.0:
		return
	if interaction.try_interact():
		_interaction_lock = interaction_lock_time


func _apply_horizontal_movement(delta: float, on_floor: bool, can_act: bool) -> void:
	var input_dir := Vector2.ZERO
	var move_dir := Vector3.ZERO
	if can_act:
		input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_backward")
		move_dir = camera_rig.get_planar_basis() * Vector3(input_dir.x, 0.0, input_dir.y)

	var running := move_dir != Vector3.ZERO and Input.is_action_pressed("run")
	var target_velocity := move_dir * (run_speed if running else walk_speed)
	var rate := ground_acceleration if on_floor else air_acceleration
	velocity.x = move_toward(velocity.x, target_velocity.x, rate * delta)
	velocity.z = move_toward(velocity.z, target_velocity.z, rate * delta)

	if camera_rig.mode == CameraController.Mode.FIRST_PERSON:
		visual.rotation.y = camera_rig.yaw
	elif can_act and move_dir.length_squared() > 0.0001:
		var desired_yaw := atan2(-move_dir.x, -move_dir.z)
		visual.rotation.y = lerp_angle(visual.rotation.y, desired_yaw, clampf(turn_speed * delta, 0.0, 1.0))


func _update_state(on_floor: bool) -> void:
	var next := State.IDLE
	if health.is_dead:
		next = State.DEFEATED
	elif not on_floor:
		next = State.JUMPING if velocity.y > 0.0 else State.FALLING
	elif _interaction_lock > 0.0:
		next = State.INTERACTING
	elif Vector2(velocity.x, velocity.z).length() >= 0.2:
		next = State.RUNNING if Input.is_action_pressed("run") else State.WALKING

	if next != state:
		state = next
		state_changed.emit(state)


func _on_died() -> void:
	if _respawn_timer >= 0.0:
		return
	_respawn_timer = respawn_delay
	_jump_buffer = 0.0
	defeated.emit()
	PlayerState.post_notice("Você foi derrotado. Voltando ao ponto de controle…")


func _respawn() -> void:
	global_transform = checkpoint_transform
	reset_physics_interpolation()
	velocity = Vector3.ZERO
	_respawn_timer = -1.0
	_interaction_lock = 0.0
	_jump_buffer = 0.0
	health.reset()
	respawned.emit()
	PlayerState.post_notice("Você voltou ao ponto de controle.")


func _on_camera_mode_changed(new_mode: CameraController.Mode) -> void:
	visual.visible = new_mode == CameraController.Mode.THIRD_PERSON
