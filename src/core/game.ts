/**
 * Casca do jogo: laço principal, troca de cenas e transições em fade.
 */

import { Tela, LARGURA, ALTURA } from './screen';
import { Entrada } from './input';
import { Audio } from '../audio/audio';
import type { Assets } from '../gfx/assets';

export interface Cena {
  entrar?(): void;
  sair?(): void;
  atualizar(dt: number): void;
  desenhar(g: CanvasRenderingContext2D): void;
}

interface Transicao {
  t: number;
  duracao: number;
  proxima: Cena | null;
}

const DT_MAX = 1 / 20;

export class Jogo {
  readonly tela: Tela;
  readonly entrada: Entrada;
  readonly audio = new Audio();
  cena: Cena | null = null;
  tempo = 0;
  private transicao: Transicao | null = null;
  private ultimo = 0;
  private rodando = false;

  constructor(
    canvas: HTMLCanvasElement,
    readonly assets: Assets,
  ) {
    this.tela = new Tela(canvas);
    this.entrada = new Entrada(this.tela);
    // o áudio só pode começar depois de um gesto do usuário
    const acordar = () => this.audio.iniciar();
    window.addEventListener('pointerdown', acordar);
    window.addEventListener('keydown', acordar);
  }

  definirCena(cena: Cena): void {
    this.cena?.sair?.();
    this.cena = cena;
    cena.entrar?.();
  }

  /** Troca de cena com fade preto no meio. */
  trocarCena(proxima: Cena, duracao = 0.7): void {
    if (this.transicao) return;
    this.transicao = { t: 0, duracao, proxima };
  }

  iniciar(): void {
    if (this.rodando) return;
    this.rodando = true;
    this.ultimo = performance.now();
    const quadro = (agora: number) => {
      const dt = Math.min(DT_MAX, (agora - this.ultimo) / 1000);
      this.ultimo = agora;
      this.tempo += dt;
      this.passo(dt);
      requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);
  }

  private passo(dt: number): void {
    const g = this.tela.g;

    // transição: primeira metade escurece, segunda metade clareia
    let alphaFade = 0;
    if (this.transicao) {
      this.transicao.t += dt;
      const meio = this.transicao.duracao / 2;
      if (this.transicao.t >= meio && this.transicao.proxima) {
        this.definirCena(this.transicao.proxima);
        this.transicao.proxima = null;
      }
      const t = this.transicao.t;
      alphaFade = t < meio ? t / meio : 1 - (t - meio) / meio;
      if (t >= this.transicao.duracao) this.transicao = null;
    }

    this.cena?.atualizar(dt);

    g.imageSmoothingEnabled = false;
    g.fillStyle = '#101018';
    g.fillRect(0, 0, LARGURA, ALTURA);
    this.cena?.desenhar(g);

    if (alphaFade > 0) {
      g.globalAlpha = Math.min(1, alphaFade);
      g.fillStyle = '#07060c';
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    this.entrada.finalizarQuadro();
  }
}
