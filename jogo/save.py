"""
Salvamento do progresso em JSON e sistema de conquistas.
"""

import json
import os

import config as cfg
import textos


def progresso_padrao():
    return {
        "versao": 1,
        "nivel_liberado": 0,           # indice do maior nivel liberado
        "bytes": 0,                    # bytes disponiveis para gastar
        "bytes_total": 0,              # bytes coletados na vida toda
        "upgrades": {},                # id -> nivel
        "componentes": {},             # id_nivel -> lista de indices coletados
        "melhores_tempos": {},         # id_nivel -> frames
        "ranks": {},                   # id_nivel -> "S".."C"
        "concluidos": [],              # ids de niveis concluidos
        "conquistas": [],
        "quiz_respondidos": [],        # indices de perguntas ja acertadas
        "estatisticas": {
            "inimigos": 0, "mortes": 0, "pulos": 0, "tiros": 0, "puzzles": 0,
            "quiz_acertos": 0, "compras": 0, "tempo_total": 0, "chefes": 0,
        },
        "opcoes": {
            "volume_sfx": 0.7, "volume_musica": 0.45, "tela_cheia": False,
            "mostrar_fps": False, "tremor_tela": True, "serial_monitor": True,
        },
        "viu_intro": False,
        "zerou": False,
    }


class Save:
    def __init__(self, caminho=cfg.ARQUIVO_SAVE):
        self.caminho = caminho
        self.dados = progresso_padrao()
        self.novas_conquistas = []  # fila de notificacoes para a HUD
        self.carregar()

    # ------------------------------------------------------------------
    def carregar(self):
        if not os.path.exists(self.caminho):
            return
        try:
            with open(self.caminho, "r", encoding="utf-8") as f:
                lido = json.load(f)
            base = progresso_padrao()
            for k, v in lido.items():
                if isinstance(v, dict) and isinstance(base.get(k), dict):
                    base[k].update(v)
                else:
                    base[k] = v
            self.dados = base
        except (OSError, ValueError):
            # save corrompido: comeca do zero sem travar o jogo
            self.dados = progresso_padrao()

    def salvar(self):
        try:
            temp = self.caminho + ".tmp"
            with open(temp, "w", encoding="utf-8") as f:
                json.dump(self.dados, f, indent=2, ensure_ascii=False)
            os.replace(temp, self.caminho)
        except OSError:
            pass

    def apagar(self):
        opcoes = dict(self.dados["opcoes"])
        self.dados = progresso_padrao()
        self.dados["opcoes"] = opcoes
        self.salvar()

    @property
    def tem_progresso(self):
        d = self.dados
        return d["nivel_liberado"] > 0 or d["bytes_total"] > 0 or bool(d["concluidos"])

    # ------------------------------------------------------------------
    # Atalhos
    # ------------------------------------------------------------------
    @property
    def opcoes(self):
        return self.dados["opcoes"]

    @property
    def estat(self):
        return self.dados["estatisticas"]

    def upgrade(self, uid):
        return self.dados["upgrades"].get(uid, 0)

    def comprar(self, info):
        atual = self.upgrade(info["id"])
        if atual >= info["max"] or self.dados["bytes"] < info["preco"]:
            return False
        self.dados["bytes"] -= info["preco"]
        self.dados["upgrades"][info["id"]] = atual + 1
        self.estat["compras"] += 1
        self.verificar_conquistas()
        self.salvar()
        return True

    def componentes_nivel(self, nid):
        return self.dados["componentes"].get(nid, [])

    def total_componentes(self):
        return sum(len(v) for v in self.dados["componentes"].values())

    def registrar_conclusao(self, indice, nid, tempo, bytes_ganhos, componentes, rank, total_niveis):
        d = self.dados
        if nid not in d["concluidos"]:
            d["concluidos"].append(nid)
        d["nivel_liberado"] = max(d["nivel_liberado"], min(indice + 1, total_niveis - 1))
        d["bytes"] += bytes_ganhos
        d["bytes_total"] += bytes_ganhos
        atuais = set(d["componentes"].get(nid, []))
        atuais.update(componentes)
        d["componentes"][nid] = sorted(atuais)
        melhor = d["melhores_tempos"].get(nid)
        if melhor is None or tempo < melhor:
            d["melhores_tempos"][nid] = tempo
        ordem = "SABC"
        antigo = d["ranks"].get(nid)
        if antigo is None or ordem.index(rank) < ordem.index(antigo):
            d["ranks"][nid] = rank
        self.verificar_conquistas()
        self.salvar()

    # ------------------------------------------------------------------
    # Conquistas
    # ------------------------------------------------------------------
    def desbloquear(self, cid):
        if cid in self.dados["conquistas"]:
            return False
        self.dados["conquistas"].append(cid)
        info = next((c for c in textos.CONQUISTAS if c["id"] == cid), None)
        if info:
            self.novas_conquistas.append(info)
        self.salvar()
        return True

    def verificar_conquistas(self, total_componentes_jogo=None):
        e = self.estat
        d = self.dados
        if "0-1" in d["concluidos"]:
            self.desbloquear("primeiro_passo")
        if e["puzzles"] >= 1:
            self.desbloquear("blink")
        if e["inimigos"] >= 50:
            self.desbloquear("caca_bugs")
        if e["inimigos"] >= 200:
            self.desbloquear("exterminador")
        if d["bytes_total"] >= 1024:
            self.desbloquear("rico")
        if self.total_componentes() >= 10:
            self.desbloquear("colecionador")
        if total_componentes_jogo and self.total_componentes() >= total_componentes_jogo:
            self.desbloquear("mestre_componentes")
        if "1-C" in d["concluidos"]:
            self.desbloquear("chefe1")
        if "2-C" in d["concluidos"]:
            self.desbloquear("chefe2")
        if "3-C" in d["concluidos"]:
            self.desbloquear("chefe3")
            self.desbloquear("zerou")
        if "S" in d["ranks"].values():
            self.desbloquear("rank_s")
        if e["quiz_acertos"] >= 10:
            self.desbloquear("quiz_mestre")
        if e["compras"] >= 5:
            self.desbloquear("compras")
        if e["pulos"] >= 1000:
            self.desbloquear("saltador")
        if e["mortes"] >= 25:
            self.desbloquear("sobrevivente")

    def proxima_notificacao(self):
        if self.novas_conquistas:
            return self.novas_conquistas.pop(0)
        return None
