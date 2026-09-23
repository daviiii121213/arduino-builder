"""
Configuracoes globais do jogo "Arduino Builder - A Aventura do Bitinho".

Aqui ficam as constantes de tela, fisica, cores e controles.
Tudo em um lugar so, para facilitar o ajuste fino (tuning) do jogo.
"""

import os

# ---------------------------------------------------------------------------
# Tela
# ---------------------------------------------------------------------------
LARGURA = 960
ALTURA = 540
FPS = 60
TITULO = "Arduino Builder - A Aventura do Bitinho"
TILE = 32

# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------
PASTA_JOGO = os.path.dirname(os.path.abspath(__file__))
ARQUIVO_SAVE = os.path.join(PASTA_JOGO, "save_bitinho.json")

# ---------------------------------------------------------------------------
# Fisica do jogador (unidades: pixels por frame a 60 FPS)
# ---------------------------------------------------------------------------
GRAVIDADE = 0.55
GRAVIDADE_MAX = 12.0
VELOCIDADE_ANDAR = 3.6
ACELERACAO_CHAO = 0.55
ACELERACAO_AR = 0.35
ATRITO_CHAO = 0.45
ATRITO_AR = 0.12
FORCA_PULO = -10.8
FORCA_PULO_DUPLO = -9.4
CORTE_PULO = 0.45          # quanto do pulo sobra ao soltar o botao cedo
COYOTE_FRAMES = 7          # frames de tolerancia depois de sair da borda
BUFFER_PULO_FRAMES = 8     # frames que o pulo "espera" antes de tocar o chao
VELOCIDADE_DASH = 9.5
DURACAO_DASH = 10
RECARGA_DASH = 40
FORCA_MOLA = -15.5
VELOCIDADE_PAREDE = 1.6
INVENCIVEL_FRAMES = 90
RECARGA_TIRO = 14
VELOCIDADE_TIRO = 8.5

# ---------------------------------------------------------------------------
# Cores (paleta inspirada em placas de circuito)
# ---------------------------------------------------------------------------
PRETO = (8, 10, 14)
BRANCO = (240, 244, 248)
CINZA = (120, 128, 140)
CINZA_ESCURO = (48, 54, 64)
CINZA_CLARO = (190, 196, 206)

AZUL_ARDUINO = (0, 129, 132)       # o famoso verde-azulado do Arduino
AZUL_ARDUINO_CLARO = (0, 176, 180)
AZUL_ARDUINO_ESCURO = (0, 82, 86)
AZUL_PLACA = (22, 88, 156)
AZUL_PLACA_CLARO = (60, 140, 210)

VERDE_PCB = (18, 94, 52)
VERDE_PCB_CLARO = (34, 140, 76)
VERDE_PCB_ESCURO = (10, 56, 32)
VERDE_LED = (70, 255, 110)

COBRE = (200, 120, 50)
COBRE_CLARO = (238, 170, 90)
OURO = (250, 204, 60)
OURO_ESCURO = (180, 140, 30)

VERMELHO = (230, 50, 60)
VERMELHO_ESCURO = (140, 20, 30)
LARANJA = (255, 140, 40)
AMARELO = (255, 230, 70)
ROXO = (150, 70, 220)
ROXO_ESCURO = (70, 30, 110)
ROSA = (255, 100, 180)
CIANO = (70, 230, 255)

BEGE_PROTOBOARD = (232, 226, 210)
BEGE_ESCURO = (190, 182, 160)

# Cores por mundo: (fundo_topo, fundo_base, tile, tile_borda, detalhe)
TEMAS_MUNDO = {
    0: {  # Tutorial / Bancada
        "nome": "Bancada do Maker",
        "ceu_topo": (30, 34, 48),
        "ceu_base": (60, 50, 70),
        "tile": (120, 84, 52),
        "tile_borda": (84, 56, 34),
        "detalhe": (160, 118, 76),
        "musica": "bancada",
    },
    1: {  # Protoboard
        "nome": "Vale da Protoboard",
        "ceu_topo": (18, 40, 60),
        "ceu_base": (40, 90, 110),
        "tile": BEGE_PROTOBOARD,
        "tile_borda": BEGE_ESCURO,
        "detalhe": (60, 60, 70),
        "musica": "protoboard",
    },
    2: {  # Placa-mae
        "nome": "Cidade Placa-Mae",
        "ceu_topo": (6, 20, 14),
        "ceu_base": (14, 60, 36),
        "tile": VERDE_PCB,
        "tile_borda": VERDE_PCB_ESCURO,
        "detalhe": COBRE,
        "musica": "placamae",
    },
    3: {  # Nuvem IoT
        "nome": "Nuvem IoT",
        "ceu_topo": (20, 10, 40),
        "ceu_base": (70, 40, 120),
        "tile": (70, 80, 120),
        "tile_borda": (40, 44, 80),
        "detalhe": CIANO,
        "musica": "nuvem",
    },
}

# ---------------------------------------------------------------------------
# Controles (teclado). Cada acao aceita varias teclas.
# Os valores sao preenchidos em tempo de execucao (precisam do pygame).
# ---------------------------------------------------------------------------
def teclas_padrao():
    import pygame
    return {
        "esquerda": [pygame.K_LEFT, pygame.K_a],
        "direita": [pygame.K_RIGHT, pygame.K_d],
        "cima": [pygame.K_UP, pygame.K_w],
        "baixo": [pygame.K_DOWN, pygame.K_s],
        "pular": [pygame.K_SPACE, pygame.K_z],
        "atirar": [pygame.K_j, pygame.K_x],
        "dash": [pygame.K_k, pygame.K_c, pygame.K_LSHIFT],
        "interagir": [pygame.K_e, pygame.K_DOWN, pygame.K_s],
        "pausa": [pygame.K_ESCAPE, pygame.K_p],
        "serial": [pygame.K_TAB],
        "confirmar": [pygame.K_RETURN, pygame.K_SPACE, pygame.K_z, pygame.K_KP_ENTER],
        "voltar": [pygame.K_ESCAPE, pygame.K_BACKSPACE],
    }

# ---------------------------------------------------------------------------
# Pontuacao / economia
# ---------------------------------------------------------------------------
VALOR_BYTE = 1
VALOR_BYTE_GRANDE = 10
BYTES_POR_INIMIGO = 3
BYTES_POR_CHEFE = 150
BYTES_POR_QUIZ = 25

# Tempos-alvo para rank S em cada nivel (segundos)
TEMPO_RANK_PADRAO = 120

DEBUG = False
