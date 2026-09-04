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
import { Tile } from './tiles';
import { colocar } from './props';
import type { Assets } from '../gfx/assets';
import type { EspecieId } from '../gfx/sprites/dinos';
import { CASA_W, CASA_H, CASA_COLISAO, CASA_PORTA } from '../gfx/sprites/house';
import { CABANA_W, CABANA_H, CABANA_COLISAO, CABANA_PORTA } from '../gfx/sprites/cabin';
import { dist } from '../core/math';
import { NoRecurso } from '../systems/harvest';
import { definicoesDeNo, type NomeNo } from './nodes';

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
