/**
 * Dinheiro do jogador.
 * No modo de teste a carteira é infinita: gastar nunca reduz o saldo.
 */

export class Carteira {
  private valor: number;
  /** Modo de teste: dinheiro infinito. */
  infinita = false;
  /** Total ganho na partida (usado nos avisos e no futuro diário). */
  totalGanho = 0;

  constructor(inicial = 0) {
    this.valor = inicial;
  }

  get moedas(): number {
    return this.infinita ? 999999 : this.valor;
  }

  ganhar(n: number): void {
    if (n <= 0) return;
    this.valor += n;
    this.totalGanho += n;
  }

  podePagar(n: number): boolean {
    return this.infinita || this.valor >= n;
  }

  /** Tenta pagar; devolve false se faltou dinheiro. */
  pagar(n: number): boolean {
    if (this.infinita) return true;
    if (this.valor < n) return false;
    this.valor -= n;
    return true;
  }

  definir(n: number): void {
    this.valor = Math.max(0, n);
  }
}

/** Formata um valor em moedas no padrão brasileiro (1.250). */
export function formatarMoedas(n: number): string {
  return n.toLocaleString('pt-BR');
}
