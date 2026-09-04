/**
 * O protagonista: Téo, neto do inventor.
 *
 * Movimento livre com WASD (aceleração suave e colisão top-down) e ataque com
 * o BOTÃO DIREITO do mouse, sempre na direção do cursor.
 */

import { Vida } from '../systems/health';
import { Fome } from '../systems/hunger';
import { mover, type Pegada } from '../systems/collision';
import { angleDelta, clamp, damp, TAU } from '../core/math';
import { JOGADOR_H, JOGADOR_W } from '../gfx/sprites/player';
import { P } from '../gfx/palette';
import { tingirCache } from '../gfx/pixel';
import type { Mundo } from './context';
import type { Entrada } from '../core/input';
import { PROPS } from '../world/tiles';

export type Direcao = 'baixo' | 'cima' | 'esquerda' | 'direita';

/** Ajustes do combate — reunidos aqui para facilitar o balanceamento. */
export const COMBATE = {
  duracao: 0.3,
  /** Instante (dentro da duração) em que o golpe acerta. */
  momentoGolpe: 0.1,
  recarga: 0.4,
  alcance: 32,
  /** Meia abertura do arco de acerto, em radianos. */
  arco: Math.PI * 0.42,
  dano: 3,
  empurrao: 108,
  /** Pequeno avanço do jogador ao golpear (peso no ataque). */
  avanco: 46,
};

const VELOCIDADE = 80;
const ACELERACAO = 16;

export class Jogador {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  direcao: Direcao = 'baixo';
  vida = new Vida(5);
  fome = new Fome();

  pegada: Pegada = { x: 0, y: 0, metadeW: 5, metadeH: 3.5 };

  /** Ângulo de mira (segue o cursor). */
  mira = 0;
  /** Estado do ataque em andamento. */
  ataque: { t: number; acertou: boolean; angulo: number } | null = null;
  recarga = 0;
  /** Empurrão sofrido ao tomar dano. */
  empurraoX = 0;
  empurraoY = 0;

  private animTempo = 0;
  private quadro = 0;
  private tempoPasso = 0;
  naAgua = false;
  private piscar = 0;
  /** Tempo desde a morte (para a tela de fim de jogo). */
  tempoMorto = 0;

  constructor(x: number, y: number) {
    this.reposicionar(x, y);
  }

  reposicionar(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.empurraoX = 0;
    this.empurraoY = 0;
  }

  get centroX(): number {
    return this.x;
  }

  /** Centro do corpo (usado por acertos e pela câmera). */
  get centroY(): number {
    return this.y - 9;
  }

  get vivo(): boolean {
    return this.vida.vivo;
  }

  get atacando(): boolean {
    return this.ataque !== null;
  }

  get podeAtacar(): boolean {
    return this.recarga <= 0 && this.ataque === null && this.vivo;
  }

  // ------------------------------------------------------------------ lógica

