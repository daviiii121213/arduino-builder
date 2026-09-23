"""
Chefes e seus ataques especiais.

1. CURTO-CIRCUITO     - Esfera de energia instavel (Vale da Protoboard)
2. CAVALO DE TROIA    - Virus disfarcado de presente (Cidade Placa-Mae)
3. BOOTLOADER SOMBRIO - Firmware corrompido gigante (Nuvem IoT)

Cada chefe tem fases: ao perder vida fica mais rapido e agressivo.
"""

import math
import random

import pygame

import config as cfg
from itens import Projetil, Byte
from inimigos import Virus
from util import brilho_cache, lerp_cor, texto, render_texto, distancia, clamp

T = cfg.TILE


# ===========================================================================
# Perigos gerados pelos chefes
# ===========================================================================
class Perigo:
    vivo = True
    dano = 1

    def atualizar(self, jogo):
        pass

    def colide(self, rect):
        return False

    def desenhar(self, surf, cam, tempo):
        pass


class ColunaRaio(Perigo):
    """Aviso vermelho no chao; depois de um tempo cai um raio na coluna."""

    def __init__(self, x, topo, base, aviso=50, largura=36):
        self.x = x
        self.topo = topo
        self.base = base
        self.aviso = aviso
        self.largura = largura
        self.t = 0
        self.duracao_raio = 18

    def atualizar(self, jogo):
        self.t += 1
        if self.t == self.aviso:
            jogo.audio.tocar("raio", 0.6)
            jogo.camera.tremer(5, 8)
            jogo.particulas.faiscas(self.x, self.base, 14, cfg.CIANO, 5)
        if self.t > self.aviso + self.duracao_raio:
            self.vivo = False

    def colide(self, rect):
        if self.aviso <= self.t <= self.aviso + self.duracao_raio - 4:
            r = pygame.Rect(int(self.x - self.largura / 2 + 6), self.topo, self.largura - 12,
                            self.base - self.topo)
            return r.colliderect(rect)
        return False

    def desenhar(self, surf, cam, tempo):
        x = int(self.x - cam.ox)
        if self.t < self.aviso:
            alpha = 40 + int(60 * (self.t / self.aviso)) + (30 if (self.t // 4) % 2 else 0)
            s = pygame.Surface((self.largura, self.base - self.topo), pygame.SRCALPHA)
            s.fill((255, 40, 40, alpha))
            surf.blit(s, (x - self.largura // 2, self.topo - cam.oy))
            pygame.draw.polygon(surf, cfg.AMARELO, [(x, self.base - cam.oy - 30),
                                                    (x - 10, self.base - cam.oy - 12),
                                                    (x + 10, self.base - cam.oy - 12)])
            texto(surf, "!", (x, self.base - cam.oy - 20), 14, (0, 0, 0), centro=True, sombra=False,
                  negrito=True)
        else:
            s = pygame.Surface((self.largura + 20, self.base - self.topo), pygame.SRCALPHA)
            s.fill((120, 220, 255, 90))
            surf.blit(s, (x - self.largura // 2 - 10, self.topo - cam.oy), special_flags=pygame.BLEND_ADD)
            pontos = []
            for i in range(12):
                y = self.topo + (self.base - self.topo) * i / 11
                pontos.append((x + random.randint(-10, 10), y - cam.oy))
            pygame.draw.lines(surf, cfg.CIANO, False, pontos, 6)
            pygame.draw.lines(surf, cfg.BRANCO, False, pontos, 2)


class Laser(Perigo):
    """Feixe entre um ponto de origem e um angulo que varre a arena."""

    def __init__(self, origem_func, ang_inicio, ang_fim, aviso=45, duracao=70, comprimento=1400):
        self.origem_func = origem_func
        self.ang_inicio = ang_inicio
        self.ang_fim = ang_fim
        self.aviso = aviso
        self.duracao = duracao
        self.comprimento = comprimento
        self.t = 0

    def angulo(self):
        if self.t < self.aviso:
            return self.ang_inicio
        p = (self.t - self.aviso) / self.duracao
        return self.ang_inicio + (self.ang_fim - self.ang_inicio) * clamp(p, 0, 1)

    def pontos(self):
        ox, oy = self.origem_func()
        a = self.angulo()
        return (ox, oy), (ox + math.cos(a) * self.comprimento, oy + math.sin(a) * self.comprimento)

    def atualizar(self, jogo):
        self.t += 1
        if self.t == self.aviso:
            jogo.audio.tocar("laser", 0.7)
        if self.t > self.aviso + self.duracao:
            self.vivo = False

    def colide(self, rect):
        if self.t < self.aviso:
            return False
        (x1, y1), (x2, y2) = self.pontos()
        cx, cy = rect.center
        dx, dy = x2 - x1, y2 - y1
        l2 = dx * dx + dy * dy
        t = clamp(((cx - x1) * dx + (cy - y1) * dy) / max(1, l2), 0, 1)
        px, py = x1 + dx * t, y1 + dy * t
        return math.hypot(cx - px, cy - py) < 14

    def desenhar(self, surf, cam, tempo):
        (x1, y1), (x2, y2) = self.pontos()
        a = (int(x1 - cam.ox), int(y1 - cam.oy))
        b = (int(x2 - cam.ox), int(y2 - cam.oy))
        if self.t < self.aviso:
            if (self.t // 3) % 2:
                pygame.draw.line(surf, (255, 60, 60), a, b, 1)
        else:
            pygame.draw.line(surf, (255, 40, 90), a, b, 14)
            pygame.draw.line(surf, (255, 150, 180), a, b, 7)
            pygame.draw.line(surf, cfg.BRANCO, a, b, 3)


class BlocoCaindo(Perigo):
    """Bloco de 'codigo corrompido' que cai do teto com aviso."""

    TEXTOS = ["ERRO", "NULL", "0xDEAD", "404", "NaN", "SEGV", "BUG", "!!!"]

    def __init__(self, x, y_topo, y_chao, atraso=40):
        self.x = x
        self.y = y_topo - 40
        self.y_chao = y_chao
        self.vy = 0
        self.atraso = atraso
        self.txt = random.choice(self.TEXTOS)
        self.pousou = 0
        self.largura = 52
        self.altura = 30

    @property
    def rect(self):
        return pygame.Rect(int(self.x - self.largura / 2), int(self.y), self.largura, self.altura)

    def atualizar(self, jogo):
        if self.atraso > 0:
            self.atraso -= 1
            return
        if self.pousou:
            self.pousou += 1
            if self.pousou > 40:
                self.vivo = False
            return
        self.vy = min(self.vy + 0.5, 12)
        self.y += self.vy
        if self.y + self.altura >= self.y_chao:
            self.y = self.y_chao - self.altura
            self.pousou = 1
            jogo.camera.tremer(3, 6)
            jogo.audio.tocar("quebrar", 0.4)
            jogo.particulas.bits(self.x, self.y_chao - 10, 6)

    def colide(self, rect):
        return self.atraso == 0 and not self.pousou and self.rect.colliderect(rect)

    def desenhar(self, surf, cam, tempo):
        if self.atraso > 0:
            x = int(self.x - cam.ox)
            y = int(self.y_chao - cam.oy)
            if (self.atraso // 4) % 2:
                pygame.draw.ellipse(surf, (255, 60, 60), (x - 22, y - 6, 44, 10), 2)
            return
        r = cam.aplicar(self.rect)
        alpha = 255 if not self.pousou else max(0, 255 - self.pousou * 6)
        s = pygame.Surface(r.size, pygame.SRCALPHA)
        s.fill((40, 0, 20, alpha))
        pygame.draw.rect(s, (255, 40, 90, alpha), s.get_rect(), 2)
        img = render_texto(self.txt, 13, (255, 120, 160), mono=True, negrito=True)
        img = img.copy()
        img.set_alpha(alpha)
        s.blit(img, img.get_rect(center=(r.w // 2, r.h // 2)))
        surf.blit(s, r)


class OndaChoque(Perigo):
    """Onda que corre pelo chao a partir de um impacto."""

    def __init__(self, x, y_chao, direcao, velocidade=5.5, alcance=700):
        self.x = x
        self.y_chao = y_chao
        self.direcao = direcao
        self.velocidade = velocidade
        self.percorrido = 0
        self.alcance = alcance

    def atualizar(self, jogo):
        self.x += self.direcao * self.velocidade
        self.percorrido += self.velocidade
        if self.percorrido > self.alcance or jogo.nivel.solido_px(self.x, self.y_chao - 8):
            self.vivo = False
        if random.random() < 0.5:
            jogo.particulas.poeira(self.x, self.y_chao, 1, (255, 200, 120))

    def colide(self, rect):
        return pygame.Rect(int(self.x - 10), self.y_chao - 22, 20, 22).colliderect(rect)

    def desenhar(self, surf, cam, tempo):
        x = int(self.x - cam.ox)
        y = int(self.y_chao - cam.oy)
        h = 22 + int(math.sin(tempo * 0.5) * 3)
        pygame.draw.polygon(surf, cfg.LARANJA, [(x - 12, y), (x, y - h), (x + 12, y)])
        pygame.draw.polygon(surf, cfg.AMARELO, [(x - 6, y), (x, y - h + 8), (x + 6, y)])


# ===========================================================================
# Base dos chefes
# ===========================================================================
class Chefe:
    nome = "CHEFE"
    subtitulo = ""
    hp_max = 30
    dano_contato = 1
    pisavel = False
    largura = 60
    altura = 60

    def __init__(self, x, y, sprites, arena):
        self.sprites = sprites
        self.x = float(x)
        self.y = float(y)
        self.vx = 0.0
        self.vy = 0.0
        self.hp = self.hp_max
        self.vivo = True
        self.flash = 0
        self.tempo = 0
        self.estado = "intro"
        self.t_estado = 0
        self.arena = arena  # pygame.Rect com os limites da arena
        self.ativo = False
        self.morrendo = 0
        self.fase = 1
        self.fila_ataques = []
        self.hp_exibido = self.hp_max

    # compatibilidade com o sistema de inimigos
    @property
    def rect(self):
        return pygame.Rect(int(self.x - self.largura / 2), int(self.y - self.altura / 2),
                           self.largura, self.altura)

    @property
    def centro(self):
        return (self.x, self.y)

    def pode_ser_pisado(self):
        return False

    @property
    def chao(self):
        return self.arena.bottom

    def mudar_estado(self, estado):
        self.estado = estado
        self.t_estado = 0

    def receber_dano(self, qtd, jogo, origem=None):
        if not self.vivo or self.morrendo or self.estado == "intro":
            return
        self.hp -= qtd
        self.flash = 5
        jogo.audio.tocar("chefe_dano", 0.6)
        jogo.particulas.faiscas(self.x, self.y, 6, cfg.BRANCO, 3)
        if self.hp <= 0:
            self.hp = 0
            self.morrendo = 1
            self.mudar_estado("morrendo")
            jogo.audio.tocar("chefe_rugido")
            jogo.log("%s esta entrando em colapso!" % self.nome)
            jogo.perigos.clear()
            jogo.projeteis[:] = [p for p in jogo.projeteis if p.dono == "jogador"]
        else:
            nova_fase = self.calcular_fase()
            if nova_fase > self.fase:
                self.fase = nova_fase
                jogo.audio.tocar("chefe_rugido")
                jogo.camera.tremer(8, 30)
                jogo.log("%s entrou na fase %d!" % (self.nome, self.fase))
                self.ao_mudar_fase(jogo)

    def calcular_fase(self):
        f = self.hp / self.hp_max
        if f < 0.33:
            return 3
        if f < 0.6:
            return 2
        return 1

    def ao_mudar_fase(self, jogo):
        pass

    def atualizar(self, jogo):
        self.tempo += 1
        self.t_estado += 1
        if self.flash > 0:
            self.flash -= 1
        self.hp_exibido += (self.hp - self.hp_exibido) * 0.1
        if self.morrendo:
            self.morrendo += 1
            if self.morrendo % 6 == 0:
                jogo.particulas.explosao(self.x + random.uniform(-40, 40), self.y + random.uniform(-40, 40),
                                         0.7)
                jogo.audio.tocar("explosao", 0.5)
                jogo.camera.tremer(6, 8)
            if self.morrendo > 130:
                self.vivo = False
                jogo.particulas.explosao(self.x, self.y, 2.5)
                jogo.particulas.bits(self.x, self.y, 40)
                jogo.audio.tocar("explosao_grande")
                jogo.camera.tremer(14, 40)
                for i in range(30):
                    b = Byte(self.x - T / 2, self.y - T / 2, self.sprites, grande=(i % 6 == 0), solto=True)
                    b.vx = random.uniform(-5, 5)
                    b.vy = random.uniform(-9, -3)
                    b.tempo_vida = 1200
                    jogo.itens.append(b)
                jogo.ao_derrotar_chefe(self)
            return
        if self.estado == "intro":
            if self.t_estado > 120:
                self.proximo_ataque(jogo)
            return
        self.comportamento(jogo)

    def proximo_ataque(self, jogo):
        if not self.fila_ataques:
            self.fila_ataques = self.ataques_disponiveis()
            random.shuffle(self.fila_ataques)
        self.mudar_estado(self.fila_ataques.pop())

    def ataques_disponiveis(self):
        return []

    def comportamento(self, jogo):
        pass

    def retangulos_dano(self):
        return [self.rect]

    def desenhar(self, surf, cam, tempo):
        pass


# ===========================================================================
# CHEFE 1: CURTO-CIRCUITO
# ===========================================================================
class CurtoCircuito(Chefe):
    nome = "CURTO-CIRCUITO"
    subtitulo = "A esfera de energia instavel"
    hp_max = 36
    largura = 56
    altura = 56

    def ataques_disponiveis(self):
        base = ["quicar", "rajada", "raios"]
        if self.fase >= 2:
            base += ["quicar", "raios"]
        return base

    def comportamento(self, jogo):
        e = self.estado
        vel = 1.0 + (self.fase - 1) * 0.3
        if e == "quicar":
            if self.t_estado == 1:
                ang = random.choice((-0.8, -2.3, 0.7, 2.4))
                self.vx = math.cos(ang) * 5 * vel
                self.vy = math.sin(ang) * 5 * vel
            self.x += self.vx
            self.y += self.vy
            r = self.largura / 2
            if self.x - r < self.arena.left or self.x + r > self.arena.right:
                self.vx *= -1
                self.x = clamp(self.x, self.arena.left + r, self.arena.right - r)
                jogo.camera.tremer(3, 5)
                jogo.particulas.faiscas(self.x, self.y, 8, cfg.CIANO, 3)
            if self.y - r < self.arena.top or self.y + r > self.arena.bottom:
                self.vy *= -1
                self.y = clamp(self.y, self.arena.top + r, self.arena.bottom - r)
                jogo.camera.tremer(3, 5)
                jogo.particulas.faiscas(self.x, self.y, 8, cfg.CIANO, 3)
            if self.t_estado > 240:
                self.mudar_estado("voltar")
        elif e == "voltar":
            alvo = (self.arena.centerx, self.arena.top + 90)
            self.x += (alvo[0] - self.x) * 0.06
            self.y += (alvo[1] - self.y) * 0.06
            if distancia((self.x, self.y), alvo) < 6 or self.t_estado > 90:
                self.proximo_ataque(jogo)
        elif e == "rajada":
            if self.t_estado < 30:
                if self.t_estado % 3 == 0:
                    jogo.particulas.faiscas(self.x, self.y, 3, cfg.AMARELO, 2, 12)
            ondas = 2 + self.fase
            intervalo = 36
            if self.t_estado >= 30 and (self.t_estado - 30) % intervalo == 0 \
                    and (self.t_estado - 30) // intervalo < ondas:
                n = 10 + self.fase * 2
                desloc = (self.t_estado // intervalo) * 0.3
                for i in range(n):
                    a = i / n * math.tau + desloc
                    jogo.projeteis.append(Projetil(self.x, self.y, math.cos(a) * 3.4 * vel,
                                                   math.sin(a) * 3.4 * vel, "inimigo",
                                                   img=self.sprites.faisca, raio=5, vida=200,
                                                   atravessa=True))
                jogo.audio.tocar("raio", 0.5)
                jogo.camera.tremer(3, 6)
            if self.t_estado > 30 + ondas * intervalo + 40:
                self.mudar_estado("voltar")
        elif e == "raios":
            self.x += (self.arena.centerx - self.x) * 0.03
            self.y += (self.arena.top + 70 - self.y) * 0.03
            qtd = 3 + self.fase
            if self.t_estado in (10, 70, 130)[:1 + self.fase // 2 + 1]:
                jx = jogo.jogador.centro[0]
                posicoes = [jx] + [random.uniform(self.arena.left + 30, self.arena.right - 30)
                                   for _ in range(qtd - 1)]
                for px in posicoes:
                    jogo.perigos.append(ColunaRaio(px, self.arena.top, self.arena.bottom,
                                                   aviso=int(55 / vel)))
                jogo.audio.tocar("alerta", 0.6)
            if self.t_estado > 200:
                self.mudar_estado("voltar")
        # faiscas ambientes
        if self.tempo % 5 == 0:
            a = random.uniform(0, math.tau)
            jogo.particulas.eletricidade(self.x, self.y, self.x + math.cos(a) * 50,
                                         self.y + math.sin(a) * 50, cfg.CIANO, 3)

    def desenhar(self, surf, cam, tempo):
        x, y = int(self.x - cam.ox), int(self.y - cam.oy)
        r = self.largura // 2
        pulso = math.sin(tempo * 0.2) * 3
        g = brilho_cache(r * 3, cfg.CIANO if self.fase < 3 else cfg.ROSA, 110)
        surf.blit(g, (x - r * 3, y - r * 3), special_flags=pygame.BLEND_ADD)
        cor_nucleo = cfg.BRANCO if self.flash else (lerp_cor(cfg.CIANO, cfg.AZUL_PLACA, 0.5)
                                                    if self.fase < 3 else (200, 60, 160))
        pygame.draw.circle(surf, cor_nucleo, (x, y), int(r + pulso))
        pygame.draw.circle(surf, cfg.CIANO, (x, y), int(r + pulso), 3)
        pygame.draw.circle(surf, cfg.BRANCO, (x, y), int(r * 0.5 + pulso))
        # rosto furioso
        olho_y = y - 6
        for dx in (-12, 12):
            pygame.draw.circle(surf, (20, 30, 60), (x + dx, olho_y), 6)
            pygame.draw.circle(surf, cfg.AMARELO, (x + dx, olho_y), 3)
        pygame.draw.line(surf, (20, 30, 60), (x - 20, olho_y - 12), (x - 6, olho_y - 6), 3)
        pygame.draw.line(surf, (20, 30, 60), (x + 20, olho_y - 12), (x + 6, olho_y - 6), 3)
        pts = [(x - 14 + i * 4, y + 12 + (3 if i % 2 else -2)) for i in range(8)]
        pygame.draw.lines(surf, (20, 30, 60), False, pts, 3)
        # orbitas de eletrons
        for i in range(3):
            a = tempo * 0.08 + i * math.tau / 3
            ex = x + math.cos(a) * (r + 16)
            ey = y + math.sin(a) * (r + 6) * 0.6
            pygame.draw.circle(surf, cfg.AMARELO, (int(ex), int(ey)), 4)


# ===========================================================================
# CHEFE 2: CAVALO DE TROIA
# ===========================================================================
class CavaloDeTroia(Chefe):
    nome = "CAVALO DE TROIA"
    subtitulo = "O virus que chegou como presente"
    hp_max = 48
    largura = 96
    altura = 80

    def __init__(self, x, y, sprites, arena):
        super().__init__(x, y, sprites, arena)
        self.y = self.chao - self.altura / 2
        self.direcao = -1
        self.no_chao = True

    def ataques_disponiveis(self):
        base = ["investida", "invocar", "bolhas", "salto"]
        if self.fase >= 2:
            base += ["salto", "investida"]
        if self.fase >= 3:
            base += ["investida"]
        return base

    def _gravidade(self, jogo):
        self.vy = min(self.vy + 0.5, 14)
        self.y += self.vy
        if self.y + self.altura / 2 >= self.chao:
            self.y = self.chao - self.altura / 2
            aterrissou = not self.no_chao
            self.no_chao = True
            self.vy = 0
            return aterrissou
        self.no_chao = False
        return False

    def comportamento(self, jogo):
        e = self.estado
        vel = 1.0 + (self.fase - 1) * 0.25
        j = jogo.jogador
        if e == "espera":
            self.vx *= 0.85
            self.x += self.vx
            self._gravidade(jogo)
            self.direcao = 1 if j.centro[0] > self.x else -1
            if self.t_estado > max(20, 60 - self.fase * 15):
                self.proximo_ataque(jogo)
        elif e == "investida":
            if self.t_estado < 40:
                self.direcao = 1 if j.centro[0] > self.x else -1
                if self.t_estado % 4 == 0:
                    jogo.particulas.poeira(self.x - self.direcao * 40, self.chao, 3, (200, 170, 120))
            else:
                self.vx = self.direcao * 8 * vel
                self.x += self.vx
                if self.tempo % 3 == 0:
                    jogo.particulas.poeira(self.x - self.direcao * 40, self.chao, 2, (200, 170, 120))
                meia = self.largura / 2
                if self.x - meia < self.arena.left or self.x + meia > self.arena.right:
                    self.x = clamp(self.x, self.arena.left + meia, self.arena.right - meia)
                    self.vx = -self.direcao * 3
                    self.vy = -6
                    self.no_chao = False
                    jogo.camera.tremer(10, 20)
                    jogo.audio.tocar("explosao", 0.6)
                    # pedacos caindo do teto
                    for _ in range(2 + self.fase):
                        jogo.perigos.append(BlocoCaindo(random.uniform(self.arena.left + 40,
                                                                       self.arena.right - 40),
                                                        self.arena.top, self.chao,
                                                        atraso=random.randint(10, 50)))
                    self.mudar_estado("atordoado")
            self._gravidade(jogo)
        elif e == "atordoado":
            self.vx *= 0.9
            self.x += self.vx
            self._gravidade(jogo)
            if self.t_estado > 70:
                self.mudar_estado("espera")
        elif e == "invocar":
            self._gravidade(jogo)
            if self.t_estado in (30, 60) or (self.fase >= 2 and self.t_estado == 90):
                v = Virus(self.x + self.direcao * 40 - T / 2, self.y - T, self.sprites, pequeno=True)
                v.corpo.vx = self.direcao * 4
                v.corpo.vy = -6
                v.direcao = self.direcao
                v.ativo = True
                jogo.inimigos_novos.append(v)
                jogo.audio.tocar("bip", 0.6)
                jogo.particulas.bits(self.x + self.direcao * 40, self.y - 20, 6)
            if self.t_estado > 110:
                self.mudar_estado("espera")
        elif e == "bolhas":
            self._gravidade(jogo)
            n = 3 + self.fase
            if self.t_estado >= 20 and self.t_estado % 18 == 0 and self.t_estado // 18 <= n:
                a = -math.pi / 2 + random.uniform(-0.9, 0.9)
                jogo.projeteis.append(Projetil(self.x + self.direcao * 36, self.y - 30,
                                               math.cos(a) * 3.2, math.sin(a) * 3.2, "inimigo",
                                               img=self.sprites.bolha_virus, raio=7, vida=230,
                                               perseguir=j, cor=(100, 240, 90)))
                jogo.audio.tocar("tiro", 0.4)
            if self.t_estado > 20 + n * 18 + 30:
                self.mudar_estado("espera")
        elif e == "salto":
            if self.t_estado == 1:
                alvo = j.centro[0]
                self.vy = -13
                self.vx = clamp((alvo - self.x) / 52, -7, 7)
                self.no_chao = False
                jogo.audio.tocar("pulo", 0.8)
            self.x += self.vx
            self.x = clamp(self.x, self.arena.left + self.largura / 2, self.arena.right - self.largura / 2)
            if self._gravidade(jogo) and self.t_estado > 5:
                self.vx = 0
                jogo.camera.tremer(10, 18)
                jogo.audio.tocar("explosao", 0.7)
                jogo.particulas.poeira(self.x, self.chao, 20, (220, 180, 120))
                for d in (-1, 1):
                    jogo.perigos.append(OndaChoque(self.x + d * 50, self.chao, d, 5 + self.fase))
                self.mudar_estado("espera")

    def desenhar(self, surf, cam, tempo):
        x, y = int(self.x - cam.ox), int(self.y - cam.oy)
        d = self.direcao
        madeira = (160, 110, 60) if not self.flash else cfg.BRANCO
        madeira_esc = (110, 70, 36) if not self.flash else cfg.BRANCO
        balanco = int(math.sin(tempo * 0.3) * 2) if abs(self.vx) > 1 else 0
        tremor = random.randint(-2, 2) if self.estado == "atordoado" else 0
        x += tremor
        # rodas (o cavalo de troia classico tem rodinhas!)
        for dx in (-30, 30):
            pygame.draw.circle(surf, (60, 40, 24), (x + dx, y + 32), 10)
            a = tempo * 0.2 * (self.vx / 4 if self.vx else 0)
            pygame.draw.line(surf, (30, 20, 12), (x + dx, y + 32),
                             (x + dx + math.cos(a) * 9, y + 32 + math.sin(a) * 9), 2)
        # plataforma
        pygame.draw.rect(surf, madeira_esc, (x - 44, y + 16, 88, 10))
        # corpo
        pygame.draw.rect(surf, madeira, (x - 36, y - 16 + balanco, 72, 34), border_radius=6)
        for i in range(4):
            pygame.draw.line(surf, madeira_esc, (x - 34, y - 8 + i * 8 + balanco),
                             (x + 34, y - 8 + i * 8 + balanco), 1)
        # pernas
        for dx in (-26, -12, 12, 26):
            pygame.draw.rect(surf, madeira_esc, (x + dx - 3, y + 16, 6, 4))
        # pescoco e cabeca
        cx = x + d * 30
        pygame.draw.polygon(surf, madeira, [(cx - 10, y - 10 + balanco), (cx + 10, y - 10 + balanco),
                                            (cx + d * 16, y - 44 + balanco), (cx + d * 2, y - 46 + balanco)])
        cab = pygame.Rect(0, 0, 36, 20)
        cab.center = (cx + d * 18, y - 46 + balanco)
        pygame.draw.rect(surf, madeira, cab, border_radius=6)
        pygame.draw.polygon(surf, madeira_esc, [(cx + d * 4, y - 56 + balanco), (cx + d * 10, y - 70 + balanco),
                                                (cx + d * 14, y - 54 + balanco)])
        # olho de virus
        cor_olho = cfg.VERDE_LED if self.fase < 3 else cfg.VERMELHO
        pygame.draw.circle(surf, (20, 20, 20), (cx + d * 20, y - 49 + balanco), 5)
        pygame.draw.circle(surf, cor_olho, (cx + d * 20, y - 49 + balanco), 3)
        # crina de espinhos virais
        for i in range(5):
            px = cx - d * (i * 7) + d * 4
            py = y - 50 + i * 8 + balanco
            pygame.draw.line(surf, (70, 200, 70), (px, py), (px - d * 10, py - 6), 3)
            pygame.draw.circle(surf, (120, 240, 90), (px - d * 10, py - 6), 3)
        # porta do "presente" com virus espiando
        porta = pygame.Rect(x - 12, y - 8 + balanco, 24, 20)
        pygame.draw.rect(surf, (40, 26, 14), porta)
        if (tempo // 30) % 3 != 0 or self.estado == "invocar":
            pygame.draw.circle(surf, (70, 200, 70), porta.center, 7)
            pygame.draw.circle(surf, (20, 40, 20), (porta.centerx - 2, porta.centery - 1), 1)
            pygame.draw.circle(surf, (20, 40, 20), (porta.centerx + 2, porta.centery - 1), 1)
        # laco de presente
        pygame.draw.line(surf, cfg.VERMELHO, (x, y - 16 + balanco), (x, y + 18 + balanco), 4)
        pygame.draw.circle(surf, cfg.VERMELHO, (x - 6, y - 20 + balanco), 6, 3)
        pygame.draw.circle(surf, cfg.VERMELHO, (x + 6, y - 20 + balanco), 6, 3)
        if self.estado == "investida" and self.t_estado < 40 and (self.t_estado // 5) % 2:
            texto(surf, "!", (x, y - 90), 30, cfg.VERMELHO, centro=True, negrito=True)
        if self.estado == "atordoado":
            for i in range(3):
                a = tempo * 0.1 + i * math.tau / 3
                texto(surf, "*", (cx + d * 18 + math.cos(a) * 20, y - 70 + math.sin(a) * 6), 18,
                      cfg.AMARELO, centro=True)

    def retangulos_dano(self):
        d = self.direcao
        cabeca = pygame.Rect(0, 0, 36, 40)
        cabeca.center = (int(self.x + d * 44), int(self.y - 40))
        corpo = pygame.Rect(int(self.x - 44), int(self.y - 16), 88, 56)
        return [corpo, cabeca]

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 44), int(self.y - 60), 88, 100)


# ===========================================================================
# CHEFE 3: BOOTLOADER SOMBRIO
# ===========================================================================
class BootloaderSombrio(Chefe):
    nome = "BOOTLOADER SOMBRIO"
    subtitulo = "O firmware corrompido que quer apagar tudo"
    hp_max = 70
    largura = 120
    altura = 100

    def __init__(self, x, y, sprites, arena):
        super().__init__(x, y, sprites, arena)
        self.base_y = arena.top + 118
        self.y = self.base_y
        self.maos = [[self.x - 130, self.y + 40, 0, "idle"], [self.x + 130, self.y + 40, 0, "idle"]]
        self.alvo_x = self.x
        self.glitch_tela = 0

    def ataques_disponiveis(self):
        base = ["laser", "chuva", "tapa", "teleporte"]
        if self.fase >= 2:
            base += ["laser", "tapa"]
        if self.fase >= 3:
            base += ["combo"]
        return base

    def ao_mudar_fase(self, jogo):
        self.glitch_tela = 40
        jogo.efeito_glitch = 60

    def origem_olho(self):
        return (self.x, self.y + 6)

    def comportamento(self, jogo):
        e = self.estado
        j = jogo.jogador
        vel = 1.0 + (self.fase - 1) * 0.3
        self.y = self.base_y + math.sin(self.tempo * 0.03) * 10
        self.x += (self.alvo_x - self.x) * 0.05
        if self.glitch_tela > 0:
            self.glitch_tela -= 1
        # maos seguem o corpo quando ociosas
        for i, m in enumerate(self.maos):
            if m[3] == "idle":
                lado = -1 if i == 0 else 1
                m[0] += (self.x + lado * 130 - m[0]) * 0.1
                m[1] += (self.y + 40 + math.sin(self.tempo * 0.05 + i) * 8 - m[1]) * 0.1

        if e == "espera":
            if self.t_estado > max(25, 70 - self.fase * 15):
                self.proximo_ataque(jogo)
        elif e == "laser":
            if self.t_estado == 1:
                esquerda = j.centro[0] < self.x
                a0 = math.radians(160 if esquerda else 20)
                a1 = math.radians(20 if esquerda else 160)
                jogo.perigos.append(Laser(self.origem_olho, a0, a1, aviso=int(50 / vel),
                                          duracao=int(90 / vel)))
                if self.fase >= 3:
                    jogo.perigos.append(Laser(self.origem_olho, a1, a0, aviso=int(80 / vel),
                                              duracao=int(90 / vel)))
            if self.t_estado > 170:
                self.mudar_estado("espera")
        elif e == "chuva":
            n = 6 + self.fase * 3
            if self.t_estado % max(6, 14 - self.fase * 3) == 0 and self.t_estado // 10 < n:
                x = random.uniform(self.arena.left + 30, self.arena.right - 30)
                if random.random() < 0.35:
                    x = j.centro[0]
                jogo.perigos.append(BlocoCaindo(x, self.arena.top, self.arena.bottom, atraso=40))
            if self.t_estado > n * 12 + 60:
                self.mudar_estado("espera")
        elif e == "tapa":
            m = self.maos[0] if j.centro[0] < self.x else self.maos[1]
            if self.t_estado == 1:
                m[3] = "mirar"
                m[2] = 0
            if m[3] == "mirar":
                m[0] += (j.centro[0] - m[0]) * 0.12
                m[1] += (self.arena.top + 150 - m[1]) * 0.12
                m[2] += 1
                if m[2] > 40 / vel:
                    m[3] = "descer"
                    m[2] = 0
            elif m[3] == "descer":
                m[1] += 16
                if m[1] + 24 >= self.arena.bottom:
                    m[1] = self.arena.bottom - 24
                    m[3] = "pousada"
                    m[2] = 0
                    jogo.camera.tremer(10, 16)
                    jogo.audio.tocar("explosao", 0.7)
                    for d in (-1, 1):
                        jogo.perigos.append(OndaChoque(m[0] + d * 30, self.arena.bottom, d, 6))
            elif m[3] == "pousada":
                m[2] += 1
                if m[2] > 40:
                    m[3] = "idle"
                    self.mudar_estado("espera")
            if self.t_estado > 200:
                for mm in self.maos:
                    mm[3] = "idle"
                self.mudar_estado("espera")
        elif e == "teleporte":
            if self.t_estado == 1:
                jogo.audio.tocar("teletransporte")
                jogo.particulas.bits(self.x, self.y, 20)
            if self.t_estado == 25:
                opcoes = [self.arena.left + 170, self.arena.centerx, self.arena.right - 170]
                opcoes.sort(key=lambda o: -abs(o - self.x))
                self.alvo_x = opcoes[0]
                self.x = self.alvo_x
                for m in self.maos:
                    m[0] = self.x
                jogo.particulas.bits(self.x, self.y, 20)
                # ao reaparecer, dispara leque de pacotes corrompidos
                for i in range(5 + self.fase * 2):
                    a = math.pi * (0.15 + 0.7 * i / (4 + self.fase * 2))
                    jogo.projeteis.append(Projetil(self.x, self.y + 20, math.cos(a) * 3.5,
                                                   math.sin(a) * 3.5, "inimigo", raio=6, vida=200,
                                                   cor=cfg.ROSA, atravessa=True))
            if self.t_estado > 60:
                self.mudar_estado("espera")
        elif e == "combo":
            if self.t_estado == 1:
                self.glitch_tela = 30
                jogo.efeito_glitch = 30
                jogo.audio.tocar("alerta")
            if self.t_estado in (20, 60, 100):
                for _ in range(3):
                    jogo.perigos.append(ColunaRaio(random.uniform(self.arena.left + 30, self.arena.right - 30),
                                                   self.arena.top, self.arena.bottom, aviso=45))
                jogo.perigos.append(ColunaRaio(j.centro[0], self.arena.top, self.arena.bottom, aviso=45))
            if self.t_estado == 70:
                jogo.perigos.append(Laser(self.origem_olho, math.radians(90), math.radians(90), aviso=40,
                                          duracao=30))
            if self.t_estado > 180:
                self.mudar_estado("espera")

    def retangulos_dano(self):
        rects = [self.rect]
        for m in self.maos:
            rects.append(pygame.Rect(int(m[0] - 22), int(m[1] - 22), 44, 44))
        return rects

    def desenhar(self, surf, cam, tempo):
        x, y = int(self.x - cam.ox), int(self.y - cam.oy)
        if self.estado == "teleporte" and 1 < self.t_estado < 25:
            if (self.t_estado // 2) % 2:
                return
        g = brilho_cache(110, (200, 40, 120) if self.fase >= 2 else (120, 60, 220), 60)
        surf.blit(g, (x - 110, y - 110), special_flags=pygame.BLEND_ADD)
        # pinos laterais
        for i in range(6):
            for lado in (-1, 1):
                px = x + lado * 60
                py = y - 36 + i * 14
                pygame.draw.rect(surf, cfg.CINZA_CLARO, (px if lado > 0 else px - 12, py, 12, 6))
        # corpo do chip
        cor = (30, 26, 40) if not self.flash else cfg.BRANCO
        corpo = pygame.Rect(x - 60, y - 50, 120, 100)
        pygame.draw.rect(surf, cor, corpo, border_radius=6)
        pygame.draw.rect(surf, (90, 70, 130), corpo, 3, border_radius=6)
        pygame.draw.circle(surf, (60, 50, 80), (x - 46, y - 36), 5)
        img = render_texto("BOOT v6.66", 11, (160, 120, 200), mono=True)
        surf.blit(img, img.get_rect(center=(x, y + 38)))
        # tela/rosto
        tela = pygame.Rect(x - 44, y - 34, 88, 56)
        pygame.draw.rect(surf, (10, 0, 16), tela)
        cor_olho = (255, 40, 120) if self.fase >= 2 else (200, 80, 255)
        olhar = 0
        if self.estado == "laser":
            olhar = 1
        for dx in (-18, 18):
            if olhar:
                pygame.draw.rect(surf, cor_olho, (x + dx - 10, y - 14, 20, 6))
            else:
                pygame.draw.rect(surf, cor_olho, (x + dx - 7, y - 22, 14, 14))
                pygame.draw.rect(surf, cfg.BRANCO, (x + dx - 3, y - 18, 4, 4))
        # boca de codigo
        for i in range(8):
            h = 3 + int(abs(math.sin(tempo * 0.2 + i)) * 8)
            pygame.draw.rect(surf, cor_olho, (x - 30 + i * 8, y + 8 - h // 2, 5, h))
        # linhas de glitch
        if self.glitch_tela > 0 or self.fase >= 3:
            for _ in range(3):
                gy = random.randint(tela.top, tela.bottom - 3)
                pygame.draw.rect(surf, random.choice([(255, 0, 80), (0, 255, 200)]),
                                 (tela.left + random.randint(-10, 10), gy, tela.w, 2))
        # maos (garras de pinos)
        for m in self.maos:
            mx, my = int(m[0] - cam.ox), int(m[1] - cam.oy)
            pygame.draw.line(surf, (70, 60, 100), (x, y), (mx, my), 4)
            pygame.draw.rect(surf, (40, 34, 56) if not self.flash else cfg.BRANCO,
                             (mx - 22, my - 18, 44, 36), border_radius=6)
            for k in range(4):
                pygame.draw.rect(surf, cfg.CINZA_CLARO, (mx - 18 + k * 11, my + 16, 6, 12))
            if m[3] == "mirar":
                pygame.draw.circle(surf, cfg.VERMELHO, (mx, my), 6 + (tempo // 3) % 4, 2)
                sombra_y = int(self.arena.bottom - cam.oy)
                pygame.draw.ellipse(surf, (255, 60, 60), (mx - 26, sombra_y - 6, 52, 10), 2)


TIPOS_CHEFES = {
    "curto": CurtoCircuito,
    "troia": CavaloDeTroia,
    "bootloader": BootloaderSombrio,
}
