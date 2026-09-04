/**
 * Interface do jogo: corações, barra de itens, avisos e cursor.
 * Tudo desenhado no canvas, em pixel art, sem elementos de HTML.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto, larguraTexto, ALTURA_LINHA } from '../gfx/font';
import { P } from '../gfx/palette';
import { desenharPainel } from '../gfx/sprites/ui';
import type { Assets } from '../gfx/assets';
import type { Jogador } from '../entities/player';
import type { Inventario } from './inventory';
import type { Sprite } from '../gfx/pixel';
import { METADES_POR_CORACAO } from '../systems/health';
import { clamp } from '../core/math';

interface Aviso {
  txt: string;
  tempo: number;
  duracao: number;
}

export class HUD {
  private avisos: Aviso[] = [];
  private tituloLocal = '';
  private tempoTitulo = 0;
  private painelDica: Sprite | null = null;
  private tempo = 0;
  /** O lembrete de controles aparece só nos primeiros segundos de jogo. */
  private tempoLembrete = 0;

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
    for (let i = 0; i < total; i++) {
      const metadesRestantes = jogador.vida.metades - i * METADES_POR_CORACAO;
      const s =
        metadesRestantes >= 2
          ? assets.ui.coracaoCheio
          : metadesRestantes === 1
            ? assets.ui.coracaoMeio
            : assets.ui.coracaoVazio;
      // corações cheios pulsam de leve quando a vida está baixa
      const critico = jogador.vida.coracoes <= 1.5 && metadesRestantes > 0;
      const salto = critico ? (Math.sin(this.tempo * 8 + i) > 0.6 ? -1 : 0) : 0;
      g.drawImage(s, x0 + i * 9, y0 + salto);
    }

    // progresso da próxima regeneração
    if (!jogador.vida.cheio && jogador.vivo) {
      const larg = total * 9 - 1;
      const prog = jogador.vida.progressoRegeneracao;
      g.fillStyle = P.contorno;
      g.fillRect(x0, y0 + 9, larg, 3);
      g.fillStyle = jogador.fome.comFome ? '#5a4a3a' : P.coracaoVazio;
      g.fillRect(x0 + 1, y0 + 10, larg - 2, 1);
      if (!jogador.fome.comFome) {
        g.fillStyle = P.coracaoLuz;
        g.fillRect(x0 + 1, y0 + 10, Math.round((larg - 2) * prog), 1);
      }
    }
  }

  private desenharFome(g: CanvasRenderingContext2D, assets: Assets, jogador: Jogador): void {
    if (!jogador.fome.ativa) return; // mecânica prevista para a próxima versão
    const x0 = 7;
    const y0 = 20;
    g.drawImage(assets.ui.iconeFome, x0, y0);
    const larg = 34;
    g.fillStyle = P.contorno;
    g.fillRect(x0 + 10, y0 + 2, larg, 5);
    g.fillStyle = '#3a2b22';
    g.fillRect(x0 + 11, y0 + 3, larg - 2, 3);
    g.fillStyle = jogador.fome.comFome ? P.coracao : P.fome;
    g.fillRect(x0 + 11, y0 + 3, Math.round((larg - 2) * (jogador.fome.valor / 100)), 3);
  }

  // ------------------------------------------------------- barra de itens

  private desenharInventario(
    g: CanvasRenderingContext2D,
    assets: Assets,
    inventario: Inventario,
  ): void {
    const slots = inventario.slots.length;
    const passo = 21;
    const larg = slots * passo - 1;
    const x0 = Math.round((LARGURA - larg) / 2);
    const y0 = ALTURA - 24;
    for (let i = 0; i < slots; i++) {
      const sel = i === inventario.selecionado;
      const x = x0 + i * passo;
      g.drawImage(sel ? assets.ui.slotSelecionado : assets.ui.slot, x, sel ? y0 - 1 : y0);
      const item = inventario.slots[i];
      if (item?.icone) {
        g.drawImage(
          item.icone,
          x + 10 - (item.icone.width >> 1),
          (sel ? y0 - 1 : y0) + 10 - (item.icone.height >> 1),
        );
      }
      if (item && item.quantidade > 1) {
        texto(g, String(item.quantidade), x + 17, (sel ? y0 - 1 : y0) + 11, {
          cor: P.osso,
          sombra: P.contorno,
          contorno: true,
          alinhamento: 'direita',
        });
      }
      // número do espaço
      texto(g, i === 9 ? '0' : String(i + 1), x + 3, (sel ? y0 - 1 : y0) - 7, {
        cor: sel ? P.ambar : '#6b6280',
        sombra: P.contorno,
      });
    }

    const item = inventario.itemSelecionado;
    if (item) {
      texto(g, item.nome, LARGURA / 2, y0 - 17, {
        cor: P.osso,
        sombra: P.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
    }
  }

  // ---------------------------------------------------------------- avisos

  private desenharAvisos(g: CanvasRenderingContext2D): void {
    let y = ALTURA - 52;
    for (let i = this.avisos.length - 1; i >= 0; i--) {
      const a = this.avisos[i];
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
    const alpha = t < 0.5 ? t / 0.5 : t > 3 ? clamp((4 - t) / 1, 0, 1) : 1;
    g.globalAlpha = alpha;
    const larg = larguraTexto(this.tituloLocal) + 24;
    if (!this.painelDica || this.painelDica.width !== larg) {
      this.painelDica = desenharPainel(larg, 20);
    }
    g.drawImage(this.painelDica, Math.round((LARGURA - larg) / 2), 26);
    texto(g, this.tituloLocal, LARGURA / 2, 32, {
      cor: P.ambar,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    g.globalAlpha = 1;
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

  desenharCursor(
    g: CanvasRenderingContext2D,
    assets: Assets,
    x: number,
    y: number,
    pronto: boolean,
  ): void {
    const s = pronto ? assets.ui.cursorPronto : assets.ui.cursor;
    g.drawImage(s, Math.round(x) - (s.width >> 1), Math.round(y) - (s.height >> 1));
  }

  desenhar(
    g: CanvasRenderingContext2D,
    assets: Assets,
    jogador: Jogador,
    inventario: Inventario,
  ): void {
    this.desenharCoracoes(g, assets, jogador);
    this.desenharFome(g, assets, jogador);
    this.desenharInventario(g, assets, inventario);
    this.desenharAvisos(g);
    this.desenharTituloLocal(g);

    // lembrete de controles: aparece no começo e depois sai de cena
    if (this.tempoLembrete < 24) {
      g.globalAlpha = this.tempoLembrete > 21 ? (24 - this.tempoLembrete) / 3 : 1;
      this.faixa(
        g,
        'WASD mover · BOTÃO DIREITO atacar · E interagir · ESC pausar',
        LARGURA - 6,
        8,
        'direita',
        '#c9b48c',
      );
      g.globalAlpha = 1;
    }
  }
}
