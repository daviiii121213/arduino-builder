"""
Itens e objetos interativos do cenario:
projeteis, bytes, componentes secretos, baterias, checkpoints, porta USB
(saida), terminais de puzzle, terminais de quiz, portoes, molas, blocos
quebraveis, plataformas moveis e o mentor Prof. Volt.
"""

import math
import random

import pygame

import config as cfg
from util import brilho_cache, texto, render_texto

T = cfg.TILE


class Entidade:
    vivo = True

    def atualizar(self, jogo):
        pass

    def desenhar(self, surf, cam, tempo):
        pass


# ---------------------------------------------------------------------------
# Projeteis
# ---------------------------------------------------------------------------
class Projetil(Entidade):
    def __init__(self, x, y, vx, vy, dono, dano=1, img=None, raio=4, vida=90,
                 gravidade=0.0, perseguir=None, cor=cfg.AMARELO, atravessa=False):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.dono = dono
        self.dano = dano
        self.img = img
        self.raio = raio
        self.vida = vida
        self.gravidade = gravidade
        self.perseguir = perseguir
        self.cor = cor
        self.atravessa = atravessa
        self.vivo = True
        self.rastro = []

    @property
    def rect(self):
        return pygame.Rect(int(self.x - self.raio), int(self.y - self.raio), self.raio * 2, self.raio * 2)

    def atualizar(self, jogo):
        if self.perseguir is not None and self.vida > 20:
            alvo = self.perseguir.centro
            ang = math.atan2(alvo[1] - self.y, alvo[0] - self.x)
            vel = math.hypot(self.vx, self.vy)
            atual = math.atan2(self.vy, self.vx)
            diff = (ang - atual + math.pi) % math.tau - math.pi
            atual += max(-0.05, min(0.05, diff))
            self.vx = math.cos(atual) * vel
            self.vy = math.sin(atual) * vel
        self.vy += self.gravidade
        self.rastro.append((self.x, self.y))
        if len(self.rastro) > 5:
            self.rastro.pop(0)
        self.x += self.vx
        self.y += self.vy
        self.vida -= 1
        if self.vida <= 0:
            self.vivo = False
        if not self.atravessa and jogo.nivel.solido_px(self.x, self.y):
            self.vivo = False
            jogo.particulas.faiscas(self.x, self.y, 5, self.cor if self.dono != "jogador" else cfg.BRANCO,
                                    2, 12)
            jogo.ao_projetil_bater_parede(self)
        if self.y > jogo.nivel.altura + 50:
            self.vivo = False

    def desenhar(self, surf, cam, tempo):
        for i, (rx, ry) in enumerate(self.rastro):
            r = max(1, int(self.raio * (i + 1) / len(self.rastro) * 0.7))
            pygame.draw.circle(surf, self.cor if self.dono != "jogador" else (200, 200, 210),
                               (int(rx - cam.ox), int(ry - cam.oy)), r)
        g = brilho_cache(self.raio * 3, self.cor if self.dono != "jogador" else (220, 220, 255), 90)
        surf.blit(g, (int(self.x - cam.ox - self.raio * 3), int(self.y - cam.oy - self.raio * 3)),
                  special_flags=pygame.BLEND_ADD)
        if self.img:
            surf.blit(self.img, (int(self.x - cam.ox - self.img.get_width() / 2),
                                 int(self.y - cam.oy - self.img.get_height() / 2)))
        else:
            pygame.draw.circle(surf, self.cor, (int(self.x - cam.ox), int(self.y - cam.oy)), self.raio)
            pygame.draw.circle(surf, cfg.BRANCO, (int(self.x - cam.ox), int(self.y - cam.oy)),
                               max(1, self.raio // 2))


# ---------------------------------------------------------------------------
# Coletaveis
# ---------------------------------------------------------------------------
class Byte(Entidade):
    """Moeda do jogo. Bytes compram upgrades na Loja do Maker."""

    def __init__(self, x, y, sprites, grande=False, solto=False):
        self.x = x + T / 2
        self.y = y + T / 2
        self.base_y = self.y
        self.sprites = sprites
        self.grande = grande
        self.valor = cfg.VALOR_BYTE_GRANDE if grande else cfg.VALOR_BYTE
        self.vivo = True
        self.fase = random.uniform(0, math.tau)
        self.solto = solto
        self.vx = random.uniform(-2, 2) if solto else 0
        self.vy = random.uniform(-5, -2) if solto else 0
        self.tempo_vida = 600 if solto else -1
        self.atraso_coleta = 20 if solto else 0

    @property
    def rect(self):
        r = 12 if self.grande else 8
        return pygame.Rect(int(self.x - r), int(self.y - r), r * 2, r * 2)

    def atualizar(self, jogo):
        if self.atraso_coleta > 0:
            self.atraso_coleta -= 1
        if self.solto:
            self.vy = min(self.vy + 0.3, 8)
            self.x += self.vx
            self.vx *= 0.98
            if jogo.nivel.solido_px(self.x, self.y + 8) and self.vy > 0:
                self.vy *= -0.5
                self.y -= 1
                if abs(self.vy) < 1:
                    self.vy = 0
            else:
                self.y += self.vy
            self.tempo_vida -= 1
            if self.tempo_vida <= 0:
                self.vivo = False
        # ima de neodimio
        j = jogo.jogador
        if j.tem("ima") and self.atraso_coleta == 0:
            cx, cy = j.centro
            d = math.hypot(cx - self.x, cy - self.y)
            if d < 130:
                f = 5.0 * (1 - d / 130) + 1
                self.x += (cx - self.x) / max(d, 1) * f
                self.y += (cy - self.y) / max(d, 1) * f
                if not self.solto:
                    self.base_y = self.y

    def desenhar(self, surf, cam, tempo):
        lista = self.sprites.byte_grande if self.grande else self.sprites.byte
        img = lista[(tempo // 5 + int(self.fase * 3)) % len(lista)]
        y = self.y if self.solto else self.base_y + math.sin(tempo * 0.08 + self.fase) * 3
        if self.solto and self.tempo_vida < 120 and (tempo // 4) % 2:
            return
        surf.blit(img, (int(self.x - img.get_width() / 2 - cam.ox), int(y - img.get_height() / 2 - cam.oy)))


class Componente(Entidade):
    """Componente secreto (resistor, LED ou capacitor). 3 por nivel."""

    NOMES = ["Resistor 220R", "LED Vermelho", "Capacitor 100uF"]

    def __init__(self, x, y, indice, sprites, ja_coletado=False):
        self.x = x + T / 2
        self.y = y + T / 2
        self.indice = indice
        self.sprites = sprites
        self.vivo = True
        self.ja_coletado = ja_coletado

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 14), int(self.y - 14), 28, 28)

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.componentes[self.indice % 3]
        y = self.y + math.sin(tempo * 0.06) * 4
        g = brilho_cache(30, cfg.OURO if not self.ja_coletado else (120, 120, 140), 90)
        surf.blit(g, (int(self.x - 30 - cam.ox), int(y - 30 - cam.oy)), special_flags=pygame.BLEND_ADD)
        if self.ja_coletado:
            img = img.copy()
            img.set_alpha(110)
        surf.blit(img, (int(self.x - img.get_width() / 2 - cam.ox), int(y - img.get_height() / 2 - cam.oy)))


class Bateria(Entidade):
    def __init__(self, x, y, sprites):
        self.x = x + T / 2
        self.y = y + T / 2
        self.sprites = sprites
        self.vivo = True

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 9), int(self.y - 12), 18, 24)

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.bateria
        y = self.y + math.sin(tempo * 0.07) * 3
        g = brilho_cache(22, cfg.VERDE_LED, 60)
        surf.blit(g, (int(self.x - 22 - cam.ox), int(y - 22 - cam.oy)), special_flags=pygame.BLEND_ADD)
        surf.blit(img, (int(self.x - img.get_width() / 2 - cam.ox), int(y - img.get_height() / 2 - cam.oy)))


# ---------------------------------------------------------------------------
# Objetos de cenario
# ---------------------------------------------------------------------------
class Checkpoint(Entidade):
    def __init__(self, x, y, sprites):
        self.x = x + T / 2
        self.y = y + T  # base
        self.sprites = sprites
        self.ativo = False
        self.vivo = True
        self.pulso = 0

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 14), int(self.y - 56), 28, 56)

    @property
    def ponto_respawn(self):
        return (self.x - 9, self.y - 30)

    def atualizar(self, jogo):
        if self.pulso > 0:
            self.pulso -= 1

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.checkpoint_on if self.ativo else self.sprites.checkpoint_off
        x = int(self.x - img.get_width() / 2 - cam.ox)
        y = int(self.y - img.get_height() - cam.oy)
        if self.ativo:
            g = brilho_cache(26 + (self.pulso // 3), cfg.VERDE_LED, 90)
            surf.blit(g, (x + 10 - g.get_width() // 2, y + 9 - g.get_height() // 2),
                      special_flags=pygame.BLEND_ADD)
        surf.blit(img, (x, y))


class Saida(Entidade):
    """Porta USB: encostar nela faz o 'upload' e conclui o nivel."""

    def __init__(self, x, y, sprites):
        self.x = x + T / 2
        self.y = y + T
        self.sprites = sprites
        self.vivo = True
        self.aberta = True

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 20), int(self.y - 72), 40, 72)

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.saida[(tempo // 8) % 4]
        x = int(self.x - img.get_width() / 2 - cam.ox)
        y = int(self.y - img.get_height() - cam.oy)
        if not self.aberta:
            img = img.copy()
            img.set_alpha(70)
            surf.blit(img, (x, y))
            texto(surf, "BLOQUEADA", (x + 28, y - 12), 12, cfg.VERMELHO, centro=True)
            return
        g = brilho_cache(50, cfg.AZUL_ARDUINO_CLARO, 50)
        surf.blit(g, (x + 28 - 50, y + 44 - 50), special_flags=pygame.BLEND_ADD)
        surf.blit(img, (x, y))


class Terminal(Entidade):
    """Terminal de circuito: abre o puzzle; ao resolver, abre portoes."""

    def __init__(self, x, y, sprites, grupo="A"):
        self.x = x + T / 2
        self.y = y + T
        self.sprites = sprites
        self.resolvido = False
        self.vivo = True
        self.grupo = grupo
        self.perto = False

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 18), int(self.y - 40), 36, 40)

    def desenhar(self, surf, cam, tempo):
        lista = self.sprites.terminal_ok if self.resolvido else self.sprites.terminal
        img = lista[(tempo // 30) % 2]
        x = int(self.x - img.get_width() / 2 - cam.ox)
        y = int(self.y - img.get_height() - cam.oy)
        surf.blit(img, (x, y))
        if self.perto and not self.resolvido:
            balao = "[E] Montar circuito"
            texto(surf, balao, (x + 18, y - 14 + math.sin(tempo * 0.1) * 2), 14, cfg.AMARELO, centro=True)


class TerminalQuiz(Entidade):
    """Terminal com uma pergunta sobre Arduino. Acertar da bytes bonus."""

    def __init__(self, x, y, sprites, indice_pergunta):
        self.x = x + T / 2
        self.y = y + T
        self.sprites = sprites
        self.indice = indice_pergunta
        self.respondido = False
        self.vivo = True
        self.perto = False

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 18), int(self.y - 40), 36, 40)

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.quiz[(tempo // 20) % 2]
        x = int(self.x - img.get_width() / 2 - cam.ox)
        y = int(self.y - img.get_height() - cam.oy)
        if self.respondido:
            img = img.copy()
            img.set_alpha(100)
        surf.blit(img, (x, y))
        if self.perto and not self.respondido:
            texto(surf, "[E] Quiz Arduino", (x + 18, y - 14 + math.sin(tempo * 0.1) * 2), 14,
                  cfg.CIANO, centro=True)


class Portao(Entidade):
    """Parede de rele: bloqueia a passagem ate o terminal ser resolvido."""

    def __init__(self, x, y, altura_tiles=3, grupo="A"):
        self.x = x
        self.y = y - (altura_tiles - 1) * T
        self.altura = altura_tiles * T
        self.aberto = False
        self.progresso = 0.0
        self.vivo = True
        self.grupo = grupo

    @property
    def rect(self):
        h = int(self.altura * (1 - self.progresso))
        return pygame.Rect(int(self.x + 6), int(self.y), T - 12, max(0, h))

    @property
    def bloqueando(self):
        return self.progresso < 0.95

    def atualizar(self, jogo):
        if self.aberto and self.progresso < 1:
            self.progresso = min(1.0, self.progresso + 0.025)

    def desenhar(self, surf, cam, tempo):
        r = cam.aplicar(self.rect)
        if r.h <= 0:
            return
        pygame.draw.rect(surf, (40, 30, 34), r)
        for yy in range(r.top, r.bottom, 12):
            cor = cfg.VERMELHO if (yy // 12 + tempo // 10) % 2 else (120, 20, 30)
            pygame.draw.rect(surf, cor, (r.x + 2, yy + 2, r.w - 4, 6))
        pygame.draw.rect(surf, (20, 16, 18), r, 2)
        # topo com LED indicador
        pygame.draw.circle(surf, cfg.VERMELHO if not self.aberto else cfg.VERDE_LED,
                           (r.centerx, r.top - 4), 4)


class Mola(Entidade):
    def __init__(self, x, y, sprites):
        self.x = x
        self.y = y + T - 18
        self.sprites = sprites
        self.comprimida = 0
        self.vivo = True

    @property
    def rect(self):
        return pygame.Rect(int(self.x + 4), int(self.y + 4), T - 8, 14)

    def atualizar(self, jogo):
        if self.comprimida > 0:
            self.comprimida -= 1

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.mola[1 if self.comprimida > 0 else 0]
        surf.blit(img, (int(self.x - cam.ox), int(self.y - cam.oy)))


class BlocoQuebravel(Entidade):
    """Chip rachado: quebra com tiro ou dash e pode esconder segredos."""

    def __init__(self, x, y, sprites):
        self.x = x
        self.y = y
        self.sprites = sprites
        self.vivo = True
        self.hp = 2
        self.tremor = 0

    @property
    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), T, T)

    def danificar(self, jogo, qtd=1):
        self.hp -= qtd
        self.tremor = 8
        if self.hp <= 0:
            self.vivo = False
            jogo.audio.tocar("quebrar")
            jogo.particulas.explosao(self.x + T / 2, self.y + T / 2, 0.5,
                                     [(110, 94, 76), (70, 60, 50), cfg.CINZA_CLARO])
            jogo.particulas.bits(self.x + T / 2, self.y + T / 2, 5)
            jogo.estatisticas["blocos"] = jogo.estatisticas.get("blocos", 0) + 1

    def atualizar(self, jogo):
        if self.tremor > 0:
            self.tremor -= 1

    def desenhar(self, surf, cam, tempo):
        dx = random.randint(-2, 2) if self.tremor else 0
        surf.blit(self.sprites.quebravel, (int(self.x - cam.ox + dx), int(self.y - cam.oy)))


class PlataformaMovel(Entidade):
    """Plataforma que vai e volta (horizontal 'M' ou vertical 'V')."""

    def __init__(self, x, y, sprites, vertical=False, distancia=4, velocidade=1.2):
        self.x0 = x
        self.y0 = y
        self.x = float(x)
        self.y = float(y)
        self.sprites = sprites
        self.vertical = vertical
        self.distancia = distancia * T
        self.velocidade = velocidade
        self.t = 0.0
        self.dx = 0.0
        self.dy = 0.0
        self.vivo = True

    @property
    def rect(self):
        return pygame.Rect(int(self.x), int(self.y), 96, 14)

    def atualizar(self, jogo):
        self.t += self.velocidade / max(1, self.distancia) * math.pi
        desloc = (1 - math.cos(self.t)) / 2 * self.distancia
        ax, ay = self.x, self.y
        if self.vertical:
            self.y = self.y0 - desloc
        else:
            self.x = self.x0 + desloc
        self.dx = self.x - ax
        self.dy = self.y - ay

    def desenhar(self, surf, cam, tempo):
        surf.blit(self.sprites.plataforma_movel, (int(self.x - cam.ox), int(self.y - cam.oy)))


class NPC(Entidade):
    """Prof. Volt, o multimetro mentor. Fala ao interagir."""

    def __init__(self, x, y, sprites, dialogo_id):
        self.x = x + T / 2
        self.y = y + T
        self.sprites = sprites
        self.dialogo_id = dialogo_id
        self.vivo = True
        self.perto = False
        self.falou = False

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 17), int(self.y - 48), 34, 48)

    def desenhar(self, surf, cam, tempo):
        img = self.sprites.prof_volt[(tempo // 25) % 2]
        y = self.y - img.get_height() + math.sin(tempo * 0.05) * 2
        surf.blit(img, (int(self.x - img.get_width() / 2 - cam.ox), int(y - cam.oy)))
        if self.perto:
            texto(surf, "[E] Conversar", (int(self.x - cam.ox), int(y - cam.oy) - 14), 14,
                  cfg.BRANCO, centro=True)
        elif not self.falou:
            # balao de "!" chamando atencao
            bx, by = int(self.x - cam.ox), int(y - cam.oy) - 16 + int(math.sin(tempo * 0.15) * 3)
            pygame.draw.circle(surf, cfg.BRANCO, (bx, by), 9)
            pygame.draw.circle(surf, (0, 0, 0), (bx, by), 9, 1)
            texto(surf, "!", (bx, by), 16, (200, 30, 30), centro=True, sombra=False, negrito=True)


class Placa(Entidade):
    """Placa com dica curta (so leitura, aparece ao se aproximar)."""

    def __init__(self, x, y, mensagem):
        self.x = x + T / 2
        self.y = y + T
        self.mensagem = mensagem
        self.vivo = True
        self.perto = False

    @property
    def rect(self):
        return pygame.Rect(int(self.x - 40), int(self.y - 60), 80, 60)

    def desenhar(self, surf, cam, tempo):
        x, y = int(self.x - cam.ox), int(self.y - cam.oy)
        pygame.draw.rect(surf, (90, 60, 30), (x - 2, y - 24, 4, 24))
        pygame.draw.rect(surf, (160, 120, 70), (x - 14, y - 34, 28, 16), border_radius=2)
        pygame.draw.rect(surf, (90, 60, 30), (x - 14, y - 34, 28, 16), 2, border_radius=2)
        pygame.draw.line(surf, (90, 60, 30), (x - 8, y - 28), (x + 8, y - 28))
        pygame.draw.line(surf, (90, 60, 30), (x - 8, y - 24), (x + 4, y - 24))
        if self.perto:
            img = render_texto(self.mensagem, 14, cfg.BRANCO)
            w = img.get_width() + 16
            r = pygame.Rect(0, 0, w, 26)
            r.midbottom = (x, y - 40)
            s = pygame.Surface(r.size, pygame.SRCALPHA)
            pygame.draw.rect(s, (10, 14, 20, 220), s.get_rect(), border_radius=6)
            pygame.draw.rect(s, (*cfg.AZUL_ARDUINO_CLARO, 255), s.get_rect(), 1, border_radius=6)
            surf.blit(s, r)
            surf.blit(img, img.get_rect(center=r.center))
