/** Keyboard state. Arrow keys and WASD both drive the car. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.down.has(k)) this.pressed.add(k);
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
  }

  held(...keys: string[]): boolean {
    return keys.some((k) => this.down.has(k));
  }

  /** True once per physical key press. */
  tapped(key: string): boolean {
    return this.pressed.has(key);
  }

  endFrame(): void {
    this.pressed.clear();
  }
}
