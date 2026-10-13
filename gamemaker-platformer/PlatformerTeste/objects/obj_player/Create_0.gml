/// Jogador: física de plataforma com coyote time, buffer de pulo e pulo variável
hsp = 0;
vsp = 0;

spd_max   = 4;
accel     = 0.5;
decel     = 0.6;
air_accel = 0.35;
grv       = 0.45;
jump_spd  = -11;
max_fall  = 10;

coyote      = 0;  // frames em que ainda pode pular depois de sair da beirada
jump_buffer = 0;  // frames em que o pulo apertado "antes da hora" ainda vale
facing      = 1;
state       = "play"; // "play", "dead", "win"
dead_timer  = 0;
depth       = -10;

die = function() {
	if (state != "play") return;
	state      = "dead";
	vsp        = -9;
	dead_timer = 90;
	audio_play_sound(snd_death, 1, false);
	obj_game.shake = 6;
};
