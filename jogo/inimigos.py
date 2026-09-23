"""
Inimigos: as falhas que infestaram o mundo dos circuitos.

- Bug        (B): besouro de software que anda de um lado a outro.
- Glitch     (F): falha visual que flutua e se teletransporta.
- Torreta    (S): bobina tesla que dispara faiscas mirando no jogador.
- Saltador   (J): capacitor estufado que pula em direcao ao jogador.
- Drone      (D): quadricoptero que persegue e solta bombas de bits.
- Virus      (V): se divide em dois virus menores ao ser destruido.
- Minhoca    (W): fio desencapado que fica eletrificado em ciclos.
"""

import math
import random

import pygame

import config as cfg
from mundo import CorpoFisico
from itens import Projetil, Byte
from util import brilho_cache, distancia

T = cfg.TILE

_cache_branco = {}


def silhueta_branca(img):
    chave = id(img)
    s = _cache_branco.get(chave)
    if s is None:
        s = pygame.mask.from_surface(img).to_surface(setcolor=(255, 255, 255, 255),
                                                     unsetcolor=(0, 0, 0, 0))
        _cache_branco[chave] = s
    return s


class Inimigo:
    nome = "inimigo"
    hp_max = 1
    dano_contato = 1
    pisavel = True
    bytes_drop = cfg.BYTES_POR_INIMIGO
    gravidade = True
    largura = 24
    altura = 18

    def __init__(self, x, y, sprites):
        self.sprites = sprites
        self.corpo = CorpoFisico(x + (T - self.largura) / 2, y + T - self.altura,
                                 self.largura, self.altura)
        self.hp = self.hp_max
        self.vivo = True
        self.direcao = -1
        self.flash = 0
        self.tempo = random.randint(0, 100)
        self.ativo = False  # so atualiza perto da camera

    @property
    def rect(self):
        return self.corpo.rect

    @property
    def centro(self):
        return self.corpo.centro

    def pode_ser_pisado(self):
        return self.pisavel

    def receber_dano(self, qtd, jogo, origem=None):
        if not self.vivo:
            return
        self.hp -= qtd
        self.flash = 6
        jogo.audio.tocar("inimigo_dano", 0.6)
        if self.hp <= 0:
            self.morrer(jogo)
        elif origem is not None:
            self.corpo.vx = 2.5 if origem < self.corpo.x else -2.5

    def morrer(self, jogo):
        self.vivo = False
        cx, cy = self.centro
        jogo.particulas.explosao(cx, cy, 0.6)
        jogo.particulas.bits(cx, cy, 8)
        jogo.audio.tocar("explosao", 0.6)
        jogo.camera.tremer(3, 8)
        for _ in range(self.bytes_drop):
            jogo.itens.append(Byte(cx - T / 2, cy - T / 2, self.sprites, solto=True))
        jogo.estatisticas["inimigos"] = jogo.estatisticas.get("inimigos", 0) + 1
        jogo.log("%s eliminado! +%d bytes" % (self.nome, self.bytes_drop))
        self.ao_morrer(jogo)

    def ao_morrer(self, jogo):
        pass

    def atualizar(self, jogo):
        self.tempo += 1
        if self.flash > 0:
            self.flash -= 1
        self.comportamento(jogo)
        if self.corpo.y > jogo.nivel.altura + 100:
            self.vivo = False

    def comportamento(self, jogo):
        pass

    def aplicar_gravidade(self):
        self.corpo.vy = min(self.corpo.vy + cfg.GRAVIDADE, cfg.GRAVIDADE_MAX)

    def imagem(self):
        return None

    def desenhar(self, surf, cam, tempo):
        img = self.imagem()
        if img is None:
            return
        if self.flash > 0:
            img = silhueta_branca(img)
        c = self.corpo
        x = int(c.x + c.w / 2 - img.get_width() / 2) - cam.ox
        y = int(c.y + c.h - img.get_height()) - cam.oy
        surf.blit(img, (x, y))


