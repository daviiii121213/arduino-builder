"""
Definicao dos niveis.

Cada nivel e montado concatenando "blocos" (chunks) ASCII de 20x17 tiles.
Legenda dos caracteres:

    .  vazio                 #  bloco solido            =  plataforma fina
    ^  pinos (espinhos)      ~  solda derretida         > <  esteiras
    d  decoracao             P  inicio do jogador       E  porta USB (saida)
    b  byte                  $  byte grande             ?  componente secreto
    H  bateria (vida)        C  checkpoint              N  Prof. Volt (NPC)
    i  placa com dica        K  terminal de circuito    G  portao de rele
    Q  terminal de quiz      T  mola                    X  bloco quebravel
    M  plataforma movel (horizontal)                    m  plataforma movel (vertical)
    Z  chefe

    Inimigos: B bug, F glitch, S torreta, J saltador, D drone, V virus, W fio
"""

LARGURA_BLOCO = 20
ALTURA_BLOCO = 17


def _bloco(*linhas):
    assert len(linhas) == ALTURA_BLOCO, "bloco com %d linhas" % len(linhas)
    for l in linhas:
        assert len(l) == LARGURA_BLOCO, "linha com %d colunas: %r" % (len(l), l)
    return list(linhas)


VAZIO = "...................."
CHAO = "####################"

BLOCOS = {}

# ---------------------------------------------------------------------------
# Blocos basicos
# ---------------------------------------------------------------------------
BLOCOS["inicio"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    VAZIO,
    VAZIO,
    "..P....N.....i....d.",
    CHAO, CHAO, CHAO,
)

BLOCOS["fim"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..................##",
    "......b.b.b.......##",
    "..................##",
    "..................##",
    "..d.......E....d..##",
    CHAO, CHAO, CHAO,
)

BLOCOS["plano"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..........b.........",
    VAZIO,
    ".........===........",
    "....b.............b.",
    ".d....b....b.....d..",
    CHAO, CHAO, CHAO,
)

BLOCOS["degraus"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..............bbb...",
    VAZIO,
    ".............#####..",
    "........bb...#####..",
    ".......####..#####..",
    "...b...####..#####..",
    CHAO, CHAO, CHAO,
)

BLOCOS["buraco"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    ".........bb.........",
    "........b..b........",
    VAZIO,
    "..d.............d...",
    "#######.....########",
    "#######.....########",
    "#######.....########",
)

BLOCOS["buraco_plat"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    ".........b..........",
    VAZIO,
    VAZIO,
    "......======........",
    VAZIO,
    "####............####",
    "####............####",
    "####^^^^^^^^^^^^####",
)

BLOCOS["espinhos"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    ".......b.b..........",
    VAZIO,
    VAZIO,
    ".....^^^.....^^^....",
    CHAO, CHAO, CHAO,
)

BLOCOS["torre"] = _bloco(
    VAZIO, VAZIO,
    "........?...........",
    ".......===..........",
    VAZIO,
    VAZIO,
    "...===......===.....",
    VAZIO,
    VAZIO,
    ".......===......b...",
    VAZIO,
    VAZIO,
    "..===.......===.....",
    ".d..............d...",
    CHAO, CHAO, CHAO,
)

BLOCOS["checkpoint"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO, VAZIO, VAZIO,
    "...d.....C.......d..",
    CHAO, CHAO, CHAO,
)

BLOCOS["bateria"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    ".........H..........",
    "........###.........",
    "..d.....###......d..",
    CHAO, CHAO, CHAO,
)

BLOCOS["terminal_portao"] = _bloco(
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    "........#######.....",
    ".............b......",
    "...............b....",
    "...K........G....b..",
    CHAO, CHAO, CHAO,
)

BLOCOS["segredo_quebravel"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    "..........######....",
    "..........#....X....",
    "......##..#.?..X....",
    "..b.b.##..#$...X....",
    CHAO, CHAO, CHAO,
)

BLOCOS["mola"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "............?.......",
    "...........####.....",
    "........b...........",
    VAZIO,
    "........b...........",
    VAZIO,
    "........T...........",
    CHAO, CHAO, CHAO,
)

BLOCOS["lava_plats"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..........b.........",
    VAZIO,
    ".....b...===...b....",
    "....===.......===...",
    VAZIO,
    "###~~~~~~~~~~~~~~###",
    "####################",
    "####################",
)

BLOCOS["plataforma_movel"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "......b.b.b.b.......",
    VAZIO,
    VAZIO,
    "...M................",
    VAZIO,
    "###..............###",
    "###..............###",
    "###^^^^^^^^^^^^^^###",
)

BLOCOS["esteira"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    ".....b..b..b..b.....",
    VAZIO,
    VAZIO,
    "..............^^....",
    "###>>>>>>>>>>>######",
    CHAO, CHAO,
)

