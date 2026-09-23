"""
Geracao procedural de todos os graficos do jogo.

Nenhuma imagem externa e usada: cada sprite e desenhado com primitivas do
pygame (retangulos, circulos, linhas e poligonos) e guardado em cache.
"""

import math
import random

import pygame

import config as cfg
from util import lerp_cor, brilho_cache, render_texto


def _surf(w, h):
    return pygame.Surface((w, h), pygame.SRCALPHA)


def _contorno(surf, cor=(0, 0, 0, 255)):
    """Adiciona um contorno de 1px ao redor dos pixels nao transparentes."""
    mascara = pygame.mask.from_surface(surf)
    pontos = mascara.outline()
    if len(pontos) > 2:
        resultado = surf.copy()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            for p in pontos:
                x, y = p[0] + dx, p[1] + dy
                if 0 <= x < surf.get_width() and 0 <= y < surf.get_height():
                    if resultado.get_at((x, y))[3] == 0:
                        resultado.set_at((x, y), cor)
        return resultado
    return surf


class Sprites:
    """Contem todos os sprites prontos para uso."""

    def __init__(self):
        self.cache = {}
        self._rng = random.Random(1234)
        self.bitinho = {}
        self._gerar_bitinho()
        self._gerar_inimigos()
        self._gerar_itens()
        self._gerar_objetos()
        self.tiles = {}

    # ===================================================================
    # Bitinho, o robo-Arduino (protagonista)
    # ===================================================================
    def _desenhar_bitinho(self, estado, frame, cor_corpo=cfg.AZUL_ARDUINO):
        w, h = 32, 38
        s = _surf(w, h)
        cx = w // 2
        base = h - 1
        bob = 0
        perna_e = 0
        perna_d = 0
        braco = 0
        squash = 0
        if estado == "parado":
            bob = 1 if frame % 2 else 0
        elif estado == "correr":
            ciclo = [(-3, 3), (0, 0), (3, -3), (0, 0)]
            perna_e, perna_d = ciclo[frame % 4]
            bob = 1 if frame % 2 == 1 else 0
            braco = ciclo[frame % 4][0]
        elif estado == "pular":
            perna_e, perna_d = -2, 2
            squash = -2
        elif estado == "cair":
            perna_e, perna_d = 2, -2
            squash = 1
        elif estado == "dash":
            perna_e, perna_d = -4, -4
        elif estado == "parede":
            perna_e, perna_d = 1, -1
        elif estado == "dano":
            perna_e, perna_d = 3, -3
        elif estado == "vitoria":
            perna_e, perna_d = -1, 1
            braco = -6

        # Pernas (fios com pezinhos)
        topo_pernas = base - 8
        cor_fio = (30, 30, 34)
        pygame.draw.line(s, cor_fio, (cx - 4, topo_pernas), (cx - 5 + perna_e, base - 2), 2)
        pygame.draw.line(s, cor_fio, (cx + 4, topo_pernas), (cx + 5 + perna_d, base - 2), 2)
        pygame.draw.rect(s, cfg.CINZA_CLARO, (cx - 8 + perna_e, base - 3, 6, 3), border_radius=1)
        pygame.draw.rect(s, cfg.CINZA_CLARO, (cx + 2 + perna_d, base - 3, 6, 3), border_radius=1)

        # Corpo = placa Arduino
        corpo_h = 16 - squash
        corpo_y = topo_pernas - corpo_h + bob
        corpo = pygame.Rect(cx - 11, corpo_y, 22, corpo_h)
        pygame.draw.rect(s, cor_corpo, corpo, border_radius=3)
        claro = lerp_cor(cor_corpo, (255, 255, 255), 0.35)
        escuro = lerp_cor(cor_corpo, (0, 0, 0), 0.4)
        pygame.draw.line(s, claro, (corpo.left + 2, corpo.top + 1), (corpo.right - 3, corpo.top + 1))
        pygame.draw.line(s, escuro, (corpo.left + 2, corpo.bottom - 1), (corpo.right - 3, corpo.bottom - 1))
        # Barramento de pinos (headers)
        pygame.draw.rect(s, (20, 20, 22), (corpo.left + 3, corpo.top + 3, 16, 3))
        for i in range(8):
            s.set_at((corpo.left + 4 + i * 2, corpo.top + 4), cfg.OURO)
        # Chip ATmega
        pygame.draw.rect(s, (24, 24, 28), (corpo.left + 6, corpo.top + 8, 10, 5))
        # Porta USB (mochila)
        pygame.draw.rect(s, (170, 176, 186), (corpo.left - 3, corpo.top + 7, 5, 6))
        pygame.draw.rect(s, (110, 114, 124), (corpo.left - 3, corpo.top + 9, 2, 2))
        # LED de power no corpo
        pygame.draw.circle(s, cfg.VERDE_LED, (corpo.right - 4, corpo.top + 9), 1)
        # Bracos
        pygame.draw.line(s, cor_fio, (corpo.right - 1, corpo.top + 8),
                         (corpo.right + 4, corpo.top + 11 + braco), 2)
        pygame.draw.line(s, cor_fio, (corpo.left, corpo.top + 8),
                         (corpo.left - 4, corpo.top + 12 - braco // 2), 2)

        # Cabeca (visor)
        cab_y = corpo_y - 12
        cab = pygame.Rect(cx - 9, cab_y, 18, 12)
        pygame.draw.rect(s, (230, 234, 240), cab, border_radius=4)
        pygame.draw.rect(s, (160, 166, 176), cab, 1, border_radius=4)
        visor = pygame.Rect(cab.x + 2, cab.y + 3, 14, 7)
        pygame.draw.rect(s, (16, 22, 30), visor, border_radius=2)
        # Olhos
        if estado == "dano":
            cor_olho = cfg.VERMELHO
            pygame.draw.line(s, cor_olho, (visor.x + 3, visor.y + 2), (visor.x + 5, visor.y + 4))
            pygame.draw.line(s, cor_olho, (visor.x + 5, visor.y + 2), (visor.x + 3, visor.y + 4))
            pygame.draw.line(s, cor_olho, (visor.x + 9, visor.y + 2), (visor.x + 11, visor.y + 4))
            pygame.draw.line(s, cor_olho, (visor.x + 11, visor.y + 2), (visor.x + 9, visor.y + 4))
        elif estado == "vitoria":
            cor_olho = cfg.VERDE_LED
            pygame.draw.arc(s, cor_olho, (visor.x + 2, visor.y + 2, 5, 4), 0, math.pi, 1)
            pygame.draw.arc(s, cor_olho, (visor.x + 8, visor.y + 2, 5, 4), 0, math.pi, 1)
        else:
            piscar = estado == "parado" and frame == 3
            cor_olho = cfg.CIANO
            if piscar:
                pygame.draw.line(s, cor_olho, (visor.x + 3, visor.y + 4), (visor.x + 6, visor.y + 4))
                pygame.draw.line(s, cor_olho, (visor.x + 9, visor.y + 4), (visor.x + 12, visor.y + 4))
            else:
                pygame.draw.rect(s, cor_olho, (visor.x + 4, visor.y + 2, 3, 3))
                pygame.draw.rect(s, cor_olho, (visor.x + 9, visor.y + 2, 3, 3))
        # Antena com LED
        pygame.draw.line(s, (60, 60, 66), (cx + 2, cab.top), (cx + 4, cab.top - 5), 1)
        cor_led = cfg.VERMELHO if estado != "vitoria" else cfg.VERDE_LED
        pygame.draw.circle(s, cor_led, (cx + 4, cab.top - 6), 2)
        return _contorno(s, (10, 12, 16, 255))

    def _gerar_bitinho(self):
        estados = {"parado": 4, "correr": 4, "pular": 1, "cair": 1, "dash": 1,
                   "parede": 1, "dano": 1, "vitoria": 1}
        for estado, n in estados.items():
            quadros = [self._desenhar_bitinho(estado, i) for i in range(n)]
            self.bitinho[estado] = quadros
            self.bitinho[estado + "_esq"] = [pygame.transform.flip(q, True, False) for q in quadros]
        # Versao dourada para o modo "turbo" (upgrade de escudo ativo)
        self.bitinho_escudo = self._desenhar_bitinho("parado", 0, cfg.OURO_ESCURO)

    def quadro_bitinho(self, estado, frame, direcao):
        chave = estado if direcao >= 0 else estado + "_esq"
        lista = self.bitinho.get(chave) or self.bitinho["parado"]
        return lista[frame % len(lista)]

    # ===================================================================
    # Inimigos
    # ===================================================================
    def _gerar_inimigos(self):
        self.bug = [self._desenhar_bug(i) for i in range(2)]
        self.bug_esq = [pygame.transform.flip(b, True, False) for b in self.bug]
        self.glitch = [self._desenhar_glitch(i) for i in range(4)]
        self.torreta = [self._desenhar_torreta(i) for i in range(2)]
        self.saltador = [self._desenhar_saltador(i) for i in range(3)]
        self.drone = [self._desenhar_drone(i) for i in range(2)]
        self.virus = [self._desenhar_virus(i, 26) for i in range(2)]
        self.virus_pequeno = [self._desenhar_virus(i, 16) for i in range(2)]
        self.minhoca = [self._desenhar_minhoca(i) for i in range(2)]

    def _desenhar_bug(self, frame):
        s = _surf(30, 22)
        # patas
        for i in range(3):
            x = 8 + i * 7
            d = 2 if (i + frame) % 2 == 0 else -2
            pygame.draw.line(s, (30, 20, 30), (x, 14), (x + d, 20), 2)
        # casco
        pygame.draw.ellipse(s, (150, 40, 80), (4, 4, 22, 14))
        pygame.draw.ellipse(s, (200, 70, 120), (6, 5, 18, 7))
        pygame.draw.line(s, (90, 20, 50), (15, 5), (15, 17), 1)
        # manchas de "erro"
        pygame.draw.circle(s, (40, 10, 30), (10, 11), 2)
        pygame.draw.circle(s, (40, 10, 30), (20, 12), 2)
        # cabeca
        pygame.draw.circle(s, (60, 20, 50), (26, 12), 4)
        pygame.draw.circle(s, cfg.AMARELO, (27, 11), 1)
        # antenas
        pygame.draw.line(s, (60, 20, 50), (27, 8), (29, 2 + frame), 1)
        pygame.draw.line(s, (60, 20, 50), (25, 8), (24, 1 + frame), 1)
        return _contorno(s)

    def _desenhar_glitch(self, frame):
        s = _surf(30, 30)
        rng = random.Random(frame * 99)
        deslocamentos = [(-2, 0), (2, 0), (0, 0)]
        cores = [(255, 0, 80, 150), (0, 200, 255, 150), (240, 240, 255, 255)]
        for (dx, dy), cor in zip(deslocamentos, cores):
            pygame.draw.rect(s, cor, (5 + dx, 5 + dy, 20, 20), border_radius=3)
        # "pixels" quebrados
        for _ in range(7):
            x, y = rng.randint(3, 25), rng.randint(3, 25)
            pygame.draw.rect(s, rng.choice([(255, 0, 80), (0, 255, 160), (20, 20, 20)]), (x, y, 3, 2))
        # olhos
        pygame.draw.rect(s, (10, 10, 20), (10, 11, 3, 5))
        pygame.draw.rect(s, (10, 10, 20), (17, 11, 3, 5))
        pygame.draw.line(s, (10, 10, 20), (10, 20), (20, 19 + (frame % 2) * 2), 2)
        return s

    def _desenhar_torreta(self, frame):
        s = _surf(30, 32)
        # base (encapsulamento TO-220)
        pygame.draw.rect(s, (30, 30, 36), (5, 14, 20, 16), border_radius=2)
        pygame.draw.rect(s, (160, 164, 172), (7, 8, 16, 8))
        pygame.draw.circle(s, (80, 84, 92), (15, 12), 2)
        for i in range(3):
            pygame.draw.line(s, cfg.CINZA_CLARO, (9 + i * 6, 29), (9 + i * 6, 31), 2)
        # bobina tesla no topo
        pygame.draw.circle(s, cfg.COBRE, (15, 6), 5)
        pygame.draw.circle(s, cfg.COBRE_CLARO, (14, 5), 2)
        # olho
        cor = cfg.VERMELHO if frame == 0 else cfg.AMARELO
        pygame.draw.circle(s, cor, (15, 22), 3)
        return _contorno(s)

    def _desenhar_saltador(self, frame):
        # capacitor eletrolitico que pula (frames: normal, agachado, esticado)
        s = _surf(26, 34)
        alturas = [22, 16, 26]
        larguras = [18, 22, 15]
        hh, ww = alturas[frame], larguras[frame]
        x = 13 - ww // 2
        y = 30 - hh
        pygame.draw.rect(s, (40, 70, 170), (x, y, ww, hh), border_radius=5)
        pygame.draw.rect(s, (140, 160, 220), (x + ww - 5, y + 2, 3, hh - 4))
        pygame.draw.line(s, (200, 210, 240), (x + ww - 4, y + 5), (x + ww - 4, y + 7))
        pygame.draw.ellipse(s, (180, 186, 196), (x, y - 2, ww, 5))
        pygame.draw.line(s, (100, 104, 112), (13, y - 1), (13, y + 1))
        # olhos bravos
        pygame.draw.rect(s, cfg.BRANCO, (x + 3, y + 6, 4, 4))
        pygame.draw.rect(s, cfg.BRANCO, (x + 9, y + 6, 4, 4))
        pygame.draw.rect(s, (0, 0, 0), (x + 5, y + 7, 2, 2))
        pygame.draw.rect(s, (0, 0, 0), (x + 11, y + 7, 2, 2))
        pygame.draw.line(s, (0, 0, 0), (x + 2, y + 4), (x + 7, y + 6))
        pygame.draw.line(s, (0, 0, 0), (x + 14, y + 4), (x + 9, y + 6))
        # terminais (pernas)
        pygame.draw.line(s, cfg.CINZA_CLARO, (10, 30), (9, 33), 2)
        pygame.draw.line(s, cfg.CINZA_CLARO, (16, 30), (17, 33), 2)
        return _contorno(s)

    def _desenhar_drone(self, frame):
        s = _surf(40, 22)
        pygame.draw.rect(s, (50, 54, 66), (12, 8, 16, 8), border_radius=3)
        pygame.draw.line(s, (80, 84, 96), (4, 8), (36, 8), 2)
        for x in (4, 36):
            if frame == 0:
                pygame.draw.line(s, (200, 200, 210), (x - 6, 5), (x + 6, 5), 2)
            else:
                pygame.draw.line(s, (200, 200, 210), (x - 3, 4), (x + 3, 6), 2)
            pygame.draw.line(s, (80, 84, 96), (x, 5), (x, 9), 2)
        pygame.draw.circle(s, cfg.VERMELHO, (20, 14), 3)
        pygame.draw.circle(s, (255, 200, 200), (19, 13), 1)
        pygame.draw.line(s, (80, 84, 96), (14, 16), (12, 20), 1)
        pygame.draw.line(s, (80, 84, 96), (26, 16), (28, 20), 1)
        return _contorno(s)

    def _desenhar_virus(self, frame, tam):
        s = _surf(tam + 8, tam + 8)
        c = (tam + 8) // 2
        r = tam // 2 - 2
        n = 8
        for i in range(n):
            a = i / n * math.tau + frame * 0.2
            x1 = c + math.cos(a) * r
            y1 = c + math.sin(a) * r
            x2 = c + math.cos(a) * (r + 5)
            y2 = c + math.sin(a) * (r + 5)
            pygame.draw.line(s, (60, 180, 60), (x1, y1), (x2, y2), 2)
            pygame.draw.circle(s, (120, 240, 90), (int(x2), int(y2)), 2)
        pygame.draw.circle(s, (70, 200, 70), (c, c), r)
        pygame.draw.circle(s, (130, 240, 110), (c - r // 3, c - r // 3), max(2, r // 3))
        pygame.draw.circle(s, (20, 40, 20), (c - r // 3, c), max(1, r // 5))
        pygame.draw.circle(s, (20, 40, 20), (c + r // 3, c), max(1, r // 5))
        pygame.draw.arc(s, (20, 40, 20), (c - r // 2, c, r, r // 2), math.pi, math.tau, 1)
        return _contorno(s)

    def _desenhar_minhoca(self, frame):
        # "Fio desencapado" que rasteja
        s = _surf(34, 14)
        for i in range(5):
            x = 4 + i * 6
            y = 8 + int(math.sin(i + frame * 1.5) * 2)
            pygame.draw.circle(s, (220, 60, 40) if i % 2 else (240, 120, 40), (x, y), 4)
        pygame.draw.circle(s, cfg.COBRE_CLARO, (31, 8), 3)
        pygame.draw.line(s, cfg.AMARELO, (33, 6), (34, 3))
        return _contorno(s)

    # ===================================================================
    # Itens coletaveis
    # ===================================================================
    def _gerar_itens(self):
        self.byte = [self._desenhar_byte(i, 16, False) for i in range(8)]
        self.byte_grande = [self._desenhar_byte(i, 24, True) for i in range(8)]
        self.componentes = [self._desenhar_resistor(), self._desenhar_led_item(),
                            self._desenhar_capacitor_item()]
        self.bateria = self._desenhar_bateria()
        self.gota_solda = self._desenhar_gota(cfg.CINZA_CLARO, 6)
        self.faisca = self._desenhar_gota(cfg.AMARELO, 5)
        self.bolha_virus = self._desenhar_gota((100, 240, 90), 7)
        self.bit_zero = render_texto("0", 18, cfg.VERDE_LED, mono=True, negrito=True)
        self.bit_um = render_texto("1", 18, cfg.VERDE_LED, mono=True, negrito=True)
        self.chip_upgrade = self._desenhar_chip_upgrade()

    def _desenhar_byte(self, frame, tam, grande):
        # moeda que gira: escala horizontal senoidal
        base = _surf(tam, tam)
        cor = cfg.OURO if not grande else cfg.CIANO
        escura = cfg.OURO_ESCURO if not grande else (0, 120, 160)
        pygame.draw.circle(base, escura, (tam // 2, tam // 2), tam // 2)
        pygame.draw.circle(base, cor, (tam // 2 - 1, tam // 2 - 1), tam // 2 - 2)
        # pinos de chip em volta
        txt = "FF" if grande else "1"
        img = render_texto(txt, 11 if grande else 10, escura, mono=True, negrito=True)
        base.blit(img, img.get_rect(center=(tam // 2 - 1, tam // 2)))
        esc = abs(math.cos(frame / 8 * math.pi))
        w = max(2, int(tam * esc))
        img = pygame.transform.smoothscale(base, (w, tam))
        s = _surf(tam, tam)
        s.blit(img, ((tam - w) // 2, 0))
        return s

    def _desenhar_resistor(self):
        s = _surf(30, 14)
        pygame.draw.line(s, cfg.CINZA_CLARO, (0, 7), (30, 7), 2)
        pygame.draw.rect(s, (220, 190, 140), (7, 2, 16, 10), border_radius=4)
        for x, cor in ((10, (200, 40, 40)), (13, (200, 40, 40)), (16, (120, 70, 30)),
                       (20, cfg.OURO)):
            pygame.draw.line(s, cor, (x, 2), (x, 11), 2)
        return _contorno(s)

    def _desenhar_led_item(self):
        s = _surf(18, 28)
        pygame.draw.line(s, cfg.CINZA_CLARO, (6, 16), (6, 27), 2)
        pygame.draw.line(s, cfg.CINZA_CLARO, (12, 16), (12, 24), 2)
        pygame.draw.rect(s, (230, 40, 40), (3, 5, 12, 12))
        pygame.draw.circle(s, (230, 40, 40), (9, 6), 6)
        pygame.draw.rect(s, (200, 30, 30), (2, 15, 14, 3))
        pygame.draw.circle(s, (255, 170, 170), (7, 6), 2)
        return _contorno(s)

    def _desenhar_capacitor_item(self):
        s = _surf(18, 28)
        pygame.draw.line(s, cfg.CINZA_CLARO, (6, 20), (6, 27), 2)
        pygame.draw.line(s, cfg.CINZA_CLARO, (12, 20), (12, 27), 2)
        pygame.draw.rect(s, (40, 70, 170), (2, 3, 14, 18), border_radius=4)
        pygame.draw.rect(s, (160, 170, 220), (11, 5, 3, 14))
        pygame.draw.ellipse(s, (190, 196, 206), (2, 1, 14, 5))
        return _contorno(s)

    def _desenhar_bateria(self):
        s = _surf(16, 24)
        pygame.draw.rect(s, (150, 154, 160), (5, 0, 6, 3))
        pygame.draw.rect(s, (40, 40, 46), (1, 3, 14, 20), border_radius=2)
        pygame.draw.rect(s, cfg.VERDE_LED, (3, 11, 10, 10))
        pygame.draw.rect(s, (160, 255, 170), (3, 11, 10, 2))
        pygame.draw.line(s, cfg.BRANCO, (8, 5), (8, 9), 2)
        pygame.draw.line(s, cfg.BRANCO, (6, 7), (10, 7), 2)
        return _contorno(s)

    def _desenhar_gota(self, cor, raio):
        s = _surf(raio * 2 + 2, raio * 2 + 2)
        pygame.draw.circle(s, lerp_cor(cor, (0, 0, 0), 0.3), (raio + 1, raio + 1), raio)
        pygame.draw.circle(s, cor, (raio, raio), raio - 1)
        pygame.draw.circle(s, (255, 255, 255), (raio - 2, raio - 2), max(1, raio // 3))
        return s

    def _desenhar_chip_upgrade(self):
        s = _surf(28, 28)
        pygame.draw.rect(s, (24, 24, 30), (4, 4, 20, 20), border_radius=2)
        for i in range(4):
            for lado in range(4):
                if lado == 0:
                    pygame.draw.rect(s, cfg.CINZA_CLARO, (6 + i * 5, 1, 2, 3))
                elif lado == 1:
                    pygame.draw.rect(s, cfg.CINZA_CLARO, (6 + i * 5, 24, 2, 3))
                elif lado == 2:
                    pygame.draw.rect(s, cfg.CINZA_CLARO, (1, 6 + i * 5, 3, 2))
                else:
                    pygame.draw.rect(s, cfg.CINZA_CLARO, (24, 6 + i * 5, 3, 2))
        pygame.draw.circle(s, (60, 60, 70), (8, 8), 2)
        return s

    # ===================================================================
    # Objetos de cenario interativos
    # ===================================================================
    def _gerar_objetos(self):
        self.checkpoint_off = self._desenhar_checkpoint(False)
        self.checkpoint_on = self._desenhar_checkpoint(True)
        self.saida = [self._desenhar_saida(i) for i in range(4)]
        self.terminal = [self._desenhar_terminal(i, False) for i in range(2)]
        self.terminal_ok = [self._desenhar_terminal(i, True) for i in range(2)]
        self.quiz = [self._desenhar_quiz(i) for i in range(2)]
        self.mola = [self._desenhar_mola(0), self._desenhar_mola(1)]
        self.quebravel = self._desenhar_quebravel()
        self.prof_volt = [self._desenhar_prof_volt(i) for i in range(2)]
        self.plataforma_movel = self._desenhar_plataforma_movel()
        self.upgrade_estacao = self._desenhar_estacao()

    def _desenhar_checkpoint(self, ativo):
        s = _surf(20, 56)
        pygame.draw.rect(s, (70, 74, 84), (8, 14, 4, 42))
        pygame.draw.rect(s, (40, 44, 50), (2, 50, 16, 6), border_radius=2)
        cor = cfg.VERDE_LED if ativo else (120, 30, 30)
        pygame.draw.circle(s, cor, (10, 9), 8)
        pygame.draw.circle(s, lerp_cor(cor, (255, 255, 255), 0.6), (8, 6), 3)
        pygame.draw.rect(s, (160, 160, 170), (5, 14, 10, 3))
        return _contorno(s)

    def _desenhar_saida(self, frame):
        # Porta USB gigante: o "upload" do nivel
        s = _surf(56, 80)
        pygame.draw.rect(s, (170, 176, 188), (4, 8, 48, 72), border_radius=4)
        pygame.draw.rect(s, (110, 116, 128), (4, 8, 48, 72), 3, border_radius=4)
        pygame.draw.rect(s, (20, 24, 30), (12, 18, 32, 56), border_radius=2)
        # setas animadas
        for i in range(3):
            y = 66 - ((i * 16 + frame * 4) % 48)
            cor = lerp_cor(cfg.AZUL_ARDUINO_CLARO, cfg.BRANCO, i / 3)
            pygame.draw.polygon(s, cor, [(28, y - 6), (20, y + 2), (36, y + 2)])
        # simbolo USB no topo
        pygame.draw.line(s, cfg.BRANCO, (28, 0), (28, 8), 2)
        pygame.draw.circle(s, cfg.BRANCO, (28, 2), 2)
        return s

    def _desenhar_terminal(self, frame, resolvido):
        s = _surf(36, 40)
        pygame.draw.rect(s, (60, 64, 74), (14, 30, 8, 6))
        pygame.draw.rect(s, (40, 44, 52), (8, 35, 20, 4), border_radius=1)
        pygame.draw.rect(s, (200, 204, 212), (1, 2, 34, 28), border_radius=3)
        tela = (0, 30, 20) if resolvido else (10, 14, 30)
        pygame.draw.rect(s, tela, (4, 5, 28, 21))
        cor_codigo = cfg.VERDE_LED if resolvido else cfg.AZUL_ARDUINO_CLARO
        for i, w in enumerate((18, 12, 20, 8)):
            pygame.draw.line(s, cor_codigo, (7, 8 + i * 4), (7 + w, 8 + i * 4), 1)
        if frame == 0 and not resolvido:
            pygame.draw.rect(s, cfg.BRANCO, (7, 22, 4, 2))
        return _contorno(s)

    def _desenhar_quiz(self, frame):
        s = _surf(36, 40)
        pygame.draw.rect(s, (60, 64, 74), (14, 30, 8, 6))
        pygame.draw.rect(s, (40, 44, 52), (8, 35, 20, 4), border_radius=1)
        pygame.draw.rect(s, cfg.AZUL_ARDUINO, (1, 2, 34, 28), border_radius=3)
        pygame.draw.rect(s, (8, 30, 34), (4, 5, 28, 21))
        img = render_texto("?", 18 if frame == 0 else 16, cfg.AMARELO, negrito=True)
        s.blit(img, img.get_rect(center=(18, 16)))
        return _contorno(s)

    def _desenhar_mola(self, comprimida):
        s = _surf(32, 18)
        pygame.draw.rect(s, (60, 64, 72), (2, 14, 28, 4), border_radius=1)
        altura = 6 if comprimida else 12
        topo = 14 - altura
        n = 4
        for i in range(n):
            y1 = 14 - i * altura / n
            y2 = 14 - (i + 0.5) * altura / n
            y3 = 14 - (i + 1) * altura / n
            pygame.draw.line(s, cfg.CINZA_CLARO, (8, y1), (24, y2), 2)
            pygame.draw.line(s, cfg.CINZA_CLARO, (24, y2), (8, y3), 2)
        pygame.draw.rect(s, cfg.VERMELHO, (4, topo - 3, 24, 4), border_radius=2)
        return _contorno(s)

    def _desenhar_quebravel(self):
        s = _surf(32, 32)
        pygame.draw.rect(s, (70, 60, 50), (0, 0, 32, 32))
        pygame.draw.rect(s, (110, 94, 76), (2, 2, 28, 28))
        pygame.draw.rect(s, (24, 24, 30), (7, 7, 18, 18))
        for i in range(4):
            pygame.draw.line(s, cfg.CINZA_CLARO, (9 + i * 4, 4), (9 + i * 4, 6))
            pygame.draw.line(s, cfg.CINZA_CLARO, (9 + i * 4, 26), (9 + i * 4, 28))
        # rachaduras
        pygame.draw.lines(s, (20, 16, 12), False, [(3, 12), (9, 15), (14, 11), (20, 18), (29, 16)], 1)
        pygame.draw.lines(s, (20, 16, 12), False, [(15, 29), (17, 22), (13, 18)], 1)
        return s

    def _desenhar_prof_volt(self, frame):
        # Multimetro falante, o mentor
        s = _surf(34, 48)
        pygame.draw.rect(s, (240, 190, 30), (3, 4, 28, 40), border_radius=5)
        pygame.draw.rect(s, (200, 150, 20), (3, 4, 28, 40), 2, border_radius=5)
        pygame.draw.rect(s, (160, 200, 150), (7, 8, 20, 12), border_radius=2)
        # rosto no display
        pygame.draw.rect(s, (30, 50, 30), (11, 11, 3, 3 if frame == 0 else 1))
        pygame.draw.rect(s, (30, 50, 30), (20, 11, 3, 3 if frame == 0 else 1))
        pygame.draw.arc(s, (30, 50, 30), (12, 13, 10, 5), math.pi, math.tau, 1)
        # seletor
        pygame.draw.circle(s, (40, 40, 44), (17, 29), 6)
        pygame.draw.line(s, cfg.BRANCO, (17, 29), (20, 25), 2)
        # entradas
        pygame.draw.circle(s, cfg.VERMELHO, (10, 40), 2)
        pygame.draw.circle(s, (20, 20, 20), (24, 40), 2)
        # pontas de prova (bracos)
        pygame.draw.line(s, cfg.VERMELHO, (3, 24), (0, 34 - frame * 2), 2)
        pygame.draw.line(s, (20, 20, 20), (31, 24), (33, 34 - (1 - frame) * 2), 2)
        # oculos de professor
        pygame.draw.circle(s, (30, 30, 30), (12, 12), 4, 1)
        pygame.draw.circle(s, (30, 30, 30), (22, 12), 4, 1)
        return _contorno(s)

    def _desenhar_plataforma_movel(self):
        s = _surf(96, 16)
        pygame.draw.rect(s, (60, 64, 72), (0, 0, 96, 16), border_radius=3)
        pygame.draw.rect(s, (110, 116, 128), (2, 2, 92, 5), border_radius=2)
        for i in range(6):
            pygame.draw.circle(s, cfg.AMARELO if i % 2 else (40, 40, 40), (10 + i * 15, 11), 3)
        return _contorno(s)

    def _desenhar_estacao(self):
        s = _surf(40, 48)
        pygame.draw.rect(s, (50, 54, 64), (2, 10, 36, 38), border_radius=4)
        pygame.draw.rect(s, cfg.AZUL_ARDUINO, (6, 14, 28, 18), border_radius=2)
        img = render_texto("LOJA", 11, cfg.BRANCO, negrito=True)
        s.blit(img, img.get_rect(center=(20, 23)))
        pygame.draw.circle(s, cfg.VERDE_LED, (12, 40), 3)
        pygame.draw.circle(s, cfg.AMARELO, (20, 40), 3)
        pygame.draw.circle(s, cfg.VERMELHO, (28, 40), 3)
        return _contorno(s)

    # ===================================================================
    # Tiles (gerados sob demanda por tema)
    # ===================================================================
    def tile(self, tipo, tema, variante=0):
        chave = (tipo, tema, variante)
        if chave in self.tiles:
            return self.tiles[chave]
        func = {
            "solido": self._tile_solido,
            "plataforma": self._tile_plataforma,
            "espinho": self._tile_espinho,
            "lava": self._tile_lava,
            "esteira_d": self._tile_esteira,
            "esteira_e": self._tile_esteira,
            "decoracao": self._tile_decoracao,
        }[tipo]
        if tipo.startswith("esteira"):
            img = func(tema, variante, 1 if tipo == "esteira_d" else -1)
        else:
            img = func(tema, variante)
        self.tiles[chave] = img
        return img

    def _tile_solido(self, tema, variante):
        """variante: bit 0 = topo exposto, bits 1..3 = semente de detalhe."""
        T = cfg.TILE
        s = pygame.Surface((T, T))
        info = cfg.TEMAS_MUNDO[tema]
        cor = info["tile"]
        borda = info["tile_borda"]
        det = info["detalhe"]
        topo = variante & 1
        rng = random.Random(variante * 7919 + tema * 31)
        s.fill(cor)
        if tema == 0:  # madeira da bancada
            for i in range(4):
                y = rng.randint(2, T - 3)
                pygame.draw.line(s, lerp_cor(cor, borda, 0.6), (0, y), (T, y + rng.randint(-2, 2)))
            if rng.random() < 0.3:
                pygame.draw.circle(s, borda, (rng.randint(6, 26), rng.randint(8, 26)), 3, 1)
            if topo:
                pygame.draw.rect(s, info["detalhe"], (0, 0, T, 5))
                pygame.draw.line(s, lerp_cor(det, (255, 255, 255), 0.3), (0, 0), (T, 0), 2)
        elif tema == 1:  # protoboard
            for gx in range(4):
                for gy in range(4):
                    pygame.draw.rect(s, (70, 70, 76), (4 + gx * 7, 5 + gy * 7, 3, 3))
            pygame.draw.line(s, borda, (0, T - 1), (T, T - 1))
            if topo:
                pygame.draw.rect(s, BEGE_CLARO, (0, 0, T, 4))
                pygame.draw.line(s, cfg.VERMELHO, (0, 1), (T, 1), 1)
                pygame.draw.line(s, (40, 80, 200), (0, 3), (T, 3), 1)
        elif tema == 2:  # PCB
            for _ in range(2):
                y = rng.randint(4, T - 4)
                x = rng.randint(0, 10)
                pontos = [(0, y), (x + 8, y), (x + 14, y + rng.choice((-6, 6))), (T, y + rng.choice((-6, 6)))]
                pygame.draw.lines(s, lerp_cor(det, cor, 0.35), False, pontos, 2)
            if rng.random() < 0.5:
                p = (rng.randint(6, 26), rng.randint(8, 26))
                pygame.draw.circle(s, det, p, 3)
                pygame.draw.circle(s, borda, p, 1)
            if topo:
                pygame.draw.rect(s, cfg.VERDE_PCB_CLARO, (0, 0, T, 4))
                pygame.draw.line(s, cfg.BRANCO, (0, 5), (T, 5), 1)
        elif tema == 3:  # rack de servidor na nuvem
            pygame.draw.rect(s, borda, (0, 0, T, T), 2)
            for i in range(3):
                y = 6 + i * 9
                pygame.draw.rect(s, (40, 44, 70), (4, y, 24, 6))
                cor_led = rng.choice([cfg.CIANO, cfg.VERDE_LED, (60, 70, 110)])
                pygame.draw.rect(s, cor_led, (24, y + 2, 2, 2))
            if topo:
                pygame.draw.rect(s, (150, 160, 220), (0, 0, T, 3))
        pygame.draw.line(s, borda, (0, T - 1), (T, T - 1))
        pygame.draw.line(s, lerp_cor(borda, cor, 0.5), (T - 1, 0), (T - 1, T))
        return s

    def _tile_plataforma(self, tema, variante):
        T = cfg.TILE
        s = _surf(T, T)
        info = cfg.TEMAS_MUNDO[tema]
        pygame.draw.rect(s, info["tile_borda"], (0, 0, T, 10))
        pygame.draw.rect(s, info["tile"], (0, 0, T, 7))
        pygame.draw.line(s, info["detalhe"], (2, 3), (T - 3, 3), 1)
        # suportes
        pygame.draw.line(s, info["tile_borda"], (4, 10), (4, 16), 2)
        pygame.draw.line(s, info["tile_borda"], (T - 5, 10), (T - 5, 16), 2)
        return s

    def _tile_espinho(self, tema, variante):
        # Pinos de header dourados, afiados!
        T = cfg.TILE
        s = _surf(T, T)
        pygame.draw.rect(s, (24, 24, 28), (0, T - 8, T, 8))
        for i in range(4):
            x = 4 + i * 8
            pygame.draw.polygon(s, cfg.OURO, [(x - 3, T - 8), (x, T - 22), (x + 3, T - 8)])
            pygame.draw.line(s, (255, 250, 200), (x - 1, T - 10), (x, T - 20), 1)
        return s

    def _tile_lava(self, tema, frame):
        # Solda derretida borbulhante
        T = cfg.TILE
        s = _surf(T, T)
        pygame.draw.rect(s, (160, 164, 176), (0, 6, T, T - 6))
        for x in range(0, T, 2):
            y = 6 + int(math.sin((x + frame * 4) * 0.4) * 2)
            pygame.draw.line(s, (220, 224, 236), (x, y), (x, y + 2))
            pygame.draw.line(s, (255, 150, 40), (x, y + 3), (x, y + 4))
        rng = random.Random(frame)
        for _ in range(2):
            pygame.draw.circle(s, (230, 234, 244), (rng.randint(4, 28), rng.randint(12, 28)), 2, 1)
        return s

    def _tile_esteira(self, tema, frame, direcao):
        T = cfg.TILE
        s = pygame.Surface((T, T))
        s.fill((50, 54, 62))
        pygame.draw.rect(s, (30, 32, 38), (0, 0, T, 8))
        for i in range(-1, 5):
            x = (i * 10 + frame * 2 * direcao) % (T + 10) - 5
            pts = [(x, 1), (x + 4 * direcao, 4), (x, 7)]
            pygame.draw.lines(s, cfg.AMARELO, False, pts, 2)
        pygame.draw.circle(s, (90, 94, 104), (8, 20), 6)
        pygame.draw.circle(s, (90, 94, 104), (24, 20), 6)
        return s

    def _tile_decoracao(self, tema, variante):
        """Pequenos componentes enfeitando o cenario (nao colidem)."""
        T = cfg.TILE
        s = _surf(T, T)
        rng = random.Random(variante * 13 + tema)
        tipo = variante % 5
        if tipo == 0:  # resistor espetado
            pygame.draw.line(s, cfg.CINZA_CLARO, (10, T), (10, 16), 1)
            pygame.draw.line(s, cfg.CINZA_CLARO, (22, T), (22, 16), 1)
            pygame.draw.rect(s, (220, 190, 140), (8, 10, 16, 8), border_radius=3)
            pygame.draw.line(s, cfg.VERMELHO, (12, 10), (12, 17), 2)
            pygame.draw.line(s, (120, 70, 30), (17, 10), (17, 17), 2)
        elif tipo == 1:  # LED aceso
            cor = rng.choice([cfg.VERMELHO, cfg.VERDE_LED, cfg.AMARELO, cfg.CIANO])
            pygame.draw.line(s, cfg.CINZA_CLARO, (13, T), (13, 20), 1)
            pygame.draw.line(s, cfg.CINZA_CLARO, (19, T), (19, 22), 1)
            pygame.draw.rect(s, cor, (11, 12, 10, 9))
            pygame.draw.circle(s, cor, (16, 12), 5)
        elif tipo == 2:  # fio jumper
            cor = rng.choice([cfg.VERMELHO, (40, 80, 200), cfg.AMARELO, (30, 30, 30)])
            pygame.draw.arc(s, cor, (4, 8, 24, 40), 0, math.pi, 3)
        elif tipo == 3:  # botao tactil
            pygame.draw.rect(s, (30, 30, 34), (8, 20, 16, 12))
            pygame.draw.circle(s, (80, 80, 90), (16, 22), 5)
        else:  # potenciometro
            pygame.draw.rect(s, (40, 80, 200), (8, 18, 16, 14), border_radius=2)
            pygame.draw.circle(s, cfg.BRANCO, (16, 25), 4)
            pygame.draw.line(s, (40, 40, 40), (16, 25), (18, 22), 1)
        return s


BEGE_CLARO = (248, 244, 232)
