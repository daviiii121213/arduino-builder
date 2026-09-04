/**
 * Cinemática de abertura.
 *
 * Cinco atos: o galpão do avô, a descoberta da máquina sob o pano, a ativação,
 * a falha e a queda de mais de cem milhões de anos até a era dos dinossauros.
 * Pode ser pulada com ESC.
 */

import type { Cena, Jogo } from '../core/game';
import { LARGURA, ALTURA } from '../core/screen';
import { Particulas } from '../systems/particles';
import { CaixaDialogo } from '../ui/dialog';
import { contornar, criarCanvas, ctx2d, Pincel, type Sprite } from '../gfx/pixel';
import { texto } from '../gfx/font';
import { textoGrande } from '../ui/widgets';
import { P } from '../gfx/palette';
import { TAM_TILE } from '../gfx/sprites/terrain';
import { clamp, easeOutCubic, TAU } from '../core/math';
import { Rng } from '../core/rng';
import { CenaJogo } from './play';

/** A cinemática é composta numa tela menor e ampliada 2x (mais cinematográfica). */
const CW = LARGURA / 2;
const CH = ALTURA / 2;

const CHAO_Y = 80;
const MAQUINA_X = 150;
const MAQUINA_BASE = 98;

interface Fala {
  quem: string;
  txt: string;
}

export class CenaCinematica implements Cena {
  private cena: HTMLCanvasElement;
  private cg: CanvasRenderingContext2D;
  private particulas = new Particulas();
  private dialogo = new CaixaDialogo();
  private rng = new Rng(5150);

  private etapa = 0;
  private tEtapa = 0;
  private tTotal = 0;
  private falas: Fala[] = [];
  private esperandoFala = false;

  private teoX = 12;
  private teoDestino = 12;
  private teoAndando = false;
  private teoAnim = 0;
  private teoOlhandoDireita = true;

  private panoY = 0;
  private panoAlpha = 1;
  private maquinaLigada = 0;
  private tremor = 0;
  private clarao = 0;
  private anoAtual = 2026;

  private luz: Sprite;
  private feixe: Sprite;
  private silhuetas: Sprite[] = [];

  constructor(private jogo: Jogo) {
    this.cena = criarCanvas(CW, CH);
    this.cg = ctx2d(this.cena);
    this.luz = this.criarLuz(54, 60);
    this.feixe = this.criarFeixe(30, 66);
    // no túnel o Téo aparece com um contorno luminoso, para não sumir no escuro
    const q = jogo.assets.jogador;
    this.silhuetas = [
      contornar(q.direita[0], P.raio),
      contornar(q.baixo[0], P.magiaClara),
      contornar(q.esquerda[0], P.raio),
    ];
  }

  // -------------------------------------------------------- arte auxiliar

