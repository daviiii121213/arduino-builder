/**
 * Dinossauros: uma única classe governada pela ficha da espécie.
 *
 * Comportamentos:
 *   carnívoro  — caça o jogador ao percebê-lo e morde de perto;
 *   herbívoro  — pasta em paz e foge quando é ferido (o Tricornis revida);
 *   terrestre  — lento e territorial: só ataca quem invade seu espaço;
 *   aquático   — nunca sai da água e ataca quem entra nela;
 *   mágico     — flutua, dispara orbes e se teletransporta ao ser ferido.
 */

import { FICHAS, type FichaDino } from './dinoTypes';
import type { EspecieId } from '../gfx/sprites/dinos';
import { livre, mover, type Pegada } from '../systems/collision';
import { clamp, damp, dist, TAU } from '../core/math';
import { Rng } from '../core/rng';
import { tingirCache } from '../gfx/pixel';
import { P } from '../gfx/palette';
import { texto } from '../gfx/font';
import type { Mundo } from './context';
import { PROPS } from '../world/tiles';

type Estado =
  | 'vagar'
  | 'pastar'
  | 'perseguir'
  | 'preparar'
  | 'recuar'
  | 'fugir'
  | 'atordoado'
  | 'voltando';

const TEMPO_RESSURGIR = 26;

let contadorId = 0;

export class Dino {
  readonly ficha: FichaDino;
  readonly id: number;
  x: number;
  y: number;
  vida: number;
  estado: Estado = 'vagar';
  /** true enquanto tem vida; ao morrer entra em contagem para reaparecer. */
  vivo = true;

  private vx = 0;
  private vy = 0;
  private olhandoDireita = true;
  private animTempo = 0;
  private tempoEstado = 0;
  private alvoX = 0;
  private alvoY = 0;
  private recarga = 0;
  private preparo = 0;
  private piscar = 0;
  private mostrarVida = 0;
  private alerta = 0;
  private calma = 0;
  private tempoMorte = 0;
  private bob = 0;
  private rng: Rng;
  private pegada: Pegada;
  private vezesFerido = 0;
  /** Enquanto for maior que zero, o dino ignora o jogador (acabou de desistir). */
  private desinteresse = 0;
  /**
   * Tempo total de caçada. Diferente de `tempoEstado`, não reinicia entre
   * perseguir/preparar/recuar — é o que garante que a perseguição acaba.
   */
  private tempoPerseguindo = 0;
  private empurraoX = 0;
  private empurraoY = 0;

  constructor(
    especie: EspecieId,
    public readonly nascimentoX: number,
    public readonly nascimentoY: number,
  ) {
    this.ficha = FICHAS[especie];
    this.id = ++contadorId;
    this.x = nascimentoX;
    this.y = nascimentoY;
    this.vida = this.ficha.vidaMax;
    this.rng = new Rng(1000 + this.id * 7919);
    this.pegada = {
      x: this.x,
      y: this.y,
      metadeW: this.ficha.pegada.w / 2,
      metadeH: this.ficha.pegada.h / 2,
      podeNadar: this.ficha.aquatico,
      ignoraObjetos: this.ficha.flutua,
    };
    this.bob = this.rng.range(0, TAU);
    this.escolherDestino();
    this.estado = this.ficha.categoria === 'herbivoro' ? 'pastar' : 'vagar';
  }

  get centroY(): number {
    return this.y - this.alturaArte * 0.45;
  }

  get raioCorpo(): number {
    return this.ficha.raioCorpo;
  }

  private alturaArte = 20;

  // --------------------------------------------------------------- decisões

  private escolherDestino(): void {
    const raio = this.ficha.aquatico ? 90 : this.ficha.territorial ? 70 : 130;
    const a = this.rng.range(0, TAU);
    const d = this.rng.range(20, raio);
    this.alvoX = this.nascimentoX + Math.cos(a) * d;
    this.alvoY = this.nascimentoY + Math.sin(a) * d;
  }

  private trocarEstado(e: Estado): void {
    this.estado = e;
    this.tempoEstado = 0;
    // sair da caçada zera o cronômetro de paciência
    if (e === 'vagar' || e === 'pastar' || e === 'voltando' || e === 'fugir') {
      this.tempoPerseguindo = 0;
    }
  }