BLOCOS["esteira_contra"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "....b....b....b.....",
    VAZIO,
    "........===.........",
    VAZIO,
    "##<<<<<<<<<<<<<<<<##",
    CHAO, CHAO,
)

BLOCOS["quiz"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    ".......######.......",
    VAZIO,
    "..d.....Q..........d",
    CHAO, CHAO, CHAO,
)

BLOCOS["npc"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO, VAZIO, VAZIO,
    "..d......N.....d....",
    CHAO, CHAO, CHAO,
)

BLOCOS["corredor_baixo"] = _bloco(
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "####################",
    "..########....######",
    "....................",
    "..b.b.b.b.b.b.b.b...",
    CHAO, CHAO, CHAO,
)

BLOCOS["escada_plataformas"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..............?.....",
    ".............===....",
    VAZIO,
    VAZIO,
    "........===.........",
    VAZIO,
    "...===.........===..",
    VAZIO,
    "##................##",
    "##................##",
    "##^^^^^^^^^^^^^^^^##",
)

BLOCOS["vertical"] = _bloco(
    VAZIO, VAZIO,
    "...........?........",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "..........#####.....",
    "......m...#####.....",
    CHAO, CHAO, CHAO,
)

BLOCOS["pilares"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "........b....b......",
    VAZIO,
    ".......##...##......",
    "...b...##...##...b..",
    "..##...##...##..##..",
    "..##...##...##..##..",
    "##..................",
    "##..................",
    "##^^^^^^^^^^^^^^^^^^",
)

BLOCOS["pilares_fim"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    ".b....b.............",
    ".##..##.............",
    ".##..##.............",
    "......##############",
    "......##############",
    "^^^^^^##############",
)

# ---------------------------------------------------------------------------
# Blocos com inimigos
# ---------------------------------------------------------------------------
BLOCOS["bugs"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    ".......b....b.......",
    "......======........",
    VAZIO,
    "..d...B......B...d..",
    CHAO, CHAO, CHAO,
)

BLOCOS["bugs_plataformas"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..........b.b.......",
    ".........B..........",
    ".........######.....",
    VAZIO,
    "...B................",
    "..######......b.....",
    "............B.......",
    CHAO, CHAO, CHAO,
)

BLOCOS["glitches"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    ".....F..............",
    "..............F.....",
    VAZIO,
    "..b.b.b....b.b.b....",
    VAZIO,
    ".d...............d..",
    CHAO, CHAO, CHAO,
)

BLOCOS["torretas"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    "...........S........",
    "..........####......",
    "....b.....####...b..",
    CHAO, CHAO, CHAO,
)

BLOCOS["torretas_duplas"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "................S...",
    "...............###..",
    VAZIO,
    "...S......===.......",
    "..###...............",
    VAZIO,
    ".......b...b....d...",
    CHAO, CHAO, CHAO,
)

BLOCOS["saltadores"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    ".....b.......b......",
    VAZIO,
    VAZIO,
    "...J.......J......d.",
    CHAO, CHAO, CHAO,
)

BLOCOS["drones"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    ".......D............",
    VAZIO, VAZIO, VAZIO, VAZIO,
    "..........===.......",
    VAZIO,
    "..b..b........b..b..",
    CHAO, CHAO, CHAO,
)

BLOCOS["virus"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    "........b..b........",
    ".......======.......",
    VAZIO,
    "..d.V.........V..d..",
    CHAO, CHAO, CHAO,
)

BLOCOS["fios"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    "..........===.......",
    VAZIO,
    "...W..........W.....",
    CHAO, CHAO, CHAO,
)

BLOCOS["misto"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "..............F.....",
    VAZIO,
    ".........S..........",
    "........###.........",
    VAZIO,
    "...===.......===....",
    "..B...........J.....",
    CHAO, CHAO, CHAO,
)

BLOCOS["gauntlet"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    "......D.............",
    VAZIO, VAZIO, VAZIO, VAZIO,
    "............S.......",
    "...........###......",
    VAZIO,
    "...V....^^.......W..",
    CHAO, CHAO, CHAO,
)

# ---------------------------------------------------------------------------
# Arena de chefe (2 blocos = 30 tiles uteis)
# ---------------------------------------------------------------------------
BLOCOS["arena_1"] = _bloco(
    VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO, VAZIO,
    VAZIO,
    VAZIO,
    VAZIO,
    VAZIO,
    ".............======.",
    VAZIO,
    "...N.....C..........",
    CHAO, CHAO, CHAO,
)

BLOCOS["arena_2"] = _bloco(
    "...................#",
    "...................#",
    "...................#",
    "...................#",
    "...................#",
    ".....Z.............#",
    "...................#",
    "...................#",
    ".========..........#",
    "...................#",
    "...................#",
    "...........======..#",
    "...................#",
    "................E..#",
    CHAO, CHAO, CHAO,
)

