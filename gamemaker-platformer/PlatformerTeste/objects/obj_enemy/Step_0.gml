if (dead) {
	image_speed = 0;
	image_alpha -= 1 / 30;
	dead_timer--;
	if (dead_timer <= 0) instance_destroy();
	exit;
}

// gravidade
vsp = min(vsp + grv, 10);
if (place_meeting(x, y + vsp, obj_block)) {
	while (!place_meeting(x, y + sign(vsp), obj_block)) y += sign(vsp);
	vsp = 0;
}
y += vsp;

// patrulha: vira ao bater na parede ou ao chegar na beirada
if (place_meeting(x, y + 1, obj_block)) {
	if (place_meeting(x + dir * spd, y, obj_block) || !position_meeting(x + dir * 14, bbox_bottom + 2, obj_block)) {
		dir = -dir;
	}
	x += dir * spd;
}
image_xscale = -dir; // o sprite olha para a esquerda

if (y > room_height + 64) instance_destroy();
