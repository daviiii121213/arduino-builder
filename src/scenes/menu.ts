/**
 * Menu principal, com um pôr do sol pré-histórico animado ao fundo.
 */

import type { Cena, Jogo } from '../core/game';
import { LARGURA, ALTURA } from '../core/screen';
import { Botao, ListaBotoes, textoGrande } from '../ui/widgets';
import { desenharPainel } from '../gfx/sprites/ui';
import { texto, paragrafo, quebrarTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import { Pincel, tingir, type Sprite } from '../gfx/pixel';
import { Rng } from '../core/rng';
import { CenaCinematica } from './cinematic';
import { CenaJogo } from './play';
import type { EspecieId } from '../gfx/sprites/dinos';

type Painel = 'nenhum' | 'comoJogar' | 'creditos';

const CORES_CEU = [
  '#1b1830',
  '#2c2144',
  '#4a2b4e',
  '#743a4f',
  '#a94a44',
  '#cd6239',
  '#e08a3c',
  '#f0b357',
];

export class CenaMenu implements Cena {
  private menu: ListaBotoes;
  private fundo: Sprite;
  private serra: Sprite;
  private mata: Sprite;
  private capim: Sprite;
  private painel: Sprite;
  private painelAtivo: Painel = 'nenhum';
  private tempo = 0;
  private desfilando: { s: Sprite; x: number; y: number; v: number }[] = [];

  constructor(private jogo: Jogo) {
    this.fundo = this.criarCeu();
    this.serra = this.criarSerra();
    this.mata = this.criarMata();
    this.capim = this.criarCapim();
    this.painel = desenharPainel(360, 170);

    const larg = 150;
    const x = Math.round((LARGURA - larg) / 2);
    this.menu = new ListaBotoes([
      new Botao(x, 150, larg, 20, 'Nova expedição', () => this.comecar(true)),
      new Botao(x, 174, larg, 20, 'Pular a cinemática', () => this.comecar(false)),
      new Botao(x, 198, larg, 20, 'Como jogar', () => (this.painelAtivo = 'comoJogar')),
      new Botao(x, 222, larg, 20, 'Créditos', () => (this.painelAtivo = 'creditos')),
    ]);

    // silhuetas de dinossauros atravessando o horizonte
    const especies: EspecieId[] = ['folhalonga', 'tricornis', 'pedrapata', 'raptornoz'];
    especies.forEach((id, i) => {
      const arte = jogo.assets.dinos[id];
      this.desfilando.push({
        s: tingir(arte.direita[0], '#191529', 1),
        x: 40 + i * 118,
        y: 152 - i * 3,
        v: 5 + i * 2.5,
      });
    });
  }

  // ------------------------------------------------------------- cenário

  private criarCeu(): Sprite {
    const p = new Pincel(LARGURA, ALTURA);
    const rng = new Rng(2468);
    const alturaCeu = 168;
    for (let y = 0; y < alturaCeu; y++) {
      const t = (y / alturaCeu) * (CORES_CEU.length - 1);
      const i = Math.floor(t);
      const f = t - i;
      const corA = CORES_CEU[i];
      const corB = CORES_CEU[Math.min(CORES_CEU.length - 1, i + 1)];
      for (let x = 0; x < LARGURA; x++) {
        // dithering ordenado 2x2 para a passagem entre as faixas
        const limiar = ((x % 2) + (y % 2) * 2 + 0.5) / 4;
        p.ponto(x, y, f > limiar ? corB : corA);
      }
    }
    // estrelas no alto
    for (let i = 0; i < 60; i++) {
      const x = rng.int(0, LARGURA - 1);
      const y = rng.int(0, 60);
      p.ponto(x, y, rng.chance(0.3) ? '#fff6d0' : '#c9c0e0');
    }
    // sol descendo
    const sx = 398;
    const sy = 100;
    p.disco(sx, sy, 17, '#f7cf6b');
    p.disco(sx, sy, 13, '#ffe9a8');
    for (let i = 0; i < 5; i++) {
      const y = sy - 12 + i * 6;
      p.retangulo(sx - 20, y, 40, 1, CORES_CEU[6]);
    }
    // nuvens em faixas
    for (let i = 0; i < 10; i++) {
      const y = rng.int(64, 130);
      const x = rng.int(-20, LARGURA);
      const larg = rng.int(30, 90);
      const cor = y < 100 ? '#5c3355' : '#e08a3c';
      for (let k = 0; k < larg; k++) {
        p.ponto(x + k, y, cor);
        if (k > 4 && k < larg - 4) p.ponto(x + k, y + 1, cor);
      }
    }
    return p.finalizar();
  }

  private criarSerra(): Sprite {
    const p = new Pincel(LARGURA, 70);
    const rng = new Rng(1357);
    const cor = '#2a2038';
    const alturas: number[] = [];
    let h = 30;
    for (let x = 0; x < LARGURA; x++) {
      h += rng.range(-1.4, 1.4);
      if (x % 60 === 0) h = rng.range(16, 42);
      h = Math.max(10, Math.min(52, h));
      alturas.push(h);
    }
    for (let x = 0; x < LARGURA; x++) {
      for (let y = 70 - alturas[x]; y < 70; y++) p.ponto(x, y, cor);
      p.ponto(x, 70 - alturas[x], '#3a2c4c');
    }
    // vulcão fumegando à direita
    const vx = 300;
    for (let i = 0; i < 46; i++) {
      const larg = Math.round(i * 0.62);
      for (let k = -larg; k <= larg; k++) p.ponto(vx + k, 70 - 46 + i, '#241b30');
      p.ponto(vx - larg, 70 - 46 + i, '#3a2c4c');
    }
    p.retangulo(vx - 5, 22, 10, 3, '#c25a3f');
    p.retangulo(vx - 3, 21, 6, 2, '#e5833f');
    return p.finalizar();
  }

  /** Faixa de araucárias em silhueta, na frente da serra. */
  private criarMata(): Sprite {
    const p = new Pincel(LARGURA, 54);
    const rng = new Rng(8642);
    const cor = '#171426';
    const claro = '#211c33';
    for (let i = 0; i < 46; i++) {
      const x = rng.int(-8, LARGURA + 8);
      const alt = rng.int(20, 46);
      const larg = rng.int(5, 11);
      // copa em camadas (araucária) e tronco fino
      for (let j = 0; j < alt; j++) {
        const y = 53 - j;
        const t = j / alt;
        const w = Math.max(1, Math.round(larg * (1 - t) + (Math.floor(j / 4) % 2 === 0 ? 1 : 0)));
        for (let k = -w; k <= w; k++) p.ponto(x + k, y, i % 7 === 0 ? claro : cor);
      }
      for (let j = 0; j < 6; j++) p.ponto(x, 53 + j - 5, cor);
    }
    p.retangulo(0, 49, LARGURA, 5, '#12101c');
    return p.finalizar();
  }

  private criarCapim(): Sprite {
    const p = new Pincel(LARGURA, 30);
    const rng = new Rng(9753);
    p.retangulo(0, 12, LARGURA, 18, '#0f0d18');
    for (let x = 0; x < LARGURA; x++) {
      const alt = rng.int(2, 11);
      for (let y = 0; y < alt; y++) p.ponto(x, 12 - y, '#0f0d18');
      if (rng.chance(0.08)) p.ponto(x, 12 - alt, '#1d1a2c');
    }
    return p.finalizar();
  }

  // ---------------------------------------------------------- atualização

  private comecar(comCinematica: boolean): void {
    this.jogo.audio.iniciar();
    if (comCinematica) this.jogo.trocarCena(new CenaCinematica(this.jogo), 0.9);
    else this.jogo.trocarCena(new CenaJogo(this.jogo, true), 0.9);
  }

  atualizar(dt: number): void {
    this.tempo += dt;
    const e = this.jogo.entrada;

    for (const d of this.desfilando) {
      d.x += d.v * dt;
      if (d.x > LARGURA + 40) d.x = -60;
    }

    if (this.painelAtivo !== 'nenhum') {
      if (e.teclaAgora('Escape', 'Enter', 'Space') || e.botaoAgora(0) || e.botaoAgora(2)) {
        this.painelAtivo = 'nenhum';
        this.jogo.audio.menu();
      }
      return;
    }

    if (e.teclaAgora('KeyM')) {
      this.jogo.audio.iniciar();
      this.jogo.audio.alternar();
    }

    this.menu.atualizar(
      e,
      () => this.jogo.audio.menu(),
      () => this.jogo.audio.confirmar(),
    );
  }

  // -------------------------------------------------------------- desenho

  desenhar(g: CanvasRenderingContext2D): void {
    g.drawImage(this.fundo, 0, 0);
    g.drawImage(this.serra, 0, 118);
    for (const d of this.desfilando) {
      g.drawImage(d.s, Math.round(d.x), Math.round(d.y - d.s.height));
    }
    g.drawImage(this.mata, 0, 152);
    g.drawImage(this.capim, 0, ALTURA - 30);

    // névoa baixa
    g.globalAlpha = 0.16;
    g.fillStyle = '#e08a3c';
    g.fillRect(0, 150, LARGURA, 8);
    g.globalAlpha = 1;

    // título
    const balanco = Math.round(Math.sin(this.tempo * 1.6) * 1);
    textoGrande(g, 'CRONOS', LARGURA / 2, 34 + balanco, 5, {
      cor: P.ambar,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    textoGrande(g, 'JURÁSSICO', LARGURA / 2, 86 + balanco, 3, {
      cor: P.osso,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    texto(g, 'Uma viagem de 100 milhões de anos por engano', LARGURA / 2, 126, {
      cor: '#ffe0b0',
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });

    this.menu.desenhar(g);
    texto(g, 'Versão 1 · arte em pixel feita à mão', 6, ALTURA - 11, {
      cor: '#8b83a3',
      sombra: P.contorno,
    });
    texto(g, this.jogo.audio.ligado ? 'M: som ligado' : 'M: som desligado', LARGURA - 6, ALTURA - 11, {
      cor: '#8b83a3',
      sombra: P.contorno,
      alinhamento: 'direita',
    });

    if (this.painelAtivo !== 'nenhum') this.desenharPainelAtivo(g);

    if (this.jogo.entrada.mouseNaTela) {
      const s = this.jogo.assets.ui.cursor;
      g.drawImage(
        s,
        Math.round(this.jogo.entrada.mouseX) - (s.width >> 1),
        Math.round(this.jogo.entrada.mouseY) - (s.height >> 1),
      );
    }
  }

  private desenharPainelAtivo(g: CanvasRenderingContext2D): void {
    g.globalAlpha = 0.8;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;
    const x = Math.round((LARGURA - this.painel.width) / 2);
    const y = 44;
    g.drawImage(this.painel, x, y);

    if (this.painelAtivo === 'comoJogar') {
      texto(g, 'COMO JOGAR', LARGURA / 2, y + 12, {
        cor: P.ambar,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      const linhas = [
        'W A S D — andar pelo vale',
        'BOTÃO DIREITO — atacar na direção do cursor',
        'E — interagir (entrar e sair de casa)',
        '1 a 0 — escolher o espaço do inventário',
        'TAB — bestiário · J — diário · M — som',
        'ESC — pausar',
        '',
        'Você tem cinco corações e recupera um a cada',
        'três segundos, desde que não esteja com fome.',
        'Carnívoros caçam, herbívoros fogem, os terrestres',
        'defendem seu território, os aquáticos não saem da',
        'água e os mágicos disparam orbes e se teleportam.',
      ];
      paragrafo(g, linhas, x + 16, y + 30, { cor: P.osso, sombra: P.contorno });
    } else {
      texto(g, 'CRÉDITOS', LARGURA / 2, y + 12, {
        cor: P.ambar,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      const txt =
        'Cronos Jurássico — versão 1. Jogo, código, fonte de bitmap, ' +
        'cenários, criaturas, interface e efeitos sonoros criados do zero ' +
        'em TypeScript e HTML5 Canvas. Nenhuma imagem ou som externo foi ' +
        'usado: cada pixel é desenhado pelo próprio jogo.';
      const linhas = quebrarTexto(txt, this.painel.width - 32);
      paragrafo(g, linhas, x + 16, y + 32, { cor: P.osso, sombra: P.contorno });
      paragrafo(
        g,
        [
          '',
          'Em breve: inventário completo, missões no diário,',
          'NPCs humanos, cavernas, recursos e o ciclo de',
          'dia e noite.',
        ],
        x + 16,
        y + 32 + linhas.length * 9,
        { cor: '#a89fbe', sombra: P.contorno },
      );
    }

    texto(g, 'ESC ou clique para voltar', LARGURA / 2, y + this.painel.height - 14, {
      cor: '#8b83a3',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
  }
}
