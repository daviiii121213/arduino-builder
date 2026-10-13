/// Desenha virado para o lado do movimento, sempre em pixel inteiro
/// (a máscara de colisão não é espelhada)
draw_sprite_ext(sprite_index, image_index, round(x), round(y), facing, 1, 0, c_white, 1);
