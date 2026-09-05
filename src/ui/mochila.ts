/**
 * Janela do TAB: bolsa completa e bestiário, no mesmo lugar.
 *
 * Compacta de propósito — ocupa o meio da tela e deixa o mundo à vista em
 * volta. A bolsa mostra todos os espaços liberados (10, 20 ou 30, conforme as
 * melhorias) e o espaço de armadura; o bestiário lista as vinte e cinco
 * criaturas, agrupadas por bioma, com a dificuldade em bolinhas e o que ainda
 * não foi encontrado marcado como desconhecido.
 */

import { LARGURA, ALTURA } from '../core/screen';
import { texto, quebrarTexto, larguraTexto } from '../gfx/font';
import { P } from '../gfx/palette';
import type { Assets } from '../gfx/assets';
import type { Entrada } from '../core/input';
import type { Inventario } from '../systems/items';
import type { Progresso } from '../systems/progression';
import type { Carteira } from '../systems/economy';
import { ARMADURAS, TODAS_ARMADURAS } from '../systems/armor';
import type { ArmaduraId } from '../gfx/sprites/armor';
import { TODAS_FICHAS, NOME_CATEGORIA, estrelasDificuldade, type FichaDino } from '../entities/dinoTypes';
import { BIOMAS, ORDEM_BIOMAS } from '../world/biomes';
import { tingirCache } from '../gfx/pixel';
import { iconeDoItem, nomeDoItem, descricaoDoItem } from './itens';
import { cabecalho, moldura, rodape, saldo } from './painel';
import { pointInRect } from '../core/math';

const LARG = 342;
const ALT = 196;
const SLOT = 19;
const COLUNAS = 10;

type Aba = 'bolsa' | 'bestiario';

/** O bestiário lista bioma por bioma, do bicho mais manso ao mais perigoso. */
const BESTIARIO: FichaDino[] = ORDEM_BIOMAS.flatMap((b) =>
  TODAS_FICHAS.filter((f) => f.bioma === b).sort((a, c) => a.dificuldade - c.dificuldade),
);

/** Linhas visíveis da lista de criaturas. */
const LINHAS_LISTA = 10;
const ALTURA_LINHA = 11;

export class PainelMochila {
  aberta = false;
  private aba: Aba = 'bolsa';
  private indice = 0;
  private indiceDino = 0;
  private topoDino = 0;
  private aviso = '';
  private tempoAviso = 0;

  constructor(
    private inventario: Inventario,
    private progresso: Progresso,
    private carteira: Carteira,
    private assets: Assets,
    private aoTrocarArmadura: () => void,
  ) {}