  atualizar(dt: number, mundo: Mundo): void {
    const f = this.ficha;
    this.animTempo += dt;
    this.tempoEstado += dt;
    this.bob += dt * 3;
    if (this.piscar > 0) this.piscar -= dt;
    if (this.mostrarVida > 0) this.mostrarVida -= dt;
    if (this.alerta > 0) this.alerta -= dt;
    if (this.calma > 0) this.calma -= dt;
    if (this.recarga > 0) this.recarga -= dt;
    if (this.desinteresse > 0) this.desinteresse -= dt;
    if (this.estado === 'perseguir' || this.estado === 'preparar' || this.estado === 'recuar') {
      this.tempoPerseguindo += dt;
    }

    // ---- morto: espera para reaparecer
    if (!this.vivo) {
      this.tempoMorte += dt;
      if (this.tempoMorte >= TEMPO_RESSURGIR) this.renascer(mundo);
      return;
    }

    const j = mundo.jogador;
    const distJogador = j.vivo ? dist(this.x, this.centroY, j.centroX, j.centroY) : Infinity;
    const jogadorNaAgua = j.vivo && PROPS[mundo.nivel.tileEm(j.x, j.y)].agua;

    // ---- percepção (desligada por alguns segundos depois de desistir)
    const distDeCasa = dist(this.x, this.y, this.nascimentoX, this.nascimentoY);
    let percebe = false;
    if (j.vivo && this.desinteresse <= 0) {
      if (f.aquatico) {
        // só se interessa por quem entra na água (ou chega bem na beira)
        percebe = distJogador < f.percepcao && (jogadorNaAgua || distJogador < 46);
      } else if (f.territorial) {
        percebe = distJogador < f.percepcao;
      } else if (f.agressivo) {
        percebe = distJogador < f.percepcao;
      } else {
        percebe = false;
      }
    }

    if (percebe && (this.estado === 'vagar' || this.estado === 'pastar')) {
      this.trocarEstado('perseguir');
      this.alerta = 1;
      if (this.rng.chance(0.6)) mundo.audio.rugido(f.vidaMax > 28);
    }

    // ---- máquina de estados
    switch (this.estado) {
      case 'vagar':
      case 'pastar': {
        const chegou = dist(this.x, this.y, this.alvoX, this.alvoY) < 12;
        const paradoDemais = this.tempoEstado > (this.estado === 'pastar' ? 5 : 4);
        if (chegou || paradoDemais) {
          this.escolherDestino();
          this.tempoEstado = 0;
          if (f.categoria === 'herbivoro' && this.rng.chance(0.5)) {
            this.calma = 1.6;
          }
        }
        // herbívoros param para comer de vez em quando
        const parado = f.categoria === 'herbivoro' && this.calma > 0.8;
        this.irPara(parado ? this.x : this.alvoX, parado ? this.y : this.alvoY, f.velocidade * 0.6, dt, mundo);
        break;
      }

      case 'perseguir': {
        // desiste se o jogador escapou, se saiu do território ou se cansou
        const escapou = !j.vivo || distJogador > f.percepcao * 1.6;
        const longeDeCasa = distDeCasa > f.raioTerritorio;
        const cansou = this.tempoPerseguindo > f.paciencia;
        if (escapou || longeDeCasa || cansou) {
          this.desinteresse = escapou ? 2.5 : 6;
          this.trocarEstado('voltando');
          if (longeDeCasa || cansou) mundo.particulas.texto('...', this.x, this.centroY - 10, '#a89fbe');
          break;
        }
        // aquáticos não saem da água: rondam a margem mais próxima
        const alcanceUtil = f.distancia ? f.alcance : f.alcance + f.pegada.w / 2;
        if (distJogador <= alcanceUtil && this.recarga <= 0) {
          this.preparo = f.preparo;
          this.trocarEstado('preparar');
          break;
        }
        if (f.distancia && distJogador < f.alcance * 0.55) {
          // mágicos mantêm distância
          this.irPara(
            this.x - (j.centroX - this.x),
            this.y - (j.centroY - this.y),
            f.velocidade,
            dt,
            mundo,
          );
          break;
        }
        this.irPara(j.centroX, j.y, f.velocidadeCorrida, dt, mundo);
        break;
      }

      case 'preparar': {
        this.preparo -= dt;
        this.vx = damp(this.vx, 0, 12, dt);
        this.vy = damp(this.vy, 0, 12, dt);
        this.deslocar(dt, mundo);
        if (this.preparo <= 0) {
          this.executarAtaque(mundo);
          this.recarga = f.recarga;
          this.trocarEstado('recuar');
        }
        break;
      }

      case 'recuar': {
        // pequena pausa depois do golpe (janela para o jogador responder)
        this.vx = damp(this.vx, 0, 8, dt);
        this.vy = damp(this.vy, 0, 8, dt);
        this.deslocar(dt, mundo);
        if (this.tempoEstado > 0.45) this.trocarEstado('perseguir');
        break;
      }

      case 'voltando': {
        // volta caminhando para o próprio território e retoma a rotina
        this.irPara(this.nascimentoX, this.nascimentoY, f.velocidade * 0.9, dt, mundo);
        if (distDeCasa < 24 || this.tempoEstado > 12) {
          this.escolherDestino();
          this.trocarEstado(f.categoria === 'herbivoro' ? 'pastar' : 'vagar');
        }
        break;
      }

      case 'fugir': {
        const ax = this.x - (j.centroX - this.x);
        const ay = this.y - (j.centroY - this.y);
        this.irPara(ax, ay, f.velocidadeCorrida, dt, mundo);
        if (this.tempoEstado > 4 || distJogador > f.percepcao * 1.6) {
          this.desinteresse = 3;
          this.trocarEstado(distDeCasa > f.raioTerritorio ? 'voltando' : 'vagar');
          this.escolherDestino();
        }
        break;
      }

      case 'atordoado': {
        this.vx = damp(this.vx, 0, 6, dt);
        this.vy = damp(this.vy, 0, 6, dt);
        this.deslocar(dt, mundo);
        if (this.tempoEstado > 0.35) {
          this.trocarEstado(f.medroso && this.vezesFerido < 3 ? 'fugir' : 'perseguir');
        }
        break;
      }
    }

    // ---- rastro de quem corre: cada estilo levanta uma coisa diferente
    if (this.estado === 'perseguir' && this.rng.chance(dt * 9)) {
      const cor =
        this.ficha.bioma === 'deserto'
          ? '#e8d7a0'
          : this.ficha.bioma === 'vulcanico'
            ? '#ffb14a'
            : this.ficha.bioma === 'pantano'
              ? '#5f7d4a'
              : '#a89fbe';
      mundo.particulas.pixel(this.x + this.rng.range(-6, 6), this.y, cor, {
        vy: -14,
        vida: 0.5,
        gravidade: 20,
      });
    }

    // ---- brilho e faíscas dos mágicos
    if (f.flutua && this.rng.chance(dt * 8)) {
      mundo.particulas.pixel(
        this.x + this.rng.range(-10, 10),
        this.centroY + this.rng.range(-8, 8),
        f.corSangue,
        { vida: 0.6, vy: -12 },
      );
    }
    // ---- ondulações dos aquáticos
    if (f.aquatico && this.rng.chance(dt * 3)) {
      mundo.particulas.animacao(mundo.assets.efeitos.respingo, this.x, this.y + 2, 0.5);
    }

    // ---- não deixa dois dinos ocuparem o mesmo lugar
    for (const outro of mundo.dinos) {
      if (outro === this || !outro.vivo) continue;
      const d = dist(this.x, this.y, outro.x, outro.y);
      const min = (this.ficha.pegada.w + outro.ficha.pegada.w) * 0.6;
      if (d > 0.001 && d < min) {
        const empurra = ((min - d) / min) * 40;
        this.vx += ((this.x - outro.x) / d) * empurra;
        this.vy += ((this.y - outro.y) / d) * empurra;
      }
    }
  }

