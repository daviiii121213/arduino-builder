/** Hit points for a character, independent of how it behaves. */
export class NPCHealth {
  constructor(max = 100) {
    this.max = max;
    this.value = max;
  }

  get dead() {
    return this.value <= 0;
  }

  /** Applies damage; returns true if this hit was lethal. */
  damage(amount) {
    if (this.dead) return false;
    this.value = Math.max(0, this.value - amount);
    return this.dead;
  }

  reset() {
    this.value = this.max;
  }
}
