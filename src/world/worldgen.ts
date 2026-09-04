/**
 * Geração do mundo pré-histórico e do interior da casa.
 *
 * O relevo vem de ruído determinístico (mesma semente = mesmo mundo), e sobre
 * ele são plantadas a selva, as pedras, os ossos, a casa do jogador e os
 * pontos de nascimento dos dinossauros.
 */

import { Rng, ValueNoise } from '../core/rng';
import { TAM_TILE } from '../gfx/sprites/terrain';
import { Nivel } from './level';
import { Tile } from './tiles';
import { colocar } from './props';
import type { Assets } from '../gfx/assets';
import type { EspecieId } from '../gfx/sprites/dinos';
import { CASA_W, CASA_H, CASA_COLISAO, CASA_PORTA } from '../gfx/sprites/house';
import { dist } from '../core/math';

export const ID_MUNDO = 'vale-dos-gigantes';
export const ID_CASA = 'casa-do-jogador';

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

  // -------------------------------------------------- terreno
  for (let ty = 0; ty < ALT_TILES; ty++) {
    for (let tx = 0; tx < LARG_TILES; tx++) {
      // borda do vale: paredão de rocha intransponível
      const bordaX = Math.min(tx, LARG_TILES - 1 - tx);
      const bordaY = Math.min(ty, ALT_TILES - 1 - ty);
      if (Math.min(bordaX, bordaY) < 2) {
        nivel.definirTile(tx, ty, Tile.Vazio, rng.int(0, 2));
        continue;
      }

      const e = relevo.fbm(tx * 0.045, ty * 0.045, 4);
      const m = umidade.fbm(tx * 0.06 + 40, ty * 0.06 + 40, 3);
      const r = pedras.fbm(tx * 0.09 - 30, ty * 0.09 - 30, 3);

      let t: Tile;
      if (e < 0.3) t = Tile.AguaFunda;
      else if (e < 0.365) t = Tile.AguaRasa;
      else if (e < 0.4) t = Tile.Areia;
      else if (r > 0.76) t = Tile.Rocha;
      else if (e < 0.425 && m > 0.5) t = Tile.Lama;
      else if (m > 0.63) t = Tile.GramaFlorida;
      else if (m < 0.34) t = Tile.GramaSeca;
      else t = Tile.Grama;

      nivel.definirTile(tx, ty, t, rng.int(0, 3));
    }
  }

  // -------------------------------------------------- clareira e casa
  const casaTX = 26;
  const casaTY = 24;
  const casaX = casaTX * TAM_TILE;
  const casaY = casaTY * TAM_TILE;
  for (let ty = casaTY - 4; ty < casaTY + 12; ty++) {
    for (let tx = casaTX - 4; tx < casaTX + 12; tx++) {
      const t = nivel.tile(tx, ty);
      if (t === Tile.Vazio) continue;
      nivel.definirTile(tx, ty, rng.chance(0.15) ? Tile.GramaFlorida : Tile.Grama, rng.int(0, 3));
    }
  }
  // caminho de terra saindo da porta
  const portaTX = Math.floor((casaX + CASA_PORTA.x + CASA_PORTA.w / 2) / TAM_TILE);
  const portaTY = Math.floor((casaY + CASA_H) / TAM_TILE);
  for (let i = 0; i < 9; i++) {
    nivel.definirTile(portaTX, portaTY + i, Tile.Terra, rng.int(0, 2));
    if (i > 1) nivel.definirTile(portaTX + 1, portaTY + i, Tile.Terra, rng.int(0, 2));
  }
  for (let i = 0; i < 12; i++) {
    nivel.definirTile(portaTX + 1 + i, portaTY + 8, Tile.Terra, rng.int(0, 2));
  }

  // a casa em si (colisão do corpo + porta que leva ao interior)
  colocar(nivel, assets.casa.exterior, casaX + CASA_W / 2, casaY + CASA_H, {
    colisao: { w: CASA_COLISAO.w, h: CASA_COLISAO.h },
    ajusteBase: -6,
  });
  // a colisão acima cobre as paredes; a porta precisa ficar livre
  nivel.colisores[nivel.colisores.length - 1] = {
    x: casaX + CASA_COLISAO.x,
    y: casaY + CASA_COLISAO.y,
    w: CASA_COLISAO.w,
    h: CASA_COLISAO.h - 14,
  };
  // o lampião ao lado da porta ilumina a noite do vale
  nivel.luzes.push({ x: casaX + 58, y: casaY + 57 });
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
  colocar(nivel, assets.casa.cerca, casaX - 14, casaY + CASA_H - 2, { colisao: { w: 16, h: 6 } });
  colocar(nivel, assets.casa.cerca, casaX - 30, casaY + CASA_H - 2, { colisao: { w: 16, h: 6 } });
  colocar(nivel, assets.casa.horta, casaX - 22, casaY + CASA_H + 20);
  colocar(nivel, assets.casa.horta, casaX - 6, casaY + CASA_H + 20);
  colocar(nivel, assets.casa.barril, casaX + CASA_W + 8, casaY + CASA_H - 4, {
    colisao: { w: 10, h: 6 },
    sombra: assets.sombras.p,
  });
  colocar(nivel, assets.casa.placa, casaX + CASA_W + 22, casaY + CASA_H + 10, {
    colisao: { w: 6, h: 4 },
  });

  const longeDaCasa = (px: number, py: number, raio: number) =>
    dist(px, py, casaX + CASA_W / 2, casaY + CASA_H / 2) > raio;

  // -------------------------------------------------- vegetação e detritos
  const ehLivre = (tx: number, ty: number) => {
    const t = nivel.tile(tx, ty);
    return t !== Tile.Vazio && t !== Tile.AguaFunda && t !== Tile.AguaRasa;
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

      // árvores grandes: mais frequentes nas manchas densas de selva
      if (densidade > 0.56 && rng.chance(0.1 + (densidade - 0.56) * 0.55)) {
        const arvore = rng.chance(0.55) ? assets.cenario.araucaria : assets.cenario.cicadacea;
        colocar(nivel, arvore, cx + rng.range(-3, 3), cy + rng.range(-2, 2), {
          colisao: { w: 10, h: 6 },
          sombra: assets.sombras.g,
          balanca: true,
        });
        continue;
      }
      // pedras
      if (t === Tile.Rocha && rng.chance(0.16)) {
        colocar(nivel, assets.cenario.pedraGrande, cx, cy, {
          colisao: { w: 14, h: 7 },
          sombra: assets.sombras.m,
        });
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
      if (nivel.tile(tx, ty) === Tile.AguaRasa && rng.chance(0.03)) {
        colocar(nivel, assets.cenario.nenufar, tx * TAM_TILE + 8, ty * TAM_TILE + 14);
      }
    }
  }

  // -------------------------------------------------- pontos de nascimento
  const acharTerra = (minDist: number): { x: number; y: number } => {
    for (let tent = 0; tent < 4000; tent++) {
      const tx = rng.int(6, LARG_TILES - 7);
      const ty = rng.int(6, ALT_TILES - 7);
      if (!ehLivre(tx, ty)) continue;
      const x = tx * TAM_TILE + 8;
      const y = ty * TAM_TILE + 8;
      if (!longeDaCasa(x, y, minDist)) continue;
      if (nivel.colisores.some((c) => x > c.x - 16 && x < c.x + c.w + 16 && y > c.y - 16 && y < c.y + c.h + 16))
        continue;
      return { x, y };
    }
    return { x: casaX + 220, y: casaY + 220 };
  };

  const acharAgua = (): { x: number; y: number } => {
    for (let tent = 0; tent < 6000; tent++) {
      const tx = rng.int(6, LARG_TILES - 7);
      const ty = rng.int(6, ALT_TILES - 7);
      if (nivel.tile(tx, ty) !== Tile.AguaFunda) continue;
      // precisa de espaço: os vizinhos também devem ser água
      let ok = true;
      for (let j = -1; j <= 1 && ok; j++)
        for (let i = -1; i <= 1; i++) {
          const t = nivel.tile(tx + i, ty + j);
          if (t !== Tile.AguaFunda && t !== Tile.AguaRasa) {
            ok = false;
            break;
          }
        }
      if (ok) return { x: tx * TAM_TILE + 8, y: ty * TAM_TILE + 8 };
    }
    return { x: casaX - 200, y: casaY + 300 };
  };

  const spawns: SpawnDino[] = [];
  const distanciaPorEspecie: Record<string, number> = {
    raptornoz: 200,
    dentesangue: 300,
    folhalonga: 150,
    tricornis: 170,
    casconte: 190,
    pedrapata: 210,
    luminassauro: 260,
    etherodonte: 280,
  };

  for (const especie of DEZ_DINOS) {
    if (especie === 'nadalonga' || especie === 'escamarela') {
      const p = acharAgua();
      spawns.push({ especie, x: p.x, y: p.y });
    } else {
      const p = acharTerra(distanciaPorEspecie[especie] ?? 200);
      spawns.push({ especie, x: p.x, y: p.y });
      // cristais mágicos marcam o território dos dinossauros mágicos
      if (especie === 'luminassauro' || especie === 'etherodonte') {
        for (let i = 0; i < 4; i++) {
          colocar(
            nivel,
            assets.cenario.cristal,
            p.x + rng.range(-40, 40),
            p.y + rng.range(-30, 30),
          );
        }
      }
    }
  }

  nivel.ordenarObjetos();

  // chegada da máquina do tempo: na clareira, em frente à casa
  const chegadaX = casaX + CASA_W / 2 + 6;
  const chegadaY = casaY + CASA_H + 44;
  nivel.entradaX = chegadaX;
  nivel.entradaY = chegadaY;

  return { nivel, spawns, chegadaX, chegadaY };
}

