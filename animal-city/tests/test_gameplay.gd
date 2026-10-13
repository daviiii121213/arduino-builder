extends Node

## Testes de jogabilidade em modo headless, sobre as cenas reais. Executar a cena de teste:
##   godot --headless --path animal-city res://tests/test_runner.tscn
## Entradas são enviadas como InputEventAction; resultados são verificados no estado do jogo.

const CITY_SCENE := "res://world/test_city.tscn"
const MAIN_SCENE := "res://main/main.tscn"
const SettingsScript := preload("res://core/settings.gd")

# Autoloads são acessados pela árvore para que o teste funcione mesmo com scripts carregados antes deles.
var _settings
var _state

var _passed := 0
var _failed := 0
var _city: TestCity = null
var _player: PlayerController = null


func _ready() -> void:
	_settings = get_node("/root/Settings")
	_state = get_node("/root/PlayerState")
	_run_all()


func _run_all() -> void:
	print("=== Animal City: testes de jogabilidade (headless) ===")
	# Espera o fim da montagem da árvore antes de adicionar nós ao root.
	await get_tree().process_frame
	_city = (load(CITY_SCENE) as PackedScene).instantiate() as TestCity
	get_tree().root.add_child(_city)
	_player = _city.player
	await _wait_physics(60)

	await _test_spawn_on_ground()
	await _test_walk()
	await _test_run()
	await _test_jump()
	await _test_camera_toggle()
	await _test_wall_collision()
	await _test_door_locked_then_key_and_open()
	await _test_hazard_damage()
	await _test_checkpoint_death_and_respawn()
	await _test_settings()
	await _test_main_flow_and_pause()

	print("=== Resultado: %d aprovados, %d falhas ===" % [_passed, _failed])
	get_tree().quit(1 if _failed > 0 else 0)


func _test_spawn_on_ground() -> void:
	print("Spawn")
	_check(_player.is_on_floor(), "personagem está apoiado no chão ao nascer")
	_check(absf(_player.global_position.y) < 0.05, "altura do chão preservada (y = %.3f)" % _player.global_position.y)


func _test_walk() -> void:
	print("Caminhada")
	_teleport(Vector3(0, 0, 14), 0.0)
	await _wait_physics(10)
	var start := _player.global_position
	_send_action("move_forward", true)
	await _wait_physics(30)
	_send_action("move_forward", false)
	await _wait_physics(10)
	var offset := _player.global_position - start
	var distance := Vector2(offset.x, offset.z).length()
	_check(distance > 1.2, "andar para frente percorre distância (%.2f m em 0,5 s)" % distance)
	_check(offset.z < -1.0, "W/move_forward move em -Z, direção de frente da câmera")
	_check(_player.state == PlayerController.State.IDLE, "estado volta a IDLE após soltar a tecla")


func _test_run() -> void:
	print("Corrida")
	_teleport(Vector3(0, 0, 14), 0.0)
	await _wait_physics(10)
	_send_action("run", true)
	_send_action("move_forward", true)
	await _wait_physics(30)
	var speed := Vector2(_player.velocity.x, _player.velocity.z).length()
	_check(speed > _player.walk_speed + 0.5, "Shift aumenta a velocidade (%.2f m/s)" % speed)
	_check(_player.state == PlayerController.State.RUNNING, "estado RUNNING ao correr")
	_send_action("move_forward", false)
	_send_action("run", false)
	await _wait_physics(20)


func _test_jump() -> void:
	print("Pulo")
	_teleport(Vector3(0, 0, 14), 0.0)
	await _wait_physics(10)
	var max_height := 0.0
	var air_check_done := false
	var velocity_after_air_press := 0.0
	_send_action("jump", true)
	await get_tree().process_frame
	_send_action("jump", false)
	for i in 90:
		await get_tree().physics_frame
		max_height = maxf(max_height, _player.global_position.y)
		var falling := not _player.is_on_floor() and _player.velocity.y < 0.0
		if not air_check_done and falling and _player.global_position.y > 0.3:
			_send_action("jump", true)
			await get_tree().process_frame
			_send_action("jump", false)
			await _wait_physics(2)
			velocity_after_air_press = _player.velocity.y
			air_check_done = true
	_check(max_height > 0.5, "pulo eleva o personagem (altura máxima %.2f m)" % max_height)
	_check(air_check_done, "pulo pressionado no ar foi testado durante a queda")
	_check(velocity_after_air_press < 0.0, "apertar pulo no ar não reinicia o pulo (vy = %.2f)" % velocity_after_air_press)
	await _wait_physics(30)
	_check(_player.is_on_floor(), "personagem pousa de volta no chão")


