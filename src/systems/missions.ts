/**
 * Missões do diário do avô.
 *
 * O diário é o caderno que o jogador acha na estante de casa: as páginas vão
 * aparecendo conforme ele avança, uma de cada vez, e cada página é uma tarefa
 * curta com recompensa em moedas.
 *
 * O sistema é só dados + contadores: acrescentar uma missão nova é escrever
 * mais uma linha no CATALOGO_MISSOES. Nada aqui conhece a interface.
 */

import type { RecursoId } from '../gfx/sprites/tools';
import type { BiomaId } from '../world/biomes';
import { BIOMAS } from '../world/biomes';
import { CAVERNAS, type CavernaId } from '../world/caveDefs';
import { RECURSOS } from './resources';

export type TipoObjetivo =
  | 'coletar'
  | 'visitar'
  | 'descobrir'
  | 'cacar'
  | 'vender'
  // ---- cavernas e arqueologia
  | 'descer'
  | 'chefe'
  | 'colecionar';

export interface Objetivo {
  tipo: TipoObjetivo;
  /** Recurso, bioma ou caverna exigido (quando o tipo pede um alvo). */
  alvo?: RecursoId | BiomaId | CavernaId;
  quantidade: number;
}

export interface Missao {
  id: string;
  titulo: string;
  /** A frase do diário, na voz do avô. */
  texto: string;
  objetivo: Objetivo;
  /** Recompensa em moedas. */
  recompensa: number;
  /** Só aparece depois que estas missões forem concluídas. */
  requer: string[];
}

/**
 * A corrente de missões. Começa no quintal e vai empurrando o jogador para
 * cada um dos cinco biomas — é a forma do jogo dizer "vale a pena explorar".
 */
