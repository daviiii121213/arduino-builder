/**
 * Registro central de arte. Tudo é gerado uma única vez, na inicialização,
 * e reaproveitado pelo jogo inteiro.
 */

import { criarJogador, type QuadrosJogador } from './sprites/player';
import { criarDinos, type ArteDino, type EspecieId } from './sprites/dinos';
import { criarTerreno, type TexturasTerreno } from './sprites/terrain';
import { criarCenario, type ArteCenario } from './sprites/props';
import { criarCasa, type ArteCasa } from './sprites/house';
import { criarUI, desenharVinheta, type ArteUI } from './sprites/ui';
import { criarEfeitos, type ArteEfeitos } from './sprites/effects';
import { criarGalpao, type ArteGalpao } from './sprites/warehouse';
import { sombra, type Sprite } from './pixel';
import { LARGURA, ALTURA } from '../core/screen';

export interface Assets {
  jogador: QuadrosJogador;
  dinos: Record<EspecieId, ArteDino>;
  terreno: TexturasTerreno;
  cenario: ArteCenario;
  casa: ArteCasa;
  ui: ArteUI;
  efeitos: ArteEfeitos;
  galpao: ArteGalpao;
  /** Sombras elípticas em alguns tamanhos padrão. */
  sombras: Record<'p' | 'm' | 'g' | 'gg', Sprite>;
  vinheta: Sprite;
}

export type EtapaCarregamento = (rotulo: string, progresso: number) => void;

/** Constrói toda a arte, informando o progresso para a tela de carregamento. */
export function carregarAssets(aviso?: EtapaCarregamento): Assets {
  const etapas: [string, () => void][] = [];
  const parcial: Partial<Assets> = {};

  etapas.push(['Desenhando o herói', () => (parcial.jogador = criarJogador())]);
  etapas.push(['Chocando os dinossauros', () => (parcial.dinos = criarDinos())]);
  etapas.push(['Plantando o terreno', () => (parcial.terreno = criarTerreno())]);
  etapas.push(['Fazendo crescer a selva', () => (parcial.cenario = criarCenario())]);
  etapas.push(['Construindo a casa', () => (parcial.casa = criarCasa())]);
  etapas.push(['Montando a interface', () => (parcial.ui = criarUI())]);
  etapas.push(['Acendendo os efeitos', () => (parcial.efeitos = criarEfeitos())]);
  etapas.push(['Abrindo o galpão do avô', () => (parcial.galpao = criarGalpao())]);
  etapas.push([
    'Ajustando as sombras',
    () => {
      parcial.sombras = {
        p: sombra(10, 5),
        m: sombra(16, 7),
        g: sombra(26, 9),
        gg: sombra(34, 11),
      };
      parcial.vinheta = desenharVinheta(LARGURA, ALTURA);
    },
  ]);

  etapas.forEach(([rotulo, fn], i) => {
    aviso?.(rotulo, i / etapas.length);
    fn();
  });
  aviso?.('Pronto', 1);

  return parcial as Assets;
}
