/**
 * Texturas de terreno 16x16, geradas pixel a pixel com ruído determinístico.
 * Cada tipo tem variações para o chão não parecer repetitivo, e a água tem
 * quadros de animação.
 */

import { Pincel, type Sprite } from '../pixel';
import { P } from '../palette';
import { Rng } from '../../core/rng';

export const TAM_TILE = 16;

function base(cor: string): Pincel {
  const p = new Pincel(TAM_TILE, TAM_TILE);
  p.retangulo(0, 0, TAM_TILE, TAM_TILE, cor);
  return p;
}

function salpicar(p: Pincel, rng: Rng, cor: string, quantidade: number): void {
  for (let i = 0; i < quantidade; i++) {
    p.ponto(rng.int(0, TAM_TILE - 1), rng.int(0, TAM_TILE - 1), cor);
  }
}

function grama(semente: number, seca = false): Sprite {
  const rng = new Rng(semente);
  const corBase = seca ? P.gramaSeca : P.grama;
  const p = base(corBase);
  salpicar(p, rng, seca ? '#a08f4e' : P.gramaEscura, 26);
  salpicar(p, rng, P.gramaClara, 18);
  // tufos de capim: dois pixels na vertical
  for (let i = 0; i < 7; i++) {
    const x = rng.int(1, TAM_TILE - 2);
    const y = rng.int(2, TAM_TILE - 3);
    const c = rng.chance(0.5) ? P.gramaClara : P.gramaEscura;
    p.ponto(x, y, c);
    p.ponto(x, y - 1, c);
    if (rng.chance(0.4)) p.ponto(x + 1, y, c);
  }
  return p.finalizar();
}

function gramaFlorida(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base(P.grama);
  salpicar(p, rng, P.gramaEscura, 24);
  salpicar(p, rng, P.gramaClara, 16);
  for (let i = 0; i < 5; i++) {
    const x = rng.int(1, TAM_TILE - 3);
    const y = rng.int(2, TAM_TILE - 3);
    const c = rng.chance(0.5) ? P.gramaClara : P.gramaEscura;
    p.ponto(x, y, c);
    p.ponto(x, y - 1, c);
  }
  // uma ou duas flores por tile, em posições variadas
  const quantas = rng.int(0, 2);
  for (let i = 0; i < quantas; i++) {
    const x = rng.int(2, TAM_TILE - 3);
    const y = rng.int(2, TAM_TILE - 3);
    const cor = rng.chance(0.5) ? P.flor : P.florAmarela;
    p.ponto(x, y, cor);
    p.ponto(x - 1, y, cor);
    p.ponto(x + 1, y, cor);
    p.ponto(x, y - 1, cor);
    p.ponto(x, y + 1, P.gramaEscura);
  }
  return p.finalizar();
}

function terra(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base(P.terra);
  salpicar(p, rng, P.terraEscura, 30);
  salpicar(p, rng, P.terraClara, 22);
  for (let i = 0; i < 4; i++) {
    const x = rng.int(1, TAM_TILE - 3);
    const y = rng.int(1, TAM_TILE - 3);
    p.ponto(x, y, P.pedraEscura);
    p.ponto(x + 1, y, P.pedra);
  }
  return p.finalizar();
}

function areia(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base(P.areia);
  salpicar(p, rng, P.areiaEscura, 26);
  salpicar(p, rng, '#efe0b4', 16);
  for (let i = 0; i < 3; i++) {
    const y = rng.int(2, TAM_TILE - 3);
    const x = rng.int(0, 9);
    p.linha(x, y, x + rng.int(2, 5), y, P.areiaEscura);
  }
  return p.finalizar();
}

