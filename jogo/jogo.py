"""
Cena principal de gameplay: junta nivel, jogador, inimigos, chefes, itens,
puzzles, quiz, dialogos, HUD e efeitos.
"""

import math
import random

import pygame

import config as cfg
import textos
import niveis
from mundo import Nivel, Fundo
from jogador import Jogador
from inimigos import criar_inimigo
from chefes import TIPOS_CHEFES
from itens import (Byte, Componente, Bateria, Checkpoint, Saida, Terminal, TerminalQuiz, Portao,
                   Mola, BlocoQuebravel, PlataformaMovel, NPC, Placa)
from particulas import SistemaParticulas
from puzzle import PuzzleCircuito, QuizArduino
from hud import HUD, SerialMonitor, CaixaDialogo
from util import Camera, texto, painel, formatar_tempo, render_texto, quebrar_texto

T = cfg.TILE


class CenaJogo:
    def __init__(self, app, indice_nivel):
        self.app = app
        self.audio = app.audio
        self.sprites = app.sprites
        self.save = app.save
        self.indice = indice_nivel
        self.dados = niveis.dados_nivel(indice_nivel)
        self.nivel = Nivel(self.dados, self.sprites)
        self.fundo = Fundo(self.nivel.tema)
        self.camera = Camera(self.nivel.largura, self.nivel.altura)
        self.camera.tremor_ativo = self.save.opcoes.get("tremor_tela", True)
        self.particulas = SistemaParticulas()
        self.hud = HUD(self.sprites)
        self.serial = SerialMonitor()
        self.serial.visivel = self.save.opcoes.get("serial_monitor", True)
        self.tempo = 0
        self.tempo_nivel = 0
        self.bytes_nivel = 0
        self.componentes_coletados = set()
        self.componentes_antigos = set(self.save.componentes_nivel(self.dados["id"]))
        self.estatisticas = {"mortes": 0, "danos": 0, "inimigos": 0, "pulos": 0, "tiros": 0,
                             "puzzles": 0, "quiz_acertos": 0, "blocos": 0}
        self.efeito_hit = 0
        self.efeito_glitch = 0
        self.overlay = None          # puzzle / quiz / dialogo
        self.pausado = False
        self.selecao_pausa = 0
        self.game_over = False
        self.t_morte = 0
        self.selecao_gameover = 0
        self.msg_morte = random.choice(textos.MENSAGENS_MORTE)
        self.concluindo = 0          # animacao de upload
        self.consolidado = False
        self.arena = None
        self.barreira = None
        self.chefe = None
        self.chefe_derrotado = False
        self.inimigos_novos = []

        # listas de entidades
        self.inimigos = []
        self.projeteis = []
        self.itens = []
        self.perigos = []
        self.checkpoints = []
        self.terminais = []
        self.quizzes = []
        self.portoes = []
        self.molas = []
        self.quebraveis = []
        self.plataformas = []
        self.npcs = []
        self.placas = []
        self.saida = None
        self.checkpoint_atual = None

        self._spawnar()
        self.camera.seguir(self.jogador.rect, 1, instantaneo=True)
        tema = cfg.TEMAS_MUNDO[self.nivel.tema]
        self.audio.tocar_musica(tema["musica"])
        self.hud.banner(self.dados["nome"], "%s  |  Nivel %s" % (tema["nome"], self.dados["id"]),
                        cfg.BRANCO, 170)
        self.log("Sketch carregado: nivel_%s.ino" % self.dados["id"].replace("-", "_"))
        self.log("Bitinho online. Tensao: 5.00V")

    # ------------------------------------------------------------------
    # Criacao das entidades a partir do mapa
    # ------------------------------------------------------------------
    def _spawnar(self):
        npcs = list(self.dados.get("npcs", []))
        placas = list(self.dados.get("placas", []))
        quizzes = list(self.dados.get("quiz", []))
        indice_componente = 0
        inicio = (64, 64)
        for c, x, y in self.nivel.objetos:
            grupo = x // (niveis.LARGURA_BLOCO * T)
            if c == "P":
                inicio = (x + (T - Jogador.LARGURA) / 2, y + T - Jogador.ALTURA)
            elif c == "b":
                self.itens.append(Byte(x, y, self.sprites))
            elif c == "$":
                self.itens.append(Byte(x, y, self.sprites, grande=True))
            elif c == "?":
                if indice_componente < 3:
                    ja = indice_componente in self.componentes_antigos
                    self.itens.append(Componente(x, y, indice_componente, self.sprites, ja))
                    indice_componente += 1
                else:
                    self.itens.append(Byte(x, y, self.sprites, grande=True))
            elif c == "H":
                self.itens.append(Bateria(x, y, self.sprites))
            elif c == "C":
                self.checkpoints.append(Checkpoint(x, y, self.sprites))
            elif c == "E":
                self.saida = Saida(x, y, self.sprites)
            elif c == "K":
                self.terminais.append(Terminal(x, y, self.sprites, grupo))
            elif c == "G":
                self.portoes.append(Portao(x, y, 3, grupo))
            elif c == "Q":
                idx = quizzes.pop(0) if quizzes else random.randrange(len(textos.QUIZ))
                q = TerminalQuiz(x, y, self.sprites, idx)
                q.respondido = idx in self.save.dados["quiz_respondidos"]
                self.quizzes.append(q)
            elif c == "T":
                self.molas.append(Mola(x, y, self.sprites))
            elif c == "X":
                self.quebraveis.append(BlocoQuebravel(x, y, self.sprites))
            elif c == "M":
                self.plataformas.append(PlataformaMovel(x, y, self.sprites, False, 10, 1.3))
            elif c == "m":
                self.plataformas.append(PlataformaMovel(x, y, self.sprites, True, 8, 1.1))
            elif c == "N":
                did = npcs.pop(0) if npcs else "tutorial_1"
                self.npcs.append(NPC(x, y, self.sprites, did))
            elif c == "i":
                self.placas.append(Placa(x, y, placas.pop(0) if placas else "..."))
            elif c == "Z":
                self._criar_chefe(x, y)
            else:
                inimigo = criar_inimigo(c, x, y, self.sprites)
                if inimigo:
                    self.inimigos.append(inimigo)
        self.inicio = inicio
        self.ponto_respawn = inicio
        upgrades = dict(self.save.dados["upgrades"])
        self.jogador = Jogador(inicio[0], inicio[1], upgrades, self.sprites)
        if self.saida and self.dados.get("chefe"):
            self.saida.aberta = False

    def _criar_chefe(self, x, y):
        arena = self.dados.get("arena")
        tipo = self.dados.get("chefe")
        if not arena or tipo not in TIPOS_CHEFES:
            return
        self.arena = pygame.Rect(arena[0] * T, T, (arena[1] - arena[0]) * T, 13 * T)
        self.pos_chefe = (x + T / 2, y + T / 2)
        cls = TIPOS_CHEFES[tipo]
        self.chefe = cls(self.pos_chefe[0], self.pos_chefe[1], self.sprites, self.arena)
        if tipo == "bootloader":
            self.chefe.x = self.arena.centerx
            self.chefe.alvo_x = self.arena.centerx

    # ------------------------------------------------------------------
    # API usada pelas entidades
    # ------------------------------------------------------------------
    def log(self, msg):
        self.serial.log(msg)

    def solidos_extras(self):
        r = [p.rect for p in self.portoes if p.bloqueando]
        r += [b.rect for b in self.quebraveis if b.vivo]
        if self.barreira is not None:
            r.append(self.barreira)
        return r

    def ao_projetil_bater_parede(self, projetil):
        pass

    def ao_morrer(self):
        self.estatisticas["mortes"] += 1
        self.t_morte = 0
        self.audio.tocar("game_over")
        self.audio.tocar_musica(None)
        self.log("ERRO: " + self.msg_morte)
        self.particulas.explosao(*self.jogador.centro, 1.2)
        self.particulas.bits(*self.jogador.centro, 20)

    def ao_derrotar_chefe(self, chefe):
        self.chefe_derrotado = True
        self.barreira = None
        if self.saida:
            self.saida.aberta = True
        self.bytes_nivel += cfg.BYTES_POR_CHEFE
        self.hud.banner("CHEFE DERROTADO!", chefe.nome + " foi desligado", cfg.VERDE_LED, 220)
        self.log("%s derrotado! +%d bytes" % (chefe.nome, cfg.BYTES_POR_CHEFE))
        self.log("Porta USB liberada para upload.")
        self.audio.tocar("vitoria")
        self.audio.tocar_musica(cfg.TEMAS_MUNDO[self.nivel.tema]["musica"])
        self.save.estat["chefes"] = self.save.estat.get("chefes", 0) + 1
        for i in self.inimigos:
            if self.arena.colliderect(i.rect):
                i.morrer(self)

    # ------------------------------------------------------------------
    # Loop principal
    # ------------------------------------------------------------------
    def atualizar(self, eventos):
        ctrl = self.app.ctrl
        self.tempo += 1
        self.serial.atualizar()
        if ctrl.apertou("serial"):
            self.serial.alternar()
            self.save.opcoes["serial_monitor"] = self.serial.visivel
        nova = self.save.proxima_notificacao()
        if nova:
            self.hud.conquista(nova)
            self.audio.tocar("conquista")

        if self.overlay is not None:
            if isinstance(self.overlay, CaixaDialogo):
                self.overlay.processar(ctrl)
                if not self.overlay.ativo:
                    self.overlay = None
            else:
                self.overlay.processar(ctrl, eventos)
            self.hud.atualizar(self)
            return

        if self.pausado:
            self._atualizar_pausa(ctrl)
            return

        if self.game_over:
            self._atualizar_game_over(ctrl)
            return

        if ctrl.apertou("pausa") and not self.concluindo:
            self.pausado = True
            self.selecao_pausa = 0
            self.audio.tocar("menu")
            return

        if not self.jogador.morto and not self.concluindo:
            self.tempo_nivel += 1

        self._atualizar_mundo(ctrl)

        if self.jogador.morto:
            self.t_morte += 1
            if self.t_morte > 80:
                self.game_over = True
                self.selecao_gameover = 0

        if self.concluindo:
            self.concluindo += 1
            if self.concluindo > 150:
                self._finalizar_nivel()

    def _atualizar_mundo(self, ctrl):
        j = self.jogador
        for p in self.plataformas:
            p.atualizar(self)
        solidos = self.solidos_extras()
        j.atualizar(ctrl, self.nivel, solidos, self.plataformas, self)

        # --- camera ---
        if self.chefe is not None and self.chefe.ativo and self.chefe.vivo:
            alvo_x = self.arena.left - 16
            self.camera.x += (alvo_x - self.camera.x) * 0.08
            self.camera.y += (0 - self.camera.y) * 0.08
            self.camera.limitar()
        else:
            r = j.rect.copy()
            if j.olhando_baixo > 30:
                r.y += min(120, (j.olhando_baixo - 30) * 4)
            self.camera.seguir(r, j.direcao)
        self.camera.atualizar()

        # --- inimigos ---
        margem = 260
        for i in self.inimigos:
            if not i.ativo:
                r = i.rect
                if self.camera.x - margem < r.centerx < self.camera.x + cfg.LARGURA + margem:
                    i.ativo = True
            if i.ativo and i.vivo:
                i.atualizar(self)
        if self.inimigos_novos:
            self.inimigos.extend(self.inimigos_novos)
            self.inimigos_novos = []
        self.inimigos = [i for i in self.inimigos if i.vivo]

        # --- chefe ---
        if self.chefe is not None and self.chefe.vivo:
            if not self.chefe.ativo and not j.morto:
                if j.rect.left > self.arena.left + 40:
                    self._iniciar_chefe()
            if self.chefe.ativo:
                self.chefe.atualizar(self)

        # --- objetos ---
        for lista in (self.projeteis, self.itens, self.perigos):
            for o in lista:
                o.atualizar(self)
        for o in self.checkpoints + self.portoes + self.molas + self.quebraveis:
            o.atualizar(self)
        self.projeteis = [p for p in self.projeteis if p.vivo]
        self.perigos = [p for p in self.perigos if p.vivo]
        self.quebraveis = [b for b in self.quebraveis if b.vivo]
        self.particulas.atualizar()
        self.hud.atualizar(self)
        if self.efeito_hit > 0:
            self.efeito_hit -= 1
        if self.efeito_glitch > 0:
            self.efeito_glitch -= 1

        if not j.morto and not self.concluindo:
            self._colisoes(ctrl)

    def _iniciar_chefe(self):
        ch = self.chefe
        ch.ativo = True
        ch.mudar_estado("intro")
        self.barreira = pygame.Rect(self.arena.left - T, 0, T, self.nivel.altura)
        self.audio.tocar_musica("chefe")
        self.audio.tocar("chefe_rugido")
        self.camera.tremer(8, 40)
        self.hud.banner(ch.nome, ch.subtitulo, cfg.VERMELHO, 200)
        self.log("ALERTA: %s detectado!" % ch.nome)

    def _resetar_chefe(self):
        if self.chefe is None or self.chefe_derrotado:
            return
        cls = type(self.chefe)
        self.chefe = cls(self.pos_chefe[0], self.pos_chefe[1], self.sprites, self.arena)
        if isinstance(self.chefe, TIPOS_CHEFES["bootloader"]):
            self.chefe.x = self.arena.centerx
            self.chefe.alvo_x = self.arena.centerx
        self.barreira = None
        self.perigos.clear()
        self.projeteis.clear()
        self.inimigos = [i for i in self.inimigos if not self.arena.colliderect(i.rect)]
        self.audio.tocar_musica(cfg.TEMAS_MUNDO[self.nivel.tema]["musica"])

    # ------------------------------------------------------------------
    # Colisoes
    # ------------------------------------------------------------------
    def _colisoes(self, ctrl):
        j = self.jogador
        jr = j.rect
        hit = jr.inflate(-4, -4)

        # queda no abismo
        if j.corpo.y > self.nivel.altura + 40:
            self._dano_ambiente("Bitinho caiu no vazio!")
            return
        if self.nivel.tocando_lava(hit):
            self.particulas.gotas_solda(jr.centerx, jr.bottom, 12)
            self.audio.tocar("solda")
            self._dano_ambiente("Queimou na solda derretida!")
            return
        if self.nivel.tocando_espinho(hit):
            j.receber_dano(1, jr.centerx + random.choice((-1, 1)), self)
            if not j.morto and j.invencivel == cfg.INVENCIVEL_FRAMES:
                j.corpo.vy = -8

        # inimigos
        for i in self.inimigos:
            if not i.vivo or not i.ativo:
                continue
            ir = i.rect
            if not jr.colliderect(ir):
                continue
            pisou = (j.corpo.vy > 0.5 and jr.bottom - ir.top < 16 and jr.centery < ir.centery)
            if pisou and i.pode_ser_pisado():
                i.receber_dano(2, self)
                j.quicar(-9.5 if ctrl.segurando("pular") else -7)
                self.audio.tocar("pisar")
                self.particulas.poeira(jr.centerx, jr.bottom, 6)
            elif j.dash_timer > 0:
                i.receber_dano(2, self, j.corpo.x)
            else:
                j.receber_dano(i.dano_contato, ir.centerx, self)

        # chefe
        ch = self.chefe
        if ch is not None and ch.vivo and ch.ativo and not ch.morrendo and ch.estado != "intro":
            for r in ch.retangulos_dano():
                if hit.colliderect(r):
                    j.receber_dano(ch.dano_contato, r.centerx, self)
                    break

        # perigos
        for p in self.perigos:
            if p.colide(hit):
                j.receber_dano(p.dano, jr.centerx - j.direcao, self)

        # projeteis
        for p in self.projeteis:
            if not p.vivo:
                continue
            pr = p.rect
            if p.dono == "jogador":
                for i in self.inimigos:
                    if i.vivo and i.ativo and pr.colliderect(i.rect):
                        i.receber_dano(p.dano, self, p.x)
                        p.vivo = False
                        self.particulas.faiscas(p.x, p.y, 6, cfg.BRANCO, 2.5, 12)
                        break
                if p.vivo and ch is not None and ch.vivo and ch.ativo:
                    if pr.colliderect(ch.rect):
                        ch.receber_dano(p.dano, self, p.x)
                        p.vivo = False
                if p.vivo:
                    for b in self.quebraveis:
                        if pr.colliderect(b.rect):
                            b.danificar(self)
                            p.vivo = False
                            break
                if p.vivo:
                    for g in self.portoes:
                        if g.bloqueando and pr.colliderect(g.rect):
                            p.vivo = False
                            self.particulas.faiscas(p.x, p.y, 4, cfg.VERMELHO, 2, 10)
                            break
            else:
                if pr.colliderect(hit):
                    if j.receber_dano(p.dano, p.x, self) or j.invencivel > 0:
                        if not p.atravessa:
                            p.vivo = False

        # dash quebra blocos
        if j.dash_timer > 0:
            teste = jr.inflate(8, 0)
            for b in self.quebraveis:
                if teste.colliderect(b.rect):
                    b.danificar(self, 2)

        # itens
        for it in self.itens:
            if not it.vivo:
                continue
            if isinstance(it, Byte) and it.atraso_coleta > 0:
                continue
            if jr.colliderect(it.rect):
                self._coletar(it)
        self.itens = [i for i in self.itens if i.vivo]

        # molas
        for m in self.molas:
            if j.corpo.vy >= 0 and jr.colliderect(m.rect) and jr.bottom <= m.rect.bottom + 2:
                m.comprimida = 12
                j.impulso_mola(self)
                self.particulas.poeira(m.rect.centerx, m.rect.top, 6)

        # checkpoints
        for c in self.checkpoints:
            if not c.ativo and jr.colliderect(c.rect):
                for outro in self.checkpoints:
                    outro.ativo = False
                c.ativo = True
                c.pulso = 30
                self.checkpoint_atual = c
                self.ponto_respawn = c.ponto_respawn
                self.audio.tocar("checkpoint")
                self.particulas.brilhos(c.x, c.y - 48, 14, cfg.VERDE_LED)
                self.hud.banner("CHECKPOINT", "Progresso salvo na EEPROM", cfg.VERDE_LED, 100)
                self.log("Checkpoint gravado na EEPROM.")
                j.curar(1)

        # interacoes
        interagiu = ctrl.apertou("interagir")
        for lista in (self.terminais, self.quizzes, self.npcs, self.placas):
            for o in lista:
                o.perto = jr.colliderect(o.rect.inflate(20, 10))
                if o.perto and interagiu and not isinstance(o, Placa):
                    self._interagir(o)
                    interagiu = False

        # saida
        if self.saida and self.saida.aberta and jr.colliderect(self.saida.rect.inflate(-16, 0)):
            self._iniciar_conclusao()

    def _dano_ambiente(self, msg):
        j = self.jogador
        self.log(msg)
        j.receber_dano(1, j.corpo.x, self, ignorar_invencivel=True)
        if not j.morto:
            j.reposicionar(*self.ponto_respawn)
            self.camera.seguir(j.rect, j.direcao, instantaneo=True)

    def _coletar(self, it):
        j = self.jogador
        if isinstance(it, Byte):
            it.vivo = False
            self.bytes_nivel += it.valor
            self.audio.tocar("byte_grande" if it.grande else "byte", 0.6)
            self.particulas.brilhos(it.x, it.y, 4 if not it.grande else 10,
                                    cfg.OURO if not it.grande else cfg.CIANO)
            if it.grande:
                self.particulas.texto_flutuante(it.x, it.y - 10, "+%d" % it.valor, cfg.CIANO)
        elif isinstance(it, Componente):
            it.vivo = False
            self.componentes_coletados.add(it.indice)
            self.audio.tocar("componente")
            self.particulas.brilhos(it.x, it.y, 24, cfg.OURO)
            self.particulas.anel(it.x, it.y, cfg.OURO, 60)
            nome = Componente.NOMES[it.indice % 3]
            self.hud.banner("COMPONENTE ENCONTRADO!", nome, cfg.OURO, 140)
            self.log("Componente secreto: %s (%d/3)" % (nome, len(self.componentes_coletados)))
            self.camera.tremer(3, 10)
        elif isinstance(it, Bateria):
            if j.curar(1):
                it.vivo = False
                self.audio.tocar("powerup")
                self.particulas.brilhos(it.x, it.y, 12, cfg.VERDE_LED)
                self.particulas.texto_flutuante(it.x, it.y - 10, "+1 ENERGIA", cfg.VERDE_LED)
                self.log("Bateria recarregada. Energia: %d/%d" % (j.hp, j.hp_max))

    def _interagir(self, o):
        if isinstance(o, Terminal) and not o.resolvido:
            larg, alt, leds = self.dados.get("puzzle", (5, 4, 1))
            semente = hash((self.dados["id"], o.grupo, self.estatisticas["puzzles"])) & 0xffffff
            self.terminal_ativo = o
            self.audio.tocar("confirmar")
            self.log("Abrindo editor de circuito...")
            self.overlay = PuzzleCircuito(larg, alt, leds, semente, self.audio, self._fim_puzzle)
        elif isinstance(o, TerminalQuiz) and not o.respondido:
            self.quiz_ativo = o
            self.audio.tocar("confirmar")
            self.overlay = QuizArduino(textos.QUIZ[o.indice % len(textos.QUIZ)], self.audio, self._fim_quiz)
        elif isinstance(o, NPC):
            falas = textos.DIALOGOS.get(o.dialogo_id, [("Prof. Volt", "...")])
            o.falou = True
            self.audio.tocar("confirmar", 0.6)
            self.overlay = CaixaDialogo(falas, self.audio, self.sprites)

    def _fim_puzzle(self, resolvido, puzzle):
        self.overlay = None
        t = self.terminal_ativo
        if resolvido:
            t.resolvido = True
            self.estatisticas["puzzles"] += 1
            self.save.estat["puzzles"] += 1
            if not puzzle.queimou_alguma:
                self.save.desbloquear("sem_fumaca")
            self.save.verificar_conquistas()
            abriu = False
            for g in self.portoes:
                if g.grupo == t.grupo and not g.aberto:
                    g.aberto = True
                    abriu = True
            if abriu:
                self.audio.tocar("porta")
                self.camera.tremer(4, 20)
            self.log("Circuito OK! Rele acionado, portao aberto.")
            bonus = max(5, 30 - puzzle.movimentos // 2 - puzzle.dicas_usadas * 5)
            self.bytes_nivel += bonus
            self.particulas.texto_flutuante(t.x, t.y - 60, "+%d bytes" % bonus, cfg.OURO)
        else:
            self.log("Editor de circuito fechado.")

    def _fim_quiz(self, acertou, quiz):
        self.overlay = None
        q = self.quiz_ativo
        if acertou is None:
            return
        if acertou:
            q.respondido = True
            self.bytes_nivel += cfg.BYTES_POR_QUIZ
            self.estatisticas["quiz_acertos"] += 1
            self.save.estat["quiz_acertos"] += 1
            if q.indice not in self.save.dados["quiz_respondidos"]:
                self.save.dados["quiz_respondidos"].append(q.indice)
            self.save.verificar_conquistas()
            self.particulas.texto_flutuante(q.x, q.y - 60, "+%d bytes" % cfg.BYTES_POR_QUIZ, cfg.OURO)
            self.log("Quiz: resposta correta! +%d bytes" % cfg.BYTES_POR_QUIZ)
        else:
            self.log("Quiz: resposta incorreta. Tente de novo!")

    # ------------------------------------------------------------------
    # Conclusao / morte / pausa
    # ------------------------------------------------------------------
    def _iniciar_conclusao(self):
        if self.concluindo:
            return
        self.concluindo = 1
        self.jogador.vitoria = True
        self.jogador.congelado = True
        self.jogador.corpo.vx = 0
        self.audio.tocar("upload")
        self.audio.tocar_musica(None)
        self.log("Iniciando upload via USB...")

    def _consolidar(self):
        if self.consolidado:
            return
        self.consolidado = True
        e = self.save.estat
        e["inimigos"] += self.estatisticas["inimigos"]
        e["mortes"] += self.estatisticas["mortes"]
        e["pulos"] += self.estatisticas["pulos"]
        e["tiros"] += self.estatisticas["tiros"]
        e["tempo_total"] += self.tempo_nivel
        self.save.verificar_conquistas()
        self.save.salvar()

    def calcular_rank(self):
        alvo = self.dados.get("tempo_rank", cfg.TEMPO_RANK_PADRAO) * cfg.FPS
        m = self.estatisticas["mortes"]
        d = self.estatisticas["danos"]
        if self.tempo_nivel <= alvo and m == 0 and d == 0:
            return "S"
        if self.tempo_nivel <= alvo * 1.4 and m == 0:
            return "A"
        if m <= 2:
            return "B"
        return "C"

    def _finalizar_nivel(self):
        from telas import TelaResultado
        rank = self.calcular_rank()
        resultado = {
            "indice": self.indice,
            "id": self.dados["id"],
            "nome": self.dados["nome"],
            "tempo": self.tempo_nivel,
            "bytes": self.bytes_nivel,
            "componentes": sorted(self.componentes_coletados | self.componentes_antigos),
            "novos_componentes": sorted(self.componentes_coletados - self.componentes_antigos),
            "total_componentes": niveis.total_componentes(self.indice),
            "mortes": self.estatisticas["mortes"],
            "danos": self.estatisticas["danos"],
            "inimigos": self.estatisticas["inimigos"],
            "rank": rank,
            "melhor_anterior": self.save.dados["melhores_tempos"].get(self.dados["id"]),
            "chefe": bool(self.dados.get("chefe")),
        }
        self._consolidar()
        if self.estatisticas["danos"] == 0:
            self.save.desbloquear("intocavel")
        total_jogo = sum(niveis.total_componentes(i) for i in range(len(niveis.NIVEIS)))
        self.save.registrar_conclusao(self.indice, self.dados["id"], self.tempo_nivel, self.bytes_nivel,
                                      resultado["componentes"], rank, len(niveis.NIVEIS))
        self.save.verificar_conquistas(total_jogo)
        self.app.trocar_cena(TelaResultado(self.app, resultado))

    def _respawn(self):
        j = self.jogador
        self.game_over = False
        self.t_morte = 0
        j.morto = False
        j.hp = j.hp_max
        j.escudo = j.tem("escudo")
        j.reposicionar(*self.ponto_respawn)
        self._resetar_chefe()
        self.perigos.clear()
        self.projeteis = [p for p in self.projeteis if p.dono == "jogador"]
        self.camera.seguir(j.rect, j.direcao, instantaneo=True)
        self.audio.tocar_musica(cfg.TEMAS_MUNDO[self.nivel.tema]["musica"])
        self.msg_morte = random.choice(textos.MENSAGENS_MORTE)
        self.log("Reset! Reiniciando do ultimo checkpoint.")

    def _sair(self, destino="mapa"):
        from telas import TelaMapa, TelaTitulo
        self._consolidar()
        if destino == "mapa":
            self.app.trocar_cena(TelaMapa(self.app, self.indice))
        else:
            self.app.trocar_cena(TelaTitulo(self.app))

    OPCOES_PAUSA = ["Continuar", "Reiniciar nivel", "Serial Monitor", "Voltar ao mapa", "Menu principal"]

    def _atualizar_pausa(self, ctrl):
        n = len(self.OPCOES_PAUSA)
        if ctrl.apertou("cima"):
            self.selecao_pausa = (self.selecao_pausa - 1) % n
            self.audio.tocar("menu")
        if ctrl.apertou("baixo"):
            self.selecao_pausa = (self.selecao_pausa + 1) % n
            self.audio.tocar("menu")
        if ctrl.apertou("pausa"):
            self.pausado = False
            return
        if ctrl.apertou("confirmar"):
            op = self.OPCOES_PAUSA[self.selecao_pausa]
            self.audio.tocar("confirmar")
            if op == "Continuar":
                self.pausado = False
            elif op == "Reiniciar nivel":
                self._consolidar()
                self.app.trocar_cena(CenaJogo(self.app, self.indice))
            elif op == "Serial Monitor":
                self.serial.alternar()
                self.save.opcoes["serial_monitor"] = self.serial.visivel
            elif op == "Voltar ao mapa":
                self._sair("mapa")
            else:
                self._sair("titulo")

    def _atualizar_game_over(self, ctrl):
        self.particulas.atualizar()
        if ctrl.apertou("cima") or ctrl.apertou("baixo"):
            self.selecao_gameover = 1 - self.selecao_gameover
            self.audio.tocar("menu")
        if ctrl.apertou("confirmar"):
            self.audio.tocar("confirmar")
            if self.selecao_gameover == 0:
                self._respawn()
            else:
                self._sair("mapa")

    # ------------------------------------------------------------------
    # Desenho
    # ------------------------------------------------------------------
    def desenhar(self, surf):
        cam = self.camera
        self.fundo.desenhar(surf, cam, self.tempo)
        self.nivel.desenhar(surf, cam, self.tempo)
        for lista in (self.placas, self.checkpoints, self.terminais, self.quizzes, self.npcs):
            for o in lista:
                o.desenhar(surf, cam, self.tempo)
        if self.saida:
            self.saida.desenhar(surf, cam, self.tempo)
        for o in self.portoes + self.molas + self.quebraveis + self.plataformas:
            o.desenhar(surf, cam, self.tempo)
        for it in self.itens:
            if cam.visivel(it.rect):
                it.desenhar(surf, cam, self.tempo)
        for p in self.perigos:
            p.desenhar(surf, cam, self.tempo)
        for i in self.inimigos:
            if cam.visivel(i.rect):
                i.desenhar(surf, cam, self.tempo)
        if self.chefe is not None and self.chefe.vivo:
            self.chefe.desenhar(surf, cam, self.tempo)
        if not (self.jogador.morto and self.t_morte > 2):
            self.jogador.desenhar(surf, cam, self.tempo)
        for p in self.projeteis:
            p.desenhar(surf, cam, self.tempo)
        self.nivel.brilho_lava(surf, cam, self.tempo)
        self.particulas.desenhar(surf, cam)
        if self.barreira is not None:
            self._desenhar_barreira(surf, cam)

        # efeitos de tela
        if self.efeito_hit > 0:
            s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
            s.fill((255, 40, 40, 18 * self.efeito_hit))
            surf.blit(s, (0, 0))
        if self.efeito_glitch > 0:
            self._efeito_glitch(surf)

        self.hud.desenhar(surf, self, self.tempo)
        self.serial.desenhar(surf, self.tempo)

        if self.concluindo:
            self._desenhar_upload(surf)
        if self.overlay is not None:
            self.overlay.desenhar(surf)
        if self.pausado:
            self._desenhar_pausa(surf)
        if self.game_over:
            self._desenhar_game_over(surf)

    def _desenhar_barreira(self, surf, cam):
        r = cam.aplicar(self.barreira)
        x = r.right - 4
        for k in range(3):
            pontos = []
            for yy in range(0, cfg.ALTURA + 20, 20):
                pontos.append((x + random.randint(-5, 5), yy))
            pygame.draw.lines(surf, cfg.CIANO if k else cfg.BRANCO, False, pontos, 2)

    def _efeito_glitch(self, surf):
        copia = surf.copy()
        for _ in range(6):
            y = random.randint(0, cfg.ALTURA - 20)
            h = random.randint(4, 22)
            dx = random.randint(-30, 30)
            surf.blit(copia, (dx, y), (0, y, cfg.LARGURA, h))
        tinta = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        tinta.fill((255, 0, 120, 20))
        surf.blit(tinta, (0, 0))

    def _desenhar_upload(self, surf):
        t = self.concluindo
        k = min(1.0, t / 20)
        s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        s.fill((0, 0, 0, int(150 * k)))
        surf.blit(s, (0, 0))
        w = 460
        r = pygame.Rect(cfg.LARGURA // 2 - w // 2, cfg.ALTURA // 2 - 60, w, 120)
        painel(surf, r, (8, 20, 24), cfg.AZUL_ARDUINO_CLARO, int(240 * k))
        prog = min(1.0, max(0.0, (t - 20) / 110))
        msg = "Compilando..." if prog < 0.2 else ("Enviando..." if prog < 1 else "Upload concluido!")
        texto(surf, msg, (r.centerx, r.y + 26), 22, cfg.BRANCO, centro=True, negrito=True)
        barra = pygame.Rect(r.x + 30, r.y + 58, w - 60, 18)
        pygame.draw.rect(surf, (20, 40, 44), barra, border_radius=4)
        pygame.draw.rect(surf, cfg.VERDE_LED if prog >= 1 else cfg.AZUL_ARDUINO_CLARO,
                         (barra.x, barra.y, int(barra.w * prog), barra.h), border_radius=4)
        texto(surf, "%d%%" % int(prog * 100), (r.centerx, r.y + 94), 16, cfg.CINZA_CLARO, centro=True, mono=True)

    def _desenhar_pausa(self, surf):
        s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        s.fill((0, 0, 0, 160))
        surf.blit(s, (0, 0))
        r = pygame.Rect(cfg.LARGURA // 2 - 190, 90, 380, 360)
        painel(surf, r, (12, 18, 26), cfg.AZUL_ARDUINO_CLARO, 245)
        texto(surf, "PAUSADO", (r.centerx, r.y + 34), 34, cfg.BRANCO, centro=True, negrito=True)
        texto(surf, "while (pausado) { respirar(); }", (r.centerx, r.y + 66), 13, cfg.VERDE_LED, centro=True,
              mono=True)
        for i, op in enumerate(self.OPCOES_PAUSA):
            y = r.y + 110 + i * 44
            sel = i == self.selecao_pausa
            if op == "Serial Monitor":
                op = "Serial Monitor: %s" % ("ON" if self.serial.visivel else "OFF")
            if sel:
                pygame.draw.rect(surf, (30, 70, 80), (r.x + 30, y - 16, r.w - 60, 34), border_radius=6)
                texto(surf, ">", (r.x + 44, y), 20, cfg.AMARELO, centro=True)
            texto(surf, op, (r.centerx, y), 20, cfg.AMARELO if sel else cfg.BRANCO, centro=True)
        dica = random.Random(self.indice).choice(textos.DICAS)
        linhas = quebrar_texto("Dica: " + dica, 14, cfg.LARGURA - 200)
        for i, l in enumerate(linhas):
            texto(surf, l, (cfg.LARGURA // 2, 470 + i * 18), 14, cfg.CINZA_CLARO, centro=True)

    def _desenhar_game_over(self, surf):
        s = pygame.Surface((cfg.LARGURA, cfg.ALTURA), pygame.SRCALPHA)
        s.fill((30, 0, 0, 190))
        surf.blit(s, (0, 0))
        texto(surf, "RESET", (cfg.LARGURA // 2, 140), 64, cfg.VERMELHO, centro=True, negrito=True)
        texto(surf, self.msg_morte, (cfg.LARGURA // 2, 200), 18, cfg.BRANCO, centro=True, mono=True)
        opcoes = ["Tentar de novo (checkpoint)", "Voltar ao mapa"]
        for i, op in enumerate(opcoes):
            y = 280 + i * 50
            sel = i == self.selecao_gameover
            if sel:
                pygame.draw.rect(surf, (90, 20, 30), (cfg.LARGURA // 2 - 200, y - 18, 400, 38), border_radius=6)
            texto(surf, op, (cfg.LARGURA // 2, y), 22, cfg.AMARELO if sel else cfg.BRANCO, centro=True)
        dica = textos.DICAS[(self.estatisticas["mortes"] * 7) % len(textos.DICAS)]
        texto(surf, "Dica: " + dica, (cfg.LARGURA // 2, 440), 15, cfg.CINZA_CLARO, centro=True)
