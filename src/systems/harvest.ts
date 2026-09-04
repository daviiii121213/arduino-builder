/**
 * Nós de recurso: árvores, pedras e montinhos de terra que podem ser colhidos
 * com a ferramenta certa.
 *
 * Cada nó tem vida, uma lista de quedas (drops) e um tempo para voltar. Ao ser
 * derrubado, o sprite do cenário é trocado (árvore → toco, pedra → entulho) e
 * a colisão é desligada; quando o tempo passa, tudo volta ao normal.
 */

import type { Sprite } from '../gfx/pixel';
import type { ObjetoCenario, Colisor } from '../world/level';
import type { RecursoId } from '../gfx/sprites/tools';
import type { Rng } from '../core/rng';

export type TipoNo = 'arvore' | 'rocha' | 'escavacao' | 'solo';

export interface Queda {
  id: RecursoId;
  min: number;
  max: number;
  /** 0..1 — chance de sair alguma coisa. */
  chance: number;
}

export interface DefNo {
  tipo: TipoNo;
  nome: string;
  vidaMax: number;
  quedas: Queda[];
  /** Sprite depois de esgotado (toco, entulho, buraco). */
  spriteEsgotado: Sprite;
  /** Segundos para o recurso voltar. */
  renascer: number;
  /** Cor das lascas que voam ao golpear. */
  corLasca: string;
  /** Som usado ao golpear: 'madeira' | 'pedra' | 'terra'. */
  som: 'madeira' | 'pedra' | 'terra';
}

export interface QuedaColhida {
  id: RecursoId;
  quantidade: number;
}

export class NoRecurso {
  vida: number;
  /** false enquanto está esgotado, esperando renascer. */
  cheio = true;
  private tempo = 0;
  private spriteCheio: Sprite;
  /** Ponto de apoio no chão, para reposicionar sprites de tamanhos diferentes. */
  private baseX: number;
  private baseY: number;

  constructor(
    readonly def: DefNo,
    readonly objeto: ObjetoCenario,
    private colisor?: Colisor,
  ) {
    this.vida = def.vidaMax;
    this.spriteCheio = objeto.sprite;
    this.baseX = objeto.x + objeto.sprite.width / 2;
    this.baseY = objeto.y + objeto.sprite.height;
  }

  get x(): number {
    return this.baseX;
  }

  get y(): number {
    return this.baseY;
  }

  /** Aplica um golpe. Devolve as quedas quando o nó é derrubado. */
  golpear(poder: number, rendimentoExtra: number, rng: Rng): {
    derrubou: boolean;
    quedas: QuedaColhida[];
  } {
    if (!this.cheio) return { derrubou: false, quedas: [] };
    this.vida -= poder;
    if (this.vida > 0) return { derrubou: false, quedas: [] };

    const quedas: QuedaColhida[] = [];
    for (const q of this.def.quedas) {
      if (!rng.chance(q.chance)) continue;
      const base = rng.int(q.min, q.max);
      const total = base + (base > 0 ? rendimentoExtra : 0);
      if (total > 0) quedas.push({ id: q.id, quantidade: total });
    }
    this.esgotar();
    return { derrubou: true, quedas };
  }

  private esgotar(): void {
    this.cheio = false;
    this.tempo = 0;
    this.trocarSprite(this.def.spriteEsgotado);
    if (this.colisor) this.colisor.ativo = false;
  }

  private trocarSprite(s: Sprite): void {
    this.objeto.sprite = s;
    this.objeto.x = Math.round(this.baseX - s.width / 2);
    this.objeto.y = Math.round(this.baseY - s.height);
  }

  atualizar(dt: number): void {
    if (this.cheio) return;
    this.tempo += dt;
    if (this.tempo >= this.def.renascer) {
      this.cheio = true;
      this.vida = this.def.vidaMax;
      this.trocarSprite(this.spriteCheio);
      if (this.colisor) this.colisor.ativo = true;
    }
  }

  /** Progresso da vida restante (0..1) — usado na barrinha de colheita. */
  get proporcaoVida(): number {
    return Math.max(0, Math.min(1, this.vida / this.def.vidaMax));
  }
}
