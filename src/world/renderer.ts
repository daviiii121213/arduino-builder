/**
 * Desenho do mundo: camada de terreno + objetos ordenados por profundidade.
 * Só o que aparece na tela é desenhado.
 */

import { TAM_TILE, QUADROS_AGUA } from '../gfx/sprites/terrain';
import { LARGURA, ALTURA } from '../core/screen';
import { Tile } from './tiles';
import type { Nivel, ObjetoCenario } from './level';
import type { Assets } from '../gfx/assets';
import type { Sprite } from '../gfx/pixel';

function texturaDe(assets: Assets, t: Tile, variacao: number, quadroAgua: number): Sprite {
  const tex = assets.terreno;
  const esc = (arr: Sprite[]) => arr[variacao % arr.length];
  switch (t) {
    case Tile.Grama:
      return esc(tex.grama);
    case Tile.GramaFlorida:
      return esc(tex.gramaFlorida);
    case Tile.GramaSeca:
      return esc(tex.gramaSeca);
    case Tile.Terra:
      return esc(tex.terra);
    case Tile.Areia:
      return esc(tex.areia);
    case Tile.Rocha:
      return esc(tex.rocha);
    case Tile.Lama:
      return esc(tex.lama);
    case Tile.AguaRasa: {
      const v = tex.aguaRasa[variacao % tex.aguaRasa.length];
      return v[quadroAgua % v.length];
    }
    case Tile.AguaFunda: {
      const v = tex.aguaFunda[variacao % tex.aguaFunda.length];
      return v[quadroAgua % v.length];
    }
    case Tile.PisoMadeira:
      return esc(tex.pisoMadeira);
    case Tile.ParedeInterna:
      return esc(tex.paredeInterna);
    case Tile.Tapete:
      return esc(tex.tapete);
    case Tile.Concreto:
      return esc(tex.concreto);
    case Tile.TerraArada:
      return esc(tex.terraArada);
    default:
      return esc(tex.rocha);
  }
}

export function desenharTerreno(
  g: CanvasRenderingContext2D,
  nivel: Nivel,
  assets: Assets,
  camX: number,
  camY: number,
  tempo: number,
): void {
  const quadroAgua = Math.floor(tempo * 5) % QUADROS_AGUA;
  const tx0 = Math.max(0, Math.floor(camX / TAM_TILE));
  const ty0 = Math.max(0, Math.floor(camY / TAM_TILE));
  const tx1 = Math.min(nivel.larguraTiles - 1, Math.floor((camX + LARGURA) / TAM_TILE));
  const ty1 = Math.min(nivel.alturaTiles - 1, Math.floor((camY + ALTURA) / TAM_TILE));

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const t = nivel.tile(tx, ty);
      const px = tx * TAM_TILE - camX;
      const py = ty * TAM_TILE - camY;
      if (t === Tile.Vazio && nivel.ambiente !== 'exterior') {
        // dentro de um prédio, o que está fora do quarto é só escuridão
        g.fillStyle = '#0c0a14';
        g.fillRect(px, py, TAM_TILE, TAM_TILE);
        continue;
      }
      const s = texturaDe(assets, t, nivel.variacao(tx, ty), quadroAgua);
      g.drawImage(s, px, py);
      if (t === Tile.Vazio) {
        // paredão de rocha que fecha o vale
        g.fillStyle = 'rgba(18,16,28,0.5)';
        g.fillRect(px, py, TAM_TILE, TAM_TILE);
      }
    }
  }

  // espuma discreta apenas na margem, acompanhando a maré
  g.fillStyle = 'rgba(168,221,232,0.7)';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (nivel.tile(tx, ty) !== Tile.AguaRasa) continue;
      const px = tx * TAM_TILE - camX;
      const py = ty * TAM_TILE - camY;
      const mare = Math.sin(tempo * 2 + tx * 0.9 + ty * 0.5) > 0 ? 1 : 0;
      const seco = (dx: number, dy: number) => {
        const v = nivel.tile(tx + dx, ty + dy);
        return v !== Tile.AguaRasa && v !== Tile.AguaFunda;
      };
      if (seco(0, -1)) g.fillRect(px + 2, py + mare, TAM_TILE - 4, 1);
      if (seco(0, 1)) g.fillRect(px + 2, py + TAM_TILE - 1 - mare, TAM_TILE - 4, 1);
      if (seco(-1, 0)) g.fillRect(px + mare, py + 2, 1, TAM_TILE - 4);
      if (seco(1, 0)) g.fillRect(px + TAM_TILE - 1 - mare, py + 2, 1, TAM_TILE - 4);
    }
  }
}

/** Objetos visíveis na tela (com folga para sprites altos). */
export function objetosVisiveis(
  nivel: Nivel,
  camX: number,
  camY: number,
): ObjetoCenario[] {
  const margem = 64;
  const saida: ObjetoCenario[] = [];
  for (const o of nivel.objetos) {
    if (
      o.x + o.sprite.width < camX - margem ||
      o.x > camX + LARGURA + margem ||
      o.y + o.sprite.height < camY - margem ||
      o.y > camY + ALTURA + margem
    )
      continue;
    saida.push(o);
  }
  return saida;
}

export function desenharObjeto(
  g: CanvasRenderingContext2D,
  o: ObjetoCenario,
  camX: number,
  camY: number,
  tempo: number,
): void {
  let dx = 0;
  if (o.balanca) {
    dx = Math.sin(tempo * 1.6 + o.x * 0.08 + o.y * 0.05) > 0.7 ? 1 : 0;
  }
  if (o.sombra) {
    g.globalAlpha = 0.4;
    g.drawImage(
      o.sombra,
      Math.round(o.x + o.sprite.width / 2 - o.sombra.width / 2 - camX),
      Math.round(o.base - o.sombra.height / 2 - camY),
    );
    g.globalAlpha = 1;
  }
  g.drawImage(o.sprite, Math.round(o.x - camX + dx), Math.round(o.y - camY));
}
