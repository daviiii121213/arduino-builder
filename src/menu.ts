import { DEFAULT_SOUND, type SoundSettings } from './audio';

export type Screen = 'main' | 'car' | 'track' | 'weather' | 'settings' | 'controls' | 'sound' | 'howto';

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

export type MenuEvent =
  | { type: 'move' }
  | { type: 'confirm' }
  | { type: 'back' }
  | { type: 'sound' }
  | { type: 'start'; car: number; track: number; weather: number };

const STORAGE_KEY = 'pixel-racer.settings';

/**
 * The menu is a small state machine with no drawing in it, so the whole
 * navigation can be tested headless.
 */
export class MenuModel {
  screen: Screen = 'main';
  index = 0;
  carIndex = 0;
  trackIndex = 0;
  weatherIndex = 0;
  sound: SoundSettings = { ...DEFAULT_SOUND };

  constructor(
    readonly carCount: number,
    readonly trackCount: number,
    readonly weatherCount: number,
  ) {
    this.load();
  }

  /** Number of selectable rows on the current screen. */
  get count(): number {
    switch (this.screen) {
      case 'main':
        return 2;
      case 'car':
        return this.carCount;
      case 'track':
        return this.trackCount;
      case 'weather':
        return this.weatherCount;
      case 'settings':
        return 4;
      case 'sound':
        return 5;
      default:
        return 1;
    }
  }

  /** True when left/right change a value rather than moving the cursor. */
  private get horizontal(): boolean {
    return this.screen === 'car' || this.screen === 'track' || this.screen === 'weather';
  }

  private goto(screen: Screen, index = 0): void {
    this.screen = screen;
    this.index = index;
  }

  input(action: MenuAction): MenuEvent[] {
    switch (action) {
      case 'up':
      case 'down':
        return this.step(action === 'up' ? -1 : 1);
      case 'left':
      case 'right':
        return this.horizontalInput(action === 'left' ? -1 : 1);
      case 'confirm':
        return this.confirm();
      case 'back':
        return this.back();
    }
  }

  private step(delta: number): MenuEvent[] {
    const n = this.count;
    if (n <= 1) return [];
    this.index = (this.index + delta + n) % n;
    if (this.screen === 'car') this.carIndex = this.index;
    if (this.screen === 'track') this.trackIndex = this.index;
    if (this.screen === 'weather') this.weatherIndex = this.index;
    return [{ type: 'move' }];
  }

  private horizontalInput(delta: number): MenuEvent[] {
    if (this.horizontal) return this.step(delta);
    if (this.screen === 'sound') return this.adjustSound(delta);
    return [];
  }

  private adjustSound(delta: number): MenuEvent[] {
    const clamp01 = (v: number): number => Math.max(0, Math.min(1, Math.round(v * 10) / 10));
    switch (this.index) {
      case 0:
        this.sound.master = clamp01(this.sound.master + delta * 0.1);
        break;
      case 1:
        this.sound.sfx = clamp01(this.sound.sfx + delta * 0.1);
        break;
      case 2:
        this.sound.engine = clamp01(this.sound.engine + delta * 0.1);
        break;
      case 3:
        this.sound.muted = !this.sound.muted;
        break;
      default:
        return [];
    }
    this.save();
    return [{ type: 'sound' }];
  }

  private confirm(): MenuEvent[] {
    switch (this.screen) {
      case 'main':
        if (this.index === 0) {
          this.goto('car', this.carIndex);
          return [{ type: 'confirm' }];
        }
        this.goto('settings');
        return [{ type: 'confirm' }];
      case 'car':
        this.carIndex = this.index;
        this.goto('track', this.trackIndex);
        return [{ type: 'confirm' }];
      case 'track':
        this.trackIndex = this.index;
        this.goto('weather', this.weatherIndex);
        return [{ type: 'confirm' }];
      case 'weather':
        this.weatherIndex = this.index;
        this.save();
        return [
          { type: 'confirm' },
          { type: 'start', car: this.carIndex, track: this.trackIndex, weather: this.weatherIndex },
        ];
      case 'settings':
        if (this.index === 0) this.goto('controls');
        else if (this.index === 1) this.goto('sound');
        else if (this.index === 2) this.goto('howto');
        else return this.back();
        return [{ type: 'confirm' }];
      case 'sound':
        if (this.index === 3) return this.adjustSound(1);
        if (this.index === 4) return this.back();
        return [];
      default:
        return this.back();
    }
  }

  private back(): MenuEvent[] {
    switch (this.screen) {
      case 'main':
        return [];
      case 'car':
        this.goto('main', 0);
        break;
      case 'track':
        this.goto('car', this.carIndex);
        break;
      case 'weather':
        this.goto('track', this.trackIndex);
        break;
      case 'settings':
        this.goto('main', 1);
        break;
      case 'controls':
        this.goto('settings', 0);
        break;
      case 'sound':
        this.goto('settings', 1);
        break;
      case 'howto':
        this.goto('settings', 2);
        break;
    }
    return [{ type: 'back' }];
  }

  /** Jump straight to a row and activate it — used for mouse clicks. */
  select(index: number): MenuEvent[] {
    if (index < 0 || index >= this.count) return [];
    const moved = index !== this.index;
    this.index = index;
    if (this.screen === 'car') this.carIndex = index;
    if (this.screen === 'track') this.trackIndex = index;
    if (this.screen === 'weather') this.weatherIndex = index;
    return moved ? [{ type: 'move' }] : [];
  }

  /** Returns to the top level, e.g. after a race. */
  reset(): void {
    this.goto('main', 0);
  }

  save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sound: this.sound,
          car: this.carIndex,
          track: this.trackIndex,
          weather: this.weatherIndex,
        }),
      );
    } catch {
      // Private windows and blocked storage are fine: settings just don't persist.
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        sound?: Partial<SoundSettings>;
        car?: number;
        track?: number;
        weather?: number;
      };
      if (data.sound) this.sound = { ...DEFAULT_SOUND, ...data.sound };
      const inRange = (v: number | undefined, max: number): number =>
        typeof v === 'number' && v >= 0 && v < max ? Math.floor(v) : 0;
      this.carIndex = inRange(data.car, this.carCount);
      this.trackIndex = inRange(data.track, this.trackCount);
      this.weatherIndex = inRange(data.weather, this.weatherCount);
    } catch {
      // Corrupt or unavailable storage: fall back to defaults.
    }
  }
}
