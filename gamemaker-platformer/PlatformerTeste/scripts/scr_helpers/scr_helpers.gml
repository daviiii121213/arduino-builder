/// Funções utilitárias

/// Move _a em direção a _b no máximo _amt por chamada
function approach(_a, _b, _amt) {
	if (_a < _b) return min(_a + _amt, _b);
	return max(_a - _amt, _b);
}

/// Desenha texto com sombra escura de 1 pixel (na escala do texto)
function draw_text_outlined(_x, _y, _str, _scale, _col) {
	_str = string_upper(_str);
	draw_set_colour(make_colour_rgb(26, 28, 44));
	draw_text_transformed(_x + _scale, _y + _scale, _str, _scale, _scale, 0);
	draw_text_transformed(_x, _y + _scale, _str, _scale, _scale, 0);
	draw_set_colour(_col);
	draw_text_transformed(_x, _y, _str, _scale, _scale, 0);
	draw_set_colour(c_white);
}

/// Cria um efeito pixelado (poeira, brilho) que some ao fim da animação
function fx_spawn(_x, _y, _spr) {
	var _f = instance_create_layer(round(_x), round(_y), "Instances", obj_fx);
	_f.sprite_index = _spr;
	_f.image_index = 0;
	return _f;
}
