/**
 * Baú de casa: guarda e devolve itens.
 *
 * Duas grades — o baú em cima, o inventário embaixo. Os espaços trancados do
 * inventário aparecem com um cadeado até serem liberados na cabana.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Entrada } from '../core/input';
import type { Inventario, Recipiente } from '../systems/items';
import type { Progresso } from '../systems/progression';
import { iconeDoItem, nomeDoItem } from './itens';
import { cabecalho, moldura, rodape } from './painel';
import { pointInRect } from '../core/math';

const LARG = 390;
const ALT = 172;
const SLOT = 21;

export class PainelBau {
  aberta = false;
  /** 'bau' ou 'inventario' — grade com o foco. */
  private grade: 'bau' | 'inventario' = 'bau';
  private indice = 0;
  private aviso = '';
  private tempoAviso = 0;

  constructor(
    private bau: Recipiente,
    private inventario: Inventario,
    private progresso: Progresso,
    private assets: Assets,
    private aoMover: () => void,
  ) {}

  abrir(): void {
    this.aberta = true;
    this.grade = 'bau';
    this.indice = 0;
    this.aviso = '';
    this.tempoAviso = 0;
    this.tempoAviso = 0;
  }

  fechar(): void {
    this.aberta = false;
  }

  private get colunas(): number {
    return 12;
  }

  private mostrar(txt: string): void {
    this.aviso = txt;
    this.tempoAviso = 2.4;
  }

  /** Move o item do espaço selecionado para o outro recipiente. */
  private mover(): void {
    const origem: Recipiente = this.grade === 'bau' ? this.bau : this.inventario;
    const destino: Recipiente = this.grade === 'bau' ? this.inventario : this.bau;
    const item = origem.slots[this.indice];
    if (!item) return;
    const sobrou = destino.guardar({ ...item });
    const movido = item.quantidade - sobrou;
    if (movido <= 0) {
      this.mostrar(this.grade === 'bau' ? 'O inventário está cheio.' : 'O baú está cheio.');
      return;
    }
    item.quantidade = sobrou;
    if (item.quantidade <= 0) origem.slots[this.indice] = null;
    this.mostrar(
      `${movido}x ${nomeDoItem(this.progresso, item)} ${this.grade === 'bau' ? 'para a bolsa' : 'para o baú'}`,
    );
    this.aoMover();
  }

  private guardarTudo(): void {
    let total = 0;
    for (let i = 0; i < this.inventario.liberados; i++) {
      const item = this.inventario.slots[i];
      // ferramentas ficam com o jogador
      if (!item || item.tipo === 'ferramenta') continue;
      const sobrou = this.bau.guardar({ ...item });
      total += item.quantidade - sobrou;
      item.quantidade = sobrou;
      if (item.quantidade <= 0) this.inventario.slots[i] = null;
    }
    this.mostrar(total > 0 ? `${total} itens guardados no baú.` : 'Nada para guardar.');
    if (total > 0) this.aoMover();
  }

  atualizar(dt: number, entrada: Entrada): void {
    if (!this.aberta) return;
    if (this.tempoAviso > 0) this.tempoAviso -= dt;
    if (entrada.teclaAgora('Escape', 'KeyE')) {
      this.fechar();
      return;
    }

    const cols = this.colunas;
    const totalAtual = this.grade === 'bau' ? this.bau.total : this.inventario.total;
    if (entrada.teclaAgora('KeyD', 'ArrowRight')) this.indice = (this.indice + 1) % totalAtual;
    if (entrada.teclaAgora('KeyA', 'ArrowLeft'))
      this.indice = (this.indice - 1 + totalAtual) % totalAtual;
    if (entrada.teclaAgora('KeyS', 'ArrowDown', 'KeyW', 'ArrowUp', 'Tab')) {
      // troca de grade mantendo a coluna
      const coluna = this.indice % cols;
      this.grade = this.grade === 'bau' ? 'inventario' : 'bau';
      const novoTotal = this.grade === 'bau' ? this.bau.total : this.inventario.total;
      this.indice = Math.min(novoTotal - 1, coluna);
    }

    // mouse
    const geo = this.geometria();
    for (const [grade, area] of geo) {
      for (let i = 0; i < area.length; i++) {
        if (!pointInRect(entrada.mouseX, entrada.mouseY, area[i])) continue;
        this.grade = grade;
        this.indice = i;
        if (entrada.botaoAgora(0)) this.mover();
      }
    }

    if (entrada.teclaAgora('Enter', 'NumpadEnter', 'Space')) this.mover();
    if (entrada.teclaAgora('KeyG')) this.guardarTudo();
  }

  /** Retângulos de cada espaço das duas grades. */
  private geometria(): [('bau' | 'inventario'), { x: number; y: number; w: number; h: number }[]][] {
    const x = Math.round((LARGURA - LARG) / 2);
    const y = Math.round((ALTURA - ALT) / 2);
    const cols = this.colunas;
    const gradeX = x + 12;
    const bauY = y + 34;
    const filasBau = Math.ceil(this.bau.total / cols);
    const invY = bauY + filasBau * SLOT + 22;
    const rects = (total: number, y0: number) =>
      Array.from({ length: total }, (_, i) => ({
        x: gradeX + (i % cols) * SLOT,
        y: y0 + Math.floor(i / cols) * SLOT,
        w: SLOT - 1,
        h: SLOT - 1,
      }));
    return [
      ['bau', rects(this.bau.total, bauY)],
      ['inventario', rects(this.inventario.total, invY)],
    ];
  }

  desenhar(g: CanvasRenderingContext2D): void {
    if (!this.aberta) return;
    g.globalAlpha = 0.78;
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, LARGURA, ALTURA);
    g.globalAlpha = 1;

    const x = Math.round((LARGURA - LARG) / 2);
    const y = Math.round((ALTURA - ALT) / 2);
    g.drawImage(moldura(LARG, ALT), x, y);
    cabecalho(g, 'BAÚ DE CASA', x, y, LARG);

    const geo = this.geometria();
    const rotulos: Record<'bau' | 'inventario', string> = {
      bau: `Baú (${this.bau.total} espaços)`,
      inventario: `Bolsa (${this.inventario.liberados} de ${this.inventario.total})`,
    };

    for (const [grade, rects] of geo) {
      if (rects.length === 0) continue;
      texto(g, rotulos[grade], rects[0].x, rects[0].y - 9, {
        cor: this.grade === grade ? P.ambar : '#8b83a3',
        sombra: P.contorno,
      });
      const recipiente = grade === 'bau' ? this.bau : this.inventario;
      rects.forEach((r, i) => {
        const trancado = i >= recipiente.liberados;
        const selecionado = this.grade === grade && this.indice === i;
        g.drawImage(
          selecionado ? this.assets.ui.slotSelecionado : this.assets.ui.slot,
          r.x,
          r.y,
        );
        if (selecionado) {
          // moldura extra: deixa claro qual espaço está em foco
          g.fillStyle = P.brilho;
          g.fillRect(r.x - 1, r.y - 1, r.w + 2, 1);
          g.fillRect(r.x - 1, r.y + r.h, r.w + 2, 1);
          g.fillRect(r.x - 1, r.y - 1, 1, r.h + 2);
          g.fillRect(r.x + r.w, r.y - 1, 1, r.h + 2);
        }
        if (trancado) {
          g.globalAlpha = 0.72;
          g.fillStyle = '#12101c';
          g.fillRect(r.x + 2, r.y + 2, 16, 16);
          g.globalAlpha = 1;
          // cadeado desenhado na hora: dois pixels de arco e um corpo
          g.fillStyle = P.ossoEscuro;
          g.fillRect(r.x + 8, r.y + 6, 4, 2);
          g.fillRect(r.x + 7, r.y + 8, 6, 5);
          g.fillStyle = P.contorno;
          g.fillRect(r.x + 9, r.y + 10, 2, 2);
          return;
        }
        const item = recipiente.slots[i];
        if (!item) return;
        const icone = iconeDoItem(this.assets, this.progresso, item);
        g.drawImage(
          icone,
          r.x + 10 - (icone.width >> 1),
          r.y + 10 - (icone.height >> 1),
        );
        if (item.quantidade > 1) {
          texto(g, String(item.quantidade), r.x + 18, r.y + 11, {
            cor: P.osso,
            sombra: P.contorno,
            contorno: true,
            alinhamento: 'direita',
          });
        }
      });
    }

    // nome do item em foco / aviso
    const infoY = y + ALT - 30;
    const foco =
      this.grade === 'bau' ? this.bau.slots[this.indice] : this.inventario.slots[this.indice];
    if (this.tempoAviso > 0) {
      texto(g, this.aviso, x + 12, infoY, { cor: P.folhaClara, sombra: P.contorno });
    } else if (foco) {
      texto(g, nomeDoItem(this.progresso, foco), x + 12, infoY, {
        cor: P.osso,
        sombra: P.contorno,
      });
    } else {
      texto(g, 'Espaço vazio', x + 12, infoY, { cor: '#7a7391', sombra: P.contorno });
    }

    rodape(g, 'A/D e W/S movem · ENTER move o item · G guarda tudo · ESC sai', x, y, LARG, ALT);
  }
}