function rocha(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base('#78798a');
  for (let y = 0; y < TAM_TILE; y++) {
    for (let x = 0; x < TAM_TILE; x++) {
      const n = rng.next();
      if (n < 0.16) p.ponto(x, y, '#63647a');
      else if (n < 0.3) p.ponto(x, y, '#8b8c9c');
      else if (n < 0.34) p.ponto(x, y, '#9596a6');
    }
  }
  // rachaduras irregulares
  for (let i = 0; i < 2; i++) {
    let x = rng.int(0, TAM_TILE - 1);
    let y = rng.int(0, TAM_TILE - 1);
    for (let k = 0; k < 10; k++) {
      p.ponto(x, y, '#4e4f61');
      p.ponto(x, y + 1, '#8b8c9c');
      x += rng.int(-1, 2);
      y += rng.int(0, 1);
    }
  }
  // pedrinhas soltas com luz em cima
  for (let i = 0; i < 3; i++) {
    const x = rng.int(1, TAM_TILE - 4);
    const y = rng.int(1, TAM_TILE - 4);
    p.disco(x + 1, y + 1, 1, '#8b8c9c');
    p.ponto(x + 1, y, '#a9aab8');
    p.ponto(x + 1, y + 2, '#4e4f61');
  }
  // tufos de mato brotando entre as pedras
  for (let i = 0; i < 2; i++) {
    if (!rng.chance(0.6)) continue;
    const x = rng.int(1, TAM_TILE - 2);
    const y = rng.int(2, TAM_TILE - 2);
    p.ponto(x, y, P.gramaEscura);
    p.ponto(x, y - 1, P.grama);
    p.ponto(x + 1, y, P.gramaEscura);
  }
  return p.finalizar();
}

function lama(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base(P.lama);
  salpicar(p, rng, '#4f3c26', 30);
  salpicar(p, rng, '#82663f', 18);
  return p.finalizar();
}

/** Água: base escura com marolas curtas que deslizam entre os quadros. */
function agua(semente: number, funda: boolean, quadro: number): Sprite {
  const rng = new Rng(semente);
  const corBase = funda ? P.aguaFunda : P.aguaRasa;
  const corEscura = funda ? '#1a4c6b' : '#337c92';
  const corClara = funda ? '#2f7595' : '#5cb0c4';
  const corBrilho = funda ? '#4a94b4' : '#8fd0dc';
  const p = base(corBase);
  for (let y = 0; y < TAM_TILE; y++) {
    for (let x = 0; x < TAM_TILE; x++) {
      if (rng.chance(0.1)) p.ponto(x, y, corEscura);
      else if (rng.chance(0.08)) p.ponto(x, y, corClara);
    }
  }
  // marolas: traços de 2 a 3 pixels que caminham com o tempo
  const desloc = quadro * 3;
  for (let i = 0; i < 6; i++) {
    const y = (rng.int(0, TAM_TILE - 1) + desloc) % TAM_TILE;
    const x = (rng.int(0, TAM_TILE - 1) + desloc * 2) % TAM_TILE;
    const larg = rng.int(2, 3);
    for (let k = 0; k < larg; k++) p.ponto((x + k) % TAM_TILE, y, corClara);
    if (rng.chance(0.4)) p.ponto((x + 1) % TAM_TILE, y, corBrilho);
    p.ponto((x + larg) % TAM_TILE, (y + 1) % TAM_TILE, corEscura);
  }
  return p.finalizar();
}

/** Piso de tábuas longas do interior da casa (padrão contínuo entre tiles). */
function pisoMadeira(semente: number, variante = 0): Sprite {
  const rng = new Rng(semente);
  const p = base('#8a6238');
  for (let y = 0; y < TAM_TILE; y++) {
    for (let x = 0; x < TAM_TILE; x++) {
      // veios da madeira, bem sutis
      if (rng.chance(0.09)) p.ponto(x, y, '#966b3d');
      else if (rng.chance(0.07)) p.ponto(x, y, '#7d5730');
    }
  }
  // duas tábuas por tile: junta escura em cima de cada uma
  for (const y of [0, 8]) {
    p.linha(0, y, TAM_TILE - 1, y, '#6b4a28');
    p.linha(0, y + 1, TAM_TILE - 1, y + 1, '#93683c');
  }
  // só uma das variações tem emenda vertical: assim as tábuas parecem longas
  if (variante === 2) {
    for (let y = 2; y < 8; y++) p.ponto(5, y, '#6b4a28');
  } else if (variante === 1) {
    for (let y = 10; y < TAM_TILE; y++) p.ponto(11, y, '#6b4a28');
  }
  // nós na madeira
  if (rng.chance(0.5)) {
    const nx = rng.int(2, 13);
    const ny = rng.chance(0.5) ? 4 : 12;
    p.ponto(nx, ny, '#6b4a28');
    p.ponto(nx + 1, ny, '#7d5730');
  }
  return p.finalizar();
}