# ---------------------------------------------------------------------------
class Bug(Inimigo):
    nome = "Bug"
    hp_max = 1
    largura = 24
    altura = 16
    velocidade = 1.0

    def comportamento(self, jogo):
        c = self.corpo
        if c.no_chao and (c.sobre_borda(jogo.nivel, self.direcao) or
                          c.parede_a_frente(jogo.nivel, self.direcao)):
            self.direcao *= -1
        c.vx = self.direcao * self.velocidade
        self.aplicar_gravidade()
        c.mover(jogo.nivel, jogo.solidos_extras())

    def imagem(self):
        lista = self.sprites.bug if self.direcao > 0 else self.sprites.bug_esq
        return lista[(self.tempo // 8) % 2]


class Glitch(Inimigo):
    nome = "Glitch"
    hp_max = 2
    largura = 22
    altura = 22
    gravidade = False

    def __init__(self, x, y, sprites):
        super().__init__(x, y, sprites)
        self.origem = (self.corpo.x, self.corpo.y)
        self.fase = random.uniform(0, math.tau)
        self.teleporte = random.randint(120, 240)
        self.sumindo = 0

    def comportamento(self, jogo):
        c = self.corpo
        self.fase += 0.03
        alvo_x = self.origem[0] + math.sin(self.fase) * 70
        alvo_y = self.origem[1] + math.sin(self.fase * 2.1) * 26
        c.x += (alvo_x - c.x) * 0.08
        c.y += (alvo_y - c.y) * 0.08
        self.teleporte -= 1
        if self.teleporte <= 0:
            self.teleporte = random.randint(150, 260)
            jx, jy = jogo.jogador.centro
            if distancia((jx, jy), self.centro) < 400:
                jogo.particulas.bits(c.x + c.w / 2, c.y + c.h / 2, 6)
                nx = self.origem[0] + random.choice((-60, 60))
                if not jogo.nivel.solido_px(nx + 11, self.origem[1] + 11):
                    self.origem = (nx, self.origem[1])
                self.sumindo = 12
        if self.sumindo > 0:
            self.sumindo -= 1
        self.direcao = 1 if jogo.jogador.centro[0] > c.x else -1

    def imagem(self):
        return self.sprites.glitch[(self.tempo // 5) % 4]

    def desenhar(self, surf, cam, tempo):
        if self.sumindo > 0 and self.sumindo % 2:
            return
        super().desenhar(surf, cam, tempo)


class Torreta(Inimigo):
    nome = "Torreta Tesla"
    hp_max = 3
    largura = 24
    altura = 30
    pisavel = False
    bytes_drop = 5

    def __init__(self, x, y, sprites):
        super().__init__(x, y, sprites)
        self.recarga = random.randint(40, 90)
        self.carregando = 0

    def comportamento(self, jogo):
        c = self.corpo
        self.aplicar_gravidade()
        c.vx *= 0.8
        c.mover(jogo.nivel, jogo.solidos_extras())
        j = jogo.jogador
        d = distancia(j.centro, self.centro)
        if d < 400 and not j.morto:
            self.recarga -= 1
            if self.recarga == 25:
                self.carregando = 25
            if self.carregando > 0:
                self.carregando -= 1
                if self.carregando % 5 == 0:
                    jogo.particulas.faiscas(c.x + c.w / 2, c.y + 4, 2, cfg.CIANO, 1.5, 10)
            if self.recarga <= 0:
                origem = (c.x + c.w / 2, c.y + 4)
                if jogo.nivel.linha_de_visao(origem, j.centro):
                    ang = math.atan2(j.centro[1] - origem[1], j.centro[0] - origem[0])
                    jogo.projeteis.append(Projetil(origem[0], origem[1], math.cos(ang) * 4.2,
                                                   math.sin(ang) * 4.2, "inimigo",
                                                   img=self.sprites.faisca, raio=5, vida=120))
                    jogo.audio.tocar("raio", 0.3)
                self.recarga = random.randint(80, 120)

    def imagem(self):
        return self.sprites.torreta[1 if self.carregando > 0 and self.tempo % 4 < 2 else 0]


class Saltador(Inimigo):
    nome = "Capacitor Estufado"
    hp_max = 2
    largura = 18
    altura = 24
    bytes_drop = 4

    def __init__(self, x, y, sprites):
        super().__init__(x, y, sprites)
        self.espera = random.randint(40, 80)
        self.agachado = 0

    def comportamento(self, jogo):
        c = self.corpo
        self.aplicar_gravidade()
        if c.no_chao:
            c.vx *= 0.7
            self.espera -= 1
            if self.espera == 12:
                self.agachado = 12
            if self.espera <= 0:
                j = jogo.jogador
                self.direcao = 1 if j.centro[0] > c.x else -1
                if distancia(j.centro, self.centro) < 360:
                    c.vy = -9.5
                    c.vx = self.direcao * 2.8
                else:
                    c.vy = -5
                    c.vx = self.direcao * 1
                self.espera = random.randint(60, 90)
        if self.agachado > 0:
            self.agachado -= 1
        c.mover(jogo.nivel, jogo.solidos_extras())
        if c.parede:
            c.vx = -c.vx

    def imagem(self):
        if not self.corpo.no_chao:
            return self.sprites.saltador[2]
        if self.agachado > 0:
            return self.sprites.saltador[1]
        return self.sprites.saltador[0]


class Drone(Inimigo):
    nome = "Drone Espiao"
    hp_max = 3
    largura = 34
    altura = 18
    gravidade = False
    bytes_drop = 6

    def __init__(self, x, y, sprites):
        super().__init__(x, y, sprites)
        self.altura_base = self.corpo.y
        self.recarga_bomba = 90

    def comportamento(self, jogo):
        c = self.corpo
        j = jogo.jogador
        jx, jy = j.centro
        d = distancia((jx, jy), self.centro)
        if d < 450:
            alvo_x = jx - c.w / 2
            alvo_y = min(self.altura_base, jy - 140)
            c.vx += (1 if alvo_x > c.x else -1) * 0.08
            c.vx = max(-2.2, min(2.2, c.vx))
            c.vy = (alvo_y - c.y) * 0.02 + math.sin(self.tempo * 0.05) * 0.4
            self.recarga_bomba -= 1
            if self.recarga_bomba <= 0 and abs(jx - (c.x + c.w / 2)) < 60:
                self.recarga_bomba = 80
                jogo.projeteis.append(Projetil(c.x + c.w / 2, c.y + c.h, c.vx * 0.5, 1, "inimigo",
                                               raio=5, vida=150, gravidade=0.25,
                                               cor=cfg.VERMELHO))
                jogo.audio.tocar("bip", 0.5)
        else:
            c.vx *= 0.95
            c.vy = math.sin(self.tempo * 0.05) * 0.4
        c.mover(jogo.nivel, jogo.solidos_extras())

    def imagem(self):
        return self.sprites.drone[(self.tempo // 2) % 2]


class Virus(Inimigo):
    nome = "Virus"
    hp_max = 3
    largura = 22
    altura = 22
    bytes_drop = 4
    pequeno = False

    def __init__(self, x, y, sprites, pequeno=False):
        if pequeno:
            self.largura = 14
            self.altura = 14
            self.hp_max = 1
            self.bytes_drop = 1
        super().__init__(x, y, sprites)
        self.pequeno = pequeno
        self.direcao = random.choice((-1, 1))
        self.velocidade = 1.8 if pequeno else 1.3

    def comportamento(self, jogo):
        c = self.corpo
        j = jogo.jogador
        if abs(j.centro[0] - self.centro[0]) < 200 and abs(j.centro[1] - self.centro[1]) < 80:
            self.direcao = 1 if j.centro[0] > self.centro[0] else -1
        if c.no_chao and (c.sobre_borda(jogo.nivel, self.direcao) or
                          c.parede_a_frente(jogo.nivel, self.direcao)):
            self.direcao *= -1
            if c.no_chao and random.random() < 0.3:
                c.vy = -6
        c.vx = self.direcao * self.velocidade
        self.aplicar_gravidade()
        c.mover(jogo.nivel, jogo.solidos_extras())

    def ao_morrer(self, jogo):
        if not self.pequeno:
            for d in (-1, 1):
                v = Virus(self.corpo.x - T / 2 + 10, self.corpo.y - T + self.altura, self.sprites,
                          pequeno=True)
                v.corpo.vx = d * 3
                v.corpo.vy = -5
                v.direcao = d
                v.ativo = True
                jogo.inimigos_novos.append(v)

    def imagem(self):
        lista = self.sprites.virus_pequeno if self.pequeno else self.sprites.virus
        return lista[(self.tempo // 10) % 2]


class Minhoca(Inimigo):
    nome = "Fio Desencapado"
    hp_max = 2
    largura = 30
    altura = 12
    bytes_drop = 4

    def __init__(self, x, y, sprites):
        super().__init__(x, y, sprites)
        self.ciclo = random.randint(0, 180)

    @property
    def eletrificado(self):
        return (self.ciclo % 180) > 120

    def pode_ser_pisado(self):
        return not self.eletrificado

    def comportamento(self, jogo):
        c = self.corpo
        self.ciclo += 1
        if c.no_chao and (c.sobre_borda(jogo.nivel, self.direcao) or
                          c.parede_a_frente(jogo.nivel, self.direcao)):
            self.direcao *= -1
        c.vx = self.direcao * (0.6 if not self.eletrificado else 0.0)
        self.aplicar_gravidade()
        c.mover(jogo.nivel, jogo.solidos_extras())
        if self.eletrificado and self.tempo % 4 == 0:
            x = c.x + random.uniform(0, c.w)
            jogo.particulas.eletricidade(x, c.y, x + random.uniform(-14, 14), c.y - random.uniform(10, 24),
                                         cfg.CIANO, 4)

    def imagem(self):
        img = self.sprites.minhoca[(self.tempo // 10) % 2]
        if self.direcao < 0:
            img = pygame.transform.flip(img, True, False)
        return img

    def desenhar(self, surf, cam, tempo):
        super().desenhar(surf, cam, tempo)
        if self.eletrificado:
            c = self.corpo
            g = brilho_cache(24, cfg.CIANO, 80)
            surf.blit(g, (int(c.x + c.w / 2 - 24 - cam.ox), int(c.y + c.h / 2 - 24 - cam.oy)),
                      special_flags=pygame.BLEND_ADD)


# Mapa de caracteres do nivel -> classe
TIPOS_INIMIGOS = {
    "B": Bug,
    "F": Glitch,
    "S": Torreta,
    "J": Saltador,
    "D": Drone,
    "V": Virus,
    "W": Minhoca,
}


def criar_inimigo(char, x, y, sprites):
    cls = TIPOS_INIMIGOS.get(char)
    if cls is None:
        return None
    return cls(x, y, sprites)
