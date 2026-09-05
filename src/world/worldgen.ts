/**
 * Geração do mundo pré-histórico e do interior da casa.
 *
 * O relevo vem de ruído determinístico (mesma semente = mesmo mundo), e sobre
 * ele são plantadas a selva, as pedras, os ossos, a casa do jogador e os
 * pontos de nascimento dos dinossauros.
 */

import { Rng, ValueNoise } from '../core/rng';
import { TAM_TILE } from '../gfx/sprites/terrain';
import { Nivel, type ObjetoCenario } from './level';
import { PROPS, Tile } from './tiles';
import { colocar } from './props';
import type { Assets } from '../gfx/assets';
import type { EspecieId } from '../gfx/sprites/dinos';
import { CASA_W, CASA_H, CASA_COLISAO, CASA_PORTA } from '../gfx/sprites/house';
import { CABANA_W, CABANA_H, CABANA_COLISAO, CABANA_PORTA } from '../gfx/sprites/cabin';
import { clamp, dist } from '../core/math';
import { NoRecurso } from '../systems/harvest';
import { definicoesDeNo, type NomeNo } from './nodes';
import { BIOMAS, CENTROS, indiceDoBioma, type BiomaId } from './biomes';
import { TODAS_FICHAS } from '../entities/dinoTypes';

export const ID_MUNDO = 'vale-dos-gigantes';
export const ID_CASA = 'casa-do-jogador';
export const ID_CABANA = 'cabana-de-melhorias';

/** Canto superior esquerdo da casa e da cabana, em pixels do mundo. */
export const CASA_X = 26 * TAM_TILE;
export const CASA_Y = 24 * TAM_TILE;
export const CABANA_X = 33 * TAM_TILE;
export const CABANA_Y = 24 * TAM_TILE;

const LARG_TILES = 120;
const ALT_TILES = 92;
const SEMENTE = 20260904;

export interface SpawnDino {
  especie: EspecieId;
  x: number;
  y: number;
}

export interface MundoGerado {
  nivel: Nivel;
  spawns: SpawnDino[];
  /** Onde o jogador aterrissa depois da viagem no tempo. */
  chegadaX: number;
  chegadaY: number;
  /** O sprite da casa no cenário — trocado quando o telhado é melhorado. */
  objetoCasa: ObjetoCenario;
}

/** Dez dinossauros: dois de cada categoria. */
export const ELENCO_DINOS: EspecieId[] = [
  'raptornoz',
  'raptornoz',
  'dentesangue',
  'dentesangue',
  'folhalonga',
  'folhalonga',
  'tricornis',
  'tricornis',
  'casconte',
  'casconte',
  'pedrapata',
  'pedrapata',
  'nadalonga',
  'nadalonga',
  'escamarela',
  'escamarela',
  'luminassauro',
  'luminassauro',
  'etherodonte',
  'etherodonte',
];

/** As dez criaturas exigidas: 2 mágicos, 2 carnívoros, 2 herbívoros, 2 terrestres, 2 aquáticos. */
export const DEZ_DINOS: EspecieId[] = [
  'luminassauro',
  'etherodonte',
  'raptornoz',
  'dentesangue',
  'folhalonga',
  'tricornis',
  'casconte',
  'pedrapata',
  'nadalonga',
  'escamarela',
];

