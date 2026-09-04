/**
 * Ponto de entrada: monta a tela de carregamento, gera toda a arte em pixel
 * e entrega o jogo ao menu principal.
 */

import { carregarAssets } from './gfx/assets';
import { Jogo } from './core/game';
import { CenaMenu } from './scenes/menu';

const overlay = document.getElementById('overlay') as HTMLDivElement | null;
const canvas = document.getElementById('game') as HTMLCanvasElement | null;

function telaCarregando(): { atualizar: (r: string, p: number) => void; fechar: () => void } {
  const div = document.createElement('div');
  div.className = 'carregando painel';
  div.innerHTML =
    '<div>Cronos Jurássico</div><div class="barra"><i></i></div><div class="rotulo">Preparando…</div>';
  overlay?.appendChild(div);
  const barra = div.querySelector('.barra > i') as HTMLElement;
  const rotulo = div.querySelector('.rotulo') as HTMLElement;
  return {
    atualizar: (r, p) => {
      rotulo.textContent = r + '…';
      barra.style.width = `${Math.round(p * 100)}%`;
    },
    fechar: () => div.remove(),
  };
}

function mostrarErro(e: unknown): void {
  const div = document.createElement('div');
  div.className = 'erro painel';
  const msg = e instanceof Error ? e.message : String(e);
  div.innerHTML = `<strong>Ops!</strong><span>Não foi possível iniciar o jogo neste navegador.</span><span>${msg}</span>`;
  overlay?.appendChild(div);
  console.error(e);
}

/** Usa a arte do próprio jogo como ícone da aba. */
function definirFavicon(assets: ReturnType<typeof carregarAssets>): void {
  try {
    const cv = document.createElement('canvas');
    cv.width = 32;
    cv.height = 32;
    const g = cv.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    const s = assets.ui.coracaoCheio;
    g.drawImage(s, 0, 0, s.width * 4, s.height * 4);
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = cv.toDataURL('image/png');
  } catch {
    // sem ícone é apenas um detalhe: o jogo continua
  }
}

/**
 * Aviso de foco: dentro de um quadro (iframe) o teclado só chega ao jogo
 * depois de um clique. Some no primeiro clique ou tecla.
 */
function avisoDeFoco(): void {
  const div = document.createElement('div');
  div.className = 'foco';
  div.innerHTML = '<span>Clique na tela para jogar</span>';
  overlay?.appendChild(div);
  const liberar = () => {
    div.remove();
    try {
      window.focus();
      canvas?.focus();
    } catch {
      // sem foco explícito o jogo ainda funciona depois do clique
    }
    window.removeEventListener('pointerdown', liberar);
    window.removeEventListener('keydown', liberar);
  };
  window.addEventListener('pointerdown', liberar);
  window.addEventListener('keydown', liberar);
}

async function principal(): Promise<void> {
  if (!canvas) throw new Error('Canvas do jogo não encontrado.');
  const carregando = telaCarregando();

  // dá um quadro ao navegador para pintar a tela de carregamento
  const respirar = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
  await respirar();

  const assets = carregarAssets((rotulo, progresso) => {
    carregando.atualizar(rotulo, progresso);
  });
  await respirar();
  carregando.fechar();

  definirFavicon(assets);

  const jogo = new Jogo(canvas, assets);
  jogo.definirCena(new CenaMenu(jogo));
  jogo.iniciar();
  avisoDeFoco();
}

principal().catch(mostrarErro);
