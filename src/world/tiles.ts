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
  TerraArada,
  // ---- bioma mágico
  GramaMagica,
  SoloCristal,
  // ---- pântano
  Turfa,
  LamaFunda,
  AguaPantano,
  // ---- floresta
  GramaFloresta,
  Folhagem,
  // ---- vulcânico
  Cinzas,
  RochaVulcanica,
  Lava,
  // ---- deserto
  AreiaClara,
  SoloRachado,
  // ---- cavernas
  PisoGruta,
  ParedeGruta,
  PisoMina,
  ParedeMina,
  Cascalho,
  PocaCaverna,
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
  [Tile.TerraArada]: { ...PADRAO, atrito: 0.95 },
  [Tile.GramaMagica]: { ...PADRAO },
  [Tile.SoloCristal]: { ...PADRAO, atrito: 1.05 },
  [Tile.Turfa]: { ...PADRAO, atrito: 0.82 },
  [Tile.LamaFunda]: { ...PADRAO, atrito: 0.55 },
  [Tile.AguaPantano]: { ...PADRAO, agua: true, atrito: 0.6 },
  [Tile.GramaFloresta]: { ...PADRAO },
  [Tile.Folhagem]: { ...PADRAO, atrito: 0.94 },
  [Tile.Cinzas]: { ...PADRAO, atrito: 0.9 },
  [Tile.RochaVulcanica]: { ...PADRAO },
  [Tile.Lava]: { ...PADRAO, solido: true },
  [Tile.AreiaClara]: { ...PADRAO, atrito: 0.9 },
  [Tile.SoloRachado]: { ...PADRAO },
  [Tile.PisoGruta]: { ...PADRAO },
  [Tile.ParedeGruta]: { ...PADRAO, solido: true },
  [Tile.PisoMina]: { ...PADRAO },
  [Tile.ParedeMina]: { ...PADRAO, solido: true },
  [Tile.Cascalho]: { ...PADRAO, atrito: 0.94 },
  [Tile.PocaCaverna]: { ...PADRAO, agua: true, atrito: 0.72 },
};

export function ehAgua(t: Tile): boolean {
  return PROPS[t].agua;
}

export function ehSolido(t: Tile): boolean {
  return PROPS[t].solido;
}
