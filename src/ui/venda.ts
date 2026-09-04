/**
 * Máquina de venda: troca recursos por moedas.
 *
 * Mostra cada recurso do inventário com a quantidade, o valor unitário e o
 * total da linha, além do que já foi ganho na máquina.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Entrada } from '../core/input';
import type { Inventario } from '../systems/items';
import type { Carteira } from '../systems/economy';
import { formatarMoedas } from '../systems/economy';
import { RECURSOS } from '../systems/resources';
import type { RecursoId } from '../gfx/sprites/tools';
import { cabecalho, destaque, linhaDoMouse, moldura, navegar, rodape, saldo } from './painel';

const LARG = 300;
const ALT = 186;
const ALTURA_LINHA = 16;

interface Linha {
  id: RecursoId;
  nome: string;
  quantidade: number;
  valor: number;
}

export class PainelVenda {
  aberta = false;
  private indice = 0;
  private linhas: Linha[] = [];
  private ganhoNaVisita = 0;
  private aviso = '';
  private tempoAviso = 0;
  /** 0..1 — animação da alavanca da máquina. */
  alavanca = 0;

  constructor(
    private inventario: Inventario,
    private carteira: Carteira,
    private assets: Assets,
    private aoVender: (moedas: number, nome: string, quantidade: number) => void,
  ) {}

  abrir(): void {
    this.aberta = true;
    this.indice = 0;
    this.ganhoNaVisita = 0;
    this.aviso = '';
    this.tempoAviso = 0;
    this.recalcular();
  }

  fechar(): void {
    this.aberta = false;
  }

  private recalcular(): void {
    this.linhas = this.inventario
      .resumo()
      .filter((i) => i.tipo === 'recurso')
      .map((i) => {
        const ficha = RECURSOS[i.id as RecursoId];
        return { id: ficha.id, nome: ficha.nome, quantidade: i.quantidade, valor: ficha.valor };
      })
      .sort((a, b) => b.valor * b.quantidade - a.valor * a.quantidade);
    if (this.indice >= this.linhas.length) this.indice = Math.max(0, this.linhas.length - 1);
  }

  private vender(linha: Linha, quantidade: number): void {
    const qtd = Math.min(quantidade, linha.quantidade);
    if (qtd <= 0) return;
    const saiu = this.inventario.retirar(linha.id, qtd);
    if (saiu <= 0) return;
    const moedas = saiu * linha.valor;
    this.carteira.ganhar(moedas);
    this.ganhoNaVisita += moedas;
    this.alavanca = 1;
    this.aviso = `${saiu}x ${linha.nome} → ${formatarMoedas(moedas)} moedas`;
    this.tempoAviso = 2.4;
    this.aoVender(moedas, linha.nome, saiu);
    this.recalcular();
  }

  private venderTudo(): void {
    const copia = [...this.linhas];
    for (const l of copia) this.vender(l, l.quantidade);
  }

  atualizar(dt: number, entrada: Entrada): void {
    if (!this.aberta) return;
    if (this.tempoAviso > 0) this.tempoAviso -= dt;
    if (this.alavanca > 0) this.alavanca = Math.max(0, this.alavanca - dt * 3);

    if (entrada.teclaAgora('Escape', 'KeyE')) {
      this.fechar();
      return;
    }

    const total = this.linhas.length;
    this.indice = navegar(entrada, this.indice, total);
    const x = Math.round((LARGURA - LARG) / 2);
    const y = Math.round((ALTURA - ALT) / 2);
    const listaY = y + 26;
    const sobre = linhaDoMouse(entrada, x + 8, listaY, LARG - 16, ALTURA_LINHA, total);
    if (sobre >= 0) this.indice = sobre;

    if (total === 0) return;
    const linha = this.linhas[this.indice];
    const cliqueNaLinha = entrada.botaoAgora(0) && sobre === this.indice;
    if (entrada.teclaAgora('Enter', 'NumpadEnter') || cliqueNaLinha) {
      this.vender(linha, 1);
    }
    if (entrada.teclaAgora('KeyA') || entrada.botaoAgora(2)) {
      this.vender(linha, linha.quantidade);
    }
    if (entrada.teclaAgora('KeyV')) this.venderTudo();
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
    cabecalho(g, 'MÁQUINA DE VENDA', x, y, LARG);
    saldo(g, this.assets, this.carteira.moedas, x + LARG - 10, y + 9, 'direita', this.carteira.infinita);

    const listaY = y + 26;
    if (this.linhas.length === 0) {
      texto(g, 'Você não tem recursos para vender.', x + LARG / 2, listaY + 22, {
        cor: P.osso,
        sombra: P.contorno,
        alinhamento: 'centro',
      });
      texto(g, 'Use o machado, a picareta, a pá e a enxada por aí.', x + LARG / 2, listaY + 36, {
        cor: '#8b83a3',
        sombra: P.contorno,
        alinhamento: 'centro',
      });
    }

    this.linhas.forEach((l, i) => {
      const ly = listaY + i * ALTURA_LINHA;
      if (ly + ALTURA_LINHA > y + ALT - 34) return;
      if (i === this.indice) destaque(g, x + 8, ly, LARG - 16, ALTURA_LINHA);
      const icone = this.assets.ferramentas.recursos[l.id];
      g.drawImage(icone, x + 12, ly + Math.floor((ALTURA_LINHA - icone.height) / 2));
      texto(g, l.nome, x + 32, ly + 5, { cor: P.osso, sombra: P.contorno });
      texto(g, `x${l.quantidade}`, x + 150, ly + 5, {
        cor: '#a89fbe',
        sombra: P.contorno,
        alinhamento: 'direita',
      });
      texto(g, `${l.valor}/un`, x + 208, ly + 5, {
        cor: '#a89fbe',
        sombra: P.contorno,
        alinhamento: 'direita',
      });
      texto(g, formatarMoedas(l.valor * l.quantidade), x + LARG - 14, ly + 5, {
        cor: P.ambar,
        sombra: P.contorno,
        alinhamento: 'direita',
      });
    });

    // linha de resumo
    const resumoY = y + ALT - 30;
    g.fillStyle = '#3a2f49';
    g.fillRect(x + 8, resumoY - 4, LARG - 16, 1);
    if (this.tempoAviso > 0) {
      texto(g, this.aviso, x + 12, resumoY, { cor: P.folhaClara, sombra: P.contorno });
    } else {
      texto(g, 'Ganho nesta visita:', x + 12, resumoY, { cor: P.osso, sombra: P.contorno });
    }
    texto(g, formatarMoedas(this.ganhoNaVisita), x + LARG - 14, resumoY, {
      cor: P.ambar,
      sombra: P.contorno,
      alinhamento: 'direita',
    });

    rodape(g, 'ENTER vender 1 · A vender pilha · V vender tudo · ESC sair', x, y, LARG, ALT);
  }
}
