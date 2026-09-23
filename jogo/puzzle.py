"""
Minijogos de terminal:

1) PuzzleCircuito - gire pecas de fio para levar energia do pino 5V ate os
   LEDs. Mas cuidado: todo LED precisa de um RESISTOR em serie, senao ele
   queima! (Exatamente como na vida real com o Arduino.)

2) QuizArduino - perguntas de multipla escolha sobre Arduino e eletronica.
"""

import math
import random

import pygame

import config as cfg
from util import texto, painel, quebrar_texto, lerp_cor, brilho_cache, render_texto

N, L, S, O = 0, 1, 2, 3  # norte, leste, sul, oeste
DELTAS = {N: (0, -1), L: (1, 0), S: (0, 1), O: (-1, 0)}
OPOSTO = {N: S, S: N, L: O, O: L}


def rotacionar_dirs(dirs, vezes):
    return frozenset((d + vezes) % 4 for d in dirs)


class Peca:
    def __init__(self, tipo, dirs, fixa=False):
        self.tipo = tipo            # "fio", "resistor", "fonte", "led", "vazio"
        self.base = frozenset(dirs)
        self.rot = 0
        self.rot_correta = 0
        self.fixa = fixa
        self.anim = 0.0             # animacao de rotacao
        self.energizada = False
        self.estado_led = None      # None, "ok", "queimado"

    @property
    def dirs(self):
        return rotacionar_dirs(self.base, self.rot)

    def girar(self, sentido=1):
        if self.fixa or self.tipo == "vazio":
            return False
        self.rot = (self.rot + sentido) % 4
        self.anim = -sentido * 90.0
        return True

    @property
    def forma(self):
        d = self.base
        if len(d) == 2:
            a, b = sorted(d)
            return "reto" if (b - a) == 2 else "curva"
        if len(d) == 3:
            return "T"
        if len(d) == 4:
            return "cruz"
        return "ponta"