export function gerarMundo(assets: Assets): MundoGerado {
  const nivel = new Nivel(ID_MUNDO, 'Vale dos Gigantes', LARG_TILES, ALT_TILES, 'exterior');
  const rng = new Rng(SEMENTE);
  const relevo = new ValueNoise(SEMENTE);
  const umidade = new ValueNoise(SEMENTE + 17);
  const pedras = new ValueNoise(SEMENTE + 53);
  const floresta = new ValueNoise(SEMENTE + 91);

  // -------------------------------------------------- biomas
  // A fronteira entre biomas é um diagrama de Voronoi cujas coordenadas são
  // deformadas por ruído: em vez de linhas retas saem bordas orgânicas. Perto
  // da divisa os dois biomas se misturam tile a tile, então a passagem de um
  // para o outro é gradual, sem emenda visível.
  const deformaX = new ValueNoise(SEMENTE + 211);
  const deformaY = new ValueNoise(SEMENTE + 307);

  const biomaDoTile = (tx: number, ty: number) => {
    const wx = tx + (deformaX.fbm(tx * 0.035, ty * 0.035, 3) - 0.5) * 24;
    const wy = ty + (deformaY.fbm(tx * 0.035 + 90, ty * 0.035 + 90, 3) - 0.5) * 24;
    let melhor = 0;
    let melhorD = Infinity;
    let segundo = 0;
    let segundoD = Infinity;
    for (let i = 0; i < CENTROS.length; i++) {
      const c = CENTROS[i];
      const d = Math.hypot(wx - c.tx, wy - c.ty) / c.peso;
      if (d < melhorD) {
        segundo = melhor;
        segundoD = melhorD;
        melhor = i;
        melhorD = d;
      } else if (d < segundoD) {
        segundo = i;
        segundoD = d;
      }
    }
    // 1 na divisa, 0 no miolo do bioma
    const mistura = clamp(1 - (segundoD - melhorD) / 15, 0, 1);
    return { dono: CENTROS[melhor].id, vizinho: CENTROS[segundo].id, mistura };
  };

  // -------------------------------------------------- terreno
  for (let ty = 0; ty < ALT_TILES; ty++) {
    for (let tx = 0; tx < LARG_TILES; tx++) {
      // borda do mundo: paredão intransponível
      const bordaX = Math.min(tx, LARG_TILES - 1 - tx);
      const bordaY = Math.min(ty, ALT_TILES - 1 - ty);
      if (Math.min(bordaX, bordaY) < 2) {
        nivel.definirTile(tx, ty, Tile.Vazio, rng.int(0, 2));
        continue;
      }

      const e = relevo.fbm(tx * 0.045, ty * 0.045, 4);
      const m = umidade.fbm(tx * 0.06 + 40, ty * 0.06 + 40, 3);
      const r = pedras.fbm(tx * 0.09 - 30, ty * 0.09 - 30, 3);

      const { dono, vizinho, mistura } = biomaDoTile(tx, ty);
      nivel.definirBioma(tx, ty, indiceDoBioma(dono));
      // na faixa de transição o chão do vizinho aparece salpicado
      // a chance cresce ao quadrado: no miolo quase nunca, na divisa quase metade
      const escolhido = rng.chance(mistura * mistura * 0.55) ? vizinho : dono;
      nivel.definirTile(tx, ty, BIOMAS[escolhido].terreno(e, m, r), rng.int(0, 3));
    }
  }

  // O quintal é sempre vale: a casa, a cabana e a máquina de venda ficam num
  // pedaço garantido de campo, independente de como o ruído desenhou a divisa.
  for (let ty = 14; ty < 44; ty++) {
    for (let tx = 14; tx < 56; tx++) {
      if (!nivel.dentro(tx, ty)) continue;
      const d = Math.hypot(tx - 33, ty - 28);
      if (d > 20) continue;
      nivel.definirBioma(tx, ty, indiceDoBioma('vale'));
      const e = relevo.fbm(tx * 0.045, ty * 0.045, 4);
      const m = umidade.fbm(tx * 0.06 + 40, ty * 0.06 + 40, 3);
      const r = pedras.fbm(tx * 0.09 - 30, ty * 0.09 - 30, 3);
      nivel.definirTile(tx, ty, BIOMAS.vale.terreno(e, m, r), rng.int(0, 3));
    }
  }

  // -------------------------------------------------- clareira e casa
  const casaTX = 26;
  const casaTY = 24;
  const casaX = casaTX * TAM_TILE;
  const casaY = casaTY * TAM_TILE;
  // a clareira cobre a casa, o quintal e a cabana de melhorias ao lado
  for (let ty = casaTY - 4; ty < casaTY + 11; ty++) {
    for (let tx = casaTX - 4; tx < casaTX + 20; tx++) {
      const t = nivel.tile(tx, ty);
      if (t === Tile.Vazio) continue;
      nivel.definirTile(tx, ty, rng.chance(0.15) ? Tile.GramaFlorida : Tile.Grama, rng.int(0, 3));
    }
  }
  // caminho de terra saindo da porta
  const portaTX = Math.floor((casaX + CASA_PORTA.x + CASA_PORTA.w / 2) / TAM_TILE);
  const portaTY = Math.floor((casaY + CASA_H) / TAM_TILE);
  for (let i = 0; i < 7; i++) {
    nivel.definirTile(portaTX, portaTY + i, Tile.Terra, rng.int(0, 2));
    if (i > 1) nivel.definirTile(portaTX + 1, portaTY + i, Tile.Terra, rng.int(0, 2));
  }
  for (let i = 0; i < 14; i++) {
    nivel.definirTile(portaTX + 1 + i, portaTY + 6, Tile.Terra, rng.int(0, 2));
  }
  // ramal que sobe até a porta da cabana
  const cabanaPortaTX = Math.floor((CABANA_X + CABANA_PORTA.x + CABANA_PORTA.w / 2) / TAM_TILE);
  const cabanaPortaTY = Math.floor((CABANA_Y + CABANA_H) / TAM_TILE);
  for (let ty = cabanaPortaTY; ty <= portaTY + 6; ty++) {
    nivel.definirTile(cabanaPortaTX, ty, Tile.Terra, rng.int(0, 2));
    nivel.definirTile(cabanaPortaTX + 1, ty, Tile.Terra, rng.int(0, 2));
  }

  // a casa em si (colisão do corpo + porta que leva ao interior)
  const { objeto: objetoCasa } = colocar(
    nivel,
    assets.casa.exterior,
    casaX + CASA_W / 2,
    casaY + CASA_H,
    { colisao: { w: CASA_COLISAO.w, h: CASA_COLISAO.h }, ajusteBase: -6 },
  );
  // a colisão acima cobre as paredes; a porta precisa ficar livre
  nivel.colisores[nivel.colisores.length - 1] = {
    x: casaX + CASA_COLISAO.x,
    y: casaY + CASA_COLISAO.y,
    w: CASA_COLISAO.w,
    h: CASA_COLISAO.h - 14,
  };
  // o lampião ao lado da porta ilumina a noite do vale
  nivel.luzes.push({ x: casaX + 44, y: casaY + 39 });
  nivel.portais.push({
    area: {
      x: casaX + CASA_PORTA.x,
      y: casaY + CASA_PORTA.y + 8,
      w: CASA_PORTA.w,
      h: CASA_PORTA.h,
    },
    destino: ID_CASA,
    entradaX: 0,
    entradaY: 0,
    rotulo: 'Entrar em casa',
  });

  // quintal: cerca, horta, barril, placa
  colocar(nivel, assets.casa.cerca, casaX - 10, casaY + CASA_H - 2, { colisao: { w: 12, h: 5 } });
  colocar(nivel, assets.casa.cerca, casaX - 22, casaY + CASA_H - 2, { colisao: { w: 12, h: 5 } });
  colocar(nivel, assets.casa.horta, casaX - 18, casaY + CASA_H + 14);
  colocar(nivel, assets.casa.horta, casaX - 4, casaY + CASA_H + 14);
  colocar(nivel, assets.casa.barril, casaX + CASA_W + 6, casaY + CASA_H - 3, {
    colisao: { w: 10, h: 5 },
    sombra: assets.sombras.p,
  });
  colocar(nivel, assets.casa.placa, casaX + CASA_W + 18, casaY + CASA_H + 8, {
    colisao: { w: 5, h: 4 },
  });

  // ---------------------------------------------------- cabana de melhorias
  colocar(nivel, assets.cabana.exterior, CABANA_X + CABANA_W / 2, CABANA_Y + CABANA_H, {
    ajusteBase: -6,
  });
  nivel.colisores[nivel.colisores.length - 1] = {
    x: CABANA_X + CABANA_COLISAO.x,
    y: CABANA_Y + CABANA_COLISAO.y,
    w: CABANA_COLISAO.w,
    h: CABANA_COLISAO.h,
  };
  nivel.adicionarColisor({
    x: CABANA_X + CABANA_COLISAO.x,
    y: CABANA_Y + CABANA_COLISAO.y,
    w: CABANA_COLISAO.w,
    h: CABANA_COLISAO.h - 16,
  });
  nivel.portais.push({
    area: {
      x: CABANA_X + CABANA_PORTA.x,
      y: CABANA_Y + CABANA_PORTA.y + 6,
      w: CABANA_PORTA.w,
      h: CABANA_PORTA.h,
    },
    destino: ID_CABANA,
    entradaX: 0,
    entradaY: 0,
    rotulo: 'Entrar na cabana',
  });
  nivel.luzes.push({ x: CABANA_X + 16, y: CABANA_Y + 42 });

  // máquina de venda, encostada na cabana
  const maquina = assets.cabana.maquinaVenda;
  const maqX = CABANA_X + CABANA_W + 14;
  const maqY = CABANA_Y + CABANA_H - 2;
  colocar(nivel, maquina, maqX, maqY, { colisao: { w: 20, h: 8 }, sombra: assets.sombras.g });
  colocar(nivel, assets.colheita.placa, maqX + 17, maqY - 2, { colisao: { w: 6, h: 4 } });
  nivel.interativos.push({
    area: { x: maqX - 14, y: maqY - 10, w: 28, h: 22 },
    rotulo: 'Vender recursos',
    acao: 'venda',
  });

  const longeDaCasa = (px: number, py: number, raio: number) =>
    dist(px, py, casaX + CASA_W / 2, casaY + CASA_H / 2) > raio &&
    dist(px, py, CABANA_X + CABANA_W / 2, CABANA_Y + CABANA_H / 2) > raio * 0.8;

  // -------------------------------------------------- vegetação e recursos
  const defs = definicoesDeNo(assets);
  /** Coloca um objeto e registra o nó de recurso correspondente. */
  const plantarNo = (
    nome: NomeNo,
    sprite: typeof assets.cenario.araucaria,
    x: number,
    y: number,
    opc: Parameters<typeof colocar>[4] = {},
  ) => {
    const { objeto, colisor } = colocar(nivel, sprite, x, y, opc);
    nivel.nos.push(new NoRecurso(defs[nome], objeto, colisor));
  };

  const b = assets.biomas;

  /**
   * Vegetação e formações de cada bioma. Cada região tem árvore, arbusto,
   * detalhe de chão e nó de recurso próprios — nada é a mesma planta repintada.
   */
  const vegetacaoDeBioma = (
    bioma: BiomaId,
    t: Tile,
    cx: number,
    cy: number,
    densidade: number,
  ): void => {
    switch (bioma) {
      // ------------------------------------------------ clareira encantada
      case 'magico': {
        if (densidade > 0.58 && rng.chance(0.06 + (densidade - 0.58) * 0.4)) {
          plantarNo('arvoreCristal', b.arvoreCristal, cx, cy, {
            colisao: { w: 9, h: 5 },
            sombra: assets.sombras.g,
          });
          return;
        }
        if (t === Tile.SoloCristal && rng.chance(0.09)) {
          plantarNo('veioEssencia', b.cristalDuplo, cx, cy, {
            colisao: { w: 12, h: 6 },
            sombra: assets.sombras.m,
          });
          return;
        }
        if (rng.chance(0.05)) {
          colocar(nivel, assets.cenario.cristal, cx, cy);
          return;
        }
        if (rng.chance(0.04)) {
          colocar(nivel, b.cogumeloMagico, cx, cy, { sombra: assets.sombras.p });
          return;
        }
        if (rng.chance(0.06)) colocar(nivel, b.florEstrela, cx, cy, { balanca: true });
        return;
      }

      // -------------------------------------------------- pântano das raízes
      case 'pantano': {
        if (densidade > 0.5 && rng.chance(0.1 + (densidade - 0.5) * 0.4)) {
          plantarNo('cipreste', b.cipreste, cx, cy, {
            colisao: { w: 9, h: 5 },
            sombra: assets.sombras.g,
          });
          return;
        }
        if (rng.chance(0.035)) {
          colocar(nivel, b.arvoreMorta, cx, cy, {
            colisao: { w: 8, h: 4 },
            sombra: assets.sombras.m,
          });
          return;
        }
        if ((t === Tile.Turfa || t === Tile.Lama || t === Tile.LamaFunda) && rng.chance(0.035)) {
          plantarNo('turfeira', assets.colheita.montinho, cx, cy, { sombra: assets.sombras.p });
          return;
        }
        if (rng.chance(0.05)) {
          plantarNo('moitaPantano', b.moitaPantano, cx, cy, { balanca: true });
          return;
        }
        if (t === Tile.LamaFunda && rng.chance(0.05)) {
          colocar(nivel, b.bolhaLama, cx, cy);
          return;
        }
        if (rng.chance(0.02)) colocar(nivel, assets.cenario.junco, cx, cy, { balanca: true });
        return;
      }

      // ---------------------------------------------------- floresta fechada
      case 'floresta': {
        // a floresta é fechada de propósito: muita árvore, pouca visão
        if (densidade > 0.42 && rng.chance(0.16 + (densidade - 0.42) * 0.7)) {
          plantarNo('arvoreAlta', b.arvoreAlta, cx + rng.range(-3, 3), cy + rng.range(-2, 2), {
            colisao: { w: 10, h: 6 },
            sombra: assets.sombras.g,
            balanca: true,
          });
          return;
        }
        if (rng.chance(0.05)) {
          plantarNo('arbustoBaga', b.arbustoBaga, cx, cy, { balanca: true });
          return;
        }
        if (rng.chance(0.09)) {
          colocar(nivel, b.samambaiaGigante, cx, cy, { balanca: true });
          return;
        }
        if (rng.chance(0.03)) {
          colocar(nivel, b.cogumeloDuplo, cx, cy);
          return;
        }
        if (rng.chance(0.012)) {
          colocar(nivel, assets.cenario.troncoMusgo, cx, cy, {
            colisao: { w: 22, h: 5 },
            sombra: assets.sombras.g,
          });
        }
        return;
      }

      // ------------------------------------------------------- campo de lava
      case 'vulcanico': {
        if (densidade > 0.6 && rng.chance(0.07)) {
          plantarNo('arvoreCarbonizada', b.arvoreCarbonizada, cx, cy, {
            colisao: { w: 8, h: 4 },
            sombra: assets.sombras.m,
          });
          return;
        }
        if (t === Tile.RochaVulcanica && rng.chance(0.16)) {
          plantarNo('veioObsidiana', b.rochaObsidiana, cx, cy, {
            colisao: { w: 12, h: 6 },
            sombra: assets.sombras.m,
          });
          return;
        }
        if (t === Tile.Cinzas && rng.chance(0.045)) {
          plantarNo('fumarola', b.fumarola, cx, cy, { sombra: assets.sombras.p });
          nivel.luzes.push({ x: cx, y: cy - 6 });
          return;
        }
        if (rng.chance(0.035)) {
          colocar(nivel, b.cristalEnxofre, cx, cy, { sombra: assets.sombras.p });
          return;
        }
        if (rng.chance(0.02)) {
          colocar(nivel, assets.cenario.pedraPequena, cx, cy, { sombra: assets.sombras.p });
        }
        return;
      }

      // ---------------------------------------------------- deserto de vidro
      case 'deserto': {
        if (rng.chance(0.035)) {
          plantarNo('cacto', b.cacto, cx, cy, { colisao: { w: 6, h: 4 } });
          return;
        }
        if (t === Tile.Rocha && rng.chance(0.2)) {
          plantarNo('arenito', b.arenito, cx, cy, {
            colisao: { w: 12, h: 6 },
            sombra: assets.sombras.m,
          });
          return;
        }
        if (t === Tile.AreiaClara && rng.chance(0.04)) {
          plantarNo('areiaVitrea', assets.colheita.montinho, cx, cy, {
            sombra: assets.sombras.p,
          });
          return;
        }
        if (rng.chance(0.03)) {
          colocar(nivel, b.cactoPequeno, cx, cy);
          return;
        }
        if (rng.chance(0.045)) {
          colocar(nivel, b.arbustoSeco, cx, cy, { balanca: true });
          return;
        }
        if (rng.chance(0.008)) {
          colocar(nivel, rng.chance(0.5) ? assets.cenario.caveira : assets.cenario.costelas, cx, cy, {
            sombra: assets.sombras.p,
          });
        }
        return;
      }

      default:
        return;
    }
  };

  const ehLivre = (tx: number, ty: number) => {
    const p = PROPS[nivel.tile(tx, ty)];
    return !p.solido && !p.agua;
  };
  const ehCaminho = (tx: number, ty: number) => nivel.tile(tx, ty) === Tile.Terra;

  for (let ty = 3; ty < ALT_TILES - 3; ty++) {
    for (let tx = 3; tx < LARG_TILES - 3; tx++) {
      if (!ehLivre(tx, ty) || ehCaminho(tx, ty)) continue;
      const cx = tx * TAM_TILE + TAM_TILE / 2;
      const cy = ty * TAM_TILE + TAM_TILE;
      if (!longeDaCasa(cx, cy, 78)) continue;

      const densidade = floresta.fbm(tx * 0.05, ty * 0.05, 3);
      const t = nivel.tile(tx, ty);

      // cada bioma planta a sua própria vegetação; o vale segue abaixo
      const bioma = nivel.bioma(tx, ty);
      if (bioma !== 'vale') {
        vegetacaoDeBioma(bioma, t, cx, cy, densidade);
        continue;
      }

      // árvores grandes: cada uma é um nó de madeira para o machado
      if (densidade > 0.56 && rng.chance(0.1 + (densidade - 0.56) * 0.55)) {
        const araucaria = rng.chance(0.55);
        plantarNo(
          araucaria ? 'araucaria' : 'cicadacea',
          araucaria ? assets.cenario.araucaria : assets.cenario.cicadacea,
          cx + rng.range(-3, 3),
          cy + rng.range(-2, 2),
          { colisao: { w: 10, h: 6 }, sombra: assets.sombras.g, balanca: true },
        );
        continue;
      }
      // pedras e veios de minério, para a picareta
      if (t === Tile.Rocha && rng.chance(0.22)) {
        const sorte = rng.next();
        if (sorte < 0.16) {
          plantarNo('rochaCristal', assets.colheita.rochaCristal, cx, cy, {
            colisao: { w: 14, h: 7 },
            sombra: assets.sombras.m,
          });
        } else if (sorte < 0.5) {
          plantarNo('rochaFerro', assets.colheita.rochaFerro, cx, cy, {
            colisao: { w: 14, h: 7 },
            sombra: assets.sombras.m,
          });
        } else {
          plantarNo('pedra', assets.cenario.pedraGrande, cx, cy, {
            colisao: { w: 14, h: 7 },
            sombra: assets.sombras.m,
          });
        }
        continue;
      }
      // pedras soltas na grama também rendem pedra
      if (t !== Tile.Rocha && rng.chance(0.012)) {
        plantarNo('pedra', assets.cenario.pedraGrande, cx, cy, {
          colisao: { w: 14, h: 7 },
          sombra: assets.sombras.m,
        });
        continue;
      }
      // montinhos de terra fofa: é onde a pá acha coisa enterrada
      if ((t === Tile.Areia || t === Tile.Terra || t === Tile.Lama) && rng.chance(0.05)) {
        plantarNo('montinho', assets.colheita.montinho, cx, cy, { sombra: assets.sombras.p });
        continue;
      }
      // capim alto: a enxada tira fibra e semente daqui
      if ((t === Tile.Grama || t === Tile.GramaSeca) && rng.chance(0.045)) {
        plantarNo('capim', assets.colheita.capimAlto, cx, cy, { balanca: true });
        continue;
      }
      if (rng.chance(0.02)) {
        colocar(nivel, assets.cenario.pedraPequena, cx, cy, { sombra: assets.sombras.p });
        continue;
      }
      // arbustos e samambaias (atravessáveis, dão vida ao chão)
      if (rng.chance(0.055)) {
        colocar(nivel, assets.cenario.arbusto, cx, cy, { balanca: true });
        continue;
      }
      if (rng.chance(0.07)) {
        colocar(nivel, assets.cenario.samambaia, cx, cy, { balanca: true });
        continue;
      }
      if (t === Tile.GramaFlorida && rng.chance(0.05)) {
        colocar(nivel, rng.chance(0.5) ? assets.cenario.flor : assets.cenario.florAmarela, cx, cy, {
          balanca: true,
        });
        continue;
      }
      if (rng.chance(0.012)) {
        colocar(nivel, assets.cenario.cogumelo, cx, cy);
        continue;
      }
      // ossadas antigas espalhadas pelo vale
      if (rng.chance(0.006)) {
        colocar(nivel, rng.chance(0.5) ? assets.cenario.caveira : assets.cenario.costelas, cx, cy, {
          sombra: assets.sombras.p,
        });
        continue;
      }
      if (rng.chance(0.006)) {
        colocar(
          nivel,
          rng.chance(0.5) ? assets.cenario.troncoCaido : assets.cenario.troncoMusgo,
          cx,
          cy,
          { colisao: { w: 22, h: 5 }, sombra: assets.sombras.g },
        );
        continue;
      }
      // juncos na beira da água
      const perto = [
        nivel.tile(tx + 1, ty),
        nivel.tile(tx - 1, ty),
        nivel.tile(tx, ty + 1),
        nivel.tile(tx, ty - 1),
      ];
      if (perto.some((p) => p === Tile.AguaRasa) && rng.chance(0.4)) {
        colocar(nivel, assets.cenario.junco, cx, cy, { balanca: true });
      }
    }
  }

  // vitórias-régias na água rasa
  for (let ty = 3; ty < ALT_TILES - 3; ty++) {
    for (let tx = 3; tx < LARG_TILES - 3; tx++) {
      const t = nivel.tile(tx, ty);
      const bioma = nivel.bioma(tx, ty);
      if (t === Tile.AguaRasa && bioma === 'deserto') {
        // oásis: palmeiras na beira da poça
        if (rng.chance(0.25)) {
          colocar(nivel, b.palmeira, tx * TAM_TILE + 8, ty * TAM_TILE + 20, {
            sombra: assets.sombras.m,
          });
        }
        continue;
      }
      if ((t === Tile.AguaRasa || t === Tile.AguaPantano) && rng.chance(0.03)) {
        colocar(nivel, assets.cenario.nenufar, tx * TAM_TILE + 8, ty * TAM_TILE + 14);
      }
    }
  }

  // -------------------------------------------------- pontos de nascimento
  // Cada criatura nasce no bioma dela e volta para lá quando desiste da caça.
  const livreParaBicho = (x: number, y: number) =>
    !nivel.colisores.some(
      (c) => x > c.x - 16 && x < c.x + c.w + 16 && y > c.y - 16 && y < c.y + c.h + 16,
    );

  const acharNoBioma = (
    bioma: BiomaId,
    aquatico: boolean,
    minDist: number,
  ): { x: number; y: number } | null => {
    for (let tent = 0; tent < 5000; tent++) {
      const tx = rng.int(5, LARG_TILES - 6);
      const ty = rng.int(5, ALT_TILES - 6);
      if (nivel.bioma(tx, ty) !== bioma) continue;
      if (aquatico) {
        // precisa de uma poça com folga em volta
        let ok = true;
        for (let dy = -1; dy <= 1 && ok; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!PROPS[nivel.tile(tx + dx, ty + dy)].agua) {
              ok = false;
              break;
            }
          }
        if (!ok) continue;
      } else if (!ehLivre(tx, ty)) {
        continue;
      }
      const x = tx * TAM_TILE + 8;
      const y = ty * TAM_TILE + 8;
      if (!longeDaCasa(x, y, minDist)) continue;
      if (!livreParaBicho(x, y)) continue;
      return { x, y };
    }
    return null;
  };

  /** Último recurso: qualquer chão livre longe de casa. */
  const acharQualquer = (minDist: number): { x: number; y: number } => {
    for (let tent = 0; tent < 4000; tent++) {
      const tx = rng.int(6, LARG_TILES - 7);
      const ty = rng.int(6, ALT_TILES - 7);
      if (!ehLivre(tx, ty)) continue;
      const x = tx * TAM_TILE + 8;
      const y = ty * TAM_TILE + 8;
      if (!longeDaCasa(x, y, minDist)) continue;
      if (!livreParaBicho(x, y)) continue;
      return { x, y };
    }
    return { x: casaX + 220, y: casaY + 220 };
  };

  const spawns: SpawnDino[] = [];
  for (const ficha of TODAS_FICHAS) {
    // quanto mais perigoso, mais longe de casa ele começa
    const minDist = 120 + ficha.dificuldade * 45;
    // os bichos mansos aparecem em dupla; os perigosos, sozinhos
    const quantos = ficha.dificuldade <= 2 ? 2 : 1;
    for (let n = 0; n < quantos; n++) {
      const p =
        acharNoBioma(ficha.bioma, ficha.aquatico, minDist) ??
        acharNoBioma(ficha.bioma, ficha.aquatico, 90) ??
        acharQualquer(minDist);
      spawns.push({ especie: ficha.id, x: p.x, y: p.y });
    }
  }

  nivel.ordenarObjetos();

  // chegada da máquina do tempo: na clareira, em frente à casa
  const chegadaX = casaX + CASA_W / 2 + 6;
  const chegadaY = casaY + CASA_H + 44;
  nivel.entradaX = chegadaX;
  nivel.entradaY = chegadaY;

  return { nivel, spawns, chegadaX, chegadaY, objetoCasa };
}

