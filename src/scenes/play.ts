/**
 * Cena principal de jogo: o Vale dos Gigantes, a casa do jogador e a cabana de
 * melhorias.
 *
 * Aqui moram as ligações entre os sistemas: colheita com ferramentas, dinheiro,
 * melhorias, baú, cama, ciclo de dia e noite e o modo de teste.
 */

import type { Cena, Jogo } from '../core/game';
import { LARGURA, ALTURA } from '../core/screen';
import { Camera } from '../core/camera';
import { Rng } from '../core/rng';
import { Particulas } from '../systems/particles';
import { TempoDoDia } from '../systems/daynight';
import { Jogador } from '../entities/player';
import { Dino } from '../entities/dino';
import { Orbe } from '../entities/projectile';
import type { Npc } from '../entities/npc';
import type { Mundo } from '../entities/context';
import { Nivel, type Interativo, type ObjetoCenario } from '../world/level';
import {
  gerarMundo,
  criarInterior,
  criarInteriorCabana,
  ID_CASA,
  ID_CABANA,
  ID_MUNDO,
  CASA_X,
  CASA_Y,
  CABANA_X,
  CABANA_Y,
} from '../world/worldgen';
import { criarNpcsDaCabana } from '../world/npcs';
import { desenharTerreno, objetosVisiveis, desenharObjeto } from '../world/renderer';
import { HUD } from '../ui/hud';
import { Inventario, Recipiente, criarItem } from '../systems/items';
import { Carteira, formatarMoedas } from '../systems/economy';
import { Progresso } from '../systems/progression';
import { FERRAMENTAS, nivelFerramenta } from '../systems/tools';
import { RECURSOS, TODOS_RECURSOS } from '../systems/resources';
import type { NoRecurso } from '../systems/harvest';
import { PainelVenda } from '../ui/venda';
import { PainelMelhorias } from '../ui/melhorias';
import { PainelBau } from '../ui/bau';
import { PainelTestes, type AcaoTeste } from '../ui/testes';
import { Botao, ListaBotoes, textoGrande } from '../ui/widgets';
import { desenharPainel } from '../gfx/sprites/ui';
import { texto, paragrafo, quebrarTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import { clamp, dist, rectsOverlap, TAU } from '../core/math';
import { TODAS_FICHAS, NOME_CATEGORIA } from '../entities/dinoTypes';
import { CASA_H, CASA_PORTA } from '../gfx/sprites/house';
import { CABANA_H, CABANA_PORTA } from '../gfx/sprites/cabin';
import { Tile } from '../world/tiles';
import { TAM_TILE } from '../gfx/sprites/terrain';
import type { FerramentaId } from '../gfx/sprites/tools';
import type { Sprite } from '../gfx/pixel';

type ItemDesenho =
  | { base: number; tipo: 'objeto'; o: ObjetoCenario }
  | { base: number; tipo: 'jogador' }
  | { base: number; tipo: 'dino'; d: Dino }
  | { base: number; tipo: 'npc'; n: Npc };

export interface OpcoesJogo {
  /** Chegada dramática (vindo da cinemática). */
  chegada?: boolean;
  /** Modo de teste: tudo liberado, dinheiro e recursos infinitos. */
  demo?: boolean;
}

export class CenaJogo implements Cena {
  private niveis = new Map<string, Nivel>();
  private dinosPorNivel = new Map<string, Dino[]>();
  private npcsPorNivel = new Map<string, Npc[]>();
  private nivel!: Nivel;
  private jogador: Jogador;
  private projeteis: Orbe[] = [];
  private particulas = new Particulas();
  private camera = new Camera();
  private hud = new HUD();
  private tempoDoDia = new TempoDoDia();
  private mundo: Mundo;
  private tempoJogo = 0;
  private rng = new Rng(20260904);

  // ---- economia e progresso
  private inventario: Inventario;
  private bau: Recipiente;
  private carteira = new Carteira(0);
  private progresso = new Progresso();

  // ---- janelas
  private painelVenda: PainelVenda;
  private painelMelhorias: PainelMelhorias;
  private painelBau: PainelBau;
  private painelTestes: PainelTestes;

  private pausado = false;
  private bestiario = false;
  private menuPausa!: ListaBotoes;
  private menuMorte!: ListaBotoes;
  private painelPausa: Sprite;
  private painelGrande: Sprite;

  private transicao: { t: number; fase: 'saindo' | 'entrando'; acao: (() => void) | null } | null =
    null;
  private dica: { rotulo: string; x: number; y: number } | null = null;
  private dicaFerramenta: { rotulo: string; x: number; y: number } | null = null;
  private listaDesenho: ItemDesenho[] = [];
  /** Nó em foco (mostra a barrinha de vida por alguns segundos). */
  private noEmFoco: { no: NoRecurso; tempo: number } | null = null;
  private objetoCasa: ObjetoCenario;
  /** Posição da máquina de venda, para animar a alavanca. */
  private maquinaX = 0;
  private maquinaY = 0;
  /** Escurecimento extra ao dormir. */
  private dormindo = 0;

  constructor(
    private jogo: Jogo,
    opcoes: OpcoesJogo = {},
  ) {
    const gerado = gerarMundo(jogo.assets);
    this.niveis.set(ID_MUNDO, gerado.nivel);
    this.niveis.set(ID_CASA, criarInterior(jogo.assets));
    this.niveis.set(ID_CABANA, criarInteriorCabana(jogo.assets));
    this.nivel = gerado.nivel;
    this.objetoCasa = gerado.objetoCasa;
    this.maquinaX = CABANA_X + 106 + 20;
    this.maquinaY = CABANA_Y + CABANA_H - 4;

    this.jogador = new Jogador(gerado.chegadaX, gerado.chegadaY);
    this.dinosPorNivel.set(
      ID_MUNDO,
      gerado.spawns.map((s) => new Dino(s.especie, s.x, s.y)),
    );
    this.dinosPorNivel.set(ID_CASA, []);
    this.dinosPorNivel.set(ID_CABANA, []);
    this.npcsPorNivel.set(ID_MUNDO, []);
    this.npcsPorNivel.set(ID_CASA, []);
    this.npcsPorNivel.set(ID_CABANA, criarNpcsDaCabana(jogo.assets));

    // ---- modo de teste
    this.progresso.demo = !!opcoes.demo;
    if (this.progresso.demo) {
      this.progresso.liberarTudo();
      this.carteira.infinita = true;
    }

    this.inventario = new Inventario(this.progresso.slotsInventario, this.progresso.pilhaMax);
    this.bau = new Recipiente(24, this.progresso.slotsBau, 99);

    // as quatro ferramentas vêm com o jogador; o resto é comprado
    this.inventario.guardar(criarItem('ferramenta', 'machado'));
    this.inventario.guardar(criarItem('ferramenta', 'picareta'));
    this.inventario.guardar(criarItem('ferramenta', 'pa'));
    this.inventario.guardar(criarItem('ferramenta', 'enxada'));
    if (this.progresso.demo) this.encherRecursos();

    this.painelPausa = desenharPainel(212, 152);
    this.painelGrande = desenharPainel(420, 234);
    this.tempoDoDia.ativo = true;
    this.tempoDoDia.fase = 0.34;

    this.mundo = {
      nivel: this.nivel,
      particulas: this.particulas,
      camera: this.camera,
      audio: jogo.audio,
      assets: jogo.assets,
      jogador: this.jogador,
      dinos: this.dinos,
      projeteis: this.projeteis,
      tempo: 0,
      criarOrbe: (x, y, ang, dano, vel) => {
        this.projeteis.push(new Orbe(x, y, ang, dano, vel));
      },
      avisar: (txt, seg) => this.hud.avisar(txt, seg),
    };

    this.painelVenda = new PainelVenda(
      this.inventario,
      this.carteira,
      jogo.assets,
      (moedas, nome, quantidade) => {
        this.jogo.audio.confirmar();
        this.particulas.texto(
          `+${formatarMoedas(moedas)}`,
          this.maquinaX,
          this.maquinaY - 40,
          P.ambar,
        );
        for (let i = 0; i < 8; i++) {
          this.particulas.pixel(this.maquinaX + this.rng.range(-8, 8), this.maquinaY - 30, P.ambar, {
            vy: this.rng.range(-40, -10),
            vida: 0.7,
            gravidade: 90,
          });
        }
        void nome;
        void quantidade;
      },
    );
    this.painelMelhorias = new PainelMelhorias(
      this.progresso,
      this.carteira,
      jogo.assets,
      (m) => this.aplicarMelhoria(m.nome),
    );
    this.painelBau = new PainelBau(
      this.bau,
      this.inventario,
      this.progresso,
      jogo.assets,
      () => this.jogo.audio.menu(),
    );

    this.painelTestes = new PainelTestes(this.acoesDeTeste());
    this.montarMenus();
    if (opcoes.chegada) this.chegadaDramatica = true;
  }

  private chegadaDramatica = false;

  private get dinos(): Dino[] {
    return this.dinosPorNivel.get(this.nivel.id) ?? [];
  }

  private get npcs(): Npc[] {
    return this.npcsPorNivel.get(this.nivel.id) ?? [];
  }

  private get algumaJanelaAberta(): boolean {
    return (
      this.painelVenda.aberta ||
      this.painelMelhorias.aberta ||
      this.painelBau.aberta ||
      this.painelTestes.aberta
    );
  }

  /** Atalhos do painel de teste: um por sistema implementado. */
  private acoesDeTeste(): AcaoTeste[] {
    const abrirMelhorias = (vendedor: 'ferreira' | 'marceneiro') => {
      const npc = this.npcsPorNivel.get(ID_CABANA)?.find((n) => n.vendedor === vendedor);
      this.painelMelhorias.abrir(vendedor, npc?.nome ?? 'Cabana', npc?.falas[0] ?? '');
    };
    return [
      { rotulo: 'Ir até a porta de casa', grupo: 'mundo', executar: () => this.teleportar('casa') },
      { rotulo: 'Entrar em casa', grupo: 'mundo', executar: () => this.irPara(ID_CASA) },
      {
        rotulo: 'Ir até a porta da cabana',
        grupo: 'mundo',
        executar: () => this.teleportar('cabana'),
      },
      { rotulo: 'Entrar na cabana', grupo: 'mundo', executar: () => this.irPara(ID_CABANA) },
      {
        rotulo: 'Ir até a máquina de venda',
        grupo: 'mundo',
        executar: () => this.teleportar('maquina'),
      },
      { rotulo: 'Vender recursos', grupo: 'dinheiro', executar: () => this.painelVenda.abrir() },
      {
        rotulo: 'Melhorar ferramentas (Bruna)',
        grupo: 'melhorias',
        executar: () => abrirMelhorias('ferreira'),
      },
      {
        rotulo: 'Melhorar bolsa e casa (Nilo)',
        grupo: 'melhorias',
        executar: () => abrirMelhorias('marceneiro'),
      },
      {
        rotulo: 'Abrir o baú',
        grupo: 'casa',
        executar: () => {
          this.bau.redimensionar(24, this.progresso.slotsBau);
          this.painelBau.abrir();
        },
      },
      { rotulo: 'Dormir até amanhecer', grupo: 'casa', executar: () => this.dormir() },
      {
        rotulo: 'Encher recursos e vida',
        grupo: 'itens',
        executar: () => {
          this.encherRecursos();
          this.jogador.vida.encher();
        },
      },
      {
        rotulo: 'Zerar a bolsa',
        grupo: 'itens',
        executar: () => {
          for (let i = 0; i < this.inventario.total; i++) {
            const item = this.inventario.slots[i];
            if (item && item.tipo === 'recurso') this.inventario.slots[i] = null;
          }
        },
      },
      {
        rotulo: 'Zerar melhorias (testar compras)',
        grupo: 'melhorias',
        executar: () => this.zerarProgresso(),
      },
      {
        rotulo: 'Adiantar 2 horas',
        grupo: 'ciclo',
        executar: () => this.tempoDoDia.avancarHoras(2),
      },
      {
        rotulo: 'Trazer um dinossauro',
        grupo: 'combate',
        executar: () => this.trazerDino(),
      },
      {
        rotulo: 'Levar dano (1 coração)',
        grupo: 'combate',
        executar: () => {
          this.jogador.receberDano(2, this.jogador.x + 12, this.jogador.y, this.mundo);
        },
      },
    ];
  }

  /**
   * Volta o progresso ao estado inicial (modo de teste), mantendo o dinheiro
   * infinito: serve para conferir as compras da cabana de novo.
   */
  private zerarProgresso(): void {
    for (const id of Object.keys(this.progresso.ferramentas) as FerramentaId[]) {
      this.progresso.ferramentas[id] = 0;
    }
    this.progresso.slotsInventario = 6;
    this.progresso.pilhaMax = 20;
    this.progresso.slotsBau = 12;
    this.progresso.casa = { camaMacia: false, bauReforcado: false, telhadoNovo: false };
    this.progresso.compradas.clear();
    this.inventario.liberados = 6;
    this.inventario.pilhaMax = 20;
    this.bau.redimensionar(24, 12);
    this.objetoCasa.sprite = this.jogo.assets.casa.exterior;
    this.hud.avisar('Progresso zerado: as melhorias voltaram a ficar à venda.', 3);
  }

  /** Traz o dinossauro vivo mais próximo para o lado do jogador. */
  private trazerDino(): void {
    if (this.nivel.id !== ID_MUNDO) this.teleportar('casa');
    const vivos = this.dinos.filter((d) => d.vivo);
    if (vivos.length === 0) {
      this.hud.avisar('Nenhum dinossauro vivo agora.', 2);
      return;
    }
    let melhor = vivos[0];
    let melhorD = Infinity;
    for (const d of vivos) {
      const dd = dist(d.x, d.y, this.jogador.x, this.jogador.y);
      if (dd < melhorD) {
        melhor = d;
        melhorD = dd;
      }
    }
    melhor.x = this.jogador.x + 54;
    melhor.y = this.jogador.y;
    this.hud.avisar(`${melhor.ficha.nome} chegou para o teste.`, 2.5);
  }

  /** Enche o inventário de recursos (modo de teste). */
  private encherRecursos(): void {
    for (const r of TODOS_RECURSOS) {
      this.inventario.guardar(criarItem('recurso', r.id, 99));
    }
  }

  // ------------------------------------------------------------------ menus

  private montarMenus(): void {
    const cx = LARGURA / 2;
    const larg = 140;
    const x = Math.round(cx - larg / 2);
    this.menuPausa = new ListaBotoes([
      new Botao(x, 92, larg, 18, 'Continuar', () => this.retomar()),
      new Botao(x, 116, larg, 18, 'Bestiário', () => {
        this.bestiario = true;
      }),
      new Botao(x, 140, larg, 18, this.rotuloSom(), () => this.alternarSom()),
      new Botao(x, 164, larg, 18, 'Voltar ao menu', () => this.voltarAoMenu()),
    ]);
    this.menuMorte = new ListaBotoes([
      new Botao(x, 132, larg, 18, 'Acordar em casa', () => this.ressuscitar()),
      new Botao(x, 154, larg, 18, 'Voltar ao menu', () => this.voltarAoMenu()),
    ]);
  }

  private rotuloSom(): string {
    return this.jogo.audio.ligado ? 'Som: ligado' : 'Som: desligado';
  }

  private alternarSom(): void {
    this.jogo.audio.iniciar();
    this.jogo.audio.alternar();
    this.menuPausa.botoes[2].rotulo = this.rotuloSom();
  }

  private voltarAoMenu(): void {
    void import('./menu').then(({ CenaMenu }) => {
      this.jogo.trocarCena(new CenaMenu(this.jogo));
    });
  }

  entrar(): void {
    this.camera.definirLimites(this.nivel.larguraPx, this.nivel.alturaPx);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.hud.mostrarLocal(this.nivel.nome);
    if (this.progresso.demo) {
      this.hud.avisar('Modo teste: dinheiro e recursos infinitos, tudo liberado.', 7);
      this.hud.avisar('F1 abre o painel de atalhos de teste.', 10);
    }
    if (this.chegadaDramatica) {
      this.chegadaDramatica = false;
      this.jogo.audio.trovao();
      this.camera.tremer(7, 0.8);
      this.particulas.animacao(
        this.jogo.assets.efeitos.ondaBranca,
        this.jogador.x,
        this.jogador.y - 6,
        0.6,
      );
      this.particulas.jato(
        this.jogador.x,
        this.jogador.y,
        [P.fumaca, P.osso, P.terraClara],
        40,
        150,
        { vida: 1.2, gravidade: 100 },
      );
      this.hud.avisar('Você caiu a mais de 100 milhões de anos do seu tempo.', 6);
      this.hud.avisar('Botão ESQUERDO usa a ferramenta, DIREITO golpeia em volta.', 8);
      this.hud.avisar('Sua casa está ali; a cabana de melhorias, ao lado.', 10);
      window.setTimeout(() => this.jogo.audio.rugido(true), 1400);
    }
  }

  // ------------------------------------------------------------ atualização

  atualizar(dt: number): void {
    const entrada = this.jogo.entrada;
    this.hud.atualizar(dt);
    this.tempoDoDia.atualizar(dt);
    if (this.dormindo > 0) this.dormindo = Math.max(0, this.dormindo - dt);

    // ---- transição entre mapas
    if (this.transicao) {
      this.transicao.t += dt;
      if (this.transicao.fase === 'saindo' && this.transicao.t >= 0.22) {
        this.transicao.acao?.();
        this.transicao = { t: 0, fase: 'entrando', acao: null };
      } else if (this.transicao.fase === 'entrando' && this.transicao.t >= 0.22) {
        this.transicao = null;
      }
    }

    // ---- janelas abertas têm prioridade sobre o mundo
    if (this.algumaJanelaAberta) {
      this.painelVenda.atualizar(dt, entrada);
      this.painelMelhorias.atualizar(dt, entrada);
      this.painelBau.atualizar(dt, entrada);
      this.painelTestes.atualizar(dt, entrada);
      this.particulas.atualizar(dt);
      return;
    }

    // ---- bestiário
    if (this.bestiario) {
      if (
        entrada.teclaAgora('Escape', 'Tab', 'Enter', 'Space') ||
        entrada.botaoAgora(0) ||
        entrada.botaoAgora(2)
      ) {
        this.bestiario = false;
      }
      return;
    }

    // ---- morte
    if (!this.jogador.vivo) {
      this.jogador.atualizar(dt, entrada, this.mundo);
      this.particulas.atualizar(dt);
      this.camera.atualizar(dt);
      this.menuMorte.atualizar(
        entrada,
        () => this.jogo.audio.menu(),
        () => this.jogo.audio.confirmar(),
      );
      return;
    }

    // ---- pausa
    if (entrada.teclaAgora('Escape')) {
      this.pausado = !this.pausado;
      this.jogo.audio.menu();
      if (this.pausado) this.menuPausa.botoes[2].rotulo = this.rotuloSom();
    }
    if (this.pausado) {
      this.menuPausa.atualizar(
        entrada,
        () => this.jogo.audio.menu(),
        () => this.jogo.audio.confirmar(),
      );
      return;
    }

    if (entrada.teclaAgora('Tab')) {
      this.bestiario = true;
      this.jogo.audio.menu();
      return;
    }
    if (entrada.teclaAgora('KeyM')) {
      this.jogo.audio.iniciar();
      const ligado = this.jogo.audio.alternar();
      this.hud.avisar(ligado ? 'Som ligado' : 'Som desligado', 1.6);
    }
    if (entrada.teclaAgora('KeyJ')) {
      this.hud.avisar('Diário: as missões chegam na próxima expedição.', 3);
    }

    // ---- atalhos do modo de teste
    if (this.progresso.demo) {
      if (entrada.teclaAgora('F1')) {
        this.painelTestes.abrir();
        this.jogo.audio.menu();
        return;
      }
      if (entrada.teclaAgora('KeyR')) {
        this.encherRecursos();
        this.jogador.vida.encher();
        this.hud.avisar('Recursos e vida recarregados.', 2);
        this.jogo.audio.confirmar();
      }
      if (entrada.teclaAgora('KeyT')) {
        this.tempoDoDia.avancarHoras(2);
        this.hud.avisar(`Agora são ${this.tempoDoDia.horaDoDia}.`, 2);
      }
      // teleportes para testar cada sistema sem caminhar
      if (entrada.teclaAgora('KeyH')) this.teleportar('casa');
      if (entrada.teclaAgora('KeyC')) this.teleportar('cabana');
      if (entrada.teclaAgora('KeyB')) this.teleportar('maquina');
    }

    // ---- seleção de itens
    for (let i = 0; i < 9; i++) {
      if (entrada.teclaAgora(`Digit${i + 1}`)) this.inventario.selecionar(i);
    }
    if (entrada.teclaAgora('Digit0')) this.inventario.selecionar(9);
    if (entrada.teclaAgora('KeyQ')) this.inventario.girarSelecao(-1);

    this.tempoJogo += dt;
    this.mundo.nivel = this.nivel;
    this.mundo.tempo = this.tempoJogo;
    this.mundo.dinos = this.dinos;

    // ---- entidades
    this.jogador.atualizar(dt, entrada, this.mundo);
    for (const d of this.dinos) d.atualizar(dt, this.mundo);
    for (const n of this.npcs) n.atualizar(dt);
    for (const no of this.nivel.nos) no.atualizar(dt);
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      this.projeteis[i].atualizar(dt, this.mundo);
      if (!this.projeteis[i].vivo) this.projeteis.splice(i, 1);
    }
    this.particulas.atualizar(dt);
    if (this.noEmFoco) {
      this.noEmFoco.tempo -= dt;
      if (this.noEmFoco.tempo <= 0) this.noEmFoco = null;
    }

    // ---- ferramenta: alvo, uso e efeito
    this.atualizarFerramenta(entrada);

    // ---- interações (E)
    this.atualizarInteracoes(entrada);

    // ---- câmera
    this.camera.seguir(this.jogador.centroX, this.jogador.centroY, dt, 7);
    this.camera.atualizar(dt);
  }

  // ------------------------------------------------------------ ferramentas

  /** Nó mais próximo que a ferramenta escolhida sabe trabalhar. */
  private alvoDaFerramenta(id: FerramentaId): NoRecurso | null {
    const ficha = FERRAMENTAS[id];
    const alcance = nivelFerramenta(id, this.progresso.nivel(id)).alcance;
    let melhor: NoRecurso | null = null;
    let melhorDist = Infinity;
    for (const no of this.nivel.nos) {
      if (!no.cheio || no.def.tipo !== ficha.alvo) continue;
      const d = dist(this.jogador.centroX, this.jogador.y, no.x, no.y - 6);
      if (d > alcance || d >= melhorDist) continue;
      melhor = no;
      melhorDist = d;
    }
    return melhor;
  }

  private atualizarFerramenta(entrada: import('../core/input').Entrada): void {
    const id = this.inventario.ferramentaSelecionada;
    this.dicaFerramenta = null;
    if (!id) {
      if (entrada.botaoAgora(0)) {
        this.hud.avisar('Escolha uma ferramenta na barra de itens (1 a 4).', 2.5);
      }
      return;
    }

    const alvo = this.alvoDaFerramenta(id);
    if (alvo) {
      this.dicaFerramenta = {
        rotulo: `${FERRAMENTAS[id].verbo}: ${alvo.def.nome}`,
        x: alvo.x - this.camera.desenhoX,
        y: alvo.y - 46 - this.camera.desenhoY,
      };
    }

    // machado e picareta precisam de alvo; pá e enxada trabalham o chão
    const precisaAlvo = id === 'machado' || id === 'picareta';
    if (entrada.botao(0) && this.jogador.podeUsarFerramenta) {
      if (precisaAlvo && !alvo) {
        // avisa uma vez por clique, sem repetir enquanto o botão fica preso
        if (entrada.botaoAgora(0)) {
          this.hud.avisar(
            id === 'machado'
              ? 'Chegue mais perto de uma árvore.'
              : 'Chegue mais perto de uma pedra.',
            2,
          );
        }
      } else {
        const angulo = alvo
          ? Math.atan2(alvo.y - 6 - this.jogador.centroY, alvo.x - this.jogador.centroX)
          : this.anguloDaDirecao();
        this.jogador.usarFerramenta(id, this.progresso.nivel(id), angulo);
        this.jogo.audio.golpe();
      }
    }

    // o instante do impacto vem do jogador
    const evento = this.jogador.eventoFerramenta;
    if (evento) {
      this.jogador.eventoFerramenta = null;
      this.aplicarFerramenta(evento.id, evento.angulo);
    }
  }

  private anguloDaDirecao(): number {
    switch (this.jogador.direcao) {
      case 'cima':
        return -Math.PI / 2;
      case 'baixo':
        return Math.PI / 2;
      case 'esquerda':
        return Math.PI;
      default:
        return 0;
    }
  }

  /** Efeito da ferramenta no mundo: colher um nó ou trabalhar o chão. */
  private aplicarFerramenta(id: FerramentaId, angulo: number): void {
    const nivel = this.progresso.nivel(id);
    const info = nivelFerramenta(id, nivel);
    const alvo = this.alvoDaFerramenta(id);

    if (alvo) {
      const resultado = alvo.golpear(info.poder, info.rendimentoExtra, this.rng);
      this.noEmFoco = { no: alvo, tempo: 3 };
      // lascas voando na direção do golpe
      this.particulas.leque(
        alvo.x,
        alvo.y - 10,
        angulo + Math.PI,
        1.2,
        [alvo.def.corLasca, P.osso, '#ffffff'],
        8,
        70,
      );
      this.particulas.animacao(this.jogo.assets.efeitos.faisca, alvo.x, alvo.y - 10, 0.2);
      this.camera.tremer(1.2, 0.12);
      if (alvo.def.som === 'madeira') this.jogo.audio.passo(false);
      else if (alvo.def.som === 'pedra') this.jogo.audio.acerto();
      else this.jogo.audio.passo(true);

      if (resultado.derrubou) {
        this.jogo.audio.morte();
        this.camera.tremer(2.4, 0.2);
        this.particulas.jato(
          alvo.x,
          alvo.y - 12,
          [alvo.def.corLasca, P.osso, '#ffffff'],
          18,
          100,
          { vida: 0.8, gravidade: 140 },
        );
        this.receberQuedas(resultado.quedas, alvo.x, alvo.y);
      }
      return;
    }

    // sem nó por perto: a enxada e a pá ainda trabalham o chão
    const px = this.jogador.centroX + Math.cos(angulo) * 14;
    const py = this.jogador.y + Math.sin(angulo) * 10;
    if (id === 'enxada') {
      const tx = Math.floor(px / TAM_TILE);
      const ty = Math.floor(py / TAM_TILE);
      const t = this.nivel.tile(tx, ty);
      const arável =
        t === Tile.Grama || t === Tile.GramaSeca || t === Tile.GramaFlorida || t === Tile.Terra;
      if (arável) {
        this.nivel.definirTile(tx, ty, Tile.TerraArada, this.rng.int(0, 1));
        this.particulas.animacao(this.jogo.assets.efeitos.poeira, px, py, 0.3);
        this.particulas.leque(px, py, angulo, 1, [P.terra, P.terraClara, P.terraEscura], 8, 55);
        this.jogo.audio.passo(false);
        this.hud.avisar('Terra arada. Uma horta cabe bem aqui.', 2);
      } else if (t === Tile.TerraArada) {
        this.hud.avisar('Essa terra já está pronta.', 1.6);
      } else {
        this.hud.avisar('A enxada não trabalha esse chão.', 1.6);
      }
      return;
    }
    if (id === 'pa') {
      this.particulas.animacao(this.jogo.assets.efeitos.poeira, px, py, 0.3);
      this.particulas.leque(px, py, angulo, 1, [P.terra, P.terraEscura], 6, 45);
      this.jogo.audio.passo(false);
      this.hud.avisar('Aqui não tem nada enterrado. Procure os montinhos de terra.', 2.4);
      return;
    }
    this.particulas.animacao(this.jogo.assets.efeitos.poeira, px, py, 0.25);
  }

  /** Guarda o que caiu e avisa o jogador. */
  private receberQuedas(
    quedas: { id: import('../gfx/sprites/tools').RecursoId; quantidade: number }[],
    x: number,
    y: number,
  ): void {
    let alturaTexto = 0;
    for (const q of quedas) {
      const sobrou = this.inventario.guardar(criarItem('recurso', q.id, q.quantidade));
      const entrou = q.quantidade - sobrou;
      const nome = RECURSOS[q.id].nome;
      if (entrou > 0) {
        this.particulas.texto(`+${entrou} ${nome}`, x, y - 18 - alturaTexto, P.osso);
        alturaTexto += 10;
        // moedinhas de recurso subindo até a barra de itens
        for (let i = 0; i < Math.min(6, entrou); i++) {
          const a = this.rng.range(0, TAU);
          this.particulas.pixel(x, y - 8, P.brilho, {
            vx: Math.cos(a) * 30,
            vy: Math.sin(a) * 20 - 20,
            vida: 0.5,
            gravidade: 40,
          });
        }
      }
      if (sobrou > 0) {
        this.hud.avisar(`Bolsa cheia: sobraram ${sobrou} de ${nome}.`, 3);
      }
    }
    if (quedas.length === 0) {
      this.particulas.texto('nada aqui', x, y - 18, '#a89fbe');
    }
  }

  // ------------------------------------------------------------- interações

  private atualizarInteracoes(entrada: import('../core/input').Entrada): void {
    this.dica = null;
    if (this.transicao) return;
    const corpo = { x: this.jogador.x - 6, y: this.jogador.y - 5, w: 12, h: 10 };

    // portais primeiro (portas)
    for (const portal of this.nivel.portais) {
      if (!rectsOverlap(corpo, portal.area)) continue;
      this.dica = {
        rotulo: portal.rotulo,
        x: this.jogador.x - this.camera.desenhoX,
        y: this.jogador.y - 46 - this.camera.desenhoY,
      };
      if (entrada.teclaAgora('KeyE')) {
        this.jogo.audio.portal();
        this.transicao = { t: 0, fase: 'saindo', acao: () => this.irPara(portal.destino) };
      }
      return;
    }

    // depois os objetos e pessoas
    let melhor: Interativo | null = null;
    let melhorDist = Infinity;
    for (const i of this.nivel.interativos) {
      const cx = i.area.x + i.area.w / 2;
      const cy = i.area.y + i.area.h / 2;
      const d = dist(this.jogador.x, this.jogador.y, cx, cy);
      if (!rectsOverlap(corpo, i.area) && d > 44) continue;
      if (d >= melhorDist) continue;
      melhor = i;
      melhorDist = d;
    }
    if (!melhor) return;
    this.dica = {
      rotulo: melhor.rotulo,
      x: this.jogador.x - this.camera.desenhoX,
      y: this.jogador.y - 46 - this.camera.desenhoY,
    };
    if (entrada.teclaAgora('KeyE')) this.executarInterativo(melhor);
  }

  private executarInterativo(i: Interativo): void {
    switch (i.acao) {
      case 'cama':
        this.dormir();
        break;
      case 'bau':
        this.bau.redimensionar(24, this.progresso.slotsBau);
        this.painelBau.abrir();
        this.jogo.audio.menu();
        break;
      case 'venda':
        this.painelVenda.abrir();
        this.jogo.audio.confirmar();
        break;
      case 'melhoria-ferreira':
      case 'melhoria-marceneiro': {
        const vendedor = i.acao === 'melhoria-ferreira' ? 'ferreira' : 'marceneiro';
        const npc = this.npcs.find((n) => n.vendedor === vendedor);
        this.painelMelhorias.abrir(
          vendedor,
          npc?.nome ?? 'Cabana',
          npc?.falas[this.rng.int(0, (npc.falas.length ?? 1) - 1)] ?? '',
        );
        this.jogo.audio.menu();
        break;
      }
      case 'lareira':
        this.hud.avisar('O fogo estala. Dá até para esquecer os dinossauros lá fora.', 3);
        for (let k = 0; k < 8; k++) {
          this.particulas.pixel(
            i.area.x + i.area.w / 2 + this.rng.range(-8, 8),
            i.area.y + i.area.h - 6,
            this.rng.chance(0.5) ? P.fogo : P.fogoClaro,
            { vy: -26, vida: 0.8 },
          );
        }
        break;
      case 'estante':
        this.hud.avisar('"Se você está lendo isto, a máquina funcionou." — vovô', 4);
        break;
      case 'janela':
        this.hud.avisar(`Lá fora é ${this.tempoDoDia.periodo}. ${this.tempoDoDia.horaDoDia}.`, 3);
        break;
      case 'bancada':
        this.hud.avisar('Peças, limalha e um cheiro forte de ferro quente.', 3);
        break;
    }
  }

  /** Dormir: passa a noite, recupera vida e adianta o ciclo do dia. */
  private dormir(): void {
    this.dormindo = 1.6;
    this.jogo.audio.portal();
    this.transicao = {
      t: 0,
      fase: 'saindo',
      acao: () => {
        this.tempoDoDia.avancarPara(0.28);
        if (this.progresso.casa.camaMacia) this.jogador.vida.encher();
        else this.jogador.vida.curar(Math.ceil(this.jogador.vida.metadesMax / 2));
        this.jogador.fome.encher();
        for (const d of this.nivel.nos) d.atualizar(999);
        this.hud.avisar(
          this.progresso.casa.camaMacia
            ? 'Você dorme feito pedra e acorda inteiro.'
            : 'Você cochila no colchão duro e acorda meio recuperado.',
          4,
        );
        this.hud.avisar(`Amanheceu: ${this.tempoDoDia.horaDoDia}.`, 4);
      },
    };
  }

  /** Atalho do modo de teste: leva o jogador direto a cada sistema. */
  private teleportar(destino: 'casa' | 'cabana' | 'maquina'): void {
    if (this.nivel.id !== ID_MUNDO) {
      this.nivel = this.niveis.get(ID_MUNDO)!;
      this.mundo.nivel = this.nivel;
      this.mundo.dinos = this.dinos;
      this.camera.definirLimites(this.nivel.larguraPx, this.nivel.alturaPx);
    }
    const pontos = {
      casa: { x: CASA_X + CASA_PORTA.x + CASA_PORTA.w / 2, y: CASA_Y + CASA_H + 6 },
      cabana: {
        x: CABANA_X + CABANA_PORTA.x + CABANA_PORTA.w / 2,
        y: CABANA_Y + CABANA_H - 6,
      },
      maquina: { x: this.maquinaX, y: this.maquinaY + 12 },
    };
    const p = pontos[destino];
    this.jogador.reposicionar(p.x, p.y);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.hud.avisar(`Teleporte: ${destino}.`, 1.6);
  }

  /** Efeitos visíveis de uma melhoria comprada. */
  private aplicarMelhoria(nome: string): void {
    this.inventario.liberados = this.progresso.slotsInventario;
    this.inventario.pilhaMax = this.progresso.pilhaMax;
    this.bau.redimensionar(24, this.progresso.slotsBau);
    if (this.progresso.casa.telhadoNovo) {
      this.objetoCasa.sprite = this.jogo.assets.casa.exteriorNovo;
      const mundoNivel = this.niveis.get(ID_MUNDO);
      if (mundoNivel && mundoNivel.luzes.length < 3) {
        mundoNivel.luzes.push({ x: CASA_X + 20, y: CASA_Y + CASA_H + 18 });
      }
    }
    this.jogo.audio.confirmar();
    this.hud.avisar(`${nome} instalado!`, 3);
    for (let i = 0; i < 14; i++) {
      const a = this.rng.range(0, TAU);
      this.particulas.pixel(this.jogador.centroX, this.jogador.centroY, P.ambar, {
        vx: Math.cos(a) * 50,
        vy: Math.sin(a) * 40,
        vida: 0.7,
        gravidade: 30,
      });
    }
  }

  private irPara(destino: string): void {
    const alvo = this.niveis.get(destino);
    if (!alvo) return;
    this.nivel = alvo;
    this.mundo.nivel = alvo;
    this.mundo.dinos = this.dinos;
    this.projeteis.length = 0;
    this.camera.definirLimites(alvo.larguraPx, alvo.alturaPx);

    if (destino === ID_CASA || destino === ID_CABANA) {
      this.jogador.reposicionar(alvo.entradaX, alvo.entradaY);
    } else {
      // sai pela porta do prédio de onde veio
      const dePorta = this.ultimoPredio === ID_CABANA;
      this.jogador.reposicionar(
        dePorta
          ? CABANA_X + CABANA_PORTA.x + CABANA_PORTA.w / 2
          : CASA_X + CASA_PORTA.x + CASA_PORTA.w / 2,
        dePorta ? CABANA_Y + CABANA_H + 10 : CASA_Y + CASA_H + 8,
      );
    }
    if (destino === ID_CASA || destino === ID_CABANA) this.ultimoPredio = destino;
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.hud.mostrarLocal(alvo.nome);
  }

  private ultimoPredio: string = ID_CASA;

  private retomar(): void {
    this.pausado = false;
  }

  private ressuscitar(): void {
    const mundoNivel = this.niveis.get(ID_MUNDO)!;
    this.nivel = mundoNivel;
    this.mundo.nivel = mundoNivel;
    this.mundo.dinos = this.dinos;
    this.camera.definirLimites(mundoNivel.larguraPx, mundoNivel.alturaPx);
    this.jogador.vida.encher();
    this.jogador.fome.encher();
    this.jogador.tempoMorto = 0;
    this.jogador.reposicionar(
      CASA_X + CASA_PORTA.x + CASA_PORTA.w / 2,
      CASA_Y + CASA_H + 14,
    );
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.particulas.limpar();
    this.projeteis.length = 0;
    for (const d of this.dinos) {
      d.x = d.nascimentoX;
      d.y = d.nascimentoY;
    }
    this.hud.avisar('Você acorda na porta de casa, tonto mas vivo.', 4);
  }

  // ---------------------------------------------------------------- desenho

  desenhar(g: CanvasRenderingContext2D): void {
    const camX = this.camera.desenhoX;
    const camY = this.camera.desenhoY;

    // o baú aparece aberto enquanto a janela dele está na tela
    const objetoBau = this.nivel.nomeados.get('bau');
    if (objetoBau) {
      objetoBau.sprite = this.painelBau.aberta
        ? this.jogo.assets.casa.bauAberto
        : this.jogo.assets.casa.bau;
    }

    desenharTerreno(g, this.nivel, this.jogo.assets, camX, camY, this.tempoJogo);

    const lista = this.listaDesenho;
    lista.length = 0;
    for (const o of objetosVisiveis(this.nivel, camX, camY)) {
      lista.push({ base: o.base, tipo: 'objeto', o });
    }
    for (const d of this.dinos) {
      if (
        d.x < camX - 80 ||
        d.x > camX + LARGURA + 80 ||
        d.y < camY - 80 ||
        d.y > camY + ALTURA + 80
      )
        continue;
      lista.push({ base: d.baseY, tipo: 'dino', d });
    }
    for (const n of this.npcs) lista.push({ base: n.baseY, tipo: 'npc', n });
    lista.push({ base: this.jogador.y, tipo: 'jogador' });
    lista.sort((a, b) => a.base - b.base);

    for (const item of lista) {
      if (item.tipo === 'objeto') desenharObjeto(g, item.o, camX, camY, this.tempoJogo);
      else if (item.tipo === 'dino') item.d.desenhar(g, this.mundo, camX, camY);
      else if (item.tipo === 'npc') {
        const perto = dist(this.jogador.x, this.jogador.y, item.n.x, item.n.y) < 40;
        item.n.desenhar(g, this.jogo.assets, camX, camY, perto);
      } else this.jogador.desenhar(g, this.mundo, camX, camY);
    }

    for (const p of this.projeteis) p.desenhar(g, this.mundo, camX, camY);
    this.particulas.desenhar(g, camX, camY);

    // alavanca da máquina de venda, quando vende
    if (this.nivel.id === ID_MUNDO) {
      const alavancas = this.jogo.assets.cabana.alavanca;
      const s = alavancas[this.painelVenda.alavanca > 0.35 ? 1 : 0];
      g.drawImage(s, Math.round(this.maquinaX + 11 - camX), Math.round(this.maquinaY - 34 - camY));
    }

    this.desenharBarraDoNo(g, camX, camY);
    this.desenharLuzes(g, camX, camY);

    // tinta do ciclo de dia e noite
    const amb = this.tempoDoDia.ambiente();
    if (amb) {
      g.globalAlpha = this.nivel.ambiente === 'exterior' ? amb.alpha : amb.alpha * 0.55;
      g.fillStyle = amb.cor;
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    g.drawImage(this.jogo.assets.vinheta, 0, 0);

    // ---- interface
    this.hud.desenhar(g, this.jogo.assets, {
      jogador: this.jogador,
      inventario: this.inventario,
      progresso: this.progresso,
      carteira: this.carteira,
      hora: this.tempoDoDia.horaDoDia,
      periodo: this.tempoDoDia.periodo,
    });
    if (this.dicaFerramenta && !this.dica) {
      this.hud.desenharDicaFerramenta(g, this.dicaFerramenta.rotulo, this.dicaFerramenta.x, this.dicaFerramenta.y);
    }
    if (this.dica) {
      this.hud.desenharDicaInteracao(g, this.dica.rotulo, this.dica.x, this.dica.y);
    }

    if (this.transicao || this.dormindo > 0) {
      const t = this.transicao ? clamp(this.transicao.t / 0.22, 0, 1) : 1;
      const alpha = this.transicao
        ? this.transicao.fase === 'saindo'
          ? t
          : 1 - t
        : Math.min(1, this.dormindo);
      g.globalAlpha = alpha;
      g.fillStyle = '#07060c';
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    this.painelVenda.desenhar(g);
    this.painelMelhorias.desenhar(g);
    this.painelBau.desenhar(g);
    this.painelTestes.desenhar(g);

    if (this.pausado) this.desenharPausa(g);
    if (!this.jogador.vivo) this.desenharMorte(g);
    if (this.bestiario) this.desenharBestiario(g);

    if (this.jogo.entrada.mouseNaTela && !this.bestiario) {
      this.hud.desenharCursor(
        g,
        this.jogo.assets,
        this.jogo.entrada.mouseX,
        this.jogo.entrada.mouseY,
        this.jogador.podeAtacar,
      );
    }
  }

  /** Barrinha de vida do nó que está sendo colhido. */
  private desenharBarraDoNo(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    const foco = this.noEmFoco;
    if (!foco || !foco.no.cheio) return;
    const larg = 26;
    const x = Math.round(foco.no.x - larg / 2 - camX);
    const y = Math.round(foco.no.y - 26 - camY);
    g.globalAlpha = clamp(foco.tempo, 0, 1);
    g.fillStyle = P.contorno;
    g.fillRect(x, y, larg, 5);
    g.fillStyle = '#3a2b33';
    g.fillRect(x + 1, y + 1, larg - 2, 3);
    g.fillStyle = P.folhaClara;
    g.fillRect(x + 1, y + 1, Math.round((larg - 2) * foco.no.proporcaoVida), 3);
    g.fillStyle = P.brilho;
    g.fillRect(x + 1, y + 1, Math.round((larg - 2) * foco.no.proporcaoVida), 1);
    g.globalAlpha = 1;
  }

  /** Halos de lampião/lareira/forja e as chamas animadas. */
  private desenharLuzes(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    const a = this.jogo.assets;
    const chamas = a.casa.chamas;
    for (const f of this.nivel.fogos) {
      const q = chamas[Math.floor(this.tempoJogo * 9) % chamas.length];
      g.drawImage(
        q,
        Math.round(f.x - q.width / 2 - camX),
        Math.round(f.y - q.height / 2 - camY),
      );
    }
    const halo = a.casa.haloLampiao;
    for (let i = 0; i < this.nivel.luzes.length; i++) {
      const l = this.nivel.luzes[i];
      g.globalAlpha = 0.75 + Math.sin(this.tempoJogo * 3 + i) * 0.18;
      g.drawImage(
        halo,
        Math.round(l.x - halo.width / 2 - camX),
        Math.round(l.y - halo.height / 2 - camY),
      );
      g.globalAlpha = 1;
    }
    // brilho da forja da cabana, visto de fora
    if (this.nivel.id === ID_MUNDO) {
      const brilho = a.cabana.brilhoForja;
      g.globalAlpha = 0.8 + Math.sin(this.tempoJogo * 5) * 0.2;
      g.drawImage(
        brilho,
        Math.round(CABANA_X + 22 - brilho.width / 2 - camX),
        Math.round(CABANA_Y + 62 - brilho.height / 2 - camY),
      );
      g.globalAlpha = 1;
    }
  }

  private desenharPausa(g: CanvasRenderingContext2D): void {
    g.globalAlpha = 0.72;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;
    const x = Math.round((LARGURA - this.painelPausa.width) / 2);
    g.drawImage(this.painelPausa, x, 72);
    textoGrande(g, 'PAUSA', LARGURA / 2, 40, 2, {
      cor: P.ambar,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    this.menuPausa.desenhar(g);
    texto(
      g,
      this.progresso.demo
        ? 'TESTE: F1 atalhos · R recursos · T +2h · H/C/B teleportes'
        : 'TAB bestiário · M som · J diário',
      LARGURA / 2,
      236,
      { cor: '#8b83a3', sombra: P.contorno, alinhamento: 'centro' },
    );
    this.hud.desenharCursor(
      g,
      this.jogo.assets,
      this.jogo.entrada.mouseX,
      this.jogo.entrada.mouseY,
      false,
    );
  }

  private desenharMorte(g: CanvasRenderingContext2D): void {
    const t = clamp(this.jogador.tempoMorto / 1.2, 0, 1);
    g.globalAlpha = 0.8 * t;
    g.fillStyle = '#1a0a0c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;
    if (t < 0.4) return;
    textoGrande(g, 'VOCÊ CAIU', LARGURA / 2, 72, 3, {
      cor: P.coracao,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    texto(g, 'O vale não perdoa distração.', LARGURA / 2, 118, {
      cor: P.osso,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    this.menuMorte.desenhar(g);
    this.hud.desenharCursor(
      g,
      this.jogo.assets,
      this.jogo.entrada.mouseX,
      this.jogo.entrada.mouseY,
      false,
    );
  }

  private desenharBestiario(g: CanvasRenderingContext2D): void {
    g.globalAlpha = 0.86;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;
    const x = Math.round((LARGURA - this.painelGrande.width) / 2);
    const y = 18;
    g.drawImage(this.painelGrande, x, y);
    texto(g, 'BESTIÁRIO DO VALE', LARGURA / 2, y + 10, {
      cor: P.ambar,
      sombra: P.contorno,
      alinhamento: 'centro',
    });

    const colunas = 2;
    const largCol = 196;
    TODAS_FICHAS.forEach((f, i) => {
      const col = i % colunas;
      const linha = Math.floor(i / colunas);
      const cx = x + 10 + col * (largCol + 8);
      const cy = y + 26 + linha * 40;
      const q = this.jogo.assets.dinos[f.id].direita[0];
      g.drawImage(q, Math.round(cx + 18 - q.width / 2), Math.round(cy + 30 - q.height));
      texto(g, f.nome, cx + 40, cy, { cor: P.osso, sombra: P.contorno });
      texto(g, NOME_CATEGORIA[f.categoria], cx + 40, cy + 9, {
        cor: P.ambar,
        sombra: P.contorno,
      });
      const desc = quebrarTexto(f.descricao, largCol - 44);
      paragrafo(g, desc.slice(0, 2), cx + 40, cy + 19, {
        cor: '#a89fbe',
        sombra: P.contorno,
      });
    });

    texto(g, 'TAB ou ESC para fechar', LARGURA / 2, y + this.painelGrande.height - 12, {
      cor: '#8b83a3',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
  }
}