class PuzzleCircuito:
    TAM_CELULA = 64

    def __init__(self, largura, altura, num_leds, semente, audio, ao_terminar, fundo=None):
        self.w = largura
        self.h = altura
        self.num_leds = num_leds
        self.audio = audio
        self.ao_terminar = ao_terminar
        self.fundo = fundo
        self.rng = random.Random(semente)
        self.cursor = [0, 0]
        self.movimentos = 0
        self.dicas_usadas = 0
        self.resolvido = False
        self.t_resolvido = 0
        self.tempo = 0
        self.mensagem = ""
        self.t_mensagem = 0
        self.queimou_alguma = False
        self.fumacas = []
        self.gerar()
        self.avaliar()

    # ------------------------------------------------------------------
    # Geracao garantidamente resolvivel
    # ------------------------------------------------------------------
    def gerar(self):
        for tentativa in range(200):
            if self._tentar_gerar():
                break
        # embaralha rotacoes
        for y in range(self.h):
            for x in range(self.w):
                p = self.grade[y][x]
                if p.tipo in ("fio", "resistor"):
                    p.rot_correta = 0
                    if p.forma != "cruz":
                        p.rot = self.rng.randint(0, 3)
                        # nao deixar peca ja na posicao certa com frequencia
                        if p.rot == 0 and self.rng.random() < 0.7:
                            p.rot = self.rng.randint(1, 3)
        self._normalizar_rot_corretas()

    def _normalizar_rot_corretas(self):
        # Para pecas simetricas (retas), duas rotacoes sao corretas; guardamos a original (0)
        pass

    def _tentar_gerar(self):
        w, h = self.w, self.h
        conexoes = {}
        tipos = {}
        fy = self.rng.randint(0, h - 1)
        fonte = (0, fy)
        conexoes[fonte] = {L}
        tipos[fonte] = "fonte"
        self.fonte = fonte
        self.leds = []
        ocupadas = {fonte}
        for i in range(self.num_leds):
            candidatos = [(x, y) for x in range(w // 2, w) for y in range(h)
                          if (x, y) not in ocupadas and self._vizinhos_livres((x, y), ocupadas)]
            if not candidatos:
                return False
            alvo = self.rng.choice(candidatos)
            if i == 0:
                inicio = [((1, fy), fonte)]
                if (1, fy) in ocupadas:
                    return False
            else:
                inicio = [(c, None) for c, t in tipos.items() if t == "fio" and len(conexoes[c]) < 4]
                if not inicio:
                    return False
            caminho = self._buscar_caminho(inicio, alvo, ocupadas)
            if caminho is None:
                return False
            # caminho: lista de celulas novas; a primeira conecta a "origem"
            origem, celulas = caminho
            # conecta origem -> primeira celula
            anterior = origem
            for c in celulas:
                d = self._direcao(anterior, c)
                conexoes.setdefault(anterior, set()).add(d)
                conexoes.setdefault(c, set()).add(OPOSTO[d])
                tipos.setdefault(c, "fio")
                ocupadas.add(c)
                anterior = c
            d = self._direcao(anterior, alvo)
            conexoes[anterior].add(d)
            conexoes[alvo] = {OPOSTO[d]}
            tipos[alvo] = "led"
            ocupadas.add(alvo)
            self.leds.append(alvo)
            # escolhe um trecho reto do ramo novo para virar resistor
            retos = [c for c in celulas if len(conexoes[c]) == 2 and
                     sorted(conexoes[c])[1] - sorted(conexoes[c])[0] == 2]
            if not retos:
                return False
            tipos[self.rng.choice(retos)] = "resistor"
        # verifica se algum resistor virou juncao depois (ramos posteriores)
        for c, t in tipos.items():
            if t == "resistor" and len(conexoes[c]) != 2:
                return False
        # monta grade
        self.grade = [[Peca("vazio", ()) for _ in range(w)] for _ in range(h)]
        for (x, y), dirs in conexoes.items():
            t = tipos[(x, y)]
            self.grade[y][x] = Peca(t, dirs, fixa=t in ("fonte", "led"))
            self.grade[y][x].solucao = True
        # pecas de distracao
        formas = [{N, S}, {N, L}, {N, L, S}, {N, S}, {N, L}]
        for y in range(h):
            for x in range(w):
                if self.grade[y][x].tipo == "vazio" and self.rng.random() < 0.7:
                    self.grade[y][x] = Peca("fio", self.rng.choice(formas))
                    self.grade[y][x].solucao = False
        return True

    def _vizinhos_livres(self, c, ocupadas):
        for d, (dx, dy) in DELTAS.items():
            n = (c[0] + dx, c[1] + dy)
            if 0 <= n[0] < self.w and 0 <= n[1] < self.h and n not in ocupadas:
                return True
        return False

    @staticmethod
    def _direcao(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        for d, (ddx, ddy) in DELTAS.items():
            if (dx, dy) == (ddx, ddy):
                return d
        raise ValueError("celulas nao adjacentes")

    def _buscar_caminho(self, inicios, alvo, ocupadas):
        """DFS aleatoria: encontra caminho de celulas livres ate vizinho do alvo."""
        self.rng.shuffle(inicios)
        for primeira, origem_fixa in inicios:
            if origem_fixa is not None:
                # primeira celula ja e a proxima livre; origem e a fonte
                if primeira in ocupadas:
                    continue
                pilha = [(primeira, [primeira])]
                origem = origem_fixa
            else:
                origem = primeira
                pilha = []
                vizinhos = list(DELTAS.items())
                self.rng.shuffle(vizinhos)
                for d, (dx, dy) in vizinhos:
                    n = (origem[0] + dx, origem[1] + dy)
                    if self._livre(n, ocupadas, alvo):
                        pilha.append((n, [n]))
            visitados = set()
            while pilha:
                atual, caminho = pilha.pop()
                if atual in visitados or len(caminho) > self.w * self.h // 2:
                    continue
                visitados.add(atual)
                if abs(atual[0] - alvo[0]) + abs(atual[1] - alvo[1]) == 1 and len(caminho) >= 2:
                    return origem, caminho
                vizinhos = list(DELTAS.values())
                self.rng.shuffle(vizinhos)
                for dx, dy in vizinhos:
                    n = (atual[0] + dx, atual[1] + dy)
                    if self._livre(n, ocupadas, alvo) and n not in caminho:
                        pilha.append((n, caminho + [n]))
        return None

    def _livre(self, c, ocupadas, alvo):
        return (0 <= c[0] < self.w and 0 <= c[1] < self.h and c not in ocupadas and c != alvo)

    # ------------------------------------------------------------------
    # Simulacao da corrente
    # ------------------------------------------------------------------
    def avaliar(self):
        for linha in self.grade:
            for p in linha:
                p.energizada = False
                if p.tipo == "led":
                    p.estado_led = None
        fx, fy = self.fonte
        fila = [(fx, fy, False)]
        vistos = set()
        leds_ok = set()
        leds_queimados = set()
        while fila:
            x, y, com_resistor = fila.pop(0)
            if (x, y, com_resistor) in vistos:
                continue
            vistos.add((x, y, com_resistor))
            p = self.grade[y][x]
            p.energizada = True
            if p.tipo == "led":
                if com_resistor:
                    leds_ok.add((x, y))
                else:
                    leds_queimados.add((x, y))
                continue
            for d in p.dirs:
                dx, dy = DELTAS[d]
                nx, ny = x + dx, y + dy
                if not (0 <= nx < self.w and 0 <= ny < self.h):
                    continue
                q = self.grade[ny][nx]
                if q.tipo == "vazio" or q.tipo == "fonte":
                    continue
                if OPOSTO[d] in q.dirs:
                    fila.append((nx, ny, com_resistor or q.tipo == "resistor"))
        for (x, y) in leds_ok:
            self.grade[y][x].estado_led = "ok"
        for (x, y) in leds_queimados:
            self.grade[y][x].estado_led = "queimado"
        self.leds_ok = leds_ok
        self.leds_queimados = leds_queimados
        return len(leds_queimados) == 0 and len(leds_ok) == len(self.leds)

    # ------------------------------------------------------------------
    # Interacao
    # ------------------------------------------------------------------
    def _geometria(self):
        tam = self.TAM_CELULA
        gw, gh = self.w * tam, self.h * tam
        ox = 60 + (560 - gw) // 2
        oy = 90 + (400 - gh) // 2
        return ox, oy, tam

    def girar(self, x, y, sentido=1):
        if self.resolvido:
            return
        p = self.grade[y][x]
        if p.girar(sentido):
            self.movimentos += 1
            self.audio.tocar("rotacionar", 0.6)
            queimados_antes = set(self.leds_queimados)
            ok = self.avaliar()
            novos = self.leds_queimados - queimados_antes
            if novos:
                self.audio.tocar("led_queimou", 0.6)
                self.queimou_alguma = True
                self.mensagem = "LED queimou! Todo LED precisa de um resistor em serie."
                self.t_mensagem = 180
                ox, oy, tam = self._geometria()
                for (lx, ly) in novos:
                    for _ in range(12):
                        self.fumacas.append([ox + lx * tam + tam / 2, oy + ly * tam + tam / 2,
                                             random.uniform(-0.5, 0.5), random.uniform(-1.5, -0.5),
                                             random.randint(40, 70)])
            if ok:
                self.resolvido = True
                self.t_resolvido = 0
                self.audio.tocar("circuito_ok")
        else:
            self.audio.tocar("erro", 0.3)

    def usar_dica(self):
        erradas = []
        for y in range(self.h):
            for x in range(self.w):
                p = self.grade[y][x]
                if p.tipo in ("fio", "resistor") and not p.fixa and self._faz_parte_solucao(x, y):
                    if p.dirs != rotacionar_dirs(p.base, p.rot_correta):
                        erradas.append((x, y))
        if not erradas:
            self.mensagem = "Nenhuma dica disponivel: revise os caminhos!"
            self.t_mensagem = 120
            return
        x, y = self.rng.choice(erradas)
        p = self.grade[y][x]
        p.rot = p.rot_correta
        p.fixa = True
        p.anim = 180
        self.dicas_usadas += 1
        self.audio.tocar("powerup", 0.5)
        self.mensagem = "Dica: uma peca foi travada na posicao correta."
        self.t_mensagem = 120
        if self.avaliar():
            self.resolvido = True
            self.audio.tocar("circuito_ok")

    def _faz_parte_solucao(self, x, y):
        # Pecas da solucao original nunca sao "distracao": marcamos na geracao
        return getattr(self.grade[y][x], "solucao", False)

    def processar(self, ctrl, eventos):
        self.tempo += 1
        if self.resolvido:
            self.t_resolvido += 1
            if self.t_resolvido > 90 or (self.t_resolvido > 20 and ctrl.apertou("confirmar")):
                self.ao_terminar(True, self)
            return
        if ctrl.apertou("voltar"):
            self.audio.tocar("voltar")
            self.ao_terminar(False, self)
            return
        if ctrl.apertou("esquerda"):
            self.cursor[0] = (self.cursor[0] - 1) % self.w
            self.audio.tocar("menu", 0.4)
        if ctrl.apertou("direita"):
            self.cursor[0] = (self.cursor[0] + 1) % self.w
            self.audio.tocar("menu", 0.4)
        if ctrl.apertou("cima"):
            self.cursor[1] = (self.cursor[1] - 1) % self.h
            self.audio.tocar("menu", 0.4)
        if ctrl.apertou("baixo"):
            self.cursor[1] = (self.cursor[1] + 1) % self.h
            self.audio.tocar("menu", 0.4)
        if ctrl.apertou("confirmar") or ctrl.apertou("atirar"):
            self.girar(self.cursor[0], self.cursor[1], 1)
        for e in eventos:
            if e.type == pygame.KEYDOWN and e.key == pygame.K_h:
                self.usar_dica()
            if e.type == pygame.MOUSEBUTTONDOWN and e.button in (1, 3):
                ox, oy, tam = self._geometria()
                mx, my = e.pos
                cx, cy = (mx - ox) // tam, (my - oy) // tam
                if 0 <= cx < self.w and 0 <= cy < self.h:
                    self.cursor = [cx, cy]
                    self.girar(cx, cy, 1 if e.button == 1 else -1)
            if e.type == pygame.MOUSEMOTION:
                ox, oy, tam = self._geometria()
                mx, my = e.pos
                cx, cy = (mx - ox) // tam, (my - oy) // tam
                if 0 <= cx < self.w and 0 <= cy < self.h:
                    self.cursor = [cx, cy]

    # ------------------------------------------------------------------
    # Desenho
    # ------------------------------------------------------------------
    def desenhar(self, surf):
        escurecer = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        escurecer.fill((0, 0, 0, 170))
        surf.blit(escurecer, (0, 0))
        painel(surf, (30, 30, cfg.LARGURA - 60, cfg.ALTURA - 60), (8, 36, 22), cfg.VERDE_PCB_CLARO, 245)
        texto(surf, "MONTAGEM DE CIRCUITO", (60, 46), 26, cfg.BRANCO, negrito=True)
        texto(surf, "Leve os 5V ate todos os LEDs - sem queimar nenhum!", (60, 74), 15, cfg.CINZA_CLARO)
        ox, oy, tam = self._geometria()
        # fundo pontilhado de PCB
        area = pygame.Rect(ox - 10, oy - 10, self.w * tam + 20, self.h * tam + 20)
        pygame.draw.rect(surf, (6, 50, 28), area, border_radius=6)
        for gx in range(area.left + 8, area.right, 16):
            for gy in range(area.top + 8, area.bottom, 16):
                surf.set_at((gx, gy), (30, 100, 60))
        for y in range(self.h):
            for x in range(self.w):
                self._desenhar_peca(surf, self.grade[y][x], ox + x * tam, oy + y * tam, tam)
        # cursor
        cx, cy = self.cursor
        r = pygame.Rect(ox + cx * tam, oy + cy * tam, tam, tam)
        cor = lerp_cor(cfg.AMARELO, cfg.BRANCO, (math.sin(self.tempo * 0.15) + 1) / 2)
        pygame.draw.rect(surf, cor, r.inflate(-2, -2), 3, border_radius=6)
        # fumacas dos LEDs queimados
        vivas = []
        for f in self.fumacas:
            f[0] += f[2]
            f[1] += f[3]
            f[4] -= 1
            if f[4] > 0:
                vivas.append(f)
                a = min(160, f[4] * 3)
                s = pygame.Surface((20, 20), pygame.SRCALPHA)
                pygame.draw.circle(s, (80, 80, 90, a), (10, 10), 8)
                surf.blit(s, (f[0] - 10, f[1] - 10))
        self.fumacas = vivas
        # painel lateral
        px = 650
        painel(surf, (px, 90, 270, 400), (10, 20, 16), cfg.VERDE_PCB_CLARO, 220)
        y = 104
        texto(surf, "STATUS", (px + 16, y), 18, cfg.AMARELO, negrito=True)
        y += 30
        texto(surf, "LEDs acesos: %d / %d" % (len(self.leds_ok), len(self.leds)), (px + 16, y), 16,
              cfg.VERDE_LED)
        y += 24
        cor_q = cfg.VERMELHO if self.leds_queimados else cfg.CINZA_CLARO
        texto(surf, "LEDs em curto: %d" % len(self.leds_queimados), (px + 16, y), 16, cor_q)
        y += 24
        texto(surf, "Movimentos: %d" % self.movimentos, (px + 16, y), 16, cfg.BRANCO)
        y += 24
        texto(surf, "Dicas usadas: %d" % self.dicas_usadas, (px + 16, y), 16, cfg.BRANCO)
        y += 36
        texto(surf, "COMO JOGAR", (px + 16, y), 18, cfg.AMARELO, negrito=True)
        y += 28
        instrucoes = [
            "Setas: mover cursor",
            "Espaco/Z/Clique: girar",
            "Clique direito: girar ao contrario",
            "H: dica (trava uma peca)",
            "Esc: sair",
        ]
        for linha in instrucoes:
            texto(surf, linha, (px + 16, y), 14, cfg.CINZA_CLARO)
            y += 20
        y += 12
        texto(surf, "LEGENDA", (px + 16, y), 18, cfg.AMARELO, negrito=True)
        y += 26
        pygame.draw.rect(surf, cfg.VERMELHO, (px + 16, y + 2, 14, 14), border_radius=3)
        texto(surf, "5V = fonte (pino do Arduino)", (px + 38, y), 14, cfg.CINZA_CLARO)
        y += 20
        pygame.draw.rect(surf, (220, 190, 140), (px + 16, y + 4, 14, 8), border_radius=3)
        texto(surf, "Resistor 220R (obrigatorio!)", (px + 38, y), 14, cfg.CINZA_CLARO)
        if self.t_mensagem > 0:
            self.t_mensagem -= 1
            cor = cfg.VERMELHO if "queimou" in self.mensagem else cfg.CIANO
            texto(surf, self.mensagem, (cfg.LARGURA // 2, cfg.ALTURA - 52), 18, cor, centro=True)
        if self.resolvido:
            k = min(1.0, self.t_resolvido / 20)
            s = pygame.Surface((cfg.LARGURA, 90), pygame.SRCALPHA)
            s.fill((0, 40, 20, int(220 * k)))
            surf.blit(s, (0, cfg.ALTURA // 2 - 45))
            texto(surf, "CIRCUITO FUNCIONANDO!", (cfg.LARGURA // 2, cfg.ALTURA // 2 - 10), 40,
                  cfg.VERDE_LED, centro=True, negrito=True)
            texto(surf, "Portao destravado", (cfg.LARGURA // 2, cfg.ALTURA // 2 + 24), 18, cfg.BRANCO,
                  centro=True)

    def _desenhar_peca(self, surf, p, x, y, tam):
        r = pygame.Rect(x + 2, y + 2, tam - 4, tam - 4)
        pygame.draw.rect(surf, (12, 64, 36), r, border_radius=6)
        pygame.draw.rect(surf, (20, 90, 50), r, 1, border_radius=6)
        if p.tipo == "vazio":
            return
        if p.anim != 0:
            p.anim *= 0.6
            if abs(p.anim) < 1:
                p.anim = 0
        cx, cy = x + tam // 2, y + tam // 2
        cor_trilha = cfg.COBRE_CLARO if p.energizada else (120, 80, 40)
        if p.energizada and p.tipo != "led":
            g = brilho_cache(tam // 2, (255, 200, 80), 40)
            surf.blit(g, (cx - tam // 2, cy - tam // 2), special_flags=pygame.BLEND_ADD)
        # desenha em superficie temporaria para permitir animacao de rotacao
        s = pygame.Surface((tam, tam), pygame.SRCALPHA)
        c = tam // 2
        for d in p.dirs:
            dx, dy = DELTAS[d]
            pygame.draw.line(s, cor_trilha, (c, c), (c + dx * c, c + dy * c), 8)
        pygame.draw.circle(s, cor_trilha, (c, c), 6)
        if p.tipo == "resistor":
            horizontal = L in p.dirs
            if horizontal:
                rr = pygame.Rect(c - 18, c - 9, 36, 18)
            else:
                rr = pygame.Rect(c - 9, c - 18, 18, 36)
            pygame.draw.rect(s, (220, 190, 140), rr, border_radius=7)
            faixas = [(200, 40, 40), (200, 40, 40), (120, 70, 30), cfg.OURO]
            for i, cor in enumerate(faixas):
                if horizontal:
                    pygame.draw.line(s, cor, (rr.x + 7 + i * 7, rr.y + 1), (rr.x + 7 + i * 7, rr.bottom - 2), 3)
                else:
                    pygame.draw.line(s, cor, (rr.x + 1, rr.y + 7 + i * 7), (rr.right - 2, rr.y + 7 + i * 7), 3)
        elif p.tipo == "fonte":
            pygame.draw.rect(s, cfg.VERMELHO, (c - 20, c - 20, 40, 40), border_radius=6)
            img = render_texto("5V", 16, cfg.BRANCO, negrito=True)
            s.blit(img, img.get_rect(center=(c, c)))
        elif p.tipo == "led":
            estado = p.estado_led
            if estado == "ok":
                cor = cfg.VERDE_LED
                g = brilho_cache(40, cfg.VERDE_LED, 140)
                surf.blit(g, (cx - 40, cy - 40), special_flags=pygame.BLEND_ADD)
            elif estado == "queimado":
                cor = (60, 50, 50)
            else:
                cor = (90, 30, 30)
            pygame.draw.circle(s, cor, (c, c - 2), 16)
            pygame.draw.rect(s, cor, (c - 16, c - 2, 32, 14))
            pygame.draw.rect(s, lerp_cor(cor, (0, 0, 0), 0.3), (c - 19, c + 10, 38, 5))
            if estado == "queimado":
                pygame.draw.line(s, (20, 20, 20), (c - 8, c - 10), (c + 8, c + 6), 3)
                pygame.draw.line(s, (20, 20, 20), (c + 8, c - 10), (c - 8, c + 6), 3)
            else:
                pygame.draw.circle(s, (255, 255, 255, 120), (c - 6, c - 8), 4)
        if p.fixa and p.tipo in ("fio", "resistor"):
            pygame.draw.circle(s, cfg.AZUL_ARDUINO_CLARO, (8, 8), 4)
        if p.anim:
            s = pygame.transform.rotate(s, p.anim)
        surf.blit(s, s.get_rect(center=(cx, cy)))


# ===========================================================================
# Quiz
# ===========================================================================
class QuizArduino:
    def __init__(self, pergunta, audio, ao_terminar):
        self.pergunta = pergunta  # dict: texto, opcoes, correta, explicacao
        self.audio = audio
        self.ao_terminar = ao_terminar
        self.selecao = 0
        self.respondido = None
        self.tempo = 0
        self.t_resp = 0
        ordem = list(range(len(pergunta["opcoes"])))
        random.shuffle(ordem)
        self.ordem = ordem

    def _rects(self):
        rects = []
        for i in range(len(self.ordem)):
            rects.append(pygame.Rect(140, 200 + i * 54, cfg.LARGURA - 280, 44))
        return rects

    def responder(self, i):
        if self.respondido is not None:
            return
        self.respondido = i
        self.t_resp = 0
        if self.ordem[i] == self.pergunta["correta"]:
            self.audio.tocar("circuito_ok")
        else:
            self.audio.tocar("erro")

    @property
    def acertou(self):
        return self.respondido is not None and self.ordem[self.respondido] == self.pergunta["correta"]

    def processar(self, ctrl, eventos):
        self.tempo += 1
        if self.respondido is not None:
            self.t_resp += 1
            if self.t_resp > 30 and (ctrl.apertou("confirmar") or ctrl.apertou("interagir")):
                self.ao_terminar(self.acertou, self)
            return
        if ctrl.apertou("voltar"):
            self.ao_terminar(None, self)
            return
        n = len(self.ordem)
        if ctrl.apertou("cima"):
            self.selecao = (self.selecao - 1) % n
            self.audio.tocar("menu")
        if ctrl.apertou("baixo"):
            self.selecao = (self.selecao + 1) % n
            self.audio.tocar("menu")
        if ctrl.apertou("confirmar"):
            self.responder(self.selecao)
        for e in eventos:
            if e.type == pygame.KEYDOWN and pygame.K_1 <= e.key <= pygame.K_4:
                i = e.key - pygame.K_1
                if i < n:
                    self.selecao = i
                    self.responder(i)
            if e.type == pygame.MOUSEMOTION:
                for i, r in enumerate(self._rects()):
                    if r.collidepoint(e.pos):
                        self.selecao = i
            if e.type == pygame.MOUSEBUTTONDOWN and e.button == 1:
                for i, r in enumerate(self._rects()):
                    if r.collidepoint(e.pos):
                        self.responder(i)

    def desenhar(self, surf):
        escurecer = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        escurecer.fill((0, 0, 0, 170))
        surf.blit(escurecer, (0, 0))
        painel(surf, (80, 40, cfg.LARGURA - 160, cfg.ALTURA - 80), (6, 26, 30), cfg.AZUL_ARDUINO_CLARO, 245)
        texto(surf, "QUIZ DO ARDUINO", (cfg.LARGURA // 2, 70), 28, cfg.AMARELO, centro=True, negrito=True)
        linhas = quebrar_texto(self.pergunta["texto"], 20, cfg.LARGURA - 300)
        y = 110
        for l in linhas:
            texto(surf, l, (cfg.LARGURA // 2, y), 20, cfg.BRANCO, centro=True)
            y += 28
        for i, r in enumerate(self._rects()):
            opc = self.pergunta["opcoes"][self.ordem[i]]
            cor_fundo = (16, 50, 56)
            cor_borda = cfg.AZUL_ARDUINO
            if self.respondido is not None:
                if self.ordem[i] == self.pergunta["correta"]:
                    cor_fundo, cor_borda = (20, 90, 40), cfg.VERDE_LED
                elif i == self.respondido:
                    cor_fundo, cor_borda = (100, 20, 30), cfg.VERMELHO
            elif i == self.selecao:
                cor_fundo, cor_borda = (30, 90, 100), cfg.AMARELO
            painel(surf, r, cor_fundo, cor_borda, 255, 6)
            texto(surf, "%d) %s" % (i + 1, opc), (r.x + 16, r.centery - 10), 18, cfg.BRANCO, mono="(" in opc)
        if self.respondido is not None:
            msg = "CORRETO! +%d bytes" % cfg.BYTES_POR_QUIZ if self.acertou else "Nao foi dessa vez..."
            texto(surf, msg, (cfg.LARGURA // 2, 470), 22, cfg.VERDE_LED if self.acertou else cfg.VERMELHO,
                  centro=True, negrito=True)
            exp = quebrar_texto(self.pergunta.get("explicacao", ""), 15, cfg.LARGURA - 320)
            for k, l in enumerate(exp[:2]):
                texto(surf, l, (cfg.LARGURA // 2, 492 + k * 18), 15, cfg.CINZA_CLARO, centro=True)
