"""
Audio 100% procedural: nenhum arquivo externo e necessario.

Os efeitos sonoros sao sintetizados com ondas quadradas, triangulares,
senoidais e ruido branco, lembrando os bipes de um buzzer piezo ligado
ao Arduino. A musica e um pequeno sequenciador chiptune.
"""

import array
import math
import random

import pygame

TAXA = 22050
AMPLITUDE = 9000

# Frequencias das notas (A4 = 440 Hz)
_NOMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def freq_nota(nome):
    """Converte 'A4', 'C#5' etc. em frequencia. '-' ou None = silencio."""
    if not nome or nome == "-":
        return 0.0
    if nome[1] == "#":
        n, oitava = nome[:2], int(nome[2:])
    else:
        n, oitava = nome[0], int(nome[1:])
    indice = _NOMES.index(n) + (oitava + 1) * 12
    return 440.0 * 2 ** ((indice - 69) / 12.0)


# ---------------------------------------------------------------------------
# Osciladores
# ---------------------------------------------------------------------------
def _quadrada(fase, duty=0.5):
    return 1.0 if (fase % 1.0) < duty else -1.0


def _triangular(fase):
    f = fase % 1.0
    return 4.0 * f - 1.0 if f < 0.5 else 3.0 - 4.0 * f


def _serra(fase):
    return 2.0 * (fase % 1.0) - 1.0


def _seno(fase):
    return math.sin(2 * math.pi * fase)


ONDAS = {
    "quadrada": _quadrada,
    "triangular": _triangular,
    "serra": _serra,
    "seno": _seno,
}


def sintetizar(duracao, f_inicio, f_fim=None, onda="quadrada", volume=1.0,
               ataque=0.005, decaimento=None, ruido=0.0, vibrato=0.0, duty=0.5,
               deslize="exp"):
    """Gera amostras (lista de floats -1..1) para um efeito simples."""
    n = int(TAXA * duracao)
    if f_fim is None:
        f_fim = f_inicio
    if decaimento is None:
        decaimento = duracao
    amostras = [0.0] * n
    fase = 0.0
    func = ONDAS.get(onda, _quadrada)
    for i in range(n):
        t = i / TAXA
        p = i / max(1, n - 1)
        if deslize == "exp" and f_inicio > 0 and f_fim > 0:
            f = f_inicio * (f_fim / f_inicio) ** p
        else:
            f = f_inicio + (f_fim - f_inicio) * p
        if vibrato:
            f *= 1.0 + 0.03 * math.sin(2 * math.pi * vibrato * t)
        fase += f / TAXA
        if onda == "quadrada":
            v = func(fase, duty)
        else:
            v = func(fase)
        if ruido:
            v = v * (1 - ruido) + random.uniform(-1, 1) * ruido
        # envelope
        if t < ataque:
            env = t / ataque
        else:
            env = max(0.0, 1.0 - (t - ataque) / max(0.001, decaimento))
        amostras[i] = v * env * volume
    return amostras


def misturar(*listas):
    n = max(len(l) for l in listas)
    saida = [0.0] * n
    for l in listas:
        for i, v in enumerate(l):
            saida[i] += v
    return saida


def concatenar(*listas):
    saida = []
    for l in listas:
        saida.extend(l)
    return saida


def silencio(duracao):
    return [0.0] * int(TAXA * duracao)


