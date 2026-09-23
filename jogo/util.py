"""
Funcoes utilitarias: matematica, fontes, texto, camera e entrada.
"""

import math
import random

import pygame

import config as cfg


# ---------------------------------------------------------------------------
# Matematica
# ---------------------------------------------------------------------------
def clamp(v, a, b):
    """Limita v ao intervalo [a, b]."""
    return max(a, min(b, v))


def lerp(a, b, t):
    """Interpolacao linear."""
    return a + (b - a) * t


def lerp_cor(c1, c2, t):
    """Interpola duas cores RGB."""
    t = clamp(t, 0.0, 1.0)
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
    )


def sinal(v):
    if v > 0:
        return 1
    if v < 0:
        return -1
    return 0


def aproximar(v, alvo, passo):
    """Move v em direcao ao alvo sem ultrapassar."""
    if v < alvo:
        return min(v + passo, alvo)
    if v > alvo:
        return max(v - passo, alvo)
    return v


def distancia(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def angulo_para(a, b):
    return math.atan2(b[1] - a[1], b[0] - a[0])


def ease_out_cubic(t):
    t = clamp(t, 0.0, 1.0)
    return 1 - (1 - t) ** 3


def ease_in_out(t):
    t = clamp(t, 0.0, 1.0)
    return t * t * (3 - 2 * t)


def ease_out_back(t):
    t = clamp(t, 0.0, 1.0)
    c1 = 1.70158
    c3 = c1 + 1
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def ease_out_elastic(t):
    t = clamp(t, 0.0, 1.0)
    if t in (0.0, 1.0):
        return t
    c4 = (2 * math.pi) / 3
    return 2 ** (-10 * t) * math.sin((t * 10 - 0.75) * c4) + 1


def oscilar(tempo, velocidade=1.0, amplitude=1.0, fase=0.0):
    return math.sin(tempo * velocidade + fase) * amplitude


def formatar_tempo(frames):
    """Converte frames para texto mm:ss.cc"""
    segundos = frames / cfg.FPS
    m = int(segundos // 60)
    s = segundos - m * 60
    return "%02d:%05.2f" % (m, s)


# ---------------------------------------------------------------------------
# Fontes e texto
# ---------------------------------------------------------------------------
_cache_fontes = {}


def fonte(tamanho, mono=False, negrito=False):
    """Retorna uma fonte em cache. Usa fontes do sistema com fallback."""
    chave = (tamanho, mono, negrito)
    if chave in _cache_fontes:
        return _cache_fontes[chave]
    f = None
    if mono:
        for nome in ("dejavusansmono", "consolas", "couriernew", "liberationmono", "monospace"):
            try:
                caminho = pygame.font.match_font(nome, bold=negrito)
                if caminho:
                    f = pygame.font.Font(caminho, tamanho)
                    break
            except Exception:
                f = None
    if f is None:
        f = pygame.font.Font(None, int(tamanho * 1.35))
        f.set_bold(negrito)
    _cache_fontes[chave] = f
    return f


_cache_textos = {}


def render_texto(txt, tamanho, cor, mono=False, negrito=False):
    chave = (txt, tamanho, cor, mono, negrito)
    s = _cache_textos.get(chave)
    if s is None:
        s = fonte(tamanho, mono, negrito).render(txt, True, cor)
        if len(_cache_textos) > 800:
            _cache_textos.clear()
        _cache_textos[chave] = s
    return s


def texto(surf, txt, pos, tamanho=20, cor=cfg.BRANCO, centro=False, direita=False,
          sombra=True, mono=False, negrito=False, cor_sombra=(0, 0, 0), alpha=255):
    """Desenha um texto com sombra opcional. Retorna o rect ocupado."""
    img = render_texto(str(txt), tamanho, cor, mono, negrito)
    r = img.get_rect()
    if centro:
        r.center = pos
    elif direita:
        r.topright = pos
    else:
        r.topleft = pos
    if alpha < 255:
        img = img.copy()
        img.set_alpha(alpha)
    if sombra:
        sombra_img = render_texto(str(txt), tamanho, cor_sombra, mono, negrito)
        if alpha < 255:
            sombra_img = sombra_img.copy()
            sombra_img.set_alpha(alpha)
        surf.blit(sombra_img, (r.x + 2, r.y + 2))
    surf.blit(img, r)
    return r


def quebrar_texto(txt, tamanho, largura_max, mono=False):
    """Quebra texto em linhas que cabem na largura dada."""
    f = fonte(tamanho, mono)
    linhas = []
    for paragrafo in str(txt).split("\n"):
        palavras = paragrafo.split(" ")
        atual = ""
        for p in palavras:
            teste = (atual + " " + p).strip()
            if f.size(teste)[0] <= largura_max:
                atual = teste
            else:
                if atual:
                    linhas.append(atual)
                atual = p
        linhas.append(atual)
    return linhas


def painel(surf, rect, cor=(20, 26, 36), borda=cfg.AZUL_ARDUINO_CLARO, alpha=230, raio=8,
           espessura=2):
    """Desenha um painel arredondado semi-transparente."""
    rect = pygame.Rect(rect)
    temp = pygame.Surface(rect.size, pygame.SRCALPHA)
    pygame.draw.rect(temp, (*cor, alpha), temp.get_rect(), border_radius=raio)
    if borda:
        pygame.draw.rect(temp, (*borda, 255), temp.get_rect(), espessura, border_radius=raio)
    surf.blit(temp, rect.topleft)


def gradiente_vertical(tamanho, cor_topo, cor_base):
    """Cria uma superficie com gradiente vertical."""
    w, h = tamanho
    s = pygame.Surface((w, h))
    for y in range(h):
        pygame.draw.line(s, lerp_cor(cor_topo, cor_base, y / max(1, h - 1)), (0, y), (w, y))
    return s


def brilho(raio, cor, intensidade=120):
    """Cria um brilho (glow) radial para ser usado com BLEND_ADD.

    Como a mistura aditiva ignora o canal alfa, a cor e pre-multiplicada
    pela intensidade: o centro fica claro e as bordas chegam a preto.
    """
    raio = max(2, int(raio))
    s = pygame.Surface((raio * 2, raio * 2))
    s.fill((0, 0, 0))
    passos = max(4, raio // 2)
    for i in range(passos, 0, -1):
        r = int(raio * i / passos)
        k = min(1.0, intensidade / 150.0) * (1 - i / passos) ** 1.6
        pygame.draw.circle(s, (int(cor[0] * k), int(cor[1] * k), int(cor[2] * k)), (raio, raio), r)
    return s


_cache_brilho = {}


def brilho_cache(raio, cor, intensidade=120):
    chave = (raio, cor, intensidade)
    if chave not in _cache_brilho:
        _cache_brilho[chave] = brilho(raio, cor, intensidade)
    return _cache_brilho[chave]


# ---------------------------------------------------------------------------
# Temporizador simples
# ---------------------------------------------------------------------------
class Temporizador:
    def __init__(self, duracao, repetir=False):
        self.duracao = duracao
        self.restante = 0
        self.repetir = repetir

    def iniciar(self, duracao=None):
        if duracao is not None:
            self.duracao = duracao
        self.restante = self.duracao

    def atualizar(self):
        """Retorna True no frame em que termina."""
        if self.restante > 0:
            self.restante -= 1
            if self.restante == 0:
                if self.repetir:
                    self.restante = self.duracao
                return True
        return False

    @property
    def ativo(self):
        return self.restante > 0

    @property
    def progresso(self):
        if self.duracao <= 0:
            return 1.0
        return 1.0 - self.restante / self.duracao


# ---------------------------------------------------------------------------
# Camera com tremor (screen shake)
# ---------------------------------------------------------------------------
class Camera:
    def __init__(self, largura_mundo, altura_mundo):
        self.x = 0.0
        self.y = 0.0
        self.largura_mundo = largura_mundo
        self.altura_mundo = altura_mundo
        self.tremor = 0.0
        self.tremor_duracao = 0
        self.offset_tremor = (0, 0)
        self.olhar_frente = 0.0
        self.tremor_ativo = True

    def tremer(self, intensidade, duracao=15):
        if not self.tremor_ativo:
            return
        self.tremor = max(self.tremor, intensidade)
        self.tremor_duracao = max(self.tremor_duracao, duracao)

    def seguir(self, rect, direcao=1, suave=0.12, instantaneo=False):
        self.olhar_frente = lerp(self.olhar_frente, direcao * 60, 0.04)
        alvo_x = rect.centerx - cfg.LARGURA / 2 + self.olhar_frente
        alvo_y = rect.centery - cfg.ALTURA / 2 - 20
        if instantaneo:
            self.x, self.y = alvo_x, alvo_y
        else:
            self.x = lerp(self.x, alvo_x, suave)
            self.y = lerp(self.y, alvo_y, suave * 0.8)
        self.limitar()

    def limitar(self):
        self.x = clamp(self.x, 0, max(0, self.largura_mundo - cfg.LARGURA))
        self.y = clamp(self.y, 0, max(0, self.altura_mundo - cfg.ALTURA))

    def atualizar(self):
        if self.tremor_duracao > 0:
            self.tremor_duracao -= 1
            f = self.tremor * (self.tremor_duracao / 15.0 if self.tremor_duracao < 15 else 1)
            self.offset_tremor = (random.uniform(-f, f), random.uniform(-f, f))
            if self.tremor_duracao == 0:
                self.tremor = 0
        else:
            self.offset_tremor = (0, 0)

    @property
    def ox(self):
        return int(self.x + self.offset_tremor[0])

    @property
    def oy(self):
        return int(self.y + self.offset_tremor[1])

    def aplicar(self, rect):
        return pygame.Rect(rect.x - self.ox, rect.y - self.oy, rect.w, rect.h)

    def ponto(self, x, y):
        return (int(x - self.ox), int(y - self.oy))

    def visivel(self, rect, margem=64):
        return (rect.right > self.x - margem and rect.left < self.x + cfg.LARGURA + margem and
                rect.bottom > self.y - margem and rect.top < self.y + cfg.ALTURA + margem)


# ---------------------------------------------------------------------------
# Entrada unificada (teclado + controle)
# ---------------------------------------------------------------------------
class Controle:
    """Guarda o estado das acoes do jogador neste frame e no anterior."""

    ACOES = ("esquerda", "direita", "cima", "baixo", "pular", "atirar", "dash",
             "interagir", "pausa", "serial", "confirmar", "voltar")

    def __init__(self):
        self.mapa = cfg.teclas_padrao()
        self.atual = {a: False for a in self.ACOES}
        self.anterior = dict(self.atual)
        self.eventos_pressionados = set()
        self.joystick = None
        self._iniciar_joystick()

    def _iniciar_joystick(self):
        try:
            pygame.joystick.init()
            if pygame.joystick.get_count() > 0:
                self.joystick = pygame.joystick.Joystick(0)
                self.joystick.init()
        except Exception:
            self.joystick = None

    def processar_evento(self, e):
        if e.type == pygame.KEYDOWN:
            for acao, teclas in self.mapa.items():
                if e.key in teclas:
                    self.eventos_pressionados.add(acao)
        elif e.type == pygame.JOYBUTTONDOWN:
            mapa_botoes = {0: ("pular", "confirmar"), 1: ("voltar", "dash"), 2: ("atirar",),
                           3: ("interagir",), 7: ("pausa",), 6: ("serial",)}
            for acao in mapa_botoes.get(e.button, ()):
                self.eventos_pressionados.add(acao)
        elif e.type == pygame.JOYDEVICEADDED and self.joystick is None:
            self._iniciar_joystick()

    def atualizar(self):
        self.anterior = dict(self.atual)
        teclas = pygame.key.get_pressed()
        for acao, lista in self.mapa.items():
            self.atual[acao] = any(teclas[k] for k in lista)
        if self.joystick is not None:
            try:
                ax = self.joystick.get_axis(0)
                ay = self.joystick.get_axis(1)
                if ax < -0.4:
                    self.atual["esquerda"] = True
                if ax > 0.4:
                    self.atual["direita"] = True
                if ay < -0.5:
                    self.atual["cima"] = True
                if ay > 0.5:
                    self.atual["baixo"] = True
                if self.joystick.get_numhats() > 0:
                    hx, hy = self.joystick.get_hat(0)
                    if hx < 0:
                        self.atual["esquerda"] = True
                    if hx > 0:
                        self.atual["direita"] = True
                    if hy > 0:
                        self.atual["cima"] = True
                    if hy < 0:
                        self.atual["baixo"] = True
                botoes = {"pular": 0, "dash": 1, "atirar": 2, "interagir": 3}
                for acao, b in botoes.items():
                    if b < self.joystick.get_numbuttons() and self.joystick.get_button(b):
                        self.atual[acao] = True
            except Exception:
                pass
        self._pressionados = self.eventos_pressionados
        self.eventos_pressionados = set()

    def segurando(self, acao):
        return self.atual.get(acao, False)

    def apertou(self, acao):
        """True apenas no frame em que a acao foi pressionada."""
        return acao in getattr(self, "_pressionados", set())

    def soltou(self, acao):
        return self.anterior.get(acao, False) and not self.atual.get(acao, False)

    def eixo_x(self):
        return (1 if self.segurando("direita") else 0) - (1 if self.segurando("esquerda") else 0)

    def eixo_y(self):
        return (1 if self.segurando("baixo") else 0) - (1 if self.segurando("cima") else 0)
