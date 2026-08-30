export class Camera {
  x = 0;
  y = 0;
  zoom = 9; // pixels per meter
  shake = 0;
  private shakeSeed = Math.random() * 1000;

  follow(targetX: number, targetY: number, dt: number): void {
    const smoothing = 1 - Math.pow(0.001, dt);
    this.x += (targetX - this.x) * smoothing;
    this.y += (targetY - this.y) * smoothing;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }

  shakeOffset(): { x: number; y: number } {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const t = performance.now() / 1000 + this.shakeSeed;
    return {
      x: Math.sin(t * 45) * this.shake * 6,
      y: Math.cos(t * 37) * this.shake * 6,
    };
  }

  worldToScreen(x: number, y: number, screenW: number, screenH: number): { x: number; y: number } {
    const off = this.shakeOffset();
    return {
      x: (x - this.x) * this.zoom + screenW / 2 + off.x,
      y: (y - this.y) * this.zoom + screenH / 2 + off.y,
    };
  }
}
