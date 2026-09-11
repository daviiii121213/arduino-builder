export class Camera {
  constructor() {
    this.x = 0; this.y = 0;      // centre, in world pixels
    this.zoom = 1.35;
    this.targetZoom = 1.35;
    this.vw = 0; this.vh = 0;
    this.dpr = 1;
    this.shake = 0;
    this.ox = 0; this.oy = 0;
  }

  resize(w, h) { this.vw = w; this.vh = h; }

  follow(px, py, dt) {
    const k = 1 - Math.pow(0.0015, dt);
    this.x += (px - this.x) * k;
    this.y += (py - this.y) * k;
  }

  update(dt) {
    this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 8);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      this.ox = (Math.random() - 0.5) * this.shake * 16;
      this.oy = (Math.random() - 0.5) * this.shake * 16;
    } else { this.ox = 0; this.oy = 0; }
  }

  apply(g) {
    const z = this.zoom * this.dpr;
    g.setTransform(z, 0, 0, z,
      Math.round((this.vw / 2 - this.x * this.zoom + this.ox) * this.dpr),
      Math.round((this.vh / 2 - this.y * this.zoom + this.oy) * this.dpr));
  }

  /** Screen-space transform for HUD/overlay drawing (CSS pixel coordinates). */
  applyScreen(g) { g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.vw / 2 + this.ox,
      y: (wy - this.y) * this.zoom + this.vh / 2 + this.oy,
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.vw / 2 - this.ox) / this.zoom + this.x,
      y: (sy - this.vh / 2 - this.oy) / this.zoom + this.y,
    };
  }

  get view() {
    const hw = this.vw / 2 / this.zoom, hh = this.vh / 2 / this.zoom;
    return { x0: this.x - hw, y0: this.y - hh, x1: this.x + hw, y1: this.y + hh };
  }
}
