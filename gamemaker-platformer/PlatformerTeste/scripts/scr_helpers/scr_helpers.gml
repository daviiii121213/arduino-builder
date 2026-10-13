/// Funções utilitárias

/// Move _a em direção a _b no máximo _amt por chamada
function approach(_a, _b, _amt) {
	if (_a < _b) return min(_a + _amt, _b);
	return max(_a - _amt, _b);
}

/// Desenha texto com contorno preto (bom para HUD)
function draw_text_outlined(_x, _y, _str, _scale, _col) {
	draw_set_colour(c_black);
	for (var _i = -2; _i <= 2; _i += 2) {
		for (var _j = -2; _j <= 2; _j += 2) {
			draw_text_transformed(_x + _i, _y + _j, _str, _scale, _scale, 0);
		}
	}
	draw_set_colour(_col);
	draw_text_transformed(_x, _y, _str, _scale, _scale, 0);
	draw_set_colour(c_white);
}