  /** Cone de luz do lampião do teto, com transparência escalonada. */
  private criarLuz(w: number, h: number): Sprite {
    const p = new Pincel(w, h);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      const meia = 3 + t * (w / 2 - 3);
      for (let x = 0; x < w; x++) {
        const d = Math.abs(x - w / 2);
        if (d > meia) continue;
        const forca = (1 - t) * (1 - d / meia);
        // "dithering": pixels alternados dão o granulado de pixel art
        if ((x + y) % 2 === 0 || forca > 0.6) p.ponto(x, y, P.ambar, forca * 0.22);
      }
    }
    return p.finalizar();
  }

  /** Feixe de luz que entra por uma fresta do telhado. */
  private criarFeixe(w: number, h: number): Sprite {
    const p = new Pincel(w, h);
    for (let y = 0; y < h; y++) {
      const t = y / h;
      for (let x = 0; x < w; x++) {
        const largura = 4 + t * (w - 6);
        const inicio = (w - largura) / 2;
        if (x < inicio || x > inicio + largura) continue;
        if ((x + y * 2) % 3 !== 0) continue;
        p.ponto(x, y, '#fff3c4', 0.16 * (1 - t * 0.6));
      }
    }
    return p.finalizar();
  }

  // ------------------------------------------------------------- roteiro

  entrar(): void {
    this.jogo.audio.iniciar();
    this.enfileirar([
      { quem: '', txt: 'Rio Grande do Sul — hoje. O galpão do vovô está fechado há três anos.' },
      { quem: 'Téo', txt: 'Ele dizia que guardava aqui a maior invenção da vida dele.' },
    ]);
  }

  private enfileirar(falas: Fala[]): void {
    this.falas = falas.slice();
    this.proximaFala();
  }

  private proximaFala(): void {
    const f = this.falas.shift();
    if (!f) {
      this.dialogo.fechar();
      this.esperandoFala = false;
      return;
    }
    this.dialogo.mostrar(f.quem, f.txt);
    this.esperandoFala = true;
  }

  private avancarEtapa(): void {
    this.etapa++;
    this.tEtapa = 0;
    switch (this.etapa) {
      case 1: // caminha até o pano
        this.teoDestino = MAQUINA_X - 26;
        break;
      case 2:
        this.enfileirar([
          { quem: 'Téo', txt: 'Tem alguma coisa grande debaixo deste pano...' },
          { quem: 'Téo', txt: 'Vovô, se isso for outra bicicleta enferrujada, eu desisto.' },
        ]);
        break;
      case 3: // puxa o pano
        this.jogo.audio.respingo();
        this.particulas.jato(MAQUINA_X, MAQUINA_BASE - 26, [P.fumaca, '#cfc4a8', '#a89b7f'], 46, 60, {
          vida: 1.6,
          gravidade: 6,
        });
        break;
      case 4:
        this.enfileirar([
          { quem: 'Téo', txt: 'Uma máquina do tempo. Ele não estava brincando.' },
          { quem: 'Téo', txt: 'Só vou dar uma olhada no painel. Só uma olhadinha.' },
        ]);
        break;
      case 5: // liga a máquina
        this.jogo.audio.maquina();
        break;
      case 6:
        this.enfileirar([
          { quem: 'MÁQUINA', txt: 'DESTINO PROGRAMADO: 12 DE MAIO DE 1998.' },
          { quem: 'MÁQUINA', txt: 'FALHA NO ESTABILIZADOR TEMPORAL. RECALCULANDO...' },
          { quem: 'MÁQUINA', txt: 'NOVO DESTINO: -100.482.000 ANOS. SEGURE FIRME.' },
          { quem: 'Téo', txt: 'Espera. ESPERA!' },
        ]);
        break;
      case 7: // túnel do tempo
        this.jogo.audio.trovao();
        this.clarao = 1;
        break;
      case 8:
        this.jogo.audio.portal();
        break;
      case 9:
        this.irParaOJogo();
        break;
    }
  }

  private irParaOJogo(): void {
    this.jogo.trocarCena(new CenaJogo(this.jogo, true), 1.2);
    this.etapa = 99;
  }

  pular(): void {
    if (this.etapa === 99) return;
    this.irParaOJogo();
  }

  // ---------------------------------------------------------- atualização

  atualizar(dt: number): void {
    const e = this.jogo.entrada;
    this.tTotal += dt;
    this.tEtapa += dt;
    this.dialogo.atualizar(dt);
    this.particulas.atualizar(dt);
    if (this.clarao > 0) this.clarao = Math.max(0, this.clarao - dt * 1.6);
    if (this.tremor > 0) this.tremor = Math.max(0, this.tremor - dt * 2);

    if (e.teclaAgora('Escape')) {
      this.pular();
      return;
    }

    const confirmou =
      e.teclaAgora('Space', 'Enter', 'NumpadEnter', 'KeyE') || e.botaoAgora(0);

    // poeira flutuando no ar do galpão
    if (this.etapa < 7 && this.rng.chance(dt * 6)) {
      this.particulas.pixel(this.rng.range(0, CW), this.rng.range(20, CHAO_Y), '#cfc4a8', {
        vida: 3,
        vy: this.rng.range(-3, 4),
        vx: this.rng.range(-4, 4),
      });
    }

    // diálogo em andamento
    if (this.esperandoFala) {
      if (confirmou) {
        if (!this.dialogo.completa) this.dialogo.apressar();
        else {
          this.jogo.audio.menu();
          this.proximaFala();
          if (!this.esperandoFala) this.avancarEtapa();
        }
      }
      this.moverTeo(dt);
      return;
    }

    switch (this.etapa) {
      case 1: // andando até a máquina
        this.moverTeo(dt);
        if (!this.teoAndando) this.avancarEtapa();
        break;
      case 3: // pano caindo
        this.panoY += dt * 34;
        this.panoAlpha = clamp(1 - this.tEtapa * 1.1, 0, 1);
        if (this.tEtapa > 1.1) this.avancarEtapa();
        break;
      case 5: // máquina acordando
        this.maquinaLigada = clamp(this.tEtapa / 1.6, 0, 1);
        this.tremor = Math.max(this.tremor, this.maquinaLigada * 1.6);
        if (this.rng.chance(dt * 14)) {
          this.particulas.pixel(
            MAQUINA_X + this.rng.range(-14, 14),
            MAQUINA_BASE - this.rng.range(6, 40),
            this.rng.chance(0.5) ? P.raio : P.magiaClara,
            { vida: 0.5, vy: this.rng.range(-20, -4) },
          );
        }
        if (this.tEtapa > 1.8) this.avancarEtapa();
        break;
      case 7: {
        // sobrecarga: tudo tremendo antes do salto
        this.tremor = 3.2;
        this.maquinaLigada = 1;
        if (this.rng.chance(dt * 40)) this.jogo.audio.menu();
        if (this.tEtapa > 1.4) {
          this.clarao = 1;
          this.jogo.audio.trovao();
          this.avancarEtapa();
        }
        break;
      }
      case 8: {
        // túnel do tempo
        const prog = clamp(this.tEtapa / 7, 0, 1);
        this.anoAtual = Math.round(2026 - easeOutCubic(prog) * 100484026);
        if (this.rng.chance(dt * 3)) this.jogo.audio.magia();
        if (this.tEtapa > 7 || confirmou) this.avancarEtapa();
        break;
      }
      default:
        this.moverTeo(dt);
        break;
    }
  }

  private moverTeo(dt: number): void {
    const d = this.teoDestino - this.teoX;
    if (Math.abs(d) > 1.2) {
      const v = 22 * Math.sign(d);
      this.teoX += v * dt;
      this.teoAndando = true;
      this.teoOlhandoDireita = v > 0;
      this.teoAnim += dt;
      if (this.rng.chance(dt * 4)) this.jogo.audio.passo();
    } else {
      this.teoAndando = false;
    }
  }

  // -------------------------------------------------------------- desenho

  desenhar(g: CanvasRenderingContext2D): void {
    const c = this.cg;
    c.imageSmoothingEnabled = false;
    if (this.etapa >= 8 && this.etapa !== 99) this.desenharTunel(c);
    else this.desenharGalpao(c);

    // tremor aplicado na hora de ampliar a composição
    const tx = this.tremor > 0 ? Math.round(this.rng.range(-this.tremor, this.tremor)) : 0;
    const ty = this.tremor > 0 ? Math.round(this.rng.range(-this.tremor, this.tremor)) : 0;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.drawImage(this.cena, tx * 2, ty * 2, LARGURA, ALTURA);

    // clarão do salto temporal
    if (this.clarao > 0) {
      g.globalAlpha = Math.min(1, this.clarao);
      g.fillStyle = '#fff6d0';
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    // tarjas de cinema
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, 14);
    g.fillRect(0, ALTURA - 14, LARGURA, 14);

    if (this.etapa >= 8 && this.etapa !== 99) {
      const rotulo =
        this.anoAtual >= 0
          ? `ANO ${this.anoAtual}`
          : `HÁ ${Math.abs(this.anoAtual).toLocaleString('pt-BR')} ANOS`;
      textoGrande(g, rotulo, LARGURA / 2, 30, 2, {
        cor: P.raio,
        sombra: P.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
    }

    this.dialogo.desenhar(g);
    texto(g, 'ESC pular · ESPAÇO continuar', LARGURA - 8, ALTURA - 11, {
      cor: '#6b6280',
      sombra: P.contorno,
      alinhamento: 'direita',
    });
  }

  private desenharGalpao(c: CanvasRenderingContext2D): void {
    const a = this.jogo.assets;
    // teto
    c.fillStyle = '#1a1a24';
    c.fillRect(0, 0, CW, 16);
    c.fillStyle = '#12121a';
    for (let x = 0; x < CW; x += 28) c.fillRect(x, 0, 3, 16);
    c.fillStyle = '#0d0d14';
    c.fillRect(0, 15, CW, 1);

    // parede
    c.drawImage(a.galpao.parede, 0, 14);

    // chão de concreto
    for (let y = CHAO_Y - 8; y < CH; y += TAM_TILE) {
      for (let x = 0; x < CW; x += TAM_TILE) {
        const v = a.terreno.concreto[((x / TAM_TILE + y / TAM_TILE) | 0) % a.terreno.concreto.length];
        c.drawImage(v, x, y);
      }
    }
    c.fillStyle = 'rgba(10,9,16,0.35)';
    c.fillRect(0, CHAO_Y - 8, CW, 3);

    // feixe de luz e sombra geral
    c.drawImage(this.feixe, 30, 16);
    c.drawImage(this.luz, 96, 10);

    // objetos do galpão
    c.drawImage(a.galpao.teia, 1, 17);
    c.drawImage(a.galpao.portao, 4, 46);
    c.drawImage(a.galpao.placaAvo, 104, 24);
    c.drawImage(a.galpao.ferramentas, 66, 34);
    const bancada = a.galpao.bancada;
    c.drawImage(bancada, 54, 86 - bancada.height);
    const prateleira = a.galpao.prateleira;
    c.drawImage(prateleira, 196, 84 - prateleira.height);
    const caixote = a.galpao.caixote;
    c.drawImage(caixote, 28, 92 - caixote.height);
    c.drawImage(caixote, 34, 92 - caixote.height * 2);
    c.drawImage(caixote, 206, 96 - caixote.height);
    // lampião pendurado, balançando
    const lamp = a.galpao.lampada;
    const bal = Math.sin(this.tTotal * 1.6) * 2;
    c.save();
    c.translate(120 + bal, 0);
    c.drawImage(lamp, -lamp.width / 2, 0);
    c.restore();

    // sombra da máquina no chão
    const sombra = this.jogo.assets.sombras.gg;
    c.globalAlpha = 0.5;
    c.drawImage(sombra, MAQUINA_X - sombra.width / 2, MAQUINA_BASE - 4);
    c.globalAlpha = 1;

    // máquina (coberta ou revelada)
    const maq = a.galpao.maquina;
    c.drawImage(maq, MAQUINA_X - maq.width / 2, MAQUINA_BASE - maq.height);

    if (this.maquinaLigada > 0) this.desenharMaquinaLigada(c);

    if (this.etapa < 4) {
      const pano = a.galpao.maquinaCoberta;
      c.globalAlpha = this.panoAlpha;
      c.drawImage(
        pano,
        MAQUINA_X - pano.width / 2,
        MAQUINA_BASE - pano.height + Math.round(this.panoY),
      );
      c.globalAlpha = 1;
    }

    // Téo
    const q = this.jogo.assets.jogador;
    const quadros = this.teoOlhandoDireita ? q.direita : q.esquerda;
    const quadro = this.teoAndando ? 1 + (Math.floor(this.teoAnim * 6) % 2) : 0;
    const sp = quadros[Math.min(quadro, quadros.length - 1)];
    const sombraP = this.jogo.assets.sombras.m;
    c.globalAlpha = 0.45;
    c.drawImage(sombraP, Math.round(this.teoX - sombraP.width / 2), MAQUINA_BASE - 4);
    c.globalAlpha = 1;
    c.drawImage(sp, Math.round(this.teoX - sp.width / 2), MAQUINA_BASE - sp.height);

    this.particulas.desenhar(c, 0, 0);

    // escurecimento das bordas para dar clima
    c.fillStyle = 'rgba(7,6,12,0.35)';
    c.fillRect(0, 16, 8, 64);
    c.fillRect(CW - 8, 16, 8, 64);
  }

  private desenharMaquinaLigada(c: CanvasRenderingContext2D): void {
    const f = this.maquinaLigada;
    const cx = MAQUINA_X;
    const cyNucleo = MAQUINA_BASE - 23;
    // núcleo brilhando
    const pulso = 0.55 + Math.sin(this.tTotal * 12) * 0.35;
    c.globalAlpha = f * pulso;
    c.fillStyle = P.magiaClara;
    c.fillRect(cx - 6, cyNucleo - 9, 12, 18);
    c.fillStyle = P.brilho;
    c.fillRect(cx - 3, cyNucleo - 6, 6, 12);
    c.globalAlpha = 1;

    // arcos elétricos subindo pela estrutura
    const arcos = Math.round(2 + f * 4);
    c.fillStyle = P.raio;
    for (let i = 0; i < arcos; i++) {
      let x = cx + this.rng.range(-15, 15);
      let y = MAQUINA_BASE - 46;
      const passos = 8;
      for (let s = 0; s < passos; s++) {
        c.globalAlpha = 0.8 * f;
        c.fillRect(Math.round(x), Math.round(y), 1, 1);
        x += this.rng.range(-2.5, 2.5);
        y += this.rng.range(2, 5);
      }
    }
    c.globalAlpha = 1;

    // anel do topo girando
    const raio = 7;
    for (let k = 0; k < 10; k++) {
      const ang = this.tTotal * 4 + (k / 10) * TAU;
      const px = cx + Math.cos(ang) * raio;
      const py = MAQUINA_BASE - 76 + Math.sin(ang) * 2.5;
      c.globalAlpha = f * (0.4 + 0.6 * ((Math.sin(ang) + 1) / 2));
      c.fillStyle = k % 2 ? P.raio : P.magiaClara;
      c.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
    c.globalAlpha = 1;
  }

  private desenharTunel(c: CanvasRenderingContext2D): void {
    c.fillStyle = '#0a0714';
    c.fillRect(0, 0, CW, CH);
    const cx = CW / 2;
    const cy = CH / 2;
    const t = this.tEtapa;

    // anéis fugindo para o fundo
    const aneis = 14;
    for (let i = 0; i < aneis; i++) {
      const fase = ((t * 0.55 + i / aneis) % 1);
      const raio = fase * fase * 150 + 4;
      const alpha = clamp(1 - fase, 0, 1) * 0.9;
      const cor = i % 3 === 0 ? P.raio : i % 3 === 1 ? P.magiaClara : P.magia;
      c.globalAlpha = alpha;
      c.fillStyle = cor;
      const passo = Math.max(0.06, 1 / Math.max(2, raio));
      for (let a = 0; a < TAU; a += passo) {
        const x = cx + Math.cos(a) * raio;
        const y = cy + Math.sin(a) * raio * 0.72;
        if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
        c.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    c.globalAlpha = 1;

    // riscos radiais de velocidade
    const rng = new Rng(1234 + Math.floor(t * 3));
    for (let i = 0; i < 40; i++) {
      const ang = rng.range(0, TAU);
      const r0 = rng.range(10, 60) + ((t * 90) % 60);
      const comp = rng.range(6, 26);
      c.globalAlpha = 0.75;
      c.fillStyle = rng.chance(0.5) ? P.brilho : P.raio;
      for (let s = 0; s < comp; s++) {
        const r = r0 + s;
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.72;
        if (x < 0 || y < 0 || x >= CW || y >= CH) continue;
        c.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    c.globalAlpha = 1;

    // Téo girando no vórtice
    const s = this.silhuetas[Math.floor(t * 6) % this.silhuetas.length];
    c.save();
    c.translate(cx + Math.sin(t * 2) * 10, cy + Math.cos(t * 1.7) * 6);
    c.rotate(t * 2.4);
    c.globalAlpha = 0.9;
    c.drawImage(s, -s.width / 2, -s.height / 2);
    c.restore();
    c.globalAlpha = 1;

    // clarão crescente no fim da viagem
    const fim = clamp((t - 5.6) / 1.4, 0, 1);
    if (fim > 0) {
      c.globalAlpha = fim;
      c.fillStyle = '#fff6d0';
      c.fillRect(0, 0, CW, CH);
      c.globalAlpha = 1;
    }
  }
}
