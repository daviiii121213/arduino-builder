/**
 * Painel do modo de teste.
 *
 * Reúne num só lugar um atalho para cada sistema do jogo, para conferir tudo
 * sem precisar atravessar o vale a pé. Só existe no modo de teste — o jogo
 * normal nunca abre esta janela.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Entrada } from '../core/input';
import { cabecalho, destaque, linhaDoMouse, moldura, navegar, rodape } from './painel';

export interface AcaoTeste {
  rotulo: string;
  /** Grupo mostrado na coluna da direita. */
  grupo: string;
  executar: () => void;
}

const LARG = 300;
const ALTURA_LINHA = 14;
/** Linhas visíveis de uma vez: o painel rola em vez de estourar a tela. */
const LINHAS = 14;

export class PainelTestes {
  aberta = false;
  private indice = 0;
  private topo = 0;

  constructor(private acoes: AcaoTeste[]) {}

  abrir(): void {
    this.aberta = true;
    this.indice = 0;
    this.topo = 0;
  }

  fechar(): void {
    this.aberta = false;
  }

  private get visiveis(): number {
    return Math.min(LINHAS, this.acoes.length);
  }

  private get altura(): number {
    return 34 + this.visiveis * ALTURA_LINHA + 24;
  }

  atualizar(_dt: number, entrada: Entrada): void {
    if (!this.aberta) return;
    if (entrada.teclaAgora('F1', 'Escape')) {
      this.fechar();
      return;
    }
    const total = this.acoes.length;
    this.indice = navegar(entrada, this.indice, total);
    const x = Math.round((LARGURA - LARG) / 2);
    const y = Math.round((ALTURA - this.altura) / 2);
    const sobre = linhaDoMouse(entrada, x + 8, y + 26, LARG - 16, ALTURA_LINHA, this.visiveis);
    if (sobre >= 0 && this.topo + sobre < total) this.indice = this.topo + sobre;
    // mantém o escolhido dentro da janela visível
    if (this.indice < this.topo) this.topo = this.indice;
    if (this.indice > this.topo + this.visiveis - 1) this.topo = this.indice - this.visiveis + 1;
    this.topo = Math.max(0, Math.min(this.topo, total - this.visiveis));
    if (
      entrada.teclaAgora('Enter', 'NumpadEnter', 'Space') ||
      (entrada.botaoAgora(0) && sobre >= 0 && this.topo + sobre === this.indice)
    ) {
      const acao = this.acoes[this.indice];
      this.fechar();
      acao.executar();
    }
  }

  desenhar(g: CanvasRenderingContext2D): void {
    if (!this.aberta) return;
    g.globalAlpha = 0.8;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;
    const alt = this.altura;
    const x = Math.round((LARGURA - LARG) / 2);
    const y = Math.round((ALTURA - alt) / 2);
    g.drawImage(moldura(LARG, alt), x, y);
    cabecalho(g, 'MODO TESTE — ATALHOS', x, y, LARG);

    for (let linha = 0; linha < this.visiveis; linha++) {
      const i = this.topo + linha;
      const a = this.acoes[i];
      if (!a) break;
      const ly = y + 26 + linha * ALTURA_LINHA;
      if (i === this.indice) destaque(g, x + 8, ly, LARG - 16, ALTURA_LINHA);
      texto(g, a.rotulo, x + 14, ly + 3, {
        cor: i === this.indice ? P.brilho : P.osso,
        sombra: P.contorno,
      });
      texto(g, a.grupo, x + LARG - 14, ly + 3, {
        cor: '#7a7391',
        sombra: P.contorno,
        alinhamento: 'direita',
      });
    }
    // barrinha de rolagem, quando há mais atalhos do que cabe
    if (this.acoes.length > this.visiveis) {
      const trilho = this.visiveis * ALTURA_LINHA;
      g.fillStyle = '#2a2338';
      g.fillRect(x + LARG - 6, y + 26, 2, trilho);
      const tam = Math.max(8, Math.round((this.visiveis / this.acoes.length) * trilho));
      const desl = Math.round(
        (this.topo / Math.max(1, this.acoes.length - this.visiveis)) * (trilho - tam),
      );
      g.fillStyle = P.ambar;
      g.fillRect(x + LARG - 6, y + 26 + desl, 2, tam);
    }

    rodape(
      g,
      `W/S escolher · ENTER usar · F1 fechar   (${this.indice + 1}/${this.acoes.length})`,
      x,
      y,
      LARG,
      alt,
    );
  }
}
