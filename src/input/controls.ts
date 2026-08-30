export type ActionId =
  | 'acelerar' | 'frear' | 'esquerda' | 'direita'
  | 'nitro' | 'freio_mao' | 'buzina' | 'mapa' | 'interagir' | 'pausar';

export const ACTION_LABELS: Record<ActionId, string> = {
  acelerar: 'Acelerar',
  frear: 'Frear / Ré',
  esquerda: 'Direção Esquerda',
  direita: 'Direção Direita',
  nitro: 'Nitro',
  freio_mao: 'Freio de Mão',
  buzina: 'Buzina',
  mapa: 'Mapa',
  interagir: 'Interagir',
  pausar: 'Pausar',
};

// Layout padrão. IMPORTANTE: a direção vem invertida de propósito em relação
// ao layout convencional (A = direita, D = esquerda) — o jogador pode alterar
// isso livremente em Ajustes > Controles.
const DEFAULT_BINDINGS: Record<ActionId, string> = {
  acelerar: 'KeyW',
  frear: 'KeyS',
  esquerda: 'KeyD',
  direita: 'KeyA',
  nitro: 'ShiftLeft',
  freio_mao: 'Space',
  buzina: 'KeyH',
  mapa: 'KeyM',
  interagir: 'KeyE',
  pausar: 'Escape',
};

export class Controls {
  bindings: Record<ActionId, string>;
  private pressed = new Set<string>();
  private justPressed = new Set<string>();
  private remapTarget: ActionId | null = null;
  private remapListener: ((code: string) => void) | null = null;

  constructor(saved?: Partial<Record<ActionId, string>>) {
    this.bindings = { ...DEFAULT_BINDINGS, ...(saved ?? {}) };
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.remapTarget) {
      e.preventDefault();
      this.remapListener?.(e.code);
      return;
    }
    if (!this.pressed.has(e.code)) this.justPressed.add(e.code);
    this.pressed.add(e.code);
    if (Object.values(this.bindings).includes(e.code)) e.preventDefault();
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.pressed.delete(e.code);
  }

  isDown(action: ActionId): boolean {
    return this.pressed.has(this.bindings[action]) || this.gamepadDown(action);
  }

  wasJustPressed(action: ActionId): boolean {
    return this.justPressed.has(this.bindings[action]);
  }

  clearFrame(): void {
    this.justPressed.clear();
  }

  beginRemap(action: ActionId, onComplete: (result: 'ok' | 'cancelled') => void): void {
    this.remapTarget = action;
    this.remapListener = (code: string) => {
      if (code === 'Escape') {
        this.remapTarget = null;
        this.remapListener = null;
        onComplete('cancelled');
        return;
      }
      const conflictAction = (Object.keys(this.bindings) as ActionId[]).find(
        (a) => a !== action && this.bindings[a] === code,
      );
      if (conflictAction) {
        const proceed = window.confirm(
          `A tecla já está em uso por "${ACTION_LABELS[conflictAction]}". Deseja substituir e liberar essa tecla?`,
        );
        if (!proceed) {
          this.remapTarget = null;
          this.remapListener = null;
          onComplete('cancelled');
          return;
        }
        delete (this.bindings as any)[conflictAction];
        this.bindings[conflictAction] = 'None';
      }
      this.bindings[action] = code;
      this.remapTarget = null;
      this.remapListener = null;
      onComplete('ok');
    };
  }

  cancelRemap(): void {
    this.remapTarget = null;
    this.remapListener = null;
  }

  keyLabel(code: string): string {
    if (code === 'None') return '—';
    const map: Record<string, string> = {
      ShiftLeft: 'Shift', ShiftRight: 'Shift Dir',
      Space: 'Espaço', Escape: 'Esc',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    };
    if (map[code]) return map[code];
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
  }

  // --- Gamepad (analog steering, trigger throttle/brake) ---
  private gamepadDown(action: ActionId): boolean {
    const gp = this.getPad();
    if (!gp) return false;
    switch (action) {
      case 'nitro': return gp.buttons[5]?.pressed ?? false; // RB
      case 'freio_mao': return gp.buttons[0]?.pressed ?? false; // A/Cross
      case 'buzina': return gp.buttons[1]?.pressed ?? false;
      case 'mapa': return gp.buttons[3]?.pressed ?? false;
      case 'interagir': return gp.buttons[2]?.pressed ?? false;
      case 'pausar': return gp.buttons[9]?.pressed ?? false;
      default: return false;
    }
  }

  getPad(): Gamepad | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p) return p;
    return null;
  }

  gamepadSteer(): number | null {
    const gp = this.getPad();
    if (!gp) return null;
    const x = gp.axes[0] ?? 0;
    return Math.abs(x) > 0.08 ? x : 0;
  }

  gamepadThrottle(): number | null {
    const gp = this.getPad();
    if (!gp) return null;
    const t = gp.buttons[7]?.value ?? 0; // RT
    return t;
  }

  gamepadBrake(): number | null {
    const gp = this.getPad();
    if (!gp) return null;
    const t = gp.buttons[6]?.value ?? 0; // LT
    return t;
  }
}