func _test_camera_toggle() -> void:
	print("Câmera")
	_teleport(Vector3(0, 0, 14), 0.0)
	await _wait_physics(5)
	await _tap("toggle_camera")
	_check(_player.camera_rig.mode == CameraController.Mode.FIRST_PERSON, "V alterna para primeira pessoa")
	_check(_player.camera_rig.get_node("FirstPersonCamera").current, "câmera de primeira pessoa está ativa")
	_check(not _player.visual.visible, "modelo do personagem fica oculto em primeira pessoa")
	await _tap("toggle_camera")
	_check(_player.camera_rig.mode == CameraController.Mode.THIRD_PERSON, "V volta para terceira pessoa")
	_check(_player.visual.visible, "modelo do personagem volta a aparecer em terceira pessoa")


func _test_wall_collision() -> void:
	print("Colisão")
	# Prédio Nordeste_Alto começa em x = 8; o personagem anda para +X a partir de x = 3.
	_teleport(Vector3(3, 0, -16), 0.0)
	await _wait_physics(5)
	_send_action("move_right", true)
	await _wait_physics(60)
	_send_action("move_right", false)
	await _wait_physics(10)
	var x := _player.global_position.x
	_check(x < 8.0 and x > 6.5, "personagem para diante da parede do prédio (x = %.2f)" % x)
	_check(absf(_player.global_position.y) < 0.05, "personagem não atravessa o chão ao colidir")


func _test_door_locked_then_key_and_open() -> void:
	print("Interação, porta trancada e item")
	var door := _city.get_node("Interactables/Portao_Beco") as Door
	var key := _city.get_node("Interactables/Chave_Predio") as PickupItem

	# Posição em frente ao portão, olhando para -X (yaw = PI/2).
	_teleport(Vector3(-28.5, 0, -35), PI / 2.0)
	await _wait_physics(5)
	_check(_player.interaction.current_target == door, "portão é detectado como alvo de interação")
	_check(door.get_prompt(_player) == "Porta trancada", "portão trancado mostra prompt correto")
	await _tap("interact")
	await _wait_physics(40)
	_check(not door.is_open, "portão trancado não abre sem a chave")

	# Pegar a chave.
	_teleport(Vector3(-4.5, 0, 14), PI / 2.0)
	await _wait_physics(5)
	_check(_player.interaction.current_target == key, "chave é detectada a 1,5 m de distância e de frente")
	await _tap("interact")
	await _wait_physics(3)
	_check(_state.has_item("chave_predio"), "chave entra no inventário")
	_check(not is_instance_valid(key), "chave some do mundo depois de coletada")

	# Espera o bloqueio curto após interagir (interaction_lock_time = 0,25 s) antes de nova interação.
	await _wait_physics(20)

	# Abrir o portão com a chave.
	_teleport(Vector3(-28.5, 0, -35), PI / 2.0)
	await _wait_physics(5)
	await _tap("interact")
	await _wait_physics(60)
	_check(door.is_open, "portão abre quando o jogador tem a chave")
	_check(absf(door._pivot.rotation.y - deg_to_rad(-90.0)) < 0.05, "animação do portão chega a -90°")

	# Interação não deve disparar duas vezes com uma só tecla.
	var open_state_before := door.is_open
	await _tap("interact")
	await _wait_physics(60)
	_check(open_state_before != door.is_open, "uma tecla alterna o portão exatamente uma vez")


func _test_hazard_damage() -> void:
	print("Dano por perigo")
	_player.health.reset()
	_teleport(Vector3(0, 0, 22), 0.0)
	await _wait_physics(60)
	var hp := _player.health.current_health
	_check(hp < _player.health.max_health - 5.0, "vidro quebrado causa dano contínuo (vida %.1f)" % hp)
	_player.health.reset()
	_teleport(Vector3(0, 0, 14), 0.0)
	await _wait_physics(5)


