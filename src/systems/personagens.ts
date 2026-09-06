/**
 * Os quatro personagens jogáveis.
 *
 * A escolha vale para a partida inteira: exploração, combate, ferramentas,
 * armadura, cinemáticas e o final. A arte de cada um está em
 * `gfx/sprites/player.ts`; aqui ficam só o nome e a apresentação.
 */

import type { PersonagemId } from '../gfx/sprites/player';

export type Genero = 'menino' | 'menina';

export interface FichaPersonagem {
  id: PersonagemId;
  nome: string;
  genero: Genero;
  /** Uma linha na tela de escolha. */
  descricao: string;
  /** Cor de destaque da ficha (combina com a roupa). */
  cor: string;
}

export const PERSONAGENS: Record<PersonagemId, FichaPersonagem> = {
  teo: {
    id: 'teo',
    nome: 'Téo',
    genero: 'menino',
    descricao: 'Neto curioso. Foi ele quem mexeu no painel da máquina.',
    cor: '#3f7fd6',
  },
  rui: {
    id: 'rui',
    nome: 'Rui',
    genero: 'menino',
    descricao: 'Cabelo raspado e colete de couro. Não larga a picareta.',
    cor: '#3f8f52',
  },
  bia: {
    id: 'bia',
    nome: 'Bia',
    genero: 'menina',
    descricao: 'Cabelo longo e passo silencioso. Enxerga bicho de longe.',
    cor: '#8a5ac4',
  },
  nina: {
    id: 'nina',
    nome: 'Nina',
    genero: 'menina',
    descricao: 'Cachos presos na faixa. Cava onde ninguém pensou em cavar.',
    cor: '#e0803a',
  },
};

/** Na ordem em que aparecem na tela de escolha: dois meninos, duas meninas. */
export const TODOS_PERSONAGENS: FichaPersonagem[] = [
  PERSONAGENS.teo,
  PERSONAGENS.rui,
  PERSONAGENS.bia,
  PERSONAGENS.nina,
];
