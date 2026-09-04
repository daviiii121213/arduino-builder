/**
 * Sistema de vida em corações.
 *
 * A vida é guardada em "metades" de coração para permitir meio dano.
 * A regeneração devolve 1 coração a cada 3 segundos e só funciona quando o
 * jogador NÃO está com fome (a mecânica de fome já está prevista em Fome).
 */

export const METADES_POR_CORACAO = 2;
export const SEGUNDOS_POR_REGENERACAO = 3;

export class Vida {
  metades: number;
  metadesMax: number;
  /** Tempo restante de invulnerabilidade após tomar dano. */
  invulneravel = 0;
  /** Acumulador da regeneração. */
  private tempoRegen = 0;
  /** Segundos sem tomar dano — a regeneração espera um pouco antes de agir. */
  private calma = 0;
  atrasoRegeneracao = 1.5;

  constructor(coracoes: number) {
    this.metadesMax = coracoes * METADES_POR_CORACAO;
    this.metades = this.metadesMax;
  }

  get coracoes(): number {
    return this.metades / METADES_POR_CORACAO;
  }

  get coracoesMax(): number {
    return this.metadesMax / METADES_POR_CORACAO;
  }

  get vivo(): boolean {
    return this.metades > 0;
  }

  get cheio(): boolean {
    return this.metades >= this.metadesMax;
  }

  /** Aplica dano em metades de coração. Devolve true se o dano entrou. */
  receberDano(metades: number, invulnerabilidade = 0.7): boolean {
    if (this.invulneravel > 0 || !this.vivo) return false;
    this.metades = Math.max(0, this.metades - Math.max(1, Math.round(metades)));
    this.invulneravel = invulnerabilidade;
    this.calma = 0;
    this.tempoRegen = 0;
    return true;
  }

  curar(metades: number): void {
    this.metades = Math.min(this.metadesMax, this.metades + metades);
  }

  encher(): void {
    this.metades = this.metadesMax;
    this.invulneravel = 0;
    this.tempoRegen = 0;
    this.calma = 0;
  }

  /**
   * Atualiza timers e regenera.
   * @param podeRegenerar false quando o jogador está com fome.
   * @returns true no instante em que um coração é recuperado.
   */
  atualizar(dt: number, podeRegenerar: boolean): boolean {
    if (this.invulneravel > 0) this.invulneravel = Math.max(0, this.invulneravel - dt);
    if (!this.vivo) return false;

    this.calma += dt;
    if (!podeRegenerar || this.cheio || this.calma < this.atrasoRegeneracao) {
      if (!podeRegenerar) this.tempoRegen = 0;
      return false;
    }
    this.tempoRegen += dt;
    if (this.tempoRegen >= SEGUNDOS_POR_REGENERACAO) {
      this.tempoRegen -= SEGUNDOS_POR_REGENERACAO;
      this.curar(METADES_POR_CORACAO);
      return true;
    }
    return false;
  }

  /** Progresso (0..1) até o próximo coração regenerado. */
  get progressoRegeneracao(): number {
    return Math.min(1, this.tempoRegen / SEGUNDOS_POR_REGENERACAO);
  }
}