# ---------------------------------------------------------------------------
# Gerenciador de audio
# ---------------------------------------------------------------------------
class Audio:
    def __init__(self):
        self.ativo = False
        self.canais_mixer = 1
        self.sons = {}
        self.musicas = {}
        self.volume_sfx = 0.7
        self.volume_musica = 0.45
        self.musica_atual = None
        self.canal_musica = None
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.pre_init(TAXA, -16, 1, 512)
                pygame.mixer.init(TAXA, -16, 1, 512)
            info = pygame.mixer.get_init()
            if info:
                self.taxa_real = info[0]
                self.canais_mixer = info[2]
                self.ativo = True
                pygame.mixer.set_num_channels(16)
                self.canal_musica = pygame.mixer.Channel(15)
                pygame.mixer.set_reserved(1)
        except Exception:
            self.ativo = False
        if self.ativo:
            self._gerar_efeitos()

    # -------------------------------------------------------------------
    def _para_som(self, amostras, volume=1.0):
        dados = array.array("h")
        for v in amostras:
            v = max(-1.0, min(1.0, v * volume))
            s = int(v * AMPLITUDE)
            dados.append(s)
            if self.canais_mixer == 2:
                dados.append(s)
        try:
            return pygame.mixer.Sound(buffer=dados.tobytes())
        except Exception:
            return None

    def _registrar(self, nome, amostras, volume=1.0):
        som = self._para_som(amostras, volume)
        if som:
            self.sons[nome] = som

    def _gerar_efeitos(self):
        r = self._registrar
        r("pulo", sintetizar(0.14, 260, 620, "quadrada", 0.6, duty=0.25))
        r("pulo_duplo", sintetizar(0.16, 400, 900, "quadrada", 0.55, duty=0.125))
        r("tiro", sintetizar(0.09, 1200, 300, "quadrada", 0.4, duty=0.25))
        r("byte", concatenar(sintetizar(0.05, 988, None, "quadrada", 0.45),
                             sintetizar(0.12, 1319, None, "quadrada", 0.45)))
        r("byte_grande", concatenar(sintetizar(0.05, 784, None, "quadrada", 0.45),
                                    sintetizar(0.05, 988, None, "quadrada", 0.45),
                                    sintetizar(0.05, 1175, None, "quadrada", 0.45),
                                    sintetizar(0.15, 1568, None, "quadrada", 0.45)))
        r("dano", sintetizar(0.3, 400, 80, "serra", 0.7, ruido=0.3))
        r("inimigo_dano", sintetizar(0.08, 600, 200, "quadrada", 0.45, ruido=0.2))
        r("explosao", sintetizar(0.5, 200, 30, "quadrada", 0.8, ruido=0.8))
        r("explosao_grande", sintetizar(1.2, 150, 20, "serra", 0.9, ruido=0.85))
        r("powerup", concatenar(*[sintetizar(0.06, freq_nota(n), None, "quadrada", 0.5, duty=0.25)
                                   for n in ("C5", "E5", "G5", "C6", "E6", "G6")]))
        r("menu", sintetizar(0.04, 880, None, "quadrada", 0.3, duty=0.25))
        r("confirmar", concatenar(sintetizar(0.05, 660, None, "quadrada", 0.4),
                                  sintetizar(0.09, 990, None, "quadrada", 0.4)))
        r("voltar", sintetizar(0.1, 500, 250, "quadrada", 0.35))
        r("solda", sintetizar(0.25, 3000, 2000, "seno", 0.3, ruido=0.6))
        r("dash", sintetizar(0.18, 200, 900, "serra", 0.45, ruido=0.5))
        r("mola", sintetizar(0.25, 200, 1100, "seno", 0.6, vibrato=18))
        r("checkpoint", concatenar(*[sintetizar(0.08, freq_nota(n), None, "triangular", 0.7)
                                      for n in ("G4", "C5", "E5", "G5")]))
        r("porta", sintetizar(0.4, 120, 60, "quadrada", 0.5, ruido=0.4, duty=0.3))
        r("erro", concatenar(sintetizar(0.12, 180, None, "quadrada", 0.5),
                             silencio(0.03),
                             sintetizar(0.2, 140, None, "quadrada", 0.5)))
        r("bip", sintetizar(0.06, 2000, None, "quadrada", 0.25, duty=0.5))
        r("digitar", sintetizar(0.02, 1600, 1200, "quadrada", 0.12, ruido=0.5))
        r("rotacionar", sintetizar(0.05, 700, 900, "triangular", 0.5))
        r("circuito_ok", concatenar(*[sintetizar(0.07, freq_nota(n), None, "quadrada", 0.45, duty=0.25)
                                       for n in ("E5", "G5", "B5", "E6")]))
        r("led_queimou", sintetizar(0.6, 900, 60, "serra", 0.6, ruido=0.7))
        r("pisar", sintetizar(0.12, 500, 150, "quadrada", 0.5, duty=0.3))
        r("chefe_rugido", misturar(sintetizar(1.0, 90, 50, "serra", 0.6, vibrato=6),
                                   sintetizar(1.0, 180, 60, "quadrada", 0.3, ruido=0.4)))
        r("chefe_dano", sintetizar(0.15, 300, 90, "quadrada", 0.6, ruido=0.4))
        r("laser", sintetizar(0.5, 1500, 1400, "serra", 0.35, vibrato=30))
        r("raio", sintetizar(0.35, 3000, 100, "quadrada", 0.6, ruido=0.9))
        r("alerta", concatenar(sintetizar(0.1, 1000, None, "quadrada", 0.4),
                               silencio(0.05),
                               sintetizar(0.1, 1000, None, "quadrada", 0.4)))
        r("teletransporte", sintetizar(0.4, 200, 2400, "seno", 0.5, vibrato=40))
        r("quebrar", sintetizar(0.2, 400, 100, "quadrada", 0.5, ruido=0.7))
        r("vitoria", concatenar(*[sintetizar(d, freq_nota(n), None, "quadrada", 0.5, duty=0.25)
                                   for n, d in (("C5", 0.12), ("E5", 0.12), ("G5", 0.12),
                                                ("C6", 0.25), ("G5", 0.12), ("C6", 0.5))]))
        r("upload", concatenar(*[sintetizar(0.03, 800 + (i % 5) * 300, None, "quadrada", 0.25)
                                  for i in range(20)]))
        r("game_over", concatenar(*[sintetizar(d, freq_nota(n), None, "triangular", 0.7)
                                     for n, d in (("G4", 0.2), ("F#4", 0.2), ("F4", 0.2),
                                                  ("E4", 0.6))]))
        r("conquista", concatenar(*[sintetizar(0.08, freq_nota(n), None, "seno", 0.6)
                                     for n in ("C6", "E6", "G6", "C7")]))
        r("dialogo", sintetizar(0.03, 520, None, "quadrada", 0.18, duty=0.5))
        r("componente", concatenar(*[sintetizar(0.07, freq_nota(n), None, "triangular", 0.7)
                                      for n in ("A5", "C#6", "E6", "A6", "E6", "A6")]))

    # -------------------------------------------------------------------
    def tocar(self, nome, volume=1.0):
        if not self.ativo:
            return
        som = self.sons.get(nome)
        if som:
            som.set_volume(self.volume_sfx * volume)
            som.play()

    def definir_volumes(self, sfx, musica):
        self.volume_sfx = max(0.0, min(1.0, sfx))
        self.volume_musica = max(0.0, min(1.0, musica))
        if self.ativo and self.canal_musica:
            self.canal_musica.set_volume(self.volume_musica)

    # -------------------------------------------------------------------
    # Musica
    # -------------------------------------------------------------------
    def tocar_musica(self, nome):
        if not self.ativo or nome == self.musica_atual:
            return
        self.musica_atual = nome
        if nome is None:
            self.canal_musica.fadeout(400)
            return
        if nome not in self.musicas:
            dados = MUSICAS.get(nome)
            if dados is None:
                return
            amostras = compor_musica(dados)
            self.musicas[nome] = self._para_som(amostras, 0.8)
        som = self.musicas.get(nome)
        if som:
            self.canal_musica.set_volume(self.volume_musica)
            self.canal_musica.play(som, loops=-1, fade_ms=500)

    def parar_musica(self):
        self.tocar_musica(None)


