/// Desenha virado para o lado do movimento (a máscara de colisão não é espelhada)
var _ang = (state == "dead") ? dead_timer * 12 : 0;
draw_sprite_ext(sprite_index, image_index, x, y, facing, 1, _ang, c_white, 1);
