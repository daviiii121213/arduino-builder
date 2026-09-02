import { DEFAULT_SOUND, type SoundSettings } from './audio';
import { LANGUAGES, setLanguage, type Language } from './i18n';
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_OPPONENTS,
  DIFFICULTIES,
  MAX_OPPONENTS,
  MIN_OPPONENTS,
} from './difficulty';

export type Screen =
  | 'main'
  | 'car'
  | 'track'
  | 'weather'
  | 'setup'
  | 'competition'
  | 'settings'
  | 'controls'
  | 'sound'
  | 'language'
  | 'howto'
  | 'pause';

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

export type MenuEvent =
  | { type: 'move' }
  | { type: 'confirm' }
  | { type: 'back' }
  | { type: 'sound' }
  | {
      type: 'start';
      car: number;
      track: number;
      weather: number;
      opponents: number;
      difficulty: number;
    }
  /** Close the pause menu and carry on racing. */
  | { type: 'resume' }
  /** Abandon the race and go back to the main menu. */
  | { type: 'quit' }
  /** Start a three-round championship with the chosen car. */
  | { type: 'season'; car: number };

/** Rows on the settings screen, in order. */
export const SETTINGS_ROWS = ['controls', 'sound', 'language', 'howto', 'back'] as const;
/** Rows on the pause menu, in the order the player asked for. */
export const PAUSE_ROWS = ['settings', 'quit', 'resume'] as const;
/** Rows on the last screen before the lights. */
export const SETUP_ROWS = ['opponents', 'difficulty', 'start'] as const;
/** Rows on the main menu. */
export const MAIN_ROWS = ['play', 'competition', 'settings'] as const;

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
  language: Language = 'en';
  /** Which way PLAY was entered: a one-off race, or the championship. */
  entry: 'single' | 'season' = 'single';
  /** How many AI cars line up, and how hard they race. */
  opponents = DEFAULT_OPPONENTS;
  difficulty = DEFAULT_DIFFICULTY;
  /** Where BACK goes from the settings screens: the main menu, or the pause menu. */
  private settingsReturn: Screen = 'main';

  constructor(
    readonly carCount: number,
    readonly trackCount: number,
    readonly weatherCount: number,
  ) {
    this.load();
    setLanguage(this.language);
  }

  /** Number of selectable rows on the current screen. */
  get count(): number {
    switch (this.screen) {
      case 'main':
        return MAIN_ROWS.length;
      case 'car':
        return this.carCount;
      case 'track':
        return this.trackCount;
      case 'weather':
        return this.weatherCount;
      case 'setup':
        return SETUP_ROWS.length;
      case 'competition':
        return 1;
      case 'settings':
        return SETTINGS_ROWS.length;
      case 'sound':
        return 5;
      case 'language':
        return LANGUAGES.length;
      case 'pause':
        return PAUSE_ROWS.length;
      default:
        return 1;
    }
  }

  /** True when left/right change a value rather than moving the cursor. */
  private get horizontal(): boolean {
    return this.screen === 'car' || this.screen === 'track' || this.screen === 'weather';
  }

  /** Opens the in-race pause menu with the cursor on CONTINUE. */
  openPause(): void {
    this.settingsReturn = 'pause';
    this.goto('pause', PAUSE_ROWS.indexOf('resume'));
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
    if (this.screen === 'language') this.applyLanguage(LANGUAGES[this.index].id);
    return [{ type: 'move' }];
  }

  private applyLanguage(language: Language): void {
    this.language = language;
    setLanguage(language);
    this.save();
  }

  private horizontalInput(delta: number): MenuEvent[] {
    if (this.horizontal) return this.step(delta);
    if (this.screen === 'sound') return this.adjustSound(delta);
    if (this.screen === 'setup') return this.adjustSetup(delta);
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

  /** Left/right on the setup screen changes the value under the cursor. */
  private adjustSetup(delta: number): MenuEvent[] {
    const row = SETUP_ROWS[this.index];
    if (row === 'opponents') {
      const next = Math.max(MIN_OPPONENTS, Math.min(MAX_OPPONENTS, this.opponents + delta));
      if (next === this.opponents) return [];
      this.opponents = next;
    } else if (row === 'difficulty') {
      const next = Math.max(0, Math.min(DIFFICULTIES.length - 1, this.difficulty + delta));
      if (next === this.difficulty) return [];
      this.difficulty = next;
    } else {
      return [];
    }
    this.save();
    return [{ type: 'move' }];
  }

  private confirm(): MenuEvent[] {
    switch (this.screen) {
      case 'main': {
        const row = MAIN_ROWS[this.index];
        if (row === 'settings') {
          this.settingsReturn = 'main';
          this.goto('settings');
          return [{ type: 'confirm' }];
        }
        this.entry = row === 'competition' ? 'season' : 'single';
        this.goto('car', this.carIndex);
        return [{ type: 'confirm' }];
      }
      case 'car':
        this.carIndex = this.index;
        // A championship picks its own circuits, so it skips straight to the
        // calendar; a single race carries on to the track list.
        this.goto(this.entry === 'season' ? 'competition' : 'track', this.entry === 'season' ? 0 : this.trackIndex);
        return [{ type: 'confirm' }];
      case 'competition':
        this.save();
        return [{ type: 'confirm' }, { type: 'season', car: this.carIndex }];
      case 'track':
        this.trackIndex = this.index;
        this.goto('weather', this.weatherIndex);
        return [{ type: 'confirm' }];
      case 'weather':
        this.weatherIndex = this.index;
        this.goto('setup', SETUP_ROWS.indexOf('start'));
        return [{ type: 'confirm' }];
      case 'setup': {
        const row = SETUP_ROWS[this.index];
        // Enter on a value row nudges it up; on START it drops the flag.
        if (row !== 'start') return this.adjustSetup(1);
        this.save();
        return [
          { type: 'confirm' },
          {
            type: 'start',
            car: this.carIndex,
            track: this.trackIndex,
            weather: this.weatherIndex,
            opponents: this.opponents,
            difficulty: this.difficulty,
          },
        ];
      }
      case 'settings': {
        const row = SETTINGS_ROWS[this.index];
        if (row === 'back') return this.back();
        if (row === 'language') this.goto('language', LANGUAGES.findIndex((l) => l.id === this.language));
        else this.goto(row);
        return [{ type: 'confirm' }];
      }
      case 'language':
        this.applyLanguage(LANGUAGES[this.index].id);
        return [{ type: 'confirm' }, ...this.back()];
      case 'pause': {
        const row = PAUSE_ROWS[this.index];
        if (row === 'settings') {
          this.goto('settings');
          return [{ type: 'confirm' }];
        }
        if (row === 'quit') return [{ type: 'confirm' }, { type: 'quit' }];
        return [{ type: 'confirm' }, { type: 'resume' }];
      }
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
        this.goto('main', this.entry === 'season' ? MAIN_ROWS.indexOf('competition') : 0);
        break;
      case 'competition':
        this.goto('car', this.carIndex);
        break;
      case 'track':
        this.goto('car', this.carIndex);
        break;
      case 'weather':
        this.goto('track', this.trackIndex);
        break;
      case 'setup':
        this.goto('weather', this.weatherIndex);
        break;
      case 'settings':
        if (this.settingsReturn === 'pause') this.goto('pause', PAUSE_ROWS.indexOf('settings'));
        else this.goto('main', MAIN_ROWS.indexOf('settings'));
        break;
      case 'controls':
        this.goto('settings', SETTINGS_ROWS.indexOf('controls'));
        break;
      case 'sound':
        this.goto('settings', SETTINGS_ROWS.indexOf('sound'));
        break;
      case 'language':
        this.goto('settings', SETTINGS_ROWS.indexOf('language'));
        break;
      case 'howto':
        this.goto('settings', SETTINGS_ROWS.indexOf('howto'));
        break;
      case 'pause':
        return [{ type: 'back' }, { type: 'resume' }];
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
    if (this.screen === 'language') this.applyLanguage(LANGUAGES[index].id);
    return moved ? [{ type: 'move' }] : [];
  }

  /** Returns to the top level, e.g. after a race. */
  reset(): void {
    this.settingsReturn = 'main';
    this.entry = 'single';
    this.goto('main', 0);
  }

  save(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          sound: this.sound,
          language: this.language,
          car: this.carIndex,
          track: this.trackIndex,
          weather: this.weatherIndex,
          opponents: this.opponents,
          difficulty: this.difficulty,
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
        language?: Language;
        car?: number;
        track?: number;
        weather?: number;
        opponents?: number;
        difficulty?: number;
      };
      if (data.sound) this.sound = { ...DEFAULT_SOUND, ...data.sound };
      if (LANGUAGES.some((l) => l.id === data.language)) this.language = data.language as Language;
      const inRange = (v: number | undefined, max: number): number =>
        typeof v === 'number' && v >= 0 && v < max ? Math.floor(v) : 0;
      this.carIndex = inRange(data.car, this.carCount);
      this.trackIndex = inRange(data.track, this.trackCount);
      this.weatherIndex = inRange(data.weather, this.weatherCount);
      if (
        typeof data.opponents === 'number' &&
        data.opponents >= MIN_OPPONENTS &&
        data.opponents <= MAX_OPPONENTS
      ) {
        this.opponents = Math.floor(data.opponents);
      }
      if (
        typeof data.difficulty === 'number' &&
        data.difficulty >= 0 &&
        data.difficulty < DIFFICULTIES.length
      ) {
        // Easy is index 0, so a plain truthiness check would lose it.
        this.difficulty = Math.floor(data.difficulty);
      }
    } catch {
      // Corrupt or unavailable storage: fall back to defaults.
    }
  }
}
