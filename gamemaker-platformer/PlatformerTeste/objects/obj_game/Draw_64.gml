/// Draw GUI: HUD e telas de menu
draw_set_font(global.font);
draw_set_halign(fa_left);
draw_set_valign(fa_top);
var _gw = display_get_gui_width();
var _gh = display_get_gui_height();

if (global.screen != "") {
	draw_set_alpha(0.6);
	draw_set_colour(make_colour_rgb(26, 28, 44));
	draw_rectangle(0, 0, _gw, _gh, false);
	draw_set_alpha(1);
	draw_set_colour(c_white);

	var _t = "";
	var _s = "";
	switch (global.screen) {
		case "title":
			_t = "PLATAFORMA";
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
	draw_text_outlined(_gw / 2, _gh / 2 - 60, _t, 3, make_colour_rgb(255, 210, 61));
	draw_text_outlined(_gw / 2, _gh / 2 + 24, _s, 1, c_white);
	draw_set_halign(fa_left);
	draw_set_valign(fa_top);
	exit;
}

// HUD
draw_sprite(spr_coin, 0, 2, 1);
draw_text_outlined(18, 6, string(coins_got) + "/" + string(coins_total), 1, c_white);
draw_text_outlined(70, 6, "VIDAS " + string(global.lives), 1, c_white);
draw_text_outlined(130, 6, "PONTOS " + string(global.score), 1, c_white);
draw_set_halign(fa_right);
draw_text_outlined(_gw - 6, 6, "FASE " + string(global.level + 1), 1, c_white);

draw_set_halign(fa_center);
draw_set_valign(fa_middle);
if (msg_timer > 0) {
	draw_text_outlined(_gw / 2, _gh / 2 - 40, "FASE " + string(global.level + 1), 3, make_colour_rgb(255, 210, 61));
}
if (next_timer > 0) {
	draw_text_outlined(_gw / 2, _gh / 2 - 40, "FASE COMPLETA!", 3, make_colour_rgb(166, 227, 90));
}
draw_set_halign(fa_left);
draw_set_valign(fa_top);
