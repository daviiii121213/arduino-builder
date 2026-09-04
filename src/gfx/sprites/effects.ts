/**
 * Efeitos visuais: arco do golpe, faíscas de impacto, poeira, respingos de
 * água, orbe mágica e ondas de choque. Todos gerados pixel a pixel.
 */

import { Pincel, type Sprite } from '../pixel';
import { P } from '../palette';
import { TAU } from '../../core/math';

const TAM_ARCO = 40;

/** Arco do golpe da lança, apontando para a direita. Centro em (20,20). */
function arcoGolpe(quadro: number, total: number): Sprite {
  const p = new Pincel(TAM_ARCO, TAM_ARCO);
  const cx = TAM_ARCO / 2;
  const cy = TAM_ARCO / 2;
  const t = quadro / (total - 1);
  const raio = 9 + t * 8;
  const abertura = 0.55 + t * 0.55;
  const espessura = Math.max(1, 3.2 - t * 2.2);
  const alpha = 1 - t * 0.55;
  for (let a = -abertura; a <= abertura; a += 0.015) {
    // o golpe sai de cima para baixo: fica mais forte no meio do arco
    const forca = 1 - Math.abs(a) / abertura;
    for (let e = 0; e < espessura + forca; e += 0.5) {
      const r = raio + e;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const cor = e < 1 ? P.brilho : forca > 0.5 ? '#ffe9a8' : P.ambar;
      p.ponto(x, y, cor, alpha * (0.45 + forca * 0.55));
    }
  }
  return p.finalizar();
}

/** Faísca de acerto — estrela de quatro pontas que cresce e apaga. */
function faisca(quadro: number, total: number): Sprite {
  const tam = 15;
  const p = new Pincel(tam, tam);
  const c = (tam - 1) / 2;
  const t = quadro / (total - 1);
  const r = 2 + t * 5;
  const alpha = 1 - t * 0.8;
  for (let i = 0; i <= r; i++) {
    const cor = i < r * 0.4 ? P.brilho : i < r * 0.75 ? P.ambar : P.fogo;
    p.ponto(c + i, c, cor, alpha);
    p.ponto(c - i, c, cor, alpha);
    p.ponto(c, c + i, cor, alpha);
    p.ponto(c, c - i, cor, alpha);
    if (i < r * 0.6) {
      p.ponto(c + i, c + i, cor, alpha * 0.7);
      p.ponto(c - i, c + i, cor, alpha * 0.7);
      p.ponto(c + i, c - i, cor, alpha * 0.7);
      p.ponto(c - i, c - i, cor, alpha * 0.7);
    }
  }
  return p.finalizar();
}

/** Nuvem de poeira dos passos. */
function poeira(quadro: number, total: number): Sprite {
  const tam = 14;
  const p = new Pincel(tam, tam);
  const t = quadro / (total - 1);
  const r = 2 + t * 4;
  const alpha = 0.65 * (1 - t);
  for (let a = 0; a < TAU; a += 0.25) {
    const x = tam / 2 + Math.cos(a) * r;
    const y = tam / 2 + Math.sin(a) * r * 0.55;
    p.disco(x, y, 1, P.fumaca, alpha);
  }
  return p.finalizar();
}

/** Respingo de água (usado ao entrar/sair da água e por dinos aquáticos). */
function respingo(quadro: number, total: number): Sprite {
  const tam = 18;
  const p = new Pincel(tam, tam);
  const t = quadro / (total - 1);
  const alpha = 1 - t * 0.7;
  const r = 3 + t * 6;
  for (let a = 0; a < TAU; a += 0.35) {
    const x = tam / 2 + Math.cos(a) * r;
    const y = tam / 2 + Math.sin(a) * r * 0.5 - t * 3;
    p.ponto(x, y, P.aguaEspuma, alpha);
    p.ponto(x, y + 1, P.aguaRasa, alpha * 0.7);
  }
  p.anel(tam / 2, tam / 2, Math.round(r), P.aguaEspuma, 1);
  return p.finalizar();
}

