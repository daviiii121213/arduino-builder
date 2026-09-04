/**
 * Fome — preparada para a próxima versão.
 *
 * A mecânica já existe e está ligada à regeneração de vida: quando o jogador
 * está com fome, a vida para de regenerar. Nesta primeira versão ela vem
 * desativada (`ativa = false`), então o jogador nunca fica com fome; basta
 * ligar a flag (e alimentar `consumir`/`comer`) para a mecânica entrar em jogo.
 */

export class Fome {
  /** Liga/desliga a mecânica inteira. */
  ativa = false;
  /** 0..100 */
  valor = 100;
  /** Abaixo deste valor o personagem está com fome. */
  limiar = 25;
  /** Pontos de fome perdidos por segundo enquanto a mecânica estiver ativa. */
  drenoPorSegundo = 0.55;
  /** Dreno extra ao correr/atacar (previsto para a versão futura). */
  drenoEsforco = 0.4;

  get comFome(): boolean {
    return this.ativa && this.valor <= this.limiar;
  }

  get faminto(): boolean {
    return this.ativa && this.valor <= 0;
  }

  atualizar(dt: number, esforco = 0): void {
    if (!this.ativa) return;
    this.valor = Math.max(0, this.valor - (this.drenoPorSegundo + this.drenoEsforco * esforco) * dt);
  }

  comer(pontos: number): void {
    this.valor = Math.min(100, this.valor + pontos);
  }

  encher(): void {
    this.valor = 100;
  }
}
