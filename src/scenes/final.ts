/**
 * O desfecho da história.
 *
 * Sete atos encadeados, todos em português: o Ancião entrega a Cronolita,
 * os dois entram na cabana, consertam a máquina do tempo juntos, o jogador
 * liga a máquina, atravessa o túnel, volta para 2026 e reencontra os pais.
 * No fim vem a tela de conclusão com "CONTINUAR JOGANDO" e "ZERAR" — e o
 * "ZERAR" ainda passa pelos créditos e por uma confirmação explícita antes de
 * apagar qualquer coisa.
 *
 * A cena não conhece o mundo do jogo: recebe dois callbacks (voltar a jogar e
 * voltar ao menu) e o id do personagem escolhido. Assim ela serve tanto ao
 * final normal quanto ao atalho do modo teste.
 */

import type { Cena, Jogo } from '../core/game';
import { LARGURA, ALTURA } from '../core/screen';
import { Particulas } from '../systems/particles';
import { CaixaDialogo } from '../ui/dialog';
import { Botao, ListaBotoes, textoGrande } from '../ui/widgets';
import { texto, paragrafo } from '../gfx/font';
import { P } from '../gfx/palette';
import { Pincel, type Sprite } from '../gfx/pixel';
import { Rng } from '../core/rng';
import { clamp, TAU } from '../core/math';
import { apagar as apagarSave } from '../systems/save';
import { PERSONAGENS } from '../systems/personagens';
import type { PersonagemId } from '../gfx/sprites/player';

interface Fala {
  quem: string;
  txt: string;
}

/** Passos do conserto: cada um é uma batida do jogador. */
const PASSOS_CONSERTO = [
  'Encaixar a Cronolita no berço da máquina',
  'Apertar as braçadeiras do estabilizador',
  'Religar o cabo do painel',
  'Girar a chave de partida',
];

const CREDITOS = [
  'CRONOS JURÁSSICO',
  '',
  'Programação, arte e som',
  'gerados inteiramente em código',
  '',
  'Nenhuma imagem, fonte ou áudio externo',
  'foi usado neste jogo',
  '',
  'Mundo: 208 x 160 tiles, seis regiões',
  'Criaturas: 33, de 1/5 a 5/5',
  'Cavernas: 2, com 10 andares cada',
  'Arqueologia: 11 peças',
  '',
  'Obrigado por jogar até o fim.',
];

export interface OpcoesFinal {
  personagem: PersonagemId;
  /** Volta ao mundo, com tudo preservado (pós-jogo). */
  aoContinuar(): void;
  /** Volta ao menu depois de apagar a partida. */
  aoZerar(): void;
}

export class CenaFinal implements Cena {
  private particulas = new Particulas();
  private dialogo = new CaixaDialogo();
  private rng = new Rng(31415);
  private tempo = 0;

  private etapa = 0;
  private tEtapa = 0;
  private falas: Fala[] = [];
  private esperandoFala = false;

  /** Conserto: quantos passos já foram feitos. */
  private passo = 0;
  private batida = 0;
  /** Brilho da máquina depois de pronta. */
  private ligada = 0;
  private clarao = 0;
  private anoAtual = 100_000_000;

  private fundoCabana: Sprite;
  private fundoGalpao: Sprite;
  private menuFinal: ListaBotoes;
  private menuConfirma: ListaBotoes;
  private rolagemCreditos = 0;

  constructor(
    private jogo: Jogo,
    private opcoes: OpcoesFinal,
  ) {
    this.fundoCabana = this.criarFundoCabana();
    this.fundoGalpao = this.criarFundoGalpao();

    const larg = 168;
    const x = Math.round((LARGURA - larg) / 2);
    this.menuFinal = new ListaBotoes([
      new Botao(x, 168, larg, 20, 'CONTINUAR JOGANDO', () => this.continuar()),
      new Botao(x, 194, larg, 20, 'ZERAR', () => this.irParaCreditos()),
    ]);
    this.menuConfirma = new ListaBotoes([
      new Botao(x, 176, larg, 20, 'Não, quero continuar', () => this.cancelarZerar()),
      new Botao(x, 202, larg, 20, 'Sim, apagar a partida', () => this.confirmarZerar()),
    ]);

    this.abrirAto();
  }

