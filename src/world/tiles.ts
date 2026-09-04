/** Tipos de terreno e suas propriedades físicas. */

export enum Tile {
  Vazio = 0,
  Grama,
  GramaFlorida,
  GramaSeca,
  Terra,
  Areia,
  Rocha,
  Lama,
  AguaRasa,
  AguaFunda,
  PisoMadeira,
  ParedeInterna,
  Tapete,
  Concreto,
}

export interface PropTile {
  /** Bloqueia o movimento de todas as criaturas terrestres. */
  solido: boolean;
  /** Conta como água (respingos, dinos aquáticos). */
  agua: boolean;
  /** Água funda: o jogador não entra, os aquáticos vivem aqui. */
  funda: boolean;
  /** Multiplicador de velocidade ao andar por cima. */
  atrito: number;
}

const PADRAO: PropTile = { solido: false, agua: false, funda: false, atrito: 1 };

export const PROPS: Record<Tile, PropTile> = {
  [Tile.Vazio]: { ...PADRAO, solido: true },
  [Tile.Grama]: { ...PADRAO },
  [Tile.GramaFlorida]: { ...PADRAO },
  [Tile.GramaSeca]: { ...PADRAO },
  [Tile.Terra]: { ...PADRAO },
  [Tile.Areia]: { ...PADRAO, atrito: 0.92 },
  [Tile.Rocha]: { ...PADRAO },
  [Tile.Lama]: { ...PADRAO, atrito: 0.7 },
  [Tile.AguaRasa]: { ...PADRAO, agua: true, atrito: 0.62 },
  [Tile.AguaFunda]: { ...PADRAO, solido: true, agua: true, funda: true },
  [Tile.PisoMadeira]: { ...PADRAO },
  [Tile.ParedeInterna]: { ...PADRAO, solido: true },
  [Tile.Tapete]: { ...PADRAO },
  [Tile.Concreto]: { ...PADRAO },
};

export function ehAgua(t: Tile): boolean {
  return PROPS[t].agua;
}

export function ehSolido(t: Tile): boolean {
  return PROPS[t].solido;
}
