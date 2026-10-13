/// Controlador do jogo: monta a fase a partir do mapa (scr_levels), câmera, HUD e telas
game_set_speed(60, gamespeed_fps);
randomize();

if (!variable_global_exists("level")) {
	global.level  = 0;
	global.lives  = 3;
	global.score  = 0;
	global.screen = "title"; // "", "title", "gameover", "end"
}

tile        = 32;
cam         = view_camera[0];
cam_w       = camera_get_view_width(cam);
cam_h       = camera_get_view_height(cam);
level_w     = cam_w;
level_h     = cam_h;
coins_total = 0;
coins_got   = 0;
msg_timer   = 150;  // mostra "FASE X" no início
next_timer  = 0;    // contagem para a próxima fase
shake       = 0;

// Monta a fase (só quando não estamos numa tela de menu)
if (global.screen == "") {
	var _map = levels_get(global.level);
	level_h = max(cam_h, array_length(_map) * tile);
	for (var _j = 0; _j < array_length(_map); _j++) {
		var _line = _map[_j];
		level_w = max(level_w, string_length(_line) * tile);
		for (var _i = 1; _i <= string_length(_line); _i++) {
			var _xx = (_i - 1) * tile;
			var _yy = _j * tile;
			switch (string_char_at(_line, _i)) {
				case "#":
					var _b = instance_create_layer(_xx, _yy, "Instances", obj_block);
					// bloco com outro bloco em cima vira terra (sem grama)
					if (_j > 0 && string_char_at(_map[_j - 1], _i) == "#") _b.image_index = 1;
					break;
				case "P": instance_create_layer(_xx + 16, _yy + 16, "Instances", obj_player); break;
				case "C": instance_create_layer(_xx, _yy, "Instances", obj_coin); coins_total++; break;
				case "E": instance_create_layer(_xx + 16, _yy + 16, "Instances", obj_enemy); break;
				case "^": instance_create_layer(_xx, _yy, "Instances", obj_spike); break;
				case "F": instance_create_layer(_xx, _yy - tile, "Instances", obj_flag); break;
			}
		}
	}
}

// Nuvens do fundo: [x, y, velocidade de parallax]
clouds = [];
for (var _k = 0; _k < 8; _k++) {
	clouds[_k] = [random(cam_w + 192), random_range(16, 200), random_range(0.15, 0.45)];
}

// Posiciona a câmera direto no jogador
cam_x = 0;
cam_y = 0;
if (instance_exists(obj_player)) {
	cam_x = clamp(obj_player.x - cam_w / 2, 0, max(0, level_w - cam_w));
	cam_y = clamp(obj_player.y - cam_h / 2, 0, max(0, level_h - cam_h));
}
camera_set_view_pos(cam, cam_x, cam_y);
