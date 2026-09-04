/**
 * Itens e recipientes.
 *
 * Um item é sempre {tipo, id, quantidade}. O ícone não é guardado aqui: ele é
 * resolvido na hora de desenhar, para que uma ferramenta melhorada apareça
 * imediatamente com o novo desenho no inventário e na mão do jogador.
 *
 * `Recipiente` serve ao inventário do jogador e ao baú de casa — qualquer
 * armazenamento futuro (mochila de missão, carroça, etc.) usa a mesma classe.
 */

import type { FerramentaId, RecursoId } from '../gfx/sprites/tools';

export type TipoItem = 'ferramenta' | 'recurso';
export type IdItem = FerramentaId | RecursoId;

export interface Item {
  tipo: TipoItem;
  id: IdItem;
  quantidade: number;
}

export function criarItem(tipo: TipoItem, id: IdItem, quantidade = 1): Item {
  return { tipo, id, quantidade };
}

export class Recipiente {
  slots: (Item | null)[];
  /** Quantos espaços estão liberados (os outros aparecem trancados). */
  liberados: number;
  /** Quanto cabe em cada espaço. */
  pilhaMax: number;

  constructor(total: number, liberados = total, pilhaMax = 99) {
    this.slots = new Array(total).fill(null);
    this.liberados = Math.min(liberados, total);
    this.pilhaMax = pilhaMax;
  }

  get total(): number {
    return this.slots.length;
  }

  /** Redimensiona o recipiente preservando o conteúdo (usado nas melhorias). */
  redimensionar(total: number, liberados: number): void {
    while (this.slots.length < total) this.slots.push(null);
    if (total < this.slots.length) this.slots.length = total;
    this.liberados = Math.min(liberados, total);
  }

  /** Ferramentas nunca empilham; recursos empilham até `pilhaMax`. */
  private limite(item: Item): number {
    return item.tipo === 'ferramenta' ? 1 : this.pilhaMax;
  }

  /** Guarda o item e devolve quanto sobrou (0 = entrou tudo). */
  guardar(item: Item): number {
    let restante = item.quantidade;
    const lim = this.limite(item);
    // primeiro completa pilhas iguais
    for (let i = 0; i < this.liberados && restante > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== item.id || s.quantidade >= lim) continue;
      const cabe = Math.min(lim - s.quantidade, restante);
      s.quantidade += cabe;
      restante -= cabe;
    }
    // depois ocupa espaços vazios
    for (let i = 0; i < this.liberados && restante > 0; i++) {
      if (this.slots[i]) continue;
      const leva = Math.min(lim, restante);
      this.slots[i] = { tipo: item.tipo, id: item.id, quantidade: leva };
      restante -= leva;
    }
    return restante;
  }

  contar(id: IdItem): number {
    let n = 0;
    for (let i = 0; i < this.liberados; i++) {
      const s = this.slots[i];
      if (s?.id === id) n += s.quantidade;
    }
    return n;
  }

  tem(id: IdItem, quantidade = 1): boolean {
    return this.contar(id) >= quantidade;
  }

  /** Retira até `quantidade`; devolve quanto saiu de verdade. */
  retirar(id: IdItem, quantidade = 1): number {
    let falta = quantidade;
    for (let i = this.liberados - 1; i >= 0 && falta > 0; i--) {
      const s = this.slots[i];
      if (s?.id !== id) continue;
      const tira = Math.min(s.quantidade, falta);
      s.quantidade -= tira;
      falta -= tira;
      if (s.quantidade <= 0) this.slots[i] = null;
    }
    return quantidade - falta;
  }

  /** Espaço livre total para um determinado item. */
  espacoPara(item: Item): number {
    const lim = this.limite(item);
    let espaco = 0;
    for (let i = 0; i < this.liberados; i++) {
      const s = this.slots[i];
      if (!s) espaco += lim;
      else if (s.id === item.id) espaco += Math.max(0, lim - s.quantidade);
    }
    return espaco;
  }

  /** Lista compacta do conteúdo, agrupada por item. */
  resumo(): { tipo: TipoItem; id: IdItem; quantidade: number }[] {
    const mapa = new Map<IdItem, { tipo: TipoItem; id: IdItem; quantidade: number }>();
    for (let i = 0; i < this.liberados; i++) {
      const s = this.slots[i];
      if (!s) continue;
      const atual = mapa.get(s.id);
      if (atual) atual.quantidade += s.quantidade;
      else mapa.set(s.id, { tipo: s.tipo, id: s.id, quantidade: s.quantidade });
    }
    return [...mapa.values()];
  }

  esvaziar(): void {
    this.slots.fill(null);
  }
}

/** Inventário do jogador: 10 espaços na barra inferior, com espaço selecionado. */
export class Inventario extends Recipiente {
  selecionado = 0;

  constructor(liberados = 6, pilhaMax = 20) {
    super(10, liberados, pilhaMax);
  }

  selecionar(indice: number): void {
    if (indice >= 0 && indice < this.liberados) this.selecionado = indice;
  }

  girarSelecao(passo: number): void {
    this.selecionado = (this.selecionado + passo + this.liberados) % this.liberados;
  }

  get itemSelecionado(): Item | null {
    return this.slots[this.selecionado] ?? null;
  }

  /** Ferramenta no espaço selecionado, se houver. */
  get ferramentaSelecionada(): FerramentaId | null {
    const s = this.itemSelecionado;
    return s && s.tipo === 'ferramenta' ? (s.id as FerramentaId) : null;
  }
}