func _test_checkpoint_death_and_respawn() -> void:
	print("Ponto de controle, morte e respawn")
	_player.health.reset()
	_teleport(Vector3(0, 0, -30), 0.0)
	await _wait_physics(10)
	var checkpoint_position := _player.checkpoint_transform.origin
	_check(checkpoint_position.distance_to(Vector3(0, 0, -30)) < 0.6, "entrar na área salva o ponto de controle")

	_teleport(Vector3(0, 0, -10), 0.0)
	await _wait_physics(5)
	var respawn_count := [0]
	var on_respawn := func(): respawn_count[0] += 1
	_player.respawned.connect(on_respawn)
	_player.receive_damage(1000.0)
	await _wait_physics(2)
	_check(_player.state == PlayerController.State.DEFEATED, "morte muda o estado para DEFEATED")
	_player.receive_damage(50.0)
	await _wait_physics(int(_player.respawn_delay * 60.0) + 30)
	_check(respawn_count[0] == 1, "respawn disparado exatamente uma vez (contagem = %d)" % respawn_count[0])
	_check(_player.global_position.distance_to(checkpoint_position) < 0.5, "personagem renasce no ponto de controle")
	_check(not _player.health.is_dead, "respawn limpa o estado de morte")
	_check(is_equal_approx(_player.health.current_health, _player.health.max_health), "respawn restaura a vida cheia")
	_check(_player.state != PlayerController.State.DEFEATED, "estado sai de DEFEATED após o respawn")
	_check(Vector2(_player.velocity.x, _player.velocity.z).length() < 0.01, "respawn zera a velocidade horizontal")
	_player.respawned.disconnect(on_respawn)


func _test_settings() -> void:
	print("Configurações")
	_settings.set_shadow_quality(2)
	_check(_city.applied_shadow_size == 4096, "qualidade alta de sombras aplica atlas de 4096 px")
	_settings.set_shadow_quality(0)
	_check(_city.applied_shadow_size == 1024, "qualidade baixa de sombras aplica atlas de 1024 px")
	_settings.set_shadow_quality(1)
	_settings.set_mouse_sensitivity(0.5)
	_check(is_equal_approx(_settings.mouse_sensitivity, SettingsScript.MOUSE_SENSITIVITY_MAX), "sensibilidade é limitada ao máximo")
	_settings.set_mouse_sensitivity(0.003)


func _test_main_flow_and_pause() -> void:
	print("Fluxo principal e pausa")
	_city.queue_free()
	await get_tree().process_frame
	var main = (load(MAIN_SCENE) as PackedScene).instantiate()
	get_tree().root.add_child(main)
	await get_tree().process_frame
	_check(main._world == null, "menu inicial não cria o mundo")
	main.start_new_game()
	await get_tree().process_frame
	_check(main._world != null and main._hud != null, "Jogar cria mundo e HUD")
	await _wait_physics(5)

	await _tap("pause")
	_check(get_tree().paused, "Esc pausa o jogo")
	await _tap("pause")
	_check(not get_tree().paused, "Esc retoma o jogo")

	main.pause_game()
	main.show_main_menu()
	await get_tree().process_frame
	_check(main._world == null and not get_tree().paused, "Voltar ao menu descarta o mundo e despausa")
	main.start_new_game()
	await get_tree().process_frame
	_check(main._world != null, "é possível iniciar uma nova partida depois de voltar ao menu")
	main.queue_free()
	await get_tree().process_frame


# --- Utilitários de teste -------------------------------------------------

func _check(condition: bool, description: String) -> void:
	if condition:
		_passed += 1
		print("  [OK] %s" % description)
	else:
		_failed += 1
		print("  [FALHA] %s" % description)


func _wait_physics(frames: int) -> void:
	for i in frames:
		await get_tree().physics_frame


func _send_action(action: StringName, pressed: bool) -> void:
	var event := InputEventAction.new()
	event.action = action
	event.pressed = pressed
	Input.parse_input_event(event)


func _tap(action: StringName) -> void:
	_send_action(action, true)
	await get_tree().process_frame
	_send_action(action, false)
	await get_tree().process_frame


func _teleport(target: Vector3, yaw: float) -> void:
	_player.global_position = target
	_player.velocity = Vector3.ZERO
	_player.camera_rig.yaw = yaw
	_player.camera_rig.pitch = -0.2
	_player.visual.rotation.y = yaw
	_player.reset_physics_interpolation()