BLOCOS["arena_2_alta"] = _bloco(
    "...................#",
    "...................#",
    "...................#",
    "...................#",
    "...................#",
    ".....Z.............#",
    "...................#",
    "...................#",
    "..======...........#",
    "...................#",
    "...................#",
    "...........======..#",
    "...................#",
    "................E..#",
    CHAO, CHAO, CHAO,
)

# ---------------------------------------------------------------------------
# Sequencia de niveis
# ---------------------------------------------------------------------------
NIVEIS = [
    {
        "id": "0-1", "nome": "Primeiros Passos", "mundo": 0, "tempo_rank": 100,
        "blocos": ["inicio", "plano", "degraus", "npc", "bugs", "buraco", "npc", "checkpoint",
                   "espinhos", "torre", "npc", "terminal_portao", "segredo_quebravel", "mola", "fim"],
        "npcs": ["tutorial_1", "tutorial_2", "tutorial_4", "tutorial_3"],
        "placas": ["Bem-vindo a bancada!"],
        "puzzle": (4, 3, 1), "quiz": [],
    },
    {
        "id": "1-1", "nome": "Barramento de Entrada", "mundo": 1, "tempo_rank": 110,
        "blocos": ["inicio", "plano", "bugs", "buraco", "torre", "checkpoint", "espinhos",
                   "bugs_plataformas", "quiz", "segredo_quebravel", "saltadores", "mola", "fim"],
        "npcs": ["mundo1"], "placas": ["Vale da Protoboard ->"],
        "puzzle": (5, 4, 1), "quiz": [0],
    },
    {
        "id": "1-2", "nome": "Trilhas de Jumper", "mundo": 1, "tempo_rank": 130,
        "blocos": ["inicio", "buraco_plat", "glitches", "degraus", "terminal_portao", "checkpoint",
                   "plataforma_movel", "escada_plataformas", "saltadores", "bateria", "torretas",
                   "segredo_quebravel", "mola", "fim"],
        "npcs": ["mundo1_2"], "placas": ["Cuidado: pinos afiados!"],
        "puzzle": (5, 4, 2), "quiz": [3],
    },
    {
        "id": "1-3", "nome": "Divisor de Tensao", "mundo": 1, "tempo_rank": 150,
        "blocos": ["inicio", "espinhos", "pilares", "pilares_fim", "misto", "checkpoint", "lava_plats",
                   "torre", "quiz", "bugs_plataformas", "terminal_portao", "bateria", "escada_plataformas",
                   "glitches", "vertical", "fim"],
        "npcs": ["mundo1_3"], "placas": ["Solda derretida queima!"],
        "puzzle": (6, 4, 2), "quiz": [4],
    },
    {
        "id": "1-C", "nome": "Chefe: Curto-Circuito", "mundo": 1, "tempo_rank": 120,
        "blocos": ["inicio", "plano", "bateria", "arena_1", "arena_2"],
        "npcs": ["mundo1", "mundo1_chefe"], "placas": ["Perigo: alta tensao"],
        "chefe": "curto", "quiz": [],
    },
    {
        "id": "2-1", "nome": "Trilha de Cobre", "mundo": 2, "tempo_rank": 130,
        "blocos": ["inicio", "virus", "buraco", "fios", "torre", "checkpoint", "esteira",
                   "bugs_plataformas", "quiz", "segredo_quebravel", "torretas_duplas", "mola", "fim"],
        "npcs": ["mundo2"], "placas": ["Cidade Placa-Mae"],
        "puzzle": (6, 4, 2), "quiz": [1],
    },
    {
        "id": "2-2", "nome": "Via Expressa do Barramento", "mundo": 2, "tempo_rank": 150,
        "blocos": ["inicio", "esteira", "esteira_contra", "virus", "terminal_portao", "checkpoint",
                   "plataforma_movel", "fios", "escada_plataformas", "bateria", "lava_plats",
                   "segredo_quebravel", "misto", "mola", "fim"],
        "npcs": ["mundo2_2"], "placas": ["Esteiras de dados!"],
        "puzzle": (6, 5, 2), "quiz": [5],
    },
    {
        "id": "2-3", "nome": "Nucleo do Processador", "mundo": 2, "tempo_rank": 170,
        "blocos": ["inicio", "corredor_baixo", "fios", "pilares", "pilares_fim", "checkpoint",
                   "torretas_duplas", "quiz", "vertical", "virus", "terminal_portao", "bateria",
                   "gauntlet", "escada_plataformas", "lava_plats", "mola", "fim"],
        "npcs": ["mundo2_3"], "placas": ["Area restrita: CPU"],
        "puzzle": (7, 5, 3), "quiz": [9],
    },
    {
        "id": "2-C", "nome": "Chefe: Cavalo de Troia", "mundo": 2, "tempo_rank": 140,
        "blocos": ["inicio", "virus", "bateria", "arena_1", "arena_2"],
        "npcs": ["mundo2", "mundo2_chefe"], "placas": ["Presente suspeito a frente"],
        "chefe": "troia", "quiz": [],
    },
    {
        "id": "3-1", "nome": "Sinal de WiFi", "mundo": 3, "tempo_rank": 150,
        "blocos": ["inicio", "drones", "buraco_plat", "glitches", "torre", "checkpoint",
                   "plataforma_movel", "quiz", "saltadores", "segredo_quebravel", "misto", "mola", "fim"],
        "npcs": ["mundo3"], "placas": ["Nuvem IoT"],
        "puzzle": (7, 5, 2), "quiz": [10],
    },
    {
        "id": "3-2", "nome": "Protocolo MQTT", "mundo": 3, "tempo_rank": 170,
        "blocos": ["inicio", "gauntlet", "escada_plataformas", "drones", "terminal_portao",
                   "checkpoint", "esteira_contra", "virus", "lava_plats", "bateria", "vertical",
                   "quiz", "torretas_duplas", "segredo_quebravel", "mola", "fim"],
        "npcs": ["mundo3_2"], "placas": ["Publish / Subscribe"],
        "puzzle": (7, 6, 3), "quiz": [13],
    },
    {
        "id": "3-3", "nome": "Servidor Central", "mundo": 3, "tempo_rank": 190,
        "blocos": ["inicio", "pilares", "pilares_fim", "drones", "gauntlet", "checkpoint",
                   "terminal_portao", "fios", "misto", "quiz", "plataforma_movel", "bateria",
                   "escada_plataformas", "glitches", "torre", "vertical", "mola", "fim"],
        "npcs": ["mundo3_3"], "placas": ["Ultimo backup: nunca"],
        "puzzle": (8, 6, 3), "quiz": [19],
    },
    {
        "id": "3-C", "nome": "Chefe: Bootloader Sombrio", "mundo": 3, "tempo_rank": 180,
        "blocos": ["inicio", "drones", "bateria", "arena_1", "arena_2_alta"],
        "npcs": ["mundo3", "mundo3_chefe"], "placas": ["sudo rm -rf / (nao!)"],
        "chefe": "bootloader", "quiz": [],
    },
]