  atualizar(dt: number, entrada: Entrada, mundo: Mundo): void {
    if (!this.vivo) {
      this.tempoMorto += dt;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // ---- mira: sempre na direção do cursor
    const mundoMouse = mundo.camera.telaParaMundo(entrada.mouseX, entrada.mouseY);
    this.mira = Math.atan2(mundoMouse.y - this.centroY, mundoMouse.x - this.centroX);

    // ---- movimento
    const dir = entrada.direcaoMovimento();
    const atrito = PROPS[mundo.nivel.tileEm(this.x, this.y)].atrito;
    const penalidadeAtaque = this.ataque ? 0.45 : 1;
    const alvoVx = dir.x * VELOCIDADE * atrito * penalidadeAtaque;
    const alvoVy = dir.y * VELOCIDADE * atrito * penalidadeAtaque;
    this.vx = damp(this.vx, alvoVx, ACELERACAO, dt);
    this.vy = damp(this.vy, alvoVy, ACELERACAO, dt);

    // empurrão decai rápido
    this.empurraoX = damp(this.empurraoX, 0, 9, dt);
    this.empurraoY = damp(this.empurraoY, 0, 9, dt);

    this.pegada.x = this.x;
    this.pegada.y = this.y;
    const r = mover(
      mundo.nivel,
      this.pegada,
      (this.vx + this.empurraoX) * dt,
      (this.vy + this.empurraoY) * dt,
    );
    this.x = r.x;
    this.y = r.y;
    if (r.bateuX) this.vx *= 0.2;
    if (r.bateuY) this.vy *= 0.2;

    // ---- direção visual
    const andando = Math.hypot(this.vx, this.vy) > 6;
    if (this.ataque) {
      this.direcao = this.direcaoDoAngulo(this.ataque.angulo);
    } else if (andando) {
      if (Math.abs(this.vx) > Math.abs(this.vy)) this.direcao = this.vx > 0 ? 'direita' : 'esquerda';
      else this.direcao = this.vy > 0 ? 'baixo' : 'cima';
    } else if (entrada.mouseNaTela) {
      this.direcao = this.direcaoDoAngulo(this.mira);
    }

    // ---- animação de caminhada
    if (andando) {
      this.animTempo += dt * (0.55 + Math.hypot(this.vx, this.vy) / VELOCIDADE);
      const passoDur = 0.16;
      this.quadro = 1 + (Math.floor(this.animTempo / passoDur) % 2);
      // poeira e som dos passos
      this.tempoPasso += dt;
      if (this.tempoPasso > 0.3) {
        this.tempoPasso = 0;
        const naAgua = PROPS[mundo.nivel.tileEm(this.x, this.y)].agua;
        mundo.audio.passo(naAgua);
        if (naAgua) {
          mundo.particulas.animacao(mundo.assets.efeitos.respingo, this.x, this.y, 0.35);
        } else {
          mundo.particulas.animacao(mundo.assets.efeitos.poeira, this.x, this.y + 1, 0.3);
        }
      }
    } else {
      this.animTempo = 0;
      this.quadro = 0;
      this.tempoPasso = 0.29;
    }

    this.naAgua = PROPS[mundo.nivel.tileEm(this.x, this.y)].agua;

    // ---- ataque com o botão direito
    if (this.recarga > 0) this.recarga = Math.max(0, this.recarga - dt);
    if (entrada.botao(2) && this.podeAtacar) this.iniciarAtaque(mundo);

    if (this.ataque) {
      this.ataque.t += dt;
      if (!this.ataque.acertou && this.ataque.t >= COMBATE.momentoGolpe) {
        this.ataque.acertou = true;
        this.aplicarGolpe(mundo);
      }
      if (this.ataque.t >= COMBATE.duracao) {
        this.ataque = null;
        this.recarga = COMBATE.recarga;
      }
    }

    // ---- vida e fome
    this.fome.atualizar(dt, andando ? 0.4 : 0);
    const curou = this.vida.atualizar(dt, !this.fome.comFome);
    if (curou) {
      mundo.audio.curar();
      mundo.particulas.texto('+1', this.x, this.y - JOGADOR_H - 2, P.coracaoLuz);
      for (let i = 0; i < 6; i++) {
        mundo.particulas.pixel(this.x + (Math.random() - 0.5) * 10, this.y - 10, P.coracaoLuz, {
          vy: -26,
          vida: 0.6,
        });
      }
    }
    if (this.piscar > 0) this.piscar -= dt;
  }

  private direcaoDoAngulo(a: number): Direcao {
    const oct = ((a + TAU) % TAU) / TAU;
    if (oct < 0.125 || oct >= 0.875) return 'direita';
    if (oct < 0.375) return 'baixo';
    if (oct < 0.625) return 'esquerda';
    return 'cima';
  }

  private iniciarAtaque(mundo: Mundo): void {
    this.ataque = { t: 0, acertou: false, angulo: this.mira };
    mundo.audio.golpe();
    // avanço curto na direção do golpe
    this.empurraoX += Math.cos(this.mira) * COMBATE.avanco;
    this.empurraoY += Math.sin(this.mira) * COMBATE.avanco;
    // arco visual do golpe, girado para a mira
    const px = this.centroX + Math.cos(this.mira) * 8;
    const py = this.centroY + Math.sin(this.mira) * 8;
    mundo.particulas.animacao(
      mundo.assets.efeitos.golpe,
      px,
      py,
      COMBATE.duracao * 0.8,
      this.mira,
      0.2,
    );
    mundo.particulas.leque(
      this.centroX + Math.cos(this.mira) * 14,
      this.centroY + Math.sin(this.mira) * 14,
      this.mira,
      0.5,
      [P.brilho, P.ambar, P.osso],
      5,
      70,
    );
  }

  private aplicarGolpe(mundo: Mundo): void {
    let acertos = 0;
    for (const d of mundo.dinos) {
      if (!d.vivo) continue;
      const dx = d.x - this.centroX;
      const dy = d.centroY - this.centroY;
      const distancia = Math.hypot(dx, dy);
      if (distancia > COMBATE.alcance + d.raioCorpo) continue;
      const ang = Math.atan2(dy, dx);
      if (Math.abs(angleDelta(this.ataque!.angulo, ang)) > COMBATE.arco) continue;
      d.receberDano(COMBATE.dano, this.ataque!.angulo, COMBATE.empurrao, mundo);
      acertos++;
    }
    // acerto em cheio: tremor e faísca; golpe no vazio: só o vento
    if (acertos > 0) {
      mundo.camera.tremer(2.2, 0.18);
      mundo.audio.acerto();
    }
  }

  /** Recebe dano de um dinossauro ou de uma orbe mágica. */
  receberDano(metades: number, deX: number, deY: number, mundo: Mundo): boolean {
    if (!this.vida.receberDano(metades)) return false;
    const ang = Math.atan2(this.y - deY, this.x - deX);
    this.empurraoX += Math.cos(ang) * 150;
    this.empurraoY += Math.sin(ang) * 150;
    this.piscar = 0.7;
    mundo.camera.tremer(4, 0.3);
    mundo.audio.dano();
    mundo.particulas.jato(this.centroX, this.centroY, [P.sangue, '#e0605c', P.coracao], 12, 90);
    mundo.particulas.texto(`-${metades / 2 >= 1 ? metades / 2 : '½'}`, this.x, this.y - JOGADOR_H, P.coracao);
    if (!this.vida.vivo) {
      mundo.audio.morte();
      mundo.camera.tremer(6, 0.6);
      this.tempoMorto = 0;
    }
    return true;
  }

  // ------------------------------------------------------------------ desenho

  desenhar(g: CanvasRenderingContext2D, mundo: Mundo, camX: number, camY: number): void {
    const q = mundo.assets.jogador;
    const quadros =
      this.direcao === 'baixo'
        ? q.baixo
        : this.direcao === 'cima'
          ? q.cima
          : this.direcao === 'direita'
            ? q.direita
            : q.esquerda;
    let sprite = quadros[Math.min(this.quadro, quadros.length - 1)];

    const px = Math.round(this.x - JOGADOR_W / 2 - camX);
    const py = Math.round(this.y - JOGADOR_H - camY);

    // sombra
    const sombra = mundo.assets.sombras.m;
    g.globalAlpha = this.naAgua ? 0.25 : 0.5;
    g.drawImage(sombra, px + (JOGADOR_W - sombra.width) / 2, Math.round(this.y - camY) - 3);
    g.globalAlpha = 1;

    // pisca em vermelho quando levou dano
    if (this.piscar > 0 && Math.floor(this.piscar * 14) % 2 === 0) {
      sprite = tingirCache(sprite, P.coracaoLuz, 0.75);
    }

    // dentro da água o corpo afunda um pouco e ganha ondulação
    const afunda = this.naAgua ? 3 : 0;
    if (this.naAgua) {
      g.globalAlpha = 0.9;
    }
    // a lança fica atrás do corpo quando o golpe vem de cima
    const desenharLanca = () => {
      const lanca = q.lanca;
      let ang: number;
      let raio: number;
      if (this.ataque) {
        const t = clamp(this.ataque.t / COMBATE.duracao, 0, 1);
        // arco de -0.9 a +0.9 radiano ao redor da mira
        ang = this.ataque.angulo - 0.9 + t * 1.8;
        raio = 6 + Math.sin(t * Math.PI) * 7;
      } else {
        // em repouso a lança fica apoiada no ombro, seguindo a direção do corpo
        ang = this.direcao === 'esquerda' ? Math.PI - 0.5 : this.direcao === 'cima' ? -1.9 : 0.5;
        raio = 5;
      }
      const hx = this.centroX + Math.cos(ang) * raio - camX;
      const hy = this.centroY + Math.sin(ang) * raio - camY + afunda;
      g.save();
      g.translate(Math.round(hx), Math.round(hy));
      g.rotate(ang);
      g.drawImage(lanca, -2, -2);
      g.restore();
    };

    const lancaAtras = this.direcao === 'cima';
    if (lancaAtras) desenharLanca();
    g.drawImage(sprite, px, py + afunda);
    if (!lancaAtras) desenharLanca();
    g.globalAlpha = 1;

    // linha d'água na altura dos pés
    if (this.naAgua) {
      g.fillStyle = P.aguaEspuma;
      const larg = 10 + Math.round(Math.sin(mundo.tempo * 6) * 2);
      g.fillRect(Math.round(this.x - larg / 2 - camX), Math.round(this.y - camY) - 2, larg, 1);
    }
  }
}
