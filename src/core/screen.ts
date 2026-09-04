/**
 * Tela do jogo: canvas de baixa resolução escalado para a janela.
 * A resolução interna fixa garante pixels sempre quadrados e nítidos.
 */

export const LARGURA = 480;
export const ALTURA = 270;

export class Tela {
  readonly canvas: HTMLCanvasElement;
  readonly g: CanvasRenderingContext2D;
  /** Fator de escala atual (pixels de CSS por pixel do jogo). */
  escala = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = LARGURA;
    canvas.height = ALTURA;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Não foi possível criar o contexto 2D.');
    this.g = ctx;
    this.g.imageSmoothingEnabled = false;
    this.ajustar();
    window.addEventListener('resize', () => this.ajustar());
  }

  /** Recalcula a escala inteira máxima que caiba na janela. */
  ajustar(): void {
    const margem = 8;
    const dispW = Math.max(160, window.innerWidth - margem * 2);
    const dispH = Math.max(120, window.innerHeight - margem * 2);
    let esc = Math.min(dispW / LARGURA, dispH / ALTURA);
    // Escala inteira quando possível (pixel art perfeita); senão, meio passo.
    esc = esc >= 1 ? Math.floor(esc * 2) / 2 : esc;
    this.escala = esc;
    const palco = this.canvas.parentElement;
    const w = Math.round(LARGURA * esc);
    const h = Math.round(ALTURA * esc);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    if (palco) {
      palco.style.width = `${w}px`;
      palco.style.height = `${h}px`;
    }
    this.g.imageSmoothingEnabled = false;
  }

  /** Converte coordenadas do mouse (cliente) para pixels do jogo. */
  paraJogo(clienteX: number, clienteY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clienteX - r.left) / r.width) * LARGURA,
      y: ((clienteY - r.top) / r.height) * ALTURA,
    };
  }
}
