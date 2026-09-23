"""
Telas (cenas) fora do gameplay: boot estilo IDE, titulo, historia, mapa
de fases, Loja do Maker, conquistas, opcoes, creditos e resultados.
"""

import math
import random

import pygame

import config as cfg
import textos
import niveis
from util import (texto, painel, quebrar_texto, render_texto, lerp_cor, brilho_cache, gradiente_vertical,
                  formatar_tempo, ease_out_back, ease_out_cubic, clamp)


# ===========================================================================
# Elementos visuais compartilhados
# ===========================================================================
class FundoCircuito:
    """Fundo animado de placa de circuito com pulsos de energia."""

    def __init__(self, semente=7, cor_base=(6, 22, 18), cor_trilha=(16, 70, 46)):
        self.rng = random.Random(semente)
        self.base = gradiente_vertical((cfg.LARGURA, cfg.ALTURA), cor_base, lerp_cor(cor_base, (0, 0, 0), 0.5))
        self.trilhas = []
        camada = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        for _ in range(26):
            x = self.rng.randrange(0, cfg.LARGURA, 20)
            y = self.rng.randrange(0, cfg.ALTURA, 20)
            pts = [(x, y)]
            for _ in range(self.rng.randint(3, 7)):
                d = self.rng.choice(((1, 0), (0, 1), (1, 1), (1, -1), (-1, 0), (0, -1)))
                comp = self.rng.randint(2, 6) * 20
                x += d[0] * comp
                y += d[1] * comp
                pts.append((x, y))
            pygame.draw.lines(camada, (*cor_trilha, 255), False, pts, 3)
            for p in (pts[0], pts[-1]):
                pygame.draw.circle(camada, (*cor_trilha, 255), p, 6)
                pygame.draw.circle(camada, (*cor_base, 255), p, 3)
            self.trilhas.append(pts)
        for _ in range(8):
            x = self.rng.randrange(40, cfg.LARGURA - 80, 20)
            y = self.rng.randrange(40, cfg.ALTURA - 80, 20)
            w, h = self.rng.choice(((60, 40), (80, 30), (40, 40)))
            pygame.draw.rect(camada, (12, 16, 18, 255), (x, y, w, h), border_radius=3)
            for k in range(w // 10):
                pygame.draw.rect(camada, (120, 124, 130, 255), (x + 4 + k * 10, y - 5, 4, 5))
                pygame.draw.rect(camada, (120, 124, 130, 255), (x + 4 + k * 10, y + h, 4, 5))
        self.camada = camada
        self.pulsos = [[self.rng.randrange(len(self.trilhas)), self.rng.random(), self.rng.uniform(0.004, 0.01)]
                       for _ in range(18)]

    def desenhar(self, surf, tempo):
        surf.blit(self.base, (0, 0))
        surf.blit(self.camada, (0, 0))
        for p in self.pulsos:
            p[1] += p[2]
            if p[1] >= 1:
                p[0] = self.rng.randrange(len(self.trilhas))
                p[1] = 0
            pts = self.trilhas[p[0]]
            seg = p[1] * (len(pts) - 1)
            k = min(int(seg), len(pts) - 2)
            f = seg - k
            x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f
            y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f
            g = brilho_cache(14, (120, 255, 170), 140)
            surf.blit(g, (int(x) - 14, int(y) - 14), special_flags=pygame.BLEND_ADD)


def desenhar_logo_arduino(surf, centro, escala=1.0, cor=cfg.AZUL_ARDUINO_CLARO):
    """Simbolo de infinito com '-' e '+' (homenagem ao logo do Arduino)."""
    cx, cy = centro
    r = int(26 * escala)
    esp = max(3, int(9 * escala))
    pygame.draw.circle(surf, cor, (cx - r + esp // 2, cy), r, esp)
    pygame.draw.circle(surf, cor, (cx + r - esp // 2, cy), r, esp)
    m = int(10 * escala)
    pygame.draw.line(surf, cor, (cx - r - m + esp // 2, cy), (cx - r + m + esp // 2, cy), max(2, esp // 2 + 1))
    pygame.draw.line(surf, cor, (cx + r - m - esp // 2, cy), (cx + r + m - esp // 2, cy), max(2, esp // 2 + 1))
    pygame.draw.line(surf, cor, (cx + r - esp // 2, cy - m), (cx + r - esp // 2, cy + m), max(2, esp // 2 + 1))


class Tela:
    musica = None

    def __init__(self, app):
        self.app = app
        self.audio = app.audio
        self.sprites = app.sprites
        self.save = app.save
        self.tempo = 0
        if self.musica:
            self.audio.tocar_musica(self.musica)

    @property
    def ctrl(self):
        return self.app.ctrl

    def atualizar(self, eventos):
        self.tempo += 1

    def desenhar(self, surf):
        pass

    def menu_vertical(self, n, selecao):
        if self.ctrl.apertou("cima"):
            self.audio.tocar("menu")
            return (selecao - 1) % n
        if self.ctrl.apertou("baixo"):
            self.audio.tocar("menu")
            return (selecao + 1) % n
        return selecao

    def rodape(self, surf, txt):
        texto(surf, txt, (cfg.LARGURA // 2, cfg.ALTURA - 24), 14, cfg.CINZA, centro=True)


# ===========================================================================
# Boot: simula a compilacao/upload na IDE do Arduino
# ===========================================================================
class TelaBoot(Tela):
    def __init__(self, app):
        super().__init__(app)
        self.linhas_visiveis = 0
        self.t_linha = 0
        self.prog = 0.0

    def atualizar(self, eventos):
        super().atualizar(eventos)
        self.t_linha += 1
        if self.linhas_visiveis < len(textos.BOOT) and self.t_linha > 9:
            self.t_linha = 0
            self.linhas_visiveis += 1
            self.audio.tocar("digitar", 0.8)
        self.prog = min(1.0, self.tempo / 130)
        pular = any(e.type in (pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN, pygame.JOYBUTTONDOWN) for e in eventos)
        if self.tempo > 170 or (pular and self.tempo > 10):
            self.app.trocar_cena(TelaTitulo(self.app))

    def desenhar(self, surf):
        surf.fill((22, 26, 28))
        # barra superior da "IDE"
        pygame.draw.rect(surf, cfg.AZUL_ARDUINO, (0, 0, cfg.LARGURA, 54))
        for i, sim in enumerate(("v", ">", "", "")):
            pygame.draw.circle(surf, cfg.AZUL_ARDUINO_ESCURO, (30 + i * 44, 27), 17)
            if sim:
                texto(surf, sim, (30 + i * 44, 27), 18, cfg.BRANCO, centro=True, sombra=False, negrito=True)
        texto(surf, "bitinho.ino | Arduino Builder", (220, 17), 18, cfg.BRANCO, sombra=False)
        # editor
        pygame.draw.rect(surf, (250, 250, 250), (0, 54, cfg.LARGURA, 230))
        codigo = [
            "void setup() {",
            "  Serial.begin(9600);",
            "  bitinho.acordar();",
            "}",
            "",
            "void loop() {",
            "  bitinho.salvarOMundo();  // ;)",
            "}",
        ]
        for i, l in enumerate(codigo):
            texto(surf, "%2d" % (i + 1), (12, 66 + i * 24), 16, (160, 160, 160), sombra=False, mono=True)
            cor = (0, 100, 110) if l.startswith("void") else (40, 40, 40)
            texto(surf, l, (52, 66 + i * 24), 16, cor, sombra=False, mono=True)
        # console
        pygame.draw.rect(surf, cfg.AZUL_ARDUINO, (0, 284, cfg.LARGURA, 26))
        msg = "Carregando..." if self.prog < 1 else "Carregado."
        texto(surf, msg, (12, 288), 15, cfg.BRANCO, sombra=False)
        pygame.draw.rect(surf, (20, 20, 20), (cfg.LARGURA - 260, 290, 240, 14))
        pygame.draw.rect(surf, cfg.VERDE_LED, (cfg.LARGURA - 260, 290, int(240 * self.prog), 14))
        pygame.draw.rect(surf, (0, 0, 0), (0, 310, cfg.LARGURA, cfg.ALTURA - 310))
        inicio = max(0, self.linhas_visiveis - 11)
        for i, l in enumerate(textos.BOOT[inicio:self.linhas_visiveis]):
            cor = cfg.BRANCO if "Aviso" not in l else cfg.LARANJA
            texto(surf, l, (12, 318 + i * 19), 14, cor, sombra=False, mono=True)
        texto(surf, "Pressione qualquer tecla", (cfg.LARGURA - 12, cfg.ALTURA - 22), 13, (90, 90, 90),
              direita=True, sombra=False)


# ===========================================================================
# Titulo
# ===========================================================================
class TelaTitulo(Tela):
    musica = "titulo"

    def __init__(self, app):
        super().__init__(app)
        self.fundo = FundoCircuito(11)
        self.selecao = 0
        self.confirmar_novo = False
        self.bitinho_x = -40.0
        self.montar_opcoes()

    def montar_opcoes(self):
        if self.save.tem_progresso:
            self.opcoes = ["Continuar", "Novo jogo", "Loja do Maker", "Conquistas", "Opcoes", "Creditos", "Sair"]
        else:
            self.opcoes = ["Novo jogo", "Conquistas", "Opcoes", "Creditos", "Sair"]

    def atualizar(self, eventos):
        super().atualizar(eventos)
        self.bitinho_x += 2.2
        if self.bitinho_x > cfg.LARGURA + 40:
            self.bitinho_x = -40
        if self.confirmar_novo:
            if self.ctrl.apertou("confirmar"):
                self.save.apagar()
                self.audio.tocar("confirmar")
                self.app.trocar_cena(TelaHistoria(self.app, textos.INTRO, "jogo0"))
            elif self.ctrl.apertou("voltar"):
                self.confirmar_novo = False
                self.audio.tocar("voltar")
            return
        self.selecao = self.menu_vertical(len(self.opcoes), self.selecao)
        for e in eventos:
            if e.type == pygame.MOUSEMOTION:
                for i in range(len(self.opcoes)):
                    if self._rect_opcao(i).collidepoint(e.pos):
                        self.selecao = i
            if e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                for i in range(len(self.opcoes)):
                    if self._rect_opcao(i).collidepoint(e.pos):
                        self.selecao = i
                        self._escolher()
                        return
        if self.ctrl.apertou("confirmar"):
            self._escolher()

    def _rect_opcao(self, i):
        return pygame.Rect(cfg.LARGURA // 2 - 130, 272 + i * 36, 260, 32)

    def _escolher(self):
        op = self.opcoes[self.selecao]
        self.audio.tocar("confirmar")
        if op == "Continuar":
            self.app.trocar_cena(TelaMapa(self.app, self.save.dados["nivel_liberado"]))
        elif op == "Novo jogo":
            if self.save.tem_progresso:
                self.confirmar_novo = True
            else:
                self.app.trocar_cena(TelaHistoria(self.app, textos.INTRO, "jogo0"))
        elif op == "Loja do Maker":
            self.app.trocar_cena(TelaLoja(self.app, voltar="titulo"))
        elif op == "Conquistas":
            self.app.trocar_cena(TelaConquistas(self.app))
        elif op == "Opcoes":
            self.app.trocar_cena(TelaOpcoes(self.app))
        elif op == "Creditos":
            self.app.trocar_cena(TelaCreditos(self.app))
        elif op == "Sair":
            self.app.rodando = False

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        # logo
        y = 110 + math.sin(self.tempo * 0.03) * 5
        g = brilho_cache(160, cfg.AZUL_ARDUINO, 50)
        surf.blit(g, (cfg.LARGURA // 2 - 160, int(y) - 160), special_flags=pygame.BLEND_ADD)
        desenhar_logo_arduino(surf, (cfg.LARGURA // 2, int(y) - 48), 1.1)
        for dx, dy, cor in ((4, 4, (0, 0, 0)), (0, 0, cfg.BRANCO)):
            img = render_texto("ARDUINO BUILDER", 58, cor, negrito=True)
            surf.blit(img, img.get_rect(center=(cfg.LARGURA // 2 + dx, int(y) + 20 + dy)))
        texto(surf, "A AVENTURA DO BITINHO", (cfg.LARGURA // 2, int(y) + 66), 22, cfg.AMARELO, centro=True,
              negrito=True)
        # opcoes
        for i, op in enumerate(self.opcoes):
            r = self._rect_opcao(i)
            sel = i == self.selecao
            if sel:
                painel(surf, r, (20, 70, 76), cfg.AMARELO, 220, 6, 2)
                img = self.sprites.quadro_bitinho("correr", self.tempo // 6, 1)
                surf.blit(img, (r.x - 40, r.centery - img.get_height() // 2 - 2))
            texto(surf, op, r.center, 20, cfg.AMARELO if sel else cfg.BRANCO, centro=True)
        # bitinho correndo no rodape
        img = self.sprites.quadro_bitinho("correr", self.tempo // 6, 1)
        surf.blit(img, (int(self.bitinho_x), cfg.ALTURA - 60))
        pygame.draw.line(surf, cfg.COBRE, (0, cfg.ALTURA - 22), (cfg.LARGURA, cfg.ALTURA - 22), 3)
        texto(surf, "v1.0  |  feito com Python + Pygame", (10, cfg.ALTURA - 18), 12, cfg.CINZA, sombra=False)
        texto(surf, "Setas + Enter", (cfg.LARGURA - 10, cfg.ALTURA - 18), 12, cfg.CINZA, direita=True,
              sombra=False)
        if self.confirmar_novo:
            s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
            s.fill((0, 0, 0, 180))
            surf.blit(s, (0, 0))
            r = pygame.Rect(cfg.LARGURA // 2 - 250, 190, 500, 160)
            painel(surf, r, (40, 10, 16), cfg.VERMELHO)
            texto(surf, "Apagar todo o progresso?", (r.centerx, r.y + 40), 24, cfg.BRANCO, centro=True,
                  negrito=True)
            texto(surf, "Isso reescreve a EEPROM do Bitinho!", (r.centerx, r.y + 76), 16, cfg.CINZA_CLARO,
                  centro=True)
            texto(surf, "Enter = Sim     Esc = Nao", (r.centerx, r.y + 118), 18, cfg.AMARELO, centro=True)


# ===========================================================================
# Historia (intro e final)
# ===========================================================================
class TelaHistoria(Tela):
    musica = "bancada"

    def __init__(self, app, linhas, destino):
        super().__init__(app)
        self.linhas = linhas
        self.destino = destino
        self.indice = 0
        self.chars = 0.0
        self.fundo = FundoCircuito(23, (14, 10, 24), (40, 30, 70))
        if destino == "creditos":
            self.audio.tocar_musica("vitoria")

    def atualizar(self, eventos):
        super().atualizar(eventos)
        atual = self.linhas[self.indice]
        if self.chars < len(atual):
            self.chars += 0.8
            if int(self.chars) % 4 == 0:
                self.audio.tocar("digitar", 0.5)
        if self.ctrl.apertou("confirmar") or self.ctrl.apertou("interagir"):
            if self.chars < len(atual):
                self.chars = len(atual)
            else:
                self.indice += 1
                self.chars = 0
                self.audio.tocar("menu")
                if self.indice >= len(self.linhas):
                    self._terminar()
        if self.ctrl.apertou("pausa"):
            self._terminar()

    def _terminar(self):
        self.save.dados["viu_intro"] = True
        self.save.salvar()
        if self.destino == "jogo0":
            from jogo import CenaJogo
            self.app.trocar_cena(CenaJogo(self.app, 0))
        elif self.destino == "creditos":
            self.app.trocar_cena(TelaCreditos(self.app, final=True))
        else:
            self.app.trocar_cena(TelaMapa(self.app))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        s.fill((0, 0, 0, 120))
        surf.blit(s, (0, 0))
        # ilustracao: bitinho e bancada
        cx, cy = cfg.LARGURA // 2, 200
        estado = "vitoria" if self.destino == "creditos" and self.indice > 3 else "parado"
        img = self.sprites.quadro_bitinho(estado, self.tempo // 20, 1)
        big = pygame.transform.scale(img, (img.get_width() * 4, img.get_height() * 4))
        surf.blit(big, big.get_rect(center=(cx, cy + math.sin(self.tempo * 0.05) * 6)))
        if self.destino == "jogo0" and 3 <= self.indice <= 4:
            for i in range(3):
                bx = cx + 160 + i * 40 + math.sin(self.tempo * 0.1 + i) * 10
                surf.blit(self.sprites.bug[(self.tempo // 8) % 2], (bx, cy + 30))
            surf.blit(self.sprites.glitch[(self.tempo // 5) % 4], (cx - 220, cy - 40))
        painel(surf, (80, 350, cfg.LARGURA - 160, 120), (10, 12, 20), cfg.AZUL_ARDUINO_CLARO, 230)
        atual = self.linhas[self.indice][:int(self.chars)]
        for i, l in enumerate(quebrar_texto(atual, 22, cfg.LARGURA - 220)):
            texto(surf, l, (cfg.LARGURA // 2, 385 + i * 30), 22, cfg.BRANCO, centro=True)
        texto(surf, "%d / %d" % (self.indice + 1, len(self.linhas)), (cfg.LARGURA - 92, 448), 13, cfg.CINZA,
              direita=True)
        self.rodape(surf, "Enter: avancar     Esc: pular")


# ===========================================================================
# Mapa de fases
# ===========================================================================
POSICOES_MAPA = [
    (80, 420),
    (170, 340), (240, 420), (310, 330), (380, 230),
    (460, 300), (530, 400), (600, 320), (670, 220),
    (740, 300), (800, 400), (860, 300), (880, 170),
]


class TelaMapa(Tela):
    def __init__(self, app, selecionado=None):
        super().__init__(app)
        self.liberado = self.save.dados["nivel_liberado"]
        if selecionado is None:
            selecionado = self.liberado
        self.selecao = clamp(selecionado, 0, self.liberado)
        self.fundo = FundoCircuito(5)
        self.cursor_pos = list(POSICOES_MAPA[self.selecao])
        mundo = niveis.NIVEIS[self.selecao]["mundo"]
        self.audio.tocar_musica(cfg.TEMAS_MUNDO[mundo]["musica"])

    def atualizar(self, eventos):
        super().atualizar(eventos)
        c = self.ctrl
        anterior = self.selecao
        if c.apertou("direita") or c.apertou("cima"):
            self.selecao = min(self.liberado, self.selecao + 1)
        if c.apertou("esquerda") or c.apertou("baixo"):
            self.selecao = max(0, self.selecao - 1)
        if self.selecao != anterior:
            self.audio.tocar("menu")
            mundo = niveis.NIVEIS[self.selecao]["mundo"]
            self.audio.tocar_musica(cfg.TEMAS_MUNDO[mundo]["musica"])
        for e in eventos:
            if e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                for i, p in enumerate(POSICOES_MAPA):
                    if i <= self.liberado and math.hypot(e.pos[0] - p[0], e.pos[1] - p[1]) < 20:
                        if i == self.selecao:
                            self._entrar()
                            return
                        self.selecao = i
                        self.audio.tocar("menu")
            if e.type == pygame.KEYDOWN and e.key == pygame.K_l:
                self.audio.tocar("confirmar")
                self.app.trocar_cena(TelaLoja(self.app, voltar="mapa", selecao_mapa=self.selecao))
                return
        alvo = POSICOES_MAPA[self.selecao]
        self.cursor_pos[0] += (alvo[0] - self.cursor_pos[0]) * 0.2
        self.cursor_pos[1] += (alvo[1] - self.cursor_pos[1]) * 0.2
        if c.apertou("confirmar"):
            self._entrar()
        elif c.apertou("voltar"):
            self.audio.tocar("voltar")
            self.app.trocar_cena(TelaTitulo(self.app))

    def _entrar(self):
        from jogo import CenaJogo
        self.audio.tocar("confirmar")
        self.app.trocar_cena(CenaJogo(self.app, self.selecao))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        s.fill((0, 0, 0, 90))
        surf.blit(s, (0, 0))
        # regioes dos mundos
        regioes = [(0, 0, 1), (1, 1, 5), (2, 5, 9), (3, 9, 13)]
        for mundo, a, b in regioes:
            pts = POSICOES_MAPA[a:b]
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            r = pygame.Rect(min(xs) - 40, min(ys) - 50, max(xs) - min(xs) + 80, max(ys) - min(ys) + 100)
            tema = cfg.TEMAS_MUNDO[mundo]
            painel(surf, r, tema["ceu_base"], tema["detalhe"], 120, 16, 2)
            texto(surf, tema["nome"], (r.centerx, r.y + 12), 13, cfg.BRANCO, centro=True)
        # trilhas entre os niveis
        for i in range(len(POSICOES_MAPA) - 1):
            a, b = POSICOES_MAPA[i], POSICOES_MAPA[i + 1]
            liberada = i + 1 <= self.liberado
            cor = cfg.COBRE_CLARO if liberada else (60, 60, 60)
            meio = (b[0], a[1])
            pygame.draw.lines(surf, cor, False, [a, meio, b], 5 if liberada else 3)
            if liberada:
                t = (self.tempo * 0.02 + i * 0.3) % 1
                if t < 0.5:
                    p = (a[0] + (meio[0] - a[0]) * t * 2, a[1])
                else:
                    p = (b[0], meio[1] + (b[1] - meio[1]) * (t - 0.5) * 2)
                g = brilho_cache(10, cfg.AMARELO, 150)
                surf.blit(g, (int(p[0]) - 10, int(p[1]) - 10), special_flags=pygame.BLEND_ADD)
        # nos
        for i, (x, y) in enumerate(POSICOES_MAPA):
            d = niveis.NIVEIS[i]
            concluido = d["id"] in self.save.dados["concluidos"]
            liberado = i <= self.liberado
            chefe = "chefe" in d
            raio = 18 if chefe else 14
            if not liberado:
                pygame.draw.circle(surf, (40, 40, 44), (x, y), raio)
                pygame.draw.circle(surf, (80, 80, 86), (x, y), raio, 2)
                pygame.draw.rect(surf, (110, 110, 116), (x - 5, y - 2, 10, 8))
                pygame.draw.arc(surf, (110, 110, 116), (x - 4, y - 9, 8, 10), 0, math.pi, 2)
                continue
            cor = cfg.VERDE_LED if concluido else (cfg.VERMELHO if chefe else cfg.AMARELO)
            g = brilho_cache(raio * 2, cor, 90)
            surf.blit(g, (x - raio * 2, y - raio * 2), special_flags=pygame.BLEND_ADD)
            pygame.draw.circle(surf, (20, 20, 24), (x, y), raio)
            pygame.draw.circle(surf, cor, (x, y), raio - 4)
            pygame.draw.circle(surf, lerp_cor(cor, cfg.BRANCO, 0.6), (x - 3, y - 3), 3)
            if chefe:
                texto(surf, "!", (x, y), 18, (40, 0, 0), centro=True, sombra=False, negrito=True)
            texto(surf, d["id"], (x, y + raio + 10), 12, cfg.BRANCO, centro=True)
            rank = self.save.dados["ranks"].get(d["id"])
            if rank:
                texto(surf, rank, (x + raio, y - raio - 4), 13, cfg.OURO, centro=True, negrito=True)
        # bitinho no cursor
        img = self.sprites.quadro_bitinho("parado", self.tempo // 20, 1)
        cx, cy = self.cursor_pos
        surf.blit(img, (int(cx - img.get_width() / 2), int(cy - 50 + math.sin(self.tempo * 0.1) * 3)))
        # painel de informacoes
        d = niveis.NIVEIS[self.selecao]
        painel(surf, (20, 14, 440, 118), (10, 14, 22), cfg.AZUL_ARDUINO_CLARO, 230)
        texto(surf, "%s  %s" % (d["id"], d["nome"]), (36, 24), 22, cfg.BRANCO, negrito=True)
        texto(surf, cfg.TEMAS_MUNDO[d["mundo"]]["nome"], (36, 52), 14, cfg.CINZA_CLARO)
        melhor = self.save.dados["melhores_tempos"].get(d["id"])
        texto(surf, "Melhor tempo: %s" % (formatar_tempo(melhor) if melhor else "--:--.--"), (36, 74), 15,
              cfg.BRANCO, mono=True)
        rank = self.save.dados["ranks"].get(d["id"], "-")
        texto(surf, "Rank: %s" % rank, (36, 98), 15, cfg.OURO, mono=True)
        tot = niveis.total_componentes(self.selecao)
        if tot:
            col = self.save.componentes_nivel(d["id"])
            for k in range(3):
                ic = self.sprites.componentes[k]
                r = pygame.Rect(300 + k * 44, 70, 38, 40)
                pygame.draw.rect(surf, (20, 24, 32), r, border_radius=6)
                if k in col:
                    surf.blit(ic, ic.get_rect(center=r.center))
                else:
                    texto(surf, "?", r.center, 18, (70, 76, 90), centro=True, sombra=False)
        # bytes
        painel(surf, (cfg.LARGURA - 200, 14, 180, 44), (10, 14, 22), cfg.OURO_ESCURO, 230)
        surf.blit(self.sprites.byte[(self.tempo // 6) % 8], (cfg.LARGURA - 188, 28))
        texto(surf, "%d" % self.save.dados["bytes"], (cfg.LARGURA - 34, 22), 22, cfg.OURO, direita=True,
              mono=True, negrito=True)
        texto(surf, "Componentes: %d" % self.save.total_componentes(), (cfg.LARGURA - 20, 66), 14,
              cfg.CINZA_CLARO, direita=True)
        self.rodape(surf, "Setas: escolher   Enter: jogar   L: Loja do Maker   Esc: voltar")


# ===========================================================================
# Loja do Maker
# ===========================================================================
class TelaLoja(Tela):
    musica = "bancada"

    def __init__(self, app, voltar="titulo", selecao_mapa=None):
        super().__init__(app)
        self.voltar = voltar
        self.selecao_mapa = selecao_mapa
        self.selecao = 0
        self.fundo = FundoCircuito(31, (24, 16, 10), (70, 46, 24))
        self.msg = "Ola, maker! O que vai levar hoje?"
        self.t_msg = 0
        self.flash = 0

    def atualizar(self, eventos):
        super().atualizar(eventos)
        self.selecao = self.menu_vertical(len(textos.UPGRADES), self.selecao)
        if self.flash > 0:
            self.flash -= 1
        if self.ctrl.apertou("confirmar"):
            info = textos.UPGRADES[self.selecao]
            nivel = self.save.upgrade(info["id"])
            if nivel >= info["max"]:
                self.msg = "Voce ja tem o maximo desse item!"
                self.audio.tocar("erro")
            elif self.save.dados["bytes"] < info["preco"]:
                falta = info["preco"] - self.save.dados["bytes"]
                self.msg = "Faltam %d bytes. Volte com mais dados!" % falta
                self.audio.tocar("erro")
            elif self.save.comprar(info):
                self.msg = "%s instalado! Otima escolha." % info["nome"]
                self.audio.tocar("powerup")
                self.flash = 20
        if self.ctrl.apertou("voltar"):
            self.audio.tocar("voltar")
            if self.voltar == "mapa":
                self.app.trocar_cena(TelaMapa(self.app, self.selecao_mapa))
            else:
                self.app.trocar_cena(TelaTitulo(self.app))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        texto(surf, "LOJA DO MAKER", (cfg.LARGURA // 2, 36), 38, cfg.OURO, centro=True, negrito=True)
        # vendedor
        img = self.sprites.prof_volt[(self.tempo // 20) % 2]
        big = pygame.transform.scale(img, (img.get_width() * 3, img.get_height() * 3))
        surf.blit(big, (40, 110))
        painel(surf, (24, 270, 200, 110), (14, 14, 18), cfg.OURO, 230)
        for i, l in enumerate(quebrar_texto(self.msg, 15, 176)[:5]):
            texto(surf, l, (36, 282 + i * 19), 15, cfg.BRANCO)
        # bytes
        painel(surf, (24, 400, 200, 48), (14, 14, 18), cfg.OURO_ESCURO, 230)
        surf.blit(self.sprites.byte[(self.tempo // 6) % 8], (38, 416))
        texto(surf, "%d bytes" % self.save.dados["bytes"], (64, 412), 22, cfg.OURO, negrito=True)
        # lista
        x0 = 250
        for i, info in enumerate(textos.UPGRADES):
            y = 78 + i * 62
            r = pygame.Rect(x0, y, cfg.LARGURA - x0 - 30, 56)
            sel = i == self.selecao
            nivel = self.save.upgrade(info["id"])
            maximo = nivel >= info["max"]
            cor_borda = cfg.AMARELO if sel else (80, 70, 50)
            painel(surf, r, (30, 26, 20) if not sel else (60, 50, 30), cor_borda, 235, 8, 2)
            icone = pygame.Rect(r.x + 10, r.y + 8, 40, 40)
            pygame.draw.rect(surf, (20, 18, 14), icone, border_radius=6)
            surf.blit(self.sprites.chip_upgrade, self.sprites.chip_upgrade.get_rect(center=icone.center))
            texto(surf, info["nome"], (r.x + 62, r.y + 6), 19, cfg.BRANCO if not maximo else cfg.VERDE_LED,
                  negrito=True)
            texto(surf, info["desc"], (r.x + 62, r.y + 32), 13, cfg.CINZA_CLARO, sombra=False)
            if info["max"] > 1:
                for k in range(info["max"]):
                    cor = cfg.VERDE_LED if k < nivel else (60, 60, 60)
                    pygame.draw.rect(surf, cor, (r.right - 180 + k * 16, r.y + 12, 12, 8), border_radius=2)
            if maximo:
                texto(surf, "INSTALADO", (r.right - 16, r.y + 28), 16, cfg.VERDE_LED, direita=True, negrito=True)
            else:
                pode = self.save.dados["bytes"] >= info["preco"]
                texto(surf, "%d B" % info["preco"], (r.right - 16, r.y + 28), 18,
                      cfg.OURO if pode else cfg.VERMELHO, direita=True, mono=True, negrito=True)
        if self.flash:
            s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
            s.fill((255, 230, 120, self.flash * 5))
            surf.blit(s, (0, 0))
        self.rodape(surf, "Setas: escolher   Enter: comprar   Esc: voltar")


# ===========================================================================
# Conquistas
# ===========================================================================
class TelaConquistas(Tela):
    def __init__(self, app):
        super().__init__(app)
        self.fundo = FundoCircuito(41, (20, 18, 6), (60, 50, 20))
        self.rolagem = 0.0

    def atualizar(self, eventos):
        super().atualizar(eventos)
        if self.ctrl.segurando("baixo"):
            self.rolagem += 6
        if self.ctrl.segurando("cima"):
            self.rolagem -= 6
        for e in eventos:
            if e.type == pygame.MOUSEWHEEL:
                self.rolagem -= e.y * 30
        linhas = (len(textos.CONQUISTAS) + 1) // 2
        self.rolagem = clamp(self.rolagem, 0, max(0, linhas * 76 - 380))
        if self.ctrl.apertou("voltar") or self.ctrl.apertou("confirmar"):
            self.audio.tocar("voltar")
            self.app.trocar_cena(TelaTitulo(self.app))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        feitas = self.save.dados["conquistas"]
        texto(surf, "CONQUISTAS", (cfg.LARGURA // 2, 36), 36, cfg.OURO, centro=True, negrito=True)
        texto(surf, "%d / %d desbloqueadas" % (len(feitas), len(textos.CONQUISTAS)), (cfg.LARGURA // 2, 70), 16,
              cfg.CINZA_CLARO, centro=True)
        area = pygame.Rect(40, 96, cfg.LARGURA - 80, 390)
        antiga = surf.get_clip()
        surf.set_clip(area)
        for i, c in enumerate(textos.CONQUISTAS):
            col, lin = i % 2, i // 2
            r = pygame.Rect(area.x + col * (area.w // 2 + 4), area.y + lin * 76 - int(self.rolagem),
                            area.w // 2 - 8, 68)
            ok = c["id"] in feitas
            painel(surf, r, (40, 34, 10) if ok else (24, 24, 28), cfg.OURO if ok else (70, 70, 76), 235, 8, 2)
            pygame.draw.circle(surf, cfg.OURO if ok else (60, 60, 66), (r.x + 34, r.centery), 22)
            texto(surf, "*" if ok else "?", (r.x + 34, r.centery), 28, (80, 60, 10) if ok else (100, 100, 110),
                  centro=True, sombra=False, negrito=True)
            texto(surf, c["nome"] if ok else "???", (r.x + 68, r.y + 12), 18,
                  cfg.BRANCO if ok else cfg.CINZA, negrito=True)
            texto(surf, c["desc"], (r.x + 68, r.y + 40), 13, cfg.CINZA_CLARO if ok else (100, 100, 110),
                  sombra=False)
        surf.set_clip(antiga)
        e = self.save.estat
        resumo = "Inimigos: %d   Mortes: %d   Pulos: %d   Puzzles: %d   Tempo: %s" % (
            e["inimigos"], e["mortes"], e["pulos"], e["puzzles"], formatar_tempo(e["tempo_total"]))
        texto(surf, resumo, (cfg.LARGURA // 2, cfg.ALTURA - 44), 14, cfg.BRANCO, centro=True, mono=True)
        self.rodape(surf, "Setas/roda do mouse: rolar   Esc: voltar")


# ===========================================================================
# Opcoes
# ===========================================================================
class TelaOpcoes(Tela):
    def __init__(self, app):
        super().__init__(app)
        self.fundo = FundoCircuito(51)
        self.selecao = 0
        self.confirmando_apagar = False
        self.itens = ["volume_sfx", "volume_musica", "tela_cheia", "mostrar_fps", "tremor_tela",
                      "serial_monitor", "apagar", "voltar"]
        self.nomes = {
            "volume_sfx": "Volume dos efeitos",
            "volume_musica": "Volume da musica",
            "tela_cheia": "Tela cheia",
            "mostrar_fps": "Mostrar FPS",
            "tremor_tela": "Tremor de tela",
            "serial_monitor": "Serial Monitor na HUD",
            "apagar": "Apagar progresso",
            "voltar": "Voltar",
        }

    def atualizar(self, eventos):
        super().atualizar(eventos)
        op = self.save.opcoes
        if self.confirmando_apagar:
            if self.ctrl.apertou("confirmar"):
                self.save.apagar()
                self.audio.tocar("explosao")
                self.confirmando_apagar = False
            elif self.ctrl.apertou("voltar"):
                self.confirmando_apagar = False
            return
        self.selecao = self.menu_vertical(len(self.itens), self.selecao)
        item = self.itens[self.selecao]
        dx = (1 if self.ctrl.apertou("direita") else 0) - (1 if self.ctrl.apertou("esquerda") else 0)
        if item in ("volume_sfx", "volume_musica") and dx:
            op[item] = round(clamp(op[item] + dx * 0.1, 0.0, 1.0), 2)
            self.audio.definir_volumes(op["volume_sfx"], op["volume_musica"])
            self.audio.tocar("bip")
        if self.ctrl.apertou("confirmar") or (dx and item not in ("volume_sfx", "volume_musica")):
            if item in ("tela_cheia", "mostrar_fps", "tremor_tela", "serial_monitor"):
                op[item] = not op[item]
                self.audio.tocar("confirmar")
                if item == "tela_cheia":
                    self.app.aplicar_tela_cheia()
            elif item == "apagar" and self.ctrl.apertou("confirmar"):
                self.confirmando_apagar = True
                self.audio.tocar("alerta")
            elif item == "voltar" and self.ctrl.apertou("confirmar"):
                self._sair()
        if self.ctrl.apertou("voltar"):
            self._sair()

    def _sair(self):
        self.save.salvar()
        self.audio.tocar("voltar")
        self.app.trocar_cena(TelaTitulo(self.app))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        texto(surf, "OPCOES", (cfg.LARGURA // 2, 44), 38, cfg.BRANCO, centro=True, negrito=True)
        op = self.save.opcoes
        for i, item in enumerate(self.itens):
            y = 110 + i * 48
            r = pygame.Rect(180, y - 18, cfg.LARGURA - 360, 40)
            sel = i == self.selecao
            painel(surf, r, (20, 60, 66) if sel else (14, 20, 26), cfg.AMARELO if sel else (50, 60, 70), 220, 6, 2)
            texto(surf, self.nomes[item], (r.x + 20, y - 10), 19, cfg.AMARELO if sel else cfg.BRANCO)
            if item in ("volume_sfx", "volume_musica"):
                v = op[item]
                barra = pygame.Rect(r.right - 230, y - 6, 200, 12)
                pygame.draw.rect(surf, (30, 30, 36), barra, border_radius=5)
                pygame.draw.rect(surf, cfg.AZUL_ARDUINO_CLARO, (barra.x, barra.y, int(barra.w * v), barra.h),
                                 border_radius=5)
                texto(surf, "%d%%" % int(v * 100), (barra.right + 8, y - 10), 15, cfg.CINZA_CLARO)
            elif item in ("tela_cheia", "mostrar_fps", "tremor_tela", "serial_monitor"):
                ligado = op[item]
                texto(surf, "LIGADO" if ligado else "DESLIGADO", (r.right - 20, y - 10), 17,
                      cfg.VERDE_LED if ligado else cfg.VERMELHO, direita=True, negrito=True)
        if self.confirmando_apagar:
            s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
            s.fill((0, 0, 0, 180))
            surf.blit(s, (0, 0))
            texto(surf, "Apagar TODO o progresso? Enter = sim, Esc = nao", (cfg.LARGURA // 2, cfg.ALTURA // 2), 22,
                  cfg.VERMELHO, centro=True, negrito=True)
        self.rodape(surf, "Setas: navegar/ajustar   Enter: alternar   Esc: voltar")


# ===========================================================================
# Creditos
# ===========================================================================
class TelaCreditos(Tela):
    musica = "vitoria"

    def __init__(self, app, final=False):
        super().__init__(app)
        self.final = final
        self.fundo = FundoCircuito(61, (8, 8, 20), (30, 30, 70))
        self.y = cfg.ALTURA + 20.0
        self.fogos = []

    def atualizar(self, eventos):
        super().atualizar(eventos)
        self.y -= 0.9 if not self.ctrl.segurando("confirmar") else 4
        altura_total = len(textos.CREDITOS) * 36
        if self.final and self.tempo % 40 == 0:
            self.fogos.append([random.randint(100, cfg.LARGURA - 100), random.randint(60, 250), 0,
                               random.choice([cfg.VERDE_LED, cfg.CIANO, cfg.OURO, cfg.ROSA])])
        for f in self.fogos:
            f[2] += 1
        self.fogos = [f for f in self.fogos if f[2] < 60]
        if self.y < -altura_total - 40 or self.ctrl.apertou("voltar"):
            self.audio.tocar("voltar")
            if self.final:
                self.app.trocar_cena(TelaMapa(self.app))
            else:
                self.app.trocar_cena(TelaTitulo(self.app))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        s.fill((0, 0, 0, 120))
        surf.blit(s, (0, 0))
        for x, y, t, cor in self.fogos:
            for k in range(16):
                a = k / 16 * math.tau
                r = t * 2.2
                px = x + math.cos(a) * r
                py = y + math.sin(a) * r + t * t * 0.02
                pygame.draw.circle(surf, lerp_cor(cor, (0, 0, 0), t / 60), (int(px), int(py)), 3)
        y = self.y
        for linha, estilo in textos.CREDITOS:
            if -40 < y < cfg.ALTURA + 40:
                if estilo == "titulo":
                    texto(surf, linha, (cfg.LARGURA // 2, y), 50, cfg.BRANCO, centro=True, negrito=True)
                    desenhar_logo_arduino(surf, (cfg.LARGURA // 2, int(y) - 56), 0.8)
                elif estilo == "sub":
                    texto(surf, linha, (cfg.LARGURA // 2, y), 24, cfg.AMARELO, centro=True)
                elif estilo == "cabecalho":
                    texto(surf, linha, (cfg.LARGURA // 2, y), 22, cfg.AZUL_ARDUINO_CLARO, centro=True, negrito=True)
                elif estilo == "codigo":
                    texto(surf, linha, (cfg.LARGURA // 2, y), 18, cfg.VERDE_LED, centro=True, mono=True)
                else:
                    texto(surf, linha, (cfg.LARGURA // 2, y), 18, cfg.BRANCO, centro=True)
            y += 36
        img = self.sprites.quadro_bitinho("correr", self.tempo // 6, 1)
        surf.blit(img, ((self.tempo * 2) % (cfg.LARGURA + 60) - 40, cfg.ALTURA - 60))
        self.rodape(surf, "Segure Enter para acelerar   Esc: sair")


# ===========================================================================
# Resultado do nivel
# ===========================================================================
class TelaResultado(Tela):
    musica = "vitoria"

    def __init__(self, app, resultado):
        super().__init__(app)
        self.r = resultado
        self.fundo = FundoCircuito(71)
        self.contador_bytes = 0.0
        self.etapa_carimbo = 0
        self.audio.tocar("vitoria")

    def atualizar(self, eventos):
        super().atualizar(eventos)
        if self.tempo > 40:
            antes = int(self.contador_bytes)
            self.contador_bytes = min(self.r["bytes"], self.contador_bytes + max(1, self.r["bytes"] / 60))
            if int(self.contador_bytes) != antes and self.tempo % 3 == 0:
                self.audio.tocar("byte", 0.3)
        if self.tempo == 130:
            self.audio.tocar("explosao", 0.6)
        if self.tempo > 60 and self.ctrl.apertou("confirmar"):
            self.audio.tocar("confirmar")
            if self.r["id"] == "3-C" and not self.save.dados.get("zerou"):
                self.save.dados["zerou"] = True
                self.save.salvar()
                self.app.trocar_cena(TelaHistoria(self.app, textos.FINAL, "creditos"))
            else:
                prox = min(self.r["indice"] + 1, len(niveis.NIVEIS) - 1)
                self.app.trocar_cena(TelaMapa(self.app, prox))

    def desenhar(self, surf):
        self.fundo.desenhar(surf, self.tempo)
        r = self.r
        k = ease_out_back(min(1.0, self.tempo / 30))
        painel(surf, (cfg.LARGURA // 2 - 330, 40, 660, 440), (10, 16, 22), cfg.VERDE_LED, 235)
        texto(surf, "UPLOAD CONCLUIDO!", (cfg.LARGURA // 2, 40 + int(40 * k)), 38, cfg.VERDE_LED, centro=True,
              negrito=True)
        texto(surf, "%s - %s" % (r["id"], r["nome"]), (cfg.LARGURA // 2, 118), 20, cfg.BRANCO, centro=True)
        x = cfg.LARGURA // 2 - 290
        y = 160
        linhas = [
            ("Tempo", formatar_tempo(r["tempo"])),
            ("Bytes coletados", "%d" % int(self.contador_bytes)),
            ("Inimigos eliminados", "%d" % r["inimigos"]),
            ("Danos sofridos", "%d" % r["danos"]),
            ("Resets (mortes)", "%d" % r["mortes"]),
        ]
        for i, (nome, valor) in enumerate(linhas):
            if self.tempo > 20 + i * 12:
                texto(surf, nome, (x, y + i * 38), 20, cfg.CINZA_CLARO)
                texto(surf, valor, (x + 360, y + i * 38), 20, cfg.BRANCO, direita=True, mono=True)
        if r["melhor_anterior"] is not None and r["tempo"] < r["melhor_anterior"] and self.tempo > 40:
            texto(surf, "NOVO RECORDE!", (x + 370, y + 2), 14, cfg.OURO, negrito=True)
        # componentes
        if r["total_componentes"]:
            texto(surf, "Componentes:", (x, 360), 20, cfg.CINZA_CLARO)
            for i in range(3):
                rr = pygame.Rect(x + 150 + i * 50, 350, 42, 42)
                pygame.draw.rect(surf, (24, 28, 36), rr, border_radius=6)
                if i in r["componentes"]:
                    ic = self.sprites.componentes[i]
                    surf.blit(ic, ic.get_rect(center=rr.center))
                    if i in r["novos_componentes"]:
                        texto(surf, "NOVO", (rr.centerx, rr.bottom + 8), 11, cfg.OURO, centro=True)
        # rank (carimbo)
        if self.tempo > 120:
            t = min(1.0, (self.tempo - 120) / 14)
            escala = 3 - 2 * ease_out_cubic(t)
            cores = {"S": cfg.OURO, "A": cfg.VERDE_LED, "B": cfg.CIANO, "C": cfg.CINZA_CLARO}
            img = render_texto(r["rank"], 110, cores[r["rank"]], negrito=True)
            img = pygame.transform.rotozoom(img, -12, escala)
            cx, cy = cfg.LARGURA // 2 + 200, 290
            pygame.draw.circle(surf, cores[r["rank"]], (cx, cy), int(78 * min(1.0, 1 / escala * 1.0)), 4)
            surf.blit(img, img.get_rect(center=(cx, cy)))
            texto(surf, "RANK", (cx, cy - 96), 18, cfg.BRANCO, centro=True, negrito=True)
        if self.tempo > 60 and (self.tempo // 25) % 2:
            texto(surf, "Pressione Enter para continuar", (cfg.LARGURA // 2, 450), 18, cfg.AMARELO, centro=True)
