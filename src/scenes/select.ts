/**
 * Tela de escolha do personagem.
 *
 * Aparece antes de qualquer modo de jogo — expedição nova, sem cinemática e
 * modo teste. Sem escolher ninguém, o jogo não começa: o botão de confirmar só
 * acende depois que uma das quatro fichas é selecionada.
 *
 * O desenho é o mesmo traço do resto do jogo: molduras de madeira, fonte de
 * bitmap e os personagens andando em tamanho real (com um segundo painel
 * ampliado, em pixel inteiro, para dar para ver os detalhes).
 */

import type { Cena, Jogo } from '../core/game';
import { LARGURA, ALTURA } from '../core/screen';
import { texto, quebrarTexto, larguraTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import { desenharPainel } from '../gfx/sprites/ui';
import type { Sprite } from '../gfx/pixel';
import { Botao, ListaBotoes, textoGrande } from '../ui/widgets';
import { pointInRect } from '../core/math';
import { TODOS_PERSONAGENS, PERSONAGENS } from '../systems/personagens';
import { usarPersonagem } from '../gfx/assets';
import type { PersonagemId } from '../gfx/sprites/player';

/** Tamanho de cada ficha na fileira. */
const FICHA_W = 74;
const FICHA_H = 100;
const FICHA_Y = 58;

export interface OpcoesEscolha {
  /** O que fazer depois de confirmar. */
  aoConfirmar(id: PersonagemId): void;
  /** Volta para o menu. */
  aoVoltar(): void;
  /** Nome do modo, mostrado no alto ("Modo teste"). */
  modo: string;
}

export class CenaEscolha implements Cena {
  private painel: Sprite;
  private escolhido: PersonagemId | null = null;
  private foco = 0;
  private tempo = 0;
  private botoes: ListaBotoes;

  constructor(
    private jogo: Jogo,
    private opcoes: OpcoesEscolha,
  ) {
    this.painel = desenharPainel(LARGURA - 24, ALTURA - 24);
    const larg = 120;
    this.botoes = new ListaBotoes([
      new Botao(Math.round(LARGURA / 2) - larg - 6, ALTURA - 30, larg, 18, 'Voltar', () =>
        this.opcoes.aoVoltar(),
      ),
      new Botao(Math.round(LARGURA / 2) + 6, ALTURA - 30, larg, 18, 'Começar', () =>
        this.confirmar(),
      ),
    ]);
  }

  private caixa(i: number): { x: number; y: number; w: number; h: number } {
    const total = TODOS_PERSONAGENS.length;
    const vao = 6;
    const largTotal = total * FICHA_W + (total - 1) * vao;
    const x0 = Math.round((LARGURA - largTotal) / 2);
    return { x: x0 + i * (FICHA_W + vao), y: FICHA_Y, w: FICHA_W, h: FICHA_H };
  }

  private confirmar(): void {
    if (!this.escolhido) {
      this.jogo.audio.menu();
      return;
    }
    usarPersonagem(this.jogo.assets, this.escolhido);
    this.jogo.audio.confirmar();
    this.opcoes.aoConfirmar(this.escolhido);
  }

  atualizar(dt: number): void {
    this.tempo += dt;
    const e = this.jogo.entrada;

    if (e.teclaAgora('KeyA', 'ArrowLeft')) {
      this.foco = (this.foco - 1 + TODOS_PERSONAGENS.length) % TODOS_PERSONAGENS.length;
      this.jogo.audio.menu();
    }
    if (e.teclaAgora('KeyD', 'ArrowRight')) {
      this.foco = (this.foco + 1) % TODOS_PERSONAGENS.length;
      this.jogo.audio.menu();
    }
    for (let i = 0; i < TODOS_PERSONAGENS.length; i++) {
      if (e.teclaAgora(`Digit${i + 1}`)) {
        this.foco = i;
        this.escolher(i);
      }
      if (pointInRect(e.mouseX, e.mouseY, this.caixa(i))) {
        this.foco = i;
        if (e.botaoAgora(0)) this.escolher(i);
      }
    }
    if (e.teclaAgora('Enter', 'NumpadEnter', 'Space')) {
      if (this.escolhido === TODOS_PERSONAGENS[this.foco].id) this.confirmar();
      else this.escolher(this.foco);
    }
    if (e.teclaAgora('Escape')) this.opcoes.aoVoltar();

    this.botoes.atualizar(
      e,
      () => this.jogo.audio.menu(),
      () => this.jogo.audio.confirmar(),
    );
  }

  private escolher(i: number): void {
    this.escolhido = TODOS_PERSONAGENS[i].id;
    this.jogo.audio.confirmar();
  }

  desenhar(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#0b0a12';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.drawImage(this.painel, 12, 12);

    textoGrande(g, 'QUEM VAI ENTRAR NA MÁQUINA?', LARGURA / 2, 24, 1, {
      cor: P.ambar,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    texto(g, this.opcoes.modo, LARGURA / 2, 38, {
      cor: '#8b83a3',
      sombra: P.contorno,
      alinhamento: 'centro',
    });

    const quadro = Math.floor(this.tempo * 5) % 3;
    TODOS_PERSONAGENS.forEach((f, i) => {
      const r = this.caixa(i);
      const focado = i === this.foco;
      const marcado = this.escolhido === f.id;

      g.fillStyle = marcado ? '#2a2338' : '#161225';
      g.fillRect(r.x, r.y, r.w, r.h);
      // moldura: âmbar quando escolhido, clara quando o foco está em cima
      g.fillStyle = marcado ? P.ambar : focado ? P.osso : '#3a2f49';
      g.fillRect(r.x, r.y, r.w, 1);
      g.fillRect(r.x, r.y + r.h - 1, r.w, 1);
      g.fillRect(r.x, r.y, 1, r.h);
      g.fillRect(r.x + r.w - 1, r.y, 1, r.h);
      // faixa da cor da roupa, no alto da ficha
      g.fillStyle = f.cor;
      g.fillRect(r.x + 1, r.y + 1, r.w - 2, 2);

      // o personagem andando, ampliado em pixel inteiro (x3)
      const quadros = this.jogo.assets.personagens[f.id];
      const s = focado || marcado ? quadros.baixo[quadro] : quadros.baixo[0];
      const escala = 3;
      g.drawImage(
        s,
        Math.round(r.x + r.w / 2 - (s.width * escala) / 2),
        r.y + 8,
        s.width * escala,
        s.height * escala,
      );

      // e o mesmo personagem em tamanho de jogo, de costas e de lado
      const lateral = focado || marcado ? quadros.direita[quadro] : quadros.direita[0];
      g.drawImage(quadros.cima[0], r.x + 8, r.y + 58);
      g.drawImage(lateral, r.x + r.w - 26, r.y + 58);

      texto(g, f.nome, r.x + r.w / 2, r.y + r.h - 20, {
        cor: marcado ? P.ambar : P.osso,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      texto(g, f.genero, r.x + r.w / 2, r.y + r.h - 10, {
        cor: '#7a7391',
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      texto(g, String(i + 1), r.x + 4, r.y + 5, { cor: '#5b5470', sombra: P.contorno });
      if (marcado) {
        texto(g, '●', r.x + r.w - 9, r.y + 5, { cor: P.ambar, sombra: P.contorno });
      }
    });

    // ---- linha de apresentação de quem está em foco
    const f = TODOS_PERSONAGENS[this.foco];
    const linhas = quebrarTexto(f.descricao, LARGURA - 60);
    texto(g, PERSONAGENS[f.id].nome, LARGURA / 2, FICHA_Y + FICHA_H + 6, {
      cor: f.cor,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    texto(g, linhas[0] ?? '', LARGURA / 2, FICHA_Y + FICHA_H + 16, {
      cor: '#a89fbe',
      sombra: P.contorno,
      alinhamento: 'centro',
    });

    // ---- aviso enquanto ninguém foi escolhido
    if (!this.escolhido) {
      const aviso = 'Escolha um personagem para começar.';
      const lb = larguraTexto(aviso) + 10;
      g.globalAlpha = 0.6 + Math.sin(this.tempo * 4) * 0.4;
      g.fillStyle = 'rgba(16,14,26,0.8)';
      g.fillRect(Math.round((LARGURA - lb) / 2), ALTURA - 48, lb, 12);
      texto(g, aviso, LARGURA / 2, ALTURA - 45, {
        cor: P.ambar,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      g.globalAlpha = 1;
    }

    this.botoes.desenhar(g);
    // o botão de começar fica apagado até haver escolha
    if (!this.escolhido) {
      g.globalAlpha = 0.45;
      g.fillStyle = '#0b0a12';
      g.fillRect(Math.round(LARGURA / 2) + 6, ALTURA - 30, 120, 18);
      g.globalAlpha = 1;
    }

    texto(g, '1-4 ou clique escolhe · ENTER começa · ESC volta', LARGURA / 2, ALTURA - 10, {
      cor: '#6f6789',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
  }
}
