/// Câmera, troca de fase e menus

// Telas de menu
if (global.screen != "") {
	if (keyboard_check_pressed(vk_enter) || keyboard_check_pressed(vk_space)) {
		if (global.screen != "title") {
			global.level = 0;
			global.lives = 3;
			global.score = 0;
		}
		global.screen = "";
		room_restart();
	}
	if (keyboard_check_pressed(vk_escape)) game_end();
	exit;
}

// Câmera suave seguindo o jogador
if (instance_exists(obj_player)) {
	var _tx = clamp(obj_player.x - cam_w / 2, 0, max(0, level_w - cam_w));
	var _ty = clamp(obj_player.y - cam_h / 2, 0, max(0, level_h - cam_h));
	cam_x = lerp(cam_x, _tx, 0.12);
	cam_y = lerp(cam_y, _ty, 0.12);
}
var _sx = 0;
var _sy = 0;
if (shake > 0) {
	_sx = random_range(-shake, shake);
	_sy = random_range(-shake, shake);
	shake = max(0, shake - 0.4);
}
camera_set_view_pos(cam, round(cam_x + _sx), round(cam_y + _sy));

if (msg_timer > 0) msg_timer--;

// Fase completa -> próxima
if (next_timer > 0) {
	next_timer--;
	if (next_timer == 0) {
		global.level++;
		if (global.level >= levels_count()) global.screen = "end";
		room_restart();
	}
}

if (keyboard_check_pressed(ord("R"))) room_restart();
if (keyboard_check_pressed(vk_escape)) game_end();
