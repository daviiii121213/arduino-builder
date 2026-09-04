/**
 * Interface do jogo: corações, dinheiro, relógio, barra de itens, avisos e
 * cursor. Tudo desenhado no canvas, em pixel art.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto, larguraTexto, ALTURA_LINHA } from '../gfx/font';
import { P } from '../gfx/palette';
import { desenharPainel } from '../gfx/sprites/ui';
import type { Assets } from '../gfx/assets';
import type { Jogador } from '../entities/player';
import type { Inventario } from '../systems/items';
import type { Progresso } from '../systems/progression';
import type { Carteira } from '../systems/economy';
import { formatarMoedas } from '../systems/economy';
import { iconeDoItem, nomeDoItem } from './itens';
import type { Sprite } from '../gfx/pixel';
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
}

export class HUD {
  private avisos: Aviso[] = [];
  private tituloLocal = '';
  private tempoTitulo = 0;
  private painelDica: Sprite | null = null;
  private tempo = 0;
  /** O lembrete de controles aparece só nos primeiros segundos de jogo. */
  private tempoLembrete = 0;
  /** Brilho no dinheiro quando o saldo muda. */
  private destaqueMoeda = 0;
  private moedasAnterior = -1;

  avisar(txt: string, duracao = 3): void {
    this.avisos.push({ txt, tempo: 0, duracao });
    if (this.avisos.length > 3) this.avisos.shift();
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
    g.fillStyle = 'rgba(16,14,26,0.72)';
    g.fillRect(px, Math.round(y) - 3, larg, 13);
    g.fillStyle = 'rgba(201,180,140,0.35)';
    g.fillRect(px, Math.round(y) - 3, larg, 1);
    g.fillRect(px, Math.round(y) + 9, larg, 1);
    texto(g, txt, px + 4, y, { cor, sombra: P.contorno });
  }

  // ------------------------------------------------------------- corações

  private desenharCoracoes(g: CanvasRenderingContext2D, assets: Assets, jogador: Jogador): void {
    const x0 = 7;
    const y0 = 7;
    const total = jogador.vida.coracoesMax;
    // dez corações em duas fileiras de cinco
    const porFileira = 5;
    for (let i = 0; i < total; i++) {
      const metadesRestantes = jogador.vida.metades - i * METADES_POR_CORACAO;
      const s =
        metadesRestantes >= 2
          ? assets.ui.coracaoCheio
          : metadesRestantes === 1
            ? assets.ui.coracaoMeio
            : assets.ui.coracaoVazio;
      const critico = jogador.vida.coracoes <= 2 && metadesRestantes > 0;
      const salto = critico ? (Math.sin(this.tempo * 8 + i) > 0.6 ? -1 : 0) : 0;
      const col = i % porFileira;
      const fila = Math.floor(i / porFileira);
      g.drawImage(s, x0 + col * 9, y0 + fila * 9 + salto);
    }

    // progresso da próxima regeneração, abaixo das fileiras
    const filas = Math.ceil(total / porFileira);
    if (!jogador.vida.cheio && jogador.vivo) {
      const larg = porFileira * 9 - 1;
      const y = y0 + filas * 9;
      const prog = jogador.vida.progressoRegeneracao;
      g.fillStyle = P.contorno;
      g.fillRect(x0, y, larg, 3);
      g.fillStyle = jogador.fome.comFome ? '#5a4a3a' : P.coracaoVazio;
      g.fillRect(x0 + 1, y + 1, larg - 2, 1);
      if (!jogador.fome.comFome) {
        g.fillStyle = P.coracaoLuz;
        g.fillRect(x0 + 1, y + 1, Math.round((larg - 2) * prog), 1);
      }
    }
  }

  private desenharFome(g: CanvasRenderingContext2D, assets: Assets, jogador: Jogador): void {
    if (!jogador.fome.ativa) return; // mecânica prevista para a próxima versão
    const x0 = 7;
    const y0 = 30;
    g.drawImage(assets.ui.iconeFome, x0, y0);
    const larg = 34;
    g.fillStyle = P.contorno;
    g.fillRect(x0 + 10, y0 + 2, larg, 5);
    g.fillStyle = '#3a2b22';
    g.fillRect(x0 + 11, y0 + 3, larg - 2, 3);
    g.fillStyle = jogador.fome.comFome ? P.coracao : P.fome;
    g.fillRect(x0 + 11, y0 + 3, Math.round((larg - 2) * (jogador.fome.valor / 100)), 3);
  }

  // ------------------------------------------------- dinheiro e relógio

  private desenharDinheiro(
    g: CanvasRenderingContext2D,
    assets: Assets,
    dados: DadosHUD,
  ): void {
    const moedas = dados.carteira.moedas;
    if (this.moedasAnterior >= 0 && moedas !== this.moedasAnterior) this.destaqueMoeda = 0.8;
    this.moedasAnterior = moedas;

    const txt = dados.carteira.infinita ? '∞' : formatarMoedas(moedas);
    const larg = larguraTexto(txt) + 22;
    const x = LARGURA - larg - 6;
    const y = 6;
    g.fillStyle = 'rgba(16,14,26,0.78)';
    g.fillRect(x, y, larg, 14);
    g.fillStyle = this.destaqueMoeda > 0 ? P.ambar : 'rgba(201,180,140,0.4)';
    g.fillRect(x, y, larg, 1);
    g.fillRect(x, y + 13, larg, 1);
    g.drawImage(assets.ferramentas.moeda, x + 4, y + 3);
    texto(g, txt, x + 16, y + 4, {
      cor: this.destaqueMoeda > 0 ? P.brilho : P.ambar,
      sombra: P.contorno,
    });

    // relógio do ciclo de dia e noite
    const relogio = `${dados.hora} · ${dados.periodo}`;
    const largR = larguraTexto(relogio) + 8;
    const xr = LARGURA - largR - 6;
    g.fillStyle = 'rgba(16,14,26,0.7)';
    g.fillRect(xr, y + 16, largR, 13);
    texto(g, relogio, xr + 4, y + 19, { cor: '#c9b48c', sombra: P.contorno });
  }

  // ------------------------------------------------------- barra de itens

  private desenharInventario(
    g: CanvasRenderingContext2D,
    assets: Assets,
    dados: DadosHUD,
  ): void {
    const inv = dados.inventario;
    const slots = inv.total;
    const passo = 21;
    const larg = slots * passo - 1;
    const x0 = Math.round((LARGURA - larg) / 2);
    const y0 = ALTURA - 24;
    for (let i = 0; i < slots; i++) {
      const sel = i === inv.selecionado;
      const trancado = i >= inv.liberados;
      const x = x0 + i * passo;
      const y = sel ? y0 - 1 : y0;
      g.drawImage(sel ? assets.ui.slotSelecionado : assets.ui.slot, x, y);

      if (trancado) {
        g.globalAlpha = 0.74;
        g.fillStyle = '#12101c';
        g.fillRect(x + 2, y + 2, 16, 16);
        g.globalAlpha = 1;
        // cadeado: sinal de que a melhoria de bolsa ainda não foi comprada
        g.fillStyle = P.ossoEscuro;
        g.fillRect(x + 8, y + 6, 4, 2);
        g.fillRect(x + 7, y + 8, 6, 5);
        g.fillStyle = P.contorno;
        g.fillRect(x + 9, y + 10, 2, 2);
        continue;
      }

      const item = inv.slots[i];
      if (item) {
        const icone = iconeDoItem(assets, dados.progresso, item);
        g.drawImage(icone, x + 10 - (icone.width >> 1), y + 10 - (icone.height >> 1));
        if (item.quantidade > 1) {
          texto(g, String(item.quantidade), x + 18, y + 11, {
            cor: P.osso,
            sombra: P.contorno,
            contorno: true,
            alinhamento: 'direita',
          });
        }
      }
      texto(g, i === 9 ? '0' : String(i + 1), x + 3, y - 7, {
        cor: sel ? P.ambar : '#6b6280',
        sombra: P.contorno,
      });
    }

    const item = inv.itemSelecionado;
    if (item) {
      texto(g, nomeDoItem(dados.progresso, item), LARGURA / 2, y0 - 17, {
        cor: P.osso,
        sombra: P.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
    }
  }

  // ---------------------------------------------------------------- avisos

  private desenharAvisos(g: CanvasRenderingContext2D): void {
    let y = ALTURA - 56;
    // no máximo dois avisos ao mesmo tempo: o rodapé já é disputado
    const visiveis = this.avisos.slice(-2);
    for (let i = visiveis.length - 1; i >= 0; i--) {
      const a = visiveis[i];
      const restante = a.duracao - a.tempo;
      g.globalAlpha = restante < 0.6 ? restante / 0.6 : 1;
      this.faixa(g, a.txt, LARGURA / 2, y, 'centro');
      g.globalAlpha = 1;
      y -= ALTURA_LINHA + 5;
    }
  }

  private desenharTituloLocal(g: CanvasRenderingContext2D): void {
    if (this.tempoTitulo > 4 || !this.tituloLocal) return;
    const t = this.tempoTitulo;
    const alpha = t < 0.5 ? t / 0.5 : t > 3 ? clamp(4 - t, 0, 1) : 1;
    g.globalAlpha = alpha;
    const larg = larguraTexto(this.tituloLocal) + 24;
    if (!this.painelDica || this.painelDica.width !== larg) {
      this.painelDica = desenharPainel(larg, 20);
    }
    g.drawImage(this.painelDica, Math.round((LARGURA - larg) / 2), 34);
    texto(g, this.tituloLocal, LARGURA / 2, 40, {
      cor: P.ambar,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    g.globalAlpha = 1;
  }

  /** Selo do modo de teste, sempre visível para não confundir com o jogo normal. */
  private desenharSeloDemo(g: CanvasRenderingContext2D): void {
    const txt = 'MODO TESTE';
    const larg = larguraTexto(txt) + 10;
    const x = Math.round((LARGURA - larg) / 2);
    g.fillStyle = '#3a1c46';
    g.fillRect(x, 0, larg, 12);
    g.fillStyle = P.magiaClara;
    g.fillRect(x, 11, larg, 1);
    texto(g, txt, x + 5, 2, { cor: P.magiaClara, sombra: P.contorno });
  }

  /** Dica de interação junto ao jogador (ex.: entrar em casa). */
  desenharDicaInteracao(
    g: CanvasRenderingContext2D,
    rotulo: string,
    telaX: number,
    telaY: number,
  ): void {
    const txt = `[E] ${rotulo}`;
    const larg = larguraTexto(txt) + 10;
    const x = clamp(Math.round(telaX - larg / 2), 4, LARGURA - larg - 4);
    const y = clamp(Math.round(telaY), 20, ALTURA - 66);
    g.fillStyle = 'rgba(22,19,32,0.85)';
    g.fillRect(x, y, larg, 13);
    g.fillStyle = P.ossoEscuro;
    g.fillRect(x, y, larg, 1);
    g.fillRect(x, y + 12, larg, 1);
    texto(g, txt, x + 5, y + 3, { cor: P.osso, sombra: P.contorno });
  }

  /** Dica de uso da ferramenta, junto ao alvo. */
  desenharDicaFerramenta(
    g: CanvasRenderingContext2D,
    rotulo: string,
    telaX: number,
    telaY: number,
  ): void {
    const larg = larguraTexto(rotulo) + 10;
    const x = clamp(Math.round(telaX - larg / 2), 4, LARGURA - larg - 4);
    const y = clamp(Math.round(telaY), 16, ALTURA - 70);
    g.fillStyle = 'rgba(22,19,32,0.8)';
    g.fillRect(x, y, larg, 12);
    texto(g, rotulo, x + 5, y + 2, { cor: P.ambar, sombra: P.contorno });
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
    this.desenharCoracoes(g, assets, dados.jogador);
    this.desenharFome(g, assets, dados.jogador);
    this.desenharDinheiro(g, assets, dados);
    this.desenharInventario(g, assets, dados);
    this.desenharAvisos(g);
    this.desenharTituloLocal(g);
    if (dados.progresso.demo) this.desenharSeloDemo(g);

    // lembrete de controles: no canto de cima, longe do rodapé
    if (this.tempoLembrete < 30) {
      g.globalAlpha = this.tempoLembrete > 27 ? (30 - this.tempoLembrete) / 3 : 1;
      this.faixa(g, 'ESQUERDO: ferramenta', 7, 34, 'esquerda', '#c9b48c');
      this.faixa(g, 'DIREITO: golpe em área', 7, 48, 'esquerda', '#c9b48c');
      this.faixa(g, 'E: interagir · TAB: bestiário', 7, 62, 'esquerda', '#c9b48c');
      g.globalAlpha = 1;
    }
  }
}
