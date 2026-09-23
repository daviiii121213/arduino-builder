"""
ARDUINO BUILDER - A Aventura do Bitinho
=======================================

Um jogo de plataforma 2D sobre um robozinho feito de Arduino que precisa
salvar o mundo dos circuitos de bugs, virus e de um bootloader corrompido.

Como jogar:
    pip install pygame
    python main.py

Controles:
    Setas / WASD ......... mover
    Espaco / Z ........... pular (segure para pular mais alto)
    J / X ................ atirar solda (segure CIMA para mirar no alto)
    K / C / Shift ........ dash (upgrade)
    E / Baixo ............ interagir (terminais, NPCs)
    Tab .................. Serial Monitor
    Esc / P .............. pausa
    F11 .................. tela cheia
"""

import os
import sys

import pygame

import config as cfg
from util import Controle, texto
from audio import Audio
from sprites import Sprites
from save import Save


class App:
    def __init__(self):
        pygame.mixer.pre_init(22050, -16, 1, 512)
        pygame.init()
        pygame.display.set_caption(cfg.TITULO)
        self.save = Save()
        self.flags = pygame.SCALED
        if self.save.opcoes.get("tela_cheia"):
            self.flags |= pygame.FULLSCREEN
        try:
            self.tela = pygame.display.set_mode((cfg.LARGURA, cfg.ALTURA), self.flags)
        except pygame.error:
            self.tela = pygame.display.set_mode((cfg.LARGURA, cfg.ALTURA))
        self._definir_icone()
        self.relogio = pygame.time.Clock()
        self.ctrl = Controle()
        self.audio = Audio()
        self.audio.definir_volumes(self.save.opcoes["volume_sfx"], self.save.opcoes["volume_musica"])
        self.sprites = Sprites()
        self.rodando = True
        self.cena = None
        self.proxima = None
        self.fade = 0.0
        self.fade_dir = 0
        from telas import TelaBoot
        self.cena = TelaBoot(self)

    def _definir_icone(self):
        icone = pygame.Surface((32, 32), pygame.SRCALPHA)
        pygame.draw.rect(icone, cfg.AZUL_ARDUINO, (2, 6, 28, 20), border_radius=4)
        pygame.draw.circle(icone, cfg.BRANCO, (11, 16), 6, 2)
        pygame.draw.circle(icone, cfg.BRANCO, (21, 16), 6, 2)
        pygame.display.set_icon(icone)

    def aplicar_tela_cheia(self):
        try:
            pygame.display.toggle_fullscreen()
        except pygame.error:
            pass

    def trocar_cena(self, nova, transicao=True):
        if transicao:
            self.proxima = nova
            self.fade_dir = 1
        else:
            self.cena = nova

    def executar(self):
        while self.rodando:
            eventos = pygame.event.get()
            for e in eventos:
                if e.type == pygame.QUIT:
                    self.rodando = False
                elif e.type == pygame.KEYDOWN and e.key == pygame.K_F11:
                    self.save.opcoes["tela_cheia"] = not self.save.opcoes.get("tela_cheia")
                    self.aplicar_tela_cheia()
                self.ctrl.processar_evento(e)
            self.ctrl.atualizar()

            if self.fade_dir == 0:
                self.cena.atualizar(eventos)
            self.cena.desenhar(self.tela)
            self._atualizar_fade()
            if self.save.opcoes.get("mostrar_fps"):
                texto(self.tela, "%d FPS" % self.relogio.get_fps(), (cfg.LARGURA - 8, cfg.ALTURA - 20), 12,
                      cfg.VERDE_LED, direita=True, mono=True)
            pygame.display.flip()
            self.relogio.tick(cfg.FPS)
        self.save.salvar()
        pygame.quit()

    def _atualizar_fade(self):
        if self.fade_dir == 1:
            self.fade = min(1.0, self.fade + 0.09)
            if self.fade >= 1.0:
                self.cena = self.proxima
                self.proxima = None
                self.fade_dir = -1
        elif self.fade_dir == -1:
            self.fade = max(0.0, self.fade - 0.09)
            if self.fade <= 0:
                self.fade_dir = 0
        if self.fade > 0:
            s = pygame.Surface((cfg.LARGURA, cfg.ALTURA))
            s.fill((0, 0, 0))
            s.set_alpha(int(255 * self.fade))
            self.tela.blit(s, (0, 0))


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    App().executar()


if __name__ == "__main__":
    main()
