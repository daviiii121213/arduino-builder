/**
 * Ciclo de dia e noite — previsto para a próxima versão.
 *
 * A estrutura já está pronta: um dia dura `duracaoDia` segundos e a cor
 * ambiente é aplicada por cima do mundo. Basta ligar `ativo = true` para o
 * ciclo começar a rodar.
 */

import { clamp } from '../core/math';

export interface CorAmbiente {
  cor: string;
  alpha: number;
}

export class TempoDoDia {
  ativo = false;
  /** Duração de um dia completo, em segundos. */
  duracaoDia = 720;
  /** 0 = meia-noite, 0.5 = meio-dia. */
  fase = 0.36;

  atualizar(dt: number): void {
    if (!this.ativo) return;
    this.fase = (this.fase + dt / this.duracaoDia) % 1;
  }

  get horaDoDia(): string {
    const minutos = Math.floor(this.fase * 24 * 60);
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Tinta aplicada sobre o mundo (null = pleno dia, sem tinta). */
  ambiente(): CorAmbiente | null {
    if (!this.ativo) return null;
    const f = this.fase;
    // amanhecer 0.20-0.30 | dia 0.30-0.72 | anoitecer 0.72-0.82 | noite
    if (f > 0.3 && f < 0.72) return null;
    if (f >= 0.2 && f <= 0.3) {
      return { cor: '#ffb27a', alpha: clamp((0.3 - f) / 0.1, 0, 1) * 0.28 };
    }
    if (f >= 0.72 && f <= 0.82) {
      return { cor: '#ff8a4a', alpha: clamp((f - 0.72) / 0.1, 0, 1) * 0.3 };
    }
    return { cor: '#101c3a', alpha: 0.45 };
  }
}
