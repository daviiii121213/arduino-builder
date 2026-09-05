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
  BOCA_GRUTA_X,
  BOCA_GRUTA_Y,
  BOCA_MINA_X,
  BOCA_MINA_Y,
  pontoDoBioma,
} from '../world/worldgen';
import { BIOMAS, TODOS_BIOMAS, type BiomaId } from '../world/biomes';
import { gerarAndar, type AndarGerado } from '../world/caves';
import {
  ANDARES,
  CAVERNAS,
  TODAS_CAVERNAS,
  idDoAndar,
  type CavernaId,
} from '../world/caveDefs';
import { chanceDeFossil, sortearFossil, FOSSEIS, COR_RARIDADE } from '../systems/fossils';
import { criarCanvas, ctx2d } from '../gfx/pixel';
import { criarNpcsDaCabana } from '../world/npcs';
import { desenharTerreno, objetosVisiveis, desenharObjeto } from '../world/renderer';
import { colocar } from '../world/props';
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
import { PainelMochila } from '../ui/mochila';
import { PainelDiario } from '../ui/diario';
import { Diario } from '../systems/missions';
import { Botao, ListaBotoes, textoGrande } from '../ui/widgets';
import { desenharPainel } from '../gfx/sprites/ui';
import { texto } from '../gfx/font';
import { P } from '../gfx/palette';
import { clamp, dist, rectsOverlap, TAU } from '../core/math';
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
  private painelMochila!: PainelMochila;
  private painelDiario!: PainelDiario;
  private diario!: Diario;

  private pausado = false;
  private menuPausa!: ListaBotoes;
  private menuMorte!: ListaBotoes;
  private painelPausa: Sprite;

  private transicao: { t: number; fase: 'saindo' | 'entrando'; acao: (() => void) | null } | null =
    null;
  private dica: { rotulo: string; x: number; y: number } | null = null;
  private dicaFerramenta: {
    rotulo: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null = null;
  private listaDesenho: ItemDesenho[] = [];
  /** Nó em foco (mostra a barrinha de vida por alguns segundos). */
  private noEmFoco: { no: NoRecurso; tempo: number } | null = null;
  private objetoCasa: ObjetoCenario;
  /** Posição da máquina de venda, para animar a alavanca. */
  private maquinaX = 0;
  private maquinaY = 0;
  /** Escurecimento extra ao dormir. */
  private dormindo = 0;
  /** Bioma em que o jogador está agora (atmosfera, som e partículas). */
  private biomaAtual: BiomaId = 'vale';
  /** Acumulador fracionário das partículas de ambiente. */
  private restoAmbiente = 0;
  /** Andares de caverna já gerados nesta partida (são criados sob demanda). */
  private andares = new Map<string, AndarGerado>();
  /** Caverna e andar atuais (null na superfície). */
  private caverna: CavernaId | null = null;
  private andar = 0;
  /** Por onde o jogador entrou na caverna, para voltar no lugar certo. */
  private bocaDeSaida: CavernaId = 'gruta';
  /** Camada de escuridão das cavernas, redesenhada a cada quadro. */
  private camadaEscura = criarCanvas(LARGURA, ALTURA);
  /** Chefe vivo no andar atual (barra de vida no alto da tela). */
  private chefeAtual: Dino | null = null;
  /** Baú de recompensa do décimo andar, quando o chefe já caiu. */
  private tesouroAberto = new Set<string>();

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

    // a lança é a arma de sempre; as quatro ferramentas vêm com o jogador
    this.inventario.guardar(criarItem('arma', 'lanca'));
    this.inventario.guardar(criarItem('ferramenta', 'machado'));
    this.inventario.guardar(criarItem('ferramenta', 'picareta'));
    this.inventario.guardar(criarItem('ferramenta', 'pa'));
    this.inventario.guardar(criarItem('ferramenta', 'enxada'));
    if (this.progresso.demo) this.encherRecursos();

    this.painelPausa = desenharPainel(212, 152);
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
      criarOrbe: (x, y, ang, dano, vel, estilo) => {
        this.projeteis.push(new Orbe(x, y, ang, dano, vel, estilo));
      },
      invocar: (especie, x, y) => {
        const d = new Dino(especie, x, y);
        this.dinos.push(d);
        this.particulas.animacao(this.jogo.assets.efeitos.ondaBranca, x, y - 8, 0.4);
      },
      avisar: (txt, seg) => this.hud.avisar(txt, seg),
      aoAbater: (especie) => {
        this.diario.abateu();
        const caverna = TODAS_CAVERNAS.find((c) => c.chefe === especie);
        if (caverna) this.aoDerrubarChefe(caverna.id);
      },
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
        this.diario.vendeu(moedas);
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

    this.painelMochila = new PainelMochila(
      this.inventario,
      this.progresso,
      this.carteira,
      jogo.assets,
      () => {
        this.jogador.armadura = this.progresso.armaduraVestida;
        this.jogo.audio.confirmar();
      },
    );
    // ---- diário: as missões chegam sozinhas conforme o jogador avança
    this.diario = new Diario(
      (m) => {
        this.carteira.ganhar(m.recompensa);
        this.jogo.audio.confirmar();
        this.hud.avisar(`Missão concluída: ${m.titulo} (+${m.recompensa} moedas).`, 4);
        this.particulas.texto(
          `+${formatarMoedas(m.recompensa)}`,
          this.jogador.centroX,
          this.jogador.y - 30,
          P.ambar,
        );
      },
      (m) => {
        this.hud.avisar(`Nova página no diário: ${m.titulo}. Aperte J.`, 4);
      },
    );
    this.painelDiario = new PainelDiario(this.diario, this.progresso, this.carteira, jogo.assets);

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
      this.painelTestes.aberta ||
      this.painelMochila.aberta ||
      this.painelDiario.aberta
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
      ...TODOS_BIOMAS.map((f) => ({
        rotulo: `Ir ao bioma: ${f.nome}`,
        grupo: 'biomas',
        executar: () => this.teleportarBioma(f.id),
      })),
      ...TODAS_CAVERNAS.flatMap((c) => [
        {
          rotulo: `${c.nome}: entrar no 1º andar`,
          grupo: 'cavernas',
          executar: () => this.irParaAndar(c.id, 1),
        },
        {
          rotulo: `${c.nome}: ir ao 10º andar (chefe)`,
          grupo: 'cavernas',
          executar: () => this.irParaAndar(c.id, ANDARES),
        },
      ]),
      {
        rotulo: 'Ir até o minério mais próximo',
        grupo: 'cavernas',
        executar: () => this.irAteONo('rocha'),
      },
      {
        rotulo: 'Ir até a escavação mais próxima',
        grupo: 'cavernas',
        executar: () => this.irAteONo('escavacao'),
      },
      {
        rotulo: 'Achar uma peça de arqueologia',
        grupo: 'cavernas',
        executar: () => {
          const id = sortearFossil(this.rng, {
            bioma: this.biomaAtual,
            caverna: !!this.caverna,
            profundidade: this.andar,
          });
          if (id) this.receberFossil(id, this.jogador.centroX, this.jogador.y);
        },
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
        rotulo: 'Abrir a mochila (TAB)',
        grupo: 'itens',
        executar: () => this.painelMochila.abrir('bolsa'),
      },
      {
        rotulo: 'Abrir o diário de missões (J)',
        grupo: 'missões',
        executar: () => this.painelDiario.abrir(),
      },
      {
        rotulo: 'Abrir o bestiário (25 criaturas)',
        grupo: 'missões',
        executar: () => this.painelMochila.abrir('bestiario'),
      },
      {
        rotulo: 'Trocar de armadura',
        grupo: 'armadura',
        executar: () => {
          const ordem: (typeof this.progresso.armaduraVestida)[] = [
            'couro',
            'osso',
            'cristal',
            null,
          ];
          const i = ordem.indexOf(this.progresso.armaduraVestida);
          this.progresso.armaduraVestida = ordem[(i + 1) % ordem.length];
          this.jogador.armadura = this.progresso.armaduraVestida;
          this.hud.avisar(
            this.progresso.armaduraVestida
              ? `Vestindo ${this.progresso.armaduraVestida}.`
              : 'Sem armadura.',
            2,
          );
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
    this.progresso.slotsInventario = 10;
    this.progresso.pilhaMax = 20;
    this.progresso.slotsBau = 12;
    this.progresso.casa = { camaMacia: false, bauReforcado: false, telhadoNovo: false };
    this.progresso.armaduras.clear();
    this.progresso.armaduraVestida = null;
    this.jogador.armadura = null;
    this.progresso.compradas.clear();
    this.inventario.liberados = 10;
    this.inventario.pilhaMax = 20;
    this.bau.redimensionar(24, 12);
    this.objetoCasa.sprite = this.jogo.assets.casa.exterior;
    this.hud.avisar('Progresso zerado: as melhorias voltaram a ficar à venda.', 3);
  }

  /** Atalho de teste: leva o jogador para o lado do nó de recurso mais perto. */
  private irAteONo(tipo: 'rocha' | 'escavacao' | 'arvore' | 'solo'): void {
    let melhor: NoRecurso | null = null;
    let melhorD = Infinity;
    for (const no of this.nivel.nos) {
      if (!no.cheio || no.def.tipo !== tipo) continue;
      const d = dist(no.x, no.y, this.jogador.centroX, this.jogador.y);
      if (d >= melhorD) continue;
      melhor = no;
      melhorD = d;
    }
    if (!melhor) {
      this.hud.avisar(`Nenhum nó de ${tipo} neste mapa.`, 2);
      return;
    }
    this.jogador.reposicionar(melhor.x, melhor.y + 18);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.hud.avisar(`${melhor.def.nome} logo à frente.`, 2.5);
  }

  /** Traz o dinossauro vivo mais próximo para o lado do jogador. */
  private trazerDino(): void {
    // dentro de casa ou da cabana não há bicho nenhum: sai para o vale antes.
    // Nas cavernas o teste roda ali mesmo, com a população do andar.
    if (this.nivel.ambiente === 'interior' || this.nivel.ambiente === 'cabana') {
      this.teleportar('casa');
    }
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
      new Botao(x, 116, larg, 18, 'Mochila e bestiário', () => {
        this.pausado = false;
        this.painelMochila.abrir('bestiario');
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
      this.hud.avisar('Mais de 100 milhões de anos no passado.', 4);
      this.hud.avisar('ESQUERDO: ferramenta · DIREITO: golpe · TAB: mochila', 7);
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
      this.painelMochila.atualizar(dt, entrada);
      this.painelDiario.atualizar(dt, entrada);
      this.particulas.atualizar(dt);
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
      this.painelMochila.abrir('bolsa');
      this.jogo.audio.menu();
      return;
    }
    if (entrada.teclaAgora('KeyM')) {
      this.jogo.audio.iniciar();
      const ligado = this.jogo.audio.alternar();
      this.hud.avisar(ligado ? 'Som ligado' : 'Som desligado', 1.6);
    }
    if (entrada.teclaAgora('KeyJ')) {
      this.painelDiario.abrir();
      this.jogo.audio.menu();
      return;
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
    this.sincronizarEquipamento();
    this.mundo.nivel = this.nivel;
    this.mundo.tempo = this.tempoJogo;
    this.mundo.dinos = this.dinos;

    // ---- entidades
    this.jogador.atualizar(dt, entrada, this.mundo);
    for (const d of this.dinos) {
      d.atualizar(dt, this.mundo);
      // bestiário: basta ver a criatura de perto para ela entrar na lista
      if (d.vivo && dist(d.x, d.y, this.jogador.centroX, this.jogador.y) < 120) {
        if (this.progresso.descobrir(d.ficha.id)) {
          this.hud.avisar(`Bestiário: ${d.ficha.nome} (${d.ficha.dificuldade}/5) anotado.`, 3);
          this.jogo.audio.confirmar();
        }
        // o diário acompanha o total anotado (no modo teste já vem completo)
        this.diario.anotou(this.progresso.especiesVistas.size);
      }
    }
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

    // ---- bioma: nome, clima, partículas e zumbido de fundo
    this.atualizarBioma(dt);

    // ---- câmera
    this.camera.seguir(this.jogador.centroX, this.jogador.centroY, dt, 7);
    this.camera.atualizar(dt);
  }

  // -------------------------------------------------------------- cavernas

  /** Gera (uma vez) e devolve o andar pedido. */
  private andarDe(caverna: CavernaId, andar: number): AndarGerado {
    const id = idDoAndar(caverna, andar);
    let a = this.andares.get(id);
    if (!a) {
      a = gerarAndar(this.jogo.assets, caverna, andar);
      this.andares.set(id, a);
      this.niveis.set(id, a.nivel);
      const bichos = a.nascimentos.map((n) => new Dino(n.especie, n.x, n.y));
      if (a.chefe && !this.progresso.chefesDerrotados.has(caverna)) {
        bichos.push(new Dino(CAVERNAS[caverna].chefe, a.chefe.x, a.chefe.y));
      }
      this.dinosPorNivel.set(id, bichos);
      this.npcsPorNivel.set(id, []);
      // o baú só aparece depois que o chefe cai
      if (a.tesouro && this.progresso.chefesDerrotados.has(caverna)) this.abrirSalaDoTesouro(a);
    }
    return a;
  }

  /** Coloca o baú de recompensa na arena do chefe. */
  private abrirSalaDoTesouro(a: AndarGerado): void {
    if (!a.tesouro) return;
    const marca = `${a.caverna}:tesouro`;
    if (a.nivel.nomeados.has(marca)) return;
    const { objeto } = colocar(a.nivel, this.jogo.assets.casa.bau, a.tesouro.x, a.tesouro.y, {
      colisao: { w: 16, h: 6 },
      sombra: this.jogo.assets.sombras.m,
    });
    a.nivel.nomeados.set(marca, objeto);
    a.nivel.luzes.push({ x: a.tesouro.x, y: a.tesouro.y - 10 });
    a.nivel.interativos.push({
      area: { x: a.tesouro.x - 16, y: a.tesouro.y - 20, w: 32, h: 26 },
      rotulo: 'Abrir o baú do chefe',
      acao: 'tesouro',
    });
    a.nivel.ordenarObjetos();
  }

  /** Leva o jogador a um andar, com a transição escura de sempre. */
  private irParaAndar(caverna: CavernaId, andar: number, vindoDeCima = true): void {
    const a = this.andarDe(caverna, andar);
    this.caverna = caverna;
    this.andar = andar;
    this.bocaDeSaida = caverna;
    this.nivel = a.nivel;
    this.mundo.nivel = a.nivel;
    this.mundo.dinos = this.dinos;
    this.projeteis.length = 0;
    this.camera.definirLimites(a.nivel.larguraPx, a.nivel.alturaPx);
    const p = vindoDeCima ? a.chegadaDeCima : a.chegadaDeBaixo;
    this.jogador.reposicionar(p.x, p.y);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.chefeAtual = this.dinos.find((d) => d.ficha.chefe) ?? null;
    this.hud.mostrarLocal(a.nivel.nome);
    this.jogo.audio.ambiente(CAVERNAS[caverna].som);

    // chegar num andar inédito rende uma bolada e um registro no diário
    if (this.progresso.alcancarAndar(caverna, andar)) {
      const bonus = 30 + andar * 20;
      this.carteira.ganhar(bonus);
      this.jogo.audio.confirmar();
      this.hud.avisar(
        `Andar ${andar} de ${ANDARES} alcançado! +${formatarMoedas(bonus)} pelo mapeamento.`,
        4,
      );
      this.particulas.texto(
        `+${formatarMoedas(bonus)}`,
        this.jogador.centroX,
        this.jogador.y - 30,
        P.ambar,
      );
      this.diario.desceu(caverna, andar);
    }
    if (andar === ANDARES && this.chefeAtual) {
      this.hud.avisar(`${this.chefeAtual.ficha.nome} — ${this.chefeAtual.ficha.chefe!.titulo}.`, 4);
      this.jogo.audio.rugido(true);
      this.camera.tremer(5, 0.7);
    }
  }

  /** Entra na caverna pela boca do vale, no andar mais fundo já alcançado. */
  private entrarNaCaverna(caverna: CavernaId): void {
    const fundo = Math.max(1, this.progresso.andarMax[caverna]);
    this.transicao = {
      t: 0,
      fase: 'saindo',
      acao: () => {
        this.irParaAndar(caverna, 1);
        if (fundo > 1) {
          this.hud.avisar(
            `O guincho já desce até o andar ${fundo}: procure a plataforma na entrada.`,
            4,
          );
        }
      },
    };
    this.jogo.audio.portal();
  }

  /** Sai da caverna e volta para a boca correspondente, no vale. */
  private sairParaOVale(): void {
    const mundoNivel = this.niveis.get(ID_MUNDO)!;
    this.caverna = null;
    this.andar = 0;
    this.chefeAtual = null;
    this.nivel = mundoNivel;
    this.mundo.nivel = mundoNivel;
    this.mundo.dinos = this.dinos;
    this.projeteis.length = 0;
    this.camera.definirLimites(mundoNivel.larguraPx, mundoNivel.alturaPx);
    const boca =
      this.bocaDeSaida === 'gruta'
        ? { x: BOCA_GRUTA_X + 24, y: BOCA_GRUTA_Y + 66 }
        : { x: BOCA_MINA_X + 24, y: BOCA_MINA_Y + 66 };
    this.jogador.reposicionar(boca.x, boca.y);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.biomaAtual = 'vale';
    this.hud.mostrarLocal(mundoNivel.nome);
    this.jogo.audio.ambiente(null);
  }

  /**
   * O guincho: sobe direto para o vale de qualquer andar, e da boca da caverna
   * desce direto para o andar mais fundo já alcançado. É o que evita refazer
   * os dez andares toda vez.
   */
  private usarGuincho(): void {
    if (!this.caverna) return;
    const caverna = this.caverna;
    const fundo = this.progresso.andarMax[caverna];
    this.jogo.audio.maquina();
    if (this.andar > 1) {
      this.transicao = { t: 0, fase: 'saindo', acao: () => this.sairParaOVale() };
      this.hud.avisar('O guincho range e sobe com você até a boca da caverna.', 3);
      return;
    }
    // no primeiro andar o guincho serve para descer de volta ao fundo
    if (fundo > 1) {
      this.transicao = { t: 0, fase: 'saindo', acao: () => this.irParaAndar(caverna, fundo) };
      this.hud.avisar(`Descendo direto para o andar ${fundo}.`, 3);
    } else {
      this.transicao = { t: 0, fase: 'saindo', acao: () => this.sairParaOVale() };
    }
  }

  /** Recompensa do décimo andar: dinheiro, minérios raros e o prêmio único. */
  private abrirTesouro(): void {
    if (!this.caverna) return;
    const caverna = this.caverna;
    const marca = idDoAndar(caverna, ANDARES);
    if (this.tesouroAberto.has(marca)) {
      this.hud.avisar('O baú já está vazio.', 2);
      return;
    }
    this.tesouroAberto.add(marca);
    const r = CAVERNAS[caverna].recompensa;
    this.carteira.ganhar(r.moedas);
    for (const item of r.itens) {
      const sobrou = this.inventario.guardar(criarItem('recurso', item.id, item.quantidade));
      if (sobrou > 0) this.hud.avisar(`Bolsa cheia: sobraram ${sobrou} de ${RECURSOS[item.id].nome}.`, 3);
      if (item.id in FOSSEIS) this.progresso.encontrarFossil(item.id as keyof typeof FOSSEIS);
    }
    if (r.premio === 'lanterna') {
      this.progresso.lanterna = true;
    } else {
      this.progresso.armaduras.add(r.premio);
      this.progresso.armaduraVestida = r.premio;
      this.jogador.armadura = r.premio;
    }
    this.jogo.audio.confirmar();
    this.camera.tremer(3, 0.4);
    this.particulas.jato(this.jogador.centroX, this.jogador.centroY, [P.ambar, P.brilho, '#ffffff'], 30, 120, {
      vida: 1.1,
      gravidade: 60,
    });
    this.hud.avisar(`${r.nomePremio}: ${r.texto}`, 6);
    this.hud.avisar(`+${formatarMoedas(r.moedas)} e minérios raros do baú.`, 5);
  }

  /** Efeito de derrubar um chefe: libera o baú e marca o feito. */
  private aoDerrubarChefe(caverna: CavernaId): void {
    if (this.progresso.chefesDerrotados.has(caverna)) return;
    this.progresso.chefesDerrotados.add(caverna);
    this.chefeAtual = null;
    const a = this.andares.get(idDoAndar(caverna, ANDARES));
    if (a) this.abrirSalaDoTesouro(a);
    this.camera.tremer(8, 1.2);
    this.jogo.audio.trovao();
    this.hud.avisar(`${CAVERNAS[caverna].nome}: o guardião caiu. Um baú apareceu na arena.`, 6);
    this.diario.derrotouChefe(caverna);
  }

  // ---------------------------------------------------------------- biomas

  /** Descobre em que bioma o jogador está e liga a atmosfera dele. */
  private atualizarBioma(dt: number): void {
    if (this.caverna) {
      this.emitirPoeiraDeCaverna(dt);
      return;
    }
    if (this.nivel.id !== ID_MUNDO) {
      this.jogo.audio.ambiente(null);
      return;
    }
    const b = this.nivel.biomaEm(this.jogador.centroX, this.jogador.y);
    if (b !== this.biomaAtual) {
      this.biomaAtual = b;
      const ficha = BIOMAS[b];
      this.hud.mostrarLocal(ficha.nome);
      this.hud.avisar(ficha.descricao, 3.5);
      this.jogo.audio.ambiente(ficha.som);
      if (this.progresso.visitarBioma(b)) this.diario.visitou(b);
    }
    this.emitirAmbiente(dt);
  }

  /** Pó em suspensão (e brasa, no Abismo) descendo devagar dentro da caverna. */
  private emitirPoeiraDeCaverna(dt: number): void {
    if (!this.caverna) return;
    const f = CAVERNAS[this.caverna];
    this.restoAmbiente += (10 + this.andar) * dt;
    const quantas = Math.floor(this.restoAmbiente);
    this.restoAmbiente -= quantas;
    const camX = this.camera.desenhoX;
    const camY = this.camera.desenhoY;
    const sobe = this.caverna === 'mina';
    for (let i = 0; i < quantas; i++) {
      this.particulas.pixel(
        camX + this.rng.range(0, LARGURA),
        camY + this.rng.range(0, ALTURA),
        this.rng.pick(f.poeira),
        {
          vx: this.rng.range(-6, 6),
          vy: sobe ? this.rng.range(-26, -10) : this.rng.range(4, 14),
          vida: this.rng.range(1.2, 2.6),
          gravidade: sobe ? -8 : 6,
        },
      );
    }
  }

  /**
   * Partículas do ar do bioma (faísca mágica, mosquito, folha, brasa, areia).
   * Só nascem dentro do quadro visível e são poucas por segundo — o custo fica
   * igual ao de qualquer outro efeito do jogo.
   */
  private emitirAmbiente(dt: number): void {
    const amb = BIOMAS[this.biomaAtual].ambiente;
    if (!amb) return;
    this.restoAmbiente += amb.taxa * dt;
    const quantas = Math.floor(this.restoAmbiente);
    this.restoAmbiente -= quantas;
    const camX = this.camera.desenhoX;
    const camY = this.camera.desenhoY;
    for (let i = 0; i < quantas; i++) {
      this.particulas.pixel(
        camX + this.rng.range(-12, LARGURA + 12),
        camY + this.rng.range(-12, ALTURA + 12),
        this.rng.pick(amb.cores),
        {
          vx: amb.vx * this.rng.range(0.5, 1.5),
          vy: amb.vy * this.rng.range(0.5, 1.5),
          vida: amb.vida * this.rng.range(0.7, 1.3),
          gravidade: amb.gravidade,
        },
      );
    }
  }

  /** O que está na mão e o que está vestido, lido do inventário e do progresso. */
  private sincronizarEquipamento(): void {
    const item = this.inventario.itemSelecionado;
    if (item?.tipo === 'arma') {
      this.jogador.equipado = { tipo: 'arma', id: 'lanca', nivel: 0 };
    } else if (item?.tipo === 'ferramenta') {
      const id = item.id as FerramentaId;
      this.jogador.equipado = { tipo: 'ferramenta', id, nivel: this.progresso.nivel(id) };
    } else {
      this.jogador.equipado = null;
    }
    this.jogador.armadura = this.progresso.armaduraVestida;
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
        this.hud.avisar(
          this.inventario.armaSelecionada
            ? 'A lança é arma: ataque com o botão direito.'
            : 'Escolha uma ferramenta na barra (2 a 5).',
          2.2,
        );
      }
      return;
    }

    const alvo = this.alvoDaFerramenta(id);
    if (alvo) {
      const s = alvo.objeto.sprite;
      this.dicaFerramenta = {
        rotulo: alvo.def.nome,
        x: alvo.objeto.x - this.camera.desenhoX - 2,
        y: alvo.objeto.y - this.camera.desenhoY - 2,
        w: s.width + 3,
        h: s.height + 3,
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
      // a batida muda com o que está sendo golpeado: madeira abafa, rocha
      // estala, minério canta e terra chia
      if (alvo.def.som === 'madeira') {
        this.camera.tremer(1.2, 0.12);
        this.jogo.audio.passo(false);
      } else if (alvo.def.som === 'pedra') {
        const minerio = alvo.def.nome.startsWith('Veio') || alvo.def.nome.startsWith('Geodo');
        this.camera.tremer(minerio ? 2 : 1.4, 0.14);
        this.jogo.audio.acerto();
        if (minerio) {
          // faísca de metal e um tinido agudo por cima da batida
          this.jogo.audio.magia();
          this.particulas.leque(alvo.x, alvo.y - 12, angulo + Math.PI, 0.9, [
            alvo.def.corLasca,
            '#ffffff',
          ], 6, 96);
        }
      } else {
        this.camera.tremer(0.8, 0.1);
        this.jogo.audio.passo(true);
      }

      if (resultado.derrubou) {
        // escavação pode render uma peça de coleção além dos cacos de sempre
        if (alvo.def.tipo === 'escavacao') {
          const ctx = {
            bioma: this.biomaAtual,
            caverna: !!this.caverna,
            profundidade: this.andar,
            sorte: 1 + nivel * 0.25,
          };
          if (this.rng.chance(chanceDeFossil(ctx))) {
            const achado = sortearFossil(this.rng, ctx);
            if (achado) this.receberFossil(achado, alvo.x, alvo.y);
          }
        }
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

  /**
   * Uma peça de arqueologia saiu do chão.
   *
   * Guarda no inventário, registra na coleção e faz a animação de descoberta:
   * o clarão, a chuva de pó com a cor da raridade e a etiqueta com o nome.
   */
  private receberFossil(id: keyof typeof FOSSEIS, x: number, y: number): void {
    const ficha = FOSSEIS[id];
    const cor = COR_RARIDADE[ficha.raridade];
    const sobrou = this.inventario.guardar(criarItem('recurso', id, 1));
    const novidade = this.progresso.encontrarFossil(id);

    // clarão e leque de pó na cor da raridade
    this.particulas.animacao(this.jogo.assets.efeitos.ondaBranca, x, y - 10, 0.5);
    this.particulas.jato(x, y - 8, [cor, P.osso, '#ffffff'], novidade ? 26 : 14, 100, {
      vida: 0.9,
      gravidade: 120,
    });
    for (let i = 0; i < 10; i++) {
      const a = this.rng.range(0, TAU);
      this.particulas.pixel(x, y - 8, cor, {
        vx: Math.cos(a) * 26,
        vy: Math.sin(a) * 20 - 30,
        vida: 1,
        gravidade: 60,
      });
    }
    this.particulas.texto(ficha.nome, x, y - 26, cor, '#161320', 1.8);
    this.camera.tremer(novidade ? 2.5 : 1.2, 0.25);
    this.jogo.audio.confirmar();

    if (sobrou > 0) {
      this.hud.avisar(`Bolsa cheia: a peça ${ficha.nome} ficou para trás.`, 3);
      return;
    }
    this.diario.coletou(id, 1);
    if (novidade) {
      this.hud.avisar(`Arqueologia: ${ficha.nome} (${ficha.raridade}) entrou na coleção!`, 4.5);
      this.jogo.audio.magia();
      this.diario.colecionou(this.progresso.fosseisAchados.size);
    } else {
      this.hud.avisar(`${ficha.nome} — mais uma para vender.`, 2.5);
    }
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
      if (entrou > 0) {
        this.diario.coletou(q.id, entrou);
        // primeira vez que um minério valioso sai da picareta: comemora
        const ficha = RECURSOS[q.id];
        if (ficha.valor >= 80 && this.progresso.encontrarMineral(q.id)) {
          this.hud.avisar(`Achado raro: ${ficha.nome}! Vale ${ficha.valor} moedas por unidade.`, 5);
          this.jogo.audio.magia();
          this.particulas.jato(x, y - 10, [P.ambar, P.brilho, '#ffffff'], 22, 110, {
            vida: 1,
            gravidade: 70,
          });
          this.camera.tremer(2, 0.25);
        }
      }
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

      // ------------------------------------------------------------ cavernas
      case 'entrar-gruta':
        this.entrarNaCaverna('gruta');
        break;
      case 'entrar-mina':
        this.entrarNaCaverna('mina');
        break;
      case 'descer': {
        if (!this.caverna) break;
        const caverna = this.caverna;
        const proximo = Math.min(ANDARES, this.andar + 1);
        this.jogo.audio.portal();
        this.transicao = {
          t: 0,
          fase: 'saindo',
          acao: () => this.irParaAndar(caverna, proximo, true),
        };
        break;
      }
      case 'subir': {
        if (!this.caverna) break;
        const caverna = this.caverna;
        const anterior = this.andar - 1;
        this.jogo.audio.portal();
        this.transicao = {
          t: 0,
          fase: 'saindo',
          acao: () =>
            anterior < 1 ? this.sairParaOVale() : this.irParaAndar(caverna, anterior, false),
        };
        break;
      }
      case 'guincho':
        this.usarGuincho();
        break;
      case 'tesouro':
        this.abrirTesouro();
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

  /** Atalho do modo de teste: leva o jogador ao miolo de um bioma. */
  private teleportarBioma(bioma: BiomaId): void {
    const mundoNivel = this.niveis.get(ID_MUNDO)!;
    this.caverna = null;
    this.andar = 0;
    this.chefeAtual = null;
    if (this.nivel.id !== ID_MUNDO) {
      this.nivel = mundoNivel;
      this.mundo.nivel = this.nivel;
      this.mundo.dinos = this.dinos;
      this.camera.definirLimites(this.nivel.larguraPx, this.nivel.alturaPx);
    }
    const p = pontoDoBioma(mundoNivel, bioma);
    this.jogador.reposicionar(p.x, p.y);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.atualizarBioma(0);
    this.hud.avisar(`Teleporte: ${BIOMAS[bioma].nome}.`, 2);
  }

  /** Atalho do modo de teste: leva o jogador direto a cada sistema. */
  private teleportar(destino: 'casa' | 'cabana' | 'maquina'): void {
    this.caverna = null;
    this.andar = 0;
    this.chefeAtual = null;
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
    this.jogador.armadura = this.progresso.armaduraVestida;
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
    this.caverna = null;
    this.andar = 0;
    this.chefeAtual = null;
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
    this.caverna = null;
    this.andar = 0;
    this.chefeAtual = null;
    this.jogador.veneno = 0;
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

    // tinta e escuridão da caverna
    if (this.caverna) {
      const f = CAVERNAS[this.caverna];
      g.globalAlpha = f.tinta.alpha;
      g.fillStyle = f.tinta.cor;
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
      this.desenharEscuridao(g, camX, camY);
    }

    // tinta atmosférica do bioma (só no mundo aberto)
    if (this.nivel.id === ID_MUNDO) {
      const tinta = BIOMAS[this.biomaAtual].tinta;
      if (tinta) {
        g.globalAlpha = tinta.alpha;
        g.fillStyle = tinta.cor;
        g.fillRect(0, 0, LARGURA, ALTURA);
        g.globalAlpha = 1;
      }
    }

    // tinta do ciclo de dia e noite
    const amb = this.tempoDoDia.ambiente();
    if (amb) {
      g.globalAlpha = this.nivel.ambiente === 'exterior' ? amb.alpha : amb.alpha * 0.55;
      g.fillStyle = amb.cor;
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    if (this.dicaFerramenta) {
      const d = this.dicaFerramenta;
      this.hud.desenharAlvo(g, d.x, d.y, d.w, d.h);
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
      alvo: this.dicaFerramenta?.rotulo ?? null,
      diarioNovo: this.diario.naoLidas,
    });
    this.desenharBarraDoChefe(g);
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
    this.painelMochila.desenhar(g);
    this.painelDiario.desenhar(g);

    if (this.pausado) this.desenharPausa(g);
    if (!this.jogador.vivo) this.desenharMorte(g);

    if (this.jogo.entrada.mouseNaTela) {
      this.hud.desenharCursor(
        g,
        this.jogo.assets,
        this.jogo.entrada.mouseX,
        this.jogo.entrada.mouseY,
        this.jogador.podeAtacar,
      );
    }
  }

  /**
   * Escuridão da caverna.
   *
   * Uma camada escura por cima da cena com furos onde há luz: um halo grande no
   * jogador (maior com a Lanterna de Cristal) e um menor em cada tocha, guincho
   * ou fogo do andar. Nada de interface — a leitura vem só da luz.
   */
  private desenharEscuridao(g: CanvasRenderingContext2D, camX: number, camY: number): void {
    if (!this.caverna) return;
    const f = CAVERNAS[this.caverna];
    // fica mais escuro conforme desce, mas nunca a ponto de esconder o jogo
    const forca = Math.min(0.86, f.escuridao + this.andar * 0.02);
    const gc = ctx2d(this.camadaEscura);
    gc.globalCompositeOperation = 'source-over';
    gc.fillStyle = '#05040a';
    gc.globalAlpha = 1;
    gc.fillRect(0, 0, LARGURA, ALTURA);

    gc.globalCompositeOperation = 'destination-out';
    const furo = (x: number, y: number, raio: number, forcaFuro: number) => {
      if (x < -raio || y < -raio || x > LARGURA + raio || y > ALTURA + raio) return;
      const grad = gc.createRadialGradient(x, y, 0, x, y, raio);
      grad.addColorStop(0, `rgba(0,0,0,${forcaFuro})`);
      grad.addColorStop(0.55, `rgba(0,0,0,${forcaFuro * 0.8})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      gc.fillStyle = grad;
      gc.beginPath();
      gc.arc(x, y, raio, 0, TAU);
      gc.fill();
    };

    // a lanterna do jogador
    const tremor = 1 + Math.sin(this.tempoJogo * 6) * 0.03;
    const raioJogador = (this.progresso.lanterna ? 108 : 66) * tremor;
    furo(this.jogador.centroX - camX, this.jogador.centroY - camY, raioJogador, 1);
    // tochas, guincho e fogos do andar
    for (const l of this.nivel.luzes) furo(l.x - camX, l.y - camY, 54, 0.95);
    for (const fg of this.nivel.fogos) furo(fg.x - camX, fg.y - camY, 40, 0.9);
    // os veios de minério e os cristais brilham de leve
    for (const no of this.nivel.nos) {
      if (!no.cheio || no.def.som !== 'pedra') continue;
      furo(no.x - camX, no.y - 10 - camY, 22, 0.55);
    }
    gc.globalCompositeOperation = 'source-over';

    g.globalAlpha = forca;
    g.drawImage(this.camadaEscura, 0, 0);
    g.globalAlpha = 1;
  }

  /** Barra de vida do chefe, no alto da tela, com nome e fase. */
  private desenharBarraDoChefe(g: CanvasRenderingContext2D): void {
    const c = this.chefeAtual;
    if (!c || !c.vivo || !c.ficha.chefe) return;
    const larg = 200;
    const x = Math.round((LARGURA - larg) / 2);
    const y = 6;
    const prop = clamp(c.vida / c.ficha.vidaMax, 0, 1);
    g.fillStyle = 'rgba(16,14,26,0.75)';
    g.fillRect(x - 3, y - 3, larg + 6, 18);
    g.fillStyle = P.contorno;
    g.fillRect(x, y + 8, larg, 6);
    g.fillStyle = '#3a2b33';
    g.fillRect(x + 1, y + 9, larg - 2, 4);
    g.fillStyle = prop > 0.6 ? P.coracao : prop > 0.3 ? P.fogo : P.ambar;
    g.fillRect(x + 1, y + 9, Math.round((larg - 2) * prop), 4);
    g.fillStyle = P.brilho;
    g.fillRect(x + 1, y + 9, Math.round((larg - 2) * prop), 1);
    // divisórias das fases
    const fases = c.ficha.chefe.fases;
    g.fillStyle = P.contorno;
    for (let i = 1; i < fases; i++) {
      g.fillRect(x + Math.round(((larg - 2) * i) / fases), y + 8, 1, 6);
    }
    texto(g, `${c.ficha.nome} · ${c.ficha.chefe.titulo}`, LARGURA / 2, y, {
      cor: P.osso,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
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
        : 'TAB mochila e bestiário · J diário · M som',
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

}
