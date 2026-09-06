/**
 * Salvamento da partida.
 *
 * Um único registro em `localStorage`, gravado nos momentos que importam
 * (escolher o personagem, dormir, comprar melhoria, descer um andar, derrubar
 * um chefe, terminar a história) e relido quando o jogador escolhe continuar.
 *
 * Todo acesso é envolvido em try/catch: navegador anônimo, armazenamento
 * bloqueado ou cota estourada não podem derrubar o jogo — no pior caso a
 * partida roda sem salvar.
 */

import type { PersonagemId } from '../gfx/sprites/player';
import type { Item } from './items';
import type { ArmaduraId } from '../gfx/sprites/armor';
import type { FerramentaId, RecursoId } from '../gfx/sprites/tools';
import type { EspecieId } from '../gfx/sprites/dinos';
import type { BiomaId } from '../world/biomes';
import type { CavernaId } from '../world/caveDefs';
import type { FossilId } from './fossils';

export const CHAVE_SAVE = 'cronos-jurassico:save:v1';
const VERSAO = 1;

export interface ProgressoSalvo {
  ferramentas: Record<FerramentaId, number>;
  slotsInventario: number;
  pilhaMax: number;
  slotsBau: number;
  armaduras: ArmaduraId[];
  armaduraVestida: ArmaduraId | null;
  casa: { camaMacia: boolean; bauReforcado: boolean; telhadoNovo: boolean };
  compradas: string[];
  biomasVisitados: BiomaId[];
  especiesVistas: EspecieId[];
  fosseisAchados: FossilId[];
  mineraisAchados: RecursoId[];
  andarMax: Record<CavernaId, number>;
  chefesDerrotados: CavernaId[];
  lanterna: boolean;
  cronolita: boolean;
  historiaConcluida: boolean;
}

export interface DiarioSalvo {
  feito: [string, number][];
  concluidas: string[];
  ativas: string[];
  historico: string[];
}

export interface EstadoSalvo {
  versao: number;
  /** Carimbo de quando foi salvo, para a linha do menu. */
  quando: number;
  personagem: PersonagemId;
  moedas: number;
  faseDoDia: number;
  progresso: ProgressoSalvo;
  inventario: (Item | null)[];
  selecionado: number;
  bau: (Item | null)[];
  diario: DiarioSalvo;
  posicao: { x: number; y: number };
}

function armazenamento(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function salvar(estado: EstadoSalvo): boolean {
  const s = armazenamento();
  if (!s) return false;
  try {
    s.setItem(CHAVE_SAVE, JSON.stringify({ ...estado, versao: VERSAO, quando: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function carregar(): EstadoSalvo | null {
  const s = armazenamento();
  if (!s) return null;
  try {
    const bruto = s.getItem(CHAVE_SAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as EstadoSalvo;
    if (!dados || dados.versao !== VERSAO) return null;
    return dados;
  } catch {
    return null;
  }
}

export function existeSave(): boolean {
  return carregar() !== null;
}

/** Apaga a partida. Só é chamado depois de confirmação explícita do jogador. */
export function apagar(): void {
  const s = armazenamento();
  if (!s) return;
  try {
    s.removeItem(CHAVE_SAVE);
  } catch {
    // sem armazenamento não há o que apagar
  }
}

/** Data curta do save, para a linha do menu ("12/03 às 21:40"). */
export function descreverSave(estado: EstadoSalvo): string {
  const d = new Date(estado.quando);
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}
