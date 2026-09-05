/**
 * Interface de jogo — deliberadamente pequena.
 *
 * Na tela ficam só o essencial: corações, barra de corrida, relógio, dinheiro,
 * a barra de acesso rápido e um aviso por vez. Todo o resto (bolsa completa,
 * bestiário, armadura, controles) mora no menu do TAB e na pausa.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto, larguraTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Jogador } from '../entities/player';
import type { Inventario } from '../systems/items';
import type { Progresso } from '../systems/progression';
import type { Carteira } from '../systems/economy';
import { formatarMoedas } from '../systems/economy';
import { iconeDoItem, nomeDoItem } from './itens';
import { METADES_POR_CORACAO } from '../systems/health';
import { clamp } from '../core/math';

interface Aviso {
  txt: string;
  tempo: number;
  duracao: number;
}

export interface DadosHUD {
  jogador: Jogador;
  inventario: Inventario;
  progresso: Progresso;
  carteira: Carteira;
  /** Hora do relógio do jogo ("07:30"). */
  hora: string;
  /** Nome do período do dia ("manhã", "noite"...). */
  periodo: string;
  /** Nome do alvo em foco da ferramenta (aparece junto ao item na mão). */
  alvo?: string | null;
  /** Páginas do diário ainda não lidas (marcador discreto no canto). */
  diarioNovo?: number;
}

export class HUD {
  private avisos: Aviso[] = [];
  private tituloLocal = '';
  private tempoTitulo = 99;
  private tempo = 0;
  private tempoLembrete = 0;
  private destaqueMoeda = 0;
  private moedasAnterior = -1;

  avisar(txt: string, duracao = 2.6): void {
    // o mesmo aviso repetido só renova o tempo: nada de duas linhas iguais
    const igual = this.avisos.find((a) => a.txt === txt);
    if (igual) {
      igual.tempo = 0;
      igual.duracao = Math.max(igual.duracao, duracao);
      return;
    }
    this.avisos.push({ txt, tempo: 0, duracao });
    if (this.avisos.length > 2) this.avisos.shift();
  }

  mostrarLocal(nome: string): void {
    this.tituloLocal = nome;
    this.tempoTitulo = 0;
  }

  atualizar(dt: number): void {
    this.tempo += dt;
    this.tempoLembrete += dt;
    this.tempoTitulo += dt;
    if (this.destaqueMoeda > 0) this.destaqueMoeda -= dt;
    for (let i = this.avisos.length - 1; i >= 0; i--) {
      this.avisos[i].tempo += dt;
      if (this.avisos[i].tempo >= this.avisos[i].duracao) this.avisos.splice(i, 1);
    }
  }

  /** Texto sobre uma faixa escura — legível em qualquer terreno. */
  private faixa(
    g: CanvasRenderingContext2D,
    txt: string,
    x: number,
    y: number,
    alinhamento: 'esquerda' | 'centro' | 'direita' = 'esquerda',
    cor: string = P.osso,
  ): void {
    const larg = larguraTexto(txt) + 8;
    const px =
      alinhamento === 'centro'
        ? Math.round(x - larg / 2)
        : alinhamento === 'direita'
          ? Math.round(x - larg)
          : Math.round(x);
    g.fillStyle = 'rgba(16,14,26,0.7)';
    g.fillRect(px, Math.round(y) - 3, larg, 13);
    texto(g, txt, px + 4, y, { cor, sombra: P.contorno });
  }

  // -------------------------------------------------- vida e corrida

  private desenharVida(g: CanvasRenderingContext2D, assets: Assets, jogador: Jogador): void {
    const x0 = 5;
    const y0 = 5;
    const total = jogador.vida.coracoesMax;
    for (let i = 0; i < total; i++) {
      const metades = jogador.vida.metades - i * METADES_POR_CORACAO;
      const s =
        metades >= 2
          ? assets.ui.coracaoCheio
          : metades === 1
            ? assets.ui.coracaoMeio
            : assets.ui.coracaoVazio;
      const critico = jogador.vida.coracoes <= 2 && metades > 0;
      const salto = critico ? (Math.sin(this.tempo * 8 + i) > 0.6 ? -1 : 0) : 0;
      g.drawImage(s, x0 + i * 8, y0 + salto);
    }

    // barra fina de corrida: aparece só quando não está cheia
    if (jogador.estamina < 0.999) {
      const larg = total * 8 - 2;
      const y = y0 + 9;
      g.fillStyle = P.contorno;
      g.fillRect(x0, y, larg, 3);
      g.fillStyle = '#2b3a4a';
      g.fillRect(x0 + 1, y + 1, larg - 2, 1);
      g.fillStyle = jogador.estamina < 0.15 ? P.coracao : '#7fd0ff';
      g.fillRect(x0 + 1, y + 1, Math.round((larg - 2) * jogador.estamina), 1);
    }

    // fome (mecânica prevista): barrinha discreta abaixo dos corações
    if (jogador.fome.ativa) {
      const larg = total * 8 - 2;
      const y = y0 + 13;
      g.drawImage(assets.ui.iconeFome, x0 - 1, y - 1);
      g.fillStyle = P.contorno;
      g.fillRect(x0 + 9, y, larg - 9, 3);
      g.fillStyle = jogador.fome.comFome ? P.coracao : P.fome;
      g.fillRect(x0 + 10, y + 1, Math.round((larg - 11) * (jogador.fome.valor / 100)), 1);
    }
  }

