/**
 * Geração dos andares das cavernas.
 *
 * Cada andar é montado com as mesmas peças — paredes, corredores, salas,
 * pilares, formações e escadas — para que as duas cavernas pareçam o mesmo
 * mundo. O que muda de andar para andar é o traçado, a densidade dos
 * obstáculos, a mistura de minérios e a população de criaturas, tudo lido da
 * ficha em `caveDefs.ts`. Nenhum andar é cópia de outro: a semente é derivada
 * da caverna e do número do andar.
 */

import { Rng } from '../core/rng';
import { TAM_TILE } from '../gfx/sprites/terrain';
import { Nivel } from './level';
import { Tile } from './tiles';
import { colocar } from './props';
import { NoRecurso } from '../systems/harvest';
import { definicoesDeNo, type NomeNo } from './nodes';
import type { Assets } from '../gfx/assets';
import type { EspecieId } from '../gfx/sprites/dinos';
import {
  ANDARES,
  CAVERNAS,
  idDoAndar,
  populacaoDoAndar,
  riquezaDoAndar,
  type CavernaId,
  type FichaCaverna,
  type PesoEspecie,
  type PesoNo,
  type Tracado,
} from './caveDefs';

export interface NascimentoCaverna {
  especie: EspecieId;
  x: number;
  y: number;
}

export interface AndarGerado {
  nivel: Nivel;
  caverna: CavernaId;
  andar: number;
  nascimentos: NascimentoCaverna[];
  /** Onde o jogador aparece ao descer do andar de cima. */
  chegadaDeCima: { x: number; y: number };
  /** Onde o jogador aparece ao subir do andar de baixo (ou sair do guincho). */
  chegadaDeBaixo: { x: number; y: number };
  /** Posição do chefe, só no décimo andar. */
  chefe?: { x: number; y: number };
  /** Onde o baú de recompensa aparece depois que o chefe cai. */
  tesouro?: { x: number; y: number };
}

/** Retângulo de sala, em tiles. */
interface Sala {
  x: number;
  y: number;
  w: number;
  h: number;
}

const centro = (s: Sala) => ({ x: Math.floor(s.x + s.w / 2), y: Math.floor(s.y + s.h / 2) });

/** Tamanho do andar: fica maior e mais labiríntico conforme desce. */
function tamanhoDoAndar(andar: number, tracado: Tracado): { larg: number; alt: number } {
  if (tracado === 'salao') return { larg: 42, alt: 32 };
  const passo = Math.floor((andar - 1) / 3);
  return { larg: 46 + passo * 8, alt: 34 + passo * 6 };
}

/** Sorteio por peso. */
function sortear<T extends { peso: number }>(rng: Rng, tabela: T[]): T {
  let soma = 0;
  for (const t of tabela) soma += t.peso;
  let alvo = rng.range(0, soma);
  for (const t of tabela) {
    alvo -= t.peso;
    if (alvo <= 0) return t;
  }
  return tabela[tabela.length - 1];
}