export const CATALOGO_MISSOES: Missao[] = [
  {
    id: 'lenha',
    titulo: 'Lenha para começar',
    texto: '"Primeiro a lenha, depois o resto. Corte cinco toras e a gente conversa."',
    objetivo: { tipo: 'coletar', alvo: 'madeira', quantidade: 5 },
    recompensa: 40,
    requer: [],
  },
  {
    id: 'pedra',
    titulo: 'Pedra sobre pedra',
    texto: '"Sem pedra não se conserta nada. Traga oito lascas da picareta."',
    objetivo: { tipo: 'coletar', alvo: 'pedra', quantidade: 8 },
    recompensa: 50,
    requer: ['lenha'],
  },
  {
    id: 'troco',
    titulo: 'O primeiro troco',
    texto: '"A máquina do lado da cabana compra o que você não usar. Faça 80 moedas."',
    objetivo: { tipo: 'vender', quantidade: 80 },
    recompensa: 60,
    requer: ['pedra'],
  },
  {
    id: 'vizinhos',
    titulo: 'Conhecer os vizinhos',
    texto: '"Anote cada bicho que cruzar o seu caminho. Comece com cinco."',
    objetivo: { tipo: 'descobrir', quantidade: 5 },
    recompensa: 70,
    requer: [],
  },
  {
    id: 'mata',
    titulo: 'Do outro lado da mata',
    texto: '"A leste o campo fecha e vira floresta. Vá ver com os seus olhos."',
    objetivo: { tipo: 'visitar', alvo: 'floresta', quantidade: 1 },
    recompensa: 90,
    requer: ['vizinhos'],
  },
  {
    id: 'resina',
    titulo: 'Resina das árvores altas',
    texto: '"Aquelas árvores choram uma seiva que endurece. Traga quatro."',
    objetivo: { tipo: 'coletar', alvo: 'resina', quantidade: 4 },
    recompensa: 110,
    requer: ['mata'],
  },
  {
    id: 'lama',
    titulo: 'Pés na lama',
    texto: '"Ao sul a água para de correr e o chão vira esponja. Cuidado com o que mora lá."',
    objetivo: { tipo: 'visitar', alvo: 'pantano', quantidade: 1 },
    recompensa: 90,
    requer: ['troco'],
  },
  {
    id: 'turfa',
    titulo: 'Turfa do brejo',
    texto: '"Turfa queima a noite inteira. Cave seis torrões e traga secando."',
    objetivo: { tipo: 'coletar', alvo: 'turfa', quantidade: 6 },
    recompensa: 120,
    requer: ['lama'],
  },
  {
    id: 'dunas',
    titulo: 'Onde a areia clareia',
    texto: '"No nordeste não chove. O chão racha e a areia queima o pé. Vá lá."',
    objetivo: { tipo: 'visitar', alvo: 'deserto', quantidade: 1 },
    recompensa: 100,
    requer: ['mata'],
  },
  {
    id: 'vidro',
    titulo: 'Areia que virou vidro',
    texto: '"Onde o céu bateu no chão a areia derreteu. Ache três pedaços."',
    objetivo: { tipo: 'coletar', alvo: 'vidro', quantidade: 3 },
    recompensa: 150,
    requer: ['dunas'],
  },
  {
    id: 'calor',
    titulo: 'O cheiro do calor',
    texto: '"Se o ar arder e a cinza cair, você chegou no campo de lava. Não pise no vermelho."',
    objetivo: { tipo: 'visitar', alvo: 'vulcanico', quantidade: 1 },
    recompensa: 110,
    requer: ['turfa'],
  },
  {
    id: 'obsidiana',
    titulo: 'Pedra de vidro negro',
    texto: '"A lava que esfria de uma vez vira lâmina. Quebre três veios."',
    objetivo: { tipo: 'coletar', alvo: 'obsidiana', quantidade: 3 },
    recompensa: 200,
    requer: ['calor'],
  },
  {
    id: 'clareira',
    titulo: 'A clareira que brilha',
    texto: '"Tem um lugar onde a grama acende sozinha. Eu vi uma vez. Ache de novo."',
    objetivo: { tipo: 'visitar', alvo: 'magico', quantidade: 1 },
    recompensa: 140,
    requer: ['vidro'],
  },
  {
    id: 'essencia',
    titulo: 'Luz presa numa gota',
    texto: '"Se conseguir duas gotas de essência, guarde. Isso não tem preço — mas vende bem."',
    objetivo: { tipo: 'coletar', alvo: 'essencia', quantidade: 2 },
    recompensa: 260,
    requer: ['clareira'],
  },
  {
    id: 'cacador',
    titulo: 'Aprender a se defender',
    texto: '"Não saia caçando por esporte. Mas cinco vezes você vai precisar se defender."',
    objetivo: { tipo: 'cacar', quantidade: 5 },
    recompensa: 180,
    requer: ['vizinhos'],
  },
  {
    id: 'naturalista',
    titulo: 'O caderno completo',
    texto: '"Vinte e cinco criaturas. Se você anotar todas, esse diário vira o meu orgulho."',
    objetivo: { tipo: 'descobrir', quantidade: 25 },
    recompensa: 600,
    requer: ['essencia', 'cacador'],
  },

  // ---------------------------------------------------- cavernas e fósseis
  {
    id: 'boca-fria',
    titulo: 'A boca fria',
    texto: '"Tem duas cavernas à vista da porta. A da esquerda é gelada. Entre e olhe."',
    objetivo: { tipo: 'descer', alvo: 'gruta', quantidade: 1 },
    recompensa: 80,
    requer: ['pedra'],
  },
  {
    id: 'boca-quente',
    titulo: 'A boca quente',
    texto: '"A da direita bufa ar quente. Não é lugar de ficar, mas é lugar de ver."',
    objetivo: { tipo: 'descer', alvo: 'mina', quantidade: 1 },
    recompensa: 80,
    requer: ['boca-fria'],
  },
  {
    id: 'mineiro',
    titulo: 'Aprender a minerar',
    texto: '"Carvão é o começo de tudo. Traga dez pedaços e a picareta já paga o dia."',
    objetivo: { tipo: 'coletar', alvo: 'carvao', quantidade: 10 },
    recompensa: 130,
    requer: ['boca-fria'],
  },
  {
    id: 'arqueologo',
    titulo: 'Caderno de arqueologia',
    texto: '"Osso solto não vale nada. Peça inteira vale muito. Ache cinco peças diferentes."',
    objetivo: { tipo: 'colecionar', quantidade: 5 },
    recompensa: 200,
    requer: ['boca-fria'],
  },
  {
    id: 'fundo-gruta',
    titulo: 'Fundo da Gruta',
    texto: '"Dizem que passando do quinto andar a gruta vira catedral. Vá ver."',
    objetivo: { tipo: 'descer', alvo: 'gruta', quantidade: 5 },
    recompensa: 260,
    requer: ['mineiro'],
  },
  {
    id: 'fundo-mina',
    titulo: 'Fundo do Abismo',
    texto: '"O Abismo tem o mesmo tanto de andares e o dobro de mau humor. Desça cinco."',
    objetivo: { tipo: 'descer', alvo: 'mina', quantidade: 5 },
    recompensa: 260,
    requer: ['boca-quente'],
  },
  {
    id: 'guardiao-gruta',
    titulo: 'O Guardião da Gruta',
    texto: '"No décimo andar tem uma coisa de cristal que anda. Se ela cair, o baú é seu."',
    objetivo: { tipo: 'chefe', alvo: 'gruta', quantidade: 1 },
    recompensa: 500,
    requer: ['fundo-gruta'],
  },
  {
    id: 'coracao-abismo',
    titulo: 'O Coração do Abismo',
    texto: '"E no fundo do Abismo tem outra. Essa é feita de fogo. Boa sorte."',
    objetivo: { tipo: 'chefe', alvo: 'mina', quantidade: 1 },
    recompensa: 500,
    requer: ['fundo-mina'],
  },
  {
    id: 'colecao',
    titulo: 'A coleção do avô',
    texto: '"Onze peças. Se você juntar todas, o galpão vira museu."',
    objetivo: { tipo: 'colecionar', quantidade: 11 },
    recompensa: 800,
    requer: ['arqueologo', 'guardiao-gruta'],
  },
];

