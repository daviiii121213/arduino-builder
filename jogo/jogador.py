"""
Bitinho, o robo-Arduino controlado pelo jogador.

Mecanicas: corrida com aceleracao, pulo com altura variavel, coyote time,
buffer de pulo, pulo duplo (upgrade), dash (upgrade), deslizar e pular na
parede (upgrade "Garra Jacare"), tiro de solda e escudo de diodo.
"""

import math
import random

import pygame

import config as cfg
from mundo import CorpoFisico
from util import aproximar, sinal


class Jogador:
    LARGURA = 18
    ALTURA = 28

    def __init__(self, x, y, upgrades, sprites):
        self.corpo = CorpoFisico(x, y, self.LARGURA, self.ALTURA)
        self.sprites = sprites
        self.upgrades = dict(upgrades)
        self.hp_max = 3 + self.upgrades.get("bateria", 0)
        self.hp = self.hp_max
        self.direcao = 1
        self.coyote = 0
        self.buffer_pulo = 0
        self.pulos_extras = 0
        self.pulando = False
        self.dash_timer = 0
        self.dash_recarga = 0
        self.dash_dir = 1
        self.dash_disponivel = True
        self.invencivel = 0
        self.tiro_recarga = 0
        self.frame_anim = 0
        self.contador_anim = 0
        self.estado = "parado"
        self.morto = False
        self.vitoria = False
        self.congelado = False
        self.knockback = 0
        self.escudo = bool(self.upgrades.get("escudo"))
        self.escudo_recarga = 0
        self.parede_timer = 0
        self.lado_parede = 0
        self.pulo_parede_trava = 0
        self.no_chao_antes = True
        self.passos = 0
        self.tempo_no_ar = 0
        self.olhando_baixo = 0
        self.mola_trava = 0

    # ------------------------------------------------------------------
    @property
    def rect(self):
        return self.corpo.rect

    @property
    def centro(self):
        return self.corpo.centro

    def tem(self, upgrade):
        return bool(self.upgrades.get(upgrade))

    def reposicionar(self, x, y):
        self.corpo.x = x
        self.corpo.y = y
        self.corpo.vx = 0
        self.corpo.vy = 0
        self.dash_timer = 0
        self.knockback = 0
        self.invencivel = 60

    # ------------------------------------------------------------------
    def atualizar(self, ctrl, nivel, solidos, plataformas, jogo):
        c = self.corpo
        if self.invencivel > 0:
            self.invencivel -= 1
        if self.tiro_recarga > 0:
            self.tiro_recarga -= 1
        if self.dash_recarga > 0:
            self.dash_recarga -= 1
        if self.pulo_parede_trava > 0:
            self.pulo_parede_trava -= 1
        if self.mola_trava > 0:
            self.mola_trava -= 1
        if self.tem("escudo") and not self.escudo:
            self.escudo_recarga -= 1
            if self.escudo_recarga <= 0:
                self.escudo = True
                jogo.audio.tocar("powerup", 0.5)
                jogo.log("Diodo de protecao recarregado.")

        if self.morto or self.congelado:
            c.vx = aproximar(c.vx, 0, 0.5)
            c.vy = min(c.vy + cfg.GRAVIDADE, cfg.GRAVIDADE_MAX)
            c.mover(nivel, solidos, plataformas)
            self._animar()
            return

        eixo = ctrl.eixo_x()

        # ------------------ Dash ------------------
        if self.dash_timer > 0:
            self.dash_timer -= 1
            c.vx = self.dash_dir * cfg.VELOCIDADE_DASH
            c.vy = 0
            if self.dash_timer % 2 == 0:
                img = self.sprites.quadro_bitinho("dash", 0, self.dash_dir)
                jogo.particulas.rastro(img, c.x - 7, c.y - 10)
            c.mover(nivel, solidos, plataformas)
            if c.parede:
                self.dash_timer = 0
                jogo.camera.tremer(3, 6)
            self._animar()
            return
        if (ctrl.apertou("dash") and self.tem("dash") and self.dash_recarga == 0
                and self.dash_disponivel):
            self.dash_timer = cfg.DURACAO_DASH
            self.dash_recarga = cfg.RECARGA_DASH
            self.dash_dir = eixo if eixo != 0 else self.direcao
            self.direcao = self.dash_dir
            if not c.no_chao:
                self.dash_disponivel = False
            jogo.audio.tocar("dash")
            jogo.particulas.poeira(c.x + c.w / 2, c.y + c.h, 8, cfg.CIANO, -self.dash_dir)
            self._animar()
            return

        # ------------------ Movimento horizontal ------------------
        if self.knockback > 0:
            self.knockback -= 1
        else:
            if eixo != 0:
                self.direcao = eixo
                acel = cfg.ACELERACAO_CHAO if c.no_chao else cfg.ACELERACAO_AR
                if sinal(c.vx) != eixo and c.no_chao:
                    acel *= 1.8  # vira mais rapido
                c.vx = aproximar(c.vx, eixo * cfg.VELOCIDADE_ANDAR, acel)
            else:
                atrito = cfg.ATRITO_CHAO if c.no_chao else cfg.ATRITO_AR
                c.vx = aproximar(c.vx, 0, atrito)

        # esteiras empurram
        esteira = nivel.esteira_sob(c.rect) if c.no_chao else 0

        # ------------------ Pulo ------------------
        if c.no_chao:
            self.coyote = cfg.COYOTE_FRAMES
            self.pulos_extras = 1 if self.tem("pulo_duplo") else 0
            self.dash_disponivel = True
        elif self.coyote > 0:
            self.coyote -= 1

        if ctrl.apertou("pular"):
            self.buffer_pulo = cfg.BUFFER_PULO_FRAMES
        elif self.buffer_pulo > 0:
            self.buffer_pulo -= 1

        # descer de plataformas finas: baixo + pulo
        if ctrl.segurando("baixo") and self.buffer_pulo > 0 and c.no_chao:
            abaixo = nivel.tile_em(int((c.x + c.w / 2) // cfg.TILE), int((c.y + c.h + 2) // cfg.TILE))
            if abaixo == "=" or c.plataforma is not None:
                c.atravessar_plataformas = 10
                c.y += 2
                self.buffer_pulo = 0

        # parede (garra jacare)
        na_parede = False
        if self.tem("garra") and not c.no_chao and c.vy > 0:
            if c.parede_a_frente(nivel, -1) and eixo < 0:
                na_parede, self.lado_parede = True, -1
            elif c.parede_a_frente(nivel, 1) and eixo > 0:
                na_parede, self.lado_parede = True, 1
        if na_parede:
            self.parede_timer = 6
            c.vy = min(c.vy, cfg.VELOCIDADE_PAREDE)
            if random.random() < 0.3:
                jogo.particulas.poeira(c.x + (c.w if self.lado_parede > 0 else 0), c.y + c.h - 4,
                                       1, (200, 200, 210))
        elif self.parede_timer > 0:
            self.parede_timer -= 1

        if self.buffer_pulo > 0:
            if self.coyote > 0:
                self._pular(cfg.FORCA_PULO, jogo)
                self.coyote = 0
            elif self.parede_timer > 0 and self.tem("garra"):
                self._pular(cfg.FORCA_PULO * 0.95, jogo)
                c.vx = -self.lado_parede * 5.2
                self.direcao = -self.lado_parede
                self.knockback = 8
                self.parede_timer = 0
                jogo.particulas.poeira(c.x + c.w / 2, c.y + c.h / 2, 5)
            elif self.pulos_extras > 0:
                self.pulos_extras -= 1
                self._pular(cfg.FORCA_PULO_DUPLO, jogo, duplo=True)

        # pulo variavel
        if ctrl.soltou("pular") and c.vy < 0 and self.pulando and self.mola_trava == 0:
            c.vy *= cfg.CORTE_PULO
            self.pulando = False

        # ------------------ Gravidade ------------------
        gravidade = cfg.GRAVIDADE
        if c.vy > 0:
            gravidade *= 1.15  # queda um pouco mais "pesada"
        if abs(c.vy) < 1.2 and ctrl.segurando("pular") and not c.no_chao:
            gravidade *= 0.6  # "flutuar" no apice
        c.vy = min(c.vy + gravidade, cfg.GRAVIDADE_MAX)

        # ------------------ Tiro ------------------
        if ctrl.apertou("atirar") and self.tiro_recarga == 0:
            self._atirar(jogo, ctrl.segurando("cima"), eixo)

        # ------------------ Movimento final ------------------
        plat_antes = c.plataforma
        vx_original = c.vx
        c.vx += esteira * 1.6
        if plat_antes is not None:
            c.x += getattr(plat_antes, "dx", 0)
            c.y += getattr(plat_antes, "dy", 0)
        chao_antes = c.mover(nivel, solidos, plataformas)
        c.vx = 0 if c.parede else vx_original
        if c.bateu_teto:
            self.pulando = False

        # aterrissagem
        if c.no_chao and not chao_antes:
            if self.tempo_no_ar > 18:
                jogo.particulas.poeira(c.x + c.w / 2, c.y + c.h, 6)
                jogo.audio.tocar("pisar", 0.35)
            self.tempo_no_ar = 0
            self.pulando = False
        if not c.no_chao:
            self.tempo_no_ar += 1

        # passos
        if c.no_chao and abs(c.vx) > 1:
            self.passos += abs(c.vx)
            if self.passos > 26:
                self.passos = 0
                jogo.particulas.poeira(c.x + c.w / 2, c.y + c.h, 1, (170, 170, 180))

        # olhar para baixo
        if ctrl.segurando("baixo") and c.no_chao and abs(c.vx) < 0.5:
            self.olhando_baixo = min(60, self.olhando_baixo + 1)
        else:
            self.olhando_baixo = 0

        self._animar()

    def _pular(self, forca, jogo, duplo=False):
        c = self.corpo
        c.vy = forca
        self.pulando = True
        self.buffer_pulo = 0
        if duplo:
            jogo.audio.tocar("pulo_duplo")
            jogo.particulas.anel(c.x + c.w / 2, c.y + c.h, cfg.CIANO, 24, 14)
            jogo.particulas.faiscas(c.x + c.w / 2, c.y + c.h, 6, cfg.CIANO, 2.5, 16)
        else:
            jogo.audio.tocar("pulo")
            jogo.particulas.poeira(c.x + c.w / 2, c.y + c.h, 4)
        jogo.estatisticas["pulos"] = jogo.estatisticas.get("pulos", 0) + 1

    def impulso_mola(self, jogo):
        self.corpo.vy = cfg.FORCA_MOLA
        self.pulando = False
        self.mola_trava = 20
        self.pulos_extras = 1 if self.tem("pulo_duplo") else 0
        self.dash_disponivel = True
        jogo.audio.tocar("mola")

    def quicar(self, forca=-8.0):
        """Quique ao pisar em um inimigo."""
        self.corpo.vy = forca
        self.pulando = True
        self.pulos_extras = 1 if self.tem("pulo_duplo") else 0
        self.dash_disponivel = True

    def _atirar(self, jogo, mirar_cima=False, eixo=0):
        from itens import Projetil
        forte = self.tem("solda_forte")
        c = self.corpo
        v = cfg.VELOCIDADE_TIRO
        if mirar_cima and eixo != 0:      # diagonal
            x, y = c.x + c.w / 2 + self.direcao * 8, c.y + 4
            vx, vy = self.direcao * v * 0.72, -v * 0.72
        elif mirar_cima:                  # reto para cima
            x, y = c.x + c.w / 2, c.y - 4
            vx, vy = 0, -v
        else:
            x = c.x + (c.w + 4 if self.direcao > 0 else -10)
            y = c.y + 14
            vx, vy = self.direcao * v, 0
        p = Projetil(x, y, vx, vy, "jogador",
                     dano=2 if forte else 1, img=self.sprites.gota_solda,
                     raio=6 if forte else 4, vida=55)
        jogo.projeteis.append(p)
        self.tiro_recarga = cfg.RECARGA_TIRO - (3 if forte else 0)
        jogo.audio.tocar("tiro", 0.6)
        jogo.particulas.faiscas(x, y, 3, cfg.BRANCO, 1.5, 10)
        jogo.estatisticas["tiros"] = jogo.estatisticas.get("tiros", 0) + 1

    # ------------------------------------------------------------------
    def receber_dano(self, qtd, origem_x, jogo, ignorar_invencivel=False):
        if self.morto or self.vitoria:
            return False
        if (self.invencivel > 0 or self.dash_timer > 0) and not ignorar_invencivel:
            return False
        c = self.corpo
        if self.escudo and not ignorar_invencivel:
            self.escudo = False
            self.escudo_recarga = 60 * 20
            self.invencivel = 60
            jogo.audio.tocar("erro", 0.7)
            jogo.particulas.anel(c.x + c.w / 2, c.y + c.h / 2, cfg.OURO, 40)
            jogo.log("Diodo de protecao absorveu o impacto!")
            return False
        self.hp -= qtd
        self.invencivel = cfg.INVENCIVEL_FRAMES
        direcao = -1 if origem_x > c.x + c.w / 2 else 1
        c.vx = direcao * 4.5
        c.vy = -6
        self.knockback = 14
        jogo.audio.tocar("dano")
        jogo.camera.tremer(6, 14)
        jogo.particulas.faiscas(c.x + c.w / 2, c.y + c.h / 2, 16, cfg.VERMELHO, 4)
        jogo.estatisticas["danos"] = jogo.estatisticas.get("danos", 0) + 1
        jogo.efeito_hit = 6
        if self.hp <= 0:
            self.hp = 0
            self.morrer(jogo)
        return True

    def curar(self, qtd=1):
        antes = self.hp
        self.hp = min(self.hp_max, self.hp + qtd)
        return self.hp > antes

    def morrer(self, jogo):
        if self.morto:
            return
        self.morto = True
        self.corpo.vy = -9
        self.corpo.vx = 0
        jogo.ao_morrer()

    # ------------------------------------------------------------------
    def _animar(self):
        c = self.corpo
        anterior = self.estado
        if self.vitoria:
            self.estado = "vitoria"
        elif self.morto or self.knockback > 6:
            self.estado = "dano"
        elif self.dash_timer > 0:
            self.estado = "dash"
        elif not c.no_chao:
            if self.parede_timer > 3 and self.tem("garra"):
                self.estado = "parede"
            else:
                self.estado = "pular" if c.vy < 0 else "cair"
        elif abs(c.vx) > 0.6:
            self.estado = "correr"
        else:
            self.estado = "parado"
        if self.estado != anterior:
            self.contador_anim = 0
            self.frame_anim = 0
        self.contador_anim += 1
        velocidade = 6 if self.estado == "correr" else 20
        if self.estado == "parado":
            velocidade = 30 if self.frame_anim != 2 else 8
        if self.contador_anim >= velocidade:
            self.contador_anim = 0
            self.frame_anim += 1

    def desenhar(self, surf, cam, tempo):
        if self.invencivel > 0 and not self.morto and (self.invencivel // 4) % 2 == 0:
            return
        c = self.corpo
        direcao = self.direcao
        if self.estado == "parede":
            direcao = -self.lado_parede
        img = self.sprites.quadro_bitinho(self.estado, self.frame_anim, direcao)
        x = int(c.x + c.w / 2 - img.get_width() / 2) - cam.ox
        y = int(c.y + c.h - img.get_height()) - cam.oy + 1
        surf.blit(img, (x, y))
        if self.escudo:
            raio = 22 + int(math.sin(tempo * 0.1) * 2)
            s = pygame.Surface((raio * 2 + 4, raio * 2 + 4), pygame.SRCALPHA)
            pygame.draw.circle(s, (*cfg.OURO, 40), (raio + 2, raio + 2), raio)
            pygame.draw.circle(s, (*cfg.OURO, 140), (raio + 2, raio + 2), raio, 1)
            surf.blit(s, (int(c.x + c.w / 2) - raio - 2 - cam.ox, int(c.y + c.h / 2) - raio - 2 - cam.oy))