/**
 * Interior da casa: um quarto pequeno (11x7 tiles) com a mobília encostada nas
 * quatro paredes. Fora do quarto fica escuro, para o olho ir direto na sala.
 */
export function criarInterior(assets: Assets): Nivel {
  const LT = 30;
  const AT = 17;
  const nivel = new Nivel(ID_CASA, 'Dentro de casa', LT, AT, 'interior', Tile.Vazio);
  const rng = new Rng(777);

  const x0 = 10;
  const x1 = 20;
  const y0 = 5;
  const y1 = 11;
  // anel de parede em volta do quarto; o resto do mapa fica escuro
  for (let ty = y0 - 2; ty <= y1 + 1; ty++) {
    for (let tx = x0 - 2; tx <= x1 + 2; tx++) {
      nivel.definirTile(tx, ty, Tile.ParedeInterna, rng.int(0, 1));
    }
  }
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      nivel.definirTile(tx, ty, Tile.PisoMadeira, rng.int(0, 2));
    }
  }

  const portaTX = 14;
  nivel.portais.push({
    area: { x: portaTX * TAM_TILE, y: y1 * TAM_TILE, w: TAM_TILE * 2, h: TAM_TILE },
    destino: ID_MUNDO,
    entradaX: 0,
    entradaY: 0,
    rotulo: 'Sair',
  });
  nivel.entradaX = (portaTX + 1) * TAM_TILE;
  nivel.entradaY = y1 * TAM_TILE + 12;

  const c = assets.casa;
  // ---- tapete embaixo de tudo
  colocar(nivel, c.tapete, 248, 176, { ajusteBase: -34 });

  // ---- parede do fundo
  colocar(nivel, c.estante, 186, 96, { colisao: { w: 26, h: 6 } });
  colocar(nivel, c.janela, 218, 88);
  colocar(nivel, c.prateleiraParede, 246, 86);
  colocar(nivel, assets.cenario.caveira, 268, 86);
  colocar(nivel, c.lareira, 302, 98, { colisao: { w: 24, h: 8 } });
  nivel.fogos.push({ x: 302, y: 88 });
  nivel.luzes.push({ x: 302, y: 86 });
  colocar(nivel, c.quadro, 328, 88);

  // ---- lado esquerdo
  colocar(nivel, c.cama, 172, 128, { colisao: { w: 15, h: 12 } });
  colocar(nivel, c.armario, 172, 158, { colisao: { w: 16, h: 7 } });

  // ---- centro: mesa, cadeiras e lampião aceso
  colocar(nivel, c.mesa, 248, 168, { colisao: { w: 28, h: 8 } });
  colocar(nivel, c.cadeira, 226, 172, { colisao: { w: 8, h: 4 } });
  colocar(nivel, c.cadeira, 272, 172, { colisao: { w: 8, h: 4 } });
  colocar(nivel, c.lampiao, 248, 160, { ajusteBase: 14 });
  nivel.luzes.push({ x: 248, y: 156 });

  // ---- lado direito
  const bau = colocar(nivel, c.bau, 322, 126, { colisao: { w: 16, h: 6 } });
  nivel.nomeados.set('bau', bau.objeto);
  colocar(nivel, c.banco, 322, 152, { colisao: { w: 18, h: 5 } });
  colocar(nivel, c.barril, 326, 182, { colisao: { w: 10, h: 5 } });
  colocar(nivel, c.caixa, 178, 184, { colisao: { w: 14, h: 5 } });
  colocar(nivel, c.vaso, 202, 186);

  // ---- o que dá para usar dentro de casa
  nivel.interativos.push(
    { area: { x: 160, y: 110, w: 28, h: 26 }, rotulo: 'Dormir até amanhecer', acao: 'cama' },
    { area: { x: 310, y: 112, w: 26, h: 22 }, rotulo: 'Abrir o baú', acao: 'bau' },
    { area: { x: 290, y: 78, w: 28, h: 24 }, rotulo: 'Aquecer as mãos', acao: 'lareira' },
    { area: { x: 172, y: 78, w: 28, h: 22 }, rotulo: 'Ler o diário do avô', acao: 'estante' },
    { area: { x: 208, y: 74, w: 24, h: 20 }, rotulo: 'Olhar pela janela', acao: 'janela' },
  );

  nivel.ordenarObjetos();
  return nivel;
}

