/// Draw GUI: HUD e telas de menu
draw_set_halign(fa_left);
draw_set_valign(fa_top);
var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

if (global.screen != "") {
	draw_set_alpha(0.55);
	draw_set_colour(c_black);
	draw_rectangle(0, 0, _gw, _gh, false);
	draw_set_alpha(1);
	draw_set_colour(c_white);

	var _t = "";
	var _s = "";
	switch (global.screen) {
		case "title":
			_t = "PLATAFORMA TESTE";
			_s = "Setas ou A/D: mover\nEspaco, W ou Cima: pular\nPule em cima dos inimigos!\nR: reiniciar fase   ESC: sair\n\nENTER para comecar";
			break;
		case "gameover":
			_t = "GAME OVER";
			_s = "Pontos: " + string(global.score) + "\n\nENTER para jogar de novo";
			break;
		case "end":
			_t = "VOCE VENCEU!";
			_s = "Pontos: " + string(global.score) + "\n\nENTER para jogar de novo";
			break;
	}
	draw_set_halign(fa_center);
	draw_set_valign(fa_middle);
	draw_text_outlined(_gw / 2, _gh / 2 - 110, _t, 5, c_yellow);
	draw_text_outlined(_gw / 2, _gh / 2 + 50, _s, 2, c_white);
	draw_set_halign(fa_left);
	draw_set_valign(fa_top);
	exit;
}

// HUD
draw_sprite(spr_coin, 0, 10, 8);
draw_text_outlined(48, 14, string(coins_got) + "/" + string(coins_total), 2, c_white);
draw_text_outlined(170, 14, "VIDAS: " + string(global.lives), 2, c_white);
draw_text_outlined(340, 14, "PONTOS: " + string(global.score), 2, c_white);
draw_set_halign(fa_right);
draw_text_outlined(_gw - 14, 14, "FASE " + string(global.level + 1), 2, c_white);

draw_set_halign(fa_center);
draw_set_valign(fa_middle);
if (msg_timer > 0) {
	draw_text_outlined(_gw / 2, _gh / 2 - 60, "FASE " + string(global.level + 1), 4, c_yellow);
}
if (next_timer > 0) {
	draw_text_outlined(_gw / 2, _gh / 2 - 60, "FASE COMPLETA!", 4, c_lime);
}
draw_set_halign(fa_left);
draw_set_valign(fa_top);
