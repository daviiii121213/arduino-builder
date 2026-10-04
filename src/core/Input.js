/**
 * Keyboard/mouse state. "Pressed" edges stay true for exactly one rendered frame
 * (cleared by endFrame), held state persists until release.
 */
export class Input {
  constructor(element) {
    this.element = element;
    this.keysDown = new Set();
    this.keysPressed = new Set();
    this.mouseDown = new Set();
    this.mousePressed = new Set();
    this.mouseDelta = { x: 0, y: 0 };
    this.pointerLocked = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keysDown.add(e.code);
      this.keysPressed.add(e.code);
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.mouseDown.clear();
    });

    element.addEventListener('mousedown', (e) => {
      this.mouseDown.add(e.button);
      this.mousePressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.mouseDown.delete(e.button));
    element.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('mousemove', (e) => {
      if (!this.pointerLocked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === element;
      if (!this.pointerLocked) this.mouseDown.clear();
    });
  }

  requestPointerLock() {
    if (!this.pointerLocked) this.element.requestPointerLock?.();
  }

  isDown(code) { return this.keysDown.has(code); }
  wasPressed(code) { return this.keysPressed.has(code); }
  isMouseDown(button) { return this.mouseDown.has(button); }
  wasMousePressed(button) { return this.mousePressed.has(button); }

  /** Returns accumulated mouse movement since the last call. */
  consumeMouseDelta() {
    const d = { x: this.mouseDelta.x, y: this.mouseDelta.y };
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return d;
  }

  endFrame() {
    this.keysPressed.clear();
    this.mousePressed.clear();
  }
}