/** Texto curto do que a missão pede ("Madeira 3/5"). */
export function descreverObjetivo(m: Missao, feito: number): string {
  const o = m.objetivo;
  switch (o.tipo) {
    case 'coletar':
      return `${RECURSOS[o.alvo as RecursoId].nome} ${Math.min(feito, o.quantidade)}/${o.quantidade}`;
    case 'visitar':
      return `Chegar em ${BIOMAS[o.alvo as BiomaId].nome}`;
    case 'descobrir':
      return `Criaturas anotadas ${Math.min(feito, o.quantidade)}/${o.quantidade}`;
    case 'cacar':
      return `Criaturas derrotadas ${Math.min(feito, o.quantidade)}/${o.quantidade}`;
    case 'vender':
      return `Moedas ganhas ${Math.min(feito, o.quantidade)}/${o.quantidade}`;
    case 'descer':
      return `${CAVERNAS[o.alvo as CavernaId].curto}: andar ${Math.min(feito, o.quantidade)}/${o.quantidade}`;
    case 'chefe':
      return `Guardião do ${CAVERNAS[o.alvo as CavernaId].curto} derrotado`;
    case 'colecionar':
      return `Peças na coleção ${Math.min(feito, o.quantidade)}/${o.quantidade}`;
  }
}

/** Quantas missões podem estar abertas ao mesmo tempo. */
const MAX_ATIVAS = 3;

export class Diario {
  /** Progresso de cada missão, por id. */
  private feito = new Map<string, number>();
  readonly concluidas = new Set<string>();
  /** Missões abertas agora, na ordem em que chegaram. */
  ativas: Missao[] = [];
  /** Páginas novas que o jogador ainda não abriu (marcador no HUD). */
  naoLidas = 0;
  /** Histórico curto, do mais recente para o mais antigo. */
  readonly historico: string[] = [];

  constructor(
    private aoConcluir: (m: Missao) => void,
    private aoReceber: (m: Missao) => void,
  ) {
    this.repor();
  }

  progresso(m: Missao): number {
    return this.feito.get(m.id) ?? 0;
  }

  /** Abre missões novas até o limite, respeitando os pré-requisitos. */
  private repor(): void {
    for (const m of CATALOGO_MISSOES) {
      if (this.ativas.length >= MAX_ATIVAS) break;
      if (this.concluidas.has(m.id)) continue;
      if (this.ativas.some((a) => a.id === m.id)) continue;
      if (!m.requer.every((r) => this.concluidas.has(r))) continue;
      this.ativas.push(m);
      this.naoLidas++;
      this.aoReceber(m);
    }
  }

  private somar(chave: (m: Missao) => boolean, quanto: number): void {
    let mudou = false;
    for (const m of [...this.ativas]) {
      if (!chave(m)) continue;
      const novo = (this.feito.get(m.id) ?? 0) + quanto;
      this.feito.set(m.id, novo);
      if (novo >= m.objetivo.quantidade) {
        this.ativas = this.ativas.filter((a) => a.id !== m.id);
        this.concluidas.add(m.id);
        this.historico.unshift(m.titulo);
        this.aoConcluir(m);
        mudou = true;
      }
    }
    if (mudou) this.repor();
  }

  /** Define o progresso absoluto (usado por contagens acumuladas). */
  private definir(chave: (m: Missao) => boolean, valor: number): void {
    let mudou = false;
    for (const m of [...this.ativas]) {
      if (!chave(m)) continue;
      this.feito.set(m.id, valor);
      if (valor >= m.objetivo.quantidade) {
        this.ativas = this.ativas.filter((a) => a.id !== m.id);
        this.concluidas.add(m.id);
        this.historico.unshift(m.titulo);
        this.aoConcluir(m);
        mudou = true;
      }
    }
    if (mudou) this.repor();
  }

  coletou(recurso: RecursoId, quantidade: number): void {
    this.somar((m) => m.objetivo.tipo === 'coletar' && m.objetivo.alvo === recurso, quantidade);
  }

  visitou(bioma: BiomaId): void {
    this.somar((m) => m.objetivo.tipo === 'visitar' && m.objetivo.alvo === bioma, 1);
  }

  vendeu(moedas: number): void {
    this.somar((m) => m.objetivo.tipo === 'vender', moedas);
  }

  abateu(): void {
    this.somar((m) => m.objetivo.tipo === 'cacar', 1);
  }

  /** O bestiário conta o total, então o progresso é absoluto. */
  anotou(totalDescobertas: number): void {
    this.definir((m) => m.objetivo.tipo === 'descobrir', totalDescobertas);
  }

  /** Chegou a um andar de caverna (o progresso é a profundidade alcançada). */
  desceu(caverna: CavernaId, andar: number): void {
    this.definir((m) => m.objetivo.tipo === 'descer' && m.objetivo.alvo === caverna, andar);
  }

  derrotouChefe(caverna: CavernaId): void {
    this.somar((m) => m.objetivo.tipo === 'chefe' && m.objetivo.alvo === caverna, 1);
  }

  /** Total de peças diferentes na coleção de arqueologia. */
  colecionou(total: number): void {
    this.definir((m) => m.objetivo.tipo === 'colecionar', total);
  }

  ler(): void {
    this.naoLidas = 0;
  }
}
