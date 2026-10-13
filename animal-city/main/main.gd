extends Node

## Fluxo principal: menu → jogo → pausa → menu.
## O mouse fica capturado somente durante o jogo. Este nó processa sempre para receber Esc mesmo pausado.

const WORLD_SCENE_PATH := "res://world/test_city.tscn"

var _menu: MainMenu = null
var _world: TestCity = null
var _hud: GameHud = null
var _pause_menu: PauseMenu = null


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	show_main_menu()


func _unhandled_input(event: InputEvent) -> void:
	if _world != null and event.is_action_pressed("pause"):
		if get_tree().paused:
			resume_game()
		else:
			pause_game()
		get_viewport().set_input_as_handled()


func show_main_menu() -> void:
	_end_session()
	_menu = MainMenu.new()
	add_child(_menu)
	_menu.play_requested.connect(start_new_game)
	_menu.quit_requested.connect(get_tree().quit)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func start_new_game() -> void:
	var world_scene := load(WORLD_SCENE_PATH) as PackedScene
	if world_scene == null:
		_show_menu_error("Não foi possível carregar o mundo (%s). Reinstale o jogo." % WORLD_SCENE_PATH)
		return

	_end_session()
	PlayerState.reset()
	_world = world_scene.instantiate() as TestCity
	if _world == null:
		show_main_menu()
		_show_menu_error("A cena do mundo não é válida: %s" % WORLD_SCENE_PATH)
		return
	_world.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(_world)

	_hud = GameHud.new()
	add_child(_hud)
	_hud.bind(_world.player, _world.day_night)

	_pause_menu = PauseMenu.new()
	add_child(_pause_menu)
	_pause_menu.resume_requested.connect(resume_game)
	_pause_menu.menu_requested.connect(show_main_menu)
	_pause_menu.quit_requested.connect(get_tree().quit)

	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func pause_game() -> void:
	get_tree().paused = true
	_pause_menu.visible = true
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE


func resume_game() -> void:
	get_tree().paused = false
	_pause_menu.visible = false
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED


func _show_menu_error(message: String) -> void:
	push_error(message)
	if _menu != null:
		_menu.show_error(message)


func _end_session() -> void:
	get_tree().paused = false
	for node: Node in [_world, _hud, _pause_menu, _menu]:
		if is_instance_valid(node):
			node.queue_free()
	_world = null
	_hud = null
	_pause_menu = null
	_menu = null
