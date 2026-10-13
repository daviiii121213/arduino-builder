/// Draw Begin: céu, colinas e nuvens (desenhado antes de todo o resto)
var _cx = camera_get_view_x(cam);
var _cy = camera_get_view_y(cam);

// Céu em faixas de cor chapada (sem degradê)
draw_set_colour(make_colour_rgb(111, 183, 255));
draw_rectangle(_cx, _cy, _cx + cam_w, _cy + cam_h, false);
draw_set_colour(make_colour_rgb(150, 205, 255));
draw_rectangle(_cx, _cy + 150, _cx + cam_w, _cy + cam_h, false);
draw_set_colour(make_colour_rgb(190, 228, 255));
draw_rectangle(_cx, _cy + 190, _cx + cam_w, _cy + cam_h, false);
draw_set_colour(c_white);

// Nuvens (parallax bem lento)
var _wrap = cam_w + 64;
for (var _k = 0; _k < array_length(clouds); _k++) {
	var _c = clouds[_k];
	var _x = (_c[0] - _cx * _c[2] - current_time * 0.002 * _c[2]) mod _wrap;
	if (_x < 0) _x += _wrap;
	draw_sprite(spr_cloud, 0, floor(_cx + _x - 32), _cy + _c[1]);
}

// Colinas (parallax)
var _off = floor(_cx * 0.4) mod 160;
for (var _i = -1; _i < cam_w / 160 + 2; _i++) {
	draw_sprite(spr_hill, 0, _cx + _i * 160 - _off, _cy + cam_h - 88);
	draw_sprite(spr_hill, 0, _cx + _i * 160 - _off + 72, _cy + cam_h - 72);
}
