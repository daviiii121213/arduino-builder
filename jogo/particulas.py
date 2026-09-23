"""
Sistema de particulas: faiscas de solda, fumaca, bits voando, explosoes,
textos flutuantes ("+10 bytes") e rastros de dash.
"""

import math
import random

import pygame

import config as cfg
from util import brilho_cache, render_texto, lerp_cor


class Particula:
    __slots__ = ("x", "y", "vx", "vy", "vida", "vida_max", "cor", "cor_final", "tam",
                 "gravidade", "atrito", "tipo", "brilho", "giro", "angulo", "texto", "encolher")

    def __init__(self, x, y, vx, vy, vida, cor, tam=3, gravidade=0.0, atrito=1.0,
                 tipo="quadrado", brilho=False, cor_final=None, texto=None, encolher=True):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.vida = vida
        self.vida_max = vida
        self.cor = cor
        self.cor_final = cor_final or cor
        self.tam = tam
        self.gravidade = gravidade
        self.atrito = atrito
        self.tipo = tipo
        self.brilho = brilho
        self.giro = random.uniform(-0.2, 0.2)
        self.angulo = random.uniform(0, math.tau)
        self.texto = texto
        self.encolher = encolher

    def atualizar(self):
        self.vy += self.gravidade
        self.vx *= self.atrito
        self.vy *= self.atrito
        self.x += self.vx
        self.y += self.vy
        self.angulo += self.giro
        self.vida -= 1
        return self.vida > 0


