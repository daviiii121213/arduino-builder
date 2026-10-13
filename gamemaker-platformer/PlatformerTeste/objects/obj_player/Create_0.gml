/// Jogador: física de plataforma com coyote time, buffer de pulo e pulo variável
hsp = 0;
vsp = 0;

spd_max   = 1.8;
accel     = 0.2;
decel     = 0.25;
air_accel = 0.14;
grv       = 0.22;
jump_spd  = -5.3;
max_fall  = 5;

coyote      = 0;  // frames em que ainda pode pular depois de sair da beirada
jump_buffer = 0;  // frames em que o pulo apertado "antes da hora" ainda vale
facing      = 1;
state       = "play"; // "play", "dead", "win"
dead_timer  = 0;
depth       = -10;
was_ground  = true;
fall_spd    = 0;

die = function() {
	if (state != "play") return;
	state      = "dead";
	vsp        = -4.5;
	dead_timer = 90;
	audio_play_sound(snd_death, 1, false);
	obj_game.shake = 3;
	sprite_index = spr_player_dead;
};
