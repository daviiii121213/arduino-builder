/**
 * Balcão de melhorias da cabana.
 *
 * Mostra o que cada pessoa vende, o custo, o que já foi comprado e o que ainda
 * depende de um passo anterior. A compra desconta da carteira e aplica o efeito
 * na hora — a ferramenta melhorada muda de desenho imediatamente.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto, quebrarTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Entrada } from '../core/input';
import type { Carteira } from '../systems/economy';
import { formatarMoedas } from '../systems/economy';
import type { Melhoria, Progresso, Vendedor } from '../systems/progression';
import { melhoriasDe } from '../systems/progression';
import { FERRAMENTAS } from '../systems/tools';
import type { FerramentaId } from '../gfx/sprites/tools';
import { cabecalho, destaque, linhaDoMouse, moldura, navegar, rodape, saldo } from './painel';

const LARG = 340;
const ALT = 232;
const ALTURA_LINHA = 16;

export class PainelMelhorias {
  aberta = false;
  private indice = 0;
  private lista: Melhoria[] = [];
  private vendedor: Vendedor = 'ferreira';
  private nomeVendedor = '';
  private fala = '';
  private aviso = '';
  private tempoAviso = 0;

  constructor(
    private progresso: Progresso,
    private carteira: Carteira,
    private assets: Assets,
    private aoComprar: (m: Melhoria) => void,
  ) {}

  abrir(vendedor: Vendedor, nome: string, fala: string): void {
    this.aberta = true;
    this.vendedor = vendedor;
    this.nomeVendedor = nome;
    this.fala = fala;
    this.indice = 0;
    this.aviso = '';
    this.tempoAviso = 0;
    this.recalcular();
  }

  fechar(): void {
    this.aberta = false;
  }

  private recalcular(): void {
    this.lista = melhoriasDe(this.vendedor);
    if (this.indice >= this.lista.length) this.indice = 0;
  }

  private estado(m: Melhoria): 'comprada' | 'disponivel' | 'caro' | 'travada' {
    if (m.concluida(this.progresso)) return 'comprada';
    if (!m.disponivel(this.progresso)) return 'travada';
    return this.carteira.podePagar(m.custo) ? 'disponivel' : 'caro';
  }

  private comprar(m: Melhoria): void {
    const est = this.estado(m);
    if (est === 'comprada') {
      this.mostrar('Você já tem isso.');
      return;
    }
    if (est === 'travada') {
      this.mostrar('Precisa da melhoria anterior primeiro.');
      return;
    }
    if (est === 'caro') {
      this.mostrar(`Faltam ${formatarMoedas(m.custo - this.carteira.moedas)} moedas.`);
      return;
    }
    if (!this.carteira.pagar(m.custo)) return;
    m.aplicar(this.progresso);
    this.progresso.compradas.add(m.id);
    this.aoComprar(m);
    this.mostrar(`${m.nome} pronto!`);
  }

  private mostrar(txt: string): void {
    this.aviso = txt;
    this.tempoAviso = 2.6;
  }

  atualizar(dt: number, entrada: Entrada): void {
    if (!this.aberta) return;
    if (this.tempoAviso > 0) this.tempoAviso -= dt;
    if (entrada.teclaAgora('Escape', 'KeyE')) {
      this.fechar();
      return;
    }
    const total = this.lista.length;
    this.indice = navegar(entrada, this.indice, total);
    const x = Math.round((LARGURA - LARG) / 2);
    const y = Math.round((ALTURA - ALT) / 2);
    const listaY = y + 44;
    const sobre = linhaDoMouse(entrada, x + 8, listaY, LARG - 16, ALTURA_LINHA, total);
    if (sobre >= 0) this.indice = sobre;
    if (total === 0) return;
    if (
      entrada.teclaAgora('Enter', 'NumpadEnter') ||
      (entrada.botaoAgora(0) && sobre === this.indice)
    ) {
      this.comprar(this.lista[this.indice]);
    }
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
    cabecalho(g, `MELHORIAS — ${this.nomeVendedor.toUpperCase()}`, x, y, LARG);
    saldo(g, this.assets, this.carteira.moedas, x + LARG - 10, y + 9, 'direita', this.carteira.infinita);

    // retrato de quem atende + fala
    const retrato =
      this.vendedor === 'ferreira' ? this.assets.cabana.ferreira[0] : this.assets.cabana.marceneiro[0];
    g.drawImage(retrato, x + 10, y + 22);
    const fala = quebrarTexto(this.fala, LARG - 48);
    fala.slice(0, 2).forEach((l, i) => {
      texto(g, l, x + 30, y + 24 + i * 9, { cor: '#cfc4e0', sombra: P.contorno });
    });

    const listaY = y + 44;
    this.lista.forEach((m, i) => {
      const ly = listaY + i * ALTURA_LINHA;
      if (ly + ALTURA_LINHA > y + ALT - 34) return;
      const est = this.estado(m);
      if (i === this.indice) destaque(g, x + 8, ly, LARG - 16, ALTURA_LINHA);

      // ícone: a ferramenta no nível que a melhoria entrega
      const idFerramenta = (Object.keys(FERRAMENTAS) as FerramentaId[]).find((f) =>
        m.id.startsWith(f),
      );
      if (idFerramenta) {
        const nivel = Number(m.id.split('-')[1] ?? 0);
        const s = this.assets.ferramentas.ferramentas[idFerramenta][nivel];
        g.drawImage(s, x + 11, ly + 1);
      } else {
        const s = this.assets.ferramentas.sacoMoedas;
        g.drawImage(s, x + 13, ly + 3);
      }

      const cor =
        est === 'comprada'
          ? P.folhaClara
          : est === 'disponivel'
            ? P.osso
            : est === 'caro'
              ? '#c98f8c'
              : '#7a7391';
      texto(g, m.nome, x + 30, ly + 2, { cor, sombra: P.contorno });
      texto(g, m.grupo, x + 30, ly + 10, { cor: '#7a7391', sombra: P.contorno });

      if (est === 'comprada') {
        texto(g, 'pronto', x + LARG - 14, ly + 6, {
          cor: P.folhaClara,
          sombra: P.contorno,
          alinhamento: 'direita',
        });
      } else if (est === 'travada') {
        texto(g, 'travado', x + LARG - 14, ly + 6, {
          cor: '#7a7391',
          sombra: P.contorno,
          alinhamento: 'direita',
        });
      } else {
        saldo(g, this.assets, m.custo, x + LARG - 12, ly + 6);
      }
    });

    // descrição do item selecionado / aviso
    const infoY = y + ALT - 38;
    g.fillStyle = '#3a2f49';
    g.fillRect(x + 8, infoY - 4, LARG - 16, 1);
    if (this.tempoAviso > 0) {
      texto(g, this.aviso, x + 12, infoY, { cor: P.ambar, sombra: P.contorno });
    } else if (this.lista[this.indice]) {
      const d = quebrarTexto(this.lista[this.indice].descricao, LARG - 24);
      d.slice(0, 2).forEach((l, i) =>
        texto(g, l, x + 12, infoY + i * 9, { cor: '#a89fbe', sombra: P.contorno }),
      );
    }

    rodape(g, 'W/S escolher · ENTER comprar · ESC sair', x, y, LARG, ALT);
  }
}