class SistemaParticulas:
    LIMITE = 900

    def __init__(self):
        self.particulas = []
        self.textos = []

    def limpar(self):
        self.particulas.clear()
        self.textos.clear()

    def adicionar(self, p):
        if len(self.particulas) < self.LIMITE:
            self.particulas.append(p)

    # ------------------------------------------------------------------
    # Emissores prontos
    # ------------------------------------------------------------------
    def faiscas(self, x, y, qtd=12, cor=cfg.AMARELO, velocidade=4.0, vida=24):
        for _ in range(qtd):
            a = random.uniform(0, math.tau)
            v = random.uniform(0.5, velocidade)
            self.adicionar(Particula(x, y, math.cos(a) * v, math.sin(a) * v - 1,
                                     random.randint(vida // 2, vida), cor, random.choice((2, 3)),
                                     gravidade=0.15, atrito=0.96, tipo="linha", brilho=True,
                                     cor_final=cfg.LARANJA))

    def poeira(self, x, y, qtd=6, cor=(200, 200, 200), direcao=0):
        for _ in range(qtd):
            vx = random.uniform(-1.2, 1.2) + direcao * 0.8
            vy = random.uniform(-1.2, -0.2)
            self.adicionar(Particula(x + random.uniform(-6, 6), y, vx, vy, random.randint(14, 26),
                                     cor, random.randint(2, 4), gravidade=-0.01, atrito=0.93,
                                     tipo="circulo"))

    def fumaca(self, x, y, qtd=8, cor=(90, 90, 100)):
        for _ in range(qtd):
            self.adicionar(Particula(x + random.uniform(-8, 8), y + random.uniform(-4, 4),
                                     random.uniform(-0.6, 0.6), random.uniform(-1.5, -0.4),
                                     random.randint(30, 60), cor, random.randint(4, 8),
                                     gravidade=-0.02, atrito=0.97, tipo="circulo",
                                     cor_final=(40, 40, 46)))

    def explosao(self, x, y, tamanho=1.0, cores=None):
        cores = cores or [cfg.AMARELO, cfg.LARANJA, cfg.VERMELHO, cfg.BRANCO]
        for _ in range(int(26 * tamanho)):
            a = random.uniform(0, math.tau)
            v = random.uniform(1, 6 * tamanho)
            self.adicionar(Particula(x, y, math.cos(a) * v, math.sin(a) * v,
                                     random.randint(18, 40), random.choice(cores),
                                     random.randint(3, 6), gravidade=0.08, atrito=0.92,
                                     tipo="quadrado", brilho=True, cor_final=(60, 30, 20)))
        self.fumaca(x, y, int(10 * tamanho))
        self.anel(x, y, cores[0], int(40 * tamanho))

    def anel(self, x, y, cor, raio_final=40, vida=18):
        p = Particula(x, y, 0, 0, vida, cor, raio_final, tipo="anel")
        self.adicionar(p)

    def bits(self, x, y, qtd=8):
        """Zeros e uns voando: efeito de 'dados' sendo coletados/destruidos."""
        for _ in range(qtd):
            a = random.uniform(0, math.tau)
            v = random.uniform(1, 3.5)
            self.adicionar(Particula(x, y, math.cos(a) * v, math.sin(a) * v - 1.5,
                                     random.randint(25, 45), cfg.VERDE_LED, 12,
                                     gravidade=0.08, atrito=0.97, tipo="bit",
                                     texto=random.choice("01"), encolher=False))

    def brilhos(self, x, y, qtd=6, cor=cfg.OURO):
        for _ in range(qtd):
            self.adicionar(Particula(x + random.uniform(-10, 10), y + random.uniform(-10, 10),
                                     random.uniform(-0.5, 0.5), random.uniform(-1.5, -0.3),
                                     random.randint(20, 35), cor, random.randint(2, 4),
                                     atrito=0.95, tipo="estrela", brilho=True))

    def rastro(self, img, x, y, vida=14):
        p = Particula(x, y, 0, 0, vida, cfg.CIANO, 0, tipo="imagem", encolher=False)
        p.texto = img
        self.adicionar(p)

    def gotas_solda(self, x, y, qtd=6):
        for _ in range(qtd):
            self.adicionar(Particula(x, y, random.uniform(-2.5, 2.5), random.uniform(-4, -1),
                                     random.randint(20, 40), cfg.CINZA_CLARO, 3,
                                     gravidade=0.25, atrito=0.99, tipo="circulo",
                                     cor_final=cfg.LARANJA))

    def texto_flutuante(self, x, y, txt, cor=cfg.OURO, tamanho=16):
        self.textos.append([x, y, txt, cor, 50, tamanho])

    def eletricidade(self, x1, y1, x2, y2, cor=cfg.CIANO, vida=6):
        """Raio zigue-zague entre dois pontos."""
        p = Particula(x1, y1, x2, y2, vida, cor, 2, tipo="raio", encolher=False)
        self.adicionar(p)

    # ------------------------------------------------------------------
    def atualizar(self):
        self.particulas = [p for p in self.particulas if p.atualizar()]
        vivos = []
        for t in self.textos:
            t[1] -= 0.7
            t[4] -= 1
            if t[4] > 0:
                vivos.append(t)
        self.textos = vivos

    def desenhar(self, surf, cam):
        ox, oy = cam.ox, cam.oy
        for p in self.particulas:
            frac = p.vida / p.vida_max
            cor = lerp_cor(p.cor_final, p.cor, frac)
            x = int(p.x - ox)
            y = int(p.y - oy)
            if x < -80 or x > cfg.LARGURA + 80 or y < -80 or y > cfg.ALTURA + 80:
                if p.tipo != "raio":
                    continue
            tam = max(1, int(p.tam * (frac if p.encolher else 1)))
            if p.brilho:
                g = brilho_cache(tam * 3 + 2, p.cor, 70)
                surf.blit(g, (x - g.get_width() // 2, y - g.get_height() // 2),
                          special_flags=pygame.BLEND_ADD)
            if p.tipo == "quadrado":
                pygame.draw.rect(surf, cor, (x - tam // 2, y - tam // 2, tam, tam))
            elif p.tipo == "circulo":
                pygame.draw.circle(surf, cor, (x, y), tam)
            elif p.tipo == "linha":
                pygame.draw.line(surf, cor, (x, y), (int(x - p.vx * 2), int(y - p.vy * 2)), tam)
            elif p.tipo == "estrela":
                pygame.draw.line(surf, cor, (x - tam, y), (x + tam, y), 1)
                pygame.draw.line(surf, cor, (x, y - tam), (x, y + tam), 1)
            elif p.tipo == "anel":
                r = int(p.tam * (1 - frac)) + 2
                pygame.draw.circle(surf, cor, (x, y), r, max(1, int(4 * frac)))
            elif p.tipo == "bit":
                img = render_texto(p.texto, 14, cor, mono=True, negrito=True)
                surf.blit(img, (x, y))
            elif p.tipo == "imagem":
                img = p.texto.copy()
                img.set_alpha(int(120 * frac))
                surf.blit(img, (x, y))
            elif p.tipo == "raio":
                self._desenhar_raio(surf, p.x - ox, p.y - oy, p.vx - ox, p.vy - oy, cor)
        for x, y, txt, cor, vida, tam in self.textos:
            img = render_texto(txt, tam, cor, negrito=True)
            sombra = render_texto(txt, tam, (0, 0, 0), negrito=True)
            px = int(x - ox - img.get_width() / 2)
            py = int(y - oy)
            if vida < 15:
                img = img.copy()
                img.set_alpha(int(255 * vida / 15))
                sombra = sombra.copy()
                sombra.set_alpha(int(255 * vida / 15))
            surf.blit(sombra, (px + 1, py + 1))
            surf.blit(img, (px, py))

    @staticmethod
    def _desenhar_raio(surf, x1, y1, x2, y2, cor):
        pontos = [(x1, y1)]
        segmentos = max(3, int(math.hypot(x2 - x1, y2 - y1) / 14))
        for i in range(1, segmentos):
            t = i / segmentos
            px = x1 + (x2 - x1) * t + random.uniform(-7, 7)
            py = y1 + (y2 - y1) * t + random.uniform(-7, 7)
            pontos.append((px, py))
        pontos.append((x2, y2))
        pygame.draw.lines(surf, cor, False, pontos, 3)
        pygame.draw.lines(surf, cfg.BRANCO, False, pontos, 1)
