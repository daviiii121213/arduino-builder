"""
Mundo: mapa de tiles, colisao, corpo fisico e fundos com parallax.

Os niveis sao escritos em ASCII (veja niveis.py). Este modulo converte o
texto em uma grade de tiles, pre-renderiza a parte estatica e oferece
funcoes de colisao para jogador e inimigos.
"""

import math
import random

import pygame

import config as cfg
from util import gradiente_vertical, lerp_cor, brilho_cache

T = cfg.TILE

# Caracteres que viram tiles fixos na grade
TILES_ESTATICOS = {"#", "=", "^", "~", ">", "<", "d"}
SOLIDOS = {"#", ">", "<"}


class Nivel:
    def __init__(self, dados, sprites):
        self.dados = dados
        self.sprites = sprites
        self.tema = dados.get("mundo", 0)
        linhas = [l.rstrip("\n") for l in dados["mapa"]]
        self.largura_tiles = max(len(l) for l in linhas)
        self.altura_tiles = len(linhas)
        self.linhas = [l.ljust(self.largura_tiles) for l in linhas]
        self.largura = self.largura_tiles * T
        self.altura = self.altura_tiles * T
        self.grade = [[" "] * self.largura_tiles for _ in range(self.altura_tiles)]
        self.objetos = []  # (char, x_px, y_px)
        for ty, linha in enumerate(self.linhas):
            for tx, c in enumerate(linha):
                if c in TILES_ESTATICOS:
                    self.grade[ty][tx] = c
                elif c != " " and c != ".":
                    self.objetos.append((c, tx * T, ty * T))
        self.lavas = []
        self.esteiras = []
        for ty in range(self.altura_tiles):
            for tx in range(self.largura_tiles):
                c = self.grade[ty][tx]
                if c == "~":
                    self.lavas.append((tx, ty))
                elif c in "<>":
                    self.esteiras.append((tx, ty, 1 if c == ">" else -1))
        self.superficie = None
        self._renderizar()

    # ------------------------------------------------------------------
    # Consulta da grade
    # ------------------------------------------------------------------
    def tile_em(self, tx, ty):
        if tx < 0 or tx >= self.largura_tiles:
            return "#"  # paredes invisiveis nas laterais
        if ty < 0 or ty >= self.altura_tiles:
            return " "
        return self.grade[ty][tx]

    def solido(self, tx, ty):
        return self.tile_em(tx, ty) in SOLIDOS

    def solido_px(self, x, y):
        return self.solido(int(x // T), int(y // T))

    def remover_tile(self, tx, ty):
        if 0 <= tx < self.largura_tiles and 0 <= ty < self.altura_tiles:
            self.grade[ty][tx] = " "
            pygame.draw.rect(self.superficie, (0, 0, 0, 0), (tx * T, ty * T, T, T))

    def tiles_no_rect(self, rect):
        x0 = int(rect.left // T)
        x1 = int((rect.right - 1) // T)
        y0 = int(rect.top // T)
        y1 = int((rect.bottom - 1) // T)
        for ty in range(y0, y1 + 1):
            for tx in range(x0, x1 + 1):
                yield tx, ty, self.tile_em(tx, ty)

    def tocando_espinho(self, rect):
        for tx, ty, c in self.tiles_no_rect(rect):
            if c == "^":
                hit = pygame.Rect(tx * T + 4, ty * T + 14, T - 8, T - 14)
                if hit.colliderect(rect):
                    return True
        return False

    def tocando_lava(self, rect):
        for tx, ty, c in self.tiles_no_rect(rect):
            if c == "~":
                hit = pygame.Rect(tx * T, ty * T + 10, T, T - 10)
                if hit.colliderect(rect):
                    return True
        return False

    def esteira_sob(self, rect):
        """Retorna a direcao da esteira sob o retangulo (ou 0)."""
        y = rect.bottom + 1
        for x in (rect.left + 2, rect.centerx, rect.right - 2):
            c = self.tile_em(int(x // T), int(y // T))
            if c == ">":
                return 1
            if c == "<":
                return -1
        return 0

    def linha_de_visao(self, a, b, passo=12):
        """Verifica se nao ha tiles solidos entre os pontos a e b."""
        dx = b[0] - a[0]
        dy = b[1] - a[1]
        dist = math.hypot(dx, dy)
        n = max(1, int(dist / passo))
        for i in range(1, n):
            x = a[0] + dx * i / n
            y = a[1] + dy * i / n
            if self.solido_px(x, y):
                return False
        return True

    # ------------------------------------------------------------------
    # Renderizacao
    # ------------------------------------------------------------------
    def _renderizar(self):
        self.superficie = pygame.Surface((self.largura, self.altura), pygame.SRCALPHA)
        rng = random.Random(hash(self.dados.get("id", "x")) & 0xffff)
        for ty in range(self.altura_tiles):
            for tx in range(self.largura_tiles):
                c = self.grade[ty][tx]
                pos = (tx * T, ty * T)
                if c == "#":
                    topo = 0 if self.tile_em(tx, ty - 1) in SOLIDOS else 1
                    variante = topo | (rng.randint(0, 7) << 1)
                    self.superficie.blit(self.sprites.tile("solido", self.tema, variante), pos)
                elif c == "=":
                    self.superficie.blit(self.sprites.tile("plataforma", self.tema), pos)
                elif c == "^":
                    self.superficie.blit(self.sprites.tile("espinho", self.tema), pos)
                elif c == "d":
                    self.superficie.blit(self.sprites.tile("decoracao", self.tema,
                                                           rng.randint(0, 20)), pos)
        # sombra suave sob tiles expostos (ambient occlusion fake)
        sombra = pygame.Surface((T, 6), pygame.SRCALPHA)
        for i in range(6):
            pygame.draw.line(sombra, (0, 0, 0, 60 - i * 10), (0, i), (T, i))
        for ty in range(self.altura_tiles - 1):
            for tx in range(self.largura_tiles):
                if self.grade[ty][tx] in SOLIDOS and self.grade[ty + 1][tx] == " ":
                    self.superficie.blit(sombra, (tx * T, (ty + 1) * T))

    def desenhar(self, surf, cam, tempo):
        area = pygame.Rect(cam.ox, cam.oy, cfg.LARGURA, cfg.ALTURA)
        surf.blit(self.superficie, (0, 0), area)
        frame = (tempo // 6) % 8
        for tx, ty in self.lavas:
            x, y = tx * T - cam.ox, ty * T - cam.oy
            if -T < x < cfg.LARGURA and -T < y < cfg.ALTURA:
                surf.blit(self.sprites.tile("lava", self.tema, frame), (x, y))
                if self.tile_em(tx, ty - 1) == " " and (tempo + tx * 7) % 50 == 0:
                    pass
        frame_e = (tempo // 3) % 5
        for tx, ty, d in self.esteiras:
            x, y = tx * T - cam.ox, ty * T - cam.oy
            if -T < x < cfg.LARGURA and -T < y < cfg.ALTURA:
                tipo = "esteira_d" if d > 0 else "esteira_e"
                surf.blit(self.sprites.tile(tipo, self.tema, frame_e), (x, y))

    def brilho_lava(self, surf, cam, tempo):
        for tx, ty in self.lavas:
            if self.tile_em(tx, ty - 1) != " ":
                continue
            x, y = tx * T - cam.ox + T // 2, ty * T - cam.oy + 8
            if -T < x < cfg.LARGURA + T and -T < y < cfg.ALTURA + T:
                g = brilho_cache(28, (255, 140, 40), 50)
                surf.blit(g, (x - 28, y - 28), special_flags=pygame.BLEND_ADD)


# ---------------------------------------------------------------------------
# Corpo fisico com colisao por tiles
# ---------------------------------------------------------------------------
class CorpoFisico:
    def __init__(self, x, y, w, h):
        self.x = float(x)
        self.y = float(y)
        self.w = w
        self.h = h
        self.vx = 0.0
        self.vy = 0.0
        self.no_chao = False
        self.parede = 0          # -1 parede a esquerda, 1 a direita
        self.bateu_teto = False
        self.plataforma = None   # plataforma movel em que esta apoiado
        self.atravessar_plataformas = 0

    @property
    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), self.w, self.h)

    @property
    def centro(self):
        return (self.x + self.w / 2, self.y + self.h / 2)

    def mover(self, nivel, solidos=(), plataformas=()):
        """Move o corpo aplicando vx/vy e resolve colisoes.

        solidos: retangulos extras bloqueantes (portas, blocos quebraveis).
        plataformas: objetos com .rect que so bloqueiam por cima (moveis).
        """
        self.parede = 0
        self.bateu_teto = False
        chao_antes = self.no_chao
        self.no_chao = False
        self.plataforma = None
        if self.atravessar_plataformas > 0:
            self.atravessar_plataformas -= 1

        # ----- eixo X -----
        self.x += self.vx
        r = self.rect
        for tx, ty, c in nivel.tiles_no_rect(r):
            if c in SOLIDOS:
                tr = pygame.Rect(tx * T, ty * T, T, T)
                if r.colliderect(tr):
                    if self.vx > 0:
                        self.x = tr.left - self.w
                        self.parede = 1
                    elif self.vx < 0:
                        self.x = tr.right
                        self.parede = -1
                    else:
                        # empurra para o lado mais proximo
                        if r.centerx < tr.centerx:
                            self.x = tr.left - self.w
                        else:
                            self.x = tr.right
                    self.vx = 0
                    r = self.rect
        for s in solidos:
            if r.colliderect(s):
                if self.vx > 0 or r.centerx < s.centerx:
                    self.x = s.left - self.w
                    self.parede = 1
                else:
                    self.x = s.right
                    self.parede = -1
                self.vx = 0
                r = self.rect

        # ----- eixo Y -----
        fundo_anterior = self.y + self.h
        self.y += self.vy
        r = self.rect
        for tx, ty, c in nivel.tiles_no_rect(r):
            tr = pygame.Rect(tx * T, ty * T, T, T)
            if c in SOLIDOS:
                if r.colliderect(tr):
                    if self.vy > 0:
                        self.y = tr.top - self.h
                        self.no_chao = True
                    elif self.vy < 0:
                        self.y = tr.bottom
                        self.bateu_teto = True
                    self.vy = 0
                    r = self.rect
            elif c == "=" and self.vy >= 0 and self.atravessar_plataformas == 0:
                if fundo_anterior <= tr.top + 1 and r.bottom >= tr.top:
                    self.y = tr.top - self.h
                    self.vy = 0
                    self.no_chao = True
                    r = self.rect
        for s in solidos:
            if r.colliderect(s):
                if self.vy > 0:
                    self.y = s.top - self.h
                    self.no_chao = True
                elif self.vy < 0:
                    self.y = s.bottom
                    self.bateu_teto = True
                self.vy = 0
                r = self.rect
        for p in plataformas:
            pr = p.rect
            if self.vy >= 0 and fundo_anterior <= pr.top + 2 + max(0, getattr(p, "dy", 0)) \
                    and r.colliderect(pr):
                self.y = pr.top - self.h
                self.vy = 0
                self.no_chao = True
                self.plataforma = p
                r = self.rect
        # Checa chao sem movimento (para nao "piscar" no_chao ao ficar parado)
        if not self.no_chao and self.vy >= 0:
            teste = pygame.Rect(r.x, r.bottom, r.w, 1)
            for tx, ty, c in nivel.tiles_no_rect(teste):
                if c in SOLIDOS:
                    self.no_chao = True
                    break
        return chao_antes

    def sobre_borda(self, nivel, direcao):
        """True se o proximo passo na direcao levaria para um buraco."""
        x = self.x + self.w + 2 if direcao > 0 else self.x - 2
        y = self.y + self.h + 4
        tx, ty = int(x // T), int(y // T)
        c = nivel.tile_em(tx, ty)
        return c not in SOLIDOS and c != "="

    def parede_a_frente(self, nivel, direcao):
        x = self.x + self.w + 1 if direcao > 0 else self.x - 1
        return nivel.solido_px(x, self.y + self.h / 2) or nivel.solido_px(x, self.y + 2)


# ---------------------------------------------------------------------------
# Fundos com parallax
# ---------------------------------------------------------------------------
class Fundo:
    def __init__(self, tema):
        self.tema = tema
        info = cfg.TEMAS_MUNDO[tema]
        self.ceu = gradiente_vertical((cfg.LARGURA, cfg.ALTURA), info["ceu_topo"], info["ceu_base"])
        self.rng = random.Random(tema * 101 + 7)
        self.camadas = []  # (surface, fator_parallax, y)
        self.estrelas = [(self.rng.randint(0, cfg.LARGURA * 2), self.rng.randint(0, cfg.ALTURA),
                          self.rng.random()) for _ in range(90)]
        self.pulsos = [[self.rng.randint(0, 20), self.rng.random()] for _ in range(14)]
        construtores = {0: self._camadas_bancada, 1: self._camadas_protoboard,
                        2: self._camadas_placamae, 3: self._camadas_nuvem}
        construtores[tema]()

    # ---------------- Tema 0: bancada do maker ----------------
    def _camadas_bancada(self):
        w = cfg.LARGURA * 2
        longe = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        # parede de pegboard
        for x in range(0, w, 24):
            for y in range(0, cfg.ALTURA, 24):
                pygame.draw.circle(longe, (20, 22, 32, 160), (x + 12, y + 12), 3)
        # ferramentas penduradas (silhuetas)
        cor = (26, 28, 40, 255)
        for i in range(8):
            x = 80 + i * 230 + self.rng.randint(-30, 30)
            tipo = i % 4
            if tipo == 0:  # chave de fenda
                pygame.draw.rect(longe, cor, (x, 60, 18, 70), border_radius=6)
                pygame.draw.rect(longe, cor, (x + 7, 130, 4, 90))
            elif tipo == 1:  # alicate
                pygame.draw.line(longe, cor, (x, 60), (x + 40, 200), 10)
                pygame.draw.line(longe, cor, (x + 40, 60), (x, 200), 10)
                pygame.draw.circle(longe, cor, (x + 20, 130), 12)
            elif tipo == 2:  # ferro de solda
                pygame.draw.rect(longe, cor, (x, 80, 26, 90), border_radius=10)
                pygame.draw.polygon(longe, cor, [(x + 6, 170), (x + 20, 170), (x + 13, 240)])
            else:  # rolo de solda
                pygame.draw.circle(longe, cor, (x + 30, 140), 40)
                pygame.draw.circle(longe, (0, 0, 0, 0), (x + 30, 140), 14)
        self.camadas.append((longe, 0.2, 0))
        meio = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        cor = (38, 34, 52, 255)
        for i in range(5):
            x = 100 + i * 380
            # osciloscopio
            pygame.draw.rect(meio, cor, (x, 300, 180, 120), border_radius=8)
            pygame.draw.rect(meio, (30, 60, 50, 255), (x + 14, 314, 110, 80))
            pts = [(x + 14 + j * 5, 354 + int(math.sin(j * 0.6) * 20)) for j in range(22)]
            pygame.draw.lines(meio, (80, 220, 140, 255), False, pts, 2)
            for k in range(3):
                pygame.draw.circle(meio, (60, 56, 80, 255), (x + 150, 330 + k * 26), 8)
        self.camadas.append((meio, 0.45, 0))

    # ---------------- Tema 1: protoboard ----------------
    def _camadas_protoboard(self):
        w = cfg.LARGURA * 2
        longe = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        for i in range(10):
            x = i * 200 + self.rng.randint(-20, 20)
            h = self.rng.randint(120, 260)
            pygame.draw.rect(longe, (30, 70, 90, 255), (x, cfg.ALTURA - h, 150, h), border_radius=6)
            for gx in range(8):
                for gy in range(h // 16):
                    pygame.draw.rect(longe, (22, 54, 70, 255),
                                     (x + 10 + gx * 17, cfg.ALTURA - h + 10 + gy * 16, 4, 4))
        self.camadas.append((longe, 0.2, 0))
        meio = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        cores = [(200, 60, 60, 255), (60, 90, 200, 255), (230, 200, 60, 255), (60, 170, 90, 255)]
        for i in range(12):
            x = self.rng.randint(0, w)
            larg = self.rng.randint(80, 260)
            cor = self.rng.choice(cores)
            pygame.draw.arc(meio, cor, (x, 250, larg, 400), 0, math.pi, 6)
        for i in range(6):
            x = i * 320 + 60
            pygame.draw.rect(meio, (26, 26, 32, 255), (x, 380, 120, 200))
            for k in range(6):
                pygame.draw.rect(meio, (150, 150, 160, 255), (x - 8, 395 + k * 24, 8, 6))
                pygame.draw.rect(meio, (150, 150, 160, 255), (x + 120, 395 + k * 24, 8, 6))
            pygame.draw.circle(meio, (50, 50, 60, 255), (x + 20, 400), 7)
        self.camadas.append((meio, 0.45, 0))

    # ---------------- Tema 2: placa-mae ----------------
    def _camadas_placamae(self):
        w = cfg.LARGURA * 2
        longe = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        self.trilhas = []
        for i in range(14):
            y = self.rng.randint(20, cfg.ALTURA - 60)
            x = self.rng.randint(0, w - 400)
            pts = [(x, y)]
            for _ in range(5):
                x += self.rng.randint(40, 120)
                if self.rng.random() < 0.5:
                    y += self.rng.choice((-40, 40))
                pts.append((x, y))
            pygame.draw.lines(longe, (20, 90, 50, 255), False, pts, 3)
            for p in pts:
                pygame.draw.circle(longe, (140, 100, 50, 255), p, 4)
            self.trilhas.append(pts)
        self.camadas.append((longe, 0.25, 0))
        meio = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        for i in range(16):
            x = i * 125 + self.rng.randint(-10, 10)
            h = self.rng.randint(120, 320)
            tipo = self.rng.randint(0, 2)
            if tipo == 0:  # predio-CI
                pygame.draw.rect(meio, (14, 30, 22, 255), (x, cfg.ALTURA - h, 90, h))
                for wy in range(cfg.ALTURA - h + 12, cfg.ALTURA, 18):
                    for wx in range(x + 10, x + 80, 16):
                        if self.rng.random() < 0.6:
                            pygame.draw.rect(meio, (240, 200, 90, 200), (wx, wy, 6, 8))
            elif tipo == 1:  # capacitor-torre
                pygame.draw.rect(meio, (20, 36, 60, 255), (x + 10, cfg.ALTURA - h, 60, h),
                                 border_radius=14)
                pygame.draw.rect(meio, (70, 90, 130, 255), (x + 55, cfg.ALTURA - h + 10, 8, h - 20))
            else:  # dissipador
                for k in range(7):
                    pygame.draw.rect(meio, (50, 56, 64, 255), (x + k * 12, cfg.ALTURA - h, 8, h))
        self.camadas.append((meio, 0.5, 0))

    # ---------------- Tema 3: nuvem IoT ----------------
    def _camadas_nuvem(self):
        w = cfg.LARGURA * 2
        longe = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        for i in range(14):
            x = self.rng.randint(0, w)
            y = self.rng.randint(40, 300)
            for k in range(5):
                pygame.draw.circle(longe, (120, 90, 170, 90),
                                   (x + k * 26, y + self.rng.randint(-10, 10)), self.rng.randint(22, 40))
        self.camadas.append((longe, 0.15, 0))
        meio = pygame.Surface((w, cfg.ALTURA), pygame.SRCALPHA)
        for i in range(9):
            x = i * 220 + self.rng.randint(-20, 20)
            h = self.rng.randint(160, 330)
            pygame.draw.rect(meio, (40, 30, 70, 255), (x, cfg.ALTURA - h, 70, h))
            for yy in range(cfg.ALTURA - h + 10, cfg.ALTURA, 14):
                pygame.draw.line(meio, (70, 60, 110, 255), (x + 6, yy), (x + 64, yy), 2)
                if self.rng.random() < 0.5:
                    pygame.draw.circle(meio, (100, 240, 255, 255), (x + 58, yy - 4), 2)
            # antena wifi
            cx, cy = x + 35, cfg.ALTURA - h - 10
            pygame.draw.line(meio, (70, 60, 110, 255), (cx, cy), (cx, cy + 10), 3)
            for r in (8, 16, 24):
                pygame.draw.arc(meio, (100, 200, 255, 160), (cx - r, cy - r, r * 2, r * 2),
                                math.pi / 4, 3 * math.pi / 4, 2)
        self.camadas.append((meio, 0.4, 0))

    # ------------------------------------------------------------------
    def desenhar(self, surf, cam, tempo):
        surf.blit(self.ceu, (0, 0))
        if self.tema == 3:
            for x, y, fase in self.estrelas:
                px = int((x - cam.x * 0.05) % (cfg.LARGURA * 2)) - cfg.LARGURA // 2
                brilho = 0.5 + 0.5 * math.sin(tempo * 0.05 + fase * 10)
                cor = lerp_cor((60, 50, 100), (255, 255, 255), brilho)
                surf.set_at((px % cfg.LARGURA, y), cor)
        for img, fator, y in self.camadas:
            w = img.get_width()
            ox = int(cam.x * fator) % w
            oy = int(cam.y * fator * 0.3)
            surf.blit(img, (-ox, y - oy))
            if w - ox < cfg.LARGURA:
                surf.blit(img, (w - ox, y - oy))
        if self.tema == 2:
            # pulsos de energia percorrendo as trilhas do fundo
            fator = 0.25
            w = cfg.LARGURA * 2
            ox = int(cam.x * fator) % w
            for i, pts in enumerate(self.trilhas):
                t = ((tempo * 0.01 + self.pulsos[i % len(self.pulsos)][1]) % 1.0)
                seg = t * (len(pts) - 1)
                k = int(seg)
                if k >= len(pts) - 1:
                    continue
                f = seg - k
                x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f - ox
                y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f - int(cam.y * fator * 0.3)
                for dx in (0, w):
                    px = int(x + dx)
                    if -20 < px < cfg.LARGURA + 20:
                        g = brilho_cache(12, (120, 255, 160), 120)
                        surf.blit(g, (px - 12, int(y) - 12), special_flags=pygame.BLEND_ADD)