# ---------------------------------------------------------------------------
# Composicoes (sequenciador simples). Cada faixa: lista de (nota, batidas).
# ---------------------------------------------------------------------------
def _repetir(padrao, vezes):
    saida = []
    for _ in range(vezes):
        saida.extend(padrao)
    return saida


MUSICAS = {
    "titulo": {
        "bpm": 112,
        "melodia": [("E5", 1), ("G5", 1), ("A5", 2), ("G5", 1), ("E5", 1), ("D5", 2),
                    ("C5", 1), ("D5", 1), ("E5", 1), ("G5", 1), ("A5", 3), ("-", 1),
                    ("A5", 1), ("C6", 1), ("B5", 2), ("G5", 1), ("E5", 1), ("D5", 2),
                    ("E5", 1), ("D5", 1), ("C5", 1), ("D5", 1), ("C5", 3), ("-", 1)],
        "baixo": _repetir([("A2", 2), ("A3", 2), ("F2", 2), ("F3", 2),
                           ("C3", 2), ("C3", 2), ("G2", 2), ("G3", 2)], 2),
        "bateria": _repetir(["k", "h", "s", "h"], 16),
    },
    "bancada": {
        "bpm": 100,
        "melodia": [("C5", 1), ("E5", 1), ("G5", 1), ("E5", 1), ("F5", 1), ("A5", 1), ("G5", 2),
                    ("E5", 1), ("C5", 1), ("D5", 1), ("E5", 1), ("C5", 4),
                    ("C5", 1), ("E5", 1), ("G5", 1), ("C6", 1), ("B5", 1), ("G5", 1), ("A5", 2),
                    ("G5", 1), ("E5", 1), ("D5", 1), ("B4", 1), ("C5", 4)],
        "baixo": _repetir([("C3", 1), ("G3", 1), ("C3", 1), ("G3", 1),
                           ("F2", 1), ("C3", 1), ("G2", 1), ("D3", 1)], 4),
        "bateria": _repetir(["k", "h", "h", "h", "s", "h", "h", "h"], 8),
    },
    "protoboard": {
        "bpm": 132,
        "melodia": [("A4", 0.5), ("C5", 0.5), ("E5", 1), ("A5", 1), ("G5", 0.5), ("E5", 0.5),
                    ("D5", 1), ("E5", 1), ("C5", 1), ("-", 1),
                    ("F5", 0.5), ("E5", 0.5), ("D5", 1), ("C5", 1), ("B4", 1), ("C5", 1),
                    ("D5", 1), ("E5", 2),
                    ("A4", 0.5), ("C5", 0.5), ("E5", 1), ("A5", 1), ("B5", 0.5), ("C6", 0.5),
                    ("B5", 1), ("G5", 1), ("E5", 1), ("-", 1),
                    ("F5", 1), ("E5", 1), ("D5", 1), ("B4", 1), ("A4", 3), ("-", 1)],
        "baixo": _repetir([("A2", 0.5), ("A3", 0.5)] * 4 + [("F2", 0.5), ("F3", 0.5)] * 4 +
                          [("C3", 0.5), ("C4", 0.5)] * 4 + [("E2", 0.5), ("E3", 0.5)] * 4, 2),
        "bateria": _repetir(["k", "h", "s", "h", "k", "k", "s", "h"], 8),
    },
    "placamae": {
        "bpm": 124,
        "melodia": [("D5", 1), ("-", 0.5), ("D5", 0.5), ("F5", 1), ("A5", 1),
                    ("G5", 1), ("F5", 1), ("E5", 2),
                    ("C5", 1), ("-", 0.5), ("C5", 0.5), ("E5", 1), ("G5", 1),
                    ("F5", 1), ("E5", 1), ("D5", 2),
                    ("D5", 0.5), ("E5", 0.5), ("F5", 0.5), ("G5", 0.5), ("A5", 1), ("D6", 1),
                    ("C6", 1), ("A5", 1), ("F5", 2),
                    ("G5", 1), ("F5", 1), ("E5", 1), ("C5", 1), ("D5", 4)],
        "baixo": _repetir([("D2", 1), ("D3", 0.5), ("D2", 0.5), ("A2", 1), ("D3", 1),
                           ("C2", 1), ("C3", 0.5), ("C2", 0.5), ("G2", 1), ("C3", 1)], 4),
        "bateria": _repetir(["k", "h", "s", "k", "k", "h", "s", "h"], 8),
    },
    "nuvem": {
        "bpm": 96,
        "melodia": [("E5", 1.5), ("B5", 0.5), ("A5", 1), ("G5", 1), ("F#5", 2), ("D5", 2),
                    ("E5", 1.5), ("G5", 0.5), ("F#5", 1), ("D5", 1), ("B4", 4),
                    ("C5", 1.5), ("G5", 0.5), ("F#5", 1), ("E5", 1), ("D5", 2), ("B4", 2),
                    ("C5", 1), ("D5", 1), ("E5", 1), ("F#5", 1), ("E5", 4)],
        "baixo": _repetir([("E2", 2), ("B2", 2), ("C3", 2), ("D3", 2)], 4),
        "bateria": _repetir(["k", "-", "h", "-", "s", "-", "h", "h"], 8),
    },
    "chefe": {
        "bpm": 150,
        "melodia": [("E5", 0.5), ("E5", 0.5), ("G5", 0.5), ("E5", 0.5), ("A#5", 1), ("A5", 1),
                    ("E5", 0.5), ("E5", 0.5), ("G5", 0.5), ("E5", 0.5), ("D5", 1), ("D#5", 1),
                    ("E5", 0.5), ("E5", 0.5), ("G5", 0.5), ("E5", 0.5), ("B5", 1), ("A#5", 1),
                    ("A5", 0.5), ("G5", 0.5), ("F#5", 0.5), ("G5", 0.5), ("E5", 2)],
        "baixo": _repetir([("E2", 0.5), ("E3", 0.5)] * 8, 2),
        "bateria": _repetir(["k", "h", "s", "h", "k", "s", "k", "s"], 6),
    },
    "vitoria": {
        "bpm": 120,
        "melodia": [("C5", 1), ("E5", 1), ("G5", 1), ("C6", 1), ("A5", 1), ("F5", 1),
                    ("G5", 2), ("E5", 1), ("C5", 1), ("D5", 1), ("G4", 1), ("C5", 4)],
        "baixo": [("C3", 2), ("A2", 2), ("F2", 2), ("G2", 2), ("C3", 2), ("G2", 2), ("C3", 4)],
        "bateria": _repetir(["k", "h", "s", "h"], 8),
    },
}