  // -------------------------------------------------- dinheiro e relógio

  private desenharCanto(g: CanvasRenderingContext2D, assets: Assets, dados: DadosHUD): void {
    const moedas = dados.carteira.moedas;
    if (this.moedasAnterior >= 0 && moedas !== this.moedasAnterior) this.destaqueMoeda = 0.8;
    this.moedasAnterior = moedas;

    const txt = `${dados.carteira.infinita ? '∞' : formatarMoedas(moedas)}  ${dados.hora}`;
    const larg = larguraTexto(txt) + 20;
    const x = LARGURA - larg - 4;
    const y = 4;
    g.fillStyle = 'rgba(16,14,26,0.7)';
    g.fillRect(x, y, larg, 13);
    g.drawImage(assets.ferramentas.moeda, x + 3, y + 2);
    texto(g, txt, x + 14, y + 3, {
      cor: this.destaqueMoeda > 0 ? P.brilho : P.ambar,
      sombra: P.contorno,
    });

    // marcador de página nova no diário: pisca de leve até o jogador abrir
    if (dados.diarioNovo) {
      const rotulo = `J: ${dados.diarioNovo} no diário`;
      const lb = larguraTexto(rotulo) + 6;
      // no modo teste o selo ocupa esta faixa: o marcador desce uma linha
      const py = y + (dados.progresso.demo ? 27 : 15);
      g.globalAlpha = 0.6 + Math.sin(this.tempo * 5) * 0.4;
      g.fillStyle = 'rgba(16,14,26,0.7)';
      g.fillRect(LARGURA - lb - 4, py, lb, 11);
      texto(g, rotulo, LARGURA - 7, py + 2, {
        cor: P.ambar,
        sombra: P.contorno,
        alinhamento: 'direita',
      });
      g.globalAlpha = 1;
    }
  }

  // -------------------------------------------------- barra de acesso rápido

