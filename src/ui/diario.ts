/**
 * O diário do avô (tecla J).
 *
 * Mostra as missões abertas com a barrinha de progresso, o que já foi feito e
 * as anotações dos biomas visitados. É onde as missões chegam: cada página
 * nova acende um aviso no HUD até o jogador abrir o caderno.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto, quebrarTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Entrada } from '../core/input';
import type { Diario } from '../systems/missions';
import { descreverObjetivo } from '../systems/missions';
import type { Progresso } from '../systems/progression';
import { BIOMAS, ORDEM_BIOMAS } from '../world/biomes';
import { cabecalho, moldura, rodape, saldo } from './painel';
import type { Carteira } from '../systems/economy';
import { clamp } from '../core/math';

const LARG = 300;
const ALT = 222;

export class PainelDiario {
  aberta = false;
  private indice = 0;

  constructor(
    private diario: Diario,
    private progresso: Progresso,
    private carteira: Carteira,
    private assets: Assets,
  ) {}

  abrir(): void {
    this.aberta = true;
    this.indice = 0;
    this.diario.ler();
  }

  fechar(): void {
    this.aberta = false;
  }

  private get x(): number {
    return Math.round((LARGURA - LARG) / 2);
  }

  private get y(): number {
    return Math.round((ALTURA - ALT) / 2);
  }

  atualizar(_dt: number, entrada: Entrada): void {
    if (!this.aberta) return;
    if (entrada.teclaAgora('KeyJ', 'Escape', 'Tab')) {
      this.fechar();
      return;
    }
    const total = Math.max(1, this.diario.ativas.length);
    if (entrada.teclaAgora('KeyS', 'ArrowDown')) this.indice = (this.indice + 1) % total;
    if (entrada.teclaAgora('KeyW', 'ArrowUp')) this.indice = (this.indice - 1 + total) % total;
  }

  desenhar(g: CanvasRenderingContext2D): void {
    if (!this.aberta) return;
    g.globalAlpha = 0.68;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;

    const x = this.x;
    const y = this.y;
    g.drawImage(moldura(LARG, ALT), x, y);
    cabecalho(g, 'DIÁRIO DO AVÔ', x, y, LARG);
    saldo(g, this.assets, this.carteira.moedas, x + LARG - 10, y + 9, 'direita', this.carteira.infinita);

    const ativas = this.diario.ativas;
    let cy = y + 26;

    if (ativas.length === 0) {
      texto(g, 'Nenhuma página aberta agora.', x + 12, cy + 4, {
        cor: '#7a7391',
        sombra: P.contorno,
      });
      texto(g, 'Volte depois: o caderno continua sozinho.', x + 12, cy + 14, {
        cor: '#5b5470',
        sombra: P.contorno,
      });
      cy += 34;
    } else {
      ativas.forEach((m, i) => {
        const sel = i === this.indice;
        const alturaBloco = 45;
        if (sel) {
          g.fillStyle = 'rgba(255,199,90,0.12)';
          g.fillRect(x + 8, cy - 2, LARG - 16, alturaBloco);
          g.fillStyle = P.ambar;
          g.fillRect(x + 8, cy - 2, 1, alturaBloco);
        }
        texto(g, m.titulo, x + 14, cy + 1, { cor: P.osso, sombra: P.contorno });
        texto(g, `+${m.recompensa}`, x + LARG - 14, cy + 1, {
          cor: P.ambar,
          sombra: P.contorno,
          alinhamento: 'direita',
        });
        const frase = quebrarTexto(m.texto, LARG - 30);
        texto(g, frase[0] ?? '', x + 14, cy + 11, { cor: '#8b83a3', sombra: P.contorno });
        texto(g, frase[1] ?? '', x + 14, cy + 20, { cor: '#8b83a3', sombra: P.contorno });

        // barra de progresso do objetivo
        const feito = this.diario.progresso(m);
        const prop = clamp(feito / m.objetivo.quantidade, 0, 1);
        const bx = x + 14;
        const by = cy + 33;
        const bw = 120;
        g.fillStyle = P.contorno;
        g.fillRect(bx, by, bw, 5);
        g.fillStyle = '#3a2b33';
        g.fillRect(bx + 1, by + 1, bw - 2, 3);
        g.fillStyle = prop >= 1 ? P.folhaClara : P.ambar;
        g.fillRect(bx + 1, by + 1, Math.round((bw - 2) * prop), 3);
        texto(g, descreverObjetivo(m, feito), bx + bw + 6, by - 1, {
          cor: '#a89fbe',
          sombra: P.contorno,
        });
        cy += alturaBloco;
      });
    }

    // ---- rodapé: o que já foi feito e os biomas conhecidos
    g.fillStyle = '#3a2f49';
    g.fillRect(x + 8, cy, LARG - 16, 1);
    cy += 5;
    texto(
      g,
      `Concluídas: ${this.diario.concluidas.size}   ·   ${this.diario.historico[0] ?? 'nada ainda'}`,
      x + 12,
      cy,
      { cor: '#a89fbe', sombra: P.contorno },
    );
    cy += 11;
    texto(g, 'Regiões conhecidas:', x + 12, cy, { cor: '#7a7391', sombra: P.contorno });
    cy += 10;
    let bx = x + 12;
    for (const id of ORDEM_BIOMAS) {
      const f = BIOMAS[id];
      const visto = this.progresso.biomasVisitados.has(id);
      g.fillStyle = visto ? f.cor : '#2a2338';
      g.fillRect(bx, cy + 1, 4, 5);
      texto(g, visto ? f.nome : '? ? ?', bx + 7, cy, {
        cor: visto ? P.osso : '#5b5470',
        sombra: P.contorno,
      });
      cy += 9;
    }

    rodape(g, 'W/S escolhe · J ou ESC fecha', x, y, LARG, ALT);
  }
}
