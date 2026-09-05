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
  criarOrbe(x: number, y: number, angulo: number, dano: number, velocidade: number): void;
  /** Mensagem curta no rodapé (avisos e dicas). */
  avisar(texto: string, segundos?: number): void;
  /** Avisa que uma criatura caiu (missões do diário). */
  aoAbater?(especie: import('../gfx/sprites/dinos').EspecieId): void;
}
