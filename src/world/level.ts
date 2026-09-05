/**
 * Um "nível" é um mapa do jogo: matriz de terreno, objetos com colisão,
 * pontos de entrada/saída e informação de ambiente.
 */

import { TAM_TILE } from '../gfx/sprites/terrain';
import { Tile, PROPS } from './tiles';
import type { Rect } from '../core/math';
import type { Sprite } from '../gfx/pixel';
import type { NoRecurso } from '../systems/harvest';
import { biomaPorIndice, type BiomaId } from './biomes';

/** Objeto decorativo desenhado no mundo (ordenado pelo eixo Y). */
export interface ObjetoCenario {
  sprite: Sprite;
  /** Canto superior esquerdo do sprite, em pixels do mundo. */
  x: number;
  y: number;
  /** Linha de base usada na ordenação por profundidade. */
  base: number;
  /** Balança levemente com o vento (vegetação). */
  balanca?: boolean;
  /** Sombra opcional sob o objeto. */
  sombra?: Sprite;
}

export interface Portal {
  area: Rect;
  destino: string;
  /** Posição de chegada no nível de destino. */
  entradaX: number;
  entradaY: number;
  rotulo: string;
}

export type Ambiente = 'exterior' | 'interior' | 'galpao' | 'cabana';

/** Caixa de colisão que pode ser desligada (árvore derrubada, pedra quebrada). */
export interface Colisor extends Rect {
  ativo?: boolean;
}

/** Ação disponível ao apertar E perto de algo. */
export interface Interativo {
  area: Rect;
  rotulo: string;
  /** O que a cena de jogo deve abrir/fazer. */
  acao:
    | 'cama'
    | 'bau'
    | 'venda'
    | 'melhoria-ferreira'
    | 'melhoria-marceneiro'
    | 'lareira'
    | 'estante'
    | 'janela'
    | 'bancada';
}

export class Nivel {
  readonly tiles: Uint8Array;
  readonly variacoes: Uint8Array;
  /** Bioma de cada tile (índice em ORDEM_BIOMAS). Só o mundo aberto usa. */
  readonly biomas: Uint8Array;
  readonly colisores: Colisor[] = [];
  readonly objetos: ObjetoCenario[] = [];
  readonly portais: Portal[] = [];
  /** Objetos desenhados por cima do jogador (copas de árvore, telhados). */
  readonly objetosFrente: ObjetoCenario[] = [];
  /** Nós de recurso (árvores, pedras, montinhos) deste nível. */
  readonly nos: NoRecurso[] = [];
  /** Coisas com que o jogador interage apertando E. */
  readonly interativos: Interativo[] = [];
  /** Objetos que outros sistemas precisam achar depois (ex.: o baú). */
  readonly nomeados = new Map<string, ObjetoCenario>();

  /** Focos de luz (lampiões, tochas) desenhados por cima da cena. */
  readonly luzes: { x: number; y: number }[] = [];
  /** Fogos animados (lareira). */
  readonly fogos: { x: number; y: number }[] = [];

  entradaX = 0;
  entradaY = 0;

  constructor(
    readonly id: string,
    readonly nome: string,
    readonly larguraTiles: number,
    readonly alturaTiles: number,
    readonly ambiente: Ambiente,
    preenchimento: Tile = Tile.Grama,
  ) {
    this.tiles = new Uint8Array(larguraTiles * alturaTiles).fill(preenchimento);
    this.variacoes = new Uint8Array(larguraTiles * alturaTiles);
    this.biomas = new Uint8Array(larguraTiles * alturaTiles);
  }

  /** Bioma do tile (fora do mapa, ou dentro de casa, é sempre o vale). */
  bioma(tx: number, ty: number): BiomaId {
    if (!this.dentro(tx, ty)) return 'vale';
    return biomaPorIndice(this.biomas[ty * this.larguraTiles + tx]);
  }

  definirBioma(tx: number, ty: number, indice: number): void {
    if (!this.dentro(tx, ty)) return;
    this.biomas[ty * this.larguraTiles + tx] = indice;
  }

  /** Bioma no ponto em pixels. */
  biomaEm(x: number, y: number): BiomaId {
    return this.bioma(Math.floor(x / TAM_TILE), Math.floor(y / TAM_TILE));
  }

  get larguraPx(): number {
    return this.larguraTiles * TAM_TILE;
  }

  get alturaPx(): number {
    return this.alturaTiles * TAM_TILE;
  }

  dentro(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.larguraTiles && ty < this.alturaTiles;
  }

  tile(tx: number, ty: number): Tile {
    if (!this.dentro(tx, ty)) return Tile.Vazio;
    return this.tiles[ty * this.larguraTiles + tx] as Tile;
  }

  definirTile(tx: number, ty: number, t: Tile, variacao = 0): void {
    if (!this.dentro(tx, ty)) return;
    this.tiles[ty * this.larguraTiles + tx] = t;
    this.variacoes[ty * this.larguraTiles + tx] = variacao;
  }

  variacao(tx: number, ty: number): number {
    if (!this.dentro(tx, ty)) return 0;
    return this.variacoes[ty * this.larguraTiles + tx];
  }

  /** Terreno no ponto em pixels. */
  tileEm(x: number, y: number): Tile {
    return this.tile(Math.floor(x / TAM_TILE), Math.floor(y / TAM_TILE));
  }

  atritoEm(x: number, y: number): number {
    return PROPS[this.tileEm(x, y)].atrito;
  }

  /** Verdadeiro se o ponto bloqueia quem anda em terra firme. */
  bloqueadoEm(x: number, y: number, podeNadar = false): boolean {
    const t = this.tileEm(x, y);
    const p = PROPS[t];
    if (podeNadar) {
      // criaturas aquáticas só andam dentro da água
      return !p.agua;
    }
    return p.solido;
  }

  adicionarColisor(r: Colisor): Colisor {
    this.colisores.push(r);
    return r;
  }

  adicionarObjeto(o: ObjetoCenario): void {
    this.objetos.push(o);
  }

  ordenarObjetos(): void {
    this.objetos.sort((a, b) => a.base - b.base);
  }
}
