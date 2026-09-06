/** Contexto compartilhado entre as entidades (evita dependências circulares). */

import type { Nivel } from '../world/level';
import type { Particulas } from '../systems/particles';
import type { Camera } from '../core/camera';
import type { Audio } from '../audio/audio';
import type { Assets } from '../gfx/assets';
import type { Jogador } from './player';
import type { Dino } from './dino';
import type { Orbe } from './projectile';

export interface Mundo {
  nivel: Nivel;
  particulas: Particulas;
  camera: Camera;
  audio: Audio;
  assets: Assets;
  jogador: Jogador;
  dinos: Dino[];
  projeteis: Orbe[];
  /** Tempo acumulado de jogo, em segundos. */
  tempo: number;
  /**
   * Verdadeiro entre 23:00 e 05:30. Enquanto vale, todo dinossauro bate o
   * dobro, corre mais e desiste menos — sem que nada disso encoste na ficha
   * da espécie.
   */
  noitePerigosa: boolean;
  criarOrbe(
    x: number,
    y: number,
    angulo: number,
    dano: number,
    velocidade: number,
    estilo?: import('./projectile').EstiloOrbe,
  ): void;
  /** Um chefe chamando ajuda: nasce uma criatura ali mesmo. */
  invocar?(especie: import('../gfx/sprites/dinos').EspecieId, x: number, y: number): void;
  /** Mensagem curta no rodapé (avisos e dicas). */
  avisar(texto: string, segundos?: number): void;
  /** Avisa que uma criatura caiu (missões do diário). */
  aoAbater?(especie: import('../gfx/sprites/dinos').EspecieId): void;
}