/**
 * Interior da casa: sala única mobiliada, do tamanho da tela (a câmera fica
 * praticamente parada) e com colisão em cada móvel.
 */
export function criarInterior(assets: Assets): Nivel {
  const LT = 30;
  const AT = 18;
  const nivel = new Nivel(ID_CASA, 'Dentro de casa', LT, AT, 'interior', Tile.ParedeInterna);
  const rng = new Rng(777);

  // piso da sala; tudo em volta continua parede (a tela nunca mostra vazio)
  const x0 = 2;
  const x1 = 27;
  const y0 = 3;
  const y1 = 16;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      nivel.definirTile(tx, ty, Tile.PisoMadeira, rng.int(0, 2));
    }
  }

  // porta: duas colunas na parede de baixo
  const portaTX = 14;
  nivel.portais.push({
    area: {
      x: portaTX * TAM_TILE,
      y: y1 * TAM_TILE,
      w: TAM_TILE * 2,
      h: TAM_TILE,
    },
    destino: ID_MUNDO,
    entradaX: 0,
    entradaY: 0,
    rotulo: 'Sair',
  });
  nivel.entradaX = (portaTX + 1) * TAM_TILE;
  nivel.entradaY = y1 * TAM_TILE + 10;

  const c = assets.casa;
  // ---- tapete primeiro (fica embaixo de tudo)
  colocar(nivel, c.tapete, 240, 226, { ajusteBase: -58 });

  // ---- parede do fundo: estante, janela, prateleira, troféu e lareira
  colocar(nivel, c.estante, 92, 66, { colisao: { w: 40, h: 8 } });
  colocar(nivel, c.janela, 162, 58);
  colocar(nivel, c.prateleiraParede, 218, 54);
  colocar(nivel, assets.cenario.caveira, 262, 52);
  colocar(nivel, c.lareira, 332, 70, { colisao: { w: 36, h: 10 } });
  nivel.fogos.push({ x: 332, y: 61 });
  nivel.luzes.push({ x: 332, y: 58 });
  colocar(nivel, c.quadro, 400, 58);

  // ---- lado esquerdo: cama, armário e uma caixa de mantimentos
  colocar(nivel, c.cama, 58, 152, { colisao: { w: 24, h: 22 } });
  colocar(nivel, c.armario, 58, 202, { colisao: { w: 26, h: 10 } });
  colocar(nivel, c.caixa, 52, 236, { colisao: { w: 22, h: 7 } });
  colocar(nivel, c.vaso, 118, 246);

  // ---- centro: mesa, duas cadeiras e o lampião aceso
  colocar(nivel, c.mesa, 240, 210, { colisao: { w: 44, h: 12 } });
  colocar(nivel, c.cadeira, 204, 214, { colisao: { w: 12, h: 6 } });
  colocar(nivel, c.cadeira, 276, 214, { colisao: { w: 12, h: 6 } });
  colocar(nivel, c.lampiao, 240, 194, { ajusteBase: 20 });
  nivel.luzes.push({ x: 240, y: 188 });

  // ---- lado direito: baú, banco, barril e planta
  colocar(nivel, c.bau, 408, 132, { colisao: { w: 24, h: 9 } });
  colocar(nivel, c.banco, 406, 184, { colisao: { w: 28, h: 8 } });
  colocar(nivel, c.barril, 416, 238, { colisao: { w: 15, h: 7 } });
  colocar(nivel, c.vaso, 356, 248);

  nivel.ordenarObjetos();
  return nivel;
}
