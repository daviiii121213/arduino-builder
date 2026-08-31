/** Held-down keys that should auto-repeat while navigating menus. */
const MENU_REPEATABLE = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd']);

export interface Click {
  /** Position in render-buffer pixels. */
  x: number;
  y: number;
}

/** Keyboard (and menu mouse) state. Arrow keys and WASD both drive the car. */
export class Input {
  private down = new Set<string>();
  /** Keys pressed since the last frame, in order — repeats included, so two
   * quick taps in one frame both count. */
  private presses: string[] = [];
  private queuedClicks: Click[] = [];

  constructor(canvas: HTMLCanvasElement, target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!e.repeat || MENU_REPEATABLE.has(k)) this.presses.push(k);
      this.down.add(k);
      if (
        k === ' ' ||
        k === 'arrowup' ||
        k === 'arrowdown' ||
        k === 'arrowleft' ||
        k === 'arrowright'
      ) {
        e.preventDefault();
      }
    });
    target.addEventListener('keyup', (e) => this.down.delete(e.key.toLowerCase()));
    target.addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      this.queuedClicks.push({
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      });
    });
  }

  held(...keys: string[]): boolean {
    return keys.some((k) => this.down.has(k));
  }

  /** True if any of these keys was pressed since the last frame. */
  tapped(...keys: string[]): boolean {
    return keys.some((k) => this.presses.includes(k));
  }

  /** Every key pressed since the last frame, in the order they arrived. */
  get keyPresses(): string[] {
    return this.presses;
  }

  /** Clicks since the last frame, in render-buffer pixels. */
  get clicks(): Click[] {
    return this.queuedClicks;
  }

  /** True if any key was pressed or the canvas clicked this frame. */
  get anyInput(): boolean {
    return this.presses.length > 0 || this.queuedClicks.length > 0;
  }

  endFrame(): void {
    this.presses.length = 0;
    this.queuedClicks = [];
  }
}
