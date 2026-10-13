/// Movimento, colisão, inimigos, moedas e animação

// ---------- morto: sobe, cai fora da tela e reinicia
if (state == "dead") {
	vsp = min(vsp + grv, max_fall);
	y += vsp;
	dead_timer--;
	if (dead_timer <= 0) {
		global.lives--;
		if (global.lives <= 0) global.screen = "gameover";
		room_restart();
	}
	exit;
}

// ---------- entrada
var _l  = keyboard_check(vk_left)  || keyboard_check(ord("A"));
var _r  = keyboard_check(vk_right) || keyboard_check(ord("D"));
var _jp = keyboard_check_pressed(vk_space) || keyboard_check_pressed(vk_up) || keyboard_check_pressed(ord("W"));
var _jh = keyboard_check(vk_space) || keyboard_check(vk_up) || keyboard_check(ord("W"));
if (state == "win") { _l = false; _r = false; _jp = false; _jh = false; }

var _move   = _r - _l;
var _ground = place_meeting(x, y + 1, obj_block);

// ---------- horizontal
if (_move != 0) {
	hsp = approach(hsp, _move * spd_max, _ground ? accel : air_accel);
	facing = _move;
} else {
	hsp = approach(hsp, 0, _ground ? decel : air_accel * 0.5);
}

// ---------- pulo
if (_ground) coyote = 6; else if (coyote > 0) coyote--;
if (_jp) jump_buffer = 8; else if (jump_buffer > 0) jump_buffer--;
if (jump_buffer > 0 && coyote > 0) {
	vsp = jump_spd;
	jump_buffer = 0;
	coyote = 0;
	audio_play_sound(snd_jump, 1, false);
	fx_spawn(x, y, spr_dust);
}

// ---------- gravidade (soltar o botão = pulo mais baixo)
vsp += grv;
if (vsp < 0 && !_jh) vsp += grv;
vsp = min(vsp, max_fall);

// ---------- colisão
if (place_meeting(x + hsp, y, obj_block)) {
	while (!place_meeting(x + sign(hsp), y, obj_block)) x += sign(hsp);
	hsp = 0;
}
x += hsp;
x = clamp(x, 4, obj_game.level_w - 4);

if (place_meeting(x, y + vsp, obj_block)) {
	while (!place_meeting(x, y + sign(vsp), obj_block)) y += sign(vsp);
	vsp = 0;
}
y += vsp;

// ---------- perigos
if (y > obj_game.level_h + 16 || place_meeting(x, y, obj_spike)) {
	die();
	exit;
}

var _e = instance_place(x, y, obj_enemy);
if (_e != noone && !_e.dead) {
	if (vsp > 0 && y < _e.y - 4) {
		// pisou no inimigo
		with (_e) {
			dead = true;
			sprite_index = spr_enemy_dead;
		}
		vsp = _jh ? -5 : -3.5;
		fx_spawn(_e.x, _e.y, spr_dust);
		global.score += 50;
		obj_game.shake = 2;
		audio_play_sound(snd_stomp, 1, false);
	} else if (state == "play") {
		die();
		exit;
	}
}

// ---------- moedas
var _c = instance_place(x, y, obj_coin);
if (_c != noone) {
	fx_spawn(_c.x + 8, _c.y + 8, spr_sparkle);
	instance_destroy(_c);
	obj_game.coins_got++;
	global.score += 10;
	audio_play_sound(snd_coin, 1, false);
}

// ---------- bandeira
if (state == "play" && place_meeting(x, y, obj_flag)) {
	state = "win";
	obj_game.next_timer = 150;
	audio_play_sound(snd_win, 1, false);
	fx_spawn(x, y - 8, spr_sparkle);
}

// ---------- poeira ao aterrissar
var _now_ground = place_meeting(x, y + 1, obj_block);
if (_now_ground && !was_ground && fall_spd > 3) fx_spawn(x, y, spr_dust);
was_ground = _now_ground;
fall_spd = vsp;

// ---------- animação
if (!_now_ground) sprite_index = spr_player_jump;
else if (abs(hsp) > 0.3) sprite_index = spr_player_run;
else sprite_index = spr_player_idle;