/** Onda de choque circular (impacto pesado, chegada da máquina do tempo). */
function onda(quadro: number, total: number, cor: string): Sprite {
  const tam = 48;
  const p = new Pincel(tam, tam);
  const t = quadro / (total - 1);
  const r = Math.round(4 + t * 20);
  p.anel(tam / 2, tam / 2, r, cor, 2);
  p.anel(tam / 2, tam / 2, Math.max(1, r - 3), cor, 1);
  return p.finalizar();
}

/** Orbe mágica dos dinossauros mágicos. */
function orbe(quadro: number): Sprite {
  const tam = 10;
  const p = new Pincel(tam, tam);
  const c = 4.5;
  p.disco(c, c, 4, P.magiaEscura);
  p.disco(c, c, 3, P.magia);
  p.disco(c + (quadro === 1 ? -1 : 0), c - 1, 2, P.magiaClara);
  p.ponto(c - 1, c - 2, P.brilho);
  if (quadro === 1) {
    p.ponto(0, 4, P.magiaClara);
    p.ponto(9, 5, P.magiaClara);
  } else {
    p.ponto(4, 0, P.magiaClara);
    p.ponto(5, 9, P.magiaClara);
  }
  return p.finalizar();
}

/** Estilhaço mágico ao orbe explodir. */
function explosaoMagica(quadro: number, total: number): Sprite {
  const tam = 26;
  const p = new Pincel(tam, tam);
  const t = quadro / (total - 1);
  const r = 3 + t * 9;
  const alpha = 1 - t * 0.8;
  p.anel(tam / 2, tam / 2, Math.round(r), P.magiaClara, 2, alpha);
  for (let a = 0; a < TAU; a += 0.5) {
    const x = tam / 2 + Math.cos(a) * (r + 2);
    const y = tam / 2 + Math.sin(a) * (r + 2);
    p.ponto(x, y, P.magia, alpha);
  }
  p.disco(tam / 2, tam / 2, Math.max(0, 4 - t * 4), P.brilho, alpha);
  return p.finalizar();
}

/** Marca de "!" que aparece quando um carnívoro percebe o jogador. */
function alerta(): Sprite {
  const p = new Pincel(5, 9);
  p.retangulo(1, 0, 3, 5, P.sangue);
  p.retangulo(1, 6, 3, 3, P.sangue);
  p.ponto(2, 1, P.coracaoLuz);
  p.contorno(0, 0, 5, 9, '#00000000');
  return p.finalizar();
}

/** Marca de coração de calma que aparece nos herbívoros pacíficos. */
function calma(): Sprite {
  const p = new Pincel(7, 6);
  p.retangulo(1, 1, 2, 2, P.folhaClara);
  p.retangulo(4, 1, 2, 2, P.folhaClara);
  p.retangulo(1, 2, 5, 2, P.folhaClara);
  p.retangulo(2, 4, 3, 1, P.folha);
  p.ponto(3, 5, P.folha);
  return p.finalizar();
}

export interface ArteEfeitos {
  golpe: Sprite[];
  faisca: Sprite[];
  poeira: Sprite[];
  respingo: Sprite[];
  ondaBranca: Sprite[];
  ondaMagica: Sprite[];
  orbe: Sprite[];
  explosaoMagica: Sprite[];
  alerta: Sprite;
  calma: Sprite;
}

export function criarEfeitos(): ArteEfeitos {
  const n = (q: number, f: (i: number, t: number) => Sprite) =>
    Array.from({ length: q }, (_, i) => f(i, q));
  return {
    golpe: n(5, arcoGolpe),
    faisca: n(5, faisca),
    poeira: n(4, poeira),
    respingo: n(5, respingo),
    ondaBranca: n(6, (i, t) => onda(i, t, P.brilho)),
    ondaMagica: n(6, (i, t) => onda(i, t, P.magiaClara)),
    orbe: [orbe(0), orbe(1)],
    explosaoMagica: n(5, explosaoMagica),
    alerta: alerta(),
    calma: calma(),
  };
}
