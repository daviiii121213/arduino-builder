// Keyboard + mouse state. UI panels can claim the pointer so world clicks don't leak through.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();   // edge-triggered, cleared at end of frame
    this.released = new Set();
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false, clicked: false, rclicked: false, wheel: 0, dragX: 0, dragY: 0 };
    this.blockWorld = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) { return; }
      const k = e.key.toLowerCase();
      if (['tab', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '/'].includes(k)) e.preventDefault();
      this.keys.add(k); this.pressed.add(k);
    });
    addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); this.keys.delete(k); this.released.add(k); });
    addEventListener('blur', () => this.keys.clear());

    const setPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const nx = e.clientX - r.left;      // CSS pixels; the renderer scales by devicePixelRatio
      const ny = e.clientY - r.top;
      this.mouse.dragX = nx - this.mouse.x; this.mouse.dragY = ny - this.mouse.y;
      this.mouse.x = nx; this.mouse.y = ny;
    };
    canvas.addEventListener('mousemove', setPos);
    canvas.addEventListener('mousedown', (e) => {
      setPos(e);
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.rclicked = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.mouse.wheel += Math.sign(e.deltaY); }, { passive: false });
  }

  down(k) { return this.keys.has(k); }
  hit(k) { return this.pressed.has(k); }
  get click() { return this.mouse.clicked; }
  get rclick() { return this.mouse.rclicked; }

  endFrame() {
    this.pressed.clear(); this.released.clear();
    this.mouse.clicked = false; this.mouse.rclicked = false; this.mouse.wheel = 0;
    this.mouse.dragX = 0; this.mouse.dragY = 0;
  }
}