export function gerarAndar(assets: Assets, caverna: CavernaId, andar: number): AndarGerado {
  const ficha = CAVERNAS[caverna];
  const tracado = ficha.tracado(andar);
  const { larg, alt } = tamanhoDoAndar(andar, tracado);
  const rng = new Rng(ficha.semente + andar * 7919);

  const piso = caverna === 'gruta' ? Tile.PisoGruta : Tile.PisoMina;
  const parede = caverna === 'gruta' ? Tile.ParedeGruta : Tile.ParedeMina;
  const perigo = caverna === 'gruta' ? Tile.PocaCaverna : Tile.Lava;

  const nivel = new Nivel(
    idDoAndar(caverna, andar),
    ficha.nomeAndar(andar),
    larg,
    alt,
    'caverna',
    parede,
  );
  for (let i = 0; i < nivel.tiles.length; i++) nivel.variacoes[i] = rng.int(0, 3);

  // ------------------------------------------------------------- escavação
  const cavarRet = (s: Sala): void => {
    for (let ty = s.y; ty < s.y + s.h; ty++) {
      for (let tx = s.x; tx < s.x + s.w; tx++) {
        if (tx < 2 || ty < 2 || tx >= larg - 2 || ty >= alt - 2) continue;
        nivel.definirTile(tx, ty, piso, rng.int(0, 3));
      }
    }
  };
  const cavarDisco = (cx: number, cy: number, raio: number): void => {
    for (let ty = cy - raio; ty <= cy + raio; ty++) {
      for (let tx = cx - raio; tx <= cx + raio; tx++) {
        if (tx < 2 || ty < 2 || tx >= larg - 2 || ty >= alt - 2) continue;
        if (Math.hypot(tx - cx, ty - cy) > raio + rng.range(-0.6, 0.6)) continue;
        nivel.definirTile(tx, ty, piso, rng.int(0, 3));
      }
    }
  };
  /** Corredor em L, com a largura pedida. */
  const corredor = (a: { x: number; y: number }, b: { x: number; y: number }, larguraC: number) => {
    const meia = Math.max(0, larguraC - 1);
    const faixaH = (x0: number, x1: number, y: number) => {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let d = -meia; d <= meia; d++) cavarRet({ x, y: y + d, w: 1, h: 1 });
    };
    const faixaV = (y0: number, y1: number, x: number) => {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let d = -meia; d <= meia; d++) cavarRet({ x: x + d, y, w: 1, h: 1 });
    };
    if (rng.chance(0.5)) {
      faixaH(a.x, b.x, a.y);
      faixaV(a.y, b.y, b.x);
    } else {
      faixaV(a.y, b.y, a.x);
      faixaH(a.x, b.x, b.y);
    }
  };

  const salas: Sala[] = [];

  // ------------------------------------------------------------- traçados
  // Corredores mais estreitos e salas mais quebradas conforme desce: o andar
  // fica difícil pelo desenho, não por inflar a vida dos bichos.
  const larguraCorredor = andar >= 7 ? 1 : andar >= 4 ? 1 : 2;

  if (tracado === 'salao') {
    // arena do chefe: um salão redondo com uma antessala e um corredor curto
    const cx = Math.floor(larg / 2);
    const cy = Math.floor(alt / 2) + 2;
    cavarDisco(cx, cy, Math.floor(Math.min(larg, alt) / 2) - 5);
    salas.push({ x: cx - 12, y: cy - 9, w: 24, h: 18 });
    const ante: Sala = { x: cx - 4, y: 3, w: 8, h: 5 };
    cavarRet(ante);
    corredor(centro(ante), { x: cx, y: cy - 8 }, 2);
    salas.unshift(ante);
  } else if (tracado === 'galerias') {
    const cols = 3;
    const linhas = Math.max(2, Math.floor(alt / 14));
    for (let l = 0; l < linhas; l++) {
      for (let c = 0; c < cols; c++) {
        const px = 3 + Math.floor((c * (larg - 6)) / cols);
        const py = 3 + Math.floor((l * (alt - 6)) / linhas);
        const w = rng.int(7, Math.floor((larg - 6) / cols) - 2);
        const h = rng.int(5, Math.floor((alt - 6) / linhas) - 2);
        const s: Sala = { x: px + rng.int(0, 2), y: py + rng.int(0, 2), w, h };
        cavarRet(s);
        salas.push(s);
      }
    }
    for (let i = 1; i < salas.length; i++) {
      corredor(centro(salas[i - 1]), centro(salas[i]), larguraCorredor);
      if (rng.chance(0.35) && i >= 3) {
        corredor(centro(salas[i]), centro(salas[i - 3]), larguraCorredor);
      }
    }
  } else if (tracado === 'cavernoso') {
    // caminhada aleatória: galerias tortas, como água escavou
    let x = Math.floor(larg / 2);
    let y = 4;
    const quantos = 6 + andar;
    for (let i = 0; i < quantos; i++) {
      const raio = rng.int(3, 6);
      cavarDisco(x, y, raio);
      salas.push({ x: x - raio, y: y - raio, w: raio * 2, h: raio * 2 });
      const passos = rng.int(6, 12);
      for (let p = 0; p < passos; p++) {
        x += rng.int(-2, 2);
        y += rng.int(-1, 2);
        x = Math.max(5, Math.min(larg - 6, x));
        y = Math.max(4, Math.min(alt - 5, y));
        cavarDisco(x, y, larguraCorredor);
      }
    }
  } else if (tracado === 'fenda') {
    // uma fenda comprida no meio, com câmaras penduradas nos dois lados
    const yMeio = Math.floor(alt / 2);
    for (let x = 4; x < larg - 4; x++) {
      const desvio = Math.round(Math.sin(x * 0.22) * 3);
      cavarDisco(x, yMeio + desvio, 2);
    }
    const quantas = 4 + Math.floor(andar / 2);
    for (let i = 0; i < quantas; i++) {
      const x = 6 + Math.floor(((larg - 12) * i) / quantas) + rng.int(-2, 2);
      const acima = rng.chance(0.5);
      const y = acima ? yMeio - rng.int(6, 10) : yMeio + rng.int(6, 10);
      const s: Sala = { x: x - 4, y: y - 3, w: rng.int(7, 10), h: rng.int(5, 7) };
      cavarRet(s);
      salas.push(s);
      corredor(centro(s), { x, y: yMeio }, larguraCorredor);
    }
    salas.unshift({ x: 4, y: yMeio - 2, w: 6, h: 5 });
    salas.push({ x: larg - 10, y: yMeio - 2, w: 6, h: 5 });
    cavarRet(salas[0]);
    cavarRet(salas[salas.length - 1]);
  } else {
    // labirinto: muitas salinhas ligadas por corredores estreitos
    const quantas = 8 + andar;
    for (let i = 0; i < quantas; i++) {
      const s: Sala = {
        x: rng.int(3, larg - 12),
        y: rng.int(3, alt - 10),
        w: rng.int(5, 8),
        h: rng.int(4, 6),
      };
      cavarRet(s);
      salas.push(s);
    }
    for (let i = 1; i < salas.length; i++) corredor(centro(salas[i - 1]), centro(salas[i]), 1);
  }

  // --------------------------------------------------- obstáculos do andar
  // Poças (gruta) ou línguas de lava (mina): mais e maiores conforme desce.
  if (tracado !== 'salao') {
    const quantos = Math.floor(andar * 1.2);
    for (let i = 0; i < quantos; i++) {
      const s = rng.pick(salas);
      const c = centro(s);
      const raio = rng.int(1, 2 + Math.floor(andar / 4));
      for (let ty = c.y - raio; ty <= c.y + raio; ty++) {
        for (let tx = c.x - raio; tx <= c.x + raio; tx++) {
          if (nivel.tile(tx, ty) !== piso) continue;
          if (Math.hypot(tx - c.x, ty - c.y) > raio) continue;
          nivel.definirTile(tx, ty, perigo, rng.int(0, 1));
        }
      }
    }
  }

  // ---------------------------------------------------- escadas e guincho
  const ordenadas = [...salas].sort((a, b) => centro(a).y - centro(b).y);
  const salaEntrada = ordenadas[0];
  const salaSaida = ordenadas[ordenadas.length - 1];
  const pEntrada = centro(salaEntrada);
  const pSaida = centro(salaSaida);

  /** Garante chão firme em volta de um ponto (escada, guincho, chefe). */
  const limpar = (cx: number, cy: number, raio: number) => {
    for (let ty = cy - raio; ty <= cy + raio; ty++)
      for (let tx = cx - raio; tx <= cx + raio; tx++) nivel.definirTile(tx, ty, piso, rng.int(0, 3));
  };
  limpar(pEntrada.x, pEntrada.y, 3);
  limpar(pSaida.x, pSaida.y, 3);

  const px = (t: number) => t * TAM_TILE + TAM_TILE / 2;
  const py = (t: number) => t * TAM_TILE + TAM_TILE;

  // caminho de cascalho ligando a escada de cima à de baixo (leitura rápida)
  {
    let x = pEntrada.x;
    let y = pEntrada.y;
    for (let passo = 0; passo < 400 && (x !== pSaida.x || y !== pSaida.y); passo++) {
      if (nivel.tile(x, y) === piso) nivel.definirTile(x, y, Tile.Cascalho, rng.int(0, 2));
      if (x !== pSaida.x && (y === pSaida.y || rng.chance(0.5))) x += Math.sign(pSaida.x - x);
      else y += Math.sign(pSaida.y - y);
    }
  }

  const c = assets.caverna;
  // escada de subida (volta ao andar de cima ou à superfície)
  colocar(nivel, c.escadaCima, px(pEntrada.x), py(pEntrada.y), { ajusteBase: -8 });
  nivel.interativos.push({
    area: { x: px(pEntrada.x) - 14, y: py(pEntrada.y) - 20, w: 28, h: 24 },
    rotulo: andar === 1 ? 'Voltar para o vale' : `Subir para o andar ${andar - 1}`,
    acao: 'subir',
  });

  // guincho: volta direto para a superfície de qualquer andar
  const gx = pEntrada.x + 3;
  limpar(gx, pEntrada.y, 1);
  colocar(nivel, c.elevador, px(gx), py(pEntrada.y), { ajusteBase: -6 });
  nivel.luzes.push({ x: px(gx), y: py(pEntrada.y) - 26 });
  nivel.interativos.push({
    area: { x: px(gx) - 12, y: py(pEntrada.y) - 18, w: 24, h: 22 },
    rotulo: 'Guincho: subir para o vale',
    acao: 'guincho',
  });

  const resultado: AndarGerado = {
    nivel,
    caverna,
    andar,
    nascimentos: [],
    chegadaDeCima: { x: px(pEntrada.x), y: py(pEntrada.y) + 10 },
    chegadaDeBaixo: { x: px(pSaida.x), y: py(pSaida.y) + 10 },
  };

  if (andar < ANDARES) {
    colocar(nivel, c.escadaBaixo, px(pSaida.x), py(pSaida.y), { ajusteBase: -8 });
    nivel.interativos.push({
      area: { x: px(pSaida.x) - 14, y: py(pSaida.y) - 20, w: 28, h: 24 },
      rotulo: `Descer para o andar ${andar + 1}`,
      acao: 'descer',
    });
  } else {
    // décimo andar: o fundo da sala é a arena do chefe
    const arena = centro(salas[salas.length - 1]);
    limpar(arena.x, arena.y, 6);
    resultado.chefe = { x: px(arena.x), y: py(arena.y) };
    resultado.tesouro = { x: px(arena.x), y: py(arena.y) + 26 };
    resultado.chegadaDeBaixo = { x: px(pEntrada.x), y: py(pEntrada.y) + 10 };
    // tochas marcando o círculo da arena
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const tx = arena.x + Math.round(Math.cos(a) * 8);
      const ty = arena.y + Math.round(Math.sin(a) * 6);
      if (nivel.tile(tx, ty) !== piso) continue;
      colocar(nivel, c.tocha[0], px(tx), py(ty));
      nivel.luzes.push({ x: px(tx), y: py(ty) - 10 });
      nivel.fogos.push({ x: px(tx), y: py(ty) - 14 });
    }
  }

  // ------------------------------------------------------------ decoração
  const livre = (tx: number, ty: number) => nivel.tile(tx, ty) === piso;
  const longeDasEscadas = (tx: number, ty: number) =>
    Math.hypot(tx - pEntrada.x, ty - pEntrada.y) > 4 &&
    Math.hypot(tx - pSaida.x, ty - pSaida.y) > 4;

  const decoracoes: { sprite: typeof c.pilar; chance: number; colisao?: { w: number; h: number } }[] =
    [
      { sprite: c.pilar, chance: 0.1, colisao: { w: 10, h: 6 } },
      { sprite: c.estalagmite, chance: 0.16 },
      { sprite: c.estalagmiteG, chance: 0.1, colisao: { w: 8, h: 4 } },
      { sprite: c.pedregulho, chance: 0.12, colisao: { w: 12, h: 5 } },
      { sprite: c.cristais, chance: caverna === 'gruta' ? 0.18 : 0.06 },
      { sprite: c.cogumeloCaverna, chance: caverna === 'gruta' ? 0.1 : 0.04 },
      { sprite: c.ossada, chance: 0.07 },
      { sprite: c.estalactite, chance: 0.12 },
    ];

  for (let ty = 3; ty < alt - 3; ty++) {
    for (let tx = 3; tx < larg - 3; tx++) {
      if (!livre(tx, ty) || !longeDasEscadas(tx, ty)) continue;
      if (!rng.chance(0.1 + andar * 0.004)) continue;
      const d = sortear(
        rng,
        decoracoes.map((x) => ({ ...x, peso: x.chance })),
      );
      colocar(nivel, d.sprite, px(tx), py(ty), {
        colisao: d.colisao,
        sombra: d.colisao ? assets.sombras.p : undefined,
      });
    }
  }

  // tochas de parede espalhadas: são as ilhas de luz do andar
  const tochas = 5 + Math.floor(andar / 2);
  for (let i = 0; i < tochas; i++) {
    const s = rng.pick(salas);
    const tx = s.x + rng.int(0, Math.max(0, s.w - 1));
    const ty = s.y + rng.int(0, Math.max(0, s.h - 1));
    if (!livre(tx, ty)) continue;
    colocar(nivel, c.tocha[0], px(tx), py(ty));
    nivel.luzes.push({ x: px(tx), y: py(ty) - 10 });
    nivel.fogos.push({ x: px(tx), y: py(ty) - 14 });
  }

  // --------------------------------------------------------- minérios
  const defs = definicoesDeNo(assets);
  const tabelaMin: PesoNo[] = ficha.minerios(andar);
  const spriteDoNo = (nome: NomeNo) => {
    const veios = c.veios;
    switch (nome) {
      case 'rochaCaverna':
        return veios.pedra;
      case 'veioCarvao':
        return veios.carvao;
      case 'veioCobre':
        return veios.cobre;
      case 'veioPrata':
        return veios.prata;
      case 'veioOuro':
        return veios.ouro;
      case 'geodoAmetista':
        return veios.ametista;
      case 'veioRubi':
        return veios.rubi;
      case 'veioDiamante':
        return veios.diamante;
      case 'veioAstralita':
        return veios.astralita;
      case 'veioNucleo':
        return veios.nucleo;
      case 'veioObsidiana':
        return veios.obsidiana;
      default:
        return c.sitioFossil;
    }
  };

  const pontosLivres: { tx: number; ty: number }[] = [];
  for (let ty = 3; ty < alt - 3; ty++) {
    for (let tx = 3; tx < larg - 3; tx++) {
      if (livre(tx, ty) && longeDasEscadas(tx, ty)) pontosLivres.push({ tx, ty });
    }
  }

  let quantos = riquezaDoAndar(andar);
  for (let i = 0; i < quantos && pontosLivres.length > 0; i++) {
    const k = rng.int(0, pontosLivres.length - 1);
    const ponto = pontosLivres.splice(k, 1)[0];
    const escolha = sortear(rng, tabelaMin).no;
    const { objeto, colisor } = colocar(nivel, spriteDoNo(escolha), px(ponto.tx), py(ponto.ty), {
      colisao: { w: 12, h: 6 },
      sombra: assets.sombras.m,
    });
    nivel.nos.push(new NoRecurso(defs[escolha], objeto, colisor));
  }
  quantos = 0;

  // -------------------------------------------------------- criaturas
  const tabelaBicho: PesoEspecie[] = ficha.criaturas(andar);
  if (tracado !== 'salao' && tabelaBicho.length > 0) {
    const populacao = populacaoDoAndar(andar);
    for (let i = 0; i < populacao && pontosLivres.length > 0; i++) {
      const k = rng.int(0, pontosLivres.length - 1);
      const ponto = pontosLivres.splice(k, 1)[0];
      if (Math.hypot(ponto.tx - pEntrada.x, ponto.ty - pEntrada.y) < 8) continue;
      resultado.nascimentos.push({
        especie: sortear(rng, tabelaBicho).especie,
        x: px(ponto.tx),
        y: py(ponto.ty),
      });
    }
  }

  nivel.entradaX = resultado.chegadaDeCima.x;
  nivel.entradaY = resultado.chegadaDeCima.y;
  nivel.ordenarObjetos();
  return resultado;
}

/** Ficha da caverna a que um andar pertence. */
export function fichaDaCaverna(id: CavernaId): FichaCaverna {
  return CAVERNAS[id];
}
