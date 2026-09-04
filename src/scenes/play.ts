/**
 * Cena principal de jogo: o Vale dos Gigantes e a casa do jogador.
 */

import type { Cena, Jogo } from '../core/game';
import { LARGURA, ALTURA } from '../core/screen';
import { Camera } from '../core/camera';
import { Particulas } from '../systems/particles';
import { TempoDoDia } from '../systems/daynight';
import { Jogador } from '../entities/player';
import { Dino } from '../entities/dino';
import { Orbe } from '../entities/projectile';
import type { Mundo } from '../entities/context';
import { Nivel, type ObjetoCenario } from '../world/level';
import { gerarMundo, criarInterior, ID_CASA, ID_MUNDO } from '../world/worldgen';
import { desenharTerreno, objetosVisiveis, desenharObjeto } from '../world/renderer';
import { HUD } from '../ui/hud';
import { Inventario } from '../ui/inventory';
import { Botao, ListaBotoes, textoGrande } from '../ui/widgets';
import { desenharPainel } from '../gfx/sprites/ui';
import { texto, paragrafo, quebrarTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import { clamp, rectsOverlap } from '../core/math';
import { TODAS_FICHAS, NOME_CATEGORIA } from '../entities/dinoTypes';
import { CASA_H, CASA_PORTA } from '../gfx/sprites/house';
import type { Sprite } from '../gfx/pixel';

/** Canto superior esquerdo da casa no mundo (deve casar com worldgen). */
const CASA_MUNDO_X = 26 * 16;
const CASA_MUNDO_Y = 24 * 16;

type ItemDesenho =
  | { base: number; tipo: 'objeto'; o: ObjetoCenario }
  | { base: number; tipo: 'jogador' }
  | { base: number; tipo: 'dino'; d: Dino };

export class CenaJogo implements Cena {
  private niveis = new Map<string, Nivel>();
  private dinosPorNivel = new Map<string, Dino[]>();
  private nivel!: Nivel;
  private jogador: Jogador;
  private projeteis: Orbe[] = [];
  private particulas = new Particulas();
  private camera = new Camera();
  private hud = new HUD();
  private inventario = new Inventario();
  private tempoDoDia = new TempoDoDia();
  private mundo: Mundo;
  private tempoJogo = 0;

  private pausado = false;
  private bestiario = false;
  private menuPausa!: ListaBotoes;
  private menuMorte!: ListaBotoes;
  private painelPausa: Sprite;
  private painelGrande: Sprite;

  private transicao: { t: number; fase: 'saindo' | 'entrando'; acao: (() => void) | null } | null =
    null;
  private dicaAtual: { rotulo: string; x: number; y: number } | null = null;
  private listaDesenho: ItemDesenho[] = [];

  constructor(
    private jogo: Jogo,
    private chegadaDramatica = false,
  ) {
    const gerado = gerarMundo(jogo.assets);
    this.niveis.set(ID_MUNDO, gerado.nivel);
    this.niveis.set(ID_CASA, criarInterior(jogo.assets));
    this.nivel = gerado.nivel;

    this.jogador = new Jogador(gerado.chegadaX, gerado.chegadaY);
    this.dinosPorNivel.set(
      ID_MUNDO,
      gerado.spawns.map((s) => new Dino(s.especie, s.x, s.y)),
    );
    this.dinosPorNivel.set(ID_CASA, []);

    this.inventario.guardar({
      id: 'lanca-de-pedra',
      nome: 'Lança de pedra',
      icone: jogo.assets.ui.iconeLanca,
      quantidade: 1,
      descricao: 'A ferramenta que sobrou da mochila. Serve de arma.',
    });
    this.inventario.guardar({
      id: 'diario',
      nome: 'Diário de bordo',
      icone: jogo.assets.ui.iconeDiario,
      quantidade: 1,
      descricao: 'As missões vão chegar por aqui.',
    });

    this.painelPausa = desenharPainel(212, 152);
    this.painelGrande = desenharPainel(420, 234);

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

    this.montarMenus();
  }

  private get dinos(): Dino[] {
    return this.dinosPorNivel.get(this.nivel.id) ?? [];
  }

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
    // importação tardia evita dependência circular entre as cenas
    void import('./menu').then(({ CenaMenu }) => {
      this.jogo.trocarCena(new CenaMenu(this.jogo));
    });
  }

  entrar(): void {
    this.camera.definirLimites(this.nivel.larguraPx, this.nivel.alturaPx);
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.hud.mostrarLocal(this.nivel.nome);
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
      this.hud.avisar('Use WASD para andar e o BOTÃO DIREITO para atacar.', 8);
      this.hud.avisar('A casa que você construiu está logo ali. Aperte E na porta.', 10);
      window.setTimeout(() => this.jogo.audio.rugido(true), 1400);
    }
  }

  // ------------------------------------------------------------ atualização

  atualizar(dt: number): void {
    const entrada = this.jogo.entrada;
    this.hud.atualizar(dt);
    this.tempoDoDia.atualizar(dt);

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

    // ---- morte: o mundo congela, mas os timers do fim de jogo continuam
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

    // ---- seleção de itens (1..0)
    for (let i = 0; i < 9; i++) {
      if (entrada.teclaAgora(`Digit${i + 1}`)) this.inventario.selecionar(i);
    }
    if (entrada.teclaAgora('Digit0')) this.inventario.selecionar(9);

    this.tempoJogo += dt;
    this.mundo.nivel = this.nivel;
    this.mundo.tempo = this.tempoJogo;
    this.mundo.dinos = this.dinos;

    // ---- entidades
    this.jogador.atualizar(dt, entrada, this.mundo);
    for (const d of this.dinos) d.atualizar(dt, this.mundo);
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      this.projeteis[i].atualizar(dt, this.mundo);
      if (!this.projeteis[i].vivo) this.projeteis.splice(i, 1);
    }
    this.particulas.atualizar(dt);

    // ---- portais (porta da casa)
    this.dicaAtual = null;
    if (!this.transicao) {
      const corpo = {
        x: this.jogador.x - 5,
        y: this.jogador.y - 4,
        w: 10,
        h: 8,
      };
      for (const portal of this.nivel.portais) {
        if (!rectsOverlap(corpo, portal.area)) continue;
        const tela = {
          x: this.jogador.x - this.camera.desenhoX,
          y: this.jogador.y - 46 - this.camera.desenhoY,
        };
        this.dicaAtual = { rotulo: portal.rotulo, x: tela.x, y: tela.y };
        if (entrada.teclaAgora('KeyE')) {
          this.jogo.audio.portal();
          this.transicao = {
            t: 0,
            fase: 'saindo',
            acao: () => this.irPara(portal.destino),
          };
        }
        break;
      }
    }

    // ---- câmera
    this.camera.seguir(this.jogador.centroX, this.jogador.centroY, dt, 7);
    this.camera.atualizar(dt);
  }

  private irPara(destino: string): void {
    const alvo = this.niveis.get(destino);
    if (!alvo) return;
    this.nivel = alvo;
    this.mundo.nivel = alvo;
    this.mundo.dinos = this.dinos;
    this.projeteis.length = 0;
    this.camera.definirLimites(alvo.larguraPx, alvo.alturaPx);

    if (destino === ID_CASA) {
      this.jogador.reposicionar(alvo.entradaX, alvo.entradaY);
    } else {
      // sai da casa pela porta da frente
      this.jogador.reposicionar(
        CASA_MUNDO_X + CASA_PORTA.x + CASA_PORTA.w / 2,
        CASA_MUNDO_Y + CASA_H + 8,
      );
    }
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.hud.mostrarLocal(alvo.nome);
  }

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
      CASA_MUNDO_X + CASA_PORTA.x + CASA_PORTA.w / 2,
      CASA_MUNDO_Y + CASA_H + 14,
    );
    this.camera.focar(this.jogador.centroX, this.jogador.centroY);
    this.particulas.limpar();
    this.projeteis.length = 0;
    for (const d of this.dinos) {
      // os dinossauros voltam para os seus territórios
      d.x = d.nascimentoX;
      d.y = d.nascimentoY;
    }
    this.hud.avisar('Você acorda na porta de casa, tonto mas vivo.', 4);
  }

  // ---------------------------------------------------------------- desenho

  desenhar(g: CanvasRenderingContext2D): void {
    const camX = this.camera.desenhoX;
    const camY = this.camera.desenhoY;

    desenharTerreno(g, this.nivel, this.jogo.assets, camX, camY, this.tempoJogo);

    // lista ordenada por profundidade
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
    lista.push({ base: this.jogador.y, tipo: 'jogador' });
    lista.sort((a, b) => a.base - b.base);

    for (const item of lista) {
      if (item.tipo === 'objeto') desenharObjeto(g, item.o, camX, camY, this.tempoJogo);
      else if (item.tipo === 'dino') item.d.desenhar(g, this.mundo, camX, camY);
      else this.jogador.desenhar(g, this.mundo, camX, camY);
    }

    for (const p of this.projeteis) p.desenhar(g, this.mundo, camX, camY);
    this.particulas.desenhar(g, camX, camY);

    // lampião da casa e chamas da lareira brilham por cima
    this.desenharLuzes(g, camX, camY);

    // tinta ambiente (ciclo dia/noite — desativado nesta versão)
    const amb = this.tempoDoDia.ambiente();
    if (amb) {
      g.globalAlpha = amb.alpha;
      g.fillStyle = amb.cor;
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    g.drawImage(this.jogo.assets.vinheta, 0, 0);

    // ---- interface
    this.hud.desenhar(g, this.jogo.assets, this.jogador, this.inventario);
    if (this.dicaAtual) {
      this.hud.desenharDicaInteracao(g, this.dicaAtual.rotulo, this.dicaAtual.x, this.dicaAtual.y);
    }

    if (this.transicao) {
      const t = clamp(this.transicao.t / 0.22, 0, 1);
      g.globalAlpha = this.transicao.fase === 'saindo' ? t : 1 - t;
      g.fillStyle = '#07060c';
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    if (this.pausado) this.desenharPausa(g);
    if (!this.jogador.vivo) this.desenharMorte(g);
    if (this.bestiario) this.desenharBestiario(g);

    if (this.jogo.entrada.mouseNaTela && !this.pausado && !this.bestiario) {
      this.hud.desenharCursor(
        g,
        this.jogo.assets,
        this.jogo.entrada.mouseX,
        this.jogo.entrada.mouseY,
        this.jogador.podeAtacar,
      );
    }
  }

  /** Halos de lampião/lareira e as chamas animadas, por cima da cena. */
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
    texto(g, 'TAB abre o bestiário · M liga/desliga o som', LARGURA / 2, 236, {
      cor: '#8b83a3',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
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