  /** Vai na direção de um ponto, com aceleração e colisão. */
  private irPara(tx: number, ty: number, velocidade: number, dt: number, mundo: Mundo): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const alvoVx = (dx / d) * velocidade;
    const alvoVy = (dy / d) * velocidade;
    this.vx = damp(this.vx, alvoVx, 7, dt);
    this.vy = damp(this.vy, alvoVy, 7, dt);
    if (Math.abs(this.vx) > 4) this.olhandoDireita = this.vx > 0;
    this.deslocar(dt, mundo);
  }

  private deslocar(dt: number, mundo: Mundo): void {
    this.empurraoX = damp(this.empurraoX, 0, 8, dt);
    this.empurraoY = damp(this.empurraoY, 0, 8, dt);
    this.pegada.x = this.x;
    this.pegada.y = this.y;
    const r = mover(
      mundo.nivel,
      this.pegada,
      (this.vx + this.empurraoX) * dt,
      (this.vy + this.empurraoY) * dt,
    );
    if (r.bateuX) {
      this.vx *= -0.4;
      if (this.estado === 'vagar' || this.estado === 'pastar') this.escolherDestino();
    }
    if (r.bateuY) {
      this.vy *= -0.4;
      if (this.estado === 'vagar' || this.estado === 'pastar') this.escolherDestino();
    }
    this.x = r.x;
    this.y = r.y;
  }

  private executarAtaque(mundo: Mundo): void {
    const f = this.ficha;
    const j = mundo.jogador;
    if (!j.vivo) return;
    const ang = Math.atan2(j.centroY - this.centroY, j.centroX - this.x);

    if (f.distancia) {
      mundo.criarOrbe(this.x + Math.cos(ang) * 10, this.centroY + Math.sin(ang) * 10, ang, f.dano, 118);
      mundo.audio.magia();
      mundo.particulas.animacao(mundo.assets.efeitos.ondaMagica, this.x, this.centroY, 0.3);
      return;
    }

    // investida corpo a corpo
    this.vx += Math.cos(ang) * 150;
    this.vy += Math.sin(ang) * 150;
    const distanciaAtual = dist(this.x, this.centroY, j.centroX, j.centroY);
    if (distanciaAtual <= f.alcance + f.pegada.w / 2 + 6) {
      j.receberDano(f.dano, this.x, this.centroY, mundo);
      if (f.veneno) j.envenenar(f.veneno, mundo);
      mundo.particulas.animacao(mundo.assets.efeitos.faisca, j.centroX, j.centroY, 0.25);
    } else {
      // errou: poeira no chão
      mundo.particulas.animacao(
        mundo.assets.efeitos.poeira,
        this.x + Math.cos(ang) * 12,
        this.y,
        0.3,
      );
    }
    mundo.audio.rugido(f.vidaMax > 28);
    mundo.camera.tremer(f.vidaMax > 28 ? 3 : 1.6, 0.2);
  }

  // ------------------------------------------------------------------- dano

  receberDano(dano: number, angulo: number, empurrao: number, mundo: Mundo): void {
    if (!this.vivo) return;
    this.vida -= dano;
    this.vezesFerido++;
    this.piscar = 0.28;
    this.mostrarVida = 4;
    this.empurraoX += Math.cos(angulo) * empurrao;
    this.empurraoY += Math.sin(angulo) * empurrao;

    mundo.particulas.jato(
      this.x,
      this.centroY,
      [this.ficha.corSangue, '#ffffff', this.ficha.corSangue],
      10,
      95,
    );
    mundo.particulas.animacao(mundo.assets.efeitos.faisca, this.x, this.centroY, 0.22);
    mundo.particulas.texto(`${dano}`, this.x, this.centroY - 8, P.ambar);

    if (this.vida <= 0) {
      this.morrer(mundo);
      return;
    }

    // reações por categoria
    if (this.ficha.teleporta) {
      this.teleportar(mundo);
      this.trocarEstado('perseguir');
    } else if (this.ficha.medroso && this.vezesFerido < 3) {
      this.trocarEstado('fugir');
    } else {
      this.trocarEstado('atordoado');
    }
    mundo.audio.rugido(this.ficha.vidaMax > 28);
  }

  private teleportar(mundo: Mundo): void {
    mundo.particulas.animacao(mundo.assets.efeitos.explosaoMagica, this.x, this.centroY, 0.3);
    for (let tent = 0; tent < 30; tent++) {
      const a = this.rng.range(0, TAU);
      const d = this.rng.range(48, 90);
      const nx = this.x + Math.cos(a) * d;
      const ny = this.y + Math.sin(a) * d;
      this.pegada.x = nx;
      this.pegada.y = ny;
      if (livre(mundo.nivel, this.pegada, nx, ny)) {
        this.x = nx;
        this.y = ny;
        break;
      }
    }
    this.vx = 0;
    this.vy = 0;
    mundo.particulas.animacao(mundo.assets.efeitos.explosaoMagica, this.x, this.centroY, 0.3);
    mundo.audio.portal();
  }

  private morrer(mundo: Mundo): void {
    this.vivo = false;
    mundo.aoAbater?.(this.ficha.id);
    this.tempoMorte = 0;
    this.vida = 0;
    mundo.audio.morte();
    mundo.camera.tremer(this.ficha.vidaMax > 28 ? 5 : 3, 0.35);
    mundo.particulas.jato(
      this.x,
      this.centroY,
      [this.ficha.corSangue, P.osso, '#ffffff'],
      26,
      120,
      { vida: 0.9, gravidade: 130 },
    );
    mundo.particulas.animacao(mundo.assets.efeitos.ondaBranca, this.x, this.centroY, 0.4);
    mundo.particulas.texto(this.ficha.nome, this.x, this.centroY - 14, P.osso, '#161320', 1.4);
  }

  private renascer(mundo: Mundo): void {
    this.x = this.nascimentoX;
    this.y = this.nascimentoY;
    this.vida = this.ficha.vidaMax;
    this.vivo = true;
    this.vezesFerido = 0;
    this.vx = 0;
    this.vy = 0;
    this.desinteresse = 0;
    this.trocarEstado(this.ficha.categoria === 'herbivoro' ? 'pastar' : 'vagar');
    mundo.particulas.animacao(mundo.assets.efeitos.ondaBranca, this.x, this.centroY, 0.5);
  }

  // ---------------------------------------------------------------- desenho

  desenhar(g: CanvasRenderingContext2D, mundo: Mundo, camX: number, camY: number): void {
    const arte = mundo.assets.dinos[this.ficha.id];
    this.alturaArte = arte.h;
    const quadros = this.olhandoDireita ? arte.direita : arte.esquerda;
    const andando = Math.hypot(this.vx, this.vy) > 5;

    // ---- cada estilo de andar tem a sua cadência e o seu balanço
    const correndo =
      this.estado === 'perseguir' || this.estado === 'fugir' || this.estado === 'preparar';
    const estilo = this.ficha.estilo;
    const cadencia =
      estilo === 'rasteja' ? 5 : estilo === 'salta' ? 10 : estilo === 'ondula' ? 8 : 7;
    const idx = andando
      ? Math.floor(this.animTempo * (correndo ? cadencia * 1.5 : cadencia)) % quadros.length
      : 0;
    let balanco = 0;
    if (estilo === 'salta' && andando) {
      // pula a cada passada, mais alto quando corre
      balanco = -Math.abs(Math.sin(this.animTempo * (correndo ? 15 : 9))) * (correndo ? 4 : 2.5);
    } else if (estilo === 'ondula') {
      // o corpo comprido ondula mesmo parado
      balanco = Math.sin(this.animTempo * (andando ? 7 : 2.5)) * 1.5;
    } else if (estilo === 'rasteja') {
      // vive colado no chão
      balanco = 2 + (andando ? Math.sin(this.animTempo * 5) : 0);
    } else if (estilo === 'passos' && andando && correndo) {
      // a passada pesada sacode o corpo
      balanco = Math.sin(this.animTempo * 14) * 1;
    }
    let sprite = quadros[idx];

    // efeito de morte: some com brilho
    if (!this.vivo) {
      const t = clamp(this.tempoMorte / 0.6, 0, 1);
      if (t >= 1) return;
      g.globalAlpha = 1 - t;
      sprite = tingirCache(sprite, P.brilho, t);
    }

    const flutuando = this.ficha.flutua ? Math.sin(this.bob) * 2.5 : 0;
    const submerso = this.ficha.aquatico ? 4 : 0;
    const px = Math.round(this.x - sprite.width / 2 - camX);
    const py = Math.round(this.y - sprite.height - camY - flutuando + submerso + balanco);

    // sombra
    const sombra = mundo.assets.sombras[this.ficha.sombra];
    g.globalAlpha = (this.vivo ? 1 : 1 - this.tempoMorte / 0.6) * (this.ficha.aquatico ? 0.2 : 0.45);
    g.drawImage(
      sombra,
      Math.round(this.x - sombra.width / 2 - camX),
      Math.round(this.y - camY) - 3,
    );
    g.globalAlpha = this.vivo ? 1 : Math.max(0, 1 - this.tempoMorte / 0.6);

    // preparo do ataque: o corpo brilha em vermelho (aviso justo ao jogador)
    if (this.estado === 'preparar') {
      const pulso = 0.35 + Math.sin(this.tempoEstado * 26) * 0.25;
      // o aviso do golpe usa a cor da própria criatura: dá para reconhecer de longe
      sprite = tingirCache(sprite, this.ficha.veneno ? '#8fe05a' : this.ficha.corSangue, pulso);
    } else if (this.piscar > 0 && Math.floor(this.piscar * 20) % 2 === 0) {
      sprite = tingirCache(sprite, '#ffffff', 0.85);
    }

    g.drawImage(sprite, px, py);
    g.globalAlpha = 1;

    // parte submersa dos aquáticos: linha d'água
    if (this.ficha.aquatico && this.vivo) {
      g.fillStyle = P.aguaEspuma;
      const larg = this.ficha.pegada.w + 6 + Math.round(Math.sin(mundo.tempo * 5 + this.id) * 2);
      g.fillRect(Math.round(this.x - larg / 2 - camX), Math.round(this.y - camY) - 3, larg, 1);
    }

    if (!this.vivo) return;

    // ícones de estado
    if (this.alerta > 0) {
      const s = mundo.assets.efeitos.alerta;
      const salto = Math.abs(Math.sin(this.alerta * 12)) * 2;
      g.drawImage(
        s,
        Math.round(this.x - s.width / 2 - camX),
        Math.round(py - 10 - salto),
      );
    } else if (this.calma > 0 && this.ficha.categoria === 'herbivoro') {
      const s = mundo.assets.efeitos.calma;
      g.globalAlpha = clamp(this.calma, 0, 1);
      g.drawImage(s, Math.round(this.x - s.width / 2 - camX), Math.round(py - 9));
      g.globalAlpha = 1;
    }

    // barra de vida flutuante e nome
    if (this.mostrarVida > 0) {
      const larg = Math.max(20, this.ficha.pegada.w + 14);
      const bx = Math.round(this.x - larg / 2 - camX);
      const by = Math.round(py - 7);
      const alpha = clamp(this.mostrarVida, 0, 1);
      g.globalAlpha = alpha;
      g.fillStyle = P.contorno;
      g.fillRect(bx, by, larg, 5);
      g.fillStyle = '#3a2b33';
      g.fillRect(bx + 1, by + 1, larg - 2, 3);
      const prop = clamp(this.vida / this.ficha.vidaMax, 0, 1);
      g.fillStyle = prop > 0.5 ? '#57a544' : prop > 0.25 ? P.ambar : P.coracao;
      g.fillRect(bx + 1, by + 1, Math.round((larg - 2) * prop), 3);
      g.fillStyle = P.brilho;
      g.fillRect(bx + 1, by + 1, Math.round((larg - 2) * prop), 1);
      texto(g, this.ficha.nome, Math.round(this.x - camX), by - 10, {
        cor: P.osso,
        sombra: P.contorno,
        contorno: true,
        alinhamento: 'centro',
      });
      g.globalAlpha = 1;
    }
  }

  /** Linha de base para ordenar a profundidade do desenho. */
  get baseY(): number {
    return this.y;
  }
}