def _gerar_bateria(tipo, duracao):
    n = int(TAXA * duracao)
    saida = [0.0] * n
    if tipo == "k":  # bumbo
        fase = 0.0
        for i in range(min(n, int(TAXA * 0.15))):
            t = i / TAXA
            f = 150 * (0.3 ** (t / 0.15))
            fase += f / TAXA
            saida[i] = math.sin(2 * math.pi * fase) * (1 - t / 0.15) * 0.9
    elif tipo == "s":  # caixa
        for i in range(min(n, int(TAXA * 0.12))):
            t = i / TAXA
            saida[i] = random.uniform(-1, 1) * (1 - t / 0.12) * 0.45
    elif tipo == "h":  # chimbal
        for i in range(min(n, int(TAXA * 0.03))):
            t = i / TAXA
            saida[i] = random.uniform(-1, 1) * (1 - t / 0.03) * 0.18
    return saida


def _render_faixa(notas, bpm, onda, volume, duty=0.5, total=None):
    batida = 60.0 / bpm
    saida = []
    for nota, dur in notas:
        d = dur * batida
        f = freq_nota(nota)
        n = int(TAXA * d)
        if f <= 0:
            saida.extend([0.0] * n)
            continue
        func = ONDAS[onda]
        fase = 0.0
        passo = f / TAXA
        sustain = n * 0.85
        for i in range(n):
            fase += passo
            v = func(fase, duty) if onda == "quadrada" else func(fase)
            env = 1.0 if i < sustain else max(0.0, 1.0 - (i - sustain) / (n - sustain + 1))
            if i < 60:
                env *= i / 60.0
            saida.append(v * env * volume)
    if total is not None:
        if len(saida) < total:
            saida.extend([0.0] * (total - len(saida)))
        else:
            saida = saida[:total]
    return saida


def compor_musica(dados):
    bpm = dados["bpm"]
    batida = 60.0 / bpm
    total_batidas = sum(d for _, d in dados["melodia"])
    total = int(TAXA * total_batidas * batida)
    melodia = _render_faixa(dados["melodia"], bpm, "quadrada", 0.30, duty=0.25, total=total)
    baixo = _render_faixa(dados["baixo"], bpm, "triangular", 0.45, total=total)
    bateria = [0.0] * total
    passo = int(TAXA * batida / 2)  # colcheias
    pos = 0
    for tipo in dados.get("bateria", []):
        if pos >= total:
            break
        if tipo != "-":
            som = _gerar_bateria(tipo, batida / 2)
            for i, v in enumerate(som):
                if pos + i < total:
                    bateria[pos + i] += v
        pos += passo
    return [melodia[i] + baixo[i] + bateria[i] for i in range(total)]