  private desenharBarra(g: CanvasRenderingContext2D, assets: Assets, dados: DadosHUD): void {
    const inv = dados.inventario;
    const slots = inv.slotsRapidos;
    const passo = 19;
    const larg = slots * passo - 1;
    const x0 = Math.round((LARGURA - larg) / 2);
    const y0 = ALTURA - 20;
    for (let i = 0; i < slots; i++) {
      const sel = i === inv.selecionado;
      const x = x0 + i * passo;
      const y = sel ? y0 - 1 : y0;
      g.drawImage(sel ? assets.ui.slotSelecionado : assets.ui.slot, x, y);
      const item = inv.slots[i];
      if (!item) continue;
      const icone = iconeDoItem(assets, dados.progresso, item);
      g.drawImage(icone, x + 9 - (icone.width >> 1), y + 9 - (icone.height >> 1));
      if (item.quantidade > 1) {
        texto(g, String(item.quantidade), x + 16, y + 10, {
          cor: P.osso,
          sombra: P.contorno,
          contorno: true,
          alinhamento: 'direita',
        });
      }
    }

    const item = inv.itemSelecionado;
    if (item) {
      const nome = dados.alvo
        ? `${nomeDoItem(dados.progresso, item)} → ${dados.alvo}`
        : nomeDoItem(dados.progresso, item);
      texto(g, nome, LARGURA / 2, y0 - 11, {
        cor: dados.alvo ? P.ambar : P.osso,
        sombra: P.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
    }
  }

  // ---------------------------------------------------------------- avisos

  private desenharAvisos(g: CanvasRenderingContext2D): void {
    let y = ALTURA - 48;
    for (let i = this.avisos.length - 1; i >= 0; i--) {
      const a = this.avisos[i];
      const restante = a.duracao - a.tempo;
      g.globalAlpha = restante < 0.5 ? restante / 0.5 : 1;
      this.faixa(g, a.txt, LARGURA / 2, y, 'centro');
      g.globalAlpha = 1;
      y -= 15;
    }
  }

  private desenharTituloLocal(g: CanvasRenderingContext2D): void {
    if (this.tempoTitulo > 3 || !this.tituloLocal) return;
    const t = this.tempoTitulo;
    const alpha = t < 0.4 ? t / 0.4 : t > 2.2 ? clamp((3 - t) / 0.8, 0, 1) : 1;
    g.globalAlpha = alpha;
    this.faixa(g, this.tituloLocal, LARGURA / 2, 22, 'centro', P.ambar);
    g.globalAlpha = 1;
  }

  /** Selo do modo de teste, discreto mas sempre visível. */
  private desenharSeloDemo(g: CanvasRenderingContext2D): void {
    const txt = 'TESTE';
    const larg = larguraTexto(txt) + 8;
    const x = LARGURA - larg - 4;
    g.fillStyle = '#3a1c46';
    g.fillRect(x, 19, larg, 12);
    texto(g, txt, x + 4, 22, { cor: P.magiaClara, sombra: P.contorno });
  }

  /** Dica de interação junto ao jogador. */
  desenharDicaInteracao(
    g: CanvasRenderingContext2D,
    rotulo: string,
    telaX: number,
    telaY: number,
  ): void {
    const txt = `[E] ${rotulo}`;
    const larg = larguraTexto(txt) + 8;
    const x = clamp(Math.round(telaX - larg / 2), 4, LARGURA - larg - 4);
    const y = clamp(Math.round(telaY), 16, ALTURA - 48);
    g.fillStyle = 'rgba(22,19,32,0.82)';
    g.fillRect(x, y, larg, 12);
    g.fillStyle = P.ossoEscuro;
    g.fillRect(x, y + 11, larg, 1);
    texto(g, txt, x + 4, y + 2, { cor: P.osso, sombra: P.contorno });
  }

/**
   * Marca o alvo da ferramenta com quatro cantoneiras — sem texto sobre o
   * mundo, para não cobrir o jogador nem os bichos.
   */
  desenharAlvo(
    g: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    const pulso = Math.sin(this.tempo * 7) > 0 ? 1 : 0;
    const t = 4;
    const px = Math.round(x) - pulso;
    const py = Math.round(y) - pulso;
    const pw = Math.round(w) + pulso * 2;
    const ph = Math.round(h) + pulso * 2;
    // primeiro um contorno escuro, depois o âmbar: lê em qualquer fundo
    for (const [cor, off] of [
      [P.contorno, 1],
      [P.ambar, 0],
    ] as const) {
      g.fillStyle = cor;
      for (const [cx, cy, dx, dy] of [
        [px - off, py - off, 1, 1],
        [px + pw + off, py - off, -1, 1],
        [px - off, py + ph + off, 1, -1],
        [px + pw + off, py + ph + off, -1, -1],
      ]) {
        for (let i = 0; i < t; i++) {
          g.fillRect(cx + dx * i, cy, 1, 1);
          g.fillRect(cx, cy + dy * i, 1, 1);
        }
      }
    }
  }

  desenharCursor(
    g: CanvasRenderingContext2D,
    assets: Assets,
    x: number,
    y: number,
    pronto: boolean,
  ): void {
    const s = pronto ? assets.ui.cursorPronto : assets.ui.cursor;
    g.drawImage(s, Math.round(x) - 1, Math.round(y) - 1);
  }

  desenhar(g: CanvasRenderingContext2D, assets: Assets, dados: DadosHUD): void {
    this.desenharVida(g, assets, dados.jogador);
    this.desenharCanto(g, assets, dados);
    this.desenharBarra(g, assets, dados);
    this.desenharAvisos(g);
    this.desenharTituloLocal(g);
    if (dados.progresso.demo) this.desenharSeloDemo(g);

    // um único lembrete curto no começo da partida
    if (this.tempoLembrete < 14) {
      g.globalAlpha = this.tempoLembrete > 11 ? (14 - this.tempoLembrete) / 3 : 1;
      this.faixa(g, 'SHIFT corre · TAB mochila', 5, 19, 'esquerda', '#c9b48c');
      g.globalAlpha = 1;
    }
  }
}
