/**
 * Entrada do jogador: teclado (WASD e afins) e mouse (ataque no botão direito).
 */

import { LARGURA, ALTURA } from './screen';
import type { Tela } from './screen';
import { clamp } from './math';

export class Entrada {
  private pressionadas = new Set<string>();
  private apertadasAgora = new Set<string>();
  private soltasAgora = new Set<string>();

  /** Posição do cursor em pixels do jogo. */
  mouseX = LARGURA / 2;
  mouseY = ALTURA / 2;
  mouseNaTela = false;

  private botoes = new Set<number>();
  private botoesAgora = new Set<number>();
  private botoesSoltos = new Set<number>();

  constructor(private tela: Tela) {
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    const alvo = tela.canvas;
    alvo.addEventListener('mousemove', this.onMouseMove);
    alvo.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    alvo.addEventListener('mouseenter', () => (this.mouseNaTela = true));
    alvo.addEventListener('mouseleave', () => (this.mouseNaTela = false));
    // O botão direito é o ataque: o menu de contexto precisa ser bloqueado.
    alvo.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('contextmenu', (e) => {
      if (e.target === alvo) e.preventDefault();
    });
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    // Evita que o navegador role a página ou mude o foco durante o jogo.
    if (c === 'Space' || c === 'Tab' || c.startsWith('Arrow')) e.preventDefault();
    if (!this.pressionadas.has(c)) this.apertadasAgora.add(c);
    this.pressionadas.add(c);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.pressionadas.delete(e.code);
    this.soltasAgora.add(e.code);
  };

  private onBlur = () => {
    this.pressionadas.clear();
    this.botoes.clear();
  };

  private onMouseMove = (e: MouseEvent) => {
    const p = this.tela.paraJogo(e.clientX, e.clientY);
    this.mouseX = clamp(p.x, 0, LARGURA);
    this.mouseY = clamp(p.y, 0, ALTURA);
    this.mouseNaTela = true;
  };

  private onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    if (!this.botoes.has(e.button)) this.botoesAgora.add(e.button);
    this.botoes.add(e.button);
  };

  private onMouseUp = (e: MouseEvent) => {
    this.botoes.delete(e.button);
    this.botoesSoltos.add(e.button);
  };

  // ----- consultas -----

  tecla(code: string): boolean {
    return this.pressionadas.has(code);
  }

  /** Verdadeiro apenas no quadro em que a tecla foi apertada. */
  teclaAgora(...codes: string[]): boolean {
    return codes.some((c) => this.apertadasAgora.has(c));
  }

  teclaSolta(code: string): boolean {
    return this.soltasAgora.has(code);
  }

  botao(b = 0): boolean {
    return this.botoes.has(b);
  }

  botaoAgora(b = 0): boolean {
    return this.botoesAgora.has(b);
  }

  botaoSolto(b = 0): boolean {
    return this.botoesSoltos.has(b);
  }

  /** Vetor de movimento normalizado a partir de WASD (e setas). */
  direcaoMovimento(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.tecla('KeyA') || this.tecla('ArrowLeft')) x -= 1;
    if (this.tecla('KeyD') || this.tecla('ArrowRight')) x += 1;
    if (this.tecla('KeyW') || this.tecla('ArrowUp')) y -= 1;
    if (this.tecla('KeyS') || this.tecla('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = Math.SQRT1_2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** Chamado no fim de cada quadro para limpar os estados momentâneos. */
  finalizarQuadro(): void {
    this.apertadasAgora.clear();
    this.soltasAgora.clear();
    this.botoesAgora.clear();
    this.botoesSoltos.clear();
  }
}
