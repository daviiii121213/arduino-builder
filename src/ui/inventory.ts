/**
 * Inventário de 10 espaços na base da tela.
 *
 * Nesta primeira versão ele funciona como mostruário do equipamento inicial
 * (a lança de pedra) e já está pronto para receber os itens que virão de
 * cavernas, do chão e das missões: basta usar `guardar`/`remover`.
 */

import type { Sprite } from '../gfx/pixel';

export interface Item {
  id: string;
  nome: string;
  icone: Sprite | null;
  quantidade: number;
  /** Texto mostrado quando o espaço está selecionado. */
  descricao?: string;
}

export const TOTAL_SLOTS = 10;

export class Inventario {
  readonly slots: (Item | null)[] = new Array(TOTAL_SLOTS).fill(null);
  selecionado = 0;

  guardar(item: Item): boolean {
    const iguais = this.slots.findIndex((s) => s && s.id === item.id);
    if (iguais >= 0) {
      this.slots[iguais]!.quantidade += item.quantidade;
      return true;
    }
    const vazio = this.slots.indexOf(null);
    if (vazio < 0) return false;
    this.slots[vazio] = item;
    return true;
  }

  remover(indice: number, quantidade = 1): Item | null {
    const s = this.slots[indice];
    if (!s) return null;
    s.quantidade -= quantidade;
    if (s.quantidade <= 0) this.slots[indice] = null;
    return s;
  }

  selecionar(indice: number): void {
    if (indice >= 0 && indice < TOTAL_SLOTS) this.selecionado = indice;
  }

  girarSelecao(passo: number): void {
    this.selecionado = (this.selecionado + passo + TOTAL_SLOTS) % TOTAL_SLOTS;
  }

  get itemSelecionado(): Item | null {
    return this.slots[this.selecionado];
  }
}
