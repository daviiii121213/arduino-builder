"""
Interface durante o jogo: HUD, Serial Monitor, caixa de dialogo,
barra de vida de chefe, banners e notificacoes de conquista.
"""

import math

import pygame

import config as cfg
from util import texto, painel, quebrar_texto, render_texto, lerp_cor, brilho_cache, formatar_tempo


# ---------------------------------------------------------------------------
# Serial Monitor: log estilo IDE do Arduino
# ---------------------------------------------------------------------------
class SerialMonitor:
    MAX_LINHAS = 5

    def __init__(self):
        self.linhas = []  # [texto, caracteres_visiveis, idade]
        self.visivel = True
        self.anim = 1.0

    def log(self, msg):
        self.linhas.append([msg, 0, 0])
        if len(self.linhas) > 30:
            self.linhas.pop(0)

    def alternar(self):
        self.visivel = not self.visivel

    def atualizar(self):
        alvo = 1.0 if self.visivel else 0.0
        self.anim += (alvo - self.anim) * 0.2
        for l in self.linhas[-self.MAX_LINHAS:]:
            if l[1] < len(l[0]):
                l[1] = min(len(l[0]), l[1] + 2)
            l[2] += 1

    def desenhar(self, surf, tempo):
        if self.anim < 0.02:
            return
        w, h = 340, 22 + self.MAX_LINHAS * 16 + 8
        x = 10
        y = cfg.ALTURA - int((h + 10) * self.anim)
        painel(surf, (x, y, w, h), (6, 14, 16), cfg.AZUL_ARDUINO, 160, 5, 1)
        pygame.draw.rect(surf, cfg.AZUL_ARDUINO, (x + 1, y + 1, w - 2, 18), border_top_left_radius=5,
                         border_top_right_radius=5)
        texto(surf, "Serial Monitor - 9600 baud", (x + 8, y + 2), 12, cfg.BRANCO, sombra=False, mono=True)
        texto(surf, "[TAB]", (x + w - 8, y + 2), 12, (200, 240, 240), direita=True, sombra=False, mono=True)
        visiveis = self.linhas[-self.MAX_LINHAS:]
        for i, (msg, n, idade) in enumerate(visiveis):
            cor = cfg.BRANCO if idade < 120 else (150, 170, 170)
            texto(surf, "> " + msg[:n], (x + 8, y + 24 + i * 16), 12, cor, sombra=False, mono=True)
        if (tempo // 30) % 2:
            yy = y + 24 + len(visiveis) * 16
            if yy < y + h - 10:
                pygame.draw.rect(surf, cfg.BRANCO, (x + 8, yy + 2, 7, 11))


# ---------------------------------------------------------------------------
# Caixa de dialogo com efeito maquina de escrever
# ---------------------------------------------------------------------------
class CaixaDialogo:
    def __init__(self, falas, audio, sprites, ao_terminar=None):
        self.falas = falas
        self.audio = audio
        self.sprites = sprites
        self.indice = 0
        self.chars = 0.0
        self.ao_terminar = ao_terminar
        self.tempo = 0
        self.ativo = True
        self.anim = 0.0

    @property
    def fala_atual(self):
        return self.falas[self.indice]

    def processar(self, ctrl):
        self.tempo += 1
        self.anim = min(1.0, self.anim + 0.12)
        nome, fala = self.fala_atual
        if self.chars < len(fala):
            antes = int(self.chars)
            self.chars += 1.2
            if int(self.chars) != antes and antes % 3 == 0 and fala[antes] != " ":
                self.audio.tocar("dialogo", 0.5)
        if ctrl.apertou("confirmar") or ctrl.apertou("interagir") or ctrl.apertou("atirar"):
            if self.chars < len(fala):
                self.chars = len(fala)
            else:
                self.indice += 1
                self.chars = 0
                if self.indice >= len(self.falas):
                    self.ativo = False
                    if self.ao_terminar:
                        self.ao_terminar()
                else:
                    self.audio.tocar("menu", 0.5)
        if ctrl.apertou("pausa"):
            self.ativo = False
            if self.ao_terminar:
                self.ao_terminar()

    def desenhar(self, surf):
        if not self.ativo:
            return
        nome, fala = self.fala_atual
        k = self.anim
        h = 120
        y = cfg.ALTURA - int((h + 16) * k)
        r = pygame.Rect(40, y, cfg.LARGURA - 80, h)
        painel(surf, r, (14, 18, 26), cfg.OURO, 240, 10, 3)
        # retrato
        ret = pygame.Rect(r.x + 14, r.y + 14, 92, 92)
        pygame.draw.rect(surf, (40, 44, 56), ret, border_radius=8)
        img = self.sprites.prof_volt[(self.tempo // 10) % 2 if self.chars < len(fala) else 0]
        img2 = pygame.transform.scale(img, (img.get_width() * 2 - 8, img.get_height() * 2 - 12))
        surf.blit(img2, img2.get_rect(center=ret.center))
        texto(surf, nome, (r.x + 124, r.y + 12), 18, cfg.OURO, negrito=True)
        visivel = fala[:int(self.chars)]
        linhas = quebrar_texto(visivel, 18, r.w - 150)
        for i, l in enumerate(linhas[:3]):
            texto(surf, l, (r.x + 124, r.y + 40 + i * 24), 18, cfg.BRANCO)
        if self.chars >= len(fala) and (self.tempo // 20) % 2:
            pygame.draw.polygon(surf, cfg.OURO, [(r.right - 30, r.bottom - 24), (r.right - 18, r.bottom - 24),
                                                 (r.right - 24, r.bottom - 16)])
        texto(surf, "%d/%d" % (self.indice + 1, len(self.falas)), (r.right - 16, r.y + 12), 13,
              cfg.CINZA, direita=True)


# ---------------------------------------------------------------------------
# HUD principal
# ---------------------------------------------------------------------------
class HUD:
    def __init__(self, sprites):
        self.sprites = sprites
        self.bytes_exibidos = 0.0
        self.banners = []       # [texto, subtexto, cor, vida, vida_max]
        self.toasts = []        # conquistas: [info, vida]
        self.tremor_hp = 0
        self.hp_anterior = None

    def banner(self, txt, sub="", cor=cfg.BRANCO, duracao=150):
        self.banners.append([txt, sub, cor, duracao, duracao])

    def conquista(self, info):
        self.toasts.append([info, 240])

    def atualizar(self, jogo):
        alvo = jogo.bytes_nivel
        self.bytes_exibidos += (alvo - self.bytes_exibidos) * 0.2
        if abs(alvo - self.bytes_exibidos) < 0.5:
            self.bytes_exibidos = alvo
        hp = jogo.jogador.hp
        if self.hp_anterior is not None and hp < self.hp_anterior:
            self.tremor_hp = 20
        self.hp_anterior = hp
        if self.tremor_hp > 0:
            self.tremor_hp -= 1
        for b in self.banners:
            b[3] -= 1
        self.banners = [b for b in self.banners if b[3] > 0]
        for t in self.toasts:
            t[1] -= 1
        self.toasts = [t for t in self.toasts if t[1] > 0]

    def desenhar(self, surf, jogo, tempo):
        j = jogo.jogador
        # ---- Bateria (vida) ----
        ox = 14 + (int(math.sin(tempo * 1.3) * 3) if self.tremor_hp else 0)
        oy = 12
        painel(surf, (ox - 6, oy - 6, 32 + j.hp_max * 22, 44), (10, 14, 20), cfg.AZUL_ARDUINO, 200, 8, 1)
        pygame.draw.rect(surf, (200, 200, 210), (ox, oy + 6, 6, 20), border_radius=2)
        for i in range(j.hp_max):
            r = pygame.Rect(ox + 10 + i * 22, oy, 18, 32)
            pygame.draw.rect(surf, (40, 44, 52), r, border_radius=3)
            if i < j.hp:
                frac = j.hp / j.hp_max
                cor = cfg.VERDE_LED if frac > 0.5 else (cfg.AMARELO if frac > 0.25 else cfg.VERMELHO)
                if frac <= 0.34 and (tempo // 15) % 2:
                    cor = lerp_cor(cor, cfg.BRANCO, 0.4)
                pygame.draw.rect(surf, cor, r.inflate(-6, -6), border_radius=2)
                pygame.draw.line(surf, lerp_cor(cor, cfg.BRANCO, 0.5), (r.x + 4, r.y + 5), (r.right - 5, r.y + 5), 2)
            pygame.draw.rect(surf, (120, 124, 136), r, 1, border_radius=3)
        x_extra = ox + 26 + j.hp_max * 22
        if j.tem("escudo"):
            cor = cfg.OURO if j.escudo else (90, 80, 40)
            pygame.draw.polygon(surf, cor, [(x_extra + 8, oy + 2), (x_extra + 20, oy + 8),
                                            (x_extra + 8, oy + 30), (x_extra - 4, oy + 8)])
            if not j.escudo:
                frac = 1 - j.escudo_recarga / (60 * 20)
                pygame.draw.rect(surf, cfg.OURO, (x_extra - 4, oy + 34, int(24 * frac), 3))
            x_extra += 30
        if j.tem("dash"):
            frac = 1 - j.dash_recarga / cfg.RECARGA_DASH
            cor = cfg.CIANO if frac >= 1 else (60, 90, 110)
            pygame.draw.circle(surf, (30, 40, 50), (x_extra + 10, oy + 16), 12)
            pygame.draw.arc(surf, cor, (x_extra - 2, oy + 4, 24, 24), math.pi / 2,
                            math.pi / 2 + math.tau * frac, 3)
            texto(surf, ">>", (x_extra + 10, oy + 16), 12, cor, centro=True, sombra=False, negrito=True)

        # ---- Bytes ----
        bx = cfg.LARGURA - 14
        painel(surf, (bx - 170, 6, 170, 40), (10, 14, 20), cfg.OURO_ESCURO, 200, 8, 1)
        img = self.sprites.byte[(tempo // 6) % 8]
        surf.blit(img, (bx - 160, 18))
        texto(surf, "%05d" % int(self.bytes_exibidos), (bx - 12, 12), 24, cfg.OURO, direita=True, mono=True,
              negrito=True)
        texto(surf, "BYTES", (bx - 136, 16), 12, cfg.OURO_ESCURO)

        # ---- Componentes ----
        cx = cfg.LARGURA - 184
        for i in range(3):
            r = pygame.Rect(cx + i * 38 - 120, 8, 34, 36)
            pygame.draw.rect(surf, (20, 24, 32), r, border_radius=6)
            pygame.draw.rect(surf, (70, 76, 90), r, 1, border_radius=6)
            ic = self.sprites.componentes[i]
            if i in jogo.componentes_coletados:
                surf.blit(ic, ic.get_rect(center=r.center))
            elif i in jogo.componentes_antigos:
                s = ic.copy()
                s.set_alpha(80)
                surf.blit(s, s.get_rect(center=r.center))
            else:
                texto(surf, "?", r.center, 18, (80, 86, 100), centro=True, sombra=False, negrito=True)

        # ---- Nome do nivel e tempo ----
        img_nome = render_texto("%s - %s" % (jogo.dados["id"], jogo.dados["nome"]), 15, cfg.CINZA_CLARO)
        surf.blit(img_nome, (cfg.LARGURA // 2 - img_nome.get_width() // 2 - 60, 10))
        texto(surf, formatar_tempo(jogo.tempo_nivel), (cfg.LARGURA // 2 - 60, 30), 16, cfg.BRANCO, centro=True,
              mono=True)

        # ---- Barra do chefe ----
        ch = jogo.chefe
        if ch is not None and ch.vivo and ch.ativo:
            w = 520
            x = cfg.LARGURA // 2 - w // 2
            y = cfg.ALTURA - 46 if not jogo.serial.visivel else 60
            if jogo.serial.visivel:
                y = 58
            painel(surf, (x - 10, y - 22, w + 20, 44), (20, 8, 14), cfg.VERMELHO, 220, 6, 2)
            texto(surf, ch.nome, (x, y - 20), 15, cfg.BRANCO, negrito=True)
            texto(surf, "FASE %d" % ch.fase, (x + w, y - 20), 13, cfg.AMARELO, direita=True)
            pygame.draw.rect(surf, (40, 10, 16), (x, y, w, 12), border_radius=4)
            fe = max(0.0, ch.hp_exibido / ch.hp_max)
            fr = max(0.0, ch.hp / ch.hp_max)
            pygame.draw.rect(surf, (255, 220, 220), (x, y, int(w * fe), 12), border_radius=4)
            pygame.draw.rect(surf, cfg.VERMELHO, (x, y, int(w * fr), 12), border_radius=4)
            for k in (0.33, 0.6):
                pygame.draw.line(surf, (20, 0, 0), (x + int(w * k), y), (x + int(w * k), y + 12), 2)

        # ---- Banners ----
        for i, (txt, sub, cor, vida, vmax) in enumerate(self.banners[-2:]):
            t = 1 - vida / vmax
            if t < 0.15:
                k = t / 0.15
            elif t > 0.85:
                k = (1 - t) / 0.15
            else:
                k = 1.0
            y = 150 + i * 70
            faixa = pygame.Surface((cfg.LARGURA, 64), pygame.SRCALPHA)
            faixa.fill((0, 0, 0, int(150 * k)))
            surf.blit(faixa, (0, y - 32))
            xoff = int((1 - k) * 200)
            texto(surf, txt, (cfg.LARGURA // 2 + xoff, y - 8), 34, cor, centro=True, negrito=True,
                  alpha=int(255 * k))
            if sub:
                texto(surf, sub, (cfg.LARGURA // 2 - xoff, y + 20), 16, cfg.CINZA_CLARO, centro=True,
                      alpha=int(255 * k))

        # ---- Conquistas ----
        for i, (info, vida) in enumerate(self.toasts[:3]):
            entrada = min(1.0, (240 - vida) / 20, vida / 20)
            w = 300
            x = cfg.LARGURA - int((w + 14) * entrada)
            y = 56 + i * 64
            painel(surf, (x, y, w, 56), (30, 24, 8), cfg.OURO, 235, 8, 2)
            pygame.draw.circle(surf, cfg.OURO, (x + 28, y + 28), 18)
            texto(surf, "*", (x + 28, y + 28), 26, (80, 60, 10), centro=True, sombra=False, negrito=True)
            texto(surf, "CONQUISTA DESBLOQUEADA", (x + 54, y + 8), 11, cfg.OURO)
            texto(surf, info["nome"], (x + 54, y + 22), 17, cfg.BRANCO, negrito=True)
            texto(surf, info["desc"][:40], (x + 54, y + 40), 11, cfg.CINZA_CLARO, sombra=False)