  abrir(aba: Aba = 'bolsa'): void {
    this.aberta = true;
    this.aba = aba;
    this.indice = 0;
    this.aviso = '';
    this.tempoAviso = 0;
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

  /** Retângulos dos espaços da bolsa. */
  private slots(): { x: number; y: number; w: number; h: number }[] {
    const gx = this.x + 10;
    const gy = this.y + 40;
    return Array.from({ length: this.inventario.liberados }, (_, i) => ({
      x: gx + (i % COLUNAS) * SLOT,
      y: gy + Math.floor(i / COLUNAS) * SLOT,
      w: SLOT - 1,
      h: SLOT - 1,
    }));
  }

  /** Caixa do espaço de armadura. */
  private caixaArmadura(): { x: number; y: number; w: number; h: number } {
    return { x: this.x + LARG - 44, y: this.y + 40, w: 34, h: 34 };
  }

  private mostrar(txt: string): void {
    this.aviso = txt;
    this.tempoAviso = 2.4;
  }

  /** Alterna entre as armaduras compradas (e nenhuma). */
  private trocarArmadura(): void {
    const donas = TODAS_ARMADURAS.filter((a) => this.progresso.armaduras.has(a.id));
    if (donas.length === 0) {
      this.mostrar('Nenhuma armadura ainda. Fale com a Bruna, na cabana.');
      return;
    }
    const ordem: (ArmaduraId | null)[] = [...donas.map((a) => a.id), null];
    const atual = ordem.indexOf(this.progresso.armaduraVestida);
    this.progresso.armaduraVestida = ordem[(atual + 1) % ordem.length];
    const v = this.progresso.armaduraVestida;
    this.mostrar(v ? `Vestindo: ${ARMADURAS[v].nome}.` : 'Armadura guardada.');
    this.aoTrocarArmadura();
  }

  atualizar(dt: number, entrada: Entrada): void {
    if (!this.aberta) return;
    if (this.tempoAviso > 0) this.tempoAviso -= dt;
    if (entrada.teclaAgora('Tab', 'Escape')) {
      this.fechar();
      return;
    }
    if (entrada.teclaAgora('KeyQ')) this.aba = this.aba === 'bolsa' ? 'bestiario' : 'bolsa';

    // cliques nas abas
    const abas: [Aba, string][] = [
      ['bolsa', 'BOLSA'],
      ['bestiario', 'BESTIÁRIO'],
    ];
    let ax = this.x + 10;
    for (const [id, rotulo] of abas) {
      const larg = larguraTexto(rotulo) + 10;
      const r = { x: ax, y: this.y + 20, w: larg, h: 13 };
      if (pointInRect(entrada.mouseX, entrada.mouseY, r) && entrada.botaoAgora(0)) this.aba = id;
      ax += larg + 4;
    }

    if (this.aba === 'bolsa') {
      const total = this.inventario.liberados;
      if (entrada.teclaAgora('KeyD', 'ArrowRight')) this.indice = (this.indice + 1) % total;
      if (entrada.teclaAgora('KeyA', 'ArrowLeft'))
        this.indice = (this.indice - 1 + total) % total;
      if (entrada.teclaAgora('KeyS', 'ArrowDown')) this.indice = (this.indice + COLUNAS) % total;
      if (entrada.teclaAgora('KeyW', 'ArrowUp'))
        this.indice = (this.indice - COLUNAS + total) % total;

      const rects = this.slots();
      rects.forEach((r, i) => {
        if (!pointInRect(entrada.mouseX, entrada.mouseY, r)) return;
        this.indice = i;
        // clicar num item da primeira fileira também o escolhe na barra
        if (entrada.botaoAgora(0) && i < this.inventario.slotsRapidos) {
          this.inventario.selecionar(i);
        }
      });
      const arm = this.caixaArmadura();
      if (
        (pointInRect(entrada.mouseX, entrada.mouseY, arm) && entrada.botaoAgora(0)) ||
        entrada.teclaAgora('KeyR')
      ) {
        this.trocarArmadura();
      }
      if (entrada.teclaAgora('Enter', 'NumpadEnter') && this.indice < this.inventario.slotsRapidos) {
        this.inventario.selecionar(this.indice);
        this.mostrar('Item escolhido na barra.');
      }
    } else {
      const total = BESTIARIO.length;
      if (entrada.teclaAgora('KeyS', 'ArrowDown')) this.indiceDino = (this.indiceDino + 1) % total;
      if (entrada.teclaAgora('KeyW', 'ArrowUp'))
        this.indiceDino = (this.indiceDino - 1 + total) % total;
      // clique e rolagem com o mouse na coluna da esquerda
      for (let i = 0; i < LINHAS_LISTA; i++) {
        const r = {
          x: this.x + 8,
          y: this.y + 38 + i * ALTURA_LINHA,
          w: 132,
          h: ALTURA_LINHA,
        };
        if (!pointInRect(entrada.mouseX, entrada.mouseY, r)) continue;
        const alvo = this.topoDino + i;
        if (alvo < total) this.indiceDino = alvo;
      }
      // mantém o escolhido sempre visível
      if (this.indiceDino < this.topoDino) this.topoDino = this.indiceDino;
      if (this.indiceDino > this.topoDino + LINHAS_LISTA - 1)
        this.topoDino = this.indiceDino - LINHAS_LISTA + 1;
      this.topoDino = Math.max(0, Math.min(this.topoDino, total - LINHAS_LISTA));
    }
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
    cabecalho(g, this.aba === 'bolsa' ? 'MOCHILA' : 'BESTIÁRIO', x, y, LARG);
    saldo(g, this.assets, this.carteira.moedas, x + LARG - 10, y + 9, 'direita', this.carteira.infinita);

    // abas
    const abas: [Aba, string][] = [
      ['bolsa', 'BOLSA'],
      ['bestiario', 'BESTIÁRIO'],
    ];
    let ax = x + 10;
    for (const [id, rotulo] of abas) {
      const larg = larguraTexto(rotulo) + 10;
      const ativa = this.aba === id;
      g.fillStyle = ativa ? '#3a2f49' : '#1d1828';
      g.fillRect(ax, y + 20, larg, 13);
      g.fillStyle = ativa ? P.ambar : '#3a2f49';
      g.fillRect(ax, y + 20, larg, 1);
      texto(g, rotulo, ax + 5, y + 23, {
        cor: ativa ? P.ambar : '#7a7391',
        sombra: P.contorno,
      });
      ax += larg + 4;
    }

    if (this.aba === 'bolsa') this.desenharBolsa(g);
    else this.desenharBestiario(g);

    rodape(
      g,
      this.aba === 'bolsa'
        ? 'WASD move · ENTER na barra · R armadura · Q abas · TAB fecha'
        : 'W/S ou mouse escolhe · Q abas · TAB fecha',
      x,
      y,
      LARG,
      ALT,
    );
  }

  private desenharBolsa(g: CanvasRenderingContext2D): void {
    const x = this.x;
    const y = this.y;
    const rects = this.slots();
    rects.forEach((r, i) => {
      const sel = i === this.indice;
      g.drawImage(sel ? this.assets.ui.slotSelecionado : this.assets.ui.slot, r.x, r.y);
      if (i === this.inventario.selecionado) {
        // marca o item que está na mão
        g.fillStyle = P.folhaClara;
        g.fillRect(r.x, r.y - 2, r.w, 1);
      }
      const item = this.inventario.slots[i];
      if (!item) return;
      const icone = iconeDoItem(this.assets, this.progresso, item);
      g.drawImage(icone, r.x + 9 - (icone.width >> 1), r.y + 9 - (icone.height >> 1));
      if (item.quantidade > 1) {
        texto(g, String(item.quantidade), r.x + 16, r.y + 10, {
          cor: P.osso,
          sombra: P.contorno,
          contorno: true,
          alinhamento: 'direita',
        });
      }
    });

    // espaço de armadura
    const arm = this.caixaArmadura();
    texto(g, 'ARMADURA', arm.x + arm.w, arm.y - 10, {
      cor: '#7a7391',
      sombra: P.contorno,
      alinhamento: 'direita',
    });
    g.fillStyle = '#1c1727';
    g.fillRect(arm.x, arm.y, arm.w, arm.h);
    g.fillStyle = P.ossoEscuro;
    g.strokeStyle = P.ossoEscuro;
    g.fillRect(arm.x, arm.y, arm.w, 1);
    g.fillRect(arm.x, arm.y + arm.h - 1, arm.w, 1);
    g.fillRect(arm.x, arm.y, 1, arm.h);
    g.fillRect(arm.x + arm.w - 1, arm.y, 1, arm.h);
    const vestida = this.progresso.armaduraVestida;
    if (vestida) {
      const ic = this.assets.armaduras[vestida].icone;
      g.drawImage(ic, arm.x + arm.w / 2 - ic.width / 2, arm.y + arm.h / 2 - ic.height / 2);
    } else {
      texto(g, 'nenhuma', arm.x + arm.w / 2, arm.y + arm.h / 2 - 3, {
        cor: '#5b5470',
        sombra: P.contorno,
        alinhamento: 'centro',
      });
    }
    const nomeArm = vestida ? ARMADURAS[vestida].nome : 'Sem armadura';
    texto(g, nomeArm, arm.x + arm.w / 2, arm.y + arm.h + 4, {
      cor: vestida ? P.osso : '#7a7391',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    if (vestida) {
      const metades = ARMADURAS[vestida].reducao;
      const inteiros = Math.floor(metades / 2);
      const meio = metades % 2 === 1;
      const quanto = `${inteiros > 0 ? inteiros : ''}${meio ? '½' : ''}`;
      texto(
        g,
        `absorve ${quanto} coração${inteiros > 1 ? 'es' : ''}`,
        arm.x + arm.w / 2,
        arm.y + arm.h + 13,
        { cor: '#7a7391', sombra: P.contorno, alinhamento: 'centro' },
      );
    }

    // rodapé de informação
    const infoY = y + ALT - 34;
    g.fillStyle = '#3a2f49';
    g.fillRect(x + 8, infoY - 4, LARG - 16, 1);
    const item = this.inventario.slots[this.indice];
    if (this.tempoAviso > 0) {
      texto(g, this.aviso, x + 12, infoY, { cor: P.ambar, sombra: P.contorno });
    } else if (item) {
      texto(g, nomeDoItem(this.progresso, item), x + 12, infoY, {
        cor: P.osso,
        sombra: P.contorno,
      });
      texto(g, descricaoDoItem(this.progresso, item), x + 12, infoY + 9, {
        cor: '#a89fbe',
        sombra: P.contorno,
      });
    } else {
      texto(g, 'Espaço vazio', x + 12, infoY, { cor: '#7a7391', sombra: P.contorno });
      texto(
        g,
        `${this.inventario.liberados} espaços liberados · melhore a bolsa com o Nilo`,
        x + 12,
        infoY + 9,
        { cor: '#5b5470', sombra: P.contorno },
      );
    }
  }

  private desenharBestiario(g: CanvasRenderingContext2D): void {
    const x = this.x;
    const y = this.y;
    const vistos = this.progresso.especiesVistas;
    const conhecida = (f: FichaDino) => this.progresso.demo || vistos.has(f.id);

    // ---- coluna da esquerda: a lista, bioma por bioma
    const listaX = x + 8;
    const listaY = y + 38;
    g.fillStyle = '#141020';
    g.fillRect(listaX, listaY - 2, 134, LINHAS_LISTA * ALTURA_LINHA + 4);
    for (let i = 0; i < LINHAS_LISTA; i++) {
      const idx = this.topoDino + i;
      if (idx >= BESTIARIO.length) break;
      const f = BESTIARIO[idx];
      const ly = listaY + i * ALTURA_LINHA;
      if (idx === this.indiceDino) {
        g.fillStyle = 'rgba(255,199,90,0.16)';
        g.fillRect(listaX, ly, 134, ALTURA_LINHA);
        g.fillStyle = P.ambar;
        g.fillRect(listaX, ly, 1, ALTURA_LINHA);
      }
      // tarja com a cor do bioma, para achar a região de relance
      g.fillStyle = BIOMAS[f.bioma].cor;
      g.fillRect(listaX + 3, ly + 3, 3, 5);
      const achou = conhecida(f);
      texto(g, achou ? f.nome : '? ? ?', listaX + 10, ly + 2, {
        cor: achou ? P.osso : '#5b5470',
        sombra: P.contorno,
      });
      texto(g, estrelasDificuldade(f.dificuldade), listaX + 132, ly + 2, {
        cor: achou ? corDaDificuldade(f.dificuldade) : '#3a3450',
        sombra: P.contorno,
        alinhamento: 'direita',
      });
    }
    // barrinha de rolagem
    const total = BESTIARIO.length;
    const alturaTrilho = LINHAS_LISTA * ALTURA_LINHA;
    g.fillStyle = '#2a2338';
    g.fillRect(listaX + 135, listaY, 2, alturaTrilho);
    const tam = Math.max(8, Math.round((LINHAS_LISTA / total) * alturaTrilho));
    const desl = Math.round((this.topoDino / Math.max(1, total - LINHAS_LISTA)) * (alturaTrilho - tam));
    g.fillStyle = P.ambar;
    g.fillRect(listaX + 135, listaY + desl, 2, tam);

    // ---- coluna da direita: a ficha da criatura escolhida
    const f = BESTIARIO[this.indiceDino];
    const achou = conhecida(f);
    const px = x + 152;
    g.fillStyle = '#141020';
    g.fillRect(px, listaY - 2, LARG - 162, alturaTrilho + 4);

    const q = this.assets.dinos[f.id].direita[0];
    const escala = Math.min(2, Math.max(1, Math.floor(34 / q.height)));
    const larg = q.width * escala;
    const alt = q.height * escala;
    const qx = Math.round(px + (LARG - 162) / 2 - larg / 2);
    const qy = Math.round(listaY + 40 - alt);
    // enquanto não é descoberta, aparece só a silhueta
    g.drawImage(achou ? q : tingirCache(q, '#2a2338', 1), qx, qy, larg, alt);

    texto(g, achou ? f.nome : 'Criatura desconhecida', px + (LARG - 162) / 2, listaY + 44, {
      cor: achou ? P.osso : '#7a7391',
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    texto(g, BIOMAS[f.bioma].nome, px + (LARG - 162) / 2, listaY + 54, {
      cor: BIOMAS[f.bioma].cor,
      sombra: P.contorno,
      alinhamento: 'centro',
    });
    texto(
      g,
      `${estrelasDificuldade(f.dificuldade)} ${f.dificuldade}/5 \u00b7 ${NOME_CATEGORIA[f.categoria]}`,
      px + (LARG - 162) / 2,
      listaY + 64,
      { cor: corDaDificuldade(f.dificuldade), sombra: P.contorno, alinhamento: 'centro' },
    );

    // ---- rodapé de informação: descrição e contagem
    const infoY = y + ALT - 34;
    g.fillStyle = '#3a2f49';
    g.fillRect(x + 8, infoY - 4, LARG - 16, 1);
    if (achou) {
      const linhas = quebrarTexto(f.descricao, LARG - 62);
      texto(g, linhas[0] ?? '', x + 12, infoY, { cor: '#a89fbe', sombra: P.contorno });
      texto(g, linhas[1] ?? '', x + 12, infoY + 9, { cor: '#a89fbe', sombra: P.contorno });
    } else {
      texto(g, 'Você ainda não chegou perto dessa criatura.', x + 12, infoY, {
        cor: '#7a7391',
        sombra: P.contorno,
      });
      texto(g, `Procure no bioma: ${BIOMAS[f.bioma].nome}.`, x + 12, infoY + 9, {
        cor: '#5b5470',
        sombra: P.contorno,
      });
    }
    const quantos = this.progresso.demo
      ? BESTIARIO.length
      : BESTIARIO.filter((d) => vistos.has(d.id)).length;
    texto(g, `${quantos}/${BESTIARIO.length}`, x + LARG - 12, infoY, {
      cor: P.ambar,
      sombra: P.contorno,
      alinhamento: 'direita',
    });
  }
}

/** Verde para os mansos, vermelho para os que matam. */
function corDaDificuldade(d: number): string {
  return d <= 1 ? '#7fbf5a' : d === 2 ? '#c8d84a' : d === 3 ? P.ambar : d === 4 ? '#e88a3a' : P.coracao;
}