/**
 * Interior da cabana: oficina apertada, com forja de pedra num canto e as duas
 * pessoas que atendem o jogador.
 */
export function criarInteriorCabana(assets: Assets): Nivel {
  const LT = 30;
  const AT = 17;
  const nivel = new Nivel(ID_CABANA, 'Cabana de melhorias', LT, AT, 'cabana', Tile.Vazio);
  const rng = new Rng(4242);

  const x0 = 9;
  const x1 = 20;
  const y0 = 5;
  const y1 = 11;
  for (let ty = y0 - 2; ty <= y1 + 1; ty++) {
    for (let tx = x0 - 2; tx <= x1 + 2; tx++) {
      nivel.definirTile(tx, ty, Tile.ParedeInterna, rng.int(0, 1));
    }
  }
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      // piso de madeira, e pedra no canto da forja
      const forja = tx >= 17 && ty <= 7;
      nivel.definirTile(tx, ty, forja ? Tile.Rocha : Tile.PisoMadeira, rng.int(0, 2));
    }
  }

  const portaTX = 14;
  nivel.portais.push({
    area: { x: portaTX * TAM_TILE, y: y1 * TAM_TILE, w: TAM_TILE * 2, h: TAM_TILE },
    destino: ID_MUNDO,
    entradaX: 0,
    entradaY: 0,
    rotulo: 'Sair',
  });
  nivel.entradaX = (portaTX + 1) * TAM_TILE;
  nivel.entradaY = y1 * TAM_TILE + 12;

  const c = assets.cabana;
  const casa = assets.casa;

  // ---- parede do fundo: ferramentas, peças e a forja
  colocar(nivel, c.suporteFerramentas, 168, 94, { colisao: { w: 18, h: 5 } });
  colocar(nivel, c.caixaPecas, 200, 90, { colisao: { w: 14, h: 5 } });
  colocar(nivel, casa.quadro, 226, 88);
  colocar(nivel, c.fornalha, 300, 100, { colisao: { w: 18, h: 7 } });
  nivel.fogos.push({ x: 300, y: 90 });
  nivel.luzes.push({ x: 300, y: 88 });

  // ---- estações de trabalho
  colocar(nivel, c.bancadaOficina, 168, 132, { colisao: { w: 22, h: 8 } });
  colocar(nivel, c.bigorna, 288, 130, { colisao: { w: 10, h: 6 }, sombra: assets.sombras.p });
  colocar(nivel, casa.estante, 200, 184, { colisao: { w: 26, h: 6 } });
  colocar(nivel, casa.barril, 156, 176, { colisao: { w: 10, h: 5 } });
  colocar(nivel, casa.caixa, 320, 186, { colisao: { w: 14, h: 5 } });
  colocar(nivel, casa.tapete, 264, 168, { ajusteBase: -34 });
  colocar(nivel, casa.mesa, 264, 162, { colisao: { w: 28, h: 8 } });
  colocar(nivel, casa.lampiao, 264, 154, { ajusteBase: 14 });
  nivel.luzes.push({ x: 264, y: 150 });
  colocar(nivel, casa.vaso, 324, 152);

  // ---- as duas pessoas (as posições casam com npcs.ts)
  nivel.interativos.push(
    {
      area: { x: 250, y: 104, w: 44, h: 40 },
      rotulo: 'Falar com Bruna (ferramentas e armaduras)',
      acao: 'melhoria-ferreira',
    },
    {
      area: { x: 148, y: 140, w: 44, h: 40 },
      rotulo: 'Falar com Nilo (inventário e casa)',
      acao: 'melhoria-marceneiro',
    },
    { area: { x: 158, y: 118, w: 30, h: 20 }, rotulo: 'Olhar a bancada', acao: 'bancada' },
  );

  nivel.ordenarObjetos();
  return nivel;
}

/**
 * Um ponto de chão livre no miolo de um bioma — usado pelos atalhos do modo de
 * teste (e por qualquer sistema que precise levar o jogador até lá).
 */
export function pontoDoBioma(nivel: Nivel, bioma: BiomaId): { x: number; y: number } {
  const c = CENTROS.find((k) => k.id === bioma) ?? CENTROS[0];
  for (let raio = 0; raio < 46; raio++) {
    for (let dy = -raio; dy <= raio; dy++) {
      for (let dx = -raio; dx <= raio; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
        const tx = c.tx + dx;
        const ty = c.ty + dy;
        if (!nivel.dentro(tx, ty) || nivel.bioma(tx, ty) !== bioma) continue;
        const prop = PROPS[nivel.tile(tx, ty)];
        if (prop.solido || prop.agua) continue;
        return { x: tx * TAM_TILE + 8, y: ty * TAM_TILE + 12 };
      }
    }
  }
  return { x: c.tx * TAM_TILE, y: c.ty * TAM_TILE };
}