  // ------------------------------------------------------------- cenários

  /** Interior da cabana do Ancião: parede de pedra, chão de tábua, lareira. */
  private criarFundoCabana(): Sprite {
    const p = new Pincel(LARGURA, ALTURA);
    const rng = new Rng(707);
    p.retangulo(0, 0, LARGURA, ALTURA, '#171320');
    // parede
    for (let y = 24; y < 176; y++) {
      for (let x = 40; x < LARGURA - 40; x++) {
        const c = rng.chance(0.08) ? '#4a495c' : rng.chance(0.1) ? '#2f2e3d' : '#3a3949';
        p.ponto(x, y, c);
      }
    }
    for (let y = 40; y < 176; y += 14) p.linha(40, y, LARGURA - 41, y, '#2a2937');
    // chão
    for (let y = 176; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const c = rng.chance(0.08) ? '#8d6437' : rng.chance(0.1) ? '#5a3c20' : '#6b4a2b';
        p.ponto(x, y, c);
      }
    }
    for (let y = 180; y < ALTURA; y += 9) p.linha(0, y, LARGURA - 1, y, '#4a3119');
    p.linha(0, 176, LARGURA - 1, 176, P.contorno);
    // janela com a noite lá fora
    p.retangulo(72, 54, 34, 26, '#101c3a');
    p.contorno(70, 52, 38, 30, P.contorno);
    for (let i = 0; i < 12; i++) {
      p.ponto(rng.int(74, 104), rng.int(56, 78), '#cfe4ff');
    }
    return p.finalizar();
  }

  /** Interior do galpão do avô, em 2026: onde tudo começou. */
  private criarFundoGalpao(): Sprite {
    const p = new Pincel(LARGURA, ALTURA);
    const rng = new Rng(909);
    p.retangulo(0, 0, LARGURA, ALTURA, '#14121c');
    for (let y = 20; y < 196; y++) {
      for (let x = 0; x < LARGURA; x++) {
        const c = rng.chance(0.06) ? '#585866' : rng.chance(0.07) ? '#3c3c47' : '#4b4b58';
        p.ponto(x, y, c);
      }
    }
    for (let y = 26; y < 196; y += 12) {
      p.linha(0, y, LARGURA - 1, y, '#3a3a45');
      for (let x = (y % 24 === 2 ? 0 : 12); x < LARGURA; x += 24) p.linha(x, y - 12, x, y - 1, '#3a3a45');
    }
    p.retangulo(0, 196, LARGURA, ALTURA - 196, '#3f3f4a');
    p.linha(0, 196, LARGURA - 1, 196, P.contorno);
    // portão aberto, com a luz do dia entrando
    p.retangulo(300, 60, 108, 98, '#ffe9a8');
    p.retangulo(306, 66, 96, 92, '#fff6d0');
    p.contorno(298, 58, 112, 100, P.contorno);
    return p.finalizar();
  }

  // ---------------------------------------------------------------- falas

  private enfileirar(falas: Fala[]): void {
    this.falas = falas;
    this.proximaFala();
  }

  private proximaFala(): void {
    const f = this.falas.shift();
    if (!f) {
      this.esperandoFala = false;
      this.dialogo.fechar();
      this.avancar();
      return;
    }
    this.dialogo.mostrar(f.quem, f.txt);
    this.esperandoFala = true;
  }

  private get nome(): string {
    return PERSONAGENS[this.opcoes.personagem].nome;
  }

  /** "menino" ou "menina", conforme quem o jogador escolheu. */
  private get garoto(): string {
    return PERSONAGENS[this.opcoes.personagem].genero;
  }

  /** Concordância de gênero nas falas do próprio personagem. */
  private a(palavra: string): string {
    return this.garoto === 'menina' ? `${palavra}a` : `${palavra}o`;
  }

  // ----------------------------------------------------------------- atos

  private abrirAto(): void {
    this.tEtapa = 0;
    switch (this.etapa) {
      case 0:
        this.enfileirar([
          { quem: 'Ancião Belmiro', txt: `Então é você, ${this.nome}. Eu esperei muito tempo por alguém que aguentasse chegar até aqui.` },
          { quem: this.nome, txt: 'O senhor mora aqui sozinho? Desse jeito, ao lado da gruta?' },
          { quem: 'Ancião Belmiro', txt: 'Guardei esta pedra a vida inteira. Chamam de Cronolita. É o coração que falta na sua máquina.' },
          { quem: this.nome, txt: '...é isso mesmo? É só isso que faltava?' },
          { quem: 'Ancião Belmiro', txt: 'Só isso. E dois pares de mãos. Venha, entre — a máquina está aqui dentro.' },
        ]);
        break;
      case 1:
        this.enfileirar([
          { quem: '', txt: 'A porta range. Lá dentro, encostada na parede, está a máquina do tempo do seu avô — enferrujada, torta, e ainda assim de pé.' },
          { quem: 'Ancião Belmiro', txt: 'Ela caiu aqui muito antes de você nascer. Eu nunca soube ligar. Você sabe.' },
          { quem: '', txt: 'BOTÃO ESQUERDO (ou ESPAÇO) para trabalhar na máquina.' },
        ]);
        break;
      case 2:
        // conserto interativo — sem falas
        this.dialogo.fechar();
        break;
      case 3:
        this.enfileirar([
          { quem: 'Ancião Belmiro', txt: `Pronto. O vidro acendeu. Agora é com você, ${this.garoto} do futuro.` },
          { quem: this.nome, txt: `${this.a('Obrigad')} por tudo, seu Belmiro.` },
          { quem: '', txt: 'Aperte E, ESPAÇO ou clique para ligar a máquina.' },
        ]);
        break;
      case 4:
        this.dialogo.fechar();
        this.jogo.audio.trovao();
        this.jogo.audio.portal();
        break;
      case 5:
        this.enfileirar([
          { quem: '', txt: 'O galpão. O cheiro de óleo e poeira. O mesmo pano no chão, do jeito que você deixou.' },
          { quem: 'Mãe', txt: `${this.nome}! Meu Deus, ${this.nome}...` },
          { quem: 'Pai', txt: 'A gente procurou a noite inteira. A noite inteira!' },
          { quem: this.nome, txt: 'Eu voltei. Eu voltei, mãe.' },
          { quem: '', txt: 'Ninguém pergunta onde você esteve. Por enquanto, ninguém precisa perguntar nada.' },
        ]);
        break;
      case 6:
        this.dialogo.fechar();
        break;
    }
  }

  private avancar(): void {
    this.etapa++;
    if (this.etapa > 6) this.etapa = 6;
    this.abrirAto();
  }

  // ------------------------------------------------------------- desfecho

  private continuar(): void {
    this.jogo.audio.confirmar();
    this.opcoes.aoContinuar();
  }

  private irParaCreditos(): void {
    this.jogo.audio.menu();
    this.etapa = 7;
    this.tEtapa = 0;
    this.rolagemCreditos = 0;
  }

  private cancelarZerar(): void {
    this.jogo.audio.menu();
    // volta para a tela de conclusão com tudo intacto
    this.etapa = 6;
    this.tEtapa = 0;
  }

  private confirmarZerar(): void {
    apagarSave();
    this.jogo.audio.confirmar();
    this.opcoes.aoZerar();
  }

  // --------------------------------------------------------- atualização

  atualizar(dt: number): void {
    this.tempo += dt;
    this.tEtapa += dt;
    this.dialogo.atualizar(dt);
    this.particulas.atualizar(dt);
    // o clarão precisa apagar mesmo enquanto uma fala está na tela
    if (this.clarao > 0) this.clarao = Math.max(0, this.clarao - dt * 0.8);
    const e = this.jogo.entrada;
    const avancarFala =
      e.teclaAgora('Space', 'Enter', 'NumpadEnter', 'KeyE') || e.botaoAgora(0);

    if (this.esperandoFala) {
      if (avancarFala) {
        if (!this.dialogo.completa) this.dialogo.apressar();
        else {
          this.jogo.audio.menu();
          this.proximaFala();
        }
      }
      return;
    }

    switch (this.etapa) {
      case 2: {
        // ---- conserto: cada batida avança um passo
        if (this.batida > 0) this.batida -= dt;
        if (avancarFala && this.batida <= 0) {
          this.batida = 0.35;
          this.passo++;
          this.jogo.audio.golpe();
          for (let i = 0; i < 12; i++) {
            const a = this.rng.range(0, TAU);
            this.particulas.pixel(240 + this.rng.range(-8, 8), 116, P.ambar, {
              vx: Math.cos(a) * 60,
              vy: Math.sin(a) * 40,
              vida: 0.6,
              gravidade: 80,
            });
          }
          if (this.passo >= PASSOS_CONSERTO.length) {
            this.jogo.audio.confirmar();
            this.avancar();
          }
        }
        break;
      }
      case 3:
        // ligar a máquina: só depois que as falas acabaram
        if (avancarFala || e.teclaAgora('KeyE')) {
          this.jogo.audio.trovao();
          this.clarao = 0.8;
          this.avancar();
        }
        break;
      case 4: {
        // ---- túnel do tempo: a contagem de anos volta para 2026
        this.ligada = Math.min(1, this.ligada + dt * 0.5);
        const t = clamp(this.tEtapa / 5, 0, 1);
        this.anoAtual = Math.round(100_000_000 - (100_000_000 - 2026) * (t * t));
        if (this.tEtapa > 1.2 && this.clarao <= 0 && t < 1) this.clarao = 0;
        if (t >= 1) {
          this.clarao = 1;
          this.avancar();
        }
        break;
      }
      case 6:
        this.menuFinal.atualizar(
          e,
          () => this.jogo.audio.menu(),
          () => this.jogo.audio.confirmar(),
        );
        break;
      case 7:
        // ---- créditos rolando
        this.rolagemCreditos += dt * 26;
        if (
          this.rolagemCreditos > CREDITOS.length * 12 + ALTURA ||
          e.teclaAgora('Space', 'Enter', 'Escape') ||
          e.botaoAgora(0)
        ) {
          this.etapa = 8;
          this.tEtapa = 0;
        }
        break;
      case 8:
        this.menuConfirma.atualizar(
          e,
          () => this.jogo.audio.menu(),
          () => this.jogo.audio.confirmar(),
        );
        break;
    }

    if (this.etapa === 5 && this.rng.chance(dt * 6)) {
      // poeira no facho de luz do portão do galpão
      this.particulas.pixel(this.rng.range(300, 408), this.rng.range(60, 150), '#fff6d0', {
        vy: 6,
        vida: 1.6,
      });
    }
  }

  // -------------------------------------------------------------- desenho

  desenhar(g: CanvasRenderingContext2D): void {
    const a = this.jogo.assets;

    if (this.etapa <= 3) this.desenharCabana(g);
    else if (this.etapa === 4) this.desenharTunel(g);
    else if (this.etapa === 5) this.desenharGalpao(g);
    else if (this.etapa === 6) this.desenharConclusao(g);
    else if (this.etapa === 7) this.desenharCreditos(g);
    else this.desenharConfirmacao(g);

    if (this.etapa <= 5) this.particulas.desenhar(g, 0, 0);
    void a;

    if (this.clarao > 0) {
      g.globalAlpha = this.clarao;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, LARGURA, ALTURA);
      g.globalAlpha = 1;
    }

    this.dialogo.desenhar(g);
    if (this.jogo.entrada.mouseNaTela && this.etapa >= 6) {
      // nas telas de escolha o cursor é útil
      const c = a.ui.cursor;
      g.drawImage(c, this.jogo.entrada.mouseX, this.jogo.entrada.mouseY);
    }
  }

  /**
   * Desenha um sprite em dobro, apoiado no chão.
   *
   * A cinemática é uma cena fechada: em escala 1 os bonecos ficariam do tamanho
   * de uma unha no meio da tela. Como tudo aqui é ampliado por 2 (inteiro), os
   * pixels continuam quadrados e a leitura melhora muito.
   */
  private emDobro(g: CanvasRenderingContext2D, s: Sprite, cx: number, base: number): void {
    const w = s.width * 2;
    const h = s.height * 2;
    g.drawImage(s, Math.round(cx - w / 2), Math.round(base - h), w, h);
  }

  private desenharPersonagens(g: CanvasRenderingContext2D, chaoY: number): void {
    const a = this.jogo.assets;
    const quadro = Math.floor(this.tempo * 4) % 3;
    // o Ancião, à esquerda da máquina
    const anc = a.historia.anciao[Math.floor(this.tempo * 1.6) % 2];
    this.emDobro(g, anc, 128, chaoY);
    // o personagem escolhido, à direita
    const jog = a.personagens[this.opcoes.personagem].direita[this.etapa === 2 ? quadro : 0];
    this.emDobro(g, jog, 348, chaoY);
  }

  private desenharCabana(g: CanvasRenderingContext2D): void {
    const a = this.jogo.assets;
    g.drawImage(this.fundoCabana, 0, 0);

    // a máquina: quebrada até o conserto terminar
    const pronta = this.etapa >= 3;
    const s = pronta ? a.historia.maquinaPronta : a.historia.maquinaQuebrada;
    const chao = 176;
    const mx = Math.round(LARGURA / 2 - s.width);
    const my = chao - s.height * 2;
    this.emDobro(g, s, LARGURA / 2, chao);
    if (pronta) {
      const pulso = 0.5 + Math.sin(this.tempo * 4) * 0.3;
      g.globalAlpha = pulso * 0.5;
      g.fillStyle = P.ambar;
      g.fillRect(mx + 8, my + 20, s.width * 2 - 16, s.height * 2 - 32);
      g.globalAlpha = 1;
      // faíscas subindo da máquina ligada
      if (this.rng.chance(0.25)) {
        this.particulas.pixel(LARGURA / 2 + this.rng.range(-14, 14), my + 12, P.ambar, {
          vy: -20,
          vida: 0.9,
        });
      }
    }

    this.desenharPersonagens(g, chao);

    // ---- barra do conserto
    if (this.etapa === 2) {
      const larg = 180;
      const x = Math.round((LARGURA - larg) / 2);
      const y = 26;
      texto(g, PASSOS_CONSERTO[Math.min(this.passo, PASSOS_CONSERTO.length - 1)], LARGURA / 2, y - 12, {
        cor: P.osso,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      g.fillStyle = P.contorno;
      g.fillRect(x, y, larg, 8);
      g.fillStyle = '#3a2b33';
      g.fillRect(x + 1, y + 1, larg - 2, 6);
      g.fillStyle = P.ambar;
      g.fillRect(x + 1, y + 1, Math.round(((larg - 2) * this.passo) / PASSOS_CONSERTO.length), 6);
      texto(g, `${this.passo}/${PASSOS_CONSERTO.length}`, LARGURA / 2, y + 12, {
        cor: P.ambar,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
    }

    if (this.etapa === 3) {
      const piscar = Math.floor(this.tempo * 2) % 2 === 0;
      if (piscar && !this.esperandoFala) {
        texto(g, '[E] LIGAR A MÁQUINA', LARGURA / 2, 210, {
          cor: P.ambar,
          sombra: P.contorno,
          contorno: true,
          alinhamento: 'centro',
        });
      }
    }
  }

  private desenharTunel(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    const cx = LARGURA / 2;
    const cy = ALTURA / 2;
    const t = this.tEtapa;
    // anéis correndo para o fundo
    for (let i = 0; i < 16; i++) {
      const fase = ((t * 0.7 + i / 16) % 1);
      const raio = 8 + fase * 220;
      g.globalAlpha = (1 - fase) * 0.7;
      g.strokeStyle = i % 2 === 0 ? P.magiaClara : P.ambar;
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(cx, cy, raio, raio * 0.62, 0, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
    // riscos de luz
    for (let i = 0; i < 28; i++) {
      const ang = (i / 28) * TAU + t * 0.4;
      const r0 = 20 + ((t * 160 + i * 23) % 180);
      const r1 = r0 + 26;
      g.strokeStyle = i % 3 === 0 ? '#ffffff' : P.magiaClara;
      g.globalAlpha = clamp(1 - r0 / 200, 0, 1) * 0.8;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.62);
      g.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.62);
      g.stroke();
    }
    g.globalAlpha = 1;

    const ano = this.anoAtual > 9999 ? `${(this.anoAtual / 1_000_000).toFixed(1)} MILHÕES A.C.` : String(this.anoAtual);
    textoGrande(g, ano, cx, cy - 8, 2, {
      cor: P.ambar,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    texto(g, 'voltando para casa', cx, cy + 22, {
      cor: P.osso,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
  }

  private desenharGalpao(g: CanvasRenderingContext2D): void {
    const a = this.jogo.assets;
    g.drawImage(this.fundoGalpao, 0, 0);
    // o pano caído no chão e a máquina desligada, ao fundo
    g.fillStyle = '#5a4a6a';
    g.fillRect(72, 186, 70, 10);
    g.fillStyle = P.contorno;
    g.fillRect(72, 186, 70, 1);

    const chaoY = 196;
    const jog = a.personagens[this.opcoes.personagem].cima[0];
    this.emDobro(g, a.historia.mae, 168, chaoY);
    this.emDobro(g, jog, 240, chaoY);
    this.emDobro(g, a.historia.pai, 312, chaoY);

    // coraçõezinhos subindo, discretos
    if (this.rng.chance(0.06)) {
      this.particulas.pixel(240 + this.rng.range(-26, 26), chaoY - 46, P.coracaoLuz, {
        vy: -18,
        vida: 1.2,
      });
    }
  }

  private desenharConclusao(g: CanvasRenderingContext2D): void {
    g.drawImage(this.fundoGalpao, 0, 0);
    g.globalAlpha = 0.78;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;

    textoGrande(g, 'FIM DA HISTÓRIA', LARGURA / 2, 44, 3, {
      cor: P.ambar,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    const linhas = [
      `${this.nome} voltou para 2026 e reencontrou os pais.`,
      'O vale continua lá, com tudo o que você ainda não viu.',
    ];
    paragrafo(g, linhas, LARGURA / 2, 96, {
      cor: P.osso,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    texto(g, 'Continuar mantém tudo: bolsa, dinheiro, coleção e conquistas.', LARGURA / 2, 134, {
      cor: '#a89fbe',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    texto(g, 'Zerar mostra os créditos e encerra esta partida.', LARGURA / 2, 146, {
      cor: '#8b83a3',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    this.menuFinal.desenhar(g);
  }

  private desenharCreditos(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    // estrelinhas de fundo
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % LARGURA;
      const y = (i * 53 + Math.floor(this.tempo * 6)) % ALTURA;
      g.fillStyle = i % 5 === 0 ? P.ambar : '#3a3450';
      g.fillRect(x, y, 1, 1);
    }
    CREDITOS.forEach((linha, i) => {
      const y = ALTURA + i * 12 - this.rolagemCreditos;
      if (y < -12 || y > ALTURA) return;
      if (i === 0) {
        textoGrande(g, linha, LARGURA / 2, y, 2, {
          cor: P.ambar,
          sombra: P.contorno,
          contorno: true,
          alinhamento: 'centro',
        });
      } else {
        texto(g, linha, LARGURA / 2, y, {
          cor: P.osso,
          sombra: P.contorno,
          alinhamento: 'centro',
        });
      }
    });
    texto(g, 'ESPAÇO pula os créditos', LARGURA / 2, ALTURA - 12, {
      cor: '#5b5470',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
  }

  private desenharConfirmacao(g: CanvasRenderingContext2D): void {
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    textoGrande(g, 'VOCÊ REALMENTE', LARGURA / 2, 46, 2, {
      cor: P.coracao,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    textoGrande(g, 'NÃO QUER JOGAR MAIS?', LARGURA / 2, 74, 2, {
      cor: P.coracao,
      sombra: P.contorno,
      contorno: true,
      alinhamento: 'centro',
    });
    paragrafo(
      g,
      [
        'Escolher "Sim" apaga a partida salva para sempre:',
        'personagem, dinheiro, bolsa, coleção, bestiário,',
        'andares de caverna e missões concluídas.',
        '',
        'Isso não pode ser desfeito.',
      ],
      LARGURA / 2,
      108,
      { cor: P.osso, sombra: P.contorno, alinhamento: 'centro' },
    );
    this.menuConfirma.desenhar(g);
  }
}
