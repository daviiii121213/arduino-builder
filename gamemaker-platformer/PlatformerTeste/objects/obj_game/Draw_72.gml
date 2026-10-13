/// Draw Begin: céu, colinas e nuvens (desenhado antes de todo o resto)
var _cx = camera_get_view_x(cam);
var _cy = camera_get_view_y(cam);

// Céu em degradê
draw_rectangle_colour(_cx, _cy, _cx + cam_w, _cy + cam_h,
	make_colour_rgb(90, 160, 240), make_colour_rgb(90, 160, 240),
	make_colour_rgb(190, 230, 255), make_colour_rgb(190, 230, 255), false);

// Colinas (parallax lento)
var _off = (_cx * 0.3) mod 256;
for (var _i = -1; _i < cam_w / 256 + 2; _i++) {
	var _col = (_i mod 2 == 0) ? c_white : make_colour_rgb(200, 235, 210);
	draw_sprite_ext(spr_hill, 0, _cx + _i * 256 - _off, _cy + cam_h - 210, 1, 1, 0, _col, 1);
}

// Nuvens
var _wrap = cam_w + 192;
for (var _k = 0; _k < array_length(clouds); _k++) {
	var _c = clouds[_k];
	var _x = (_c[0] - _cx * _c[2] - current_time * 0.004 * _c[2]) mod _wrap;
	if (_x < 0) _x += _wrap;
	draw_sprite(spr_cloud, 0, _cx + _x - 96, _cy + _c[1]);
}