def montar_mapa(definicao):
    """Concatena os blocos horizontalmente e retorna a lista de linhas."""
    linhas = [""] * ALTURA_BLOCO
    for nome in definicao["blocos"]:
        bloco = BLOCOS[nome]
        for i in range(ALTURA_BLOCO):
            linhas[i] += bloco[i]
    return linhas


def arena_do_nivel(definicao):
    """Retorna (col_esquerda, col_direita) da arena de chefe em tiles, ou None."""
    if "chefe" not in definicao:
        return None
    blocos = definicao["blocos"]
    i1 = next(i for i, n in enumerate(blocos) if n.startswith("arena_1"))
    i2 = next(i for i, n in enumerate(blocos) if n.startswith("arena_2"))
    return (i1 * LARGURA_BLOCO + 10, i2 * LARGURA_BLOCO + 19)


def dados_nivel(indice):
    d = dict(NIVEIS[indice])
    d["mapa"] = montar_mapa(d)
    d["indice"] = indice
    d["arena"] = arena_do_nivel(d)
    return d


def total_componentes(indice):
    d = NIVEIS[indice]
    n = sum("".join(BLOCOS[b]).count("?") for b in d["blocos"])
    return min(3, n)


def validar():
    """Checa consistencia basica dos niveis (usado em testes)."""
    erros = []
    for i, d in enumerate(NIVEIS):
        mapa = montar_mapa(d)
        texto_mapa = "".join(mapa)
        if texto_mapa.count("P") != 1:
            erros.append("%s: precisa de exatamente 1 P" % d["id"])
        if texto_mapa.count("E") != 1:
            erros.append("%s: precisa de exatamente 1 E" % d["id"])
        if "chefe" not in d and total_componentes(i) < 3:
            erros.append("%s: menos de 3 componentes" % d["id"])
        if texto_mapa.count("N") > len(d.get("npcs", [])):
            erros.append("%s: NPCs sem dialogo" % d["id"])
        if texto_mapa.count("Q") > len(d.get("quiz", [])):
            erros.append("%s: quiz sem pergunta" % d["id"])
        if texto_mapa.count("K") and "puzzle" not in d:
            erros.append("%s: terminal sem puzzle" % d["id"])
    return erros


if __name__ == "__main__":
    problemas = validar()
    for p in problemas:
        print("ERRO:", p)
    for i, d in enumerate(NIVEIS):
        print(d["id"], len(montar_mapa(d)[0]), "colunas,", total_componentes(i), "componentes")