/** Parede interna de tábuas com viga. */
function paredeInterna(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base(P.madeiraEscura);
  for (let y = 0; y < TAM_TILE; y++) {
    for (let x = 0; x < TAM_TILE; x++) {
      if (rng.chance(0.1)) p.ponto(x, y, '#3a2513');
      else if (rng.chance(0.08)) p.ponto(x, y, P.madeira);
    }
  }
  p.retangulo(0, TAM_TILE - 3, TAM_TILE, 3, P.madeira);
  p.linha(0, TAM_TILE - 3, TAM_TILE - 1, TAM_TILE - 3, '#2b1b0d');
  for (let x = 0; x < TAM_TILE; x += 5) p.linha(x, 0, x, TAM_TILE - 4, '#2b1b0d');
  return p.finalizar();
}

/** Tecido do tapete — padrão contínuo, sem borda por tile. */
function tapete(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base('#8c3f44');
  for (let y = 0; y < TAM_TILE; y++) {
    for (let x = 0; x < TAM_TILE; x++) {
      if ((x + y) % 4 === 0) p.ponto(x, y, '#7a353c');
      else if ((x - y + 32) % 8 === 0) p.ponto(x, y, '#9e4a4a');
      if (rng.chance(0.05)) p.ponto(x, y, '#a9564f');
    }
  }
  for (let x = 0; x < TAM_TILE; x += 8) {
    for (let y = 0; y < TAM_TILE; y += 8) {
      p.ponto(x + 3, y + 3, '#c9803f');
      p.ponto(x + 4, y + 4, '#e0b070');
      p.ponto(x + 4, y + 3, '#c9803f');
      p.ponto(x + 3, y + 4, '#c9803f');
    }
  }
  return p.finalizar();
}

/** Piso de concreto do galpão (usado na cinemática). */
function concreto(semente: number): Sprite {
  const rng = new Rng(semente);
  const p = base('#5a5a68');
  salpicar(p, rng, '#4a4a57', 30);
  salpicar(p, rng, '#6d6d7c', 20);
  p.linha(0, 15, 15, 15, '#42424d');
  p.linha(15, 0, 15, 15, '#42424d');
  return p.finalizar();
}

export interface TexturasTerreno {
  grama: Sprite[];
  gramaSeca: Sprite[];
  gramaFlorida: Sprite[];
  terra: Sprite[];
  areia: Sprite[];
  rocha: Sprite[];
  lama: Sprite[];
  aguaRasa: Sprite[][];
  aguaFunda: Sprite[][];
  pisoMadeira: Sprite[];
  paredeInterna: Sprite[];
  tapete: Sprite[];
  concreto: Sprite[];
}

export const QUADROS_AGUA = 4;

export function criarTerreno(): TexturasTerreno {
  const varias = (f: (s: number) => Sprite, n: number, s0: number) =>
    Array.from({ length: n }, (_, i) => f(s0 + i * 977));

  const aguaVariacoes = (funda: boolean, s0: number) =>
    Array.from({ length: 3 }, (_, v) =>
      Array.from({ length: QUADROS_AGUA }, (_, q) => agua(s0 + v * 613, funda, q)),
    );

  return {
    grama: varias((s) => grama(s), 4, 11),
    gramaSeca: varias((s) => grama(s, true), 2, 401),
    gramaFlorida: varias(gramaFlorida, 4, 733),
    terra: varias(terra, 3, 1201),
    areia: varias(areia, 3, 1601),
    rocha: varias(rocha, 4, 2003),
    lama: varias(lama, 2, 2411),
    aguaRasa: aguaVariacoes(false, 3001),
    aguaFunda: aguaVariacoes(true, 4001),
    pisoMadeira: [pisoMadeira(5001, 0), pisoMadeira(5011, 1), pisoMadeira(5021, 2)],
    paredeInterna: varias(paredeInterna, 2, 6001),
    tapete: varias(tapete, 2, 7001),
    concreto: varias(concreto, 3, 8001),
  };
}
