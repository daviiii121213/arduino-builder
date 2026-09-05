/**
 * Arqueologia: as peças fósseis que o jogador desenterra pelo mundo.
 *
 * Um fóssil é um recurso como qualquer outro (empilha, vende, entra em missão),
 * então a ficha aqui só acrescenta o que é próprio da arqueologia: raridade, de
 * onde ele sai e o texto da coleção.
 *
 * Acrescentar uma peça nova é uma linha em FOSSEIS + o desenho em
 * `gfx/sprites/tools.ts`. O sorteio, a coleção e a venda se viram sozinhos.
 */

import type { BiomaId } from '../world/biomes';
import type { Rng } from '../core/rng';

export type FossilId =
  | 'fossilDente'
  | 'fossilPegada'
  | 'fossilConcha'
  | 'fossilGarra'
  | 'fossilOvo'
  | 'fossilCranio'
  | 'fossilAmbar'
  | 'fossilVertebra'
  | 'fossilPluma'
  | 'fossilRunico'
  | 'fossilEsqueleto';

export type Raridade = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario';

export const NOME_RARIDADE: Record<Raridade, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  epico: 'Épico',
  lendario: 'Lendário',
};

export const COR_RARIDADE: Record<Raridade, string> = {
  comum: '#a89fbe',
  incomum: '#7fbf5a',
  raro: '#5aa8f0',
  epico: '#c07fff',
  lendario: '#ffc75a',
};

/** Peso relativo no sorteio: quanto mais raro, menos aparece. */
const PESO: Record<Raridade, number> = {
  comum: 100,
  incomum: 42,
  raro: 14,
  epico: 5,
  lendario: 2,
};

/** Onde a peça pode sair: um bioma, dentro das cavernas, ou em qualquer lugar. */
export type Origem = BiomaId | 'caverna' | 'qualquer';

export interface FichaFossil {
  id: FossilId;
  nome: string;
  /** Valor de venda por unidade. */
  valor: number;
  raridade: Raridade;
  origem: Origem;
  /** Frase da coleção, na voz de quem escava. */
  descricao: string;
}

export const FOSSEIS: Record<FossilId, FichaFossil> = {
  fossilDente: {
    id: 'fossilDente',
    nome: 'Dente fossilizado',
    valor: 22,
    raridade: 'comum',
    origem: 'qualquer',
    descricao: 'Serrilhado dos dois lados. Quem perdeu não sentiu falta.',
  },
  fossilPegada: {
    id: 'fossilPegada',
    nome: 'Pegada em pedra',
    valor: 34,
    raridade: 'comum',
    origem: 'vale',
    descricao: 'A lama secou com a marca dentro e virou pedra do jeito que estava.',
  },
  fossilConcha: {
    id: 'fossilConcha',
    nome: 'Concha antiga',
    valor: 30,
    raridade: 'comum',
    origem: 'pantano',
    descricao: 'Espiral perfeita. O brejo já foi mar, um dia.',
  },
  fossilGarra: {
    id: 'fossilGarra',
    nome: 'Garra petrificada',
    valor: 58,
    raridade: 'incomum',
    origem: 'floresta',
    descricao: 'Curva e afiada. Ainda dá para imaginar o tamanho do bicho.',
  },
  fossilOvo: {
    id: 'fossilOvo',
    nome: 'Ovo fossilizado',
    valor: 76,
    raridade: 'incomum',
    origem: 'deserto',
    descricao: 'Inteiro, com a casca marcada. Nunca chegou a chocar.',
  },
  fossilCranio: {
    id: 'fossilCranio',
    nome: 'Crânio pequeno',
    valor: 95,
    raridade: 'incomum',
    origem: 'vale',
    descricao: 'Cabe na mão. Duas órbitas grandes demais para o tamanho.',
  },
  fossilAmbar: {
    id: 'fossilAmbar',
    nome: 'Âmbar com inseto',
    valor: 150,
    raridade: 'raro',
    origem: 'floresta',
    descricao: 'A resina pegou o bicho no ar e parou o tempo dele ali dentro.',
  },
  fossilVertebra: {
    id: 'fossilVertebra',
    nome: 'Vértebra gigante',
    valor: 175,
    raridade: 'raro',
    origem: 'pantano',
    descricao: 'Um osso só, e já pesa mais que a mochila cheia.',
  },
  fossilPluma: {
    id: 'fossilPluma',
    nome: 'Pluma em ardósia',
    valor: 200,
    raridade: 'raro',
    origem: 'vulcanico',
    descricao: 'A cinza cobriu a pena e guardou cada fio dela na pedra.',
  },
  fossilRunico: {
    id: 'fossilRunico',
    nome: 'Placa rúnica',
    valor: 300,
    raridade: 'epico',
    origem: 'magico',
    descricao: 'Não é osso e não é pedra. Os riscos ainda brilham no escuro.',
  },
  fossilEsqueleto: {
    id: 'fossilEsqueleto',
    nome: 'Esqueleto completo',
    valor: 460,
    raridade: 'lendario',
    origem: 'caverna',
    descricao: 'Inteiro, deitado na rocha, do focinho à ponta da cauda.',
  },
};

export const TODOS_FOSSEIS: FichaFossil[] = Object.values(FOSSEIS);

export function ehFossil(id: string): id is FossilId {
  return id in FOSSEIS;
}

export interface ContextoEscavacao {
  /** Bioma onde o jogador está cavando (ignorado dentro das cavernas). */
  bioma?: BiomaId;
  /** Verdadeiro quando a escavação acontece dentro de uma caverna. */
  caverna?: boolean;
  /** Andar da caverna (1..10): quanto mais fundo, melhor a peça. */
  profundidade?: number;
  /** Multiplicador de sorte (nível da pá, melhorias). */
  sorte?: number;
}

/**
 * Sorteia uma peça compatível com o lugar. Devolve null quando não saiu nada —
 * o normal é não sair: fóssil bom tem que ser raro para valer a escavação.
 */
export function sortearFossil(rng: Rng, ctx: ContextoEscavacao): FossilId | null {
  const candidatos = TODOS_FOSSEIS.filter((f) => {
    if (f.origem === 'qualquer') return true;
    if (f.origem === 'caverna') return !!ctx.caverna;
    return !ctx.caverna && f.origem === ctx.bioma;
  });
  if (candidatos.length === 0) return null;

  // fundo de caverna puxa o sorteio para as peças raras
  const fundo = ctx.caverna ? (ctx.profundidade ?? 1) / 10 : 0;
  const sorte = ctx.sorte ?? 1;
  let soma = 0;
  const pesos = candidatos.map((f) => {
    const raro = f.raridade === 'raro' || f.raridade === 'epico' || f.raridade === 'lendario';
    const p = PESO[f.raridade] * (raro ? 1 + fundo * 3 : 1) * sorte;
    soma += p;
    return p;
  });
  let alvo = rng.range(0, soma);
  for (let i = 0; i < candidatos.length; i++) {
    alvo -= pesos[i];
    if (alvo <= 0) return candidatos[i].id;
  }
  return candidatos[candidatos.length - 1].id;
}

/** Chance de a escavação render uma peça de coleção, e não só cacos. */
export function chanceDeFossil(ctx: ContextoEscavacao): number {
  const base = ctx.caverna ? 0.22 + (ctx.profundidade ?? 1) * 0.02 : 0.18;
  return Math.min(0.6, base * (ctx.sorte ?? 1));
}
